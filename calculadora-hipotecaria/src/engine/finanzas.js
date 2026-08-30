/**
 * Primitivas financieras. Todo en UF y en períodos mensuales.
 * Sin dependencias, sin DOM: este archivo se puede testear solo.
 */

/**
 * Convierte una tasa anual a mensual.
 *
 * La convención importa y es la causa habitual de que dos simuladores den
 * números distintos para el mismo crédito. En los mutuos hipotecarios chilenos
 * la práctica es dividir la tasa anual por 12 ("nominal"). La conversión
 * financieramente exacta es la "efectiva". A 25 años la diferencia no es menor,
 * así que la app deja elegir y muestra cuál está usando.
 *
 * @param {number} tasaAnual fracción, p.ej. 0.042
 * @param {'nominal'|'efectiva'} [convencion='nominal']
 */
export function tasaMensual(tasaAnual, convencion = 'nominal') {
  if (convencion === 'efectiva') return Math.pow(1 + tasaAnual, 1 / 12) - 1;
  return tasaAnual / 12;
}

/**
 * Cuota de un crédito con amortización francesa (cuota constante).
 *   C = P·i / (1 − (1+i)^−n)
 * @param {number} capital
 * @param {number} i tasa del período
 * @param {number} n número de períodos
 */
export function cuotaFrancesa(capital, i, n) {
  if (n <= 0) throw new Error('El plazo debe ser mayor que cero.');
  if (capital <= 0) return 0;
  if (i === 0) return capital / n;
  return (capital * i) / (1 - Math.pow(1 + i, -n));
}

/**
 * Capital que puedes pedir dado el máximo que puedes pagar por mes.
 * Es la inversa exacta de cuotaFrancesa.
 */
export function capitalDesdeCuota(cuota, i, n) {
  if (n <= 0) return 0;
  if (cuota <= 0) return 0;
  if (i === 0) return cuota * n;
  return (cuota * (1 - Math.pow(1 + i, -n))) / i;
}

/**
 * @typedef {Object} FilaAmortizacion
 * @property {number} mes 1..n
 * @property {number} cuota
 * @property {number} interes
 * @property {number} amortizacion
 * @property {number} saldo saldo insoluto al cierre del mes
 * @property {number} abonoExtra
 */

/**
 * Tabla de amortización mes a mes, con soporte para abonos extraordinarios.
 *
 * @param {Object} p
 * @param {number} p.capital
 * @param {number} p.i tasa mensual
 * @param {number} p.n plazo en meses
 * @param {number} [p.abonoMensual] abono extra a capital, todos los meses
 * @param {number} [p.abonoAnual] abono extra a capital, una vez al año
 * @param {number} [p.mesAbonoAnual=12] mes del año en que cae el abono anual
 * @param {'plazo'|'cuota'} [p.modoAbono='plazo'] reducir plazo o recalcular cuota
 * @returns {{filas: FilaAmortizacion[], totalInteres: number, totalPagado: number, meses: number}}
 */
export function tablaAmortizacion({
  capital,
  i,
  n,
  abonoMensual = 0,
  abonoAnual = 0,
  mesAbonoAnual = 12,
  modoAbono = 'plazo',
}) {
  const filas = [];
  let saldo = capital;
  let cuota = cuotaFrancesa(capital, i, n);
  let totalInteres = 0;
  let totalPagado = 0;

  for (let mes = 1; mes <= n && saldo > 1e-9; mes++) {
    const interes = saldo * i;
    let amortizacion = cuota - interes;

    // Si la cuota no alcanza a cubrir el interés el crédito nunca se paga.
    if (amortizacion <= 0 && abonoMensual <= 0 && abonoAnual <= 0) {
      throw new Error('La cuota no cubre el interés: el crédito no se amortiza.');
    }

    let extra = abonoMensual;
    if (abonoAnual > 0 && mes % 12 === mesAbonoAnual % 12) extra += abonoAnual;

    // Última cuota: nunca pagar más que el saldo.
    if (amortizacion + extra >= saldo) {
      amortizacion = Math.min(amortizacion, saldo);
      extra = Math.max(0, saldo - amortizacion);
    }

    const pagado = interes + amortizacion + extra;
    saldo = saldo - amortizacion - extra;
    if (Math.abs(saldo) < 1e-9) saldo = 0;

    totalInteres += interes;
    totalPagado += pagado;
    filas.push({ mes, cuota: interes + amortizacion, interes, amortizacion, saldo, abonoExtra: extra });

    // En modo "reducir cuota" el abono baja el dividendo y deja el plazo igual.
    if (modoAbono === 'cuota' && extra > 0 && saldo > 0) {
      cuota = cuotaFrancesa(saldo, i, n - mes);
    }
  }

  return { filas, totalInteres, totalPagado, meses: filas.length };
}

