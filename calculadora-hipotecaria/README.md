# Dividendo & Decisión

Calculadora de crédito hipotecario e inversión inmobiliaria para Chile, 2026.
Aplicación web de un solo archivo: sin servidor, sin API keys, sin dependencias,
funciona sin conexión.

## Qué hace que no hagan los simuladores de banco

**Calcula el dividendo de verdad.** Los simuladores muestran la cuota pelada.
Acá va cuota + desgravamen + incendio y sismo + comisiones, más los gastos
operacionales que nadie menciona hasta el día de la escritura. Y la CAE, que es
lo único que permite comparar dos bancos de forma justa.

**Modela FOGAES y el Subsidio al Dividendo** con los topes vigentes tras la
ampliación de agosto de 2026 (UF 6.000, 80.000 cupos, hasta mayo de 2028). Y
pone el trade-off completo a la vista: FOGAES se promociona como "compra con 10%
de pie", pero eso significa endeudarte más, dividendo más alto e intereses
totales mayores. La aplicación muestra las dos alternativas lado a lado sobre la
misma propiedad, y calcula cuánto tardarías en juntar el 20% considerando que
mientras ahorras el precio también sube.

**Trata en serio el ingreso a honorarios.** Los bancos reconocen del orden del
70%–80% del promedio de boletas de un independiente, y se quedan con el menor
entre eso y el F22. La retención subió a 15,25% en 2026 y llega a 17% en 2028,
así que tu líquido baja *durante* el crédito aunque factures lo mismo. Y sobre
todo: cargas tus boletas reales y la aplicación calcula tu peor trimestre y te
somete a una prueba de estrés contra él. Es la pregunta que hunde a los
independientes y que ningún banco te hace.

**Incluye el Art. 55 bis**, que casi nadie modela y que para una renta media
puede valer varios cientos de miles de pesos al año.

**Compara comprar contra arrendar** como corresponde: patrimonio contra
patrimonio, con el pie y la diferencia mensual invertidos en la alternativa.

## Usarla

Abre `dist/index.html` en cualquier navegador. Eso es todo.

Lo que escribas se guarda en ese navegador (`localStorage`) y no sale de tu
dispositivo: la aplicación no tiene servidor. Puedes exportar todo a JSON para
respaldarlo o llevarlo a otro equipo, y la tabla de amortización a CSV.

**Lo primero que conviene hacer:** actualizar el valor de la UF arriba a la
derecha, y reemplazar las tarifas de seguros y gastos con las de tu cotización
real (pestaña Datos). Son los parámetros que más mueven el resultado y los que
más varían entre bancos.

## Estructura

```
src/engine/     cálculo puro, sin DOM, testeable por separado
src/ui/         interfaz
tests/          128 pruebas
docs/           parámetros, modelo financiero, casos de prueba
build.mjs       empaqueta todo en dist/index.html
```

El motor está separado de la interfaz a propósito: la matemática financiera es
donde no puedes permitirte un error, y así se puede verificar sola.

## Desarrollo

```bash
node --test "tests/*.test.js"   # 128 pruebas, sin instalar nada
node build.mjs                  # regenera dist/index.html
```

Node 22 ejecuta los módulos directamente. El build concatena los módulos ESM en
un solo ámbito y **aborta si detecta identificadores repetidos** entre archivos,
para que nunca se pise un símbolo en silencio.

## Documentación

- [`docs/parametros-chile-2026.md`](docs/parametros-chile-2026.md) — cada
  parámetro con su fuente, su fecha y cuánta confianza merece.
- [`docs/modelo-financiero.md`](docs/modelo-financiero.md) — todas las fórmulas,
  las convenciones y por qué se eligieron.
- [`docs/casos-de-prueba.md`](docs/casos-de-prueba.md) — vectores numéricos
  congelados, y cómo contrastarlos contra el simulador de un banco.

## Advertencia

Esto es una herramienta de decisión, **no asesoría financiera ni una
preaprobación**. Los seguros, los gastos operacionales y el castigo de renta
varían de forma significativa entre bancos y solo quedan fijos con una cotización
formal. Ninguna cifra acá compromete a ninguna institución.

Los parámetros se verificaron al 30 de agosto de 2026. Revisa
`docs/parametros-chile-2026.md` antes de confiar en los valores por defecto.
