/**
 * Arranque y cableado.
 *
 * La pestaña Datos se construye una sola vez y sus campos quedan como DOM no
 * controlado: así no pierdes el foco ni el cursor mientras escribes. Todo lo
 * demás es salida pura y se vuelve a dibujar en cada cambio.
 */

import { evaluarOperacion, SUPUESTOS } from '../engine/index.js';
import {
  cargar, guardar, limpiar, escenarioActivo, leerRuta, escribirRuta,
  agregarEscenario, duplicarEscenario, eliminarEscenario,
} from './estado.js';
import { uf, clp, pct, numero, aNumero, esc } from './formato.js';
import { chip, etiquetaSemaforo } from './componentes.js';
import {
  vistaDatos, vistaResultado, montarResultado, vistaComparar, montarComparar,
  vistaRiesgo, montarRiesgo, vistaTabla, montarTabla, vistaSupuestos,
} from './vistas.js';
import { ocultarGlobo } from './graficos.js';

const PESTANAS = [
  { id: 'datos', texto: 'Datos' },
  { id: 'resultado', texto: 'Resultado' },
  { id: 'comparar', texto: 'Comparar' },
  { id: 'riesgo', texto: 'Riesgo' },
  { id: 'tabla', texto: 'Amortización' },
  { id: 'supuestos', texto: 'Supuestos' },
];

let estado = cargar();
let ultimoResultado = null;
let temporizador = null;

/* ---------------------------------------------------------------- */
/* Estructura fija                                                    */
/* ---------------------------------------------------------------- */

function construirEsqueleto() {
  document.body.innerHTML = `
    <header class="cabecera">
      <div class="cabecera-fila">
        <div class="marca">
          <h1>Dividendo &amp; Decisión</h1>
          <span class="sub">Chile · 2026</span>
        </div>
        <div class="uf-control">
          <label for="valor-uf">UF</label>
          <input id="valor-uf" data-ruta="mercado.valorUF" data-tipo="clp" inputmode="decimal">
          <span class="fecha">al ${esc(SUPUESTOS.valorUF.fuente.split(', ').pop())}</span>
        </div>
      </div>
      <div class="resumen" data-salida="resumen"></div>
    </header>

    <nav class="pestanas" aria-label="Secciones">
      <div class="pestanas-fila" role="tablist">
        ${PESTANAS.map((p) => `<button class="pestana" role="tab" id="tab-${p.id}"
          aria-controls="panel-${p.id}" aria-selected="false" data-pestana="${p.id}">${esc(p.texto)}</button>`).join('')}
      </div>
    </nav>

    <main>
      <div class="acciones" style="margin-bottom:var(--r4)" data-salida="escenarios"></div>
      ${PESTANAS.map((p) => `<section id="panel-${p.id}" role="tabpanel" aria-labelledby="tab-${p.id}" hidden
        ${p.id === 'datos' ? '' : `data-salida="${p.id}"`}></section>`).join('')}
    </main>

    <footer class="pie-legal">
      <p><strong>Esto es una herramienta de decisión, no asesoría financiera ni una preaprobación.</strong>
      Los seguros, los gastos operacionales y el castigo de renta varían de forma significativa entre bancos y
      solo quedan fijos con una cotización formal. Ninguna cifra acá compromete a ninguna institución.</p>
      <p>Los cálculos corren enteros en tu navegador. No hay servidor, no se envía nada a ninguna parte,
      y lo que guardas se queda en este dispositivo. Parámetros verificados al ${esc(SUPUESTOS.valorUF.fuente.split(', ').pop())}.</p>
    </footer>`;

  document.getElementById('panel-datos').innerHTML = vistaDatos();
}

/* ---------------------------------------------------------------- */
/* Enlace de campos                                                   */
/* ---------------------------------------------------------------- */

function aTexto(valor, tipo) {
  if (valor == null) return '';
  switch (tipo) {
    case 'pct': return numero(valor * 100, valor * 100 % 1 === 0 ? 0 : 2);
    case 'pctFino': return (valor * 100).toLocaleString('es-CL', { maximumFractionDigits: 4 });
    case 'clp': return Math.round(valor).toLocaleString('es-CL');
    case 'uf': return numero(valor, valor % 1 === 0 ? 0 : 2);
    case 'numero': return String(valor);
    case 'lista': return Array.isArray(valor) ? valor.map((v) => Math.round(v)).join(', ') : '';
    default: return String(valor);
  }
}

