/**
 * FOGAES Vivienda y Subsidio al Dividendo.
 *
 * Los dos programas se anunciaron juntos y se suelen presentar como una sola
 * cosa, pero son independientes: FOGAES te deja comprar con menos pie, el
 * Subsidio al Dividendo te baja la tasa. Puedes calificar para uno, para el
 * otro, para ambos o para ninguno.
 */

import { PROGRAMAS } from './parametros.js';
import { cl } from './finanzas.js';
import { calcularCredito } from './credito.js';

/**
 * @typedef {Object} EvaluacionPrograma
 * @property {boolean} elegible
 * @property {string[]} motivos razones por las que NO califica (vacío si califica)
 * @property {string[]} advertencias cosas que sí dependen de ti verificar
 * @property {string} efecto qué te cambia si califica
 */

/**
 * Evalúa la elegibilidad para FOGAES Vivienda.
 *
 * @param {Object} p
 * @param {number} p.precioUF
 * @param {boolean} p.esPrimeraVivienda
 * @param {boolean} p.recibioSubsidioPrevio
 * @param {boolean} p.enRegistroDeudoresPensiones
 * @param {boolean} p.yaUsoFogaes
 * @returns {EvaluacionPrograma}
 */
export function evaluarFogaes({
  precioUF,
  esPrimeraVivienda,
  recibioSubsidioPrevio,
  enRegistroDeudoresPensiones,
  yaUsoFogaes,
}) {
  const cfg = PROGRAMAS.fogaes;
  const motivos = [];

  if (precioUF > cfg.topeValorViviendaUF) {
    motivos.push(
      `La vivienda vale UF ${precioUF.toLocaleString('es-CL')} y el tope es UF ${cfg.topeValorViviendaUF.toLocaleString('es-CL')}.`,
    );
  }
  if (!esPrimeraVivienda) {
    motivos.push('FOGAES es solo para primera vivienda: no puedes tener otra vivienda habitacional.');
  }
  if (recibioSubsidioPrevio) {
    motivos.push('Ya recibiste un subsidio o beneficio estatal para financiar vivienda.');
  }
  if (enRegistroDeudoresPensiones) {
    motivos.push('Estar en el Registro Nacional de Deudores de Pensiones de Alimentos te deja fuera.');
  }
  if (yaUsoFogaes) {
    motivos.push('FOGAES se puede usar una sola vez.');
  }

  return {
    elegible: motivos.length === 0,
    motivos,
    advertencias: [
      'Igual tienes que pasar la evaluación crediticia del banco: FOGAES no la reemplaza.',
      'Los cupos son limitados y se asignan por orden de llegada.',
    ],
    efecto: `Financiamiento de hasta ${cfg.ltvMaximo * 100}% del valor, o sea pie de ${(1 - cfg.ltvMaximo) * 100}% en vez de 20%.`,
    ltvMaximo: cfg.ltvMaximo,
    fuente: cfg.fuente,
  };
}

/**
 * Evalúa la elegibilidad para el Subsidio al Dividendo (rebaja de tasa).
 *
 * @param {Object} p
 * @param {number} p.precioUF
 * @param {boolean} p.esViviendaNueva
 * @param {string} [p.fechaPromesa] ISO 'YYYY-MM-DD'
 * @returns {EvaluacionPrograma}
 */
export function evaluarSubsidioDividendo({ precioUF, esViviendaNueva, fechaPromesa }) {
  const cfg = PROGRAMAS.subsidioDividendo;
  const motivos = [];

  if (precioUF > cfg.topeValorViviendaUF) {
    motivos.push(
      `La vivienda vale UF ${precioUF.toLocaleString('es-CL')} y el tope es UF ${cfg.topeValorViviendaUF.toLocaleString('es-CL')}.`,
    );
  }
  if (cfg.exigeViviendaNueva && !esViviendaNueva) {
    motivos.push('El subsidio aplica solo a viviendas nuevas, no a usadas.');
  }
  if (fechaPromesa && fechaPromesa < cfg.promesaDesde) {
    motivos.push(`La promesa de compraventa debe ser del ${cfg.promesaDesde} en adelante.`);
  }

  return {
    elegible: motivos.length === 0,
    motivos,
    advertencias: [
      `Los cupos son limitados (${cfg.cuposTotales.toLocaleString('es-CL')} en total) y se asignan por orden de llegada.`,
      `El plazo para postular vence el ${cfg.postulacionHasta}.`,
    ],
    efecto: `Rebaja de ${cl(cfg.rebajaTasaAnual * 10000, 0)} puntos base en la tasa (${cl(cfg.rebajaTasaAnual * 100, 2)} puntos porcentuales).`,
    rebajaTasaAnual: cfg.rebajaTasaAnual,
    fuente: cfg.fuente,
  };
}

/**
 * Evalúa ambos programas de una vez y devuelve la tasa y el LTV que
 * efectivamente puedes usar.
 */
export function evaluarProgramas(perfil) {
  const fogaes = evaluarFogaes(perfil);
  const subsidio = evaluarSubsidioDividendo(perfil);

  const usaFogaes = fogaes.elegible && perfil.quiereUsarFogaes !== false;
  const usaSubsidio = subsidio.elegible && perfil.quiereUsarSubsidio !== false;

  return {
    fogaes,
    subsidioDividendo: subsidio,
    usaFogaes,
    usaSubsidio,
    ltvMaximo: usaFogaes ? PROGRAMAS.fogaes.ltvMaximo : 0.80,
    tasaEfectiva: usaSubsidio
      ? Math.max(0, perfil.tasaAnual - PROGRAMAS.subsidioDividendo.rebajaTasaAnual)
      : perfil.tasaAnual,
  };
}

