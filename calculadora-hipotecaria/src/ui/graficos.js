/**
 * Gráficos en SVG, escritos a mano. Sin librerías: la app tiene que funcionar
 * como un archivo suelto, sin red.
 *
 * Reglas que se respetan en todos: trazos de 2px, extremos redondeados de 4px
 * anclados a la línea base, rejilla recesiva, leyenda siempre que haya dos o
 * más series, y capa de hover con lectura de valores.
 */

import { uf, clp, pct, numero } from './formato.js';

const NS = 'http://www.w3.org/2000/svg';

function el(nombre, atributos = {}, hijos = []) {
  const n = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) {
    if (v != null) n.setAttribute(k, String(v));
  }
  for (const h of [].concat(hijos)) if (h) n.append(h);
  return n;
}

/** Tooltip único compartido por todos los gráficos. */
let globo = null;
function obtenerGlobo() {
  if (!globo) {
    globo = document.createElement('div');
    globo.className = 'sugerencia';
    globo.hidden = true;
    document.body.append(globo);
  }
  return globo;
}
function mostrarGlobo(evento, html) {
  const g = obtenerGlobo();
  g.innerHTML = html;
  g.hidden = false;
  const r = g.getBoundingClientRect();
  const x = Math.min(evento.clientX + 14, window.innerWidth - r.width - 8);
  const y = Math.max(8, evento.clientY - r.height - 12);
  g.style.left = `${x}px`;
  g.style.top = `${y}px`;
}
function ocultarGlobo() { if (globo) globo.hidden = true; }

function leerColor(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || '#888';
}

function envolver(svg, leyenda) {
  const cont = document.createElement('div');
  cont.className = 'grafico';
  cont.append(svg);
  if (leyenda?.length) {
    const l = document.createElement('div');
    l.className = 'leyenda';
    for (const item of leyenda) {
      const s = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = item.color;
      s.append(i, document.createTextNode(item.texto));
      l.append(s);
    }
    cont.append(l);
  }
  return cont;
}

function ejes(g, { x0, x1, y0, y1, ticks, formatoY, etiquetasX }) {
  const rejilla = leerColor('--rejilla');
  for (const t of ticks) {
    g.append(el('line', {
      x1: x0, x2: x1, y1: t.y, y2: t.y,
      stroke: rejilla, 'stroke-width': 1,
    }));
    const texto = el('text', { x: x0 - 8, y: t.y + 3, 'text-anchor': 'end', class: 'eje' });
    texto.textContent = formatoY(t.valor);
    g.append(texto);
  }
  for (const e of etiquetasX || []) {
    const texto = el('text', { x: e.x, y: y1 + 16, 'text-anchor': 'middle', class: 'eje' });
    texto.textContent = e.texto;
    g.append(texto);
  }
}

function calcularTicks(min, max, y0, y1, cantidad = 4) {
  const rango = max - min || 1;
  const paso = rango / cantidad;
  const ticks = [];
  for (let k = 0; k <= cantidad; k++) {
    const valor = min + paso * k;
    ticks.push({ valor, y: y1 - ((valor - min) / rango) * (y1 - y0) });
  }
  return ticks;
}

/* ------------------------------------------------------------------ */
/* Composición del dividendo: cuánto se va en interés y cuánto amortiza */
/* ------------------------------------------------------------------ */

