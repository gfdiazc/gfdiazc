/**
 * Capacidad de pago según cómo generas tus ingresos.
 *
 * Un dependiente con sueldo fijo y un independiente a honorarios con el mismo
 * promedio anual NO son evaluados igual por el banco, ni corren el mismo riesgo.
 * El banco reconoce del orden del 70%–80% de lo que declara un independiente, y
 * el independiente además enfrenta meses malos que el dependiente no tiene.
 * Este módulo modela las dos cosas.
 */

import {
  RETENCION_HONORARIOS, COTIZACIONES_INDEPENDIENTE, EVALUACION_BANCARIA,
  REQUISITOS_INDEPENDIENTE,
} from './parametros.js';
import { cl } from './finanzas.js';

/**
 * Tasa de retención de boletas de honorarios para un año dado.
 * Sube todos los años por la Ley 21.133 hasta llegar a 17% en 2028, así que tu
 * líquido mensual baja aunque factures exactamente lo mismo.
 */
export function retencionDelAnio(anio) {
  const anios = Object.keys(RETENCION_HONORARIOS).map(Number).sort((a, b) => a - b);
  if (anio <= anios[0]) return RETENCION_HONORARIOS[anios[0]];
  if (anio >= anios[anios.length - 1]) return RETENCION_HONORARIOS[anios[anios.length - 1]];
  return RETENCION_HONORARIOS[anio];
}

/**
 * Cuánto te llega efectivamente a la cuenta por una boleta, y cuánto de eso
 * es realmente tuyo una vez que la Operación Renta cobre las cotizaciones.
 *
 * La retención no es un impuesto perdido: financia tus cotizaciones y el
 * eventual impuesto. Pero para efectos de flujo de caja mensual, no la tienes.
 */
export function liquidoHonorarios({ brutoMensual, anio = new Date().getFullYear() }) {
  const tasaRetencion = retencionDelAnio(anio);
  const retenido = brutoMensual * tasaRetencion;
  const liquidoRecibido = brutoMensual - retenido;

  // Cotizaciones obligatorias: se calculan sobre el 80% del bruto.
  const baseCotizable = brutoMensual * COTIZACIONES_INDEPENDIENTE.baseImponible;
  const cotizaciones = baseCotizable * COTIZACIONES_INDEPENDIENTE.tasaTotalAproximada;

  return {
    brutoMensual,
    tasaRetencion,
    retenido,
    liquidoRecibido,
    cotizacionesEstimadas: cotizaciones,
    // Lo que queda si además provisionas las cotizaciones mes a mes.
    disponibleRealMensual: liquidoRecibido - Math.max(0, cotizaciones - retenido),
  };
}

/**
 * Proyecta cómo cambia tu líquido a medida que sube la retención hasta 2028.
 * Facturas lo mismo y recibes menos: conviene verlo antes de comprometerte a
 * un dividendo por 25 años.
 */
export function proyectarRetencion({ brutoMensual, desdeAnio = 2026, hastaAnio = 2028 }) {
  const filas = [];
  for (let anio = desdeAnio; anio <= hastaAnio; anio++) {
    const l = liquidoHonorarios({ brutoMensual, anio });
    filas.push({
      anio,
      tasaRetencion: l.tasaRetencion,
      liquidoRecibido: l.liquidoRecibido,
    });
  }
  const primero = filas[0];
  const ultimo = filas[filas.length - 1];
  return {
    filas,
    caidaLiquidaMensual: primero.liquidoRecibido - ultimo.liquidoRecibido,
  };
}

/**
 * Estadística de tus boletas reales.
 *
 * El promedio no basta: lo que te quiebra no es el mes promedio sino la racha
 * mala. Por eso se calcula el peor trimestre efectivo y la dispersión.
 *
 * @param {number[]} boletas montos mensuales, del más antiguo al más reciente
 */
