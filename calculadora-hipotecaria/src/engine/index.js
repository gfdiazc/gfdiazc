/**
 * Superficie pública del motor.
 *
 * La interfaz llama a `evaluarOperacion(entrada)` una sola vez y recibe todo
 * calculado. Nada de cálculo financiero vive en la capa de UI.
 */

export * from './parametros.js';
export * from './finanzas.js';
export * from './credito.js';
export * from './programas.js';
export * from './ingresos.js';
export * from './impuestos.js';
export * from './inversion.js';
export * from './escenarios.js';
export * from './veredicto.js';

import { SUPUESTOS, PROGRAMAS, EVALUACION_BANCARIA } from './parametros.js';
import { calcularCredito, capacidadDeCompra } from './credito.js';
import { cl } from './finanzas.js';
import { evaluarProgramas, compararFogaes, compararSubsidioDividendo } from './programas.js';
import {
  analizarBoletas, rentaAcreditable, capacidadDePago, cargaFinanciera,
  colchonRecomendado, proyectarRetencion, liquidoHonorarios,
} from './ingresos.js';
import {
  rentaImponibleHonorarios, beneficio55bisPorAnio, evaluarDFL2, contribuciones,
} from './impuestos.js';
import {
  metricasInversion, proyectarInversion, puntosDeEquilibrio, compararComprarVsArrendar,
} from './inversion.js';
import { analizarSensibilidad, variablesSensibilidadPorDefecto, simularPrepago } from './escenarios.js';
import { construirVeredicto } from './veredicto.js';

/** Entrada por defecto, lista para usar. */
export function entradaPorDefecto() {
  return {
    propiedad: {
      nombre: 'Departamento 1',
      precioUF: 3200,
      superficieUtilM2: 60,
      esNueva: true,
      esDFL2: true,
      esViviendaSocial: false,
      valorTasacionUF: null,
      avaluoFiscalCLP: 45000000,
      gastosComunesMensualesUF: 1.5,
      habilitacionUF: 0,
      viviendasDFL2QueYaTiene: 0,
    },
    credito: {
      piePorcentaje: 0.20,
      tasaAnual: SUPUESTOS.tasaAnual.valor,
      plazoAnios: 25,
      convencionTasa: 'nominal',
      tasaDesgravamenMensual: SUPUESTOS.tasaDesgravamenMensual.valor,
      tasaIncendioSismoMensual: SUPUESTOS.tasaIncendioSismoMensual.valor,
      comisionAdminMensualUF: 0,
      financiarGastos: false,
      abonoMensualUF: 0,
      abonoAnualUF: 0,
      mesAbonoAnual: 12,
      modoAbono: 'plazo',
    },
    gastos: {
      tasacionUF: SUPUESTOS.tasacionUF.valor,
      estudioTitulosUF: SUPUESTOS.estudioTitulosUF.valor,
      notariaUF: SUPUESTOS.notariaUF.valor,
      gastosNotarialesCompraventaUF: SUPUESTOS.gastosNotarialesCompraventaUF.valor,
      tasaConservador: SUPUESTOS.tasaConservador.valor,
      topeConservadorUF: SUPUESTOS.topeConservadorUF.valor,
      tasaImpuestoMutuo: SUPUESTOS.tasaImpuestoMutuo.valor,
      tasaImpuestoMutuoDFL2: SUPUESTOS.tasaImpuestoMutuoDFL2.valor,
    },
    perfil: {
      modalidad: 'honorarios',
      sueldoLiquidoMensual: 0,
      promedioBoletasMensual: 2200000,
      boletas: [],
      rentaLiquidaF22Anual: 0,
      factorCastigo: EVALUACION_BANCARIA.factorCastigoHonorarios,
      otrasDeudasMensuales: 0,
      ahorroLiquidoCLP: 6000000,
      cargaMaxima: EVALUACION_BANCARIA.cargaFinancieraMaxima,
      cumplidos: [],
    },
    programas: {
      esPrimeraVivienda: true,
      recibioSubsidioPrevio: false,
      enRegistroDeudoresPensiones: false,
      yaUsoFogaes: false,
      fechaPromesa: '',
      quiereUsarFogaes: true,
      quiereUsarSubsidio: true,
    },
    arriendo: {
      activo: true,
      arriendoMensualUF: 13,
      vacanciaAnual: 1 / 12,
      tasaAdministracion: 0.07,
      tasaMantencion: 0.05,
      seguroAnualUF: 0,
      arriendoEquivalenteMensualUF: 13,
    },
    mercado: {
      valorUF: SUPUESTOS.valorUF.valor,
      valorUTM: SUPUESTOS.valorUTM.valor,
      plusvaliaAnualReal: 0.02,
      crecimientoArriendoAnualReal: 0.01,
      rendimientoAlternativoAnualReal: 0.04,
      tasaComisionVenta: 0.02,
      tasaContribucionesAnual: 0.01,
      aniosProyeccion: 10,
      ahorroMensualUF: 8,
      ahorroActualUF: 200,
    },
  };
}

