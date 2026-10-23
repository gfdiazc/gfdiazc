import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { captureTarget } from '../src/node-capture.mjs';

const fixture = fileURLToPath(new URL('./fixtures/landing.html', import.meta.url));
let data;
before(async () => {
  data = await captureTarget(fixture, { width: 1440 });
});

function all(node, out = []) {
  out.push(node);
  (node.children || []).forEach((c) => all(c, out));
  return out;
}
const find = (pred) => all(data.root).find(pred);

test('captures the page as a root frame with page size', () => {
  assert.equal(data.generator, 'html-to-figma');
  assert.equal(data.root.width, 1440);
  assert.ok(data.root.height >= 800);
  assert.equal(data.source.title, 'Landing de prueba');
});

test('skips hidden elements', () => {
  assert.equal(find((n) => n.type === 'TEXT' && n.characters.includes('No debería')), undefined);
});

test('keeps text content, styles and spacing next to inline elements', () => {
  const bold = find((n) => n.type === 'TEXT' && n.characters === 'capas reales');
  assert.ok(bold, 'bold text captured');
  assert.equal(bold.style.fontWeight, 700);
  const after = find((n) => n.type === 'TEXT' && n.characters === 'de' && n.y === bold.y);
  assert.ok(after, 'text after <strong> split into its own line piece');
  assert.ok(after.x > bold.x + bold.width, 'starts after the bold word, leaving the space');
  const btn = find((n) => n.type === 'TEXT' && n.characters === 'Empezar gratis');
  assert.equal(btn.style.textCase, 'UPPER');
  assert.equal(btn.style.letterSpacing, 1);
});

test('translates gradients, shadows, radius and borders', () => {
  const hero = find((n) => n.name === 'section.hero');
  assert.equal(hero.fills[0].type, 'GRADIENT_LINEAR');
  assert.equal(hero.fills[0].gradientStops.length, 3);
  const card = find((n) => n.name === 'div.card');
  assert.deepEqual(card.effects.map((e) => e.type).sort(), ['DROP_SHADOW', 'INNER_SHADOW']);
  assert.equal(card.cornerRadius.tl, 20);
  const feature = find((n) => n.name === 'div.feature');
  assert.equal(feature.strokeWeights.left, 0, 'left side drawn as a separate bar');
  assert.equal(feature.children[0].name, 'border-left');
  const input = find((n) => n.name === 'input');
  assert.equal(input.dashed, 'dashed');
});

test('captures placeholders, SVG icons and images', () => {
  assert.ok(find((n) => n.type === 'TEXT' && n.characters === 'tu@correo.com'));
  const svgs = all(data.root).filter((n) => n.type === 'SVG');
  assert.equal(svgs.length, 3);
  assert.match(svgs[0].svg, /stroke="rgb\(91, 91, 240\)"/, 'currentColor resolved');
  const img = Object.values(data.images)[0];
  assert.equal(img.mime, 'image/png', 'SVG image converted to PNG');
  assert.ok(img.base64.length > 100);
});

test('z-index puts the badge above the image', () => {
  const card = find((n) => n.name === 'div.card');
  const names = card.children.map((c) => c.name);
  assert.equal(names[names.length - 1], 'span.badge');
});

test('selector captures a single element', async () => {
  const one = await captureTarget(fixture, { selector: '.card', embedImages: false });
  assert.equal(one.root.name, 'div.card');
  assert.equal(one.root.width, 360);
});

test('color parser handles modern syntaxes', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addScriptTag({ content: await readFile(new URL('../src/capture.js', import.meta.url), 'utf8') });
  const r = await page.evaluate(() => {
    const p = window.HtmlToFigma._internals.parseColor;
    return [p('rgb(255 0 0 / 50%)'), p('color(srgb 0 1 0)'), p('transparent'), p('oklch(0.7 0.1 200)')];
  });
  await browser.close();
  assert.deepEqual(r[0], { r: 1, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(r[1], { r: 0, g: 1, b: 0, a: 1 });
  assert.equal(r[2], null);
  assert.ok(r[3] && r[3].a === 1);
});
