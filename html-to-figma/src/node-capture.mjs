// Captures a URL or local HTML file with Playwright and returns plugin-ready JSON
// (images embedded as base64, converted to PNG when Figma can't read the format).
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const CAPTURE_SCRIPT = fileURLToPath(new URL('./capture.js', import.meta.url));
const FIGMA_MIME = new Set(['image/png', 'image/jpeg', 'image/gif']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function toUrl(target) {
  if (/^(https?|file|data):/i.test(target)) return target;
  const abs = path.resolve(target);
  if (!existsSync(abs)) throw new Error(`No such file or URL: ${target}`);
  return pathToFileURL(abs).href;
}

function sniffMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  return null;
}

async function autoScroll(page) {
  // Trigger lazy-loaded images and scroll-driven content, then go back to the top.
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.8);
    const max = Math.min(document.documentElement.scrollHeight, 40000);
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
  });
}

async function embedImages(result, context, log) {
  const helper = await context.newPage(); // about:blank: no CSP, used for format conversion
  await helper.addScriptTag({ content: await readFile(CAPTURE_SCRIPT, 'utf8') });
  const entries = Object.entries(result.images || {});
  let done = 0;
  await Promise.all(
    entries.map(async ([id, img]) => {
      try {
        let buf;
        let type = '';
        if (img.url.startsWith('data:')) {
          const comma = img.url.indexOf(',');
          if (comma === -1) throw new Error('bad data URL');
          const params = img.url.slice(5, comma).split(';');
          const payload = img.url.slice(comma + 1);
          type = params[0];
          buf = params.includes('base64') ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
        } else {
          const res = await context.request.get(img.url, { timeout: 20000 });
          if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
          buf = await res.body();
          type = (res.headers()['content-type'] || '').split(';')[0];
        }
        if (buf.length > MAX_IMAGE_BYTES) throw new Error('image too large');
        const sniffed = sniffMime(buf);
        if (sniffed && FIGMA_MIME.has(sniffed)) {
          img.base64 = buf.toString('base64');
          img.mime = sniffed;
        } else {
          const dataUrl = `data:${type || 'image/webp'};base64,${buf.toString('base64')}`;
          const converted = await helper.evaluate((d) => window.HtmlToFigma.convertDataUrl(d), dataUrl);
          img.base64 = converted.base64;
          img.mime = converted.mime;
        }
      } catch (e) {
        img.error = String(e.message || e);
      }
      done++;
      if (log && done % 10 === 0) log(`  images ${done}/${entries.length}`);
    })
  );
  await helper.close();
}

/**
 * @param {string} target URL or path to an .html file
 * @param {object} opts { width, height, selector, waitMs, screenshot, embedImages, log, headless }
 */
export async function captureTarget(target, opts = {}) {
  const { width = 1440, height = 900, selector, waitMs = 500, screenshot, log = () => {} } = opts;
  const url = toUrl(target);
  const browser = await chromium.launch({ headless: opts.headless !== false });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    log(`Opening ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      log('  network did not go idle; continuing after load');
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    }
    await autoScroll(page);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    if (waitMs) await page.waitForTimeout(waitMs);

    await page.addScriptTag({ content: await readFile(CAPTURE_SCRIPT, 'utf8') }).catch(async () => {
      // Pages with a strict CSP block inline scripts; evaluate the source instead.
      await page.evaluate(await readFile(CAPTURE_SCRIPT, 'utf8'));
    });
    log('Capturing layout and styles');
    const result = await page.evaluate((sel) => window.HtmlToFigma.capture({ selector: sel || undefined }), selector || null);

    if (screenshot) {
      await page.screenshot({ path: screenshot, fullPage: !selector });
      log(`Screenshot saved to ${screenshot}`);
    }
    if (opts.embedImages !== false && Object.keys(result.images).length) {
      log(`Embedding ${Object.keys(result.images).length} images`);
      await embedImages(result, context, log);
    }
    return result;
  } finally {
    await browser.close();
  }
}