/**
 * Calcula absolutamente todo a partir de una entrada.
 * @param {ReturnType<entradaPorDefecto>} e
 */
export function evaluarOperacion(e) {
  const { propiedad: pr, credito: cr, gastos, perfil, arriendo, mercado } = e;
  const avisos = [];

  // --- Programas: definen el pie mínimo y la tasa efectiva --------------
  const prog = evaluarProgramas({
    precioUF: pr.precioUF,
    tasaAnual: cr.tasaAnual,
    esViviendaNueva: pr.esNueva,
    ...e.programas,
  });

  const pieMinimo = 1 - prog.ltvMaximo;
  if (cr.piePorcentaje < pieMinimo - 1e-9) {
    avisos.push({
      nivel: 'error',
      texto: prog.fogaes.elegible
        ? `Con un pie de ${cl(cr.piePorcentaje * 100, 0)}% ningún banco te financia: el mínimo con FOGAES es ${cl(pieMinimo * 100, 0)}%.`
        : `Un pie de ${cl(cr.piePorcentaje * 100, 0)}% requiere FOGAES, y con este perfil no calificas. El mínimo sin FOGAES es 20%.`,
    });
  }

  const dfl2 = evaluarDFL2({
    superficieUtilM2: pr.superficieUtilM2,
    viviendasDFL2QueYaTiene: pr.viviendasDFL2QueYaTiene || 0,
  });
  const esDFL2 = pr.esDFL2 && dfl2.califica;
  if (pr.esDFL2 && !dfl2.califica) {
    avisos.push({ nivel: 'aviso', texto: `Marcaste DFL2 pero no califica: ${dfl2.motivos.join(' ')}` });
  }

  // --- Crédito -----------------------------------------------------------
  const entradaCredito = {
    precioUF: pr.precioUF,
    piePorcentaje: cr.piePorcentaje,
    pieUF: null,
    tasaAnual: prog.tasaEfectiva,
    plazoAnios: cr.plazoAnios,
    convencionTasa: cr.convencionTasa,
    tasaDesgravamenMensual: cr.tasaDesgravamenMensual,
    tasaIncendioSismoMensual: cr.tasaIncendioSismoMensual,
    comisionAdminMensualUF: cr.comisionAdminMensualUF,
    valorTasacionUF: pr.valorTasacionUF || pr.precioUF,
    esDFL2,
    esViviendaSocial: pr.esViviendaSocial,
    financiarGastos: cr.financiarGastos,
    abonoMensualUF: cr.abonoMensualUF,
    abonoAnualUF: cr.abonoAnualUF,
    mesAbonoAnual: cr.mesAbonoAnual,
    modoAbono: cr.modoAbono,
    gastos,
  };
  const credito = calcularCredito(entradaCredito);
  if (credito.gastosOperacionales.alerta) {
    avisos.push({ nivel: 'aviso', texto: credito.gastosOperacionales.alerta });
  }

  // --- Ingresos y capacidad de pago --------------------------------------
  const estadisticaBoletas = analizarBoletas(perfil.boletas);
  const promedioBoletas = estadisticaBoletas
    ? estadisticaBoletas.promedio
    : perfil.promedioBoletasMensual;

  const renta = rentaAcreditable({
    modalidad: perfil.modalidad,
    sueldoLiquidoMensual: perfil.sueldoLiquidoMensual,
    promedioBoletasMensual: promedioBoletas,
    rentaLiquidaF22Anual: perfil.rentaLiquidaF22Anual,
    factorCastigo: perfil.factorCastigo,
  });

  const capacidad = capacidadDePago({
    rentaAcreditableMensual: renta.total,
    otrasDeudasMensuales: perfil.otrasDeudasMensuales,
    cargaMaxima: perfil.cargaMaxima,
  });

  const dividendoCLP = credito.dividendoPrimerMesUF * mercado.valorUF;
  const carga = cargaFinanciera({
    dividendoMensual: dividendoCLP,
    otrasDeudasMensuales: perfil.otrasDeudasMensuales,
    rentaAcreditableMensual: renta.total,
  });

  const alcance = capacidadDeCompra({
    dividendoMaximoUF: capacidad.dividendoMaximo / mercado.valorUF,
    tasaAnual: prog.tasaEfectiva,
    plazoAnios: cr.plazoAnios,
    piePorcentaje: cr.piePorcentaje,
    tasaDesgravamenMensual: cr.tasaDesgravamenMensual,
    tasaIncendioSismoMensual: cr.tasaIncendioSismoMensual,
    comisionAdminMensualUF: cr.comisionAdminMensualUF,
    convencionTasa: cr.convencionTasa,
  });

  const esIndependiente = perfil.modalidad === 'honorarios' || perfil.modalidad === 'mixto';
  const retencion = esIndependiente
    ? proyectarRetencion({ brutoMensual: promedioBoletas, desdeAnio: 2026, hastaAnio: 2028 })
    : null;

  // --- Tributario ---------------------------------------------------------
  const brutoAnual = esIndependiente
    ? promedioBoletas * 12 + perfil.sueldoLiquidoMensual * 12
    : perfil.sueldoLiquidoMensual * 12;
  const imponible = esIndependiente
    ? rentaImponibleHonorarios({ brutoAnualCLP: brutoAnual, valorUTM: mercado.valorUTM })
    : { rentaImponible: brutoAnual, gastosPresuntos: 0, cotizaciones: 0 };

  const beneficio55 = beneficio55bisPorAnio(credito.filas, {
    rentaBrutaImponibleAnualCLP: imponible.rentaImponible,
    valorUTM: mercado.valorUTM,
    valorUF: mercado.valorUF,
    anios: Math.min(10, Math.ceil(credito.plazoMeses / 12)),
  });

  const contrib = contribuciones({
    avaluoFiscalCLP: pr.avaluoFiscalCLP,
    tasaAnual: mercado.tasaContribucionesAnual,
    esDFL2,
  });

  // --- Escenario arriendo -------------------------------------------------
  let inversion = null;
  let proyeccion = null;
  let equilibrio = null;
  let versusArrendar = null;

  if (arriendo.activo) {
    const servicioDeudaAnio1 = credito.filas.slice(0, 12).reduce((a, f) => a + f.dividendoUF, 0);
    // Si es DFL2 y eres persona natural, el arriendo no constituye renta.
    const arriendoTributable = !dfl2.arriendoExentoDeRenta;

    const construirMetricas = (arriendoMensualUF, servicioDeudaAnualUF) => metricasInversion({
      precioUF: pr.precioUF,
      gastosCompraUF: credito.gastosOperacionales.totalUF,
      habilitacionUF: pr.habilitacionUF,
      pieUF: credito.pieUF,
      arriendoMensualUF,
      vacanciaAnual: arriendo.vacanciaAnual,
      gastosComunesMensualesUF: pr.gastosComunesMensualesUF,
      contribucionesAnualesUF: contrib.anualCLP / mercado.valorUF,
      tasaAdministracion: arriendo.tasaAdministracion,
      tasaMantencion: arriendo.tasaMantencion,
      seguroAnualUF: arriendo.seguroAnualUF,
      servicioDeudaAnualUF,
      impuestoArriendoAnualUF: 0,
    });

    inversion = construirMetricas(arriendo.arriendoMensualUF, servicioDeudaAnio1);
    inversion.arriendoTributable = arriendoTributable;
    inversion.exentoPorDFL2 = dfl2.arriendoExentoDeRenta;

    equilibrio = puntosDeEquilibrio({
      metricas: inversion,
      servicioDeudaAnualUF: servicioDeudaAnio1,
      vacanciaAnual: arriendo.vacanciaAnual,
      tasaAdministracion: arriendo.tasaAdministracion,
      tasaMantencion: arriendo.tasaMantencion,
    });

    const proyectarCon = (plusvalia) => proyectarInversion({
      filas: credito.filas,
      precioUF: pr.precioUF,
      capitalInvertidoUF: inversion.capitalInvertidoUF,
      aniosProyeccion: mercado.aniosProyeccion,
      plusvaliaAnualReal: plusvalia,
      crecimientoArriendoAnualReal: mercado.crecimientoArriendoAnualReal,
      tasaComisionVenta: mercado.tasaComisionVenta,
      tasaDescuento: mercado.rendimientoAlternativoAnualReal,
      metricasDelAnio: (anio, servicioDeudaAnualUF, factorArriendo) =>
        construirMetricas(arriendo.arriendoMensualUF * factorArriendo, servicioDeudaAnualUF),
    });
    proyeccion = proyectarCon(mercado.plusvaliaAnualReal);
    proyeccion.proyectarCon = proyectarCon;

    versusArrendar = compararComprarVsArrendar({
      filas: credito.filas,
      precioUF: pr.precioUF,
      capitalInicialUF: credito.pieUF + credito.gastosOperacionales.totalUF + pr.habilitacionUF,
      arriendoEquivalenteMensualUF: arriendo.arriendoEquivalenteMensualUF,
      costosPropietarioMensualesUF:
        pr.gastosComunesMensualesUF + contrib.mensualCLP / mercado.valorUF,
      plusvaliaAnualReal: mercado.plusvaliaAnualReal,
      rendimientoAlternativoAnualReal: mercado.rendimientoAlternativoAnualReal,
      crecimientoArriendoAnualReal: mercado.crecimientoArriendoAnualReal,
      aniosProyeccion: Math.min(mercado.aniosProyeccion * 2, cr.plazoAnios),
      tasaComisionVenta: mercado.tasaComisionVenta,
    });
  }

  // --- Comparaciones de programas ----------------------------------------
  const fogaesComparado = compararFogaes(entradaCredito, {
    ahorroActualUF: mercado.ahorroActualUF,
    ahorroMensualUF: mercado.ahorroMensualUF,
    plusvaliaAnualReal: mercado.plusvaliaAnualReal,
  });
  const subsidioComparado = compararSubsidioDividendo({ ...entradaCredito, tasaAnual: cr.tasaAnual });

  // --- Sensibilidad y prepago --------------------------------------------
  const sensibilidad = analizarSensibilidad(
    entradaCredito,
    variablesSensibilidadPorDefecto(entradaCredito),
    (c) => c.dividendoPrimerMesUF,
  );

  const prepago = (cr.abonoMensualUF > 0 || cr.abonoAnualUF > 0)
    ? simularPrepago(
        { ...entradaCredito, abonoMensualUF: 0, abonoAnualUF: 0 },
        { abonoMensualUF: cr.abonoMensualUF, abonoAnualUF: cr.abonoAnualUF, mesAbonoAnual: cr.mesAbonoAnual, modo: cr.modoAbono },
      )
    : null;

  // --- Veredicto ----------------------------------------------------------
  const veredicto = construirVeredicto({
    credito,
    inversion,
    proyeccion,
    valorUF: mercado.valorUF,
    rendimientoAlternativoAnual: mercado.rendimientoAlternativoAnualReal,
    perfilIngresos: {
      modalidad: perfil.modalidad,
      rentaAcreditableMensual: renta.total,
      ingresoRealMensual: esIndependiente
        ? liquidoHonorarios({ brutoMensual: promedioBoletas, anio: 2026 }).liquidoRecibido + perfil.sueldoLiquidoMensual
        : perfil.sueldoLiquidoMensual,
      otrasDeudasMensuales: perfil.otrasDeudasMensuales,
      coefVariacion: estadisticaBoletas ? estadisticaBoletas.coefVariacion : 0,
      peorTrimestrePromedioMensual: estadisticaBoletas
        ? estadisticaBoletas.peorTrimestrePromedioMensual
        : null,
      ahorroLiquidoCLP: perfil.ahorroLiquidoCLP,
    },
  });

  return {
    entrada: e,
    avisos,
    credito,
    programas: prog,
    fogaesComparado,
    subsidioComparado,
    dfl2,
    ingresos: {
      estadisticaBoletas,
      promedioBoletas,
      renta,
      capacidad,
      carga,
      alcance,
      retencion,
      colchonRecomendadoMeses: colchonRecomendado({
        modalidad: perfil.modalidad,
        coefVariacion: estadisticaBoletas ? estadisticaBoletas.coefVariacion : 0,
      }),
    },
    impuestos: { imponible, beneficio55, contribuciones: contrib },
    inversion,
    equilibrio,
    proyeccion,
    versusArrendar,
    sensibilidad,
    prepago,
    veredicto,
  };
}
