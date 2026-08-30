/**
 * El dividendo de verdad.
 *
 * Los simuladores de banco muestran la cuota "pelada" (capital + interés). Lo
 * que te descuentan cada mes es bastante más: cuota + desgravamen + incendio y
 * sismo + comisiones. Y antes de eso, al firmar, pagas gastos operacionales que
 * nadie te menciona hasta el final. Este módulo calcula todo eso junto.
 */

import {
  tasaMensual, cuotaFrancesa, tablaAmortizacion, cae, redondear, cl,
} from './finanzas.js';

/**
 * Gastos que se pagan una sola vez, al firmar.
 *
 * El impuesto de timbres y estampillas se calcula sobre el monto del crédito,
 * así que si decides financiar los gastos dentro del crédito el cálculo es
 * circular. Se resuelve algebraicamente: C = (B + G) / (1 − t).
 *
 * @param {Object} p
 * @param {number} p.precioUF
 * @param {number} p.creditoBaseUF crédito antes de agregar gastos financiados
 * @param {Object} p.gastos tarifas en UF y fracciones
 * @param {boolean} [p.esDFL2]
 * @param {boolean} [p.esViviendaSocial]
 * @param {boolean} [p.financiarGastos] agregar los gastos al crédito
 */
export function calcularGastosOperacionales({
  precioUF,
  creditoBaseUF,
  gastos,
  esDFL2 = false,
  esViviendaSocial = false,
  financiarGastos = false,
}) {
  const tasaImpuesto = esViviendaSocial
    ? 0
    : esDFL2
      ? gastos.tasaImpuestoMutuoDFL2
      : gastos.tasaImpuestoMutuo;

  const conservadorUF = Math.min(
    precioUF * gastos.tasaConservador,
    gastos.topeConservadorUF,
  );

  // Todo lo que no depende del monto del crédito.
  const fijos = [
    { concepto: 'Tasación', uf: gastos.tasacionUF },
    { concepto: 'Estudio de títulos y redacción de escritura', uf: gastos.estudioTitulosUF },
    { concepto: 'Notaría (mutuo)', uf: gastos.notariaUF },
    { concepto: 'Notaría (compraventa)', uf: gastos.gastosNotarialesCompraventaUF },
    { concepto: 'Inscripción en el Conservador de Bienes Raíces', uf: conservadorUF },
  ];
  const totalFijosUF = fijos.reduce((a, g) => a + g.uf, 0);

  // Si financias los gastos, el crédito crece y con él el impuesto al mutuo.
  const montoCreditoUF = financiarGastos
    ? (creditoBaseUF + totalFijosUF) / (1 - tasaImpuesto)
    : creditoBaseUF;

  const impuestoMutuoUF = montoCreditoUF * tasaImpuesto;

  const detalle = [
    ...fijos,
    {
      concepto: `Impuesto de timbres y estampillas (${cl(tasaImpuesto * 100, 1)}%)`,
      uf: impuestoMutuoUF,
    },
  ];
  const totalUF = totalFijosUF + impuestoMutuoUF;

  // Los gastos operacionales suelen caer entre 1,3% y 1,5% del monto financiado.
  // Fuera de ahí, casi siempre es que algún supuesto quedó mal cargado.
  const porcentajeDelCredito = montoCreditoUF > 0 ? totalUF / montoCreditoUF : 0;
  let alerta = null;
  if (montoCreditoUF > 0 && (porcentajeDelCredito < 0.008 || porcentajeDelCredito > 0.025)) {
    alerta =
      `Los gastos operacionales dan ${cl(porcentajeDelCredito * 100, 2)}% del crédito, ` +
      'fuera del rango habitual de 1,3%–1,5%. Revisa las tarifas que cargaste.';
  }

  return {
    detalle,
    totalUF,
    impuestoMutuoUF,
    tasaImpuestoAplicada: tasaImpuesto,
    montoCreditoUF,
    porcentajeDelCredito,
    alerta,
    // Lo que pagas de tu bolsillo al firmar, sin contar el pie.
    desembolsoInicialUF: financiarGastos ? 0 : totalUF,
  };
}

/**
 * @typedef {Object} ResultadoCredito
 * @property {number} montoCreditoUF
 * @property {number} pieUF
 * @property {number} ltv
 * @property {number} cuotaUF cuota pelada, constante
 * @property {number} dividendoPrimerMesUF
 * @property {number} dividendoUltimoMesUF
 * @property {number} dividendoPromedioUF
 * @property {number} totalInteresUF
 * @property {number} totalSegurosUF
 * @property {number} totalDesembolsadoUF todo lo que sale de tu bolsillo, abonos incluidos
 * @property {number} costoTotalUF pie + gastos + todos los dividendos
 * @property {number|null} caeAnual
 * @property {Array} filas tabla mes a mes con el dividendo completo
 * @property {Object} gastosOperacionales
 */

/**
 * Calcula un crédito completo, de principio a fin.
 *
 * @param {Object} e entrada normalizada
 * @returns {ResultadoCredito}
 */
