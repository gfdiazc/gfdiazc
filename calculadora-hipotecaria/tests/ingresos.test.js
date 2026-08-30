import test from 'node:test';
import assert from 'node:assert/strict';
import {
  retencionDelAnio, liquidoHonorarios, proyectarRetencion, analizarBoletas,
  colchonRecomendado, rentaAcreditable, capacidadDePago, cargaFinanciera,
  pruebaDeEstres, checklistIndependiente,
} from '../src/engine/ingresos.js';

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `esperaba ${b}, obtuve ${a}`);

test('retención sigue el calendario de la Ley 21.133', () => {
  cerca(retencionDelAnio(2025), 0.145);
  cerca(retencionDelAnio(2026), 0.1525);
  cerca(retencionDelAnio(2027), 0.16);
  cerca(retencionDelAnio(2028), 0.17);
  // Fuera de rango se acota a los extremos, no revienta.
  cerca(retencionDelAnio(2020), 0.1375);
  cerca(retencionDelAnio(2035), 0.17);
});

test('boleta de 1.000.000 en 2026 deja 847.500 líquidos', () => {
  const r = liquidoHonorarios({ brutoMensual: 1000000, anio: 2026 });
  cerca(r.retenido, 152500, 0.01);
  cerca(r.liquidoRecibido, 847500, 0.01);
});

test('las cotizaciones se calculan sobre el 80% del bruto', () => {
  const r = liquidoHonorarios({ brutoMensual: 1000000, anio: 2026 });
  cerca(r.cotizacionesEstimadas, 1000000 * 0.80 * 0.1750, 0.01);
  // Con 15,25% retenido y ~14% de cotizaciones, la retención alcanza a cubrirlas.
  assert.ok(r.disponibleRealMensual <= r.liquidoRecibido);
});

test('la retención creciente reduce tu líquido facturando lo mismo', () => {
  const p = proyectarRetencion({ brutoMensual: 2000000, desdeAnio: 2026, hastaAnio: 2028 });
  assert.equal(p.filas.length, 3);
  assert.ok(p.filas[2].liquidoRecibido < p.filas[0].liquidoRecibido);
  cerca(p.caidaLiquidaMensual, 2000000 * (0.17 - 0.1525), 0.01);
});

test('analizarBoletas: promedio, mediana y dispersión', () => {
  const r = analizarBoletas([100, 100, 100, 100, 100, 100]);
  cerca(r.promedio, 100);
  cerca(r.mediana, 100);
  cerca(r.desviacion, 0);
  cerca(r.coefVariacion, 0);
  cerca(r.caidaPeorTrimestre, 0);
});

test('analizarBoletas detecta la peor racha, no solo el peor mes', () => {
  // Un año típico de freelance: verano flojo, segundo semestre bueno.
  const boletas = [180, 40, 20, 30, 150, 200, 220, 190, 240, 210, 260, 180];
  const r = analizarBoletas(boletas);
  assert.equal(r.meses, 12);
  assert.equal(r.minimo, 20);
  // La peor ventana de 3 meses es 40+20+30 = 90, o sea 30 al mes.
  cerca(r.peorTrimestrePromedioMensual, 30);
  assert.ok(r.caidaPeorTrimestre > 0.7, 'la peor racha cae más de 70% bajo el promedio');
  assert.ok(r.coefVariacion > 0.4, 'ingresos muy variables');
});

test('analizarBoletas cuenta los meses sin facturar', () => {
  const r = analizarBoletas([100, 0, 0, 200, 150, 180]);
  assert.equal(r.mesesEnCero, 2);
});

test('analizarBoletas devuelve null si no hay datos', () => {
  assert.equal(analizarBoletas([]), null);
  assert.equal(analizarBoletas(null), null);
});

test('el colchón sugerido crece con la volatilidad de tus ingresos', () => {
  assert.equal(colchonRecomendado({ modalidad: 'dependiente' }), 6);
  assert.equal(colchonRecomendado({ modalidad: 'honorarios', coefVariacion: 0 }), 6);
  const volatil = colchonRecomendado({ modalidad: 'honorarios', coefVariacion: 0.5 });
  assert.ok(volatil > 6 && volatil <= 18);
  assert.equal(colchonRecomendado({ modalidad: 'honorarios', coefVariacion: 2 }), 18);
});

