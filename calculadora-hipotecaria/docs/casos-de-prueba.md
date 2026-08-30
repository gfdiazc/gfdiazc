# Casos de prueba

Valores calculados por el motor y congelados en los tests. Si cambias una
fórmula y estos números se mueven, o encontraste un error o lo introdujiste.

## Caso base

| Parámetro | Valor |
|---|---|
| Precio | UF 3.200 |
| Pie | 20% → UF 640 |
| Crédito | UF 2.560 |
| Tasa anual | 4,2% |
| Convención | nominal (÷12) |
| Plazo | 25 años (300 meses) |
| Desgravamen | 0,025% mensual sobre saldo |
| Incendio y sismo | 0,022% mensual sobre tasación |
| DFL2 | no |

### Resultado

| Concepto | UF |
|---|---|
| Cuota pelada | **13,7969** |
| Desgravamen mes 1 | 0,6400 |
| Incendio y sismo (fijo) | 0,7040 |
| **Dividendo mes 1** | **15,1409** |
| Dividendo mes 300 | 14,5044 |
| Gastos operacionales | 39,8800 (1,558% del crédito) |
| Interés total | 1.579,08 |
| Seguros totales | 323,99 |
| Desembolso total | 4.463,07 |
| Costo total (pie + gastos + desembolsos) | 5.142,95 |
| **CAE** | **5,2643%** |

Con UF a $40.871, el dividendo del primer mes son **$618.824**.

### Variaciones sobre el caso base

| Variación | Resultado |
|---|---|
| Convención efectiva | cuota 13,6846 UF (−0,81%) |
| DFL2 | impuesto al mutuo UF 5,12 en vez de UF 20,48 |
| Pie 10% (FOGAES) | dividendo 16,9455 UF · interés total 1.776,46 UF |

El caso de FOGAES es el que más conviene mirar: con pie de 10% entras con UF 320
menos, pero pagas **1,80 UF más cada mes** y **UF 197 más de interés** en total.

---

## Tributario

Con UTM = $71.649 y UTA = $859.788.

| Caso | Resultado |
|---|---|
| IGC sobre 40 UTA | $1.255.290 · tasa marginal 8% |
| IGC bajo 13,5 UTA | $0 · exento |
| Art. 55 bis: renta 60 UTA, intereses 4 UTA | factor 1,000 · rebaja $3.439.152 · ahorro $464.286 |
| Art. 55 bis: renta 90 UTA | factor ≈ 1,000 |
| Art. 55 bis: renta 120 UTA | factor ≈ 0,500 |
| Art. 55 bis: renta 150 UTA | factor ≈ 0,000 |
| Art. 55 bis: intereses 20 UTA | se acotan a 8 UTA (tope) |

### Contraste contra la tabla oficial del SII

El impuesto se calcula sumando tramo a tramo. Un test verifica que el resultado
coincide con la fórmula oficial `renta × factor − rebaja` en los siete tramos:

| Renta (UTA) | Factor | Rebaja (UTA) |
|---|---|---|
| 25 | 0,04 | 0,54 |
| 40 | 0,08 | 1,74 |
| 60 | 0,135 | 4,49 |
| 80 | 0,23 | 11,14 |
| 100 | 0,304 | 17,80 |
| 200 | 0,35 | 23,32 |
| 400 | 0,40 | 38,82 |

Que estas rebajas se reproduzcan es la validación externa más fuerte que tiene
el motor: son constantes publicadas que no salieron de este código.

---

## Honorarios

| Caso | Resultado |
|---|---|
| Boleta de $1.000.000 en 2026 | retención $152.500 · líquido $847.500 |
| Retención 2026 / 2027 / 2028 | 15,25% / 16% / 17% |
| Facturando $2.000.000, caída de líquido 2026→2028 | $35.000 al mes |
| Gastos presuntos sobre 100 UTA | se acotan a 15 UTA |
| Boletas `[180, 40, 20, 30, 150, 200, 220, 190, 240, 210, 260, 180]` | peor trimestre 30/mes · cae 79% bajo el promedio |

---

## Capacidad de pago

| Caso | Resultado |
|---|---|
| Dividendo máximo UF 15, pie 20%, 4,2%, 25 años | precio máximo UF 3.170,22 · pie UF 634,04 |
| Renta acreditable $2.000.000, otras deudas $200.000, carga 25% | dividendo máximo $300.000 |
| Boletas $2.500.000/mes con F22 de $24.000.000 | manda el F22: base $2.000.000 → acreditable $1.500.000 |

---

## Cómo contrastar contra un banco

El motor está verificado contra sí mismo. Para verificarlo contra el mercado:

1. Entra al simulador de **BancoEstado** o **Santander** (ambos son abiertos).
2. Simula el mismo crédito: mismo monto, misma tasa, mismo plazo.
3. Compara la **cuota**, no el dividendo. Los simuladores casi nunca incluyen
   seguros, así que compararlos contra el dividendo va a dar distinto siempre.
4. Anota la diferencia:

   | Banco | Cuota del simulador | Cuota del motor | Diferencia |
   |---|---|---|---|
   | | | | |
   | | | | |

5. **Si la diferencia es menor a 1%**, casi seguro es redondeo o la convención de
   tasa. Cambia entre nominal y efectiva en Datos → El crédito y vuelve a mirar.
6. **Si es mayor a 1%**, revisa que el monto del crédito sea el mismo: algunos
   simuladores financian los gastos operacionales dentro del crédito por defecto.
7. Una vez que la cuota calce, ajusta las tarifas de seguros y gastos con las de
   tu cotización formal. Ahí el dividendo también va a calzar.

## Cómo correr los tests

```
node --test "calculadora-hipotecaria/tests/*.test.js"
```

Sin instalar nada: Node 22 ejecuta los módulos directamente.
