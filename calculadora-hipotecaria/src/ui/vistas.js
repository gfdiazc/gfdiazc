/**
 * Las pantallas. Cada vista devuelve HTML; las que llevan gráficos exponen
 * además un `montar` que se ejecuta después de insertar el HTML en el DOM.
 */

import { uf, ufCorto, clp, pct, numero, anios, esc } from './formato.js';
import {
  campo, bloque, tarjeta, chip, chipLiso, senal, desglose, tabla, aviso,
  insigniaConfianza, etiquetaSemaforo,
} from './componentes.js';
import { graficoAmortizacion, graficoPatrimonio, graficoTornado, graficoBarras } from './graficos.js';
import {
  SUPUESTOS, VERIFICADO_AL, RETENCION_HONORARIOS_FUENTE, EVALUACION_BANCARIA,
  checklistIndependiente, evaluarOperacion,
} from '../engine/index.js';

/* ====================================================================== */
/* 1. Datos                                                                */
/* ====================================================================== */

export function vistaDatos() {
  return `
  ${bloque({
    titulo: 'La propiedad',
    resumen: 'Precio, tipo y gastos que trae',
    abierto: true,
    contenido: `
      <div class="campos campos-2">
        ${campo({ ruta: 'propiedad.nombre', etiqueta: 'Nombre o dirección', tipo: 'texto', marcador: 'Depto. Ñuñoa 2 dorm.' })}
        ${campo({ ruta: 'propiedad.precioUF', etiqueta: 'Precio', tipo: 'uf', sufijo: 'UF' })}
        ${campo({ ruta: 'propiedad.superficieUtilM2', etiqueta: 'Superficie útil', tipo: 'numero', sufijo: 'm²', ayuda: 'Hasta 140 m² útiles puede ser DFL2, que rebaja el impuesto al mutuo y deja el arriendo exento.' })}
        ${campo({ ruta: 'propiedad.gastosComunesMensualesUF', etiqueta: 'Gastos comunes', tipo: 'uf', sufijo: 'UF/mes' })}
        ${campo({ ruta: 'propiedad.avaluoFiscalCLP', etiqueta: 'Avalúo fiscal', tipo: 'clp', sufijo: 'CLP', ayuda: 'Sale del certificado de avalúo del SII. Define las contribuciones.' })}
        ${campo({ ruta: 'propiedad.habilitacionUF', etiqueta: 'Habilitación', tipo: 'uf', sufijo: 'UF', ayuda: 'Remodelación, cortinas, muebles: plata que sale de tu bolsillo el primer mes.' })}
      </div>
      <div class="campos" style="margin-top:var(--r3)">
        ${campo({ ruta: 'propiedad.esNueva', etiqueta: 'Es vivienda nueva (primera venta)', tipo: 'bool', ayuda: 'Requisito del Subsidio al Dividendo.' })}
        ${campo({ ruta: 'propiedad.esDFL2', etiqueta: 'Acogida al DFL2', tipo: 'bool', ayuda: 'Confírmalo con el certificado. Cambia impuestos y tributación del arriendo.' })}
      </div>`,
  })}

  ${bloque({
    titulo: 'El crédito',
    resumen: 'Tasa, plazo, pie y seguros',
    abierto: true,
    contenido: `
      <div class="campos campos-2">
        ${campo({ ruta: 'credito.piePorcentaje', etiqueta: 'Pie', tipo: 'pct', sufijo: '%', ayuda: '20% es el estándar. 10% solo con FOGAES.' })}
        ${campo({ ruta: 'credito.tasaAnual', etiqueta: 'Tasa anual', tipo: 'pct', sufijo: '% UF', ayuda: 'La que te coticen. El promedio del sistema ronda 4,0% (Banco Central, jul-2026).' })}
        ${campo({ ruta: 'credito.plazoAnios', etiqueta: 'Plazo', tipo: 'numero', sufijo: 'años' })}
        ${campo({ ruta: 'credito.convencionTasa', etiqueta: 'Convención de tasa', tipo: 'select', opciones: [
          { valor: 'nominal', texto: 'Nominal (tasa ÷ 12) — la práctica chilena' },
          { valor: 'efectiva', texto: 'Efectiva (compuesta)' },
        ], ayuda: 'Si tu número no calza con el simulador del banco, casi siempre es por esto.' })}
        ${campo({ ruta: 'credito.tasaDesgravamenMensual', etiqueta: 'Seguro de desgravamen', tipo: 'pctFino', sufijo: '% mensual', ayuda: 'Sobre el saldo insoluto. Habitual: 0,020% a 0,035%.' })}
        ${campo({ ruta: 'credito.tasaIncendioSismoMensual', etiqueta: 'Seguro de incendio y sismo', tipo: 'pctFino', sufijo: '% mensual', ayuda: 'Sobre el valor de tasación. Habitual: 0,015% a 0,030%.' })}
      </div>
      <div class="campos" style="margin-top:var(--r3)">
        ${campo({ ruta: 'credito.financiarGastos', etiqueta: 'Financiar los gastos operacionales dentro del crédito', tipo: 'bool', ayuda: 'No pagas nada al firmar, pero el crédito crece y con él el impuesto al mutuo.' })}
      </div>
      <div class="campos campos-2" style="margin-top:var(--r3)">
        ${campo({ ruta: 'credito.abonoMensualUF', etiqueta: 'Abono extra mensual', tipo: 'uf', sufijo: 'UF/mes' })}
        ${campo({ ruta: 'credito.abonoAnualUF', etiqueta: 'Abono extra anual', tipo: 'uf', sufijo: 'UF/año', ayuda: 'Tus meses buenos de facturación son la munición para esto.' })}
        ${campo({ ruta: 'credito.modoAbono', etiqueta: 'Los abonos deben', tipo: 'select', opciones: [
          { valor: 'plazo', texto: 'Acortar el plazo (ahorra más interés)' },
          { valor: 'cuota', texto: 'Bajar el dividendo (da aire mensual)' },
        ] })}
      </div>`,
  })}

  ${bloque({
    titulo: 'Tus ingresos',
    resumen: 'Cómo te evalúa el banco',
    abierto: true,
    contenido: `
      <div class="campos campos-2">
        ${campo({ ruta: 'perfil.modalidad', etiqueta: 'Modalidad de trabajo', tipo: 'select', opciones: [
          { valor: 'honorarios', texto: 'Independiente a honorarios' },
          { valor: 'dependiente', texto: 'Dependiente con contrato' },
          { valor: 'mixto', texto: 'Mixto: sueldo y honorarios' },
          { valor: 'socio', texto: 'Socio de empresa (retiros)' },
        ] })}
        ${campo({ ruta: 'perfil.sueldoLiquidoMensual', etiqueta: 'Sueldo líquido', tipo: 'clp', sufijo: 'CLP/mes', ayuda: 'Solo si eres dependiente o mixto.' })}
        ${campo({ ruta: 'perfil.promedioBoletasMensual', etiqueta: 'Promedio de boletas', tipo: 'clp', sufijo: 'CLP/mes', ayuda: 'Bruto, antes de retención. Si cargas tus boletas abajo, manda ese promedio.' })}
        ${campo({ ruta: 'perfil.rentaLiquidaF22Anual', etiqueta: 'Renta líquida del F22', tipo: 'clp', sufijo: 'CLP/año', ayuda: 'El banco cruza tu F22 con las boletas y se queda con el menor. Deja 0 si no lo tienes a mano.' })}
        ${campo({ ruta: 'perfil.factorCastigo', etiqueta: 'Castigo que aplica el banco', tipo: 'pct', sufijo: '%', ayuda: 'Cuánto de tus ingresos variables reconoce. Habitual: 70% a 80%.' })}
        ${campo({ ruta: 'perfil.otrasDeudasMensuales', etiqueta: 'Otras cuotas mensuales', tipo: 'clp', sufijo: 'CLP/mes', ayuda: 'Créditos de consumo, automotriz, tarjetas. Se restan de tu cupo.' })}
        ${campo({ ruta: 'perfil.ahorroLiquidoCLP', etiqueta: 'Ahorro líquido disponible', tipo: 'clp', sufijo: 'CLP', ayuda: 'Lo que tienes disponible después de pagar el pie. Es tu colchón.' })}
        ${campo({ ruta: 'perfil.cargaMaxima', etiqueta: 'Carga financiera máxima', tipo: 'pct', sufijo: '%', ayuda: 'Los bancos usan entre 25% y 30% de la renta acreditable.' })}
      </div>
      <div class="campos" style="margin-top:var(--r3)">
        ${campo({ ruta: 'perfil.boletas', etiqueta: 'Tus boletas de los últimos 12 a 24 meses', tipo: 'lista', ayuda: 'Montos brutos separados por coma, del más antiguo al más reciente. Con esto se calcula tu volatilidad real y tu peor trimestre.', marcador: '1800000, 2400000, 900000, ...' })}
      </div>`,
  })}

  ${bloque({
    titulo: 'FOGAES y Subsidio al Dividendo',
    resumen: 'Elegibilidad',
    abierto: true,
    contenido: `
      <div class="campos">
        ${campo({ ruta: 'programas.esPrimeraVivienda', etiqueta: 'Es mi primera vivienda', tipo: 'bool' })}
        ${campo({ ruta: 'programas.recibioSubsidioPrevio', etiqueta: 'Ya recibí un subsidio estatal de vivienda', tipo: 'bool' })}
        ${campo({ ruta: 'programas.yaUsoFogaes', etiqueta: 'Ya usé FOGAES antes', tipo: 'bool' })}
        ${campo({ ruta: 'programas.enRegistroDeudoresPensiones', etiqueta: 'Estoy en el Registro Nacional de Deudores de Pensiones de Alimentos', tipo: 'bool' })}
      </div>
      <div class="campos campos-2" style="margin-top:var(--r3)">
        ${campo({ ruta: 'programas.fechaPromesa', etiqueta: 'Fecha de la promesa de compraventa', tipo: 'texto', marcador: '2026-09-15', ayuda: 'Formato AAAA-MM-DD. Debe ser del 1-ene-2025 en adelante para el subsidio.' })}
      </div>
      <div class="campos" style="margin-top:var(--r3)">
        ${campo({ ruta: 'programas.quiereUsarFogaes', etiqueta: 'Usar FOGAES si califico', tipo: 'bool' })}
        ${campo({ ruta: 'programas.quiereUsarSubsidio', etiqueta: 'Usar el Subsidio al Dividendo si califico', tipo: 'bool' })}
      </div>`,
  })}

  ${bloque({
    titulo: 'Si la arriendas',
    resumen: 'Escenario de inversión',
    contenido: `
      <div class="campos" style="margin-bottom:var(--r3)">
        ${campo({ ruta: 'arriendo.activo', etiqueta: 'Evaluar también como inversión de arriendo', tipo: 'bool' })}
      </div>
      <div class="campos campos-2">
        ${campo({ ruta: 'arriendo.arriendoMensualUF', etiqueta: 'Arriendo que podrías cobrar', tipo: 'uf', sufijo: 'UF/mes' })}
        ${campo({ ruta: 'arriendo.arriendoEquivalenteMensualUF', etiqueta: 'Arriendo de algo equivalente', tipo: 'uf', sufijo: 'UF/mes', ayuda: 'Lo que pagarías tú por arrendar una propiedad así. Se usa en comprar vs. arrendar.' })}
        ${campo({ ruta: 'arriendo.vacanciaAnual', etiqueta: 'Vacancia', tipo: 'pct', sufijo: '%', ayuda: '8,3% equivale a un mes al año sin arrendar.' })}
        ${campo({ ruta: 'arriendo.tasaAdministracion', etiqueta: 'Administración', tipo: 'pct', sufijo: '% del arriendo', ayuda: 'Lo que cobra el corredor por administrar. 0 si administras tú.' })}
        ${campo({ ruta: 'arriendo.tasaMantencion', etiqueta: 'Provisión de mantención', tipo: 'pct', sufijo: '% del arriendo', ayuda: 'Reparaciones, pintura, artefactos. 5% es conservador.' })}
        ${campo({ ruta: 'arriendo.seguroAnualUF', etiqueta: 'Seguro de arriendo', tipo: 'uf', sufijo: 'UF/año' })}
      </div>`,
  })}

  ${bloque({
    titulo: 'Supuestos de mercado',
    resumen: 'Lo que no controlas',
    contenido: `
      <div class="campos campos-2">
        ${campo({ ruta: 'mercado.plusvaliaAnualReal', etiqueta: 'Plusvalía real anual', tipo: 'pct', sufijo: '%', ayuda: 'Por sobre la inflación, porque todo está en UF. Sé conservador: 2% ya es optimista sostenido.' })}
        ${campo({ ruta: 'mercado.crecimientoArriendoAnualReal', etiqueta: 'Alza real del arriendo', tipo: 'pct', sufijo: '%/año' })}
        ${campo({ ruta: 'mercado.rendimientoAlternativoAnualReal', etiqueta: 'Rendimiento de tu alternativa', tipo: 'pct', sufijo: '%/año', ayuda: 'Real, en UF. Es contra qué se compara la inversión: depósitos, fondos, lo que uses.' })}
        ${campo({ ruta: 'mercado.aniosProyeccion', etiqueta: 'Horizonte de proyección', tipo: 'numero', sufijo: 'años' })}
        ${campo({ ruta: 'mercado.tasaComisionVenta', etiqueta: 'Comisión al vender', tipo: 'pct', sufijo: '%' })}
        ${campo({ ruta: 'mercado.tasaContribucionesAnual', etiqueta: 'Tasa de contribuciones', tipo: 'pct', sufijo: '% del avalúo/año' })}
        ${campo({ ruta: 'mercado.ahorroActualUF', etiqueta: 'Ahorro que tienes hoy', tipo: 'uf', sufijo: 'UF', ayuda: 'Se usa para calcular cuánto tardarías en juntar un pie mayor.' })}
        ${campo({ ruta: 'mercado.ahorroMensualUF', etiqueta: 'Cuánto ahorras al mes', tipo: 'uf', sufijo: 'UF/mes' })}
      </div>`,
  })}

  ${bloque({
    titulo: 'Gastos operacionales',
    resumen: 'Cotiza estos: varían mucho',
    contenido: `
      ${aviso('alerta', '<span>Estas tarifas cambian bastante entre bancos y notarías. Los valores por defecto son referenciales: <strong>reemplázalos con tu cotización real</strong> apenas la tengas.</span>')}
      <div class="campos campos-2" style="margin-top:var(--r3)">
        ${campo({ ruta: 'gastos.tasacionUF', etiqueta: 'Tasación', tipo: 'uf', sufijo: 'UF' })}
        ${campo({ ruta: 'gastos.estudioTitulosUF', etiqueta: 'Estudio de títulos y escritura', tipo: 'uf', sufijo: 'UF' })}
        ${campo({ ruta: 'gastos.notariaUF', etiqueta: 'Notaría (mutuo)', tipo: 'uf', sufijo: 'UF' })}
        ${campo({ ruta: 'gastos.gastosNotarialesCompraventaUF', etiqueta: 'Notaría (compraventa)', tipo: 'uf', sufijo: 'UF' })}
        ${campo({ ruta: 'gastos.tasaConservador', etiqueta: 'Arancel del Conservador', tipo: 'pct', sufijo: '% del precio' })}
        ${campo({ ruta: 'gastos.topeConservadorUF', etiqueta: 'Tope del Conservador', tipo: 'uf', sufijo: 'UF' })}
      </div>`,
  })}`;
}

