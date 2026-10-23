#!/usr/bin/env node
// html-to-figma CLI: capture any URL or HTML file into JSON the Figma plugin can import.
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { captureTarget } from './node-capture.mjs';

const HELP = `Uso: html-to-figma <url | archivo.html> [opciones]

Opciones:
  -o, --out <archivo>        Dónde guardar el JSON (por defecto: captura.json)
  -w, --width <px>           Ancho del viewport (por defecto: 1440)
      --height <px>          Alto del viewport (por defecto: 900)
  -s, --selector <css>       Capturar solo este elemento (ej. "#hero")
      --wait <ms>            Espera extra antes de capturar (por defecto: 500)
      --screenshot <png>     Guardar también una captura de pantalla
      --no-images            No descargar imágenes
  -h, --help                 Mostrar esta ayuda

Ejemplos:
  html-to-figma https://example.com -o example.json
  html-to-figma ./landing.html --width 390 --screenshot movil.png
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o', default: 'captura.json' },
    width: { type: 'string', short: 'w', default: '1440' },
    height: { type: 'string', default: '900' },
    selector: { type: 'string', short: 's' },
    wait: { type: 'string', default: '500' },
    screenshot: { type: 'string' },
    'no-images': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || positionals.length !== 1) {
  process.stdout.write(HELP);
  process.exit(values.help ? 0 : 1);
}

const log = (m) => process.stderr.write(m + '\n');
try {
  const result = await captureTarget(positionals[0], {
    width: Number(values.width),
    height: Number(values.height),
    selector: values.selector,
    waitMs: Number(values.wait),
    screenshot: values.screenshot,
    embedImages: !values['no-images'],
    log,
  });
  await writeFile(values.out, JSON.stringify(result));
  const failed = Object.values(result.images).filter((i) => i.error).length;
  const s = result.stats;
  log(`Listo: ${s.frames} frames, ${s.texts} textos, ${s.images} imágenes, ${s.svgs} SVG -> ${values.out}`);
  if (failed) log(`Aviso: ${failed} imágenes no se pudieron descargar (se verán como gris en Figma).`);
} catch (e) {
  log(`Error: ${e.message}`);
  process.exit(1);
}