function desdeTexto(texto, tipo) {
  switch (tipo) {
    case 'pct':
    case 'pctFino': return aNumero(texto) / 100;
    case 'clp':
    case 'uf':
    case 'numero': return aNumero(texto);
    case 'lista':
      return String(texto).split(/[,;\n]+/).map((t) => aNumero(t)).filter((n) => Number.isFinite(n) && n !== 0);
    default: return texto;
  }
}

/** Vuelca el estado a los campos. Se llama al arrancar y al cambiar de escenario. */
function sincronizarCampos() {
  const entrada = escenarioActivo(estado).entrada;
  for (const nodo of document.querySelectorAll('[data-ruta]')) {
    const ruta = nodo.dataset.ruta;
    const tipo = nodo.dataset.tipo;
    const valor = leerRuta(entrada, ruta);
    if (tipo === 'bool') nodo.checked = Boolean(valor);
    else if (document.activeElement !== nodo) nodo.value = aTexto(valor, tipo);
  }
  actualizarEquivalentes();
}

/** Muestra el equivalente en pesos junto a cada campo en UF. */
function actualizarEquivalentes() {
  const entrada = escenarioActivo(estado).entrada;
  const vUF = entrada.mercado.valorUF || 0;
  for (const nodo of document.querySelectorAll('[data-equivalente]')) {
    const valor = leerRuta(entrada, nodo.dataset.equivalente);
    nodo.textContent = Number.isFinite(valor) && valor > 0 ? clp(valor * vUF) : '';
  }
}

function alEscribir(ev) {
  const nodo = ev.target.closest('[data-ruta]');
  if (!nodo) return;
  const entrada = escenarioActivo(estado).entrada;
  const tipo = nodo.dataset.tipo;
  const valor = tipo === 'bool' ? nodo.checked : desdeTexto(nodo.value, tipo);
  escribirRuta(entrada, nodo.dataset.ruta, valor);
  if (nodo.dataset.ruta === 'propiedad.nombre') {
    escenarioActivo(estado).nombre = valor;
  }
  programarActualizacion();
}

function programarActualizacion() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    actualizar();
    guardar(estado);
  }, 140);
}

/* ---------------------------------------------------------------- */
/* Render de salidas                                                  */
/* ---------------------------------------------------------------- */

function actualizar() {
  const activo = escenarioActivo(estado);
  let r;
  try {
    r = evaluarOperacion(activo.entrada);
    ultimoResultado = r;
  } catch (err) {
    document.querySelector('[data-salida="resumen"]').innerHTML =
      `<div class="aviso error">No se puede calcular con estos datos: ${esc(err.message)}</div>`;
    return;
  }

  actualizarEquivalentes();
  renderResumen(r);
  renderEscenarios();

  const vistas = {
    resultado: () => vistaResultado(r, estado),
    comparar: () => vistaComparar(r, estado),
    riesgo: () => vistaRiesgo(r),
    tabla: () => vistaTabla(r, estado),
    supuestos: () => vistaSupuestos(r),
  };
  const montajes = {
    resultado: montarResultado, comparar: montarComparar,
    riesgo: montarRiesgo, tabla: montarTabla,
  };

  // Solo se dibuja la pestaña visible: el resto se dibuja al abrirla.
  const actual = estado.pestana;
  if (vistas[actual]) {
    const panel = document.getElementById(`panel-${actual}`);
    panel.innerHTML = vistas[actual]();
    montajes[actual]?.(panel, r, estado);
  }
}