/* ====================================================================== */
/* 2. Resultado                                                            */
/* ====================================================================== */

export function vistaResultado(r, estado) {
  const e = r.entrada;
  const vUF = e.mercado.valorUF;
  const c = r.credito;
  const p = (x) => `${uf(x)} · ${clp(x * vUF)}`;

  const avisos = r.avisos.map((a) => aviso(a.nivel === 'error' ? 'error' : 'alerta', esc(a.texto))).join('');

  const desgloseDividendo = desglose([
    { concepto: 'Cuota (capital e interés)', monto: c.cuotaUF },
    { concepto: 'Seguro de desgravamen', monto: c.filas[0].desgravamenUF, nota: 'baja cada mes con el saldo' },
    { concepto: 'Seguro de incendio y sismo', monto: c.incendioMensualUF, nota: 'fijo' },
    ...(c.filas[0].comisionUF > 0 ? [{ concepto: 'Comisión de administración', monto: c.filas[0].comisionUF }] : []),
    { concepto: 'Dividendo del primer mes', monto: c.dividendoPrimerMesUF, total: true },
  ], p);

  const desgloseEntrada = desglose([
    { concepto: `Pie (${pct(c.ltv ? 1 - c.ltv : 0, 0)} del precio)`, monto: c.pieUF },
    ...c.gastosOperacionales.detalle.map((d) => ({ concepto: d.concepto, monto: d.uf })),
    ...(e.propiedad.habilitacionUF > 0 ? [{ concepto: 'Habilitación', monto: e.propiedad.habilitacionUF }] : []),
    {
      concepto: e.credito.financiarGastos ? 'Necesitas al firmar (gastos financiados)' : 'Necesitas al firmar',
      monto: c.pieUF + c.gastosOperacionales.desembolsoInicialUF + e.propiedad.habilitacionUF,
      total: true,
    },
  ], p);

  const fog = r.fogaesComparado;
  const tarjetaFogaes = tarjeta({
    titulo: 'FOGAES: ¿te conviene de verdad?',
    descripcion: 'La misma propiedad, con pie de 10% y con pie de 20%. Lo que el folleto no pone lado a lado.',
    contenido: `
      ${r.programas.fogaes.elegible
        ? aviso('info', '<span>Con los datos que cargaste, <strong>calificas</strong> para FOGAES.</span>')
        : aviso('alerta', `<span><strong>No calificas para FOGAES:</strong> ${esc(r.programas.fogaes.motivos.join(' '))}</span>`)}
      ${tabla([
        { titulo: '', num: false, obtener: (f) => esc(f.etiqueta) },
        { titulo: 'Pie 10% (FOGAES)', obtener: (f) => esc(f.conFogaes) },
        { titulo: 'Pie 20%', obtener: (f) => esc(f.sinFogaes) },
      ], [
        { etiqueta: 'Pie que necesitas', conFogaes: uf(fog.conFogaes.pieUF, 0), sinFogaes: uf(fog.sinFogaes.pieUF, 0) },
        { etiqueta: 'Crédito', conFogaes: uf(fog.conFogaes.montoCreditoUF, 0), sinFogaes: uf(fog.sinFogaes.montoCreditoUF, 0) },
        { etiqueta: 'Dividendo mes 1', conFogaes: uf(fog.conFogaes.dividendoPrimerMesUF), sinFogaes: uf(fog.sinFogaes.dividendoPrimerMesUF) },
        { etiqueta: 'Interés total', conFogaes: uf(fog.conFogaes.totalInteresUF, 0), sinFogaes: uf(fog.sinFogaes.totalInteresUF, 0) },
      ])}
      <ul class="desglose" style="margin-top:var(--r3)">
        ${fog.lectura.map((l) => `<li><span class="concepto">${esc(l)}</span></li>`).join('')}
      </ul>`,
  });

  const sub = r.subsidioComparado;
  const tarjetaSubsidio = tarjeta({
    titulo: 'Subsidio al Dividendo',
    descripcion: 'Rebaja de 60 puntos base en la tasa, para viviendas nuevas de hasta UF 6.000.',
    contenido: `
      ${r.programas.subsidioDividendo.elegible
        ? aviso('info', `<span><strong>Calificas.</strong> Te ahorra ${esc(uf(sub.ahorroMensualUF))} al mes (${esc(clp(sub.ahorroMensualUF * vUF))}) y ${esc(uf(sub.ahorroTotalUF, 0))} a lo largo del crédito.</span>`)
        : aviso('alerta', `<span><strong>No calificas:</strong> ${esc(r.programas.subsidioDividendo.motivos.join(' '))}</span>`)}
      <ul class="desglose">
        <li><span class="concepto">Tasa cotizada</span><span class="monto">${pct(e.credito.tasaAnual)}</span></li>
        <li><span class="concepto">Tasa que aplicas</span><span class="monto">${pct(r.programas.tasaEfectiva)}</span></li>
        <li><span class="concepto">Cupos y plazo</span><span class="monto">80.000 · hasta 31-05-2028</span></li>
      </ul>`,
  });

  const b55 = r.impuestos.beneficio55;
  const tarjeta55 = tarjeta({
    titulo: 'Beneficio tributario del Art. 55 bis',
    descripcion: 'Rebaja los intereses hipotecarios de tu Global Complementario. No baja el dividendo, baja el costo real del crédito.',
    contenido: b55.ahorroAcumulado > 0
      ? `<div id="gr-55bis"></div>
         <ul class="desglose" style="margin-top:var(--r3)">
           <li><span class="concepto">Ahorro el primer año</span><span class="monto">${clp(b55.filas[0].ahorro)}</span></li>
           <li><span class="concepto">Ahorro acumulado en ${b55.filas.length} años</span><span class="monto">${clp(b55.ahorroAcumulado)}</span></li>
           <li><span class="concepto">Tope legal</span><span class="monto">8 UTA al año</span></li>
         </ul>`
      : aviso('alerta', '<span>Con la renta que cargaste no accedes al beneficio, o no genera ahorro. Se pierde sobre 150 UTA de renta bruta anual.</span>'),
  });

  const inv = r.inversion;
  const tarjetaInversion = inv ? tarjeta({
    titulo: 'Si la arriendas',
    descripcion: `Arriendo de ${uf(e.arriendo.arriendoMensualUF)} al mes, con ${pct(e.arriendo.vacanciaAnual, 1)} de vacancia.`,
    contenido: `
      ${inv.exentoPorDFL2 ? aviso('info', '<span>Al ser DFL2 y persona natural, <strong>el arriendo no constituye renta</strong>: no paga Global Complementario.</span>') : ''}
      ${desglose([
        { concepto: 'Arriendo bruto anual', monto: inv.arriendoBrutoAnualUF },
        { concepto: 'Menos vacancia', monto: -(inv.arriendoBrutoAnualUF - inv.ingresoEfectivoAnualUF) },
        { concepto: 'Menos gastos operativos', monto: -inv.gastosOperativosAnualUF, nota: 'administración, mantención, contribuciones' },
        { concepto: 'NOI (resultado operacional)', monto: inv.noiUF },
        { concepto: 'Menos dividendos del año', monto: -inv.servicioDeudaAnualUF },
        { concepto: 'Flujo anual', monto: inv.flujoNetoUF, total: true },
      ], p)}
      <div class="rejilla rejilla-3" style="margin-top:var(--r4)">
        <div><span class="etiqueta">Cap rate bruto</span><div class="num" style="font-size:1.15rem">${pct(inv.capRateBruto)}</div></div>
        <div><span class="etiqueta">Cap rate neto</span><div class="num" style="font-size:1.15rem">${pct(inv.capRateNeto)}</div></div>
        <div><span class="etiqueta">Cash-on-cash</span><div class="num" style="font-size:1.15rem">${pct(inv.cashOnCash)}</div></div>
      </div>
      <p class="ayuda" style="margin-top:var(--r3)">
        Arriendo de equilibrio (flujo cero): <strong>${uf(r.equilibrio.arriendoMensualEquilibrioUF)}</strong> al mes.
        ${r.equilibrio.holguraUF >= 0
          ? `Tu arriendo lo supera por ${uf(r.equilibrio.holguraUF)}.`
          : `Te faltan ${uf(Math.abs(r.equilibrio.holguraUF))} para llegar ahí.`}
      </p>`,
  }) : '';

  return `
    ${avisos}
    <div class="rejilla rejilla-2">
      ${tarjeta({ titulo: 'De qué se compone tu dividendo', descripcion: 'El primer mes. El desgravamen baja con el saldo, así que el dividendo también.', contenido: desgloseDividendo })}
      ${tarjeta({ titulo: 'Qué necesitas para firmar', descripcion: 'Plata que tiene que estar disponible el día de la escritura.', contenido: desgloseEntrada })}
    </div>

    ${tarjeta({
      titulo: 'El crédito completo',
      contenido: `<div class="rejilla rejilla-3">
        <div><span class="etiqueta">Costo real (CAE)</span><div class="num" style="font-size:1.15rem">${pct(c.caeAnual)}</div><span class="ayuda">contra ${pct(r.programas.tasaEfectiva)} de tasa</span></div>
        <div><span class="etiqueta">Interés total</span><div class="num" style="font-size:1.15rem">${uf(c.totalInteresUF, 0)}</div><span class="ayuda">${clp(c.totalInteresUF * vUF)}</span></div>
        <div><span class="etiqueta">Seguros totales</span><div class="num" style="font-size:1.15rem">${uf(c.totalSegurosUF, 0)}</div><span class="ayuda">${clp(c.totalSegurosUF * vUF)}</span></div>
        <div><span class="etiqueta">Desembolso total</span><div class="num" style="font-size:1.15rem">${uf(c.costoTotalUF, 0)}</div><span class="ayuda">${numero(c.costoTotalUF / e.propiedad.precioUF, 2)}× el precio</span></div>
        <div><span class="etiqueta">Plazo efectivo</span><div class="num" style="font-size:1.15rem">${anios(c.plazoMeses)}</div></div>
        <div><span class="etiqueta">Financiamiento</span><div class="num" style="font-size:1.15rem">${pct(c.ltv, 0)}</div><span class="ayuda">LTV</span></div>
      </div>`,
    })}

    ${r.prepago ? tarjeta({
      titulo: 'Tus abonos extraordinarios',
      descripcion: e.credito.modoAbono === 'plazo' ? 'En modo acortar plazo.' : 'En modo bajar dividendo.',
      contenido: `<div class="rejilla rejilla-3">
        <div><span class="etiqueta">Te ahorras</span><div class="num" style="font-size:1.15rem">${anios(r.prepago.mesesAhorrados)}</div></div>
        <div><span class="etiqueta">Interés que no pagas</span><div class="num" style="font-size:1.15rem">${uf(r.prepago.interesAhorradoUF, 0)}</div><span class="ayuda">${clp(r.prepago.interesAhorradoUF * vUF)}</span></div>
        <div><span class="etiqueta">Por cada UF abonada</span><div class="num" style="font-size:1.15rem">${numero(r.prepago.retornoPorUFAbonada, 2)} UF</div><span class="ayuda">de interés ahorrado</span></div>
      </div>`,
    }) : ''}

    <div class="rejilla rejilla-2" style="margin-top:var(--r4)">
      ${tarjetaFogaes}
      ${tarjetaSubsidio}
    </div>

    <div class="rejilla rejilla-2" style="margin-top:var(--r4)">
      ${tarjeta55}
      ${tarjetaInversion}
    </div>`;
}

