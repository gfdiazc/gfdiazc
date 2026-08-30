/**
 * Comparar alternativas: sensibilidad, prepagos, refinanciamiento y varias
 * propiedades u ofertas de banco lado a lado.
 *
 * Un solo número nunca alcanza para decidir. Lo que importa es cuánto se mueve
 * ese número cuando cambian los supuestos que no controlas.
 */

import { calcularCredito, calcularGastosOperacionales } from './credito.js';
import { tasaMensual, cuotaFrancesa, tablaAmortizacion, cl } from './finanzas.js';

/**
 * Análisis de sensibilidad tipo tornado.
 *
 * Para cada variable se recalcula el escenario en su valor bajo y en su valor
 * alto, dejando el resto igual. El resultado se ordena por impacto, así queda a
 * la vista qué supuesto realmente mueve la aguja y cuál es ruido.
 *
 * @param {Object} entradaBase entrada de calcularCredito
 * @param {Array} variables [{clave, etiqueta, bajo, alto, formato}]
 * @param {Function} metrica (resultadoCredito) => number
 */
export function analizarSensibilidad(entradaBase, variables, metrica) {
  const base = metrica(calcularCredito(entradaBase));

  const filas = variables.map((v) => {
    const evaluar = (valor) => {
      try {
        return metrica(calcularCredito({ ...entradaBase, [v.clave]: valor }));
      } catch {
        return null;
      }
    };
    const enBajo = evaluar(v.bajo);
    const enAlto = evaluar(v.alto);
    const deltas = [enBajo, enAlto].filter((x) => x !== null).map((x) => x - base);
    const impacto = deltas.length ? Math.max(...deltas.map(Math.abs)) : 0;

    return {
      clave: v.clave,
      etiqueta: v.etiqueta,
      formato: v.formato || 'numero',
      valorBajo: v.bajo,
      valorAlto: v.alto,
      enBajo,
      enAlto,
      deltaBajo: enBajo === null ? null : enBajo - base,
      deltaAlto: enAlto === null ? null : enAlto - base,
      impacto,
    };
  });

  filas.sort((a, b) => b.impacto - a.impacto);
  return { base, filas };
}

/** Variables por defecto del tornado, alrededor de una entrada dada. */
export function variablesSensibilidadPorDefecto(e) {
  return [
    { clave: 'tasaAnual', etiqueta: 'Tasa de interés', bajo: Math.max(0.005, e.tasaAnual - 0.015), alto: e.tasaAnual + 0.015, formato: 'porcentaje' },
    { clave: 'plazoAnios', etiqueta: 'Plazo', bajo: 15, alto: 30, formato: 'anios' },
    { clave: 'piePorcentaje', etiqueta: 'Pie', bajo: 0.10, alto: 0.30, formato: 'porcentaje' },
    { clave: 'precioUF', etiqueta: 'Precio de la vivienda', bajo: e.precioUF * 0.9, alto: e.precioUF * 1.1, formato: 'uf' },
    { clave: 'tasaDesgravamenMensual', etiqueta: 'Seguro de desgravamen', bajo: 0.0002, alto: 0.00035, formato: 'porcentaje' },
    { clave: 'tasaIncendioSismoMensual', etiqueta: 'Seguro de incendio y sismo', bajo: 0.00015, alto: 0.0003, formato: 'porcentaje' },
  ];
}

/**
 * Simula abonos extraordinarios a capital.
 *
 * Dos modos:
 *   - 'plazo': la cuota queda igual y el crédito termina antes. Ahorra mucho
 *     más interés.
 *   - 'cuota': el plazo queda igual y baja el dividendo. Da aire mensual.
 *
 * Para un ingreso variable como el de un freelance, los meses buenos son la
 * munición: un abono anual bien puesto acorta años.
 */
export function simularPrepago(entrada, { abonoMensualUF = 0, abonoAnualUF = 0, mesAbonoAnual = 12, modo = 'plazo' }) {
  const sin = calcularCredito(entrada);
  const con = calcularCredito({
    ...entrada,
    abonoMensualUF,
    abonoAnualUF,
    mesAbonoAnual,
    modoAbono: modo,
  });

  const mesesAhorrados = sin.plazoMeses - con.plazoMeses;
  const totalAbonadoUF = con.filas.reduce((a, f) => a + f.abonoExtra, 0);

  return {
    sin,
    con,
    modo,
    mesesAhorrados,
    aniosAhorrados: mesesAhorrados / 12,
    interesAhorradoUF: sin.totalInteresUF - con.totalInteresUF,
    totalAbonadoUF,
    // Por cada UF que abonas, cuántas UF de interés te ahorras.
    retornoPorUFAbonada: totalAbonadoUF > 0
      ? (sin.totalInteresUF - con.totalInteresUF) / totalAbonadoUF
      : 0,
    bajaDividendoUF: sin.dividendoPrimerMesUF - con.dividendoPrimerMesUF,
  };
}

