import test from 'node:test';
import assert from 'node:assert/strict';
import {
  impuestoGlobalComplementario, rentaImponibleHonorarios, beneficio55bis,
  beneficio55bisPorAnio, evaluarDFL2, impuestoGananciaCapital, contribuciones,
} from '../src/engine/impuestos.js';
import { SUPUESTOS } from '../src/engine/parametros.js';

const UTM = SUPUESTOS.valorUTM.valor; // 71.649
const UTA = UTM * 12;                 // 859.788
const cerca = (a, b, tol = 1) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

test('IGC: bajo 13,5 UTA no se paga impuesto', () => {
  const r = impuestoGlobalComplementario(13 * UTA, UTM);
  cerca(r.impuesto, 0);
  assert.equal(r.tasaMarginal, 0);
});

test('IGC: el impuesto se calcula solo sobre el exceso de cada tramo', () => {
  // 20 UTA: exentas las primeras 13,5; 4% sobre las 6,5 restantes.
  const r = impuestoGlobalComplementario(20 * UTA, UTM);
  cerca(r.impuesto, 6.5 * 0.04 * UTA, 1);
  assert.equal(r.tasaMarginal, 0.04);
});

test('IGC: reproduce las rebajas oficiales de la tabla del SII', () => {
  // La fórmula del SII es renta×factor − rebaja. Si el cálculo por tramos es
  // correcto, la rebaja implícita debe coincidir con la tabla publicada.
  const casos = [
    { uta: 25, factor: 0.04, rebaja: 0.54 },
    { uta: 40, factor: 0.08, rebaja: 1.74 },
    { uta: 60, factor: 0.135, rebaja: 4.49 },
    { uta: 80, factor: 0.23, rebaja: 11.14 },
    { uta: 100, factor: 0.304, rebaja: 17.80 },
    { uta: 200, factor: 0.35, rebaja: 23.32 },
    { uta: 400, factor: 0.40, rebaja: 38.82 },
  ];
  for (const c of casos) {
    const r = impuestoGlobalComplementario(c.uta * UTA, UTM);
    const esperado = (c.uta * c.factor - c.rebaja) * UTA;
    cerca(r.impuesto, esperado, UTA * 0.01);
    assert.equal(r.tasaMarginal, c.factor, `tasa marginal en ${c.uta} UTA`);
  }
});

test('IGC: el impuesto es progresivo y la tasa efectiva nunca supera la marginal', () => {
  const bajo = impuestoGlobalComplementario(40 * UTA, UTM);
  const alto = impuestoGlobalComplementario(200 * UTA, UTM);
  assert.ok(alto.tasaEfectiva > bajo.tasaEfectiva);
  assert.ok(alto.tasaEfectiva < alto.tasaMarginal);
});

test('honorarios: los gastos presuntos tienen tope de 15 UTA', () => {
  // Con 100 UTA de ingresos, el 30% serían 30 UTA, pero el tope es 15.
  const r = rentaImponibleHonorarios({ brutoAnualCLP: 100 * UTA, valorUTM: UTM });
  cerca(r.gastosPresuntos, 15 * UTA, 1);
  assert.equal(r.topeGastosPresuntosAlcanzado, true);
});

test('honorarios: bajo el tope se descuenta el 30% completo', () => {
  const r = rentaImponibleHonorarios({ brutoAnualCLP: 30 * UTA, valorUTM: UTM });
  cerca(r.gastosPresuntos, 30 * UTA * 0.30, 1);
  assert.equal(r.topeGastosPresuntosAlcanzado, false);
});

test('55 bis: bajo 90 UTA la rebaja es completa', () => {
  const r = beneficio55bis({
    interesesAnualesCLP: 3 * UTA,
    rentaBrutaImponibleAnualCLP: 60 * UTA,
    valorUTM: UTM,
  });
  cerca(r.factor, 1, 0.001);
  cerca(r.rebaja, 3 * UTA, 1);
  assert.ok(r.ahorroTributarioAnual > 0);
});

test('55 bis: sobre 150 UTA no hay beneficio', () => {
  const r = beneficio55bis({
    interesesAnualesCLP: 5 * UTA,
    rentaBrutaImponibleAnualCLP: 160 * UTA,
    valorUTM: UTM,
  });
  cerca(r.factor, 0, 0.001);
  cerca(r.rebaja, 0, 1);
  cerca(r.ahorroTributarioAnual, 0, 1);
  assert.equal(r.aplica, false);
});

