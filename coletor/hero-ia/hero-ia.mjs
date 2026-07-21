// coletor/hero-ia/hero-ia.mjs
// Motor Hero-IA (fonte ADITIVA de criativos): por SKU, gera 4 heros fotorreais com gpt-image-2
// (bolsa no pedestal do fundo mestre) e renderiza 4 formatos × 3 variações de preço no motor
// HTML da fábrica. NÃO toca nos 13 looks de código. Publica no MESMO pote (bucket + tabela
// fabrica_criativos) com template:'hero-ia'. Preços vêm do `dados` (Bling, calculado pela fábrica).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FMT, DIM, VARIANTES, renderCriativo } from './render-html.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const FUNDO = {
  feed_1x1:     { file: 'fundo-1x1.png', size: '1024x1024', layout: 'right'  },
  fb_4x5:       { file: 'fundo-4x5.png', size: '1024x1536', layout: 'right'  },
  youtube_16x9: { file: 'fundo-1x1.png', size: '1536x1024', layout: 'right'  },
  stories_9x16: { file: 'fundo-9x16.png', size: '1024x1536', layout: 'bottom' },
};
const OPENAI_URL = 'https://api.openai.com/v1/images/edits';

function promptFor(layout) {
  const pos = layout === 'bottom'
    ? 'standing upright, centered on the cream marble pedestal in the BOTTOM THIRD of the tall frame; the entire UPPER 60% is empty dark olive-green patterned wall reserved for text'
    : 'small-to-medium, standing upright on the cream marble pedestal in the RIGHT HALF of the frame; the entire LEFT HALF is empty dark olive-green patterned wall reserved for text; the bag and chain must NOT cross the vertical center';
  return `Place the exact handbag shown in the SECOND image ${pos} in the FIRST image, resting fully on the pedestal top, oriented at the SAME three-quarter corner angle as the pedestal. Keep the dark olive-green S-pattern wall, warm light beam and corner-view marble pedestal exactly. Preserve the bag's EXACT shape, proportions, material and texture, all hardware, straps/handles, and the metal nameplate/logo exactly as in the reference. Photoreal editorial product photography, warm light from upper right, soft realistic contact shadow, cohesive warm-olive color grade.`;
}

// data URL (recorte da fábrica) -> Buffer
function dataUrlToBuf(dataUrl) {
  const i = dataUrl.indexOf('base64,');
  return Buffer.from(dataUrl.slice(i + 7), 'base64');
}

async function gerarHero(fmt, bagBuf, apiKey) {
  const cfg = FUNDO[fmt];
  const sceneBuf = readFileSync(join(DIR, 'assets', cfg.file));
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('image[]', new Blob([sceneBuf], { type: 'image/png' }), 'scene.png');
  fd.append('image[]', new Blob([bagBuf], { type: 'image/png' }), 'bag.png');
  fd.append('prompt', promptFor(cfg.layout));
  fd.append('size', cfg.size);
  fd.append('quality', 'high');           // gpt-image-2 NÃO aceita input_fidelity
  fd.append('n', '1');
  const r = await fetch(OPENAI_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: fd });
  if (!r.ok) throw new Error('gpt-image-2 ' + fmt + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return 'data:image/png;base64,' + j.data[0].b64_json;
}

// Gera + publica os criativos hero-ia de UM SKU. `dados`: {name,camp,precoDe,precoPor,parcelado,parcelas,pct,bagDataUrl}
// subir(path, buf)->url e linhas(rows) vêm do gerar-criativos (reuso de infra + credencial).
export async function gerarHeroIASku({ sku, campanhaId, dados, subir, inserirLinhas, formatos = null, log = console.log }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { log('  hero-ia: sem OPENAI_API_KEY — pulando SKU ' + sku); return { ok: 0 }; }
  const bagBuf = dataUrlToBuf(dados.bagDataUrl);
  const fmts = (formatos && formatos.length) ? formatos.filter((f) => FUNDO[f]) : Object.keys(FUNDO);
  const rows = []; let ok = 0;
  for (const fmt of fmts) {
    let heroUrl;
    try { heroUrl = await gerarHero(fmt, bagBuf, apiKey); }
    catch (e) { log('  hero-ia ' + sku + ' ' + fmt + ' FALHOU: ' + e.message); continue; }
    for (const variant of Object.keys(VARIANTES)) {
      const buf = await renderCriativo(fmt, variant, heroUrl, dados);
      const variante = 'hero-ia-' + VARIANTES[variant];
      const path = `${campanhaId}/produto/${sku}-${variante}-${DIM[fmt]}.png`;
      const url = await subir(path, buf);
      rows.push({ campanha_id: campanhaId, sku, arquetipo: 'produto', template: 'hero-ia',
        formato: DIM[fmt], variante, preco_de: dados.preco_de ?? null, preco_por: dados.preco_por ?? null,
        storage_path: path, url, legenda: null });
      ok++;
    }
    log('  hero-ia ' + sku + ' ' + fmt + ': 3 variações OK');
  }
  if (rows.length) await inserirLinhas(rows);
  return { ok };
}
