// Runs plugin/code.js against the mock Figma API in a real browser page,
// then renders the resulting layers so they can be compared with the source page.
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

export async function runPlugin(browser, data, { screenshot } = {}) {
  const page = await browser.newPage({ viewport: { width: data.root.width, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.setContent('<!doctype html><html><body style="margin:0"><div id="out" style="position:relative"></div></body></html>');
    await page.addScriptTag({ content: await read('./mock-figma.js') });
    await page.addScriptTag({ content: await read('../../plugin/code.js') });
    const outcome = await page.evaluate(async (d) => {
      window.figma.ui.onmessage({ type: 'import', data: d });
      const msgs = window.__mock.uiMessages;
      const start = Date.now();
      while (!msgs.some((m) => m.type === 'done' || m.type === 'error')) {
        if (Date.now() - start > 60000) throw new Error('plugin timed out');
        await new Promise((r) => setTimeout(r, 20));
      }
      return { messages: msgs, errors: window.__mock.errors, counts: window.__countNodes() };
    }, data);
    if (screenshot) {
      const size = await page.evaluate(() => window.__renderFigma(document.getElementById('out')));
      await page.setViewportSize({ width: Math.ceil(size.width), height: Math.min(Math.ceil(size.height), 900) });
      await page.locator('#out > div').screenshot({ path: screenshot });
    }
    return outcome;
  } finally {
    await page.close();
  }
}

// Mean per-pixel difference (0..1) between two PNGs of possibly different heights.
export async function imageDiff(browser, pngA, pngB) {
  const page = await browser.newPage();
  try {
    const toUrl = async (p) => 'data:image/png;base64,' + (await readFile(p)).toString('base64');
    return await page.evaluate(
      async ([a, b]) => {
        const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.min(ia.width, ib.width);
        const h = Math.min(ia.height, ib.height);
        const px = (img) => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, w, h).data;
        };
        const da = px(ia);
        const db = px(ib);
        let sum = 0;
        for (let i = 0; i < da.length; i += 4) {
          sum += (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 765;
        }
        return sum / (w * h);
      },
      [await toUrl(pngA), await toUrl(pngB)]
    );
  } finally {
    await page.close();
  }
}
