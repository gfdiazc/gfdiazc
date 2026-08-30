/**
 * El veredicto: traduce todos los números a un puñado de señales legibles.
 *
 * No decide por ti, y a propósito no entrega un "puntaje total" único: sumar
 * peras con manzanas para producir un 7,4 sobre 10 esconde justo lo que
 * necesitas ver. Lo que hace es marcar cada dimensión en verde, ámbar o rojo y
 * decir por qué.
 */

import { cl } from './finanzas.js';
import { cargaFinanciera, colchonRecomendado, pruebaDeEstres } from './ingresos.js';

/** @typedef {'verde'|'ambar'|'rojo'|'sin-dato'} Semaforo */

const señal = (semaforo, titulo, valor, mensaje, detalle = null) =>
  ({ semaforo, titulo, valor, mensaje, detalle });

/**
 * Construye el tablero de señales.
 *
 * @param {Object} p
 * @param {Object} p.credito resultado de calcularCredito
 * @param {Object} [p.inversion] métricas de metricasInversion
 * @param {Object} [p.proyeccion] resultado de proyectarInversion
 * @param {Object} p.perfilIngresos { modalidad, rentaAcreditableMensual, ingresoRealMensual, otrasDeudasMensuales, coefVariacion, peorTrimestrePromedioMensual, ahorroLiquido }
 * @param {number} p.valorUF
 * @param {number} [p.rendimientoAlternativoAnual] tu tasa de comparación
 */