/**
 * Cuántos años te toma juntar un pie mayor, considerando que mientras ahorras
 * el precio de la vivienda también sube.
 *
 * Es la pregunta que decide si FOGAES te conviene o si te conviene esperar:
 * comprar hoy con 10% te endeuda más, pero esperar puede significar perseguir
 * un precio que arranca.
 *
 * @returns {{anios: number|null, precioFuturoUF: number, pieObjetivoUF: number}}
 */
export function aniosParaJuntarPie({
  precioUF,
  piePorcentajeObjetivo,
  ahorroActualUF,
  ahorroMensualUF,
  plusvaliaAnualReal = 0.02,
  rendimientoAhorroAnualReal = 0.01,
  maxAnios = 40,
}) {
  const gMes = Math.pow(1 + plusvaliaAnualReal, 1 / 12) - 1;
  const rMes = Math.pow(1 + rendimientoAhorroAnualReal, 1 / 12) - 1;

  let ahorro = ahorroActualUF;
  let precio = precioUF;

  if (ahorro >= precio * piePorcentajeObjetivo) {
    return { anios: 0, precioFuturoUF: precio, pieObjetivoUF: precio * piePorcentajeObjetivo };
  }
  if (ahorroMensualUF <= 0 && rMes <= gMes) {
    return { anios: null, precioFuturoUF: precio, pieObjetivoUF: precio * piePorcentajeObjetivo };
  }

  for (let mes = 1; mes <= maxAnios * 12; mes++) {
    ahorro = ahorro * (1 + rMes) + ahorroMensualUF;
    precio = precio * (1 + gMes);
    if (ahorro >= precio * piePorcentajeObjetivo) {
      return {
        anios: mes / 12,
        precioFuturoUF: precio,
        pieObjetivoUF: precio * piePorcentajeObjetivo,
      };
    }
  }
  // Nunca lo alcanza: el precio corre más rápido que el ahorro.
  return { anios: null, precioFuturoUF: precio, pieObjetivoUF: precio * piePorcentajeObjetivo };
}

/**
 * La comparación honesta de FOGAES.
 *
 * FOGAES se promociona como "compra con 10% de pie". Lo que no se dice con la
 * misma fuerza es que eso significa pedir un crédito 12,5% más grande: el
 * dividendo sube y los intereses totales suben bastante. A cambio compras
 * antes, y ese "antes" tiene valor si los precios están subiendo.
 *
 * Esta función pone las dos alternativas lado a lado sobre la misma propiedad
 * para que decidas con los números a la vista.
 *
 * @param {Object} entrada entrada de calcularCredito, sin piePorcentaje
 * @param {Object} ahorro { ahorroActualUF, ahorroMensualUF, plusvaliaAnualReal }
 */
export function compararFogaes(entrada, ahorro = {}) {
  const conFogaes = calcularCredito({ ...entrada, piePorcentaje: 0.10, pieUF: null });
  const sinFogaes = calcularCredito({ ...entrada, piePorcentaje: 0.20, pieUF: null });

  const espera = aniosParaJuntarPie({
    precioUF: entrada.precioUF,
    piePorcentajeObjetivo: 0.20,
    ahorroActualUF: ahorro.ahorroActualUF || 0,
    ahorroMensualUF: ahorro.ahorroMensualUF || 0,
    plusvaliaAnualReal: ahorro.plusvaliaAnualReal ?? 0.02,
    rendimientoAhorroAnualReal: ahorro.rendimientoAhorroAnualReal ?? 0.01,
  });

  const deltaDividendoUF = conFogaes.dividendoPrimerMesUF - sinFogaes.dividendoPrimerMesUF;
  const deltaInteresUF = conFogaes.totalInteresUF - sinFogaes.totalInteresUF;
  const deltaPieUF = sinFogaes.pieUF - conFogaes.pieUF;

  return {
    conFogaes,
    sinFogaes,
    deltaDividendoUF,
    deltaInteresUF,
    deltaPieUF,
    espera,
    lectura: [
      `Con FOGAES entras con UF ${cl(deltaPieUF, 0)} menos de pie.`,
      `A cambio pagas UF ${cl(deltaDividendoUF, 2)} más cada mes.`,
      `Y a lo largo del crédito pagas UF ${cl(deltaInteresUF, 0)} más de intereses.`,
      espera.anios === null
        ? 'Con tu ritmo de ahorro actual no alcanzarías el 20% de pie: el precio sube más rápido que tu ahorro.'
        : `Juntar el 20% de pie te tomaría ${cl(espera.anios, 1)} años, y para entonces la vivienda costaría alrededor de UF ${cl(espera.precioFuturoUF, 0)}.`,
    ],
  };
}

/**
 * Efecto aislado del Subsidio al Dividendo sobre el mismo crédito.
 */
export function compararSubsidioDividendo(entrada) {
  const conSubsidio = calcularCredito({
    ...entrada,
    tasaAnual: Math.max(0, entrada.tasaAnual - PROGRAMAS.subsidioDividendo.rebajaTasaAnual),
  });
  const sinSubsidio = calcularCredito(entrada);
  return {
    conSubsidio,
    sinSubsidio,
    ahorroMensualUF: sinSubsidio.dividendoPrimerMesUF - conSubsidio.dividendoPrimerMesUF,
    ahorroTotalUF: sinSubsidio.totalDesembolsadoUF - conSubsidio.totalDesembolsadoUF,
  };
}
