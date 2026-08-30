import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarSensibilidad, variablesSensibilidadPorDefecto, simularPrepago,
  evaluarRefinanciamiento, compararEscenarios,
} from '../src/engine/escenarios.js';
import { calcularCredito } from '../src/engine/credito.js';
import { construirVeredicto } from '../src/engine/veredicto.js';
import { SUPUESTOS } from '../src/engine/parametros.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

const gastos = {
  tasacionUF: SUPUESTOS.tasacionUF.valor,
  estudioTitulosUF: SUPUESTOS.estudioTitulosUF.valor,
  notariaUF: SUPUESTOS.notariaUF.valor,
  gastosNotarialesCompraventaUF: SUPUESTOS.gastosNotarialesCompraventaUF.valor,
  tasaConservador: SUPUESTOS.tasaConservador.valor,
  topeConservadorUF: SUPUESTOS.topeConservadorUF.valor,
  tasaImpuestoMutuo: SUPUESTOS.tasaImpuestoMutuo.valor,
  tasaImpuestoMutuoDFL2: SUPUESTOS.tasaImpuestoMutuoDFL2.valor,
};

const entrada = (over = {}) => ({
  precioUF: 3200, piePorcentaje: 0.20, tasaAnual: 0.042, plazoAnios: 25,
  convencionTasa: 'nominal', tasaDesgravamenMensual: 0.00025,
  tasaIncendioSismoMensual: 0.00022, gastos, ...over,
});

test('sensibilidad: la tasa y el plazo dominan sobre los seguros', () => {
  const r = analizarSensibilidad(
    entrada(),
    variablesSensibilidadPorDefecto(entrada()),
    (c) => c.dividendoPrimerMesUF,
  );
  const claves = r.filas.map((f) => f.clave);
  const posTasa = claves.indexOf('tasaAnual');
  const posDesgravamen = claves.indexOf('tasaDesgravamenMensual');
  assert.ok(posTasa < posDesgravamen, 'la tasa debería impactar más que el desgravamen');
  // Está ordenado de mayor a menor impacto.
  for (let k = 1; k < r.filas.length; k++) {
    assert.ok(r.filas[k - 1].impacto >= r.filas[k].impacto);
  }
});

test('sensibilidad: bajar la tasa baja el dividendo y subirla lo sube', () => {
  const r = analizarSensibilidad(
    entrada(),
    [{ clave: 'tasaAnual', etiqueta: 'Tasa', bajo: 0.03, alto: 0.06 }],
    (c) => c.dividendoPrimerMesUF,
  );
  const f = r.filas[0];
  assert.ok(f.deltaBajo < 0, 'menos tasa, menos dividendo');
  assert.ok(f.deltaAlto > 0, 'más tasa, más dividendo');
});

test('prepago en modo plazo acorta el crédito y ahorra intereses', () => {
  const r = simularPrepago(entrada(), { abonoMensualUF: 2, modo: 'plazo' });
  assert.ok(r.mesesAhorrados > 0);
  assert.ok(r.interesAhorradoUF > 0);
  assert.ok(r.retornoPorUFAbonada > 0);
  // En modo plazo la cuota no cambia, así que el dividendo obligatorio tampoco.
  cerca(r.bajaDividendoUF, 0, 1e-9);
  // Lo que sí sube es el desembolso del mes, porque el abono es plata adicional.
  cerca(r.con.filas[0].desembolsoUF - r.con.filas[0].dividendoUF, 2, 1e-9);
});

test('prepago en modo cuota mantiene el plazo y baja el dividendo', () => {
  const r = simularPrepago(entrada(), { abonoAnualUF: 30, modo: 'cuota' });
  assert.equal(r.mesesAhorrados, 0);
  assert.ok(r.interesAhorradoUF > 0);
});

test('modo plazo ahorra más interés que modo cuota con el mismo abono', () => {
  const porPlazo = simularPrepago(entrada(), { abonoMensualUF: 2, modo: 'plazo' });
  const porCuota = simularPrepago(entrada(), { abonoMensualUF: 2, modo: 'cuota' });
  assert.ok(porPlazo.interesAhorradoUF > porCuota.interesAhorradoUF);
});

test('refinanciar a una tasa más baja conviene y el break-even es coherente', () => {
  const actual = calcularCredito(entrada({ tasaAnual: 0.055 }));
  const r = evaluarRefinanciamiento({
    creditoActual: actual,
    mesesPagados: 24,
    nuevaTasaAnual: 0.040,
    gastos,
    precioUF: 3200,
    tasaDesgravamenMensual: 0.00025,
    tasaIncendioSismoMensual: 0.00022,
  });
  assert.equal(r.viable, true);
  assert.ok(r.ahorroMensualUF > 0);
  assert.equal(r.conviene, true);
  cerca(r.mesesParaRecuperar, r.costoRefinanciarUF / r.ahorroMensualUF, 1e-9);
  assert.ok(r.ahorroInteresTotalUF > 0);
});

