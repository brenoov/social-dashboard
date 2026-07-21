// coletor/hero-ia/hero-ia.mjs
// Motor Hero-IA (fonte ADITIVA de criativos). Registro de LOOKS IA — cada um gera a cena com
// gpt-image-2 (bolsa no pedestal, bolsa em cenário, ou a modelo com a bolsa) e renderiza no motor
// HTML da fábrica (conversão com preço OU branding sem preço). NÃO toca nos 13 looks de código.
// Publica no MESMO pote (bucket + tabela fabrica_criativos) com template = a chave do look IA.
// Preços vêm do `dados` (Bling, calculado pela fábrica). Assets (fundo/pattern/modelo) no repo (CI).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIM, VARIANTES, renderCriativo } from './render-html.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const asset = (f) => readFileSync(join(DIR, 'assets', f));
const OPENAI_URL = 'https://api.openai.com/v1/images/edits';

// formato -> fundo mestre + tamanho gpt + layout do prompt (p/ cenas de bolsa)
const FMTGEN = {
  feed_1x1:     { fundo: 'fundo-1x1.png', size: '1024x1024', layout: 'right'  },
  fb_4x5:       { fundo: 'fundo-4x5.png', size: '1024x1536', layout: 'right'  },
  youtube_16x9: { fundo: 'fundo-1x1.png', size: '1536x1024', layout: 'right'  },
  stories_9x16: { fundo: 'fundo-9x16.png', size: '1024x1536', layout: 'bottom' },
};

// REGISTRO dos looks IA. cena = como o hero é gerado; modo = texto (conversao|branding); objetivos = curadoria.
export const IA_LOOKS = {
  'hero-ia':         { nome: 'Hero · IA (bolsa)',      arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], modo: 'conversao', cena: 'pedestal',     formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-marrom': { nome: 'Promo · Bolsa Caramelo', arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], modo: 'conversao', cena: 'marrom',       formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-modelo': { nome: 'Promo · Modelo',         arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], modo: 'conversao', cena: 'modelo',       formatos: ['fb_4x5','stories_9x16'] },
  'ia-brand-bolsa':  { nome: 'Branding · Bolsa',       arquetipo: 'produto', objetivos: ['branding'],                          modo: 'branding',  cena: 'claro',        formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-brand-modelo': { nome: 'Branding · Modelo',      arquetipo: 'produto', objetivos: ['branding'],                          modo: 'branding',  cena: 'modelo-claro', formatos: ['fb_4x5','stories_9x16'] },
};

const FOCO = 'The HANDBAG is the clear FOCAL POINT: sharp, crisp, prominent, well-lit; everything else softer. ';
const PATREF = 'The wall behind must show the EXACT tone-on-tone monogram pattern from the LAST image (official flowing interlocking-S motif) — subtle, low-contrast, realistic to the wall lighting/perspective; do NOT invent a different pattern. ';

// devolve { imgs:[[filename,buf,mime]...], prompt } por cena+formato
function cenaSpec(cena, fmt, bagBuf) {
  const g = FMTGEN[fmt];
  const posBag = g.layout === 'bottom'
    ? 'standing upright, centered on the cream marble pedestal in the BOTTOM THIRD; the entire UPPER 60% is empty wall for text'
    : 'on the cream marble pedestal in the RIGHT HALF; the ENTIRE LEFT HALF empty for text; bag and chain must NOT cross the vertical center';
  const posModel = 'Position the WOMAN clearly to the RIGHT, leaving the ENTIRE LEFT HALF empty for text; she presents the handbag forward (the focal point)';
  const fundo = [['scene.png', asset(g.fundo), 'image/png'], ['bag.png', bagBuf, 'image/png']];
  const modelRefs = [['model.jpg', asset('modelo.jpg'), 'image/jpeg'], ['bag.png', bagBuf, 'image/png'], ['pat.png', asset('pattern-oficial.png'), 'image/png']];
  if (cena === 'pedestal') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, oriented at the pedestal's three-quarter angle. Keep the dark olive-green S-pattern wall, warm beam and marble pedestal. Preserve the bag exactly. Photoreal, warm light, soft contact shadow.` };
  if (cena === 'marrom') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but RECOLOR the studio to a warm CHOCOLATE-BROWN/caramel tone (keep the tone-on-tone S-pattern wall and the cream marble pedestal, warm golden rim light from upper right). Preserve the bag exactly. Photoreal luxury product photography.` };
  if (cena === 'claro')  return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but as a minimalist LIGHT editorial set: soft warm CREAM/beige wall KEEPING the subtle tone-on-tone S-pattern, a pale travertine pedestal, diffused daylight, generous negative space. Preserve the bag exactly. High-end aspirational branding, airy.` };
  if (cena === 'modelo') return { imgs: modelRefs, prompt: FOCO + `Editorial studio photo of the EXACT blonde woman from the FIRST image (same face/hair/styling) holding the EXACT handbag from the SECOND image, against a dark olive-green wall. ${posModel}. ${PATREF}Preserve her identity AND the bag exactly. Photoreal fashion campaign, warm light.` };
  if (cena === 'modelo-claro') return { imgs: modelRefs, prompt: FOCO + `Aspirational branding photo of the EXACT blonde woman from the FIRST image (same face/hair) carrying the EXACT handbag from the SECOND image in a bright airy LIGHT editorial setting. ${posModel}. ${PATREF}Preserve her identity and the bag exactly. Photoreal high-fashion campaign.` };
  throw new Error('cena desconhecida: ' + cena);
}

