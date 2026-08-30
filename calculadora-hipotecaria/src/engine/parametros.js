/**
 * Parámetros del mercado chileno. Ninguno está "quemado" en la lógica de
 * cálculo: todos son entradas con un valor por defecto, y cada default
 * declara su fuente, la fecha en que se verificó y cuánta confianza merece.
 *
 * confianza:
 *   'alta'  → está en la ley o lo publica el Banco Central / SII. Cámbialo solo
 *             si la norma cambió.
 *   'media' → varía entre bancos y perfiles. El default es un punto medio
 *             razonable; reemplázalo con tu cotización.
 *   'baja'  → varía tanto que el default es apenas un orden de magnitud.
 *             Cotiza antes de tomar cualquier decisión con esto.
 */

export const VERIFICADO_AL = '2026-08-30';

/** @typedef {'alta'|'media'|'baja'} Confianza */

/**
 * @typedef {Object} Supuesto
 * @property {number} valor
 * @property {string} unidad
 * @property {string} etiqueta
 * @property {Confianza} confianza
 * @property {string} fuente
 * @property {string} [nota]
 * @property {[number, number]} [rango] Rango plausible, para avisar si te sales.
 */

/** @type {Record<string, Supuesto>} */
export const SUPUESTOS = {
  valorUF: {
    valor: 40871,
    unidad: 'CLP',
    etiqueta: 'Valor de la UF',
    confianza: 'alta',
    fuente: 'Banco Central de Chile, 29-ago-2026',
    nota: 'Cambia todos los días. Actualízalo antes de mirar cifras en pesos.',
    rango: [30000, 60000],
  },
  valorUTM: {
    valor: 71649,
    unidad: 'CLP',
    etiqueta: 'Valor de la UTM',
    confianza: 'alta',
    fuente: 'SII, agosto 2026',
    nota: '1 UTA = 12 UTM. Se usa en el Art. 55 bis y en el Global Complementario.',
    rango: [50000, 120000],
  },
  tasaAnual: {
    valor: 0.04,
    unidad: 'fracción anual',
    etiqueta: 'Tasa de interés anual (UF)',
    confianza: 'media',
    fuente: 'Banco Central: promedio del sistema ~4,0% anual UF (jul-2026)',
    nota: 'Es un promedio ponderado del Gran Santiago. Tu tasa real depende del banco, del pie, del plazo y de tu perfil. Pide cotizaciones.',
    rango: [0.015, 0.09],
  },
  plazoAnios: {
    valor: 25,
    unidad: 'años',
    etiqueta: 'Plazo del crédito',
    confianza: 'alta',
    fuente: 'Oferta habitual del mercado: 15, 20, 25 o 30 años',
    rango: [5, 30],
  },
  piePorcentaje: {
    valor: 0.20,
    unidad: 'fracción del precio',
    etiqueta: 'Pie',
    confianza: 'alta',
    fuente: 'Estándar de mercado: 20% (LTV 80%). Con FOGAES puede bajar a 10%.',
    rango: [0.05, 1],
  },
  tasaDesgravamenMensual: {
    valor: 0.00025,
    unidad: 'fracción mensual del saldo insoluto',
    etiqueta: 'Seguro de desgravamen',
    confianza: 'media',
    fuente: 'Rango habitual 0,020%–0,035% mensual sobre el saldo insoluto',
    nota: 'Depende fuerte de tu edad y de si son uno o dos deudores. A los 30 está cerca del piso; a los 50, del techo.',
    rango: [0.0001, 0.0008],
  },
  tasaIncendioSismoMensual: {
    valor: 0.00022,
    unidad: 'fracción mensual del valor de tasación',
    etiqueta: 'Seguro de incendio y sismo',
    confianza: 'media',
    fuente: 'Rango habitual 0,015%–0,030% mensual sobre el valor de tasación',
    nota: 'Se calcula sobre el valor de reconstrucción, no sobre el precio de compra. Puedes contratarlo fuera del banco y suele salir más barato.',
    rango: [0.00005, 0.0006],
  },
  comisionAdminMensualUF: {
    valor: 0,
    unidad: 'UF/mes',
    etiqueta: 'Comisión de administración',
    confianza: 'media',
    fuente: 'La mayoría de los créditos hipotecarios en Chile no la cobran',
    rango: [0, 1],
  },
  tasacionUF: {
    valor: 3,
    unidad: 'UF',
    etiqueta: 'Tasación',
    confianza: 'baja',
    fuente: 'Rango de mercado ~UF 2–4 en Santiago',
    nota: 'Varios bancos la regalan en campaña. Pregunta.',
    rango: [0, 30],
  },
  estudioTitulosUF: {
    valor: 5,
    unidad: 'UF',
    etiqueta: 'Estudio de títulos y redacción de escritura',
    confianza: 'baja',
    fuente: 'Rango de mercado ~UF 4–8',
    rango: [0, 60],
  },
  notariaUF: {
    valor: 2,
    unidad: 'UF',
    etiqueta: 'Notaría',
    confianza: 'baja',
    fuente: 'Aranceles notariales, escritura de compraventa con mutuo',
    rango: [0, 40],
  },
  tasaConservador: {
    valor: 0.002,
    unidad: 'fracción del precio',
    etiqueta: 'Inscripción en el Conservador de Bienes Raíces',
    confianza: 'media',
    fuente: 'Arancel CBR: 0,2% del valor, con tope',
    rango: [0, 0.01],
  },
  topeConservadorUF: {
    valor: 32,
    unidad: 'UF',
    etiqueta: 'Tope del arancel del Conservador',
    confianza: 'baja',
    fuente: 'El arancel del CBR tiene tope legal; el monto exacto se reajusta',
    rango: [0, 200],
  },
  tasaImpuestoMutuo: {
    valor: 0.008,
    unidad: 'fracción del crédito',
    etiqueta: 'Impuesto de timbres y estampillas (impuesto al mutuo)',
    confianza: 'alta',
    fuente: 'DL 3.475. 0,8% del monto del crédito',
    nota: 'Baja a 0,2% si la vivienda es DFL2 y es 0% en vivienda social.',
    rango: [0, 0.008],
  },
  tasaImpuestoMutuoDFL2: {
    valor: 0.002,
    unidad: 'fracción del crédito',
    etiqueta: 'Impuesto al mutuo, vivienda DFL2',
    confianza: 'alta',
    fuente: 'DL 3.475 en relación con el DFL 2 de 1959',
    rango: [0, 0.008],
  },
  gastosNotarialesCompraventaUF: {
    valor: 3,
    unidad: 'UF',
    etiqueta: 'Gastos notariales de la compraventa',
    confianza: 'baja',
    fuente: 'Aparte de los gastos del mutuo. Suele repartirse con el vendedor.',
    rango: [0, 40],
  },
};

