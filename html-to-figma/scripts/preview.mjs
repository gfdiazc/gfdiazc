// Visual check without Figma: capture a page, run the plugin against a mock Figma
// API, and save the original and the rebuilt layers side by side as PNGs.
//   node scripts/preview.mjs <url|file.html> [outDir] [width]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { captureTarget } from '../src/node-capture.mjs';
import { runPlugin, imageDiff } from '../tests/harness/run-plugin.mjs';

const [target, outDir = 'out', width = '1440'] = process.argv.slice(2);
if (!target) {
  console.error('Uso: node scripts/preview.mjs <url|archivo.html> [carpeta] [ancho]');
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const original = path.join(outDir, 'original.png');
const rebuilt = path.join(outDir, 'figma.png');
const data = await captureTarget(target, { width: Number(width), screenshot: original, log: (m) => console.error(m) });
await writeFile(path.join(outDir, 'captura.json'), JSON.stringify(data));
const browser = await chromium.launch();
try {
  const r = await runPlugin(browser, data, { screenshot: rebuilt });
  const done = r.messages.find((m) => m.type === 'done' || m.type === 'error');
  console.log(JSON.stringify({ result: done, counts: r.counts, mockErrors: r.errors }, null, 2));
  console.log('Diferencia visual promedio: ' + ((await imageDiff(browser, original, rebuilt)) * 100).toFixed(2) + '%');
  console.log(`Imágenes en ${outDir}/original.png y ${outDir}/figma.png`);
} finally {
  await browser.close();
}