export function analizarBoletas(boletas) {
  const datos = (boletas || []).filter((x) => typeof x === 'number' && !Number.isNaN(x));
  if (datos.length === 0) return null;

  const n = datos.length;
  const suma = datos.reduce((a, b) => a + b, 0);
  const promedio = suma / n;

  const ordenados = [...datos].sort((a, b) => a - b);
  const mediana = n % 2
    ? ordenados[(n - 1) / 2]
    : (ordenados[n / 2 - 1] + ordenados[n / 2]) / 2;

  const varianza = datos.reduce((a, x) => a + (x - promedio) ** 2, 0) / n;
  const desviacion = Math.sqrt(varianza);
  const coefVariacion = promedio > 0 ? desviacion / promedio : 0;

  // Peor y mejor ventana de 3 meses consecutivos.
  let peorTrimestre = Infinity;
  let mejorTrimestre = -Infinity;
  if (n >= 3) {
    for (let k = 0; k + 3 <= n; k++) {
      const s = datos[k] + datos[k + 1] + datos[k + 2];
      peorTrimestre = Math.min(peorTrimestre, s);
      mejorTrimestre = Math.max(mejorTrimestre, s);
    }
  } else {
    peorTrimestre = suma * (3 / n);
    mejorTrimestre = suma * (3 / n);
  }

  return {
    meses: n,
    promedio,
    mediana,
    minimo: ordenados[0],
    maximo: ordenados[n - 1],
    desviacion,
    coefVariacion,
    mesesEnCero: datos.filter((x) => x === 0).length,
    peorTrimestrePromedioMensual: peorTrimestre / 3,
    mejorTrimestrePromedioMensual: mejorTrimestre / 3,
    // Cuánto cae tu peor racha respecto del promedio.
    caidaPeorTrimestre: promedio > 0 ? 1 - (peorTrimestre / 3) / promedio : 0,
  };
}

/**
 * Meses de dividendo que conviene tener guardados antes de firmar.
 *
 * Regla de oficio, no de ley: 6 meses de piso, y sube con la volatilidad
 * medida de tus ingresos. Un dependiente estable está bien con 6; un freelance
 * con ingresos que varían mucho necesita más cerca de 12–18.
 */
export function colchonRecomendado({ modalidad, coefVariacion = 0 }) {
  if (modalidad === 'dependiente') return 6;
  const meses = Math.round(6 + 24 * coefVariacion);
  return Math.min(18, Math.max(6, meses));
}

/**
 * Renta que el banco te va a reconocer.
 *
 * @param {Object} p
 * @param {'dependiente'|'honorarios'|'mixto'|'socio'} p.modalidad
 * @param {number} [p.sueldoLiquidoMensual] para dependiente y mixto
 * @param {number} [p.promedioBoletasMensual] promedio de tus boletas, bruto
 * @param {number} [p.rentaLiquidaF22Anual] renta líquida de tu Formulario 22
 * @param {number} [p.retirosMensuales] para socio de empresa
 * @param {number} [p.factorCastigo] cuánto reconoce el banco de lo variable
 */
export function rentaAcreditable({
  modalidad,
  sueldoLiquidoMensual = 0,
  promedioBoletasMensual = 0,
  rentaLiquidaF22Anual = 0,
  retirosMensuales = 0,
  factorCastigo = EVALUACION_BANCARIA.factorCastigoHonorarios,
}) {
  const detalle = [];

  if (modalidad === 'dependiente') {
    detalle.push({ concepto: 'Sueldo líquido', monto: sueldoLiquidoMensual, castigo: 1 });
    return {
      total: sueldoLiquidoMensual,
      detalle,
      nota: 'Con contrato y liquidaciones, el banco reconoce tu líquido completo.',
    };
  }

  // Para lo variable, el banco cruza el promedio de boletas contra tu F22 y se
  // queda con el menor de los dos. Después le aplica su castigo.
  const baseF22 = rentaLiquidaF22Anual > 0 ? rentaLiquidaF22Anual / 12 : Infinity;
  const baseVariable = Math.min(
    promedioBoletasMensual || Infinity,
    modalidad === 'socio' ? (retirosMensuales || Infinity) : Infinity,
    baseF22,
  );
  const variable = Number.isFinite(baseVariable) ? baseVariable : 0;
  const variableCastigada = variable * factorCastigo;

  if (modalidad === 'mixto' && sueldoLiquidoMensual > 0) {
    detalle.push({ concepto: 'Sueldo líquido', monto: sueldoLiquidoMensual, castigo: 1 });
  }
  detalle.push({
    concepto: modalidad === 'socio' ? 'Retiros de la empresa' : 'Honorarios',
    monto: variable,
    castigo: factorCastigo,
    montoReconocido: variableCastigada,
  });

  const total = (modalidad === 'mixto' ? sueldoLiquidoMensual : 0) + variableCastigada;

  return {
    total,
    detalle,
    baseAntesDeCastigo: variable,
    factorCastigo,
    limitadoPorF22: Number.isFinite(baseF22) && baseF22 < (promedioBoletasMensual || Infinity),
    nota: Number.isFinite(baseF22) && baseF22 < (promedioBoletasMensual || Infinity)
      ? 'Tu F22 declara menos que tu promedio de boletas, así que el banco usará el F22. Es el caso típico cuando descuentas gastos.'
      : `El banco reconoce ${cl(factorCastigo * 100, 0)}% de tus ingresos variables.`,
  };
}

