import test from 'node:test';
import assert from 'node:assert/strict';
import {
  metricasInversion, proyectarInversion, puntosDeEquilibrio,
  plusvaliaMinimaParaTIR, compararComprarVsArrendar,
} from '../src/engine/inversion.js';
import { calcularCredito } from '../src/engine/credito.js';
import { SUPUESTOS } from '../src/engine/parametros.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

const credito = calcularCredito({
  precioUF: 3200, piePorcentaje: 0.20, tasaAnual: 0.042, plazoAnios: 25,
  convencionTasa: 'nominal', tasaDesgravamenMensual: 0.00025, tasaIncendioSismoMensual: 0.00022,
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
});

const servicioDeudaAnio1 = credito.filas.slice(0, 12).reduce((a, f) => a + f.dividendoUF, 0);

const metricasBase = (over = {}) => metricasInversion({
  precioUF: 3200,
  gastosCompraUF: credito.gastosOperacionales.totalUF,
  pieUF: 640,
  arriendoMensualUF: 13,
  vacanciaAnual: 1 / 12,
  gastosComunesMensualesUF: 1.5,
  contribucionesAnualesUF: 4,
  tasaAdministracion: 0.07,
  tasaMantencion: 0.05,
  servicioDeudaAnualUF: servicioDeudaAnio1,
  ...over,
});

test('el cap rate bruto es el arriendo anual sobre la inversión total', () => {
  const m = metricasBase();
  cerca(m.arriendoBrutoAnualUF, 156);
  cerca(m.capRateBruto, 156 / m.precioTotalUF, 1e-9);
  // Un depto típico en Santiago renta entre 3% y 6% bruto.
  assert.ok(m.capRateBruto > 0.03 && m.capRateBruto < 0.08, `cap rate bruto raro: ${m.capRateBruto}`);
});

test('el cap rate neto siempre es menor que el bruto', () => {
  const m = metricasBase();
  assert.ok(m.capRateNeto < m.capRateBruto);
  assert.ok(m.noiUF < m.arriendoBrutoAnualUF);
});

test('la vacancia reduce el ingreso efectivo de forma proporcional', () => {
  const sinVacancia = metricasBase({ vacanciaAnual: 0 });
  const conVacancia = metricasBase({ vacanciaAnual: 1 / 12 });
  cerca(sinVacancia.ingresoEfectivoAnualUF, 156);
  cerca(conVacancia.ingresoEfectivoAnualUF, 156 * (11 / 12), 1e-9);
});

test('el flujo mensual negativo se detecta: el arriendo no cubre el dividendo', () => {
  const m = metricasBase({ arriendoMensualUF: 13 });
  // Dividendo ~15,1 UF contra arriendo de 13 UF: el flujo tiene que ser negativo.
  assert.ok(m.flujoMensualUF < 0, `flujo ${m.flujoMensualUF} debería ser negativo`);
  assert.ok(m.cashOnCash < 0);
});

test('con arriendo suficientemente alto el flujo se vuelve positivo', () => {
  const m = metricasBase({ arriendoMensualUF: 22 });
  assert.ok(m.flujoMensualUF > 0);
  assert.ok(m.cashOnCash > 0);
});

test('el desglose de gastos operativos suma el total', () => {
  const m = metricasBase();
  const suma = Object.values(m.desgloseGastos).reduce((a, b) => a + b, 0);
  cerca(suma, m.gastosOperativosAnualUF, 1e-9);
});

test('el punto de equilibrio del arriendo es consistente: ahí el flujo es cero', () => {
  const params = { vacanciaAnual: 1 / 12, tasaAdministracion: 0.07, tasaMantencion: 0.05 };
  const m = metricasBase(params);
  const eq = puntosDeEquilibrio({ metricas: m, servicioDeudaAnualUF: servicioDeudaAnio1, ...params });
  // Recalcular con el arriendo de equilibrio debe dar flujo cero.
  const enEquilibrio = metricasBase({ ...params, arriendoMensualUF: eq.arriendoMensualEquilibrioUF });
  cerca(enEquilibrio.flujoAntesDeImpuestoUF, 0, 1e-6);
});

test('la holgura es la distancia entre tu arriendo y el de equilibrio', () => {
  const params = { vacanciaAnual: 1 / 12, tasaAdministracion: 0.07, tasaMantencion: 0.05 };
  const m = metricasBase(params);
  const eq = puntosDeEquilibrio({ metricas: m, servicioDeudaAnualUF: servicioDeudaAnio1, ...params });
  cerca(eq.holguraUF, 13 - eq.arriendoMensualEquilibrioUF, 1e-9);
  assert.ok(eq.holguraUF < 0, 'con arriendo de 13 UF debería faltar para el equilibrio');
});

