#!/usr/bin/env node
// coletor/gerar-criativos.mjs
// F2a: gera criativos (produto De/Por + promo) da última rodada da F1 + campanha.
// Uso: node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales" [--parcelas 10] [--dry]
import './lib/carregar-env.mjs';
import { loginServico } from './lib/bling-comercial.mjs';
import { fotoDataUrl } from './lib/foto-produto.mjs';
import { renderPNG, fecharRender, ehFotoStudio } from './lib/render-criativo.mjs';
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';
import { gerarCopysProduto, gerarCopyPromo } from './lib/copy-efeito.mjs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const PCT = Number(arg('--pct', '50'));
const NOME = arg('--nome', PCT + '% OFF');
const PARCELAS = Number(arg('--parcelas', '10'));
const LIMITE = process.argv.includes('--limite') ? Number(arg('--limite', '5')) : Infinity;
const LOJA = arg('--loja', null);
const FONTE = arg('--fonte', null);

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const BUCKET = 'fabrica-criativos';
const sane = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '_');

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
  let q = `/fabrica_candidatos?select=id,sku,nome,preco,selecionado,deposito_id,fonte&rodada_id=eq.${rodadaId}&selecionado=eq.true`;
  if (LOJA) q += `&deposito_id=eq.${LOJA}`;
  if (FONTE) q += `&fonte=eq.${FONTE}`;
  q += `&order=loja_nome`;
  const cands = await sbGet(q);
  console.log('rodada', rod[0].rodada, '| candidatos selecionados:', cands.length);

  const campanha = { desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS };

  // campanha
  let campanhaId = null;
  if (!DRY) {
    const c = await sbPost('/fabrica_campanhas', [{ nome: NOME, desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS }], 'return=representation');
    campanhaId = (await c.json())[0].id;
    await garantirBucket();
  }

  // produtos únicos por sku (arte é por produto, não por loja), limitados por --limite
  const vistos = new Set();
  const produtosUnicos = [];
  for (const c of cands) {
    if (c.sku && vistos.has(c.sku)) continue;
    if (c.sku) vistos.add(c.sku);
    produtosUnicos.push(c);
  }
  const produtos = produtosUnicos.slice(0, LIMITE);
  console.log('produtos únicos:', produtosUnicos.length, '| gerando para:', produtos.length);

  // copy de efeito em lote (uma chamada pros produtos + uma pra promo)
  const copys = await gerarCopysProduto(produtos.map(c => ({ sku: c.sku, nome: c.nome })), campanha);
  const copyPromo = await gerarCopyPromo(campanha);
  console.log('copy promo:', copyPromo);

  let gerados = 0;
  // dedup de foto por sku (produtos iguais em lojas diferentes)
  const fotoCache = new Map();
  const fotoDe = async (sku) => { if (!fotoCache.has(sku)) fotoCache.set(sku, await fotoDataUrl(token, sku)); return fotoCache.get(sku); };

  // PRODUTO
  for (const cand of produtos) {
    if (cand.preco == null) { console.log('  sem preço:', cand.sku); continue; }
    const foto = await fotoDe(cand.sku);
    if (!foto) { console.warn('  sem foto:', cand.sku, cand.nome); continue; }
    if (!(await ehFotoStudio(foto))) { console.log('  foto amadora, pulado:', cand.sku); continue; }
    const copyInfo = copys.get(cand.sku) || {};
    for (const v of variacoesProduto({ ...cand, fotoDataUrl: foto }, campanha)) {
      v.dados.copyEfeito = copyInfo.copy;
      v.dados.nome = copyInfo.nome;
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] produto', cand.sku, v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/produto/${sane(cand.sku)}-${sane(v.variante)}-${v.formato}.png`;
      const url = await subir(path, buf);
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, candidato_id: cand.id, arquetipo: 'produto', template: v.template, formato: v.formato, variante: v.variante, preco_de: v.preco_de, preco_por: v.preco_por, storage_path: path, url }], 'return=minimal');
    }
  }

  // PROMO (usa a 1ª foto disponível como símbolo)
  const primeiraFoto = [...fotoCache.values()].find(Boolean) || null;
  if (primeiraFoto) {
    for (const v of variacoesPromo(campanha, primeiraFoto, 'Coleção')) {
      v.dados.copyEfeito = copyPromo;
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] promo', v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/promo/${sane(v.variante)}-${v.formato}.png`;
      const url = await subir(path, buf);
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, arquetipo: 'promo', template: v.template, formato: v.formato, variante: v.variante, storage_path: path, url }], 'return=minimal');
    }
  }

  await fecharRender();
  console.log(DRY ? `\n(--dry) geraria ${gerados} criativos.` : `\ngerado: ${gerados} criativos | campanha ${campanhaId}`);
}
main().catch(async e => { await fecharRender(); console.error('FALHOU:', e.message); process.exit(1); });
