/**
 * Lo tributario: Global Complementario, el beneficio del Art. 55 bis, DFL2 y
 * el impuesto a la ganancia de capital al vender.
 *
 * El Art. 55 bis en particular casi nunca aparece en los simuladores, y para un
 * comprador de renta media puede valer varios cientos de miles de pesos al año.
 * No cambia tu dividendo, pero sí el costo real del crédito.
 */

import { TRAMOS_IGC_UTA, ART_55_BIS, GASTOS_PRESUNTOS, COTIZACIONES_INDEPENDIENTE, DFL2, GANANCIA_CAPITAL } from './parametros.js';
import { acotar, cl } from './finanzas.js';

/**
 * Impuesto Global Complementario, calculado tramo a tramo.
 *
 * Se suma el impuesto de cada tramo en vez de usar la fórmula
 * "renta × factor − rebaja": da exactamente lo mismo, pero no depende de
 * constantes de rebaja que puedan quedar desactualizadas.
 *
 * @param {number} rentaAnualCLP renta bruta imponible anual, en pesos
 * @param {number} valorUTM
 */
export function impuestoGlobalComplementario(rentaAnualCLP, valorUTM) {
  const uta = valorUTM * 12;
  const rentaUTA = rentaAnualCLP / uta;

  let impuestoUTA = 0;
  let anterior = 0;
  let tasaMarginal = 0;

  for (const tramo of TRAMOS_IGC_UTA) {
    if (rentaUTA <= anterior) break;
    const enTramo = Math.min(rentaUTA, tramo.hasta) - anterior;
    impuestoUTA += enTramo * tramo.tasa;
    tasaMarginal = tramo.tasa;
    anterior = tramo.hasta;
  }

  const impuesto = impuestoUTA * uta;
  return {
    rentaUTA,
    impuesto,
    tasaMarginal,
    tasaEfectiva: rentaAnualCLP > 0 ? impuesto / rentaAnualCLP : 0,
  };
}

/**
 * Renta bruta imponible anual de un trabajador a honorarios.
 *
 * Se descuentan los gastos presuntos (30% con tope de 15 UTA) y las
 * cotizaciones previsionales obligatorias.
 */
export function rentaImponibleHonorarios({ brutoAnualCLP, valorUTM, usarGastosPresuntos = true }) {
  const uta = valorUTM * 12;
  const gastosPresuntos = usarGastosPresuntos
    ? Math.min(brutoAnualCLP * GASTOS_PRESUNTOS.tasa, GASTOS_PRESUNTOS.topeUTA * uta)
    : 0;

  const baseCotizable = brutoAnualCLP * COTIZACIONES_INDEPENDIENTE.baseImponible;
  const cotizaciones = baseCotizable * COTIZACIONES_INDEPENDIENTE.tasaTotalAproximada;

  const rentaImponible = Math.max(0, brutoAnualCLP - gastosPresuntos - cotizaciones);

  return {
    brutoAnualCLP,
    gastosPresuntos,
    topeGastosPresuntosAlcanzado: brutoAnualCLP * GASTOS_PRESUNTOS.tasa > GASTOS_PRESUNTOS.topeUTA * uta,
    cotizaciones,
    rentaImponible,
  };
}

/**
 * Beneficio del Art. 55 bis: rebaja de los intereses hipotecarios.
 *
 * Reglas:
 *   - Solo intereses efectivamente pagados en el año. No capital, no seguros,
 *     no comisiones.
 *   - Tope de 8 UTA.
 *   - Bajo 90 UTA de renta bruta anual, la rebaja es completa.
 *   - Entre 90 y 150 UTA se degrada de forma lineal.
 *   - Sobre 150 UTA no hay beneficio.
 *
 * El factor de degradación es (250 − 1,667 × renta en UTA) / 100, que da 100%
 * en 90 UTA y 0% en 150 UTA.
 *
 * @param {Object} p
 * @param {number} p.interesesAnualesCLP
 * @param {number} p.rentaBrutaImponibleAnualCLP
 * @param {number} p.valorUTM
 */
export function beneficio55bis({ interesesAnualesCLP, rentaBrutaImponibleAnualCLP, valorUTM }) {
  const uta = valorUTM * 12;
  const rentaUTA = rentaBrutaImponibleAnualCLP / uta;
  const topeCLP = ART_55_BIS.topeUTA * uta;

  const factor = acotar((250 - 1.667 * rentaUTA) / 100, 0, 1);
  const rebajaBase = Math.min(interesesAnualesCLP, topeCLP);
  const rebaja = rebajaBase * factor;

  const sinBeneficio = impuestoGlobalComplementario(rentaBrutaImponibleAnualCLP, valorUTM);
  const conBeneficio = impuestoGlobalComplementario(
    Math.max(0, rentaBrutaImponibleAnualCLP - rebaja),
    valorUTM,
  );
  const ahorro = sinBeneficio.impuesto - conBeneficio.impuesto;

  let motivo;
  if (rentaUTA >= ART_55_BIS.rentaSinBeneficioUTA) {
    motivo = `Tu renta bruta anual (${cl(rentaUTA, 1)} UTA) supera las 150 UTA: no tienes derecho al beneficio.`;
  } else if (rentaUTA <= ART_55_BIS.rentaSinRestriccionUTA) {
    motivo = 'Tu renta está bajo 90 UTA, así que puedes rebajar los intereses completos hasta el tope de 8 UTA.';
  } else {
    motivo = `Tu renta está entre 90 y 150 UTA, así que la rebaja se reduce al ${cl(factor * 100, 0)}%.`;
  }

  return {
    rentaUTA,
    factor,
    topeCLP,
    interesesConsiderados: rebajaBase,
    topeAlcanzado: interesesAnualesCLP > topeCLP,
    rebaja,
    ahorroTributarioAnual: ahorro,
    tasaMarginal: sinBeneficio.tasaMarginal,
    aplica: ahorro > 0,
    motivo,
  };
}

