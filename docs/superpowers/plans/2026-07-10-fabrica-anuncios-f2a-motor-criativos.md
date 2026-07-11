# Fábrica de Anúncios — F2a (Motor de Criativos, backend) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um job do coletor que, dado a rodada da F1 + uma campanha de desconto, **gera os criativos PNG** (produto: De/Por; promo: %) via templates HTML renderizados por Chromium headless, e os salva no Supabase Storage + `fabrica_criativos`. Provável por CLI, com dados reais. **Sem UI (F2a.3) e sem Zoho/Canva** — esses são planos seguintes.

**Architecture:** Templates HTML parametrizados (portados do protótipo La Vessel) + fontes/monogramas embutidos como base64 → HTML totalmente inline → `puppeteer` renderiza no tamanho exato → PNG buffer → Supabase Storage. A foto vem do Bling (cache local `coletor/fotos-bling/` ou `produtos/{id}`). O desconto vem da campanha (`De = preço Bling`, `Por = De×(1−%)`).

**Tech Stack:** Node 20 (coletor, ESM), `puppeteer` (Chromium bundled — nova dep do coletor), Postgres/Supabase (migration + Storage REST), fetch nativo.

> **Testes:** o repo não tem harness unitário. Verificação = rodar o job/CLI real e inspecionar (PNG gerado, dimensões, linhas no banco, URL pública). Cada task termina com verificação concreta + commit.

## Global Constraints

- **Projeto Supabase:** `kounqtdoioootxqegkij`. Storage REST: `POST {URL}/storage/v1/object/{bucket}/{path}` (header `Content-Type`, `x-upsert: true`, body = buffer); URL pública `{URL}/storage/v1/object/public/{bucket}/{path}`; bucket público criado via `POST {URL}/storage/v1/bucket` `{id,name,public:true}` (idempotente). Auth = service key (`SUPABASE_SERVICE_KEY`), header `apikey` + `Authorization: Bearer`.
- **Bucket:** `fabrica-criativos`.
- **Formatos exatos:** Story `1080×1920`, Post `1080×1350`.
- **Marca La Vessel (invariantes):** paleta Burnt Wood `#582f0a`, Soft Pearl `#f2f1ed`, Sandstone `#e4e6d9`, Sage Suede `#c2cfb4`, Muted Olive `#89a88b`. Fontes Cormorant Garamond (marca/nome/número grande, sempre `font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1`) + Archivo (rótulos/OFF/CTA). "50% OFF" bloco único; nada encavala o número; contraste por fundo.
- **Cálculo:** `De = preço Bling (numeric)`; `Por = round(De × (1 − pct/100), 2)`; `parcelado = round(Por / N, 2)` (N default 10).
- **Env coletor:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GESTOR_USER_EMAIL`, `GESTOR_USER_PASSWORD` (já existem). Novo secret opcional: nenhum.
- **Reuso:** `coletor/lib/bling-comercial.mjs` (`loginServico`, `blingProxy`, `blingProdutos`), `coletor/lib/carregar-env.mjs` (import PRIMEIRO), cache `coletor/fotos-bling/<SKU>.jpg`, tabela `fabrica_candidatos` (F1).
- **Fontes do protótipo (origem):** `/Users/erickmartins/Downloads/FÁBRICA DE CRIATIVOS _ 10.07.26/` — arquivos `50% OFF - Geral.dc.html`, `De x Por - Geral.dc.html`, `export/fonts.css`, `lv/monogram-brown.png`, `lv/monogram-cream.png`, `lv/monogram-olive.png`. Estes são COPIADOS para o repo na Task 1.
- **Nomes de arquivo:** kebab-case PT.

---

### Task 1: Dependência de render + assets no repo + helper `renderPNG`

**Files:**
- Modify: `coletor/package.json` (add `puppeteer`)
- Create: `coletor/templates-criativos/assets/fonts.css` (copiado da origem — base64 Cormorant+Archivo)
- Create: `coletor/templates-criativos/assets/monogram-brown.png`, `monogram-cream.png`, `monogram-olive.png` (copiados)
- Create: `coletor/lib/render-criativo.mjs`

**Interfaces:**
- Produces: `async function renderPNG(html: string, { width, height }): Promise<Buffer>` — renderiza um HTML autocontido no viewport exato e devolve o PNG.

- [ ] **Step 1: Copiar assets e adicionar a dep**

Run:
```bash
cd /Users/erickmartins/iamundi
mkdir -p coletor/templates-criativos/assets
SRC="/Users/erickmartins/Downloads/FÁBRICA DE CRIATIVOS _ 10.07.26"
cp "$SRC/export/fonts.css" coletor/templates-criativos/assets/fonts.css
cp "$SRC/lv/monogram-brown.png" "$SRC/lv/monogram-cream.png" "$SRC/lv/monogram-olive.png" coletor/templates-criativos/assets/
ls -la coletor/templates-criativos/assets/
```
Expected: 4 arquivos (fonts.css ~234KB + 3 PNGs).

Add `puppeteer` em `coletor/package.json` dependencies:
```json
  "dependencies": {
    "pg": "^8.13.1",
    "puppeteer": "^23.0.0"
  }