export function graficoAmortizacion(filas, { valorUF, enPesos }) {
  const ANCHO = 720, ALTO = 260;
  const m = { arriba: 12, derecha: 12, abajo: 26, izquierda: 56 };
  const x0 = m.izquierda, x1 = ANCHO - m.derecha;
  const y0 = m.arriba, y1 = ALTO - m.abajo;

  const n = filas.length;
  const maxCuota = Math.max(...filas.map((f) => f.interes + f.amortizacion));
  const escalaX = (i) => x0 + (i / Math.max(1, n - 1)) * (x1 - x0);
  const escalaY = (v) => y1 - (v / maxCuota) * (y1 - y0);
  const conv = (v) => (enPesos ? v * valorUF : v);
  const fmt = (v) => (enPesos ? clp(conv(v)) : uf(v));

  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, width: '100%', role: 'img',
    'aria-label': 'Composición del dividendo mes a mes entre interés y amortización de capital',
  });
  const g = el('g');
  svg.append(g);

  ejes(g, {
    x0, x1, y0, y1,
    ticks: calcularTicks(0, maxCuota, y0, y1, 4),
    formatoY: (v) => (enPesos ? Math.round(conv(v) / 1000) + 'k' : numero(v, 0)),
    etiquetasX: [0, 0.25, 0.5, 0.75, 1].map((p) => ({
      x: x0 + p * (x1 - x0),
      texto: `Año ${Math.round((p * (n - 1)) / 12)}`,
    })),
  });

  // Área de interés (abajo) y de capital (encima), con 2px de separación.
  const puntosInteres = filas.map((f, i) => `${escalaX(i)},${escalaY(f.interes)}`);
  const puntosTotal = filas.map((f, i) => `${escalaX(i)},${escalaY(f.interes + f.amortizacion)}`);

  g.append(el('polygon', {
    points: `${x0},${y1} ${puntosInteres.join(' ')} ${x1},${y1}`,
    fill: leerColor('--serie-2'), 'fill-opacity': 0.85,
  }));
  g.append(el('polygon', {
    points: `${puntosInteres.join(' ')} ${[...puntosTotal].reverse().join(' ')}`,
    fill: leerColor('--serie-1'), 'fill-opacity': 0.85,
    stroke: leerColor('--superficie'), 'stroke-width': 2, 'stroke-linejoin': 'round',
  }));

  // Capa de hover con línea guía.
  const guia = el('line', {
    y1: y0, y2: y1, stroke: leerColor('--tinta-3'), 'stroke-width': 1,
    'stroke-dasharray': '3 3', opacity: 0,
  });
  g.append(guia);
  const zona = el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'transparent' });
  g.append(zona);

  zona.addEventListener('mousemove', (ev) => {
    const caja = svg.getBoundingClientRect();
    const px = ((ev.clientX - caja.left) / caja.width) * ANCHO;
    const i = Math.round(((px - x0) / (x1 - x0)) * (n - 1));
    const f = filas[Math.max(0, Math.min(n - 1, i))];
    if (!f) return;
    guia.setAttribute('x1', escalaX(f.mes - 1));
    guia.setAttribute('x2', escalaX(f.mes - 1));
    guia.setAttribute('opacity', '1');
    mostrarGlobo(ev, `
      <span class="t">Mes ${f.mes} · año ${Math.ceil(f.mes / 12)}</span>
      <span class="f"><span>Interés</span><span>${fmt(f.interes)}</span></span>
      <span class="f"><span>Capital</span><span>${fmt(f.amortizacion)}</span></span>
      <span class="f"><span>Saldo</span><span>${fmt(f.saldo)}</span></span>`);
  });
  zona.addEventListener('mouseleave', () => { guia.setAttribute('opacity', '0'); ocultarGlobo(); });

  return envolver(svg, [
    { color: leerColor('--serie-2'), texto: 'Interés (se lo lleva el banco)' },
    { color: leerColor('--serie-1'), texto: 'Capital (queda para ti)' },
  ]);
}

/* ---------------------------------------------- */
/* Patrimonio: comprar contra arrendar e invertir  */
/* ---------------------------------------------- */

