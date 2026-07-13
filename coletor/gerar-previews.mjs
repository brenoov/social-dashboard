#!/usr/bin/env node
// coletor/gerar-previews.mjs
// SP-5 Fase A: gera a galeria de preview de cada code-look (produto ou promo)
// com dados de AMOSTRA (não usa candidatos reais) — sobe pro Storage e grava
// fabrica_looks.preview_url (a do formato feed 1080x1350) pra alimentar a UI
// de curadoria dos looks.
import './lib/carregar-env.mjs';
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const BUCKET = 'fabrica-criativos';

// foto de amostra neutra (data URL PNG cinza 1x1) — o preview é ilustrativo,
// não depende de nenhuma foto real de produto.
const FOTO_AMOSTRA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// dadosAmostra(): função pura — candidato/campanha de exemplo coerentes (De/Por + pct),
// coincide com o formato que variacoesProduto/variacoesPromo esperam de verdade.
export function dadosAmostra() {
  const cand = { sku: 'AMOSTRA', nome: 'Bolsa Modelo', categoria: 'bolsas', preco: 449.9, pct: 50 };
  const campanha = { nome: 'Amostra', desconto_pct: 50, desconto_tipo: 'fixo', parcelas: 10, marca: 'a marca' };
  return { cand, campanha, fotoDataUrl: FOTO_AMOSTRA };
}

async function sbPatch(p, body) {
  const r = await fetch(REST + p, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok && ![200, 204].includes(r.status)) throw new Error('PATCH ' + p + ' ' + r.status);
}

async function subir(path, buf) {
  const up = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok && up.status !== 200) throw new Error('storage ' + up.status + ' ' + (await up.text()).slice(0, 120));
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// run(): pra cada code-look do registry TEMPLATES, gera a variante certa (produto via
// variacoesProduto, promo via variacoesPromo filtrado pro template) com os dados de
// amostra, renderiza nos 2 formatos, sobe pro Storage e grava preview_url (do formato
// feed 1080x1350) em fabrica_looks. Não toca campanha/objetivo — é só ilustrativo.
export async function run() {
  const { cand, campanha, fotoDataUrl } = dadosAmostra();
  let n = 0;
  for (const chave of Object.keys(TEMPLATES)) {
    const arq = TEMPLATES[chave].arquetipo;
    const variants = arq === 'promo'
      ? variacoesPromo(campanha, fotoDataUrl, 'Coleção').filter((v) => v.template === chave)
      : variacoesProduto({ ...cand, fotoDataUrl }, campanha, { looks: [chave] }, 50);
    const v = variants[0];
    if (!v) { console.warn('sem variante p/', chave); continue; }
    let feedUrl = null;
    for (const formato of Object.keys(DIM)) {
      const html = TEMPLATES[chave].render(v.dados, formato);
      const buf = await renderPNG(html, DIM[formato]);
      const url = await subir(`_previews/${chave}-${formato}.png`, buf);
      if (formato === '1080x1350') feedUrl = url;
    }
    if (feedUrl) await sbPatch(`/fabrica_looks?chave=eq.${chave}`, { preview_url: feedUrl });
    n++;
  }
  await fecharRender();
  console.log(`previews gerados: ${n} looks`);
  return { previews: n };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