export function calcularCredito(e) {
  const precioUF = e.precioUF;
  const pieUF = e.pieUF != null ? e.pieUF : precioUF * e.piePorcentaje;
  const creditoBaseUF = Math.max(0, precioUF - pieUF);

  const gastosOperacionales = calcularGastosOperacionales({
    precioUF,
    creditoBaseUF,
    gastos: e.gastos,
    esDFL2: e.esDFL2,
    esViviendaSocial: e.esViviendaSocial,
    financiarGastos: e.financiarGastos,
  });

  const montoCreditoUF = gastosOperacionales.montoCreditoUF;
  const n = Math.round(e.plazoAnios * 12);
  const i = tasaMensual(e.tasaAnual, e.convencionTasa || 'nominal');

  const amort = tablaAmortizacion({
    capital: montoCreditoUF,
    i,
    n,
    abonoMensual: e.abonoMensualUF || 0,
    abonoAnual: e.abonoAnualUF || 0,
    mesAbonoAnual: e.mesAbonoAnual || 12,
    modoAbono: e.modoAbono || 'plazo',
  });

  // El desgravamen se cobra sobre el saldo insoluto, así que baja mes a mes.
  // El de incendio y sismo se cobra sobre el valor de tasación y es fijo.
  const valorTasacionUF = e.valorTasacionUF || precioUF;
  const incendioMensualUF = valorTasacionUF * e.tasaIncendioSismoMensual;
  const comisionUF = e.comisionAdminMensualUF || 0;

  let saldoAnterior = montoCreditoUF;
  let totalSegurosUF = 0;
  const filas = amort.filas.map((f) => {
    const desgravamenUF = saldoAnterior * e.tasaDesgravamenMensual;
    saldoAnterior = f.saldo;
    const segurosUF = desgravamenUF + incendioMensualUF + comisionUF;
    totalSegurosUF += segurosUF;
    return {
      ...f,
      desgravamenUF,
      incendioUF: incendioMensualUF,
      comisionUF,
      segurosUF,
      // El dividendo es lo que estás obligado a pagar: cuota + seguros.
      // El abono extraordinario es voluntario, así que va aparte. Mezclarlos
      // inflaría la carga financiera y la CAE de quien decide prepagar.
      dividendoUF: f.cuota + segurosUF,
      desembolsoUF: f.cuota + segurosUF + f.abonoExtra,
    };
  });

  const dividendos = filas.map((f) => f.dividendoUF);
  const desembolsos = filas.map((f) => f.desembolsoUF);
  const totalDesembolsadoUF = desembolsos.reduce((a, d) => a + d, 0);

  return {
    montoCreditoUF,
    pieUF,
    ltv: precioUF > 0 ? montoCreditoUF / precioUF : 0,
    plazoMeses: amort.meses,
    tasaMensualAplicada: i,
    cuotaUF: cuotaFrancesa(montoCreditoUF, i, n),
    dividendoPrimerMesUF: dividendos[0] || 0,
    dividendoUltimoMesUF: dividendos[dividendos.length - 1] || 0,
    dividendoPromedioUF: dividendos.length ? dividendos.reduce((a, d) => a + d, 0) / dividendos.length : 0,
    incendioMensualUF,
    totalInteresUF: amort.totalInteres,
    totalSegurosUF,
    totalDesembolsadoUF,
    costoTotalUF: pieUF + gastosOperacionales.desembolsoInicialUF + totalDesembolsadoUF,
    // La CAE se calcula sobre el desembolso real, abonos incluidos: es el flujo
    // de caja que efectivamente ocurre.
    caeAnual: cae(montoCreditoUF, gastosOperacionales.totalUF, desembolsos),
    filas,
    gastosOperacionales,
  };
}

/**
 * Cuánto capital soportas con un dividendo tope, considerando que los seguros
 * se comen parte de ese tope.
 *
 * Es la pregunta inversa: no "cuánto pago por esta casa" sino "qué casa alcanzo
 * con lo que puedo pagar". Se resuelve iterando porque el seguro de incendio
 * depende del precio, que a su vez depende del crédito.
 *
 * @param {Object} p
 * @param {number} p.dividendoMaximoUF
 * @param {number} p.tasaAnual
 * @param {number} p.plazoAnios
 * @param {number} p.piePorcentaje
 * @param {number} p.tasaDesgravamenMensual
 * @param {number} p.tasaIncendioSismoMensual
 * @param {number} [p.comisionAdminMensualUF]
 * @param {'nominal'|'efectiva'} [p.convencionTasa]
 */
export function capacidadDeCompra({
  dividendoMaximoUF,
  tasaAnual,
  plazoAnios,
  piePorcentaje,
  tasaDesgravamenMensual,
  tasaIncendioSismoMensual,
  comisionAdminMensualUF = 0,
  convencionTasa = 'nominal',
}) {
  const i = tasaMensual(tasaAnual, convencionTasa);
  const n = Math.round(plazoAnios * 12);
  const factor = i === 0 ? 1 / n : i / (1 - Math.pow(1 + i, -n));
  const ltv = 1 - piePorcentaje;

  // Punto fijo: el dividendo del primer mes es
  //   C·factor + C·desgravamen + precio·incendio + comisión
  // y precio = C / ltv. Converge en pocas vueltas.
  let credito = 0;
  for (let k = 0; k < 100; k++) {
    const precio = ltv > 0 ? credito / ltv : 0;
    const disponible = dividendoMaximoUF - precio * tasaIncendioSismoMensual - comisionAdminMensualUF;
    const nuevo = disponible <= 0 ? 0 : disponible / (factor + tasaDesgravamenMensual);
    if (Math.abs(nuevo - credito) < 1e-9) { credito = nuevo; break; }
    credito = nuevo;
  }

  const creditoUF = Math.max(0, credito);
  const precioUF = ltv > 0 ? creditoUF / ltv : 0;
  return {
    creditoMaximoUF: creditoUF,
    precioMaximoUF: precioUF,
    pieNecesarioUF: precioUF * piePorcentaje,
  };
}

export { redondear };