```
Then:
```bash
cd /Users/erickmartins/iamundi/coletor && npm install
```
Expected: puppeteer instala e baixa o Chromium bundled.

- [ ] **Step 2: Escrever o helper de render**

Create `coletor/lib/render-criativo.mjs`:
```js
// coletor/lib/render-criativo.mjs
// Renderiza um HTML AUTOCONTIDO (fontes/imagens já inline como data URL) num
// viewport exato e devolve o PNG. Chromium headless via puppeteer.
import puppeteer from 'puppeteer';

let _browser = null;
async function browser() {
  if (!_browser) _browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  return _browser;
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

export async function fecharRender() { if (_browser) { await _browser.close(); _browser = null; } }
```

- [ ] **Step 3: Verificar o render (dimensões exatas)**

Create throwaway `coletor/_teste-render.mjs`:
```js
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { writeFileSync } from 'node:fs';
const html = '<!doctype html><html><body style="margin:0"><div style="width:1080px;height:1920px;background:#582f0a"></div></body></html>';
const buf = await renderPNG(html, { width: 1080, height: 1920 });
writeFileSync('_teste-render.png', buf);
await fecharRender();
console.log('bytes:', buf.length);
```
Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node _teste-render.mjs && sips -g pixelWidth -g pixelHeight _teste-render.png | grep pixel && rm -f _teste-render.mjs _teste-render.png
```
Expected: `pixelWidth: 1080`, `pixelHeight: 1920`.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/package.json coletor/package-lock.json coletor/templates-criativos/assets coletor/lib/render-criativo.mjs
git commit -m "feat(fabrica f2): dep puppeteer + assets de marca + helper renderPNG"
```

---

### Task 2: Biblioteca de templates parametrizados

**Files:**
- Create: `coletor/templates-criativos/templates.mjs`

**Interfaces:**
- Consumes: `assets/fonts.css` + monogramas (lidos/embutidos como base64).
- Produces:
  - `const TEMPLATES` — registro `{ chave: { arquetipo:'produto'|'promo', nome, render(dados, formato)->htmlString } }`.
  - `formato ∈ { '1080x1920', '1080x1350' }`.
  - `dados` (produto): `{ fotoDataUrl, nome, precoDe, precoPor, parcelado, cta, eyebrow, varianteNum }`. `dados` (promo): `{ fotoDataUrl, nome, oferta, cta, eyebrow }`.
  - Cada `render` devolve um HTML AUTOCONTIDO (fontes base64 embutidas via `<style>` + monograma data URL), com `<body style="margin:0">` e um único container do tamanho do formato.

- [ ] **Step 1: Base de assets embutidos + wrapper**

Create `coletor/templates-criativos/templates.mjs` (começo — carrega fontes/monogramas uma vez):
```js
// coletor/templates-criativos/templates.mjs
// Templates HTML parametrizados portados do protótipo La Vessel. Cada template
// devolve HTML AUTOCONTIDO (fontes+monograma inline) pronto pro renderPNG.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const FONTS_CSS = readFileSync(join(DIR, 'fonts.css'), 'utf8');
const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(DIR, f)).toString('base64');
const MONO = { brown: b64('monogram-brown.png'), cream: b64('monogram-cream.png'), olive: b64('monogram-olive.png') };

const DIM = { '1080x1920': { width: 1080, height: 1920 }, '1080x1350': { width: 1080, height: 1350 } };

