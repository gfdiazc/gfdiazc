/**
 * La propiedad como inversión: arriendo, rentabilidad y la comparación contra
 * simplemente arrendar e invertir la plata en otra cosa.
 *
 * Todo en UF, o sea en términos reales. Las tasas de plusvalía y de rendimiento
 * alternativo que entran aquí son reales (por sobre la inflación), no nominales.
 */

import { tir, van } from './finanzas.js';
import { impuestoGananciaCapital } from './impuestos.js';

/**
 * Métricas de rentabilidad del primer año.
 *
 * @param {Object} p
 * @param {number} p.precioUF
 * @param {number} p.gastosCompraUF gastos operacionales de la compra
 * @param {number} [p.habilitacionUF] remodelación, muebles, lo que haga falta
 * @param {number} p.pieUF
 * @param {number} p.arriendoMensualUF
 * @param {number} [p.vacanciaAnual] fracción del año sin arrendar (0,083 = 1 mes)
 * @param {number} [p.gastosComunesMensualesUF] los paga el dueño solo si está vacío
 * @param {number} [p.contribucionesAnualesUF]
 * @param {number} [p.tasaAdministracion] fracción del arriendo que se lleva el corredor
 * @param {number} [p.tasaMantencion] provisión para reparaciones, fracción del arriendo
 * @param {number} [p.seguroAnualUF]
 * @param {number} p.servicioDeudaAnualUF suma de dividendos del año
 * @param {number} [p.impuestoArriendoAnualUF] 0 si es DFL2 y eres persona natural
 */
export function metricasInversion({
  precioUF,
  gastosCompraUF = 0,
  habilitacionUF = 0,
  pieUF,
  arriendoMensualUF,
  vacanciaAnual = 1 / 12,
  gastosComunesMensualesUF = 0,
  contribucionesAnualesUF = 0,
  tasaAdministracion = 0,
  tasaMantencion = 0.05,
  seguroAnualUF = 0,
  servicioDeudaAnualUF,
  impuestoArriendoAnualUF = 0,
}) {
  const capitalInvertidoUF = pieUF + gastosCompraUF + habilitacionUF;
  const precioTotalUF = precioUF + gastosCompraUF + habilitacionUF;

  const arriendoBrutoAnualUF = arriendoMensualUF * 12;
  const ingresoEfectivoAnualUF = arriendoBrutoAnualUF * (1 - vacanciaAnual);

  // Los gastos comunes normalmente los paga el arrendatario; el dueño solo los
  // cubre los meses en que la propiedad está vacía.
  const gastosComunesVacanciaUF = gastosComunesMensualesUF * 12 * vacanciaAnual;
  const administracionUF = ingresoEfectivoAnualUF * tasaAdministracion;
  const mantencionUF = arriendoBrutoAnualUF * tasaMantencion;

  const gastosOperativosAnualUF =
    gastosComunesVacanciaUF + administracionUF + mantencionUF + contribucionesAnualesUF + seguroAnualUF;

  const noiUF = ingresoEfectivoAnualUF - gastosOperativosAnualUF;
  const flujoAntesDeImpuestoUF = noiUF - servicioDeudaAnualUF;
  const flujoNetoUF = flujoAntesDeImpuestoUF - impuestoArriendoAnualUF;

  return {
    capitalInvertidoUF,
    precioTotalUF,
    arriendoBrutoAnualUF,
    ingresoEfectivoAnualUF,
    gastosOperativosAnualUF,
    desgloseGastos: {
      gastosComunesVacanciaUF,
      administracionUF,
      mantencionUF,
      contribucionesAnualesUF,
      seguroAnualUF,
    },
    noiUF,
    servicioDeudaAnualUF,
    flujoAntesDeImpuestoUF,
    flujoNetoUF,
    flujoMensualUF: flujoNetoUF / 12,
    capRateBruto: precioTotalUF > 0 ? arriendoBrutoAnualUF / precioTotalUF : 0,
    capRateNeto: precioTotalUF > 0 ? noiUF / precioTotalUF : 0,
    cashOnCash: capitalInvertidoUF > 0 ? flujoNetoUF / capitalInvertidoUF : 0,
    // Cuántas veces el arriendo anual cabe en el precio: el "multiplicador" que
    // usan los corredores. Bajo 200 meses suele considerarse atractivo.
    mesesDeArriendoParaPagarla: arriendoMensualUF > 0 ? precioTotalUF / arriendoMensualUF : Infinity,
  };
}