/**
 * Aplica el Art. 55 bis año a año sobre la tabla de amortización.
 * Los intereses son altos al principio y bajan con el tiempo, así que el
 * beneficio se concentra en los primeros años.
 *
 * @param {Array} filas filas de la tabla de amortización (en UF)
 * @param {Object} p
 */
export function beneficio55bisPorAnio(filas, { rentaBrutaImponibleAnualCLP, valorUTM, valorUF, anios = 10 }) {
  const resultado = [];
  let acumulado = 0;

  for (let anio = 1; anio <= anios; anio++) {
    const desde = (anio - 1) * 12;
    const hasta = anio * 12;
    const tramo = filas.slice(desde, hasta);
    if (tramo.length === 0) break;

    const interesesUF = tramo.reduce((a, f) => a + f.interes, 0);
    const b = beneficio55bis({
      interesesAnualesCLP: interesesUF * valorUF,
      rentaBrutaImponibleAnualCLP,
      valorUTM,
    });
    acumulado += b.ahorroTributarioAnual;
    resultado.push({
      anio,
      interesesUF,
      interesesCLP: interesesUF * valorUF,
      rebaja: b.rebaja,
      ahorro: b.ahorroTributarioAnual,
      topeAlcanzado: b.topeAlcanzado,
    });
  }

  return { filas: resultado, ahorroAcumulado: acumulado };
}

/**
 * DFL2: si la vivienda califica, cambian tres cosas relevantes.
 */
export function evaluarDFL2({ superficieUtilM2, viviendasDFL2QueYaTiene = 0, esPersonaNatural = true }) {
  const motivos = [];
  if (superficieUtilM2 > DFL2.superficieMaximaM2) {
    motivos.push(`La superficie útil es ${superficieUtilM2} m² y el máximo es ${DFL2.superficieMaximaM2} m².`);
  }
  if (esPersonaNatural && viviendasDFL2QueYaTiene >= DFL2.maxViviendasPersonaNatural) {
    motivos.push(
      `Como persona natural, los beneficios del DFL2 alcanzan hasta ${DFL2.maxViviendasPersonaNatural} viviendas y ya tienes ${viviendasDFL2QueYaTiene}.`,
    );
  }
  const califica = motivos.length === 0;
  return {
    califica,
    motivos,
    beneficios: califica ? DFL2.beneficios : [],
    arriendoExentoDeRenta: califica && esPersonaNatural,
    fuente: DFL2.fuente,
    nota: 'El DFL2 lo determina el permiso de edificación de la propiedad, no su superficie a ojo. Pídele el certificado al vendedor.',
  };
}

/**
 * Impuesto a la ganancia de capital al vender, para persona natural.
 * Hay una exención de 8.000 UF de por vida; sobre el exceso, 10% de impuesto
 * único.
 */
export function impuestoGananciaCapital({ gananciaUF, exencionYaUsadaUF = 0 }) {
  if (gananciaUF <= 0) {
    return { gananciaUF, exencionAplicadaUF: 0, gananciaAfectaUF: 0, impuestoUF: 0 };
  }
  const exencionDisponible = Math.max(0, GANANCIA_CAPITAL.exencionVitaliciaUF - exencionYaUsadaUF);
  const exencionAplicada = Math.min(gananciaUF, exencionDisponible);
  const afecta = gananciaUF - exencionAplicada;
  return {
    gananciaUF,
    exencionDisponibleUF: exencionDisponible,
    exencionAplicadaUF: exencionAplicada,
    gananciaAfectaUF: afecta,
    impuestoUF: afecta * GANANCIA_CAPITAL.tasaUnica,
    tasa: GANANCIA_CAPITAL.tasaUnica,
  };
}

/**
 * Contribuciones (impuesto territorial). El avalúo fiscal y la tasa dependen
 * de la propiedad y la comuna, así que entran como datos.
 */
export function contribuciones({ avaluoFiscalCLP, tasaAnual = 0.01, exencionCLP = 0, esDFL2 = false }) {
  const base = Math.max(0, avaluoFiscalCLP - exencionCLP);
  const bruto = base * tasaAnual;
  // El DFL2 trae rebaja del impuesto territorial por un período.
  const neto = esDFL2 ? bruto * 0.5 : bruto;
  return {
    baseAfectaCLP: base,
    anualCLP: neto,
    mensualCLP: neto / 12,
    exento: base === 0,
    rebajaDFL2Aplicada: esDFL2 && bruto > 0,
  };
}
