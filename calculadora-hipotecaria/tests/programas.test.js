import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluarFogaes, evaluarSubsidioDividendo, evaluarProgramas,
  aniosParaJuntarPie, compararFogaes, compararSubsidioDividendo,
} from '../src/engine/programas.js';
import { SUPUESTOS } from '../src/engine/parametros.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

const perfilLimpio = (over = {}) => ({
  precioUF: 3200,
  esPrimeraVivienda: true,
  recibioSubsidioPrevio: false,
  enRegistroDeudoresPensiones: false,
  yaUsoFogaes: false,
  esViviendaNueva: true,
  fechaPromesa: '2026-09-01',
  tasaAnual: 0.042,
  ...over,
});

const entradaCredito = (over = {}) => ({
  precioUF: 3200,
  piePorcentaje: 0.20,
  tasaAnual: 0.042,
  plazoAnios: 25,
  convencionTasa: 'nominal',
  tasaDesgravamenMensual: 0.00025,
  tasaIncendioSismoMensual: 0.00022,
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
  ...over,
});

test('FOGAES: un perfil limpio califica', () => {
  const r = evaluarFogaes(perfilLimpio());
  assert.equal(r.elegible, true);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.ltvMaximo, 0.90);
});

test('FOGAES: sobre UF 6.000 queda fuera', () => {
  const r = evaluarFogaes(perfilLimpio({ precioUF: 6500 }));
  assert.equal(r.elegible, false);
  assert.ok(r.motivos.some((m) => m.includes('tope')));
});

test('FOGAES: justo en UF 6.000 todavía califica', () => {
  assert.equal(evaluarFogaes(perfilLimpio({ precioUF: 6000 })).elegible, true);
});

test('FOGAES: cada causal de exclusión aparece por separado', () => {
  const r = evaluarFogaes(perfilLimpio({
    esPrimeraVivienda: false,
    recibioSubsidioPrevio: true,
    enRegistroDeudoresPensiones: true,
    yaUsoFogaes: true,
  }));
  assert.equal(r.elegible, false);
  assert.equal(r.motivos.length, 4);
});

test('Subsidio al Dividendo: vivienda usada no califica', () => {
  const r = evaluarSubsidioDividendo(perfilLimpio({ esViviendaNueva: false }));
  assert.equal(r.elegible, false);
  assert.ok(r.motivos.some((m) => m.includes('nuevas')));
});

test('Subsidio al Dividendo: promesa anterior a 2025 no califica', () => {
  const r = evaluarSubsidioDividendo(perfilLimpio({ fechaPromesa: '2024-12-31' }));
  assert.equal(r.elegible, false);
});

test('evaluarProgramas combina LTV y tasa efectiva', () => {
  const r = evaluarProgramas(perfilLimpio());
  assert.equal(r.usaFogaes, true);
  assert.equal(r.usaSubsidio, true);
  assert.equal(r.ltvMaximo, 0.90);
  cerca(r.tasaEfectiva, 0.042 - 0.006);
});

test('evaluarProgramas respeta que decidas no usarlos', () => {
  const r = evaluarProgramas(perfilLimpio({ quiereUsarFogaes: false, quiereUsarSubsidio: false }));
  assert.equal(r.ltvMaximo, 0.80);
  cerca(r.tasaEfectiva, 0.042);
});

test('vivienda usada sobre el tope: ninguno de los dos programas aplica', () => {
  const r = evaluarProgramas(perfilLimpio({ precioUF: 7000, esViviendaNueva: false }));
  assert.equal(r.usaFogaes, false);
  assert.equal(r.usaSubsidio, false);
  assert.equal(r.ltvMaximo, 0.80);
  cerca(r.tasaEfectiva, 0.042);
});

test('aniosParaJuntarPie: si ya tienes el pie, son cero años', () => {
  const r = aniosParaJuntarPie({
    precioUF: 3200, piePorcentajeObjetivo: 0.20,
    ahorroActualUF: 700, ahorroMensualUF: 5,
  });
  assert.equal(r.anios, 0);
});

test('aniosParaJuntarPie: el precio que persigues sube mientras ahorras', () => {
  const sinPlusvalia = aniosParaJuntarPie({
    precioUF: 3200, piePorcentajeObjetivo: 0.20,
    ahorroActualUF: 200, ahorroMensualUF: 8,
    plusvaliaAnualReal: 0, rendimientoAhorroAnualReal: 0,
  });
  const conPlusvalia = aniosParaJuntarPie({
    precioUF: 3200, piePorcentajeObjetivo: 0.20,
    ahorroActualUF: 200, ahorroMensualUF: 8,
    plusvaliaAnualReal: 0.03, rendimientoAhorroAnualReal: 0,
  });
  assert.ok(conPlusvalia.anios > sinPlusvalia.anios, 'con plusvalía debería demorar más');
  assert.ok(conPlusvalia.precioFuturoUF > 3200);
});

test('aniosParaJuntarPie: si no ahorras nada, nunca llegas', () => {
  const r = aniosParaJuntarPie({
    precioUF: 3200, piePorcentajeObjetivo: 0.20,
    ahorroActualUF: 100, ahorroMensualUF: 0,
    plusvaliaAnualReal: 0.02, rendimientoAhorroAnualReal: 0.01,
  });
  assert.equal(r.anios, null);
});

test('compararFogaes muestra el trade-off completo: menos pie, más deuda', () => {
  const r = compararFogaes(entradaCredito(), { ahorroActualUF: 200, ahorroMensualUF: 8 });
  cerca(r.conFogaes.pieUF, 320);
  cerca(r.sinFogaes.pieUF, 640);
  cerca(r.deltaPieUF, 320);
  assert.ok(r.deltaDividendoUF > 0, 'con FOGAES el dividendo debe ser mayor');
  assert.ok(r.deltaInteresUF > 0, 'con FOGAES se pagan más intereses en total');
  assert.equal(r.lectura.length, 4);
});

test('el Subsidio al Dividendo baja el dividendo y el costo total', () => {
  const r = compararSubsidioDividendo(entradaCredito());
  assert.ok(r.ahorroMensualUF > 0);
  assert.ok(r.ahorroTotalUF > 0);
  // 60 pb sobre UF 2.560 a 25 años son del orden de UF 0,8 mensuales.
  assert.ok(r.ahorroMensualUF > 0.5 && r.ahorroMensualUF < 1.5,
    `ahorro mensual ${r.ahorroMensualUF} fuera del orden esperado`);
});
