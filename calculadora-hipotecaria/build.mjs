/**
 * Empaqueta el motor, la interfaz y los estilos en un único index.html que
 * funciona sin servidor, sin red y sin dependencias.
 *
 * Los módulos son ESM, así que el build quita los `import`/`export` y los
 * concatena en un solo ámbito. Eso solo es válido si no hay identificadores
 * repetidos entre archivos, así que el script lo verifica y aborta si los hay:
 * es preferible un build que falla a una app con un símbolo pisado.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));

// Orden de dependencias. `parametros` primero porque todos leen sus constantes.
const MODULOS = [
  'src/engine/parametros.js',
  'src/engine/finanzas.js',
  'src/engine/credito.js',
  'src/engine/programas.js',
  'src/engine/impuestos.js',
  'src/engine/ingresos.js',
  'src/engine/inversion.js',
  'src/engine/escenarios.js',
  'src/engine/veredicto.js',
  'src/engine/index.js',
  'src/ui/formato.js',
  'src/ui/estado.js',
  'src/ui/componentes.js',
  'src/ui/graficos.js',
  'src/ui/vistas.js',
  'src/ui/app.js',
];

const RE_IMPORT = /^[ \t]*import\s+[\s\S]*?from\s*['"][^'"]*['"]\s*;?[ \t]*$/gm;
const RE_EXPORT_ESTRELLA = /^[ \t]*export\s+\*\s+from\s*['"][^'"]*['"]\s*;?[ \t]*$/gm;
const RE_REEXPORT = /^[ \t]*export\s*\{[^}]*\}\s*;?[ \t]*$/gm;
const RE_EXPORT_DECL = /^export\s+(?=(?:const|let|var|function|async\s+function|class)\b)/gm;

/** Identificadores declarados en el nivel superior de un módulo ya despojado. */
function declaracionesRaiz(codigo) {
  const nombres = [];
  const re = /^(?:const|let|var|function|async\s+function|class)\s+([A-Za-zÀ-ÿ_$][\w$À-ÿ]*)/gm;
  let m;
  while ((m = re.exec(codigo)) !== null) nombres.push(m[1]);
  return nombres;
}

function despojar(codigo) {
  return codigo
    .replace(RE_IMPORT, '')
    .replace(RE_EXPORT_ESTRELLA, '')
    .replace(RE_REEXPORT, '')
    .replace(RE_EXPORT_DECL, '')
    .trim();
}

const piezas = [];
const vistos = new Map();
const colisiones = [];

for (const ruta of MODULOS) {
  const crudo = readFileSync(join(raiz, ruta), 'utf8');
  const limpio = despojar(crudo);

  for (const nombre of declaracionesRaiz(limpio)) {
    if (vistos.has(nombre)) {
      colisiones.push(`${nombre}: declarado en ${vistos.get(nombre)} y en ${ruta}`);
    } else {
      vistos.set(nombre, ruta);
    }
  }

  piezas.push(`/* ===== ${ruta} ===== */\n${limpio}`);
}

if (colisiones.length) {
  console.error('Build abortado: identificadores repetidos entre módulos.\n');
  for (const c of colisiones) console.error('  · ' + c);
  console.error('\nRenombra uno de los dos antes de volver a compilar.');
  process.exit(1);
}

const css = readFileSync(join(raiz, 'src/estilos.css'), 'utf8');

// El archivo empieza directamente por <title>: así sirve tanto abierto a mano
// en el navegador como publicado, donde el envoltorio aporta html/head/body.
const html = `<title>Dividendo &amp; Decisión</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
[hidden] { display: none !important; }
${css}
</style>
<noscript><p style="padding:2rem;font-family:system-ui">Esta calculadora necesita JavaScript: todos los cálculos corren en tu navegador, no hay servidor que los haga por ti.</p></noscript>
<script type="module">
${piezas.join('\n\n')}

iniciar();
</script>
`;

mkdirSync(join(raiz, 'dist'), { recursive: true });
writeFileSync(join(raiz, 'dist/index.html'), html, 'utf8');

const kb = (html.length / 1024).toFixed(1);
console.log(`dist/index.html · ${kb} KB · ${MODULOS.length} módulos · ${vistos.size} símbolos`);