export function graficoPatrimonio(serie, { valorUF, enPesos, anioDeCruce }) {
  const ANCHO = 720, ALTO = 260;
  const m = { arriba: 14, derecha: 14, abajo: 26, izquierda: 62 };
  const x0 = m.izquierda, x1 = ANCHO - m.derecha;
  const y0 = m.arriba, y1 = ALTO - m.abajo;

  const valores = serie.flatMap((s) => [s.patrimonioComprarUF, s.patrimonioArrendarUF]);
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores);
  const escalaX = (a) => x0 + ((a - serie[0].anio) / Math.max(1, serie.length - 1)) * (x1 - x0);
  const escalaY = (v) => y1 - ((v - min) / (max - min || 1)) * (y1 - y0);
  const conv = (v) => (enPesos ? v * valorUF : v);
  const fmt = (v) => (enPesos ? clp(conv(v)) : uf(v, 0));

  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, width: '100%', role: 'img',
    'aria-label': 'Patrimonio proyectado comprando frente a arrendar e invertir la diferencia',
  });
  const g = el('g');
  svg.append(g);

  ejes(g, {
    x0, x1, y0, y1,
    ticks: calcularTicks(min, max, y0, y1, 4),
    formatoY: (v) => (enPesos ? Math.round(conv(v) / 1e6) + 'M' : numero(v, 0)),
    etiquetasX: serie
      .filter((_, i) => i % Math.ceil(serie.length / 6) === 0 || i === serie.length - 1)
      .map((s) => ({ x: escalaX(s.anio), texto: `A${s.anio}` })),
  });

  if (min < 0) {
    g.append(el('line', {
      x1: x0, x2: x1, y1: escalaY(0), y2: escalaY(0),
      stroke: leerColor('--borde-fuerte'), 'stroke-width': 1,
    }));
  }

  const linea = (clave, color) => {
    const d = serie.map((s, i) => `${i === 0 ? 'M' : 'L'}${escalaX(s.anio)},${escalaY(s[clave])}`).join(' ');
    g.append(el('path', {
      d, fill: 'none', stroke: color, 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    const ultimo = serie[serie.length - 1];
    g.append(el('circle', {
      cx: escalaX(ultimo.anio), cy: escalaY(ultimo[clave]), r: 4.5,
      fill: color, stroke: leerColor('--superficie'), 'stroke-width': 2,
    }));
  };
  linea('patrimonioArrendarUF', leerColor('--serie-3'));
  linea('patrimonioComprarUF', leerColor('--serie-1'));

  if (anioDeCruce && anioDeCruce >= serie[0].anio && anioDeCruce <= serie[serie.length - 1].anio) {
    g.append(el('line', {
      x1: escalaX(anioDeCruce), x2: escalaX(anioDeCruce), y1: y0, y2: y1,
      stroke: leerColor('--tinta-3'), 'stroke-width': 1, 'stroke-dasharray': '4 3',
    }));
    const t = el('text', { x: escalaX(anioDeCruce) + 5, y: y0 + 11, class: 'eje-texto' });
    t.textContent = `cruce año ${numero(anioDeCruce, 1)}`;
    g.append(t);
  }

  const zona = el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'transparent' });
  g.append(zona);
  zona.addEventListener('mousemove', (ev) => {
    const caja = svg.getBoundingClientRect();
    const px = ((ev.clientX - caja.left) / caja.width) * ANCHO;
    const idx = Math.round(((px - x0) / (x1 - x0)) * (serie.length - 1));
    const s = serie[Math.max(0, Math.min(serie.length - 1, idx))];
    if (!s) return;
    mostrarGlobo(ev, `
      <span class="t">Año ${s.anio}</span>
      <span class="f"><span>Comprar</span><span>${fmt(s.patrimonioComprarUF)}</span></span>
      <span class="f"><span>Arrendar</span><span>${fmt(s.patrimonioArrendarUF)}</span></span>
      <span class="f"><span>Diferencia</span><span>${fmt(s.diferenciaUF)}</span></span>`);
  });
  zona.addEventListener('mouseleave', ocultarGlobo);

  return envolver(svg, [
    { color: leerColor('--serie-1'), texto: 'Comprar: valor de la propiedad menos deuda' },
    { color: leerColor('--serie-3'), texto: 'Arrendar: el pie y la diferencia, invertidos' },
  ]);
}

/* ------------------------------------------ */
/* Tornado: qué supuesto mueve más el dividendo */
/* ------------------------------------------ */