function renderResumen(r) {
  const vUF = r.entrada.mercado.valorUF;
  const c = r.credito;
  const carga = r.ingresos.carga;
  const inv = r.inversion;

  const chips = [
    carga.valor != null ? chip(carga.semaforo, `Carga ${pct(carga.valor, 1)}`) : chip('sin-dato', 'Carga sin dato'),
    inv ? chip(inv.flujoMensualUF >= 0 ? 'verde' : 'rojo',
      `Flujo ${inv.flujoMensualUF >= 0 ? '+' : ''}${uf(inv.flujoMensualUF)}`) : '',
    r.veredicto.conteo.rojo > 0
      ? chip('rojo', `${r.veredicto.conteo.rojo} ${r.veredicto.conteo.rojo === 1 ? 'señal roja' : 'señales rojas'}`)
      : chip('verde', 'Sin señales rojas'),
  ].filter(Boolean).join('');

  document.querySelector('[data-salida="resumen"]').innerHTML = `
    <div class="resumen-cifra">
      <span class="etiqueta">Dividendo mes 1</span>
      <span class="valor">${esc(clp(c.dividendoPrimerMesUF * vUF))}</span>
      <span class="pie">${esc(uf(c.dividendoPrimerMesUF))} · CAE ${esc(pct(c.caeAnual))}</span>
    </div>
    <div class="resumen-cifra">
      <span class="etiqueta">Necesitas al firmar</span>
      <span class="valor chico">${esc(clp((c.pieUF + c.gastosOperacionales.desembolsoInicialUF) * vUF))}</span>
      <span class="pie">${esc(uf(c.pieUF + c.gastosOperacionales.desembolsoInicialUF, 0))}</span>
    </div>
    <div class="resumen-chips">${chips}</div>`;
}

function renderEscenarios() {
  const cont = document.querySelector('[data-salida="escenarios"]');
  const botones = estado.escenarios.map((s) => {
    const activo = s.id === estado.activoId;
    return `<button type="button" class="boton${activo ? ' primario' : ''}" data-escenario="${s.id}">
      ${esc(s.entrada.propiedad.nombre || s.nombre)}</button>`;
  }).join('');
  cont.innerHTML = `${botones}
    <button type="button" class="boton" data-accion="nuevo-escenario">+ Nuevo</button>
    <button type="button" class="boton" data-accion="duplicar-escenario">Duplicar</button>
    ${estado.escenarios.length > 1 ? '<button type="button" class="boton peligro" data-accion="eliminar-escenario">Eliminar</button>' : ''}`;
}

/* ---------------------------------------------------------------- */
/* Pestañas                                                           */
/* ---------------------------------------------------------------- */

function irA(pestana) {
  estado.pestana = pestana;
  ocultarGlobo();
  for (const p of PESTANAS) {
    const tab = document.getElementById(`tab-${p.id}`);
    const panel = document.getElementById(`panel-${p.id}`);
    const activo = p.id === pestana;
    tab.setAttribute('aria-selected', String(activo));
    panel.hidden = !activo;
  }
  actualizar();
  guardar(estado);
}

/* ---------------------------------------------------------------- */
/* Acciones                                                           */
/* ---------------------------------------------------------------- */

/**
 * Descarga de archivos por dos caminos.
 *
 * Abierta como archivo suelto, basta un enlace con `download`. Publicada, el
 * visor no le da a la página permiso de descarga y ese enlace no hace nada,
 * así que hay que pedírselo al anfitrión. Se intenta primero el camino del
 * anfitrión y se cae al local, para que el mismo archivo sirva en los dos casos.
 */
let capacidadDescargas;

async function resolverDescargas() {
  if (capacidadDescargas !== undefined) return capacidadDescargas;
  try {
    capacidadDescargas = window.claude?.use ? await window.claude.use('downloads') : null;
  } catch {
    capacidadDescargas = null;
  }
  return capacidadDescargas;
}

function avisar(texto) {
  let nodo = document.querySelector('.mensaje-flotante');
  if (!nodo) {
    nodo = document.createElement('div');
    nodo.className = 'mensaje-flotante';
    nodo.setAttribute('role', 'status');
    document.body.append(nodo);
  }
  nodo.textContent = texto;
  nodo.hidden = false;
  clearTimeout(avisar.temporizador);
  avisar.temporizador = setTimeout(() => { nodo.hidden = true; }, 4000);
}

