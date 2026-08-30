/**
 * Piezas reutilizables de interfaz. Devuelven HTML como texto; el estado se
 * enlaza por `data-ruta`, y un único escuchador delegado en app.js se encarga
 * de leer, convertir y escribir.
 */

import { esc, uf, clp, pct, numero } from './formato.js';

/**
 * Campo de entrada.
 *
 * @param {Object} p
 * @param {string} p.ruta ruta dentro de la entrada, p.ej. 'credito.tasaAnual'
 * @param {string} p.etiqueta
 * @param {'uf'|'clp'|'pct'|'pctFino'|'numero'|'texto'|'bool'|'select'|'lista'} p.tipo
 * @param {string} [p.sufijo]
 * @param {string} [p.ayuda]
 * @param {Array} [p.opciones] para tipo select: [{valor, texto}]
 * @param {string} [p.paso]
 */
export function campo({ ruta, etiqueta, tipo, sufijo, ayuda, opciones, paso, marcador }) {
  const id = `c-${ruta.replace(/\./g, '-')}`;
  const ayudaHtml = ayuda ? `<span class="ayuda" id="${id}-ayuda">${esc(ayuda)}</span>` : '';
  const descrito = ayuda ? ` aria-describedby="${id}-ayuda"` : '';

  if (tipo === 'bool') {
    return `<label class="interruptor" for="${id}">
      <input type="checkbox" id="${id}" data-ruta="${ruta}" data-tipo="bool"${descrito}>
      <span>${esc(etiqueta)}${ayudaHtml}</span>
    </label>`;
  }

  if (tipo === 'select') {
    const ops = opciones.map((o) => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('');
    return `<div class="campo">
      <label for="${id}">${esc(etiqueta)}</label>
      <div class="entrada"><select id="${id}" data-ruta="${ruta}" data-tipo="texto"${descrito}>${ops}</select></div>
      ${ayudaHtml}
    </div>`;
  }

  const esNumero = tipo !== 'texto' && tipo !== 'lista';
  const equivalente = tipo === 'uf' ? `<span class="equivalente" data-equivalente="${ruta}"></span>` : '';

  return `<div class="campo">
    <label for="${id}">${esc(etiqueta)}</label>
    <div class="entrada">
      <input id="${id}" data-ruta="${ruta}" data-tipo="${tipo}"
             type="${esNumero ? 'text' : 'text'}" inputmode="${esNumero ? 'decimal' : 'text'}"
             ${paso ? `data-paso="${paso}"` : ''}
             ${marcador ? `placeholder="${esc(marcador)}"` : ''}${descrito}>
      ${equivalente}
      ${sufijo ? `<span class="sufijo">${esc(sufijo)}</span>` : ''}
    </div>
    ${ayudaHtml}
  </div>`;
}

export function bloque({ titulo, resumen, abierto, contenido }) {
  return `<details class="bloque"${abierto ? ' open' : ''}>
    <summary>${esc(titulo)}${resumen ? ` <span class="resumen-bloque">${esc(resumen)}</span>` : ''}</summary>
    <div class="contenido">${contenido}</div>
  </details>`;
}

export function tarjeta({ titulo, descripcion, contenido, clase = '' }) {
  return `<section class="tarjeta ${clase}">
    ${titulo ? `<header><h2>${esc(titulo)}</h2>${descripcion ? `<p>${esc(descripcion)}</p>` : ''}</header>` : ''}
    ${contenido}
  </section>`;
}

export function chip(estado, texto) {
  return `<span class="chip ${esc(estado)}">${esc(texto)}</span>`;
}

export function chipLiso(texto) {
  return `<span class="chip liso">${esc(texto)}</span>`;
}

export function senal(s) {
  return `<div class="senal ${esc(s.semaforo)}">
    <div class="franja" aria-hidden="true"></div>
    <div class="cuerpo">
      <div class="titulo"><h3>${esc(s.titulo)}</h3>${chip(s.semaforo, etiquetaSemaforo(s.semaforo))}</div>
      <p class="mensaje">${esc(s.mensaje)}</p>
      ${s.detalle ? `<p class="detalle">${esc(s.detalle)}</p>` : ''}
    </div>
  </div>`;
}

export function etiquetaSemaforo(s) {
  return { verde: 'En orden', ambar: 'Atención', rojo: 'Problema', 'sin-dato': 'Sin dato' }[s] || s;
}

/**
 * Lista de desglose. `filas` es [{concepto, monto, nota, total}].
 */
export function desglose(filas, formato) {
  const li = filas.map((f) => `<li${f.total ? ' class="total"' : ''}>
      <span class="concepto">${esc(f.concepto)}${f.nota ? ` <span class="ayuda">${esc(f.nota)}</span>` : ''}</span>
      <span class="monto">${esc(formato(f.monto))}</span>
    </li>`).join('');
  return `<ul class="desglose">${li}</ul>`;
}

/**
 * Tabla genérica. `columnas` es [{clave, titulo, formato, alineacion}].
 */
export function tabla(columnas, filas, { destacar } = {}) {
  const th = columnas.map((c) => `<th class="${c.num === false ? '' : 'num'}">${esc(c.titulo)}</th>`).join('');
  const tr = filas.map((f, i) => {
    const td = columnas.map((c) => {
      const v = c.obtener(f, i);
      const cls = c.num === false ? '' : 'num';
      const marca = c.ganador && c.ganador(f, i) ? ' class="gana"' : '';
      return `<td class="${cls}"><span${marca}>${v}</span></td>`;
    }).join('');
    return `<tr${destacar && destacar(f, i) ? ' class="destacada"' : ''}>${td}</tr>`;
  }).join('');
  return `<div class="tabla-envoltorio"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function aviso(nivel, texto) {
  return `<div class="aviso ${esc(nivel)}">${texto}</div>`;
}

export function cifra({ valor, etiqueta, pie, chica }) {
  return `<div class="resumen-cifra">
    <span class="etiqueta">${esc(etiqueta)}</span>
    <span class="valor${chica ? ' chico' : ''}">${esc(valor)}</span>
    ${pie ? `<span class="pie">${esc(pie)}</span>` : ''}
  </div>`;
}

export function insigniaConfianza(nivel) {
  const texto = { alta: 'Confianza alta', media: 'Verifica', baja: 'Cotiza esto' }[nivel] || nivel;
  return `<span class="confianza ${esc(nivel)}">${esc(texto)}</span>`;
}