test('refinanciar a una tasa igual o mayor no conviene', () => {
  const actual = calcularCredito(entrada({ tasaAnual: 0.040 }));
  const r = evaluarRefinanciamiento({
    creditoActual: actual,
    mesesPagados: 24,
    nuevaTasaAnual: 0.050,
    gastos,
    precioUF: 3200,
    tasaDesgravamenMensual: 0.00025,
    tasaIncendioSismoMensual: 0.00022,
  });
  assert.equal(r.conviene, false);
  assert.ok(r.ahorroMensualUF < 0);
  assert.ok(r.lectura.includes('no tiene sentido'));
});

test('el costo de refinanciar incluye el impuesto al mutuo sobre el saldo', () => {
  const actual = calcularCredito(entrada({ tasaAnual: 0.055 }));
  const r = evaluarRefinanciamiento({
    creditoActual: actual, mesesPagados: 24, nuevaTasaAnual: 0.040,
    gastos, precioUF: 3200,
    tasaDesgravamenMensual: 0.00025, tasaIncendioSismoMensual: 0.00022,
  });
  const impuesto = r.detalleCosto.find((d) => d.concepto.includes('timbres'));
  cerca(impuesto.uf, r.saldoUF * 0.008, 1e-6);
});

test('comparar escenarios marca el ganador por métrica y arma el ranking', () => {
  const barato = calcularCredito(entrada({ tasaAnual: 0.035 }));
  const caro = calcularCredito(entrada({ tasaAnual: 0.055 }));
  const escenarios = [
    { id: 'a', nombre: 'Banco barato', resultado: barato },
    { id: 'b', nombre: 'Banco caro', resultado: caro },
  ];
  const r = compararEscenarios(escenarios, [
    { clave: 'dividendo', etiqueta: 'Dividendo', mejor: 'menor', obtener: (e) => e.resultado.dividendoPrimerMesUF },
    { clave: 'interes', etiqueta: 'Interés total', mejor: 'menor', obtener: (e) => e.resultado.totalInteresUF },
    { clave: 'cae', etiqueta: 'CAE', mejor: 'menor', obtener: (e) => e.resultado.caeAnual },
  ]);
  assert.equal(r.filas.length, 3);
  for (const f of r.filas) assert.equal(f.ganadorId, 'a');
  assert.equal(r.ranking[0].id, 'a');
  assert.equal(r.ranking[0].puntos, 3);
});

test('comparar escenarios respeta que en algunas métricas gana el mayor', () => {
  const escenarios = [
    { id: 'a', nombre: 'A', metricas: { tir: 0.03 } },
    { id: 'b', nombre: 'B', metricas: { tir: 0.07 } },
  ];
  const r = compararEscenarios(escenarios, [
    { clave: 'tir', etiqueta: 'TIR', mejor: 'mayor', obtener: (e) => e.metricas.tir },
  ]);
  assert.equal(r.filas[0].ganadorId, 'b');
});

test('veredicto: un caso holgado sale sin señales rojas', () => {
  const credito = calcularCredito(entrada());
  const v = construirVeredicto({
    credito,
    valorUF: 40871,
    perfilIngresos: {
      modalidad: 'dependiente',
      rentaAcreditableMensual: 4000000,
      ingresoRealMensual: 4000000,
      otrasDeudasMensuales: 0,
      ahorroLiquidoCLP: 8000000,
    },
  });
  assert.equal(v.bloqueantes.length, 0, `rojas: ${v.bloqueantes.map((s) => s.titulo)}`);
  assert.ok(v.conteo.verde > 0);
});

test('veredicto: renta ajustada y sin colchón levanta señales rojas', () => {
  const credito = calcularCredito(entrada());
  const v = construirVeredicto({
    credito,
    valorUF: 40871,
    perfilIngresos: {
      modalidad: 'honorarios',
      rentaAcreditableMensual: 1200000,
      ingresoRealMensual: 1600000,
      otrasDeudasMensuales: 150000,
      coefVariacion: 0.5,
      peorTrimestrePromedioMensual: 500000,
      ahorroLiquidoCLP: 300000,
    },
  });
  assert.ok(v.bloqueantes.length >= 2, 'debería haber varias rojas');
  const titulos = v.señales.map((s) => s.titulo);
  assert.ok(titulos.includes('Carga financiera'));
  assert.ok(titulos.includes('Prueba de estrés'));
  assert.ok(v.resumen.includes('roja'));
});

test('veredicto: sin datos de ingreso no inventa un semáforo', () => {
  const credito = calcularCredito(entrada());
  const v = construirVeredicto({
    credito, valorUF: 40871,
    perfilIngresos: { modalidad: 'honorarios', rentaAcreditableMensual: null },
  });
  const carga = v.señales.find((s) => s.titulo === 'Carga financiera');
  assert.equal(carga.semaforo, 'sin-dato');
});