/**
 * Dividendo máximo que soportas y, con eso, la carga financiera resultante.
 *
 * @param {Object} p
 * @param {number} p.rentaAcreditableMensual
 * @param {number} [p.otrasDeudasMensuales] cuotas de otros créditos y tarjetas
 * @param {number} [p.cargaMaxima] fracción de la renta, por defecto 25%
 */
export function capacidadDePago({
  rentaAcreditableMensual,
  otrasDeudasMensuales = 0,
  cargaMaxima = EVALUACION_BANCARIA.cargaFinancieraMaxima,
}) {
  const cupoTotal = rentaAcreditableMensual * cargaMaxima;
  const dividendoMaximo = Math.max(0, cupoTotal - otrasDeudasMensuales);
  return {
    cupoTotal,
    otrasDeudasMensuales,
    dividendoMaximo,
    cargaMaxima,
    consumidoPorOtrasDeudas: cupoTotal > 0 ? otrasDeudasMensuales / cupoTotal : 0,
  };
}

/** Carga financiera efectiva de un dividendo concreto. */
export function cargaFinanciera({ dividendoMensual, otrasDeudasMensuales = 0, rentaAcreditableMensual }) {
  if (!rentaAcreditableMensual) return { valor: null, semaforo: 'sin-dato' };
  const valor = (dividendoMensual + otrasDeudasMensuales) / rentaAcreditableMensual;
  const semaforo = valor <= 0.25 ? 'verde' : valor <= 0.32 ? 'ambar' : 'rojo';
  return {
    valor,
    semaforo,
    mensaje:
      semaforo === 'verde'
        ? 'Dentro de lo que los bancos aceptan sin problema.'
        : semaforo === 'ambar'
          ? 'En el límite. Algunos bancos lo aprueban, otros no, y te deja poco margen.'
          : 'Sobre lo que los bancos suelen aceptar, y sobre lo que es prudente.',
  };
}

/**
 * Prueba de estrés: qué pasa si tus ingresos caen.
 *
 * Para un dependiente esto es hipotético. Para un freelance es martes.
 * Se prueban dos escenarios: una caída porcentual que tú eliges, y tu peor
 * trimestre real medido de tus propias boletas.
 */
export function pruebaDeEstres({
  dividendoMensual,
  otrasDeudasMensuales = 0,
  rentaAcreditableMensual,
  ingresoRealMensual,
  caidaPorcentual = 0.30,
  mesesDeCaida = 6,
  ahorroLiquidoUF = 0,
  peorTrimestrePromedioMensual = null,
}) {
  const compromisoMensual = dividendoMensual + otrasDeudasMensuales;
  const base = ingresoRealMensual || rentaAcreditableMensual;

  const escenario = (nombre, ingresoEstresado, descripcion) => {
    const deficitMensual = Math.max(0, compromisoMensual - ingresoEstresado);
    const deficitTotal = deficitMensual * mesesDeCaida;
    const mesesQueAguanta = deficitMensual > 0
      ? ahorroLiquidoUF / deficitMensual
      : Infinity;
    return {
      nombre,
      descripcion,
      ingresoEstresado,
      cargaFinanciera: ingresoEstresado > 0 ? compromisoMensual / ingresoEstresado : Infinity,
      deficitMensual,
      deficitTotal,
      mesesQueAguanta,
      sobrevive: deficitMensual === 0 || mesesQueAguanta >= mesesDeCaida,
    };
  };

  const escenarios = [
    escenario(
      `Caída de ${cl(caidaPorcentual * 100, 0)}%`,
      base * (1 - caidaPorcentual),
      `Tus ingresos caen ${cl(caidaPorcentual * 100, 0)}% durante ${mesesDeCaida} meses.`,
    ),
  ];

  if (peorTrimestrePromedioMensual != null) {
    escenarios.push(
      escenario(
        'Tu peor trimestre real',
        peorTrimestrePromedioMensual,
        'Se repite la peor racha de 3 meses que tuviste en las boletas que cargaste.',
      ),
    );
  }

  return {
    compromisoMensual,
    escenarios,
    sobreviveTodo: escenarios.every((e) => e.sobrevive),
  };
}

/** Checklist documental, marcando lo que ya tienes resuelto. */
export function checklistIndependiente(perfil = {}) {
  return REQUISITOS_INDEPENDIENTE.map((r, idx) => ({
    ...r,
    cumplido: Array.isArray(perfil.cumplidos) ? perfil.cumplidos.includes(idx) : false,
  }));
}