// wrapper autocontido: injeta fontes + normaliza body pro tamanho exato
function pagina(inner, formato) {
  const d = DIM[formato];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${d.width}px;height:${d.height}px;overflow:hidden}</style></head>
  <body>${inner}</body></html>`;
}
```

- [ ] **Step 2: Template `promo-number-hero` (completo, base do POC — já validado)**

Adicionar em `templates.mjs`:
```js
// PROMO · Number Hero (fundo Burnt Wood, número gigante, bolsa em círculo pérola)
function promoNumberHero(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;      // Post reduz proporcional
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:radial-gradient(130% 75% at 50% 44%, #6a3c14 0%, #4f2908 100%);overflow:hidden;color:#f2f1ed;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(56)}px;padding:${s(96)}px ${s(80)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.cream}" style="height:${s(60)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(46)}px;font-weight:500;margin-top:16px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:20px;"><span style="width:44px;height:1px;background:#c2cfb4;opacity:.55;"></span><span style="font-size:${s(20)}px;letter-spacing:.46em;text-transform:uppercase;color:#c2cfb4;font-weight:500;padding-left:.46em;">${dados.eyebrow || 'Season Sale'}</span><span style="width:44px;height:1px;background:#c2cfb4;opacity:.55;"></span></div>
      </div>
      <div style="display:flex;align-items:baseline;gap:${s(28)}px;">
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(308)}px;font-weight:500;line-height:1;">${dados.oferta}</span>
        <span style="font-family:'Archivo',sans-serif;font-size:${s(88)}px;letter-spacing:.14em;font-weight:700;color:#c2cfb4;">OFF</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;width:${s(600)}px;height:${s(600)}px;border-radius:50%;background:#f2f1ed;box-shadow:0 34px 70px rgba(0,0,0,.34);overflow:hidden;">
        <img src="${dados.fotoDataUrl}" style="width:${s(560)}px;height:${s(560)}px;object-fit:contain;">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(44)}px;">${dados.nome}</div>
        <div style="font-size:${s(23)}px;letter-spacing:.14em;text-transform:uppercase;color:#e4e6d9;opacity:.8;margin-top:12px;">Preço que não volta</div>
      </div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(27)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(82)}px;border-radius:999px;box-shadow:0 18px 36px rgba(0,0,0,.3);display:flex;align-items:center;gap:18px;">${dados.cta || 'Compre já'} <span style="font-size:${s(30)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}
```

- [ ] **Step 3: Template `produto-heroi` (De/Por, completo)**