/**
 * FOGAES Vivienda y Subsidio al Dividendo, tal como quedaron después de la
 * ampliación aprobada en agosto de 2026.
 */
export const PROGRAMAS = {
  fogaes: {
    nombre: 'FOGAES Vivienda',
    topeValorViviendaUF: 6000,
    ltvMaximo: 0.90,
    fuente: 'Ley de Subsidio al Dividendo y ampliación aprobada el 12-ago-2026 (tope subió de UF 4.500 a UF 6.000)',
    verificadoAl: VERIFICADO_AL,
  },
  subsidioDividendo: {
    nombre: 'Subsidio al Dividendo',
    topeValorViviendaUF: 6000,
    rebajaTasaAnual: 0.006, // 60 puntos base
    exigeViviendaNueva: true,
    promesaDesde: '2025-01-01',
    postulacionHasta: '2028-05-31',
    cuposTotales: 80000,
    fuente: 'Ley de Subsidio al Dividendo; ampliación de ago-2026 subió el tope de UF 4.000 a UF 6.000 y los cupos de 50.000 a 80.000',
    verificadoAl: VERIFICADO_AL,
  },
};

/**
 * Retención de boletas de honorarios. Sube de forma gradual por la Ley 21.133,
 * que incorporó a los independientes al sistema de protección social.
 * Importa para el flujo de caja: tu líquido mensual baja cada año hasta 2028.
 */
export const RETENCION_HONORARIOS = {
  2024: 0.1375,
  2025: 0.145,
  2026: 0.1525,
  2027: 0.16,
  2028: 0.17,
};
export const RETENCION_HONORARIOS_FUENTE =
  'Ley 21.133, calendario gradual publicado por el SII. 15,25% desde el 1-ene-2026, tope 17% en 2028.';

/**
 * Tramos del Impuesto Global Complementario, en UTA (Art. 52 LIR).
 * Se guardan solo los límites y las tasas marginales: el impuesto se calcula
 * sumando tramo a tramo, sin constantes de "rebaja" que puedan quedar obsoletas.
 */
export const TRAMOS_IGC_UTA = [
  { hasta: 13.5, tasa: 0 },
  { hasta: 30, tasa: 0.04 },
  { hasta: 50, tasa: 0.08 },
  { hasta: 70, tasa: 0.135 },
  { hasta: 90, tasa: 0.23 },
  { hasta: 120, tasa: 0.304 },
  { hasta: 310, tasa: 0.35 },
  { hasta: Infinity, tasa: 0.40 },
];

