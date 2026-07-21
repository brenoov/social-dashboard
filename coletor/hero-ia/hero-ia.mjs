// coletor/hero-ia/hero-ia.mjs
// Motor Hero-IA (fonte ADITIVA de criativos). Registro de LOOKS IA — cada um gera a cena com
// gpt-image-2 e renderiza no motor HTML da fábrica (conversão com preço OU branding sem preço).
// NÃO toca nos 13 looks de código. Publica no MESMO pote (bucket + tabela fabrica_criativos).
// Preços vêm do `dados` (Bling). Assets (fundo/pattern) no repo (CI). rembg NÃO é usado aqui:
// tanto a bolsa quanto a modelo são compostas/relightadas nativamente pelo gpt-image-2.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DIM, VARIANTES, renderCriativo, renderCriativoMotion } from './render-html.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const asset = (f) => readFileSync(join(DIR, 'assets', f));
const OPENAI_URL = 'https://api.openai.com/v1/images/edits';

// formato -> fundo mestre (cenas de bolsa) + tamanho gpt + layout do texto ('right'|'bottom')
const FMTGEN = {
  feed_1x1:     { fundo: 'fundo-1x1.png', size: '1024x1024', layout: 'right'  },
  fb_4x5:       { fundo: 'fundo-4x5.png', size: '1024x1536', layout: 'right'  },
  youtube_16x9: { fundo: 'fundo-1x1.png', size: '1536x1024', layout: 'right'  },
  stories_9x16: { fundo: 'fundo-9x16.png', size: '1024x1536', layout: 'bottom' },
};