Adicionar em `templates.mjs` (portado de `De x Por - Geral.dc.html` bloco `1a`, com slots De/Por e a variante de destaque):
```js
// PRODUTO · Herói (fundo Soft Pearl, bolsa, De riscado + Por grande OU parcelado)
function produtoHeroi(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const destaqueParcelado = !!dados.parceladoEmEvidencia;
  const blocoPreco = destaqueParcelado
    ? `<div style="display:flex;align-items:baseline;gap:14px;"><span style="font-size:${s(24)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(50)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <span style="font-size:${s(26)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#89a88b;">Em até</span>
       <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(150)}px;font-weight:500;line-height:1;color:#582f0a;">${dados.parcelas}× R$ ${dados.parcelado}</span>`
    : `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(26)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(60)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <div style="display:flex;align-items:baseline;gap:22px;"><span style="font-size:${s(32)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#89a88b;">Por</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(168)}px;font-weight:500;line-height:1;color:#582f0a;">R$ ${dados.precoPor}</span></div>`;
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(40)}px;padding:${s(104)}px ${s(90)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(60)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(52)}px;font-weight:500;margin-top:14px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:20px;margin-top:20px;"><span style="width:46px;height:1px;background:#89a88b;"></span><span style="font-size:${s(22)}px;letter-spacing:.46em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Oferta especial'}</span><span style="width:46px;height:1px;background:#89a88b;"></span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;width:${s(560)}px;height:${s(560)}px;border-radius:50%;background:#ffffff;box-shadow:0 30px 60px rgba(60,36,8,.14);overflow:hidden;"><img src="${dados.fotoDataUrl}" style="width:${s(520)}px;height:${s(520)}px;object-fit:contain;"></div>
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(56)}px;">${dados.nome}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">${blocoPreco}</div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(30)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(30)}px ${s(84)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.2);display:flex;align-items:center;gap:18px;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(34)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}
```

- [ ] **Step 4: Registrar os templates**

Adicionar no fim de `templates.mjs`:
```js
export const TEMPLATES = {
  'promo-number-hero': { arquetipo: 'promo', nome: 'Promo · Number Hero', render: promoNumberHero },
  'produto-heroi':     { arquetipo: 'produto', nome: 'Produto · Herói', render: produtoHeroi },
};
export { DIM };
```

> Nota de porte (F2a.2/futuro): as demais direções do protótipo (`promo` Sage/Minimal Pearl/Burnt Wood e `produto` Preço-tipográfico/Sage-círculo) seguem o MESMO padrão desta task — portar de `50% OFF - Geral.dc.html` e `De x Por - Geral.dc.html`, trocando literais por slots (`50%`→`dados.oferta`, `R$ 899`→`dados.precoDe`, `R$ 449`→`dados.precoPor`, `Bolsa Fantasia`→`dados.nome`, `bag-cutout.png`→`dados.fotoDataUrl`, monograma→`MONO.*`) e envelopando com `pagina(inner, formato)`. Cada uma vira uma entrada no registro. Fora do escopo desta task (que entrega 2 templates provados).

- [ ] **Step 5: Verificar gerando um HTML e renderizando**

Create throwaway `coletor/_teste-tpl.mjs`:
```js
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const foto = 'data:image/jpeg;base64,' + readFileSync('fotos-bling/LV1038-Panacota.jpg').toString('base64');
const html = TEMPLATES['promo-number-hero'].render({ oferta: '50%', nome: 'Bolsa Genebra', fotoDataUrl: foto, cta: 'Compre já' }, '1080x1920');
const buf = await renderPNG(html, DIM['1080x1920']);
writeFileSync('_teste-tpl.png', buf);
await fecharRender();
console.log('ok', buf.length);
```
Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node _teste-tpl.mjs && sips -g pixelWidth -g pixelHeight _teste-tpl.png | grep pixel
```
Expected: PNG 1080×1920. **Abrir `_teste-tpl.png` e conferir visualmente** que ficou o criativo La Vessel (marca, 50%, bolsa no círculo, CTA). Depois `rm -f _teste-tpl.mjs _teste-tpl.png`.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/templates-criativos/templates.mjs
git commit -m "feat(fabrica f2): biblioteca de templates (promo number-hero + produto heroi)"
```

---

### Task 3: Foto do produto → data URL

**Files:**
- Create: `coletor/lib/foto-produto.mjs`

**Interfaces:**
- Consumes: `blingProxy`, `blingProdutos` (bling-comercial), cache `coletor/fotos-bling/<SKU>.jpg`.
- Produces: `async function fotoDataUrl(token, sku, prodPorCodigo?): Promise<string|null>` — data URL (jpeg/png) da foto do produto, ou null.

- [ ] **Step 1: Escrever o helper**

Create `coletor/lib/foto-produto.mjs`:
```js
// coletor/lib/foto-produto.mjs
// Resolve a foto de um produto -> data URL. 1) cache local coletor/fotos-bling;
// 2) Bling produtos/{id} (imagemURL/midia) com fallback variação->pai (_gcItemImg).
import { blingProxy } from './bling-comercial.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fotos-bling');
const nomeCache = (sku) => String(sku || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);

