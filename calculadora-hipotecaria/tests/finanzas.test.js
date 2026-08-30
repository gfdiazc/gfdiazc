import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tasaMensual, cuotaFrancesa, capitalDesdeCuota, tablaAmortizacion,
  van, tir, anualizar, cae, acotar,
} from '../src/engine/finanzas.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a} (dif ${Math.abs(a - b)})`);

test('tasaMensual: nominal divide por 12, efectiva compone', () => {
  cerca(tasaMensual(0.042, 'nominal'), 0.0035);
  cerca(tasaMensual(0.042, 'efectiva'), Math.pow(1.042, 1 / 12) - 1);
  // La efectiva siempre es menor que la nominal para tasas positivas.
  assert.ok(tasaMensual(0.042, 'efectiva') < tasaMensual(0.042, 'nominal'));
});

test('cuotaFrancesa: caso base UF 2.560 a 4,2% por 25 años', () => {
  const cuota = cuotaFrancesa(2560, 0.042 / 12, 300);
  cerca(cuota, 13.797, 0.001);
});

test('cuotaFrancesa: con tasa cero la cuota es capital/n', () => {
  cerca(cuotaFrancesa(1200, 0, 12), 100);
});

test('capitalDesdeCuota es la inversa exacta de cuotaFrancesa', () => {
  const i = 0.042 / 12;
  const cuota = cuotaFrancesa(2560, i, 300);
  cerca(capitalDesdeCuota(cuota, i, 300), 2560, 1e-9);
});

test('tablaAmortizacion: la suma de amortizaciones iguala el capital', () => {
  const { filas } = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300 });
  const suma = filas.reduce((a, f) => a + f.amortizacion + f.abonoExtra, 0);
  cerca(suma, 2560, 1e-6);
});

test('tablaAmortizacion: el saldo final es cero y el plazo se respeta', () => {
  const { filas, meses } = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300 });
  assert.equal(meses, 300);
  cerca(filas[filas.length - 1].saldo, 0, 1e-9);
});

test('tablaAmortizacion: el interés total es la diferencia entre lo pagado y el capital', () => {
  const r = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300 });
  cerca(r.totalPagado - 2560, r.totalInteres, 1e-6);
});

test('tablaAmortizacion: al principio se paga más interés que capital', () => {
  const { filas } = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300 });
  assert.ok(filas[0].interes > filas[0].amortizacion);
  assert.ok(filas[299].interes < filas[299].amortizacion);
});

test('abono mensual en modo plazo acorta el crédito y ahorra intereses', () => {
  const base = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300 });
  const conAbono = tablaAmortizacion({ capital: 2560, i: 0.042 / 12, n: 300, abonoMensual: 2 });
  assert.ok(conAbono.meses < base.meses, 'debería terminar antes');
  assert.ok(conAbono.totalInteres < base.totalInteres, 'debería pagar menos interés');
  const suma = conAbono.filas.reduce((a, f) => a + f.amortizacion + f.abonoExtra, 0);
  cerca(suma, 2560, 1e-6);
});

test('abono en modo cuota mantiene el plazo pero baja el dividendo', () => {
  const r = tablaAmortizacion({
    capital: 2560, i: 0.042 / 12, n: 300, abonoAnual: 20, modoAbono: 'cuota',
  });
  assert.ok(r.filas[290].cuota < r.filas[0].cuota, 'la cuota debería ir bajando');
  cerca(r.filas[r.filas.length - 1].saldo, 0, 1e-6);
});

test('van y tir son consistentes: la TIR anula el VAN', () => {
  const flujos = [-1000, 300, 400, 500];
  const r = tir(flujos);
  assert.ok(r !== null);
  cerca(van(flujos, r), 0, 1e-6);
});

test('la TIR del flujo de un crédito reproduce su propia tasa', () => {
  const i = 0.042 / 12;
  const cuota = cuotaFrancesa(2560, i, 300);
  const flujos = [2560, ...Array(300).fill(-cuota)];
  cerca(tir(flujos), i, 1e-8);
});

test('tir devuelve null si los flujos no cambian de signo', () => {
  assert.equal(tir([100, 200, 300]), null);
  assert.equal(tir([-100, -200]), null);
});

test('CAE es mayor que la tasa nominal cuando hay seguros y gastos', () => {
  const i = 0.042 / 12;
  const cuota = cuotaFrancesa(2560, i, 300);
  const dividendos = Array(300).fill(cuota + 0.9); // seguros
  const r = cae(2560, 40, dividendos);
  assert.ok(r !== null);
  assert.ok(r > 0.042, `CAE ${r} debería superar la tasa nominal 0.042`);
});

test('CAE sin seguros ni gastos coincide con la tasa anualizada del crédito', () => {
  const i = 0.042 / 12;
  const cuota = cuotaFrancesa(2560, i, 300);
  const r = cae(2560, 0, Array(300).fill(cuota));
  cerca(r, anualizar(i), 1e-7);
});

test('acotar respeta los límites', () => {
  assert.equal(acotar(5, 0, 1), 1);
  assert.equal(acotar(-5, 0, 1), 0);
  assert.equal(acotar(0.5, 0, 1), 0.5);
});

test('cl() usa la convención chilena: coma decimal y punto de miles', async () => {
  const { cl } = await import('../src/engine/finanzas.js');
  assert.equal(cl(1.66, 2), '1,66');
  assert.equal(cl(3539, 0), '3.539');
  assert.equal(cl(0.2, 1), '0,2');
  assert.equal(cl(1234567.891, 2), '1.234.567,89');
  assert.equal(cl(null), '—');
  assert.equal(cl(Infinity), '—');
});