/**
 * Proyección año a año con venta al final, para sacar TIR y VAN.
 *
 * @param {Object} p
 * @param {Array} p.filas tabla de amortización con dividendoUF y saldo
 * @param {number} p.aniosProyeccion
 * @param {number} p.plusvaliaAnualReal
 * @param {number} [p.crecimientoArriendoAnualReal]
 * @param {number} [p.tasaComisionVenta]
 * @param {number} [p.tasaDescuento] para el VAN
 * @param {Function} p.metricasDelAnio (anio, servicioDeudaAnualUF) => metricasInversion
 */
export function proyectarInversion({
  filas,
  precioUF,
  capitalInvertidoUF,
  aniosProyeccion = 10,
  plusvaliaAnualReal = 0.02,
  crecimientoArriendoAnualReal = 0.01,
  tasaComisionVenta = 0.02,
  tasaDescuento = 0.05,
  exencionGananciaUsadaUF = 0,
  metricasDelAnio,
}) {
  const flujos = [-capitalInvertidoUF];
  const detalle = [];

  for (let anio = 1; anio <= aniosProyeccion; anio++) {
    const tramo = filas.slice((anio - 1) * 12, anio * 12);
    const servicioDeudaAnualUF = tramo.reduce((a, f) => a + (f.dividendoUF ?? f.cuota), 0);
    const factorArriendo = Math.pow(1 + crecimientoArriendoAnualReal, anio - 1);
    const m = metricasDelAnio(anio, servicioDeudaAnualUF, factorArriendo);

    let flujo = m.flujoNetoUF;
    const ultimoAnio = anio === aniosProyeccion;
    let venta = null;

    if (ultimoAnio) {
      const saldoInsolutoUF = tramo.length ? tramo[tramo.length - 1].saldo : 0;
      const precioVentaUF = precioUF * Math.pow(1 + plusvaliaAnualReal, anio);
      const comisionUF = precioVentaUF * tasaComisionVenta;
      const gananciaUF = precioVentaUF - precioUF;
      const impuesto = impuestoGananciaCapital({
        gananciaUF,
        exencionYaUsadaUF: exencionGananciaUsadaUF,
      });
      const netoVentaUF = precioVentaUF - comisionUF - saldoInsolutoUF - impuesto.impuestoUF;
      venta = {
        precioVentaUF, comisionUF, saldoInsolutoUF, gananciaUF,
        impuestoUF: impuesto.impuestoUF, netoVentaUF,
      };
      flujo += netoVentaUF;
    }

    flujos.push(flujo);
    detalle.push({
      anio,
      servicioDeudaAnualUF,
      noiUF: m.noiUF,
      flujoOperacionalUF: m.flujoNetoUF,
      flujoTotalUF: flujo,
      venta,
    });
  }

  const tirAnual = tir(flujos);
  return {
    flujos,
    detalle,
    tirAnual,
    vanUF: van(flujos, tasaDescuento),
    tasaDescuento,
    multiploSobreCapital: capitalInvertidoUF > 0
      ? flujos.slice(1).reduce((a, f) => a + f, 0) / capitalInvertidoUF
      : 0,
  };
}

/**
 * Los dos umbrales que definen si el negocio se sostiene.
 */
export function puntosDeEquilibrio({ metricas, servicioDeudaAnualUF, vacanciaAnual, tasaAdministracion, tasaMantencion }) {
  // Arriendo mensual que deja el flujo en cero. El arriendo entra en el NOI
  // afectado por vacancia, administración y mantención, así que hay que
  // despejarlo del factor completo.
  const factor = (1 - vacanciaAnual) * (1 - tasaAdministracion) - tasaMantencion;
  const gastosFijos =
    metricas.desgloseGastos.contribucionesAnualesUF +
    metricas.desgloseGastos.seguroAnualUF +
    metricas.desgloseGastos.gastosComunesVacanciaUF;
  const arriendoAnualEquilibrio = factor > 0
    ? (servicioDeudaAnualUF + gastosFijos) / factor
    : Infinity;

  return {
    arriendoMensualEquilibrioUF: arriendoAnualEquilibrio / 12,
    holguraUF: metricas.arriendoBrutoAnualUF / 12 - arriendoAnualEquilibrio / 12,
    vacanciaMaximaTolerable: metricas.arriendoBrutoAnualUF > 0
      ? Math.max(0, 1 - (servicioDeudaAnualUF + gastosFijos) /
          (metricas.arriendoBrutoAnualUF * (1 - tasaAdministracion) - metricas.arriendoBrutoAnualUF * tasaMantencion))
      : 0,
  };
}