function itemImg(p) {
  if (!p || typeof p !== 'object') return '';
  if (p.imagemURL && /^https?:/.test(p.imagemURL)) return p.imagemURL;
  const mi = p.midia && p.midia.imagens;
  if (mi) { const e = mi.externas && mi.externas[0] && mi.externas[0].link; const i = mi.internas && mi.internas[0] && mi.internas[0].link; if (e || i) return e || i; }
  try { const m = JSON.stringify(p).match(/https?:\/\/[^"'\\]+\.(?:jpg|jpeg|png|webp)/i); if (m) return m[0]; } catch (e) {}
  return '';
}
const mimeDe = (u) => /\.png(\?|$)/i.test(u) ? 'image/png' : (/\.webp(\?|$)/i.test(u) ? 'image/webp' : 'image/jpeg');

export async function fotoDataUrl(token, sku) {
  // 1) cache local
  const local = join(CACHE, nomeCache(sku) + '.jpg');
  if (existsSync(local)) return 'data:image/jpeg;base64,' + readFileSync(local).toString('base64');
  // 2) Bling
  const base = String(sku).split('-')[0].trim();
  const listar = async (params) => { const r = await blingProxy(token, 'produtos', params); return (r && r.data) || []; };
  const detalhe = async (id) => { const r = await blingProxy(token, 'produtos/' + id); return (r && r.data) || null; };
  let list = await listar({ codigo: sku, limite: 3 });
  if (!list.length && base !== sku) list = await listar({ codigo: base, limite: 6 });
  if (!list.length) list = await listar({ pesquisa: sku, limite: 8 });
  if (!list.length) return null;
  const prod = list.find(p => String(p.codigo || '').toLowerCase().startsWith(base.toLowerCase())) || list[0];
  let full = (await detalhe(prod.id)) || prod;
  if (!itemImg(full) && base !== sku) {
    const pl = await listar({ codigo: base, limite: 6 });
    const pp = pl.find(p => String(p.codigo || '').toLowerCase() === base.toLowerCase()) || pl[0];
    if (pp) { const pd = await detalhe(pp.id); if (pd && itemImg(pd)) full = pd; }
  }
  const url = itemImg(full);
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return 'data:' + mimeDe(url) + ';base64,' + buf.toString('base64');
}
```

- [ ] **Step 2: Verificar com um SKU real (do cache)**

Create throwaway `coletor/_teste-foto.mjs`:
```js
import './lib/carregar-env.mjs';
import { fotoDataUrl } from './lib/foto-produto.mjs';
const u = await fotoDataUrl(null, 'LV1038-Panacota'); // deve vir do cache local, sem token
console.log(u ? ('OK data url ' + u.slice(0, 40) + '... (' + u.length + ' chars)') : 'NULL');
```
Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node _teste-foto.mjs && rm -f _teste-foto.mjs
```
Expected: `OK data url data:image/jpeg;base64,...` (resolveu do cache).

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/foto-produto.mjs
git commit -m "feat(fabrica f2): foto de produto -> data url (cache local + Bling fallback)"
```

---

### Task 4: Migração — `fabrica_campanhas` + `fabrica_criativos`

**Files:**
- Create: `db/migrations/015_fabrica_criativos.sql`

**Interfaces:**
- Produces:
  - `fabrica_campanhas(id uuid PK, nome text, desconto_tipo text, desconto_pct numeric, parcelas int, created_at)`. `desconto_tipo ∈ {'fixo','gestor','personalizado'}`.
  - `fabrica_criativos(id uuid PK, campanha_id uuid FK, candidato_id uuid FK nullable, arquetipo text, template text, formato text, variante text, preco_de numeric, preco_por numeric, storage_path text, url text, escolhido boolean, created_at)`.

- [ ] **Step 1: Escrever a migração**

Create `db/migrations/015_fabrica_criativos.sql`:
```sql
-- 015_fabrica_criativos.sql — F2a: campanhas de desconto + criativos gerados.
CREATE TABLE IF NOT EXISTS public.fabrica_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  desconto_tipo text NOT NULL DEFAULT 'fixo',
  desconto_pct numeric,
  parcelas int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fabrica_criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.fabrica_campanhas (id) ON DELETE CASCADE,
  candidato_id uuid REFERENCES public.fabrica_candidatos (id) ON DELETE CASCADE,
  arquetipo text NOT NULL,
  template text NOT NULL,
  formato text NOT NULL,
  variante text,
  preco_de numeric,
  preco_por numeric,
  storage_path text,
  url text,
  escolhido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fab_criativos_campanha ON public.fabrica_criativos (campanha_id);
CREATE INDEX IF NOT EXISTS idx_fab_criativos_candidato ON public.fabrica_criativos (candidato_id);

ALTER TABLE public.fabrica_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_criativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fab_camp_read ON public.fabrica_campanhas;
CREATE POLICY fab_camp_read ON public.fabrica_campanhas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_criativos_read ON public.fabrica_criativos;
CREATE POLICY fab_criativos_read ON public.fabrica_criativos FOR SELECT TO authenticated USING (true);

-- escrita: admin OU permissão meta.fabrica (mesmo gate da F1)
DROP POLICY IF EXISTS fab_camp_write ON public.fabrica_campanhas;
CREATE POLICY fab_camp_write ON public.fabrica_campanhas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')));
DROP POLICY IF EXISTS fab_criativos_write ON public.fabrica_criativos;
CREATE POLICY fab_criativos_write ON public.fabrica_criativos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')));

DROP POLICY IF EXISTS fab_camp_srv ON public.fabrica_campanhas;
CREATE POLICY fab_camp_srv ON public.fabrica_campanhas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_criativos_srv ON public.fabrica_criativos;
CREATE POLICY fab_criativos_srv ON public.fabrica_criativos FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Aplicar (só a 015, seguindo a decisão da F1 sobre drift)**

> Contexto: existem migrations pré-existentes pendentes (drift conhecido). Aplique APENAS a 015 e registre em `schema_migrations`, como foi feito na F1. Use `psql "$DATABASE_URL"` (de coletor/.env) ou o MCP Supabase `apply_migration`/`execute_sql` no projeto `kounqtdoioootxqegkij`. Não rode `run-migrations.mjs` sem `--dry` (aplicaria as pendentes fora de escopo).

Run (via MCP Supabase `apply_migration` name `015_fabrica_criativos` com o SQL acima, OU psql aplicando o arquivo). Depois verificar:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('fabrica_campanhas','fabrica_criativos');
```
Expected: as 2 tabelas listadas.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/015_fabrica_criativos.sql
git commit -m "feat(fabrica f2): tabelas fabrica_campanhas + fabrica_criativos + RLS"
```

---

### Task 5: Modelo de cálculo + matriz de variações

**Files:**
- Create: `coletor/lib/criativo-modelo.mjs`

**Interfaces:**
- Consumes: `TEMPLATES` (Task 2).
- Produces:
  - `function precoDePor(precoBling: number, pct: number): { de: string, por: string }` — formatado `pt-BR` (ex.: `'899,00'`, `'449,50'`).
  - `function parcelado(porNum: number, n: number): string` — `pt-BR`.
  - `function variacoesProduto(candidato, campanha): Array<{template,formato,variante,arquetipo:'produto',dados,preco_de,preco_por}>`.
  - `function variacoesPromo(campanha, fotoDataUrl, nome): Array<{template,formato,variante,arquetipo:'promo',dados}>`.

- [ ] **Step 1: Escrever o modelo**

Create `coletor/lib/criativo-modelo.mjs`:
```js
// coletor/lib/criativo-modelo.mjs
// Cálculo De/Por/parcelado + expansão da matriz de variações por arquétipo.
import { TEMPLATES } from '../templates-criativos/templates.mjs';

const FMT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => FMT.format(Math.round(n * 100) / 100);

export function precoDePor(precoBling, pct) {
  const de = Number(precoBling) || 0;
  const por = de * (1 - (Number(pct) || 0) / 100);
  return { de: money(de), por: money(por), porNum: Math.round(por * 100) / 100 };
}
export function parcelado(porNum, n) { return money((Number(porNum) || 0) / (n || 10)); }

const FORMATOS = ['1080x1920', '1080x1350'];

// PRODUTO: template 'produto-heroi' em 2 variantes (à vista x parcelado) × 2 formatos = 4.
export function variacoesProduto(candidato, campanha) {
  const pct = descontoDe(candidato, campanha);
  const { de, por, porNum } = precoDePor(candidato.preco, pct);
  const parc = parcelado(porNum, campanha.parcelas);
  const out = [];
  for (const formato of FORMATOS) {
    for (const parceladoEmEvidencia of [false, true]) {
      out.push({
        arquetipo: 'produto', template: 'produto-heroi', formato,
        variante: parceladoEmEvidencia ? 'parcelado' : 'avista',
        preco_de: candidato.preco, preco_por: porNum,
        dados: { nome: candidato.nome, fotoDataUrl: candidato.fotoDataUrl, precoDe: de, precoPor: por, parcelado: parc, parcelas: campanha.parcelas, parceladoEmEvidencia, eyebrow: 'Oferta especial' },
      });
    }
  }
  return out;
}

// PROMO: template 'promo-number-hero' × 2 formatos = 2.
export function variacoesPromo(campanha, fotoDataUrl, nome) {
  const oferta = Math.round(Number(campanha.desconto_pct) || 0) + '%';
  return FORMATOS.map((formato) => ({
    arquetipo: 'promo', template: 'promo-number-hero', formato, variante: 'number-hero',
    dados: { oferta, nome: nome || 'Coleção', fotoDataUrl, eyebrow: 'Season Sale', cta: 'Compre já' },
  }));
}

// desconto efetivo do item: 'fixo'/'personalizado' usa desconto_pct; 'gestor' usaria a escada (F2a.2+: por ora cai no pct da campanha se vier).
function descontoDe(candidato, campanha) {
  if (campanha.desconto_tipo === 'gestor' && candidato.desconto_pct != null) return candidato.desconto_pct;
  return Number(campanha.desconto_pct) || 0;
}

export { TEMPLATES };
```

- [ ] **Step 2: Verificar o cálculo e a contagem**

Create throwaway `coletor/_teste-modelo.mjs`:
```js
import { precoDePor, parcelado, variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';
const p = precoDePor(899, 50); console.log('De', p.de, 'Por', p.por, '10x', parcelado(p.porNum, 10));
const camp = { desconto_tipo: 'fixo', desconto_pct: 50, parcelas: 10 };
const vp = variacoesProduto({ nome: 'Bolsa Genebra', preco: 899, fotoDataUrl: 'x' }, camp);
const vpr = variacoesPromo(camp, 'x', 'Coleção');
console.log('produto variações:', vp.length, '| promo variações:', vpr.length);
```
Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node _teste-modelo.mjs && rm -f _teste-modelo.mjs
```
Expected: `De 899,00 Por 449,50 10x 44,95` e `produto variações: 4 | promo variações: 2`.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/criativo-modelo.mjs
git commit -m "feat(fabrica f2): calculo De/Por/parcelado + matriz de variacoes"
```

---

### Task 6: Job orquestrador — gerar, renderizar, subir, gravar

**Files:**
- Create: `coletor/gerar-criativos.mjs`

**Interfaces:**
- Consumes: tudo acima + REST (service key) + Storage.
- Produces: para a última rodada da F1 + uma campanha (criada/lida), gera criativos dos candidatos **selecionados** + a promo, renderiza, sobe pro bucket `fabrica-criativos` e grava `fabrica_criativos`. CLI: `node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales"`.

- [ ] **Step 1: Escrever o job**

Create `coletor/gerar-criativos.mjs`:
```js
#!/usr/bin/env node
// coletor/gerar-criativos.mjs
// F2a: gera criativos (produto De/Por + promo) da última rodada da F1 + campanha.
// Uso: node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales" [--parcelas 10] [--dry]
import './lib/carregar-env.mjs';
import { loginServico } from './lib/bling-comercial.mjs';
import { fotoDataUrl } from './lib/foto-produto.mjs';
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const PCT = Number(arg('--pct', '50'));
const NOME = arg('--nome', PCT + '% OFF');
const PARCELAS = Number(arg('--parcelas', '10'));

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const BUCKET = 'fabrica-criativos';

async function sbGet(p) { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error('GET ' + p + ' ' + r.status); return r.json(); }
async function sbPost(p, body, prefer) { const r = await fetch(REST + p, { method: 'POST', headers: prefer ? { ...H, Prefer: prefer } : H, body: JSON.stringify(body) }); if (!r.ok && ![200,201,204].includes(r.status)) throw new Error('POST ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0,200)); return r; }

async function garantirBucket() {
  await fetch(URL + '/storage/v1/bucket', { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) }).catch(() => {});
}
async function subir(path, buf) {
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf });
  if (!r.ok) throw new Error('upload ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0,160));
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const token = await loginServico();
  const rod = await sbGet('/fabrica_rodadas?select=id,rodada&order=created_at.desc&limit=1');
  if (!rod.length) throw new Error('sem rodada da F1');
  const rodadaId = rod[0].id;
  const cands = await sbGet(`/fabrica_candidatos?select=id,sku,nome,preco,selecionado&rodada_id=eq.${rodadaId}&selecionado=eq.true&order=loja_nome`);
  console.log('rodada', rod[0].rodada, '| candidatos selecionados:', cands.length);

  // campanha
  let campanhaId = null;
  if (!DRY) {
    const c = await sbPost('/fabrica_campanhas', [{ nome: NOME, desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS }], 'return=representation');
    campanhaId = (await c.json())[0].id;
    await garantirBucket();
  }
  const campanha = { desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS };

  let gerados = 0;
  // dedup de foto por sku (produtos iguais em lojas diferentes)
  const fotoCache = new Map();
  const fotoDe = async (sku) => { if (!fotoCache.has(sku)) fotoCache.set(sku, await fotoDataUrl(token, sku)); return fotoCache.get(sku); };

  // PRODUTO (dedup por sku: arte é por produto, não por loja)
  const skusVistos = new Set();
  for (const cand of cands) {
    if (cand.sku && skusVistos.has(cand.sku)) continue;
    if (cand.sku) skusVistos.add(cand.sku);
    const foto = await fotoDe(cand.sku);
    if (!foto) { console.warn('  sem foto:', cand.sku, cand.nome); continue; }
    for (const v of variacoesProduto({ ...cand, fotoDataUrl: foto }, campanha)) {
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] produto', cand.sku, v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/produto/${cand.sku}-${v.variante}-${v.formato}.png`;
      const url = await subir(path, buf);
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, candidato_id: cand.id, arquetipo: 'produto', template: v.template, formato: v.formato, variante: v.variante, preco_de: v.preco_de, preco_por: v.preco_por, storage_path: path, url }], 'return=minimal');
    }
  }

  // PROMO (usa a 1ª foto disponível como símbolo)
  const primeiraFoto = [...fotoCache.values()].find(Boolean) || null;
  if (primeiraFoto) {
    for (const v of variacoesPromo(campanha, primeiraFoto, 'Coleção')) {
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] promo', v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/promo/${v.variante}-${v.formato}.png`;
      const url = await subir(path, buf);
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, arquetipo: 'promo', template: v.template, formato: v.formato, variante: v.variante, storage_path: path, url }], 'return=minimal');
    }
  }

  await fecharRender();
  console.log(DRY ? `\n(--dry) geraria ${gerados} criativos.` : `\ngerado: ${gerados} criativos | campanha ${campanhaId}`);
}
main().catch(async e => { await fecharRender(); console.error('FALHOU:', e.message); process.exit(1); });
```

- [ ] **Step 2: Rodar dry (renderiza tudo, não sobe)**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales" --dry
```
Expected: lista `[dry] produto <sku> avista/parcelado 1080x1920/1080x1350 ... bytes` para cada produto selecionado + `[dry] promo number-hero ...`, e `geraria N criativos` (N > 0). Nenhum upload.