const proyectar = (plusvalia, anios = 10) => proyectarInversion({
  filas: credito.filas,
  precioUF: 3200,
  capitalInvertidoUF: 640 + credito.gastosOperacionales.totalUF,
  aniosProyeccion: anios,
  plusvaliaAnualReal: plusvalia,
  crecimientoArriendoAnualReal: 0.01,
  metricasDelAnio: (anio, servicioDeudaAnualUF, factorArriendo) => metricasInversion({
    precioUF: 3200,
    gastosCompraUF: credito.gastosOperacionales.totalUF,
    pieUF: 640,
    arriendoMensualUF: 13 * factorArriendo,
    vacanciaAnual: 1 / 12,
    gastosComunesMensualesUF: 1.5,
    contribucionesAnualesUF: 4,
    tasaAdministracion: 0.07,
    tasaMantencion: 0.05,
    servicioDeudaAnualUF,
  }),
});

test('la proyección arma bien los flujos: uno inicial negativo más un año por período', () => {
  const p = proyectar(0.02);
  assert.equal(p.flujos.length, 11);
  assert.ok(p.flujos[0] < 0, 'el capital invertido va con signo negativo');
  assert.equal(p.detalle.length, 10);
});

test('la venta solo ocurre en el último año de la proyección', () => {
  const p = proyectar(0.02);
  assert.equal(p.detalle[0].venta, null);
  assert.ok(p.detalle[9].venta !== null);
  assert.ok(p.detalle[9].flujoTotalUF > p.detalle[9].flujoOperacionalUF);
});

test('la venta descuenta comisión, deuda e impuesto a la ganancia', () => {
  const p = proyectar(0.03);
  const v = p.detalle[9].venta;
  cerca(v.precioVentaUF, 3200 * Math.pow(1.03, 10), 1e-6);
  cerca(v.comisionUF, v.precioVentaUF * 0.02, 1e-9);
  assert.ok(v.saldoInsolutoUF > 0, 'a los 10 años todavía queda deuda');
  cerca(v.netoVentaUF, v.precioVentaUF - v.comisionUF - v.saldoInsolutoUF - v.impuestoUF, 1e-9);
  // La ganancia de 10 años queda muy bajo la exención de 8.000 UF.
  cerca(v.impuestoUF, 0);
});

test('más plusvalía significa más TIR', () => {
  const baja = proyectar(0.00);
  const alta = proyectar(0.04);
  assert.ok(alta.tirAnual > baja.tirAnual, 'la TIR debería subir con la plusvalía');
});

test('la plusvalía mínima para una TIR objetivo devuelve exactamente esa TIR', () => {
  const objetivo = 0.05;
  const g = plusvaliaMinimaParaTIR({ tirObjetivo: objetivo, proyectar: (x) => proyectar(x) });
  assert.ok(g !== null, 'debería encontrar una plusvalía que alcance el objetivo');
  cerca(proyectar(g).tirAnual, objetivo, 1e-4);
});

test('comprar vs arrendar: con arriendo caro y buena plusvalía, comprar gana', () => {
  const r = compararComprarVsArrendar({
    filas: credito.filas,
    precioUF: 3200,
    capitalInicialUF: 640 + credito.gastosOperacionales.totalUF,
    arriendoEquivalenteMensualUF: 14,
    costosPropietarioMensualesUF: 2,
    plusvaliaAnualReal: 0.03,
    rendimientoAlternativoAnualReal: 0.02,
    aniosProyeccion: 20,
  });
  assert.equal(r.serie.length, 20);
  assert.equal(r.ganadorAlFinal, 'comprar');
  assert.ok(r.diferenciaFinalUF > 0);
});

test('comprar vs arrendar: con arriendo barato y alternativa rentable, arrendar gana', () => {
  const r = compararComprarVsArrendar({
    filas: credito.filas,
    precioUF: 3200,
    capitalInicialUF: 640 + credito.gastosOperacionales.totalUF,
    arriendoEquivalenteMensualUF: 8,
    costosPropietarioMensualesUF: 2,
    plusvaliaAnualReal: 0.00,
    rendimientoAlternativoAnualReal: 0.06,
    aniosProyeccion: 20,
  });
  assert.equal(r.ganadorAlFinal, 'arrendar');
  assert.ok(r.diferenciaFinalUF < 0);
});

test('comprar vs arrendar: el patrimonio del comprador refleja deuda y plusvalía', () => {
  const r = compararComprarVsArrendar({
    filas: credito.filas,
    precioUF: 3200,
    capitalInicialUF: 640,
    arriendoEquivalenteMensualUF: 14,
    plusvaliaAnualReal: 0.02,
    aniosProyeccion: 10,
  });
  const a10 = r.serie[9];
  cerca(a10.valorPropiedadUF, 3200 * Math.pow(1.02, 10), 1);
  cerca(a10.patrimonioComprarUF, a10.valorPropiedadUF * 0.98 - a10.saldoDeudaUF, 1e-6);
  // La deuda va bajando año a año.
  assert.ok(a10.saldoDeudaUF < r.serie[0].saldoDeudaUF);
});

test('comprar vs arrendar: el arriendo sube con los años', () => {
  const r = compararComprarVsArrendar({
    filas: credito.filas,
    precioUF: 3200,
    capitalInicialUF: 640,
    arriendoEquivalenteMensualUF: 14,
    crecimientoArriendoAnualReal: 0.02,
    aniosProyeccion: 10,
  });
  assert.ok(r.serie[9].arriendoMensualUF > r.serie[0].arriendoMensualUF);
});
