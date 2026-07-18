// coletor/lib/render-criativo.mjs
// Renderiza um HTML AUTOCONTIDO (fontes/imagens já inline como data URL) num
// viewport exato e devolve o PNG. Chromium headless via puppeteer.
//
// O puppeteer é importado de forma LAZY (import dinâmico dentro da função que lança o
// navegador), não no topo. Motivo: só quem RENDERIZA precisa dele, e o puppeteer mora no
// coletor/package.json — não na raiz. O CI instala só as deps da raiz (npm ci), então um
// `import puppeteer` no topo quebrava a CARGA deste módulo e, por tabela, derrubava os
// testes de lógica pura que importam esta cadeia (ativar-estudio.test.mjs). Com o import
// lazy, o módulo carrega sem puppeteer presente; ele só é exigido na hora real de renderizar
// (onde o coletor tem a dependência instalada).

let _browserPromise = null;
async function browser() {
  if (!_browserPromise) {
    const { default: puppeteer } = await import('puppeteer');
    _browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
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
// Também aceita cantos TRANSPARENTES (alfa baixo): fotoDataUrl() agora
// devolve o recorte (rembg) sem fundo, então um canto limpo vem como
// transparente, não branco — e isso já é o sinal mais forte possível de que
// o recorte teve fundo limpo pra remover (foto de estúdio).
// avaliarStudioRaw(): decide se a foto CRUA (antes do recorte) é de estúdio/catálogo
// (fundo branco OU fundo liso uniforme "seamless") vs. amadora (cena poluída, mesa,
// ambiente, pessoa). Diferente de ehFotoStudio(), NÃO deve receber cutout — cutout tem
// cantos transparentes e passaria sempre. Amostra 8 regiões de borda: reprova quando os
// cantos têm cor variada (interStd alto) OU textura alta (fundo com objetos/ambiente).
export async function avaliarStudioRaw(rawDataUrl) {
  const b = await browser(); const page = await b.newPage();
  try {
    return await page.evaluate(async (src) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const N = 120, c = document.createElement('canvas'); c.width = N; c.height = N;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, N, N);
      const off = 6, sz = 14, m = N - off - sz;
      const regioes = [[off,off],[m,off],[off,m],[m,m],[Math.floor(N/2)-sz/2,off],[off,Math.floor(N/2)-sz/2],[m,Math.floor(N/2)-sz/2],[Math.floor(N/2)-sz/2,m]];
      const means = [], texturas = []; let brancas = 0;
      for (const [x,y] of regioes) {
        const d = ctx.getImageData(x, y, sz, sz).data; const lums = [];
        let r=0,g=0,bl=0,n=0;
        for (let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; bl+=d[i+2]; lums.push((d[i]+d[i+1]+d[i+2])/3); n++; }
        r/=n; g/=n; bl/=n;
        const bright=(r+g+bl)/3, sat=Math.max(r,g,bl)-Math.min(r,g,bl);
        const lm = lums.reduce((a,v)=>a+v,0)/lums.length;
        const tex = Math.sqrt(lums.reduce((a,v)=>a+(v-lm)*(v-lm),0)/lums.length);
        means.push({ r, g, bl, bright }); texturas.push(tex);
        if (bright>230 && sat<16) brancas++;
      }
      // variação de cor entre os 8 cantos (fundo seamless => baixa; cena poluída => alta)
      const mb = means.reduce((a,v)=>a+v.bright,0)/means.length;
      const interStd = Math.sqrt(means.reduce((a,v)=>a+(v.bright-mb)*(v.bright-mb),0)/means.length);
      // desvio de matiz: distância média de cada canto pra média RGB dos cantos
      const mr = means.reduce((a,v)=>a+v.r,0)/means.length, mg = means.reduce((a,v)=>a+v.g,0)/means.length, mbl = means.reduce((a,v)=>a+v.bl,0)/means.length;
      const corStd = Math.sqrt(means.reduce((a,v)=>a+((v.r-mr)**2+(v.g-mg)**2+(v.bl-mbl)**2)/3,0)/means.length);
      const avgTex = texturas.reduce((a,v)=>a+v,0)/texturas.length;
      // ESTÚDIO se: vários cantos brancos  OU  fundo liso (seamless colorido).
      // Calibrado em fotos-bling (amostra 70): amadores (bolsa em parede/madeira/mesa) dão
      // brancas<=1 e interStd alto; estúdio-branco dá brancas>=3 mesmo com a bolsa invadindo
      // 2-3 cantos. Limiar em 3 evita reprovar catálogo legítimo; o ramo "liso" salva os
      // fundos coloridos uniformes (baixa variação inter-cantos + baixa textura).
      const fundoBranco = brancas >= 3;
      const fundoLiso = interStd < 18 && corStd < 22 && avgTex < 20 && mb > 46;
      return { studio: fundoBranco || fundoLiso, brancas, interStd: +interStd.toFixed(1), corStd: +corStd.toFixed(1), avgTex: +avgTex.toFixed(1), mb: +mb.toFixed(0) };
    }, rawDataUrl);
  } catch (e) { return { studio: true, erro: String(e).slice(0,60) }; } finally { await page.close(); }
}

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
        let r=0,g=0,bl=0,a=0,n=0;
        for (let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; bl+=d[i+2]; a+=d[i+3]; n++; }
        r/=n; g/=n; bl/=n; a/=n;
        const bright=(r+g+bl)/3, sat=Math.max(r,g,bl)-Math.min(r,g,bl);
        if (a < 12) { brancas++; continue; } // canto transparente = recorte limpo
        if (bright>232 && sat<14) brancas++;
      }
      return brancas >= 6;
    }, dataUrl);
    return ok;
  } catch (e) { return true; } finally { await page.close(); }
}