/** Valor actual neto de una serie de flujos, con el flujo 0 en t=0. */
export function van(flujos, tasa) {
  let acc = 0;
  for (let t = 0; t < flujos.length; t++) acc += flujos[t] / Math.pow(1 + tasa, t);
  return acc;
}

/**
 * Tasa interna de retorno por período.
 *
 * Bisección sobre un intervalo con cambio de signo: más lenta que
 * Newton-Raphson pero converge siempre, que es lo que quieres cuando el
 * resultado va a orientar una decisión de 25 años. Devuelve null si los flujos
 * no tienen solución (por ejemplo, si nunca cambian de signo).
 *
 * @param {number[]} flujos
 * @param {number} [tolerancia=1e-9]
 * @returns {number|null}
 */
export function tir(flujos, tolerancia = 1e-9) {
  const tieneNegativo = flujos.some((f) => f < 0);
  const tienePositivo = flujos.some((f) => f > 0);
  if (!tieneNegativo || !tienePositivo) return null;

  let lo = -0.9999;
  let hi = 1;
  let vLo = van(flujos, lo);
  let vHi = van(flujos, hi);

  // Ensanchar el extremo superior hasta encontrar cambio de signo.
  let intentos = 0;
  while (vLo * vHi > 0 && intentos < 200) {
    hi *= 2;
    vHi = van(flujos, hi);
    intentos++;
  }
  if (vLo * vHi > 0) return null;

  // Dos tolerancias distintas: una sobre el valor del VAN y otra, mucho más
  // fina, sobre el ancho del intervalo. Si se cortara por el ancho con la misma
  // tolerancia, en flujos grandes el VAN residual quedaría varios órdenes de
  // magnitud por encima de lo pedido.
  const tolIntervalo = 1e-13;
  for (let k = 0; k < 300; k++) {
    const mid = (lo + hi) / 2;
    const vMid = van(flujos, mid);
    if (Math.abs(vMid) < tolerancia || (hi - lo) / 2 < tolIntervalo) return mid;
    if (vLo * vMid < 0) {
      hi = mid;
      vHi = vMid;
    } else {
      lo = mid;
      vLo = vMid;
    }
  }
  return (lo + hi) / 2;
}

/** Anualiza una tasa mensual de forma compuesta. */
export function anualizar(tasaMes) {
  return Math.pow(1 + tasaMes, 12) - 1;
}

/**
 * Carga Anual Equivalente.
 *
 * Es la TIR del flujo que realmente vives: recibes el crédito menos los gastos
 * que te cobran al firmar, y pagas el dividendo completo (cuota + seguros +
 * comisiones). Por construcción siempre es mayor que la tasa nominal cuando hay
 * seguros o gastos, y es la única cifra que permite comparar dos ofertas de
 * bancos distintos de manera justa.
 *
 * @param {number} montoCredito
 * @param {number} gastosIniciales descontados del neto recibido
 * @param {number[]} dividendos pagos mensuales, mes 1 en adelante
 * @returns {number|null} tasa anual
 */
export function cae(montoCredito, gastosIniciales, dividendos) {
  const flujos = [montoCredito - gastosIniciales, ...dividendos.map((d) => -d)];
  const mensual = tir(flujos);
  return mensual === null ? null : anualizar(mensual);
}

/** Redondeo a n decimales, evitando el ruido binario del punto flotante. */
export function redondear(x, decimales = 2) {
  const f = Math.pow(10, decimales);
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Acota un número a un intervalo. */
export function acotar(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

/**
 * Formato numérico chileno: coma decimal y punto de miles.
 *
 * Vive en el motor y no en la interfaz porque varias funciones devuelven textos
 * ya redactados para leer, y "UF 1.66" en vez de "UF 1,66" delata que el número
 * lo escribió una máquina que no piensa en español.
 */
export function cl(x, decimales = 0) {
  if (x == null || !Number.isFinite(x)) return '—';
  return x.toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