function dataUrlToBuf(dataUrl) { const i = dataUrl.indexOf('base64,'); return Buffer.from(dataUrl.slice(i + 7), 'base64'); }

async function gerarHero(cena, fmt, bagBuf, apiKey) {
  const spec = cenaSpec(cena, fmt, bagBuf);
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  for (const [name, buf, mime] of spec.imgs) fd.append('image[]', new Blob([buf], { type: mime }), name);
  fd.append('prompt', spec.prompt);
  fd.append('size', FMTGEN[fmt].size);
  fd.append('quality', 'high');
  fd.append('n', '1');
  const r = await fetch(OPENAI_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: fd });
  if (!r.ok) throw new Error('gpt-image-2 ' + cena + '/' + fmt + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 150));
  const j = await r.json();
  return 'data:image/png;base64,' + j.data[0].b64_json;
}

// Gera + publica um LOOK IA de um SKU. `dados`: {name,camp,precoDe,precoPor,parcelado,parcelas,pct,bagDataUrl,tagline?}
export async function gerarLookIA(chave, { sku, campanhaId, dados, subir, inserirLinhas, formatos = null, log = console.log }) {
  const look = IA_LOOKS[chave];
  if (!look) { log('  look IA desconhecido: ' + chave); return { ok: 0 }; }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { log('  ' + chave + ': sem OPENAI_API_KEY — pulado (' + sku + ')'); return { ok: 0 }; }
  const bagBuf = dataUrlToBuf(dados.bagDataUrl);
  const variants = look.modo === 'branding' ? ['branding'] : ['parcelamento', 'avista', 'desconto'];
  const fmts = ((formatos && formatos.length) ? formatos : look.formatos).filter((f) => FMTGEN[f] && look.formatos.includes(f));
  const rows = []; let ok = 0;
  for (const fmt of fmts) {
    let heroUrl;
    try { heroUrl = await gerarHero(look.cena, fmt, bagBuf, apiKey); }
    catch (e) { log('  ' + chave + ' ' + sku + ' ' + fmt + ' FALHOU: ' + e.message); continue; }
    for (const variant of variants) {
      const buf = await renderCriativo(fmt, variant, heroUrl, dados);
      const variante = chave + '-' + (VARIANTES[variant] || variant);
      const path = `${campanhaId}/produto/${sku}-${variante}-${DIM[fmt]}.png`;
      const url = await subir(path, buf);
      rows.push({ campanha_id: campanhaId, sku, arquetipo: 'produto', template: chave, formato: DIM[fmt],
        variante, preco_de: dados.preco_de ?? null, preco_por: dados.preco_por ?? null, storage_path: path, url, legenda: null });
      ok++;
    }
    log('  ' + chave + ' ' + sku + ' ' + fmt + ': ' + variants.length + ' variação(ões) OK');
  }
  if (rows.length) await inserirLinhas(rows);
  return { ok };
}

// compat: 'hero-ia' direto
export async function gerarHeroIASku(args) { return gerarLookIA('hero-ia', args); }