/** Beneficio tributario del Art. 55 bis de la Ley de la Renta. */
export const ART_55_BIS = {
  topeUTA: 8,
  rentaSinRestriccionUTA: 90,
  rentaSinBeneficioUTA: 150,
  fuente: 'Art. 55 bis LIR. Rebaja total bajo 90 UTA de renta bruta anual, degradación lineal hasta 0% en 150 UTA, tope de 8 UTA.',
};

/** Honorarios: gastos presuntos del Art. 50 LIR. */
export const GASTOS_PRESUNTOS = {
  tasa: 0.30,
  topeUTA: 15,
  fuente: 'Art. 50 LIR: 30% de los ingresos brutos, con tope de 15 UTA anuales.',
};

/** Cotizaciones previsionales obligatorias del trabajador independiente. */
export const COTIZACIONES_INDEPENDIENTE = {
  baseImponible: 0.80,
  tasaTotalAproximada: 0.1750,
  fuente: 'Ley 21.133. La base imponible es el 80% de los honorarios brutos anuales; sobre ella se pagan AFP, salud, SIS, AFC y ley de accidentes.',
  nota: 'La tasa total es aproximada: depende de tu AFP y de tu plan de salud.',
};

/** Impuesto a la ganancia de capital al vender, para persona natural. */
export const GANANCIA_CAPITAL = {
  exencionVitaliciaUF: 8000,
  tasaUnica: 0.10,
  fuente: 'Art. 17 N°8 LIR: exención de 8.000 UF por contribuyente, de por vida. Sobre el exceso, 10% de impuesto único (o Global Complementario, a elección).',
};

/** DFL 2 de 1959: vivienda económica de hasta 140 m² útiles. */
export const DFL2 = {
  superficieMaximaM2: 140,
  maxViviendasPersonaNatural: 2,
  fuente: 'DFL 2 de 1959, con los límites que introdujo la Ley 20.455 para personas naturales.',
  beneficios: [
    'Impuesto al mutuo de 0,2% en vez de 0,8%',
    'Rebaja del impuesto territorial (contribuciones) por un período',
    'Las rentas de arrendamiento no constituyen renta para persona natural',
  ],
};

/** Reglas con que los bancos evalúan tu capacidad de pago. */
export const EVALUACION_BANCARIA = {
  cargaFinancieraMaxima: 0.25,
  cargaFinancieraMaximaFlexible: 0.30,
  factorCastigoHonorarios: 0.75,
  factorCastigoHonorariosRango: [0.70, 0.80],
  mesesBoletasHabitual: 12,
  fuente: 'Práctica de mercado: el dividendo no debe superar 25%–30% de la renta líquida acreditable. Para independientes, los bancos reconocen del orden del 70%–80% del promedio de boletas.',
  nota: 'No es una regla legal: cada banco tiene su política y su criterio. Trátalo como un filtro previo, no como una preaprobación.',
};

/** Requisitos que los bancos suelen pedirle a un trabajador independiente. */
export const REQUISITOS_INDEPENDIENTE = [
  { item: 'Iniciación de actividades con al menos 2 años de antigüedad', nota: 'Basta 1 año si eres profesional universitario titulado.' },
  { item: 'Carpeta tributaria para solicitar créditos, emitida por el SII', nota: 'Se genera gratis en sii.cl y es el documento central de la evaluación.' },
  { item: 'Declaraciones de renta (Formulario 22) de los últimos 2 años', nota: 'Los bancos cruzan tu F22 con el promedio de boletas y se quedan con el menor.' },
  { item: 'Últimas 6 a 24 boletas de honorarios', nota: 'Mientras más regulares y más de un cliente, mejor te evalúan.' },
  { item: 'Cartolas bancarias de los últimos 12 meses', nota: 'Buscan que los ingresos declarados efectivamente lleguen a tu cuenta.' },
  { item: 'Cotizaciones previsionales al día', nota: 'La Operación Renta las descuenta de tu devolución; tenerlas al día ayuda.' },
  { item: 'Sin deudas morosas en el boletín comercial' },
  { item: 'Antigüedad bancaria de al menos 6 meses' },
];

/** Devuelve un objeto plano { clave: valor } con los defaults. */
export function valoresPorDefecto() {
  const out = {};
  for (const [clave, s] of Object.entries(SUPUESTOS)) out[clave] = s.valor;
  return out;
}

/** Avisa si un supuesto quedó fuera de su rango plausible. */
export function fueraDeRango(clave, valor) {
  const s = SUPUESTOS[clave];
  if (!s || !s.rango) return null;
  const [min, max] = s.rango;
  if (valor < min || valor > max) {
    return `${s.etiqueta}: ${valor} está fuera del rango habitual (${min}–${max}).`;
  }
  return null;
}