function descargarLocal(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function descargar(nombre, contenido, tipo) {
  const descargas = await resolverDescargas();
  if (descargas) {
    try {
      await descargas.save({ filename: nombre, data: contenido });
      return;
    } catch (err) {
      const codigo = err?.code;
      if (codigo === 'declined') return; // dijiste que no: no hay nada que hacer
      if (codigo === 'rate_limited') {
        avisar('Hay otra descarga esperando confirmación. Inténtalo en unos segundos.');
        return;
      }
      if (codigo === 'too_large') {
        avisar('El archivo pasa el límite de 16 MB.');
        return;
      }
      // Cualquier otra cosa: queda el camino local.
    }
  }
  descargarLocal(nombre, contenido, tipo);
}

function exportarCSV() {
  if (!ultimoResultado) return;
  const vUF = ultimoResultado.entrada.mercado.valorUF;
  const cabecera = ['mes', 'anio', 'dividendo_uf', 'interes_uf', 'capital_uf', 'seguros_uf', 'abono_uf', 'saldo_uf', 'dividendo_clp'];
  const filas = ultimoResultado.credito.filas.map((f) => [
    f.mes, Math.ceil(f.mes / 12),
    f.dividendoUF.toFixed(4), f.interes.toFixed(4), f.amortizacion.toFixed(4),
    f.segurosUF.toFixed(4), f.abonoExtra.toFixed(4), f.saldo.toFixed(4),
    Math.round(f.dividendoUF * vUF),
  ].join(','));
  descargar('amortizacion.csv', [cabecera.join(','), ...filas].join('\n'), 'text/csv;charset=utf-8');
}

function exportarJSON() {
  descargar('calculadora-hipotecaria.json', JSON.stringify({
    version: 1,
    exportadoEl: new Date().toISOString(),
    escenarios: estado.escenarios,
  }, null, 2), 'application/json');
}

function importarJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      if (!Array.isArray(datos.escenarios) || !datos.escenarios.length) {
        throw new Error('El archivo no trae escenarios.');
      }
      estado.escenarios = datos.escenarios;
      estado.activoId = datos.escenarios[0].id;
      guardar(estado);
      sincronizarCampos();
      renderEscenarios();
      actualizar();
    } catch (err) {
      avisar(`No se pudo importar: ${err.message}`);
    }
  });
  input.click();
}

function alHacerClic(ev) {
  const pestana = ev.target.closest('[data-pestana]');
  if (pestana) return irA(pestana.dataset.pestana);

  const escenario = ev.target.closest('[data-escenario]');
  if (escenario) {
    estado.activoId = escenario.dataset.escenario;
    sincronizarCampos();
    actualizar();
    guardar(estado);
    return;
  }

  const accion = ev.target.closest('[data-accion]')?.dataset.accion;
  if (!accion) return;

  switch (accion) {
    case 'nuevo-escenario':
      estado = agregarEscenario(estado);
      sincronizarCampos(); actualizar(); guardar(estado);
      break;
    case 'duplicar-escenario':
      estado = duplicarEscenario(estado, estado.activoId);
      sincronizarCampos(); actualizar(); guardar(estado);
      break;
    case 'eliminar-escenario':
      if (confirm('¿Eliminar este escenario?')) {
        estado = eliminarEscenario(estado, estado.activoId);
        sincronizarCampos(); actualizar(); guardar(estado);
      }
      break;
    case 'tabla-anual': estado.tablaAnual = true; actualizar(); break;
    case 'tabla-mensual': estado.tablaAnual = false; actualizar(); break;
    case 'tabla-uf': estado.tablaEnPesos = false; actualizar(); break;
    case 'tabla-clp': estado.tablaEnPesos = true; actualizar(); break;
    case 'exportar-csv': exportarCSV(); break;
    case 'exportar-json': exportarJSON(); break;
    case 'importar-json': importarJSON(); break;
    case 'borrar-todo':
      if (confirm('Se borra todo lo que guardaste en este navegador. ¿Seguro?')) {
        limpiar();
        location.reload();
      }
      break;
  }
}

/* ---------------------------------------------------------------- */

export function iniciar() {
  construirEsqueleto();
  sincronizarCampos();
  // Se resuelve de entrada: `use()` puede tardar hasta 10 s en decidir que no
  // hay anfitrión, y eso no se puede pagar en medio de un clic.
  resolverDescargas();

  document.addEventListener('input', alEscribir);
  document.addEventListener('change', alEscribir);
  document.addEventListener('click', alHacerClic);
  // Al salir de un campo numérico, se reformatea a la convención chilena.
  document.addEventListener('focusout', (ev) => {
    const nodo = ev.target.closest('[data-ruta]');
    if (!nodo || nodo.dataset.tipo === 'texto' || nodo.dataset.tipo === 'bool') return;
    const entrada = escenarioActivo(estado).entrada;
    nodo.value = aTexto(leerRuta(entrada, nodo.dataset.ruta), nodo.dataset.tipo);
  });

  irA(estado.pestana && PESTANAS.some((p) => p.id === estado.pestana) ? estado.pestana : 'datos');
}