- [ ] **Step 3: Rodar de verdade e conferir Storage + banco**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales"
```
Then (SQL via MCP Supabase `execute_sql`):
```sql
SELECT arquetipo, formato, variante, count(*), min(url) AS exemplo_url
FROM public.fabrica_criativos
WHERE campanha_id = (SELECT id FROM public.fabrica_campanhas ORDER BY created_at DESC LIMIT 1)
GROUP BY arquetipo, formato, variante ORDER BY arquetipo, formato;
```
Expected: linhas de `produto` (avista+parcelado × 2 formatos) e `promo` (2 formatos); `exemplo_url` acessível. **Abrir 1–2 `url` no navegador** e confirmar que os PNGs saíram certos (marca, De/Por calculado, bolsa real).

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs
git commit -m "feat(fabrica f2): job orquestrador - gera/renderiza/sobe criativos + grava"
```

---

## Definition of Done (F2a backend)

- `node coletor/gerar-criativos.mjs --pct 50 --nome "..."` gera criativos reais (produto De/Por + promo), sobe pro bucket `fabrica-criativos` e grava `fabrica_criativos`, usando fotos reais do Bling e a seleção da F1.
- Render exato (1080×1920 / 1080×1350), marca La Vessel fiel.
- Sem UI (F2a.3) e sem Zoho/Canva.

## Follow-ups (não são este plano)

- **F2a.3 — UI:** seletor de campanha + botão "gerar" + grid de preview + curadoria (escolhido) + na tela da F1.
- **Mais templates:** portar as direções restantes (Sage/Minimal Pearl/Burnt Wood; Preço-tipográfico/Sage-círculo) seguindo o padrão da Task 2.
- **Desconto 'gestor':** escada por quadrante BCG por item (hoje o job usa % fixo da campanha).
- **Zoho sync** (bucket → WorkDrive `…/Criativos/02. Varejo`) e **motor Canva (F2b)**.
- **Cron / cutout / lifestyle (gpt-image)** — fases posteriores.