/**
 * ¿Conviene refinanciar?
 *
 * Refinanciar no es gratis: pagas de nuevo tasación, estudio de títulos,
 * notaría, conservador y sobre todo el impuesto al mutuo sobre el saldo. La
 * pregunta correcta no es "¿la tasa nueva es más baja?" sino "¿en cuántos meses
 * recupero lo que me cuesta cambiarme?".
 *
 * @param {Object} p
 * @param {Object} p.creditoActual resultado de calcularCredito
 * @param {number} p.mesesPagados cuántos meses llevas pagando
 * @param {number} p.nuevaTasaAnual
 * @param {number} [p.nuevoPlazoAnios] por defecto, el plazo que te queda
 * @param {Object} p.gastos tarifas para el nuevo crédito
 * @param {number} p.precioUF
 */
export function evaluarRefinanciamiento({
  creditoActual,
  mesesPagados,
  nuevaTasaAnual,
  nuevoPlazoAnios = null,
  gastos,
  precioUF,
  esDFL2 = false,
  convencionTasa = 'nominal',
  tasaDesgravamenMensual,
  tasaIncendioSismoMensual,
}) {
  const idx = Math.max(0, Math.min(mesesPagados - 1, creditoActual.filas.length - 1));
  const saldoUF = creditoActual.filas[idx].saldo;
  const mesesRestantes = creditoActual.plazoMeses - mesesPagados;

  if (saldoUF <= 0 || mesesRestantes <= 0) {
    return { viable: false, motivo: 'El crédito ya está pagado.' };
  }

  const nMeses = nuevoPlazoAnios ? Math.round(nuevoPlazoAnios * 12) : mesesRestantes;

  const gastosNuevo = calcularGastosOperacionales({
    precioUF,
    creditoBaseUF: saldoUF,
    gastos,
    esDFL2,
    financiarGastos: false,
  });
  // Al refinanciar no vuelves a pagar la compraventa, solo el mutuo nuevo.
  const costoRefinanciarUF =
    gastosNuevo.totalUF - gastos.gastosNotarialesCompraventaUF;

  const iNueva = tasaMensual(nuevaTasaAnual, convencionTasa);
  const cuotaNueva = cuotaFrancesa(saldoUF, iNueva, nMeses);
  const desgravamenNuevo = saldoUF * tasaDesgravamenMensual;
  const incendio = creditoActual.incendioMensualUF;
  const dividendoNuevoUF = cuotaNueva + desgravamenNuevo + incendio;

  const dividendoActualUF = creditoActual.filas[idx].dividendoUF;
  const ahorroMensualUF = dividendoActualUF - dividendoNuevoUF;

  const nuevaTabla = tablaAmortizacion({ capital: saldoUF, i: iNueva, n: nMeses });
  const interesRestanteActualUF = creditoActual.filas
    .slice(mesesPagados)
    .reduce((a, f) => a + f.interes, 0);

  const mesesParaRecuperar = ahorroMensualUF > 0
    ? costoRefinanciarUF / ahorroMensualUF
    : null;

  return {
    viable: true,
    saldoUF,
    mesesRestantes,
    nuevoPlazoMeses: nMeses,
    costoRefinanciarUF,
    detalleCosto: gastosNuevo.detalle,
    dividendoActualUF,
    dividendoNuevoUF,
    ahorroMensualUF,
    interesRestanteActualUF,
    interesNuevoUF: nuevaTabla.totalInteres,
    ahorroInteresTotalUF: interesRestanteActualUF - nuevaTabla.totalInteres,
    mesesParaRecuperar,
    conviene: ahorroMensualUF > 0 && mesesParaRecuperar !== null && mesesParaRecuperar < mesesRestantes,
    lectura: ahorroMensualUF <= 0
      ? 'Con esa tasa el dividendo no baja: refinanciar no tiene sentido.'
      : `Recuperas el costo de refinanciar en ${Math.ceil(mesesParaRecuperar)} meses (${cl(mesesParaRecuperar / 12, 1)} años). Te quedan ${mesesRestantes} meses de crédito.`,
  };
}

/**
 * Compara varios escenarios y marca cuál gana en cada métrica.
 *
 * @param {Array} escenarios [{id, nombre, resultado, metricas}]
 * @param {Array} definiciones [{clave, etiqueta, mejor: 'menor'|'mayor', formato}]
 */
export function compararEscenarios(escenarios, definiciones) {
  const filas = definiciones.map((d) => {
    const valores = escenarios.map((e) => {
      const v = d.obtener(e);
      return { id: e.id, valor: v };
    });
    const validos = valores.filter((v) => typeof v.valor === 'number' && Number.isFinite(v.valor));
    let ganadorId = null;
    if (validos.length > 0) {
      const mejor = d.mejor === 'mayor'
        ? validos.reduce((a, b) => (b.valor > a.valor ? b : a))
        : validos.reduce((a, b) => (b.valor < a.valor ? b : a));
      ganadorId = mejor.id;
    }
    return { clave: d.clave, etiqueta: d.etiqueta, formato: d.formato, mejor: d.mejor, valores, ganadorId };
  });

  // Cuántas métricas gana cada escenario.
  const puntajes = {};
  for (const e of escenarios) puntajes[e.id] = 0;
  for (const f of filas) if (f.ganadorId) puntajes[f.ganadorId] += 1;

  const ranking = Object.entries(puntajes)
    .map(([id, puntos]) => ({ id, puntos, nombre: escenarios.find((e) => e.id === id)?.nombre }))
    .sort((a, b) => b.puntos - a.puntos);

  return { filas, puntajes, ranking };
}
