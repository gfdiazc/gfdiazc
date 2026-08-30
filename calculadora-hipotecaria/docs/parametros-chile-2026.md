# Parámetros del mercado chileno

**Verificados al 30 de agosto de 2026.** Todos viven en
`src/engine/parametros.js` y todos son editables desde la aplicación: ninguno
está fijo en la lógica de cálculo.

Cada parámetro declara un nivel de confianza, y ese nivel cambia lo que debes
hacer con él.

| Confianza | Qué significa | Qué hacer |
|---|---|---|
| **Alta** | Está en la ley o lo publica el Banco Central o el SII | Cámbialo solo si la norma cambió |
| **Media** | Varía entre bancos y perfiles | El default es un punto medio; reemplázalo con tu cotización |
| **Baja** | Varía tanto que el default es apenas un orden de magnitud | Cotiza antes de decidir nada |

---

## Confianza alta

| Parámetro | Valor | Fuente |
|---|---|---|
| Valor de la UF | $40.871 | Banco Central, 29-ago-2026. Cambia a diario |
| Valor de la UTM | $71.649 | SII, agosto 2026. 1 UTA = 12 UTM = $859.788 |
| Retención de honorarios | 15,25% (2026) · 16% (2027) · 17% (2028) | Ley 21.133, calendario gradual del SII |
| Impuesto de timbres y estampillas | 0,8% del crédito · 0,2% si DFL2 · 0% vivienda social | DL 3.475 |
| Tope FOGAES Vivienda | UF 6.000 | Ampliación aprobada el 12-ago-2026 (venía de UF 4.500) |
| Financiamiento máximo con FOGAES | 90% del valor (pie de 10%) | Programa FOGAES Vivienda |
| Tope Subsidio al Dividendo | UF 6.000 | Ampliación de ago-2026 (venía de UF 4.000) |
| Rebaja del Subsidio al Dividendo | 60 puntos base | Ley de Subsidio al Dividendo |
| Cupos y plazo del subsidio | 80.000 cupos · hasta 31-05-2028 | Ampliación de ago-2026 (venía de 50.000 y 27-05-2027) |
| Tope del Art. 55 bis | 8 UTA anuales | Art. 55 bis LIR |
| Degradación del Art. 55 bis | 100% bajo 90 UTA · 0% sobre 150 UTA | Art. 55 bis LIR |
| Gastos presuntos de honorarios | 30% de los ingresos, tope 15 UTA | Art. 50 LIR |
| Tramos del Global Complementario | 0 / 4 / 8 / 13,5 / 23 / 30,4 / 35 / 40% | Art. 52 LIR |
| Superficie máxima DFL2 | 140 m² útiles | DFL 2 de 1959 |
| Exención de ganancia de capital | 8.000 UF de por vida, 10% sobre el exceso | Art. 17 N°8 LIR |

### Detalle de FOGAES y del Subsidio al Dividendo

Son **dos programas distintos** que se anunciaron juntos y suelen confundirse.
Puedes calificar para uno, para el otro, para ambos o para ninguno.

**FOGAES Vivienda** — garantía estatal que permite financiar hasta el 90%.
Requiere: primera vivienda · valor hasta UF 6.000 · no haber recibido subsidio
estatal de vivienda · no estar en el Registro Nacional de Deudores de Pensiones
de Alimentos · un solo uso. No reemplaza la evaluación crediticia del banco.

**Subsidio al Dividendo** — rebaja de 60 puntos base en la tasa. Requiere:
vivienda **nueva** · valor hasta UF 6.000 · promesa de compraventa firmada desde
el 1-ene-2025 · cupos disponibles · postulación hasta el 31-05-2028.

---

## Confianza media

| Parámetro | Default | Rango habitual |
|---|---|---|
| Tasa hipotecaria anual en UF | 4,0% | 3,5% – 5,0% según banco, pie, plazo y perfil |
| Seguro de desgravamen | 0,025% mensual sobre saldo insoluto | 0,020% – 0,035% |
| Seguro de incendio y sismo | 0,022% mensual sobre valor de tasación | 0,015% – 0,030% |
| Castigo de renta para independientes | 75% | 70% – 80% |
| Carga financiera máxima | 25% de la renta acreditable | 25% – 30% |
| Arancel del Conservador de Bienes Raíces | 0,2% del precio, con tope | El tope se reajusta |

La tasa de 4,0% es el promedio ponderado que publica el Banco Central para
operaciones en UF a más de 3 años en el Gran Santiago (jul-2026). Tu cotización
individual puede quedar bastante arriba o abajo de ahí.

El desgravamen depende fuertemente de tu edad y de si el crédito va a nombre de
uno o de dos deudores. A los 30 años estás cerca del piso del rango; a los 50,
cerca del techo.

El seguro de incendio y sismo se calcula sobre el **valor de reconstrucción**,
no sobre el precio de compra, y puedes contratarlo fuera del banco — suele salir
más barato.

---

## Confianza baja: cotiza esto

| Parámetro | Default | Nota |
|---|---|---|
| Tasación | UF 3 | Varios bancos la regalan en campaña |
| Estudio de títulos y redacción de escritura | UF 5 | |
| Notaría (mutuo) | UF 2 | |
| Notaría (compraventa) | UF 3 | Suele repartirse con el vendedor |
| Tope del arancel del Conservador | UF 32 | Se reajusta |

Con estos valores, los gastos operacionales del caso base dan **1,56% del monto
financiado**, apenas sobre el rango de referencia de 1,3%–1,5% que se cita
habitualmente. La aplicación levanta una alerta si el total se sale del rango
0,8%–2,5%, que es donde casi siempre hay un supuesto mal cargado.

---

## Cómo actualizar estos valores

1. **UF y UTM**: `bcentral.cl` y `sii.cl`. La UF cambia todos los días; la UTM,
   todos los meses. En la aplicación la UF se edita arriba a la derecha.
2. **Tasas de mercado**: la serie del Banco Central de tasas hipotecarias en UF,
   o directamente las cotizaciones que pidas.
3. **Topes de FOGAES y del subsidio**: revisa si hubo una nueva ampliación. La de
   agosto de 2026 subió los topes a UF 6.000 y extendió el plazo a mayo de 2028.
4. **Retención de honorarios**: el calendario de la Ley 21.133 ya está completo
   hasta 2028 en `RETENCION_HONORARIOS`.
5. **Seguros y gastos**: reemplázalos con los de tu cotización formal apenas la
   tengas. Son los que más mueven la CAE.

Al actualizar, cambia también `VERIFICADO_AL` en `src/engine/parametros.js`.
