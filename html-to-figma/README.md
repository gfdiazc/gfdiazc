# HTML to Figma

Convierte HTML/CSS y páginas web en **capas editables de Figma**: frames, textos, imágenes, íconos SVG, bordes, esquinas, sombras y degradados.

Tiene dos partes:

| Parte | Para qué sirve |
|---|---|
| **Plugin de Figma** (`plugin/`) | Pegas HTML (o una URL o un JSON) dentro de Figma y crea las capas. |
| **CLI** (`src/cli.mjs`) | Abre **cualquier sitio** en un navegador real y genera un JSON que el plugin importa. Úsala cuando el plugin no pueda leer el sitio directamente. |

## Cómo funciona

1. La página se renderiza en un navegador: un iframe dentro del plugin o Chromium en la CLI.
2. `src/capture.js` recorre cada elemento y lee su posición, tamaño y estilos finales.
3. Esos estilos se traducen a propiedades de Figma (pinturas, efectos, fuentes) y se guardan como JSON.
4. `plugin/code.js` lee el JSON y crea las capas con la API de plugins de Figma.

## 1. Instalar el plugin en Figma

Necesitas **Figma de escritorio**, porque los plugins en desarrollo no se pueden cargar desde el navegador.

1. Descarga esta carpeta (`html-to-figma/`) en tu computadora.
2. En Figma: **Menú → Plugins → Development → Import plugin from manifest…**
3. Elige `html-to-figma/plugin/manifest.json`.
4. Ábrelo desde **Plugins → Development → HTML to Figma**.

No necesitas instalar nada más: `plugin/ui.html` ya viene construido.

### Uso

- **Pestaña HTML**: pega una página completa o un fragmento. Funcionan los `<style>` y también scripts como Tailwind CDN. Si tu HTML usa imágenes con rutas relativas, escribe la **URL base**.
- **Pestaña URL**: solo funciona con sitios que permiten CORS. Para el resto usa la CLI.
- **Pestaña JSON**: importa el archivo generado por la CLI.
- **Ancho / Alto**: el tamaño de pantalla que se simula. Por ejemplo, 390 × 844 para móvil.

## 2. Usar la CLI (cualquier sitio web)

Requiere Node.js 18 o superior.

```bash
cd html-to-figma
npm install
npx playwright install chromium   # solo la primera vez

node src/cli.mjs https://tusitio.com -o tusitio.json
node src/cli.mjs ./landing.html --width 390 --screenshot movil.png
node src/cli.mjs https://tusitio.com --selector "#hero" -o hero.json
```

Después, en el plugin: pestaña **JSON**, eliges el archivo y pulsas **Convertir a Figma**.

La CLI descarga las imágenes y convierte a PNG los formatos que Figma no acepta (WebP, AVIF, SVG). Antes de capturar, recorre la página para cargar las imágenes diferidas (*lazy loading*).

## Qué se convierte

| CSS / HTML | En Figma |
|---|---|
| Cajas (`div`, `section`…) | Frames, con recorte si tienen `overflow: hidden` |
| `background-color`, `linear-gradient`, `radial-gradient`, `background-image` | Rellenos sólidos, degradados e imágenes |
| `border` (incluye bordes por lado y punteados) | Trazos interiores; los lados de otro color se dibujan como barras |
| `border-radius` | Radio por esquina |
| `box-shadow` (incluye `inset`), `filter: blur`, `backdrop-filter: blur` | Sombras y desenfoques |
| Texto | Capas de texto con fuente, peso, cursiva, tamaño, color, interlineado, espaciado, alineación, mayúsculas y subrayado |
| `<img>`, `<video poster>`, `<canvas>` | Rellenos de imagen respetando `object-fit` |
| `<svg>` | Vectores editables, con `currentColor` resuelto |
| `<input>`, `<textarea>`, `<select>` | Caja con su valor o *placeholder* |
| `z-index`, `opacity`, Shadow DOM | Orden de capas, opacidad y componentes web |

### Limitaciones conocidas

- Las capas quedan en **posición absoluta**. Todavía no se convierten a Auto Layout.
- No se capturan `::before`/`::after`, las viñetas de listas ni `transform` (rotaciones).
- Si una fuente no está instalada en Figma, se sustituye por la más cercana. El plugin te avisa cuál cambió.
- En la pestaña HTML, las imágenes de servidores que bloquean CORS salen como un rectángulo gris. Con la CLI sí se descargan.

## Desarrollo

```bash
npm install
npm test               # construye el plugin y corre todas las pruebas
npm run build          # regenera plugin/ui.html después de editar src/capture.js o ui.template.html
npm run preview -- ./tests/fixtures/landing.html out   # compara el original con lo que crearía el plugin
```

Las pruebas ejecutan `plugin/code.js` contra un **Figma simulado** (`tests/harness/mock-figma.js`). Ese simulador rechaza los mismos errores que Figma, como usar fuentes sin cargar o pinturas inválidas, y dibuja el resultado para compararlo pixel a pixel con la página original.

| Archivo | Qué es |
|---|---|
| `src/capture.js` | Captura en el navegador (compartida por el plugin y la CLI) |
| `src/node-capture.mjs`, `src/cli.mjs` | CLI con Playwright |
| `plugin/code.js` | Crea las capas en Figma |
| `plugin/ui.template.html` | Interfaz del plugin; `npm run build` genera `ui.html` |
| `tests/` | Pruebas, página de ejemplo y Figma simulado |