export function construirVeredicto({
  credito,
  inversion = null,
  proyeccion = null,
  perfilIngresos,
  valorUF,
  rendimientoAlternativoAnual = 0.04,
}) {
  const señales = [];
  const dividendoCLP = credito.dividendoPrimerMesUF * valorUF;

  // 1. Carga financiera.
  const carga = cargaFinanciera({
    dividendoMensual: dividendoCLP,
    otrasDeudasMensuales: perfilIngresos.otrasDeudasMensuales || 0,
    rentaAcreditableMensual: perfilIngresos.rentaAcreditableMensual,
  });
  señales.push(
    carga.valor === null
      ? señal('sin-dato', 'Carga financiera', null, 'Falta cargar tus ingresos.')
      : señal(
          carga.semaforo,
          'Carga financiera',
          carga.valor,
          carga.mensaje,
          `El dividendo más tus otras deudas se llevan el ${cl(carga.valor * 100, 1)}% de la renta que el banco te reconoce.`,
        ),
  );

  // 2. Colchón de liquidez. Para un ingreso variable esto pesa más que la tasa.
  const mesesRecomendados = colchonRecomendado({
    modalidad: perfilIngresos.modalidad,
    coefVariacion: perfilIngresos.coefVariacion || 0,
  });
  const compromisoMensualCLP = dividendoCLP + (perfilIngresos.otrasDeudasMensuales || 0);
  const mesesQueTienes = compromisoMensualCLP > 0
    ? (perfilIngresos.ahorroLiquidoCLP || 0) / compromisoMensualCLP
    : 0;
  señales.push(
    señal(
      mesesQueTienes >= mesesRecomendados ? 'verde' : mesesQueTienes >= mesesRecomendados / 2 ? 'ambar' : 'rojo',
      'Colchón de liquidez',
      mesesQueTienes,
      `Tienes ${cl(mesesQueTienes, 1)} meses de dividendo guardados y para tu perfil convienen ${mesesRecomendados}.`,
      perfilIngresos.modalidad === 'dependiente'
        ? 'Con sueldo fijo, 6 meses es un piso razonable.'
        : 'Con ingresos variables el colchón no es un lujo: es lo que te separa de vender apurado.',
    ),
  );

  // 3. Prueba de estrés.
  if (perfilIngresos.ingresoRealMensual) {
    const estres = pruebaDeEstres({
      dividendoMensual: dividendoCLP,
      otrasDeudasMensuales: perfilIngresos.otrasDeudasMensuales || 0,
      rentaAcreditableMensual: perfilIngresos.rentaAcreditableMensual,
      ingresoRealMensual: perfilIngresos.ingresoRealMensual,
      caidaPorcentual: 0.30,
      mesesDeCaida: 6,
      ahorroLiquidoUF: perfilIngresos.ahorroLiquidoCLP || 0,
      peorTrimestrePromedioMensual: perfilIngresos.peorTrimestrePromedioMensual,
    });
    const fallan = estres.escenarios.filter((e) => !e.sobrevive);
    señales.push(
      señal(
        estres.sobreviveTodo ? 'verde' : fallan.length === estres.escenarios.length ? 'rojo' : 'ambar',
        'Prueba de estrés',
        estres.sobreviveTodo ? 1 : 0,
        estres.sobreviveTodo
          ? 'Aguantas los escenarios malos con el ahorro que tienes.'
          : `No aguantas: ${fallan.map((e) => e.nombre.toLowerCase()).join(' ni ')}.`,
        fallan.length
          ? fallan.map((e) => `${e.nombre}: te faltarían ${Math.round(e.deficitMensual).toLocaleString('es-CL')} al mes.`).join(' ')
          : null,
      ),
    );
  }

  // 4. CAE contra la tasa nominal: cuánto te cuesta de verdad el crédito.
  if (credito.caeAnual != null) {
    const brecha = credito.caeAnual - credito.tasaMensualAplicada * 12;
    // Los seguros y gastos de un crédito hipotecario chileno normal agregan del
    // orden de 1 punto porcentual sobre la tasa, y esa brecha se mantiene casi
    // constante a cualquier nivel de tasa. Los umbrales están puestos ahí: solo
    // se enciende la alarma cuando los seguros o los gastos se salen de lo
    // habitual, no por el hecho de que exista brecha.
    señales.push(
      señal(
        brecha < 0.012 ? 'verde' : brecha < 0.018 ? 'ambar' : 'rojo',
        'Costo real del crédito (CAE)',
        credito.caeAnual,
        `La CAE es ${cl(credito.caeAnual * 100, 2)}%, o sea ${cl(brecha * 100, 2)} puntos sobre la tasa que te ofrecieron.`,
        'La diferencia son los seguros y los gastos operacionales. Es la cifra que sirve para comparar bancos.',
      ),
    );
  }

  // 5. Cuánto pagas en total respecto del precio.
  const multiplo = credito.costoTotalUF / (credito.pieUF + credito.montoCreditoUF);
  señales.push(
    señal(
      multiplo < 1.5 ? 'verde' : multiplo < 1.9 ? 'ambar' : 'rojo',
      'Costo total',
      multiplo,
      `Vas a desembolsar ${cl(multiplo, 2)} veces el valor de la propiedad.`,
      'Incluye pie, gastos, intereses y seguros a lo largo de todo el crédito.',
    ),
  );

  // Señales de inversión, solo si evaluaste el escenario de arriendo.
  if (inversion) {
    señales.push(
      señal(
        inversion.flujoMensualUF > 0 ? 'verde' : inversion.flujoMensualUF > -2 ? 'ambar' : 'rojo',
        'Flujo de caja del arriendo',
        inversion.flujoMensualUF,
        inversion.flujoMensualUF > 0
          ? `El arriendo cubre el dividendo y te sobran ${cl(inversion.flujoMensualUF, 2)} UF al mes.`
          : `El arriendo no alcanza: tienes que poner ${cl(Math.abs(inversion.flujoMensualUF), 2)} UF de tu bolsillo cada mes.`,
        'Un flujo negativo no es fatal si la plusvalía compensa, pero es plata que sale todos los meses.',
      ),
    );
    señales.push(
      señal(
        inversion.capRateNeto > 0.045 ? 'verde' : inversion.capRateNeto > 0.03 ? 'ambar' : 'rojo',
        'Rentabilidad neta (cap rate)',
        inversion.capRateNeto,
        `${cl(inversion.capRateNeto * 100, 2)}% neto sobre la inversión total.`,
        'Descontadas vacancia, administración, mantención y contribuciones. Sin considerar la deuda.',
      ),
    );
  }

  if (proyeccion && proyeccion.tirAnual != null) {
    señales.push(
      señal(
        proyeccion.tirAnual > rendimientoAlternativoAnual ? 'verde'
          : proyeccion.tirAnual > rendimientoAlternativoAnual - 0.02 ? 'ambar' : 'rojo',
        'TIR proyectada',
        proyeccion.tirAnual,
        `${cl(proyeccion.tirAnual * 100, 2)}% real anual contra tu alternativa de ${cl(rendimientoAlternativoAnual * 100, 1)}%.`,
        'Incluye la venta al final del período. Es muy sensible al supuesto de plusvalía: míralo junto al análisis de sensibilidad.',
      ),
    );
  }

  const conteo = { verde: 0, ambar: 0, rojo: 0, 'sin-dato': 0 };
  for (const s of señales) conteo[s.semaforo] += 1;

  return {
    señales,
    conteo,
    bloqueantes: señales.filter((s) => s.semaforo === 'rojo'),
    resumen: resumir(conteo, señales),
  };
}

function resumir(conteo, señales) {
  const rojas = señales.filter((s) => s.semaforo === 'rojo');
  if (rojas.length === 0 && conteo.ambar === 0) {
    return 'Todas las señales están en verde. Con los supuestos que cargaste, la operación se sostiene.';
  }
  if (rojas.length === 0) {
    return 'Sin señales rojas, pero hay puntos en ámbar que conviene apretar antes de firmar.';
  }
  if (rojas.length === 1) {
    return `Hay una señal roja: ${rojas[0].titulo.toLowerCase()}. Resuélvela antes de avanzar.`;
  }
  return `Hay ${rojas.length} señales rojas (${rojas.map((s) => s.titulo.toLowerCase()).join(', ')}). Con estos supuestos, la operación es frágil.`;
}