export function graficoTornado(filas, base, { valorUF, enPesos }) {
  const utilizables = filas.filter((f) => f.impacto > 0).slice(0, 6);
  if (!utilizables.length) return document.createElement('div');

  const ALTO_FILA = 34;
  const ANCHO = 720;
  const ALTO = utilizables.length * ALTO_FILA + 30;
  const izquierda = 190, derecha = ANCHO - 16;
  const centro = izquierda + (derecha - izquierda) / 2;
  const maxImpacto = Math.max(...utilizables.map((f) => f.impacto));
  const media = (derecha - izquierda) / 2;
  const conv = (v) => (enPesos ? v * valorUF : v);
  const fmt = (v) => (enPesos ? clp(conv(v)) : uf(v));

  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, width: '100%', role: 'img',
    'aria-label': 'Sensibilidad del dividendo a cada supuesto, ordenada por impacto',
  });
  const g = el('g');
  svg.append(g);

  g.append(el('line', {
    x1: centro, x2: centro, y1: 4, y2: ALTO - 26,
    stroke: leerColor('--borde-fuerte'), 'stroke-width': 1,
  }));

  utilizables.forEach((f, i) => {
    const y = 8 + i * ALTO_FILA;
    const etiqueta = el('text', { x: izquierda - 12, y: y + 15, 'text-anchor': 'end', class: 'eje-texto' });
    etiqueta.textContent = f.etiqueta;
    g.append(etiqueta);

    for (const lado of ['deltaBajo', 'deltaAlto']) {
      const d = f[lado];
      if (d == null || d === 0) continue;
      const largo = (Math.abs(d) / maxImpacto) * media;
      // Baja el dividendo (bueno) hacia la izquierda; lo sube (malo) a la derecha.
      const esBueno = d < 0;
      const x = esBueno ? centro - largo : centro;
      const barra = el('rect', {
        x, y: y + 4, width: Math.max(2, largo), height: 15,
        rx: 4, ry: 4,
        fill: esBueno ? leerColor('--bien') : leerColor('--grave'),
        'fill-opacity': 0.9,
      });
      barra.addEventListener('mousemove', (ev) => mostrarGlobo(ev, `
        <span class="t">${f.etiqueta}</span>
        <span class="f"><span>${lado === 'deltaBajo' ? 'Escenario bajo' : 'Escenario alto'}</span><span></span></span>
        <span class="f"><span>Dividendo</span><span>${fmt(base + d)}</span></span>
        <span class="f"><span>Cambio</span><span>${d > 0 ? '+' : ''}${fmt(d)}</span></span>`));
      barra.addEventListener('mouseleave', ocultarGlobo);
      g.append(barra);
    }
  });

  const pie1 = el('text', { x: centro - 10, y: ALTO - 8, 'text-anchor': 'end', class: 'eje-texto' });
  pie1.textContent = '← baja el dividendo';
  const pie2 = el('text', { x: centro + 10, y: ALTO - 8, class: 'eje-texto' });
  pie2.textContent = 'sube el dividendo →';
  g.append(pie1, pie2);

  return envolver(svg, [
    { color: leerColor('--bien'), texto: 'A tu favor' },
    { color: leerColor('--grave'), texto: 'En tu contra' },
  ]);
}

/* -------------------------------------- */
/* Barras simples (ahorro del Art. 55 bis) */
/* -------------------------------------- */

export function graficoBarras(datos, { formato = (v) => numero(v, 0), titulo = '' } = {}) {
  if (!datos.length) return document.createElement('div');
  const ANCHO = 720, ALTO = 180;
  const m = { arriba: 12, derecha: 12, abajo: 24, izquierda: 62 };
  const x0 = m.izquierda, x1 = ANCHO - m.derecha, y0 = m.arriba, y1 = ALTO - m.abajo;
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const paso = (x1 - x0) / datos.length;
  const ancho = Math.max(4, paso - 6);

  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, width: '100%', role: 'img', 'aria-label': titulo,
  });
  const g = el('g');
  svg.append(g);

  ejes(g, {
    x0, x1, y0, y1,
    ticks: calcularTicks(0, max, y0, y1, 3),
    formatoY: formato,
    etiquetasX: datos.map((d, i) => ({ x: x0 + paso * i + paso / 2, texto: d.etiqueta })),
  });

  datos.forEach((d, i) => {
    const alto = (d.valor / max) * (y1 - y0);
    const barra = el('rect', {
      x: x0 + paso * i + (paso - ancho) / 2,
      y: y1 - alto, width: ancho, height: Math.max(1, alto),
      rx: 4, ry: 4, fill: leerColor('--serie-1'), 'fill-opacity': 0.9,
    });
    barra.addEventListener('mousemove', (ev) => mostrarGlobo(ev, `
      <span class="t">${d.etiqueta}</span>
      <span class="f"><span>${d.nombre || 'Valor'}</span><span>${d.texto || formato(d.valor)}</span></span>`));
    barra.addEventListener('mouseleave', ocultarGlobo);
    g.append(barra);
  });

  return envolver(svg, null);
}

export { ocultarGlobo };