// REGISTRO dos looks IA. `fonte`: 'ia' = cena da BOLSA gerada (fundo mestre + recorte da bolsa);
// 'modelo-ia' = a MODELO real (dados.modeloFotoUrl do acervo) é usada como REFERÊNCIA no gpt-image-2,
// que mantém a MESMA pose/identidade/bolsa e só troca o fundo pro nosso S-monograma + lateraliza.
// Sem foto real da modelo p/ o SKU, look 'modelo-ia' é PULADO (saem só os de bolsa). Ambas consomem
// o teto de gerações (são gpt). `modo`: conversao (preço) | branding (sem preço). `objetivos`: curadoria.
export const IA_LOOKS = {
  'hero-ia':         { nome: 'Hero · IA (bolsa)',      arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'ia',        modo: 'conversao', cena: 'pedestal',     formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-marrom': { nome: 'Promo · Bolsa Caramelo', arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'ia',        modo: 'conversao', cena: 'marrom',       formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-claro':  { nome: 'Promo · Bolsa Clara',    arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'ia',        modo: 'conversao', cena: 'claro',        formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-modelo': { nome: 'Promo · Modelo',         arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'modelo-ia', modo: 'conversao', cena: 'modelo',       formatos: ['fb_4x5','stories_9x16'] },
  'ia-brand-bolsa':  { nome: 'Branding · Bolsa',       arquetipo: 'produto', objetivos: ['branding'],                          fonte: 'ia',        modo: 'branding',  cena: 'claro',        formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-brand-modelo': { nome: 'Branding · Modelo',      arquetipo: 'produto', objetivos: ['branding'],                          fonte: 'modelo-ia', modo: 'branding',  cena: 'modelo-claro', formatos: ['fb_4x5','stories_9x16'] },
};
// Looks IA que EXIGEM foto real da modelo (fonte 'modelo-ia'). gerar-criativos os pula sem foto.
export const IA_MODEL_LOOKS = Object.keys(IA_LOOKS).filter((k) => IA_LOOKS[k].fonte === 'modelo-ia');

const FOCO = 'The HANDBAG is the clear FOCAL POINT: sharp, crisp, prominent, well-lit; everything else softer. ';

// prompt do look de MODELO: gpt-image-2 mantém a MESMA mulher/pose/bolsa (foto real de referência),
// só troca o fundo pro nosso S-monograma e lateraliza. REGRA (cliente): o corpo PODE sangrar pra fora,
// mas ROSTO e BOLSA nunca podem ser cortados; e o lado da copy fica vazio.
function promptModelo(fmt, light) {
  const wall = light
    ? 'a soft warm CREAM/beige studio wall with a subtle tone-on-tone monogram of interlocking "S" shapes (like the LAST image), bright airy daylight'
    : 'a dark olive-green studio wall with a subtle tone-on-tone monogram of interlocking "S" shapes (like the LAST image), soft warm studio light';
  const pos = FMTGEN[fmt].layout === 'bottom'
    ? 'Use the FULL vertical space on the RIGHT SIDE: place the woman LARGE along the right, spanning from the upper area down to the bottom; her body MAY bleed off the RIGHT and BOTTOM edges. Keep the LEFT ~50% of the frame AND the TOP-LEFT area COMPLETELY EMPTY for text — nothing there. Position her FACE in the UPPER-RIGHT, well clear of the empty left/top text zone.'
    : 'Shift the woman to the RIGHT so the LEFT HALF (left 50%) is COMPLETELY EMPTY background for text — nothing on the left. Her body (shoulder, arm, hip, thighs) MAY bleed off the right and bottom edges.';
  return 'Keep the EXACT same blonde woman from the FIRST image — identical face, hair, expression, POSE, outfit and the EXACT same handbag she holds (preserve the bag shape, hardware, gold metal nameplate/logo and texture EXACTLY). Do NOT change her or the bag. ONLY replace the background: ' + wall + '. COMPOSITION IS CRITICAL: ' + pos + ' HOWEVER two things must ALWAYS be FULLY VISIBLE with comfortable margin and must NEVER be cropped by any edge: (1) her HEAD, FACE and hair — keep clear empty margin ABOVE her head, never cut the top of her head; and (2) the ENTIRE HANDBAG — every strap, edge and the metal nameplate, never cropped at any edge. Reserve the empty side/top as clean negative space for text. Photoreal high-end fashion catalog.';
}

// devolve { imgs:[[filename,buf,mime]...], prompt } por cena+formato.
// ctx: { bagBuf?, modeloBuf? }. Bolsa: fundo mestre + recorte da bolsa. Modelo: foto real + padrão S.
function cenaSpec(cena, fmt, ctx) {
  if (cena === 'modelo' || cena === 'modelo-claro') {
    return {
      imgs: [['model.jpg', ctx.modeloBuf, 'image/jpeg'], ['pat.png', asset('pattern-oficial.png'), 'image/png']],
      prompt: promptModelo(fmt, cena === 'modelo-claro'),
    };
  }
  const g = FMTGEN[fmt];
  const posBag = g.layout === 'bottom'
    ? 'standing upright, centered on the cream marble pedestal in the BOTTOM THIRD; the entire UPPER 60% is empty wall for text'
    : 'on the cream marble pedestal in the RIGHT HALF; the ENTIRE LEFT HALF empty for text; bag and chain must NOT cross the vertical center';
  const fundo = [['scene.png', asset(g.fundo), 'image/png'], ['bag.png', ctx.bagBuf, 'image/png']];
  if (cena === 'pedestal') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, oriented at the pedestal's three-quarter angle. Keep the dark olive-green S-pattern wall, warm beam and marble pedestal. Preserve the bag exactly. Photoreal, warm light, soft contact shadow.` };
  if (cena === 'marrom') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but RECOLOR the studio to a warm CHOCOLATE-BROWN/caramel tone (keep the tone-on-tone S-pattern wall and the cream marble pedestal, warm golden rim light from upper right). Preserve the bag exactly. Photoreal luxury product photography.` };
  if (cena === 'claro')  return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but as a minimalist LIGHT editorial set: soft warm CREAM/beige wall KEEPING the subtle tone-on-tone S-pattern, a pale travertine pedestal, diffused daylight, generous negative space. Preserve the bag exactly. High-end aspirational branding, airy.` };
  throw new Error('cena desconhecida: ' + cena);
}

function dataUrlToBuf(dataUrl) { const i = dataUrl.indexOf('base64,'); return Buffer.from(dataUrl.slice(i + 7), 'base64'); }
async function fotoUrlToBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error('foto modelo -> ' + r.status); return Buffer.from(await r.arrayBuffer()); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Monta multipart/form-data como Buffer (não usa FormData/Blob). Motivo: no CI o `fetch` é o shim
// curl-fetch (lib/curl-fetch.mjs), que só serializa body texto/binário/Buffer — NÃO entende FormData
// (viraria "[object FormData]" e o OpenAI recusaria). Buffer manual funciona no fetch nativo E no shim.
function montarMultipart(parts) {
  const boundary = '----vessel' + randomUUID().replace(/-/g, '');
  const chunks = [];
  const txt = (s) => chunks.push(Buffer.from(s, 'utf8'));
  for (const p of parts) {
    txt(`--${boundary}\r\n`);
    if (p.buf != null) {
      txt(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: ${p.mime}\r\n\r\n`);
      chunks.push(p.buf); txt('\r\n');
    } else {
      txt(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`);
    }
  }
  txt(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

// gpt-image-2 é lento e ocasionalmente devolve 429/5xx transitório — retry com backoff pra o
// blip não dropar o formato inteiro. 4xx que não 429 (prompt/entrada) é permanente: falha na hora.
async function gerarHero(cena, fmt, ctx, apiKey, { tentativas = 3, log = console.log } = {}) {
  const spec = cenaSpec(cena, fmt, ctx);
  const parts = [{ name: 'model', value: 'gpt-image-2' }];
  for (const [name, buf, mime] of spec.imgs) parts.push({ name: 'image[]', filename: name, mime, buf });
  parts.push({ name: 'prompt', value: spec.prompt }, { name: 'size', value: FMTGEN[fmt].size }, { name: 'quality', value: 'high' }, { name: 'n', value: '1' });
  const { body, contentType } = montarMultipart(parts);
  let ultimo;
  for (let t = 1; t <= tentativas; t++) {
    try {
      // curlMaxTime: gpt-image-2 leva 2-4min; sobe o timeout do shim curl-fetch (fetch nativo ignora o campo)
      const r = await fetch(OPENAI_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': contentType }, body, curlMaxTime: 300 });
      if (r.ok) { const j = await r.json(); return 'data:image/png;base64,' + j.data[0].b64_json; }
      const corpo = (await r.text()).slice(0, 150);
      if (r.status !== 429 && r.status < 500) throw new Error('gpt-image-2 ' + cena + '/' + fmt + ' -> ' + r.status + ' ' + corpo); // permanente
      ultimo = new Error('gpt-image-2 ' + cena + '/' + fmt + ' -> ' + r.status + ' ' + corpo); // transitório
    } catch (e) { if (/-> 4\d\d /.test(e.message) && !/-> 429 /.test(e.message)) throw e; ultimo = e; }
    if (t < tentativas) { const espera = 4000 * t; log('    [gpt retry ' + t + '/' + (tentativas - 1) + '] ' + cena + '/' + fmt + ' em ' + (espera / 1000) + 's'); await sleep(espera); }
  }
  throw ultimo;
}

// Gera + publica um LOOK IA de um SKU. `dados`: {name,camp,precoDe,precoPor,parcelado,parcelas,pct,bagDataUrl,tagline?,modeloFotoUrl?}
// fonte 'ia' -> cena de bolsa (fundo mestre + recorte da bolsa). fonte 'modelo-ia' -> foto REAL da modelo
// (dados.modeloFotoUrl) como referência; sem essa foto o look é PULADO (só saem os de bolsa). Ambas
// consomem `orcamento` (teto de gerações gpt por job).
export async function gerarLookIA(chave, { sku, campanhaId, dados, subir, inserirLinhas, formatos = null, orcamento = null, existentes = null, log = console.log }) {
  const look = IA_LOOKS[chave];
  if (!look) { log('  look IA desconhecido: ' + chave); return { ok: 0 }; }
  const usaModelo = look.fonte === 'modelo-ia';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { log('  ' + chave + ': sem OPENAI_API_KEY — pulado (' + sku + ')'); return { ok: 0 }; }
  if (usaModelo && !dados.modeloFotoUrl) { log('  ' + chave + ': sem foto real da modelo p/ ' + sku + ' — pulado (só bolsa)'); return { ok: 0 }; }
  const ctx = {};
  if (usaModelo) {
    try { ctx.modeloBuf = await fotoUrlToBuf(dados.modeloFotoUrl); }
    catch (e) { log('  ' + chave + ' ' + sku + ': falha na foto da modelo (' + e.message + ') — pulado'); return { ok: 0 }; }
  } else {
    ctx.bagBuf = dataUrlToBuf(dados.bagDataUrl);
  }
  const variants = look.modo === 'branding' ? ['branding'] : ['parcelamento', 'avista', 'desconto'];
  const fmts = ((formatos && formatos.length) ? formatos : look.formatos).filter((f) => FMTGEN[f] && look.formatos.includes(f));
  const pathDe = (fmt, variant) => `${campanhaId}/produto/${sku}-${chave}-${VARIANTES[variant] || variant}-${DIM[fmt]}.png`;
  const rows = []; let ok = 0, cortou = false, novas = 0;
  for (const fmt of fmts) {
    // idempotência: se este formato já foi gerado (path da 1ª variante existe), pula SEM gastar gpt (retomada em lotes)
    if (existentes && existentes.has(pathDe(fmt, variants[0]))) { continue; }
    // teto do LOTE: para aqui com trabalho restante -> o runner encadeia o próximo lote (idempotência retoma)
    if (orcamento && orcamento.restante <= 0) { cortou = true; log('  ' + chave + ' ' + sku + ': teto do lote atingido — ' + fmt + ' (e demais) fica p/ o próximo lote'); break; }
    let heroUrl;
    try { heroUrl = await gerarHero(look.cena, fmt, ctx, apiKey, { log }); }
    catch (e) { log('  ' + chave + ' ' + sku + ' ' + fmt + ' FALHOU: ' + e.message); continue; }
    if (orcamento) orcamento.restante -= 1;
    novas++;
    for (const variant of variants) {
      const buf = await renderCriativo(fmt, variant, heroUrl, dados);
      const variante = chave + '-' + (VARIANTES[variant] || variant);
      const path = pathDe(fmt, variant);
      const url = await subir(path, buf);
      rows.push({ campanha_id: campanhaId, sku, arquetipo: 'produto', template: chave, formato: DIM[fmt],
        variante, preco_de: dados.preco_de ?? null, preco_por: dados.preco_por ?? null, storage_path: path, url, legenda: null });
      if (existentes) existentes.add(path);
      ok++;
      // WIDESCREEN 16:9 -> gera o MP4 (motion) junto, no mesmo caminho com .mp4 (pro Google Ads).
      // Best-effort: falha de ffmpeg/motion NUNCA quebra a campanha. Desligável via HERO_IA_MOTION=0.
      if (fmt === 'youtube_16x9' && process.env.HERO_IA_MOTION !== '0') {
        try {
          const mp4 = await renderCriativoMotion(fmt, variant, heroUrl, dados);
          await subir(path.replace(/\.png$/, '.mp4'), mp4);
          log('  ' + chave + ' ' + sku + ' ' + variant + ' 16:9: mp4 (motion) OK');
        } catch (e) { log('  ' + chave + ' ' + sku + ' ' + variant + ' motion FALHOU: ' + e.message); }
      }
    }
    log('  ' + chave + ' ' + sku + ' ' + fmt + ': ' + variants.length + ' variação(ões) OK');
  }
  if (rows.length) await inserirLinhas(rows);
  return { ok, cortou, novas };
}

// compat: 'hero-ia' direto
export async function gerarHeroIASku(args) { return gerarLookIA('hero-ia', args); }
