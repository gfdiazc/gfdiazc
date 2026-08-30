# Modelo financiero

Todo el cálculo interno ocurre **en UF**. Los pesos aparecen solo en la capa de
presentación, multiplicando por el valor de la UF que tú ingresas. Eso tiene una
consecuencia que conviene tener presente: **todas las tasas de proyección son
reales**, no nominales. Una plusvalía de 2% anual en esta aplicación significa
2% por sobre la inflación, porque la UF ya absorbió la inflación.

---

## 1. La cuota

Amortización francesa, cuota constante:

```
C = P · i / (1 − (1 + i)^−n)
```

donde `P` es el capital, `i` la tasa del período y `n` el número de meses.

### La convención de tasa, que es donde casi siempre está la discrepancia

La práctica chilena en mutuos hipotecarios es dividir la tasa anual por 12:

```
i = tasa_anual / 12                    ← "nominal", el default
i = (1 + tasa_anual)^(1/12) − 1        ← "efectiva"
```

Las dos están implementadas y se eligen en Datos → El crédito. La diferencia no
es trivial: con UF 2.560 a 4,2% por 25 años, la cuota nominal es **13,7969 UF** y
la efectiva **13,6846 UF**, un 0,81% menos. Si tu número no calza con el
simulador de un banco, prueba cambiar esto antes que cualquier otra cosa.

---

## 2. El dividendo, que no es la cuota

```
dividendo = cuota
          + desgravamen        (tasa mensual × saldo insoluto, baja cada mes)
          + incendio y sismo   (tasa mensual × valor de tasación, fijo)
          + comisión de administración (si el banco la cobra)
```

El desgravamen sigue al saldo, así que el dividendo va bajando a lo largo del
crédito. En el caso base va de **15,1409 UF** el primer mes a **14,5044 UF** el
último. Ningún simulador de banco muestra esto.

El abono extraordinario **no** se cuenta dentro del dividendo: es voluntario. El
motor los separa en dos campos, `dividendoUF` (lo obligatorio) y `desembolsoUF`
(todo lo que sale de tu bolsillo ese mes). Mezclarlos inflaría artificialmente la
carga financiera y la CAE de quien decide prepagar.

---

## 3. Gastos operacionales

Se pagan una sola vez, al firmar: tasación, estudio de títulos, redacción de
escritura, notaría del mutuo, notaría de la compraventa, inscripción en el
Conservador (0,2% del precio con tope), e **impuesto de timbres y estampillas**.

El impuesto es 0,8% del monto del crédito, 0,2% si la vivienda es DFL2, y 0% en
vivienda social. En el caso base eso son UF 20,48; con DFL2, UF 5,12.

### Si financias los gastos dentro del crédito

El impuesto se calcula sobre el crédito, y el crédito incluye los gastos, así que
el cálculo es circular. Se resuelve algebraicamente en vez de iterando:

```
C = (B + G) / (1 − t)
```

donde `B` es el crédito base, `G` los gastos que no dependen del monto, y `t` la
tasa del impuesto al mutuo.

---

## 4. CAE (Carga Anual Equivalente)

Es la TIR del flujo que realmente vives: recibes el crédito **menos** los gastos
que te cobran al firmar, y pagas el desembolso completo cada mes.

```
flujos = [ crédito − gastos, −desembolso₁, −desembolso₂, …, −desembolsoₙ ]
CAE    = (1 + TIR_mensual)^12 − 1
```

Es la única cifra que permite comparar dos ofertas de bancos distintos de forma
justa, porque incorpora seguros y gastos.

**Un dato útil de calibración:** en un crédito chileno normal la CAE corre
alrededor de **1,05 puntos porcentuales** sobre la tasa nominal, y esa brecha se
mantiene casi constante a cualquier nivel de tasa (a 3,5% la CAE da 4,55%; a 5,5%
da 6,61%). Por eso el semáforo del veredicto solo se enciende sobre 1,2 puntos:
la brecha en sí es estructural, no una señal de alarma.

La TIR se resuelve por bisección, no por Newton-Raphson: es más lenta pero
converge siempre, que es lo que quieres cuando el resultado orienta una decisión
de 25 años.

---

## 5. Capacidad de pago

### Renta que el banco reconoce

Para un dependiente, el líquido completo. Para ingresos variables:

```
base  = min( promedio de boletas , renta líquida del F22 / 12 )
renta = base × factor_castigo          (0,70 – 0,80; default 0,75)
```

El banco cruza las dos fuentes y se queda con la menor. Si descuentas gastos en
tu F22, ese será el número que mande — es el caso típico del independiente.

### Dividendo máximo

```
dividendo_max = renta_acreditable × carga_máxima − otras_deudas
```

### Precio máximo que alcanzas

Es la inversa, y no es un despeje directo: el seguro de incendio depende del
precio, que depende del crédito, que depende de cuánto del dividendo queda libre
después del seguro. Se resuelve por punto fijo, que converge en pocas vueltas.
El test de ida y vuelta verifica que el precio devuelto genere exactamente el
dividendo de entrada.

---

## 6. Honorarios