export function montarResultado(cont, r) {
  const b55 = r.impuestos.beneficio55;
  const destino = cont.querySelector('#gr-55bis');
  if (destino && b55.filas.length) {
    destino.append(graficoBarras(
      b55.filas.map((f) => ({
        etiqueta: `A${f.anio}`,
        valor: f.ahorro,
        nombre: 'Ahorro tributario',
        texto: clp(f.ahorro),
      })),
      { formato: (v) => Math.round(v / 1000) + 'k', titulo: 'Ahorro tributario anual por el Art. 55 bis' },
    ));
  }
}

/* ====================================================================== */
/* 3. Comparar                                                             */
/* ====================================================================== */

export function vistaComparar(r, estado) {
  const vUF = r.entrada.mercado.valorUF;
  const evaluados = estado.escenarios.map((s) => {
    try {
      return { id: s.id, nombre: s.entrada.propiedad.nombre || s.nombre, r: evaluarOperacion(s.entrada) };
    } catch (err) {
      return { id: s.id, nombre: s.entrada.propiedad.nombre || s.nombre, error: String(err.message || err) };
    }
  });
  const validos = evaluados.filter((e) => !e.error);

  const metricas = [
    { titulo: 'Precio', mejor: 'menor', v: (x) => x.r.entrada.propiedad.precioUF, f: (v) => uf(v, 0) },
    { titulo: 'Pie necesario', mejor: 'menor', v: (x) => x.r.credito.pieUF, f: (v) => uf(v, 0) },
    { titulo: 'Dividendo mes 1', mejor: 'menor', v: (x) => x.r.credito.dividendoPrimerMesUF, f: (v) => `${uf(v)}` },
    { titulo: 'Dividendo en pesos', mejor: 'menor', v: (x) => x.r.credito.dividendoPrimerMesUF * vUF, f: clp },
    { titulo: 'CAE', mejor: 'menor', v: (x) => x.r.credito.caeAnual, f: (v) => pct(v) },
    { titulo: 'Carga financiera', mejor: 'menor', v: (x) => x.r.ingresos.carga.valor, f: (v) => pct(v, 1) },
    { titulo: 'Interés total', mejor: 'menor', v: (x) => x.r.credito.totalInteresUF, f: (v) => uf(v, 0) },
    { titulo: 'Desembolso total', mejor: 'menor', v: (x) => x.r.credito.costoTotalUF, f: (v) => uf(v, 0) },
    { titulo: 'Cap rate neto', mejor: 'mayor', v: (x) => x.r.inversion?.capRateNeto, f: (v) => pct(v) },
    { titulo: 'Flujo mensual', mejor: 'mayor', v: (x) => x.r.inversion?.flujoMensualUF, f: (v) => uf(v) },
    { titulo: 'TIR proyectada', mejor: 'mayor', v: (x) => x.r.proyeccion?.tirAnual, f: (v) => pct(v) },
    { titulo: 'Señales rojas', mejor: 'menor', v: (x) => x.r.veredicto.conteo.rojo, f: (v) => String(v) },
  ];

  const puntajes = Object.fromEntries(validos.map((x) => [x.id, 0]));
  const filasHtml = metricas.map((m) => {
    const valores = validos.map((x) => ({ id: x.id, valor: m.v(x) }));
    const utiles = valores.filter((v) => typeof v.valor === 'number' && Number.isFinite(v.valor));
    let ganador = null;
    if (utiles.length > 1) {
      ganador = (m.mejor === 'mayor'
        ? utiles.reduce((a, b) => (b.valor > a.valor ? b : a))
        : utiles.reduce((a, b) => (b.valor < a.valor ? b : a))).id;
      puntajes[ganador] += 1;
    }
    const celdas = valores.map((v) => {
      const texto = (typeof v.valor === 'number' && Number.isFinite(v.valor)) ? m.f(v.valor) : '—';
      return `<td class="num"><span${v.id === ganador ? ' class="gana"' : ''}>${esc(texto)}</span></td>`;
    }).join('');
    return `<tr><td>${esc(m.titulo)}</td>${celdas}</tr>`;
  }).join('');

  const encabezados = validos.map((x) =>
    `<th class="num">${esc(x.nombre)}${x.id === estado.activoId ? ' <span class="chip liso">activo</span>' : ''}</th>`).join('');

  const mejor = Object.entries(puntajes).sort((a, b) => b[1] - a[1])[0];
  const nombreMejor = validos.find((x) => x.id === mejor?.[0])?.nombre;

  const vs = r.versusArrendar;

  return `
    ${validos.length < 2
      ? aviso('info', '<span>Tienes un solo escenario. Usa <strong>Duplicar</strong> arriba para clonarlo y cambiarle la tasa, el plazo o el precio, y compararlos aquí lado a lado.</span>')
      : ''}
    ${evaluados.filter((e) => e.error).map((e) => aviso('error', `<span><strong>${esc(e.nombre)}</strong> no se pudo calcular: ${esc(e.error)}</span>`)).join('')}

    ${validos.length >= 2 ? tarjeta({
      titulo: 'Escenario por escenario',
      descripcion: `Gana el que queda marcado en cada fila. ${nombreMejor ? `Con ${mejor[1]} de ${metricas.length} métricas, el que más gana es ${nombreMejor}.` : ''}`,
      contenido: `<div class="tabla-envoltorio"><table>
        <thead><tr><th></th>${encabezados}</tr></thead>
        <tbody>${filasHtml}</tbody>
      </table></div>
      <p class="ayuda" style="margin-top:var(--r3)">Ganar más filas no significa ser mejor: pesa según lo que a ti te importe. Un escenario que gana en dividendo pero pierde en carga financiera te puede quebrar igual.</p>`,
    }) : ''}

    ${vs ? tarjeta({
      titulo: 'Comprar contra arrendar e invertir la diferencia',
      descripcion: `Con plusvalía real de ${pct(vs.supuestos.plusvaliaAnualReal, 1)} al año y una alternativa que rinde ${pct(vs.supuestos.rendimientoAlternativoAnualReal, 1)} real.`,
      contenido: `
        <div id="gr-patrimonio"></div>
        ${aviso(vs.ganadorAlFinal === 'comprar' ? 'info' : 'alerta', `<span>
          Al año ${vs.serie.length}, <strong>${vs.ganadorAlFinal === 'comprar' ? 'comprar' : 'arrendar'} deja más patrimonio</strong>,
          por ${esc(uf(Math.abs(vs.diferenciaFinalUF), 0))} (${esc(clp(Math.abs(vs.diferenciaFinalUF) * vUF))}).
          ${vs.anioDeCruce ? `Comprar pasa adelante en el año ${esc(numero(vs.anioDeCruce, 1))}.` : 'Comprar no alcanza a arrendar en este horizonte.'}
        </span>`)}
        <p class="ayuda">Esta comparación es la más sensible de todas a la plusvalía y al rendimiento alternativo. Muévelos en Datos y mira cuánto cambia el veredicto antes de creerle.</p>`,
    }) : ''}`;
}

