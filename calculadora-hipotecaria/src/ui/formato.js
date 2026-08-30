/** Formato chileno: puntos de miles, coma decimal, UF con dos decimales. */

const nfCLP = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const nfUF = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfUF0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export function clp(x) {
  if (x == null || !Number.isFinite(x)) return '—';
  return '$' + nfCLP.format(Math.round(x));
}

export function uf(x, decimales = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return (decimales === 0 ? nfUF0 : nfUF).format(x) + ' UF';
}

export function ufCorto(x, decimales = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return (decimales === 0 ? nfUF0 : nfUF).format(x);
}

export function pct(x, decimales = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return (x * 100).toLocaleString('es-CL', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }) + '%';
}

export function numero(x, decimales = 1) {
  if (x == null || !Number.isFinite(x)) return '—';
  return x.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function anios(meses) {
  if (meses == null || !Number.isFinite(meses)) return '—';
  const a = Math.floor(meses / 12);
  const m = Math.round(meses % 12);
  if (a === 0) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  if (m === 0) return `${a} ${a === 1 ? 'año' : 'años'}`;
  return `${a} ${a === 1 ? 'año' : 'años'} y ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

/** Convierte lo que el usuario escribe en un número, tolerando formato chileno. */
export function aNumero(texto) {
  if (typeof texto === 'number') return texto;
  if (!texto) return 0;
  const limpio = String(texto)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

/** Escapa texto para insertarlo en HTML sin riesgo. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const HOY = new Date().toISOString().slice(0, 10);