**Retención** (Ley 21.133): 15,25% en 2026, 16% en 2027, 17% en 2028. La
aplicación proyecta el calendario porque afecta tu flujo *durante* el crédito:
facturando lo mismo, en 2028 recibirás menos que hoy, y el dividendo no baja.

**Cotizaciones obligatorias**: se calculan sobre el 80% de los honorarios brutos.

**Volatilidad**: de las boletas que cargas se calcula media, mediana, desviación,
coeficiente de variación, meses en cero y **la peor ventana de 3 meses
consecutivos**. Esa última es la que importa: lo que te quiebra no es el mes
promedio sino la racha mala.

**Colchón recomendado**: `6 + 24 × coeficiente_de_variación`, acotado entre 6 y
18 meses. Es una regla de oficio, no de ley, y está declarada como tal.

---

## 7. Tributario

### Global Complementario

Se calcula sumando tramo a tramo en vez de usar la fórmula
`renta × factor − rebaja`. Da exactamente lo mismo pero no depende de constantes
de rebaja que puedan quedar obsoletas. Hay un test que verifica que el resultado
reproduce las rebajas oficiales publicadas por el SII en los siete tramos.

### Art. 55 bis

```
factor = acotar( (250 − 1,667 × renta_en_UTA) / 100 , 0 , 1 )
rebaja = min(intereses_del_año, 8 UTA) × factor
ahorro = IGC(renta) − IGC(renta − rebaja)
```

El factor da 100% en 90 UTA y 0% en 150 UTA. Solo cuentan los intereses: no el
capital, no los seguros, no las comisiones. Como los intereses son altos al
principio del crédito y bajan con el tiempo, el beneficio se concentra en los
primeros años.

### DFL2

Si la vivienda tiene hasta 140 m² útiles y eres persona natural con no más de dos
viviendas acogidas: impuesto al mutuo de 0,2% en vez de 0,8%, rebaja del impuesto
territorial, y **las rentas de arrendamiento no constituyen renta**. Ese último
punto cambia bastante el rendimiento neto del escenario de arriendo.

---

## 8. Inversión

```
ingreso_efectivo = arriendo_bruto × (1 − vacancia)
gastos_op        = gastos_comunes_en_vacancia + administración + mantención
                 + contribuciones + seguro
NOI              = ingreso_efectivo − gastos_op
flujo            = NOI − servicio_de_deuda − impuesto_al_arriendo

cap_rate_bruto   = arriendo_anual / inversión_total
cap_rate_neto    = NOI / inversión_total
cash_on_cash     = flujo_anual / capital_invertido
```

`inversión_total` incluye precio más gastos de compra más habilitación.
`capital_invertido` es pie más gastos más habilitación: lo que efectivamente
pusiste de tu bolsillo.

### TIR proyectada

Flujos anuales más la venta al final del horizonte:

```
venta_neta = precio × (1 + plusvalía)^N − comisión − saldo_insoluto − impuesto
```

El impuesto a la ganancia de capital considera la exención de 8.000 UF de por
vida, así que en la práctica rara vez aparece para una primera vivienda.

### Puntos de equilibrio

El arriendo mensual que deja el flujo en cero se despeja del factor completo,
porque el arriendo entra afectado por vacancia, administración y mantención:

```
arriendo_equilibrio = (servicio_deuda + gastos_fijos) / factor
factor = (1 − vacancia) × (1 − administración) − mantención
```

La plusvalía mínima para alcanzar una TIR objetivo se resuelve por bisección
sobre la proyección completa.

---

## 9. Comprar contra arrendar

La comparación honesta no es dividendo contra arriendo: es **patrimonio contra
patrimonio**.

- **Comprando**: pagas pie y gastos al inicio. Cada mes pagas dividendo más
  costos de propietario. Tu patrimonio es el valor de la propiedad menos la
  comisión de venta, menos lo que debes.
- **Arrendando**: el pie y los gastos quedan invertidos rindiendo la tasa
  alternativa. Cada mes pagas arriendo, y la diferencia contra el costo de ser
  propietario se invierte (o se consume, si arrendar sale más caro).

Se simula mes a mes y se reporta el año de cruce. Es la comparación **más
sensible de todas** a los supuestos de plusvalía y rendimiento alternativo:
muévelos antes de creerle al resultado.

---

## 10. Invariantes verificadas

El motor tiene 128 pruebas. Estas son las que sostienen todo lo demás:

- La suma de amortizaciones más abonos iguala exactamente el capital.
- El saldo final es cero (tolerancia 1e-9).
- `interés + capital + seguros = desembolso total`.
- La TIR del flujo de un crédito reproduce su propia tasa (1e-8).
- La CAE supera la tasa nominal siempre que haya seguros o gastos, y coincide con
  la tasa anualizada cuando no los hay.
- `capitalDesdeCuota` es la inversa exacta de `cuotaFrancesa`.
- La capacidad de compra, recalculada hacia adelante, reproduce el dividendo de
  entrada.
- El IGC reproduce las rebajas oficiales del SII en los siete tramos.
- El Art. 55 bis da factor 1 bajo 90 UTA y 0 sobre 150 UTA.
- Subir el precio empeora la carga financiera de forma monótona.