export function montarComparar(cont, r) {
  const destino = cont.querySelector('#gr-patrimonio');
  if (destino && r.versusArrendar) {
    destino.append(graficoPatrimonio(r.versusArrendar.serie, {
      valorUF: r.entrada.mercado.valorUF,
      enPesos: false,
      anioDeCruce: r.versusArrendar.anioDeCruce,
    }));
  }
}

/* ====================================================================== */
/* 4. Riesgo                                                               */
/* ====================================================================== */

export function vistaRiesgo(r) {
  const e = r.entrada;
  const vUF = e.mercado.valorUF;
  const ing = r.ingresos;
  const v = r.veredicto;

  const señalesHtml = v.señales.map(senal).join('');

  const est = ing.estadisticaBoletas;
  const tarjetaBoletas = est ? tarjeta({
    titulo: 'Tus ingresos, medidos',
    descripcion: `${est.meses} meses cargados.`,
    contenido: `<div class="rejilla rejilla-3">
        <div><span class="etiqueta">Promedio</span><div class="num" style="font-size:1.1rem">${clp(est.promedio)}</div></div>
        <div><span class="etiqueta">Mediana</span><div class="num" style="font-size:1.1rem">${clp(est.mediana)}</div></div>
        <div><span class="etiqueta">Variabilidad</span><div class="num" style="font-size:1.1rem">${pct(est.coefVariacion, 0)}</div></div>
        <div><span class="etiqueta">Mejor trimestre</span><div class="num" style="font-size:1.1rem">${clp(est.mejorTrimestrePromedioMensual)}</div><span class="ayuda">promedio mensual</span></div>
        <div><span class="etiqueta">Peor trimestre</span><div class="num" style="font-size:1.1rem">${clp(est.peorTrimestrePromedioMensual)}</div><span class="ayuda">cae ${pct(est.caidaPeorTrimestre, 0)} bajo tu promedio</span></div>
        <div><span class="etiqueta">Meses sin facturar</span><div class="num" style="font-size:1.1rem">${est.mesesEnCero}</div></div>
      </div>
      <p class="ayuda" style="margin-top:var(--r3)">El promedio es lo que mira el banco. El peor trimestre es lo que te puede dejar sin pagar el dividendo. Los dos importan, pero solo uno te quita la casa.</p>`,
  }) : tarjeta({
    titulo: 'Tus ingresos, medidos',
    contenido: aviso('info', '<span>Carga tus boletas de los últimos 12 a 24 meses en <strong>Datos → Tus ingresos</strong>. Con eso se calcula tu volatilidad real, tu peor trimestre y el colchón que te conviene tener.</span>'),
  });

  const ret = ing.retencion;
  const tarjetaRetencion = ret ? tarjeta({
    titulo: 'La retención sube todos los años',
    descripcion: RETENCION_HONORARIOS_FUENTE,
    contenido: `${tabla([
        { titulo: 'Año', num: false, obtener: (f) => String(f.anio) },
        { titulo: 'Retención', obtener: (f) => pct(f.tasaRetencion, 2) },
        { titulo: 'Te llega al mes', obtener: (f) => clp(f.liquidoRecibido) },
      ], ret.filas)}
      <p class="ayuda" style="margin-top:var(--r3)">Facturando exactamente lo mismo, en 2028 recibirás <strong>${clp(ret.caidaLiquidaMensual)} menos al mes</strong> que hoy. El dividendo, en cambio, no baja.</p>`,
  }) : '';

  const checklist = checklistIndependiente(e.perfil);
  const esIndep = e.perfil.modalidad === 'honorarios' || e.perfil.modalidad === 'mixto';
  const tarjetaChecklist = esIndep ? tarjeta({
    titulo: 'Lo que te va a pedir el banco',
    descripcion: 'Como independiente, la carpeta pesa tanto como la renta.',
    contenido: `<ul class="desglose">${checklist.map((c) => `<li>
        <span class="concepto"><strong>${esc(c.item)}</strong>${c.nota ? `<br><span class="ayuda">${esc(c.nota)}</span>` : ''}</span>
      </li>`).join('')}</ul>`,
  }) : '';

  return `
    ${aviso(v.conteo.rojo > 0 ? 'error' : v.conteo.ambar > 0 ? 'alerta' : 'info', `<span>${esc(v.resumen)}</span>`)}

    <div class="rejilla rejilla-2" style="margin-top:var(--r4)">${señalesHtml}</div>

    ${tarjeta({
      titulo: 'Qué supuesto mueve más tu dividendo',
      descripcion: 'Cada barra es cuánto cambia el dividendo si ese supuesto se mueve a un extremo razonable, dejando todo lo demás igual.',
      contenido: `<div id="gr-tornado"></div>
        <p class="ayuda" style="margin-top:var(--r3)">Lo que está arriba es donde vale la pena negociar. Lo que está abajo es ruido: no gastes energía ahí.</p>`,
      clase: 'plana',
    })}

    <div class="rejilla rejilla-2" style="margin-top:var(--r4)">
      ${tarjeta({
        titulo: 'Tu capacidad de pago',
        contenido: `<ul class="desglose">
          <li><span class="concepto">Renta que el banco te reconoce</span><span class="monto">${clp(ing.renta.total)}</span></li>
          <li><span class="concepto">Cupo total (${pct(e.perfil.cargaMaxima, 0)})</span><span class="monto">${clp(ing.capacidad.cupoTotal)}</span></li>
          <li><span class="concepto">Menos otras deudas</span><span class="monto">${clp(-ing.capacidad.otrasDeudasMensuales)}</span></li>
          <li class="total"><span class="concepto">Dividendo máximo</span><span class="monto">${clp(ing.capacidad.dividendoMaximo)}</span></li>
        </ul>
        <p class="ayuda" style="margin-top:var(--r3)">${esc(ing.renta.nota || '')}</p>
        <div class="rejilla rejilla-2" style="margin-top:var(--r4)">
          <div><span class="etiqueta">Precio máximo que alcanzas</span><div class="num" style="font-size:1.2rem">${uf(ing.alcance.precioMaximoUF, 0)}</div><span class="ayuda">${clp(ing.alcance.precioMaximoUF * vUF)}</span></div>
          <div><span class="etiqueta">Pie que necesitarías</span><div class="num" style="font-size:1.2rem">${uf(ing.alcance.pieNecesarioUF, 0)}</div><span class="ayuda">${clp(ing.alcance.pieNecesarioUF * vUF)}</span></div>
        </div>`,
      })}
      ${tarjetaBoletas}
    </div>

    <div class="rejilla rejilla-2" style="margin-top:var(--r4)">
      ${tarjetaRetencion}
      ${tarjetaChecklist}
    </div>`;
}