test('55 bis: entre 90 y 150 UTA la rebaja se degrada de forma lineal', () => {
  const en90 = beneficio55bis({ interesesAnualesCLP: 4 * UTA, rentaBrutaImponibleAnualCLP: 90 * UTA, valorUTM: UTM });
  const en120 = beneficio55bis({ interesesAnualesCLP: 4 * UTA, rentaBrutaImponibleAnualCLP: 120 * UTA, valorUTM: UTM });
  const en150 = beneficio55bis({ interesesAnualesCLP: 4 * UTA, rentaBrutaImponibleAnualCLP: 150 * UTA, valorUTM: UTM });
  cerca(en90.factor, 1, 0.002);
  cerca(en120.factor, 0.5, 0.005);
  cerca(en150.factor, 0, 0.002);
});

test('55 bis: el tope de 8 UTA acota los intereses considerados', () => {
  const r = beneficio55bis({
    interesesAnualesCLP: 20 * UTA,
    rentaBrutaImponibleAnualCLP: 60 * UTA,
    valorUTM: UTM,
  });
  assert.equal(r.topeAlcanzado, true);
  cerca(r.interesesConsiderados, 8 * UTA, 1);
  cerca(r.rebaja, 8 * UTA, 1);
});

test('55 bis por año: el beneficio se concentra al principio del crédito', () => {
  const filas = Array.from({ length: 120 }, (_, k) => ({ interes: 9 - k * 0.03 }));
  const r = beneficio55bisPorAnio(filas, {
    rentaBrutaImponibleAnualCLP: 60 * UTA,
    valorUTM: UTM,
    valorUF: SUPUESTOS.valorUF.valor,
    anios: 10,
  });
  assert.equal(r.filas.length, 10);
  assert.ok(r.filas[0].interesesUF > r.filas[9].interesesUF, 'los intereses bajan con los años');
  assert.ok(r.ahorroAcumulado > 0);
});

test('DFL2: 140 m² califica, 141 no', () => {
  assert.equal(evaluarDFL2({ superficieUtilM2: 140 }).califica, true);
  assert.equal(evaluarDFL2({ superficieUtilM2: 141 }).califica, false);
});

test('DFL2: como persona natural el beneficio alcanza hasta dos viviendas', () => {
  assert.equal(evaluarDFL2({ superficieUtilM2: 60, viviendasDFL2QueYaTiene: 1 }).califica, true);
  const tercera = evaluarDFL2({ superficieUtilM2: 60, viviendasDFL2QueYaTiene: 2 });
  assert.equal(tercera.califica, false);
  assert.equal(tercera.arriendoExentoDeRenta, false);
});

test('ganancia de capital: bajo la exención de 8.000 UF no se paga impuesto', () => {
  const r = impuestoGananciaCapital({ gananciaUF: 500 });
  assert.equal(r.impuestoUF, 0);
  assert.equal(r.gananciaAfectaUF, 0);
});

test('ganancia de capital: sobre el exceso se paga 10%', () => {
  const r = impuestoGananciaCapital({ gananciaUF: 9000 });
  cerca(r.gananciaAfectaUF, 1000, 1e-6);
  cerca(r.impuestoUF, 100, 1e-6);
});

test('ganancia de capital: la exención ya usada reduce la disponible', () => {
  const r = impuestoGananciaCapital({ gananciaUF: 1000, exencionYaUsadaUF: 7500 });
  cerca(r.exencionAplicadaUF, 500, 1e-6);
  cerca(r.impuestoUF, 50, 1e-6);
});

test('contribuciones: bajo la exención no se paga y el DFL2 rebaja a la mitad', () => {
  const exento = contribuciones({ avaluoFiscalCLP: 40000000, exencionCLP: 50000000 });
  assert.equal(exento.exento, true);
  assert.equal(exento.anualCLP, 0);

  const normal = contribuciones({ avaluoFiscalCLP: 100000000, tasaAnual: 0.01 });
  const conDFL2 = contribuciones({ avaluoFiscalCLP: 100000000, tasaAnual: 0.01, esDFL2: true });
  cerca(normal.anualCLP, 1000000, 1e-6);
  cerca(conDFL2.anualCLP, 500000, 1e-6);
});
