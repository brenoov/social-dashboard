// coletor/lib/render-criativo.mjs
// Renderiza um HTML AUTOCONTIDO (fontes/imagens já inline como data URL) num
// viewport exato e devolve o PNG. Chromium headless via puppeteer.
import puppeteer from 'puppeteer';

let _browserPromise = null;
async function browser() {
  if (!_browserPromise) _browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  return _browserPromise;
}

export async function renderPNG(html, { width, height }) {
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buf;
  } finally {
    await page.close();
  }
}

export async function fecharRender() { if (_browserPromise) { const b = await _browserPromise; await b.close(); _browserPromise = null; } }