export function montarRiesgo(cont, r) {
  const destino = cont.querySelector('#gr-tornado');
  if (destino) {
    destino.append(graficoTornado(r.sensibilidad.filas, r.sensibilidad.base, {
      valorUF: r.entrada.mercado.valorUF,
      enPesos: false,
    }));
  }
}

/* ====================================================================== */
/* 5. Tabla de amortización                                                */
/* ====================================================================== */

export function vistaTabla(r, estado) {
  const vUF = r.entrada.mercado.valorUF;
  const enPesos = estado.tablaEnPesos === true;
  const f = (v) => (enPesos ? clp(v * vUF) : ufCorto(v));
  const filas = r.credito.filas;
  const soloAnual = estado.tablaAnual !== false;
  const mostradas = soloAnual ? filas.filter((x) => x.mes % 12 === 0) : filas;

  return `
    ${tarjeta({
      titulo: 'Mes a mes',
      descripcion: 'Cómo se reparte cada pago entre interés y capital, y cuánto debes en cada momento.',
      contenido: `
        <div class="acciones" style="margin-bottom:var(--r3)">
          <div class="segmentado" role="group" aria-label="Detalle de la tabla">
            <button type="button" data-accion="tabla-anual" aria-pressed="${soloAnual}">Cierre de cada año</button>
            <button type="button" data-accion="tabla-mensual" aria-pressed="${!soloAnual}">Todos los meses</button>
          </div>
          <div class="segmentado" role="group" aria-label="Unidad">
            <button type="button" data-accion="tabla-uf" aria-pressed="${!enPesos}">UF</button>
            <button type="button" data-accion="tabla-clp" aria-pressed="${enPesos}">Pesos</button>
          </div>
          <button type="button" class="boton" data-accion="exportar-csv">Descargar CSV</button>
        </div>
        <div id="gr-amortizacion"></div>`,
      clase: 'plana',
    })}

    <div style="margin-top:var(--r4)">
      ${tabla([
        { titulo: 'Mes', num: false, obtener: (x) => String(x.mes) },
        { titulo: 'Año', obtener: (x) => String(Math.ceil(x.mes / 12)) },
        { titulo: 'Dividendo', obtener: (x) => f(x.dividendoUF) },
        { titulo: 'Interés', obtener: (x) => f(x.interes) },
        { titulo: 'Capital', obtener: (x) => f(x.amortizacion) },
        { titulo: 'Seguros', obtener: (x) => f(x.segurosUF) },
        { titulo: 'Abono', obtener: (x) => (x.abonoExtra > 0 ? f(x.abonoExtra) : '—') },
        { titulo: 'Saldo', obtener: (x) => f(x.saldo) },
      ], mostradas)}
    </div>
    <p class="ayuda" style="margin-top:var(--r3)">${mostradas.length} de ${filas.length} meses. Los montos en UF son reales: no incluyen inflación porque la UF ya la absorbe.</p>`;
}

