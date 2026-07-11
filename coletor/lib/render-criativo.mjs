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

// Detecta foto "de estúdio" (fundo limpo/branco) vs. foto amadora (porta de
// madeira, fundo bagunçado) checando as bordas/cantos da imagem numa mini
// tela 100x100. Nunca lança — em erro, assume estúdio (não bloqueia).
export async function ehFotoStudio(dataUrl) {
  const b = await browser(); const page = await b.newPage();
  try {
    const ok = await page.evaluate(async (src) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const c = document.createElement('canvas'); c.width = 100; c.height = 100;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 100, 100);
      const regioes = [[0,0],[90,0],[0,90],[90,90],[45,0],[0,45],[90,45],[45,90]];
      let brancas = 0;
      for (const [x,y] of regioes) {
        const d = ctx.getImageData(x, y, 10, 10).data;
        let r=0,g=0,bl=0,n=0;
        for (let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; bl+=d[i+2]; n++; }
        r/=n; g/=n; bl/=n;
        const bright=(r+g+bl)/3, sat=Math.max(r,g,bl)-Math.min(r,g,bl);
        if (bright>232 && sat<14) brancas++;
      }
      return brancas >= 6;
    }, dataUrl);
    return ok;
  } catch (e) { return true; } finally { await page.close(); }
}
