import test from 'node:test';
import assert from 'node:assert/strict';
import { entradaPorDefecto, evaluarOperacion } from '../src/engine/index.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

test('la entrada por defecto se evalúa completa y sin avisos', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  assert.equal(r.avisos.length, 0);
  for (const clave of ['credito', 'programas', 'ingresos', 'impuestos', 'inversion', 'proyeccion', 'versusArrendar', 'sensibilidad', 'veredicto']) {
    assert.ok(r[clave], `falta el bloque ${clave}`);
  }
});

test('el subsidio al dividendo se aplica a la tasa efectiva del crédito', () => {
  const e = entradaPorDefecto();
  const r = evaluarOperacion(e);
  cerca(r.programas.tasaEfectiva, e.credito.tasaAnual - 0.006, 1e-9);
  cerca(r.credito.tasaMensualAplicada, (e.credito.tasaAnual - 0.006) / 12, 1e-12);
});

test('renunciar al subsidio sube el dividendo', () => {
  const e = entradaPorDefecto();
  const con = evaluarOperacion(e);
  e.programas.quiereUsarSubsidio = false;
  const sin = evaluarOperacion(e);
  assert.ok(sin.credito.dividendoPrimerMesUF > con.credito.dividendoPrimerMesUF);
});

test('un pie de 10% sin derecho a FOGAES levanta un error, no un cálculo silencioso', () => {
  const e = entradaPorDefecto();
  e.credito.piePorcentaje = 0.10;
  e.programas.esPrimeraVivienda = false; // pierde FOGAES
  const r = evaluarOperacion(e);
  assert.equal(r.programas.usaFogaes, false);
  const error = r.avisos.find((a) => a.nivel === 'error');
  assert.ok(error, 'debería avisar que ese pie no es financiable');
  assert.ok(error.texto.includes('20%'));
});

test('un pie de 10% con FOGAES vigente no genera error', () => {
  const e = entradaPorDefecto();
  e.credito.piePorcentaje = 0.10;
  const r = evaluarOperacion(e);
  assert.equal(r.programas.usaFogaes, true);
  assert.equal(r.avisos.filter((a) => a.nivel === 'error').length, 0);
});

test('marcar DFL2 en una propiedad de 200 m² avisa que no califica', () => {
  const e = entradaPorDefecto();
  e.propiedad.superficieUtilM2 = 200;
  const r = evaluarOperacion(e);
  assert.equal(r.dfl2.califica, false);
  assert.ok(r.avisos.some((a) => a.texto.includes('DFL2')));
  // Y el impuesto al mutuo vuelve al 0,8%.
  cerca(r.credito.gastosOperacionales.tasaImpuestoAplicada, 0.008, 1e-12);
});

test('DFL2 vigente deja el arriendo exento y baja el impuesto al mutuo', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  assert.equal(r.dfl2.califica, true);
  assert.equal(r.inversion.exentoPorDFL2, true);
  cerca(r.credito.gastosOperacionales.tasaImpuestoAplicada, 0.002, 1e-12);
});

test('las boletas cargadas mandan sobre el promedio escrito a mano', () => {
  const e = entradaPorDefecto();
  e.perfil.promedioBoletasMensual = 5000000;
  e.perfil.boletas = [1000000, 1000000, 1000000, 1000000, 1000000, 1000000];
  const r = evaluarOperacion(e);
  cerca(r.ingresos.promedioBoletas, 1000000, 1e-6);
  cerca(r.ingresos.renta.total, 1000000 * 0.75, 1e-6);
});

test('ingresos volátiles suben el colchón recomendado', () => {
  const e = entradaPorDefecto();
  e.perfil.boletas = [3000000, 200000, 100000, 3500000, 4000000, 150000, 3800000, 200000, 3200000, 3900000, 180000, 3400000];
  const r = evaluarOperacion(e);
  assert.ok(r.ingresos.colchonRecomendadoMeses > 6, 'con esa volatilidad el colchón debería subir');
  assert.ok(r.ingresos.estadisticaBoletas.coefVariacion > 0.5);
});

test('la capacidad de compra es coherente con el dividendo máximo', () => {
  const e = entradaPorDefecto();
  const r = evaluarOperacion(e);
  // Comprar exactamente al máximo de tu alcance debe dejar la carga en el tope.
  e.propiedad.precioUF = r.ingresos.alcance.precioMaximoUF;
  const r2 = evaluarOperacion(e);
  cerca(r2.ingresos.carga.valor, e.perfil.cargaMaxima, 0.002);
});

test('el beneficio del Art. 55 bis decrece a medida que bajan los intereses', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  const f = r.impuestos.beneficio55.filas;
  assert.ok(f.length > 0);
  assert.ok(f[0].interesesUF > f[f.length - 1].interesesUF);
  assert.ok(r.impuestos.beneficio55.ahorroAcumulado >= 0);
});

test('desactivar el arriendo omite todo el bloque de inversión', () => {
  const e = entradaPorDefecto();
  e.arriendo.activo = false;
  const r = evaluarOperacion(e);
  assert.equal(r.inversion, null);
  assert.equal(r.proyeccion, null);
  assert.equal(r.versusArrendar, null);
  // El veredicto sigue funcionando, solo con menos señales.
  assert.ok(r.veredicto.señales.length > 0);
  assert.ok(!r.veredicto.señales.some((s) => s.titulo === 'Flujo de caja del arriendo'));
});

test('la comparación de FOGAES muestra el trade-off sobre la misma propiedad', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  assert.ok(r.fogaesComparado.deltaDividendoUF > 0, 'con FOGAES el dividendo sube');
  assert.ok(r.fogaesComparado.deltaInteresUF > 0, 'y los intereses totales también');
  cerca(r.fogaesComparado.deltaPieUF, 3200 * 0.10, 1e-6);
});

test('subir el precio empeora la carga financiera de forma monótona', () => {
  const e = entradaPorDefecto();
  const cargas = [2000, 3000, 4000, 5000].map((precio) => {
    e.propiedad.precioUF = precio;
    return evaluarOperacion(e).ingresos.carga.valor;
  });
  for (let k = 1; k < cargas.length; k++) {
    assert.ok(cargas[k] > cargas[k - 1], 'más precio debe significar más carga');
  }
});

test('el análisis de sensibilidad viene ordenado por impacto', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  const f = r.sensibilidad.filas;
  assert.ok(f.length >= 5);
  for (let k = 1; k < f.length; k++) assert.ok(f[k - 1].impacto >= f[k].impacto);
  cerca(r.sensibilidad.base, r.credito.dividendoPrimerMesUF, 1e-9);
});

test('sin abonos no se calcula prepago; con abonos sí', () => {
  const e = entradaPorDefecto();
  assert.equal(evaluarOperacion(e).prepago, null);
  e.credito.abonoMensualUF = 2;
  const r = evaluarOperacion(e);
  assert.ok(r.prepago !== null);
  assert.ok(r.prepago.mesesAhorrados > 0);
});

test('todo el resultado es serializable salvo el ayudante de proyección', () => {
  const r = evaluarOperacion(entradaPorDefecto());
  delete r.proyeccion.proyectarCon;
  assert.doesNotThrow(() => JSON.stringify(r));
});