export function montarTabla(cont, r, estado) {
  const destino = cont.querySelector('#gr-amortizacion');
  if (destino) {
    destino.append(graficoAmortizacion(r.credito.filas, {
      valorUF: r.entrada.mercado.valorUF,
      enPesos: estado.tablaEnPesos === true,
    }));
  }
}

/* ====================================================================== */
/* 6. Supuestos                                                            */
/* ====================================================================== */

export function vistaSupuestos(r) {
  const filas = Object.entries(SUPUESTOS).map(([clave, s]) => ({ clave, ...s }));
  const porConfianza = { alta: [], media: [], baja: [] };
  for (const f of filas) porConfianza[f.confianza].push(f);

  const seccion = (nivel, titulo, descripcion) => tarjeta({
    titulo,
    descripcion,
    contenido: `<ul class="desglose">${porConfianza[nivel].map((s) => `<li>
        <span class="concepto"><strong>${esc(s.etiqueta)}</strong><br>
          <span class="ayuda">${esc(s.fuente)}${s.nota ? ` — ${esc(s.nota)}` : ''}</span></span>
        <span class="monto">${insigniaConfianza(s.confianza)}</span>
      </li>`).join('')}</ul>`,
  });

  return `
    ${aviso('info', `<span>Todos los parámetros se verificaron al <strong>${esc(VERIFICADO_AL)}</strong>. Ninguno está fijo en el código: todos se pueden editar en la pestaña Datos.</span>`)}

    <div class="rejilla" style="margin-top:var(--r4)">
      ${seccion('alta', 'Están en la ley o los publica el Banco Central', 'Cámbialos solo si la norma cambió.')}
      ${seccion('media', 'Varían entre bancos y perfiles', 'El valor por defecto es un punto medio razonable. Reemplázalo con tu cotización.')}
      ${seccion('baja', 'Cotiza estos antes de decidir', 'Varían tanto que el valor por defecto es apenas un orden de magnitud.')}
    </div>

    ${tarjeta({
      titulo: 'Cómo verificar que los números están bien',
      contenido: `
        <p>El motor de cálculo tiene 127 pruebas automáticas, incluida una que valida los tramos del Global Complementario contra las rebajas oficiales publicadas por el SII. Aun así, conviene que contrastes tu caso concreto:</p>
        <ol style="padding-left:1.2em; font-size:0.88rem; color:var(--tinta-2); line-height:1.7">
          <li>Simula el mismo crédito en el sitio de dos bancos (BancoEstado y Santander publican simuladores abiertos).</li>
          <li>Compara la <strong>cuota</strong>, no el dividendo: los simuladores casi nunca incluyen seguros.</li>
          <li>Si la diferencia supera el 1%, cambia la convención de tasa entre nominal y efectiva en Datos → El crédito. Esa es la causa en la mayoría de los casos.</li>
          <li>Si aun así no calza, ajusta las tarifas de seguros y gastos con las de tu cotización.</li>
        </ol>`,
    })}

    ${tarjeta({
      titulo: 'Tus datos',
      contenido: `
        <p>Todo lo que escribes se guarda solo en este navegador. La aplicación no tiene servidor, no envía nada a ninguna parte y funciona sin conexión.</p>
        <div class="acciones">
          <button type="button" class="boton" data-accion="exportar-json">Exportar todo (JSON)</button>
          <button type="button" class="boton" data-accion="importar-json">Importar</button>
          <button type="button" class="boton peligro" data-accion="borrar-todo">Borrar todo</button>
        </div>`,
    })}`;
}
