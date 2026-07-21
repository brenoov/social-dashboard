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

// REGISTRO dos looks IA. `fonte`: 'ia' = cena da bolsa GERADA por gpt-image-2 (produto é fiel, ok);
// 'foto-modelo' = usa a FOTO REAL da modelo+bolsa do acervo (fotos-modelo-map.json), SEM IA — a imagem
// da modelo NÃO pode ser usada p/ geração por IA (licenciamento). Sem foto real -> look pulado (só bolsa).
// modo = texto (conversao com preço | branding sem preço); objetivos = curadoria.
export const IA_LOOKS = {
  'hero-ia':         { nome: 'Hero · IA (bolsa)',      arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'ia',          modo: 'conversao', cena: 'pedestal', formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-marrom': { nome: 'Promo · Bolsa Caramelo', arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'ia',          modo: 'conversao', cena: 'marrom',   formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-promo-modelo': { nome: 'Promo · Modelo',         arquetipo: 'produto', objetivos: ['conversao','engajamento','trafego'], fonte: 'foto-modelo', modo: 'conversao', cena: null,       formatos: ['fb_4x5','stories_9x16'] },
  'ia-brand-bolsa':  { nome: 'Branding · Bolsa',       arquetipo: 'produto', objetivos: ['branding'],                          fonte: 'ia',          modo: 'branding',  cena: 'claro',    formatos: ['feed_1x1','fb_4x5','stories_9x16','youtube_16x9'] },
  'ia-brand-modelo': { nome: 'Branding · Modelo',      arquetipo: 'produto', objetivos: ['branding'],                          fonte: 'foto-modelo', modo: 'branding',  cena: null,       formatos: ['fb_4x5','stories_9x16'] },
};
// Looks IA que EXIGEM foto real da modelo (fonte 'foto-modelo'). gerar-criativos os pula sem foto.
export const IA_MODEL_LOOKS = Object.keys(IA_LOOKS).filter((k) => IA_LOOKS[k].fonte === 'foto-modelo');

const FOCO = 'The HANDBAG is the clear FOCAL POINT: sharp, crisp, prominent, well-lit; everything else softer. ';

// devolve { imgs:[[filename,buf,mime]...], prompt } por CENA DE BOLSA (só fonte 'ia'). A cena da bolsa é
// gerada por IA porque o produto é reproduzido fielmente; a modelo nunca é gerada (ver fonte 'foto-modelo').
function cenaSpec(cena, fmt, bagBuf) {
  const g = FMTGEN[fmt];
  const posBag = g.layout === 'bottom'
    ? 'standing upright, centered on the cream marble pedestal in the BOTTOM THIRD; the entire UPPER 60% is empty wall for text'
    : 'on the cream marble pedestal in the RIGHT HALF; the ENTIRE LEFT HALF empty for text; bag and chain must NOT cross the vertical center';
  const fundo = [['scene.png', asset(g.fundo), 'image/png'], ['bag.png', bagBuf, 'image/png']];
  if (cena === 'pedestal') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, oriented at the pedestal's three-quarter angle. Keep the dark olive-green S-pattern wall, warm beam and marble pedestal. Preserve the bag exactly. Photoreal, warm light, soft contact shadow.` };
  if (cena === 'marrom') return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but RECOLOR the studio to a warm CHOCOLATE-BROWN/caramel tone (keep the tone-on-tone S-pattern wall and the cream marble pedestal, warm golden rim light from upper right). Preserve the bag exactly. Photoreal luxury product photography.` };
  if (cena === 'claro')  return { imgs: fundo, prompt: FOCO + `Place the exact handbag from the SECOND image ${posBag} in the FIRST image, but as a minimalist LIGHT editorial set: soft warm CREAM/beige wall KEEPING the subtle tone-on-tone S-pattern, a pale travertine pedestal, diffused daylight, generous negative space. Preserve the bag exactly. High-end aspirational branding, airy.` };
  throw new Error('cena de bolsa desconhecida: ' + cena);
}

function dataUrlToBuf(dataUrl) { const i = dataUrl.indexOf('base64,'); return Buffer.from(dataUrl.slice(i + 7), 'base64'); }

// baixa a foto real da modelo (URL pública) -> data URL, p/ virar o hero do render (sem IA)
async function fotoUrlToDataUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('foto modelo -> ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

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

// Gera + publica um LOOK IA de um SKU. `dados`: {name,camp,precoDe,precoPor,parcelado,parcelas,pct,bagDataUrl,tagline?,modeloFotoUrl?}
// fonte 'ia'  -> cena da bolsa gerada por gpt-image-2 (produto fiel). fonte 'foto-modelo' -> FOTO REAL da
// modelo+bolsa (dados.modeloFotoUrl), SEM IA; sem essa foto o look é PULADO (a imagem da modelo não pode
// ser gerada por IA — licenciamento; nesses casos só saem os criativos de bolsa).
export async function gerarLookIA(chave, { sku, campanhaId, dados, subir, inserirLinhas, formatos = null, log = console.log }) {
  const look = IA_LOOKS[chave];
  if (!look) { log('  look IA desconhecido: ' + chave); return { ok: 0 }; }
  const usaFotoReal = look.fonte === 'foto-modelo';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!usaFotoReal && !apiKey) { log('  ' + chave + ': sem OPENAI_API_KEY — pulado (' + sku + ')'); return { ok: 0 }; }
  if (usaFotoReal && !dados.modeloFotoUrl) { log('  ' + chave + ': sem foto real da modelo p/ ' + sku + ' — pulado (só bolsa)'); return { ok: 0 }; }
  // foto real da modelo: baixa 1x e reusa em todos os formatos (object-fit cover recorta). SEM gpt.
  let fotoModeloHero = null;
  if (usaFotoReal) {
    try { fotoModeloHero = await fotoUrlToDataUrl(dados.modeloFotoUrl); }
    catch (e) { log('  ' + chave + ' ' + sku + ': falha na foto da modelo (' + e.message + ') — pulado'); return { ok: 0 }; }
  }
  const bagBuf = usaFotoReal ? null : dataUrlToBuf(dados.bagDataUrl);
  const variants = look.modo === 'branding' ? ['branding'] : ['parcelamento', 'avista', 'desconto'];
  const fmts = ((formatos && formatos.length) ? formatos : look.formatos).filter((f) => FMTGEN[f] && look.formatos.includes(f));
  const rows = []; let ok = 0;
  for (const fmt of fmts) {
    let heroUrl;
    if (usaFotoReal) { heroUrl = fotoModeloHero; }
    else {
      try { heroUrl = await gerarHero(look.cena, fmt, bagBuf, apiKey); }
      catch (e) { log('  ' + chave + ' ' + sku + ' ' + fmt + ' FALHOU: ' + e.message); continue; }
    }
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