/**
 * Plusvalía real anual mínima para que la inversión rinda una TIR objetivo.
 * Se resuelve por bisección sobre la proyección completa.
 */
export function plusvaliaMinimaParaTIR({ tirObjetivo, proyectar, min = -0.05, max = 0.15 }) {
  const f = (g) => {
    const r = proyectar(g);
    return r.tirAnual === null ? -1 : r.tirAnual - tirObjetivo;
  };
  let lo = min, hi = max;
  if (f(lo) > 0) return min;
  if (f(hi) < 0) return null;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Comprar vs. arrendar.
 *
 * La comparación honesta no es "dividendo contra arriendo": es patrimonio
 * contra patrimonio. Si arriendas, el pie y los gastos de compra se quedan
 * invertidos, y la diferencia mensual entre el costo de ser propietario y el
 * arriendo también se invierte (o se consume, si el arriendo es más caro).
 *
 * Todo en UF, así que las tasas son reales.
 *
 * @param {Object} p
 * @param {Array} p.filas tabla de amortización con dividendoUF y saldo
 * @param {number} p.precioUF
 * @param {number} p.capitalInicialUF pie + gastos de compra
 * @param {number} p.arriendoEquivalenteMensualUF lo que pagarías por arrendar algo igual
 * @param {number} [p.costosPropietarioMensualesUF] contribuciones, gastos comunes, mantención
 * @param {number} [p.plusvaliaAnualReal]
 * @param {number} [p.rendimientoAlternativoAnualReal] lo que rinde tu plata invertida
 * @param {number} [p.crecimientoArriendoAnualReal]
 * @param {number} [p.aniosProyeccion]
 * @param {number} [p.tasaComisionVenta]
 */
export function compararComprarVsArrendar({
  filas,
  precioUF,
  capitalInicialUF,
  arriendoEquivalenteMensualUF,
  costosPropietarioMensualesUF = 0,
  plusvaliaAnualReal = 0.02,
  rendimientoAlternativoAnualReal = 0.03,
  crecimientoArriendoAnualReal = 0.01,
  aniosProyeccion = 20,
  tasaComisionVenta = 0.02,
}) {
  const gPrecio = Math.pow(1 + plusvaliaAnualReal, 1 / 12) - 1;
  const rAlt = Math.pow(1 + rendimientoAlternativoAnualReal, 1 / 12) - 1;
  const gArriendo = Math.pow(1 + crecimientoArriendoAnualReal, 1 / 12) - 1;

  let valorPropiedad = precioUF;
  let portafolio = capitalInicialUF; // si arriendas, esta plata queda invertida
  let arriendo = arriendoEquivalenteMensualUF;

  const serie = [];
  let cruce = null;
  const meses = Math.min(aniosProyeccion * 12, filas.length);

  for (let mes = 1; mes <= meses; mes++) {
    const fila = filas[mes - 1];
    const dividendo = fila.dividendoUF ?? fila.cuota;
    const costoPropietario = dividendo + costosPropietarioMensualesUF;

    // El que arrienda invierte lo que se ahorra respecto de ser propietario.
    // Si arrendar sale más caro, la diferencia sale del portafolio.
    portafolio = portafolio * (1 + rAlt) + (costoPropietario - arriendo);
    valorPropiedad = valorPropiedad * (1 + gPrecio);
    arriendo = arriendo * (1 + gArriendo);

    const patrimonioComprar = valorPropiedad * (1 - tasaComisionVenta) - fila.saldo;
    const patrimonioArrendar = portafolio;

    if (cruce === null && patrimonioComprar > patrimonioArrendar) cruce = mes / 12;

    if (mes % 12 === 0) {
      serie.push({
        anio: mes / 12,
        patrimonioComprarUF: patrimonioComprar,
        patrimonioArrendarUF: patrimonioArrendar,
        diferenciaUF: patrimonioComprar - patrimonioArrendar,
        valorPropiedadUF: valorPropiedad,
        saldoDeudaUF: fila.saldo,
        arriendoMensualUF: arriendo,
      });
    }
  }

  const ultimo = serie[serie.length - 1] || null;
  return {
    serie,
    anioDeCruce: cruce,
    ganadorAlFinal: ultimo
      ? (ultimo.patrimonioComprarUF > ultimo.patrimonioArrendarUF ? 'comprar' : 'arrendar')
      : null,
    diferenciaFinalUF: ultimo ? ultimo.diferenciaUF : 0,
    supuestos: {
      plusvaliaAnualReal,
      rendimientoAlternativoAnualReal,
      crecimientoArriendoAnualReal,
      tasaComisionVenta,
    },
  };
}