test('dependiente: el banco reconoce el líquido completo', () => {
  const r = rentaAcreditable({ modalidad: 'dependiente', sueldoLiquidoMensual: 1500000 });
  cerca(r.total, 1500000);
});

test('honorarios: el banco castiga y además se queda con el menor entre boletas y F22', () => {
  // Promedio de boletas alto pero F22 bajo: manda el F22.
  const r = rentaAcreditable({
    modalidad: 'honorarios',
    promedioBoletasMensual: 2500000,
    rentaLiquidaF22Anual: 24000000, // 2.000.000 al mes
    factorCastigo: 0.75,
  });
  cerca(r.baseAntesDeCastigo, 2000000);
  cerca(r.total, 1500000);
  assert.equal(r.limitadoPorF22, true);
});

test('honorarios sin F22 usa el promedio de boletas castigado', () => {
  const r = rentaAcreditable({
    modalidad: 'honorarios', promedioBoletasMensual: 2000000, factorCastigo: 0.75,
  });
  cerca(r.total, 1500000);
  assert.equal(r.limitadoPorF22, false);
});

test('mixto suma el sueldo completo más los honorarios castigados', () => {
  const r = rentaAcreditable({
    modalidad: 'mixto',
    sueldoLiquidoMensual: 900000,
    promedioBoletasMensual: 800000,
    factorCastigo: 0.75,
  });
  cerca(r.total, 900000 + 600000);
});

test('capacidadDePago descuenta las otras deudas del cupo', () => {
  const r = capacidadDePago({ rentaAcreditableMensual: 2000000, otrasDeudasMensuales: 200000 });
  cerca(r.cupoTotal, 500000);
  cerca(r.dividendoMaximo, 300000);
  cerca(r.consumidoPorOtrasDeudas, 0.4);
});

test('si las otras deudas se comen el cupo, la capacidad es cero y no negativa', () => {
  const r = capacidadDePago({ rentaAcreditableMensual: 1000000, otrasDeudasMensuales: 400000 });
  assert.equal(r.dividendoMaximo, 0);
});

test('el semáforo de carga financiera marca los tres estados', () => {
  const base = { rentaAcreditableMensual: 2000000 };
  assert.equal(cargaFinanciera({ ...base, dividendoMensual: 400000 }).semaforo, 'verde');
  assert.equal(cargaFinanciera({ ...base, dividendoMensual: 600000 }).semaforo, 'ambar');
  assert.equal(cargaFinanciera({ ...base, dividendoMensual: 800000 }).semaforo, 'rojo');
});

test('prueba de estrés: con colchón suficiente sobrevives la caída', () => {
  const r = pruebaDeEstres({
    dividendoMensual: 600000,
    rentaAcreditableMensual: 2000000,
    ingresoRealMensual: 2000000,
    caidaPorcentual: 0.30,
    mesesDeCaida: 6,
    ahorroLiquidoUF: 10000000,
  });
  // Ingreso estresado 1.400.000 cubre el dividendo: no hay déficit.
  assert.equal(r.escenarios[0].deficitMensual, 0);
  assert.equal(r.sobreviveTodo, true);
});

test('prueba de estrés: el peor trimestre real puede hundir un caso que se veía sano', () => {
  const r = pruebaDeEstres({
    dividendoMensual: 800000,
    rentaAcreditableMensual: 2000000,
    ingresoRealMensual: 2000000,
    caidaPorcentual: 0.30,
    mesesDeCaida: 3,
    ahorroLiquidoUF: 500000,
    peorTrimestrePromedioMensual: 400000,
  });
  const peor = r.escenarios.find((e) => e.nombre === 'Tu peor trimestre real');
  cerca(peor.deficitMensual, 400000);
  assert.equal(peor.sobrevive, false, 'con 500.000 ahorrados no cubre 3 meses de 400.000 de déficit');
  assert.equal(r.sobreviveTodo, false);
});

test('el checklist de independiente marca lo que ya tienes', () => {
  const c = checklistIndependiente({ cumplidos: [0, 2] });
  assert.ok(c.length >= 7);
  assert.equal(c[0].cumplido, true);
  assert.equal(c[1].cumplido, false);
  assert.equal(c[2].cumplido, true);
});
