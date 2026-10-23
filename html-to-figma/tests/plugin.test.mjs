import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { captureTarget } from '../src/node-capture.mjs';
import { runPlugin, imageDiff } from './harness/run-plugin.mjs';

const fixture = fileURLToPath(new URL('./fixtures/landing.html', import.meta.url));

test('plugin rebuilds the page with the Figma API and looks the same', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'h2f-'));
  const original = path.join(dir, 'original.png');
  const rebuilt = path.join(dir, 'figma.png');
  const data = await captureTarget(fixture, { width: 1440, screenshot: original });
  const browser = await chromium.launch();
  try {
    const r = await runPlugin(browser, data, { screenshot: rebuilt });
    assert.deepEqual(r.errors, [], 'no Figma API misuse');
    const done = r.messages.find((m) => m.type === 'done');
    assert.ok(done, JSON.stringify(r.messages));
    assert.deepEqual(done.warnings, []);
    assert.equal(r.counts.SVG, 3);
    assert.equal(r.counts.TEXT, data.stats.texts);
    const diff = await imageDiff(browser, original, rebuilt);
    assert.ok(diff < 0.01, `visual difference ${(diff * 100).toFixed(2)}% is under 1%`);
  } finally {
    await browser.close();
  }
});

test('plugin rejects JSON that is not a capture', async () => {
  const browser = await chromium.launch();
  try {
    const r = await runPlugin(browser, { root: { width: 100 }, generator: 'other' });
    assert.equal(r.messages.at(-1).type, 'error');
  } finally {
    await browser.close();
  }
});

test('plugin UI converts pasted HTML and posts it to the plugin', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      if (window !== window.top) return;
      window.__posted = [];
      window.parent.postMessage = (m) => window.__posted.push(m);
    });
    await page.goto(new URL('../plugin/ui.html', import.meta.url).href);
    await page.fill('#html', await readFile(fixture, 'utf8'));
    await page.click('#go');
    await page.waitForFunction(() => window.__posted.length > 0, null, { timeout: 30000 });
    const msg = await page.evaluate(() => window.__posted[0].pluginMessage);
    assert.equal(msg.type, 'import');
    assert.equal(msg.data.root.width, 1440);
    assert.ok(msg.data.stats.texts > 20);
    assert.equal(Object.values(msg.data.images)[0].mime, 'image/png');
  } finally {
    await browser.close();
  }
});
