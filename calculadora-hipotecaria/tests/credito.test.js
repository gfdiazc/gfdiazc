import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCredito, calcularGastosOperacionales, capacidadDeCompra } from '../src/engine/credito.js';
import { valoresPorDefecto, SUPUESTOS } from '../src/engine/parametros.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a} (dif ${Math.abs(a - b)})`);

const gastosPorDefecto = () => ({
  tasacionUF: SUPUESTOS.tasacionUF.valor,
  estudioTitulosUF: SUPUESTOS.estudioTitulosUF.valor,
  notariaUF: SUPUESTOS.notariaUF.valor,
  gastosNotarialesCompraventaUF: SUPUESTOS.gastosNotarialesCompraventaUF.valor,
  tasaConservador: SUPUESTOS.tasaConservador.valor,
  topeConservadorUF: SUPUESTOS.topeConservadorUF.valor,
  tasaImpuestoMutuo: SUPUESTOS.tasaImpuestoMutuo.valor,
  tasaImpuestoMutuoDFL2: SUPUESTOS.tasaImpuestoMutuoDFL2.valor,
});

const casoBase = (over = {}) => ({
  precioUF: 3200,
  piePorcentaje: 0.20,
  tasaAnual: 0.042,
  plazoAnios: 25,
  convencionTasa: 'nominal',
  tasaDesgravamenMensual: 0.00025,
  tasaIncendioSismoMensual: 0.00022,
  comisionAdminMensualUF: 0,
  esDFL2: false,
  esViviendaSocial: false,
  financiarGastos: false,
  gastos: gastosPorDefecto(),
  ...over,
});

test('caso base: crédito, cuota pelada y dividendo del primer mes', () => {
  const r = calcularCredito(casoBase());
  cerca(r.pieUF, 640);
  cerca(r.montoCreditoUF, 2560);
  cerca(r.ltv, 0.8);
  cerca(r.cuotaUF, 13.797, 0.001);
  // Dividendo mes 1 = cuota + desgravamen sobre 2560 + incendio sobre 3200
  cerca(r.dividendoPrimerMesUF, 13.797 + 0.64 + 0.704, 0.001);
});

test('el dividendo baja con los años porque el desgravamen sigue al saldo', () => {
  const r = calcularCredito(casoBase());
  assert.ok(r.dividendoUltimoMesUF < r.dividendoPrimerMesUF);
  // El incendio es fijo, así que el dividendo nunca baja de cuota + incendio.
  assert.ok(r.dividendoUltimoMesUF > r.cuotaUF);
});

test('el desglose cuadra: interés + capital + seguros = total pagado', () => {
  const r = calcularCredito(casoBase());
  cerca(r.totalInteresUF + r.montoCreditoUF + r.totalSegurosUF, r.totalDesembolsadoUF, 1e-6);
});

test('gastos operacionales caen en el rango de mercado y no disparan alerta', () => {
  const r = calcularCredito(casoBase());
  const p = r.gastosOperacionales.porcentajeDelCredito;
  assert.ok(p > 0.008 && p < 0.025, `gastos ${(p * 100).toFixed(2)}% fuera de rango`);
  assert.equal(r.gastosOperacionales.alerta, null);
});

test('DFL2 baja el impuesto al mutuo de 0,8% a 0,2%', () => {
  const normal = calcularCredito(casoBase());
  const dfl2 = calcularCredito(casoBase({ esDFL2: true }));
  cerca(normal.gastosOperacionales.impuestoMutuoUF, 2560 * 0.008, 1e-6);
  cerca(dfl2.gastosOperacionales.impuestoMutuoUF, 2560 * 0.002, 1e-6);
  assert.ok(dfl2.gastosOperacionales.totalUF < normal.gastosOperacionales.totalUF);
});

test('vivienda social no paga impuesto al mutuo', () => {
  const r = calcularCredito(casoBase({ esViviendaSocial: true }));
  cerca(r.gastosOperacionales.impuestoMutuoUF, 0);
});

test('financiar los gastos resuelve bien la circularidad del impuesto', () => {
  const g = calcularGastosOperacionales({
    precioUF: 3200,
    creditoBaseUF: 2560,
    gastos: gastosPorDefecto(),
    financiarGastos: true,
  });
  // El crédito debe cubrir exactamente la base más todos los gastos.
  cerca(g.montoCreditoUF, 2560 + g.totalUF, 1e-9);
  // Y el impuesto debe estar calculado sobre el crédito final, no el inicial.
  cerca(g.impuestoMutuoUF, g.montoCreditoUF * 0.008, 1e-9);
  cerca(g.desembolsoInicialUF, 0);
});

test('financiar los gastos sube el dividendo pero elimina el desembolso inicial', () => {
  const sin = calcularCredito(casoBase());
  const con = calcularCredito(casoBase({ financiarGastos: true }));
  assert.ok(con.dividendoPrimerMesUF > sin.dividendoPrimerMesUF);
  assert.ok(con.montoCreditoUF > sin.montoCreditoUF);
  cerca(con.gastosOperacionales.desembolsoInicialUF, 0);
});

test('la CAE supera la tasa nominal por los seguros y gastos', () => {
  const r = calcularCredito(casoBase());
  assert.ok(r.caeAnual > 0.042, `CAE ${r.caeAnual} debería superar 4,2%`);
  assert.ok(r.caeAnual < 0.09, 'la CAE no debería dispararse: revisar el cálculo');
});

test('más plazo baja el dividendo pero encarece el crédito total', () => {
  const a20 = calcularCredito(casoBase({ plazoAnios: 20 }));
  const a30 = calcularCredito(casoBase({ plazoAnios: 30 }));
  assert.ok(a30.dividendoPrimerMesUF < a20.dividendoPrimerMesUF);
  assert.ok(a30.totalInteresUF > a20.totalInteresUF);
});

test('la convención de tasa efectiva da una cuota menor que la nominal', () => {
  const nominal = calcularCredito(casoBase());
  const efectiva = calcularCredito(casoBase({ convencionTasa: 'efectiva' }));
  assert.ok(efectiva.cuotaUF < nominal.cuotaUF);
});

test('capacidadDeCompra es coherente con el cálculo directo', () => {
  const cap = capacidadDeCompra({
    dividendoMaximoUF: 15.141,
    tasaAnual: 0.042,
    plazoAnios: 25,
    piePorcentaje: 0.20,
    tasaDesgravamenMensual: 0.00025,
    tasaIncendioSismoMensual: 0.00022,
  });
  // Ida y vuelta: el precio que devuelve debe generar ese mismo dividendo.
  const r = calcularCredito(casoBase({ precioUF: cap.precioMaximoUF }));
  cerca(r.dividendoPrimerMesUF, 15.141, 0.001);
  cerca(cap.pieNecesarioUF, cap.precioMaximoUF * 0.2, 1e-9);
});

test('un dividendo tope imposible devuelve capacidad cero, no un negativo', () => {
  const cap = capacidadDeCompra({
    dividendoMaximoUF: 0,
    tasaAnual: 0.042,
    plazoAnios: 25,
    piePorcentaje: 0.20,
    tasaDesgravamenMensual: 0.00025,
    tasaIncendioSismoMensual: 0.00022,
  });
  assert.equal(cap.creditoMaximoUF, 0);
  assert.equal(cap.precioMaximoUF, 0);
});

test('pagar todo al contado no genera crédito ni impuesto al mutuo', () => {
  const r = calcularCredito(casoBase({ piePorcentaje: 1 }));
  cerca(r.montoCreditoUF, 0);
  cerca(r.gastosOperacionales.impuestoMutuoUF, 0);
});
