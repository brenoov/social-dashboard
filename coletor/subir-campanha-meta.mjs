#!/usr/bin/env node
// coletor/subir-campanha-meta.mjs — F3: sobe 2 campanhas WhatsApp PAUSED (Tivoli, Dom Pedro)
// na conta Vessel, a partir dos criativos da F2a/F3 Task 3b, via meta-proxy (Graph v22).
// Estrutura por loja: Campaign → 2 AdSets (Geral=promo, De/Por=produto) → por criativo:
// AdImage → AdCreative → Ad. Tudo sempre PAUSED — nada ativa sozinho.
//
// --dry: monta e imprime todos os payloads (Campaign/AdSet/AdImage/AdCreative/Ad) SEM
// chamar o Graph — atribui ids fake pra seguir o fluxo até o fim. Uso normal:
//   node subir-campanha-meta.mjs --dry
// Subida real (Task 5):
//   node subir-campanha-meta.mjs
import './lib/carregar-env.mjs';
import { loginServico } from './lib/bling-comercial.mjs';

const DRY = process.argv.includes('--dry');

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY;
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

// --- CFG: valores REAIS capturados no spike (F3 Task 1 — coletor/spike-meta.mjs) --------
const CFG = {
  ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174', // Vessel (accountId do meta-proxy)
  ACT: 'act_1197997517858139',
  PAGE: '324679337390168',
  IG: '17841462952561833',
  // Número de WhatsApp da BM: o spike (Task 1, item c) mostrou que o token atual NÃO tem
  // `whatsapp_business_management`, então não deu pra recuperar nenhum número via Graph
  // (`/me/businesses` vazio; `/{business}/owned_whatsapp_business_accounts` = erro de
  // permissão). PREENCHER manualmente após o app ser re-permissionado, antes da Task 5.
  // Hoje o motor NÃO manda número explícito — usa `destination_type:'WHATSAPP'` +
  // `promoted_object:{page_id}` (padrão de Click-to-WhatsApp, resolve pelo número
  // conectado à Página). Se a Task 5 mostrar que o Graph exige o número explícito em
  // algum campo, usar este valor aqui.
  WHATSAPP_NUMBER: 'PREENCHER_APOS_SPIKE',
  DAILY_BUDGET: 5000, // centavos = R$50/dia por conjunto (ABO)
};

// Lojas: geo keys verificadas no spike (Task 1, item b); campanhaId = F3 Task 3b
// (gerar-criativos.mjs --estrela), que já contém os criativos `produto` (De/Por, top
// faturamento c/ estoque) E `promo` (Geral) daquela loja.
const LOJAS = [
  {
    nome: 'Tivoli',
    campanhaId: '642e7da8-952e-46be-a3a0-668c86da8c83', // Tivoli Estrela (F3 Task 3b)
    geoCities: [267873, 241913], // Santa Bárbara d'Oeste, Americana
  },
  {
    nome: 'Dom Pedro',
    campanhaId: '223b6e3b-fb99-45b7-a125-4628016dab64', // Dom Pedro Estrela (F3 Task 3b)
    geoCities: [247071], // Campinas
  },
];

let TOKEN;

// Igual ao helper do spike (coletor/spike-meta.mjs), com o desvio --dry: nunca toca o
// Graph, só imprime o payload e devolve uma resposta fake pro fluxo continuar.
let fakeSeq = 0;
async function meta(path, params = {}, method = 'GET') {
  if (DRY) {
    console.log(`\n[dry] ${method} ${path}`);
    console.log(JSON.stringify(params, null, 2));
    fakeSeq++;
    if (method === 'POST' && /\/adimages$/.test(path)) {
      return { status: 200, d: { images: { [`fake-${fakeSeq}`]: { hash: `fake_hash_${fakeSeq}` } } } };
    }
    if (method === 'POST') return { status: 200, d: { id: `fake_id_${fakeSeq}` } };
    return { status: 200, d: {} };
  }
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: CFG.ACCOUNT_ID, path, params, method }),
  });
  const d = await r.json();
  return { status: r.status, d };
}

async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status);
  return r.json();
}
async function sbPost(p, body, prefer) {
  const r = await fetch(REST + p, { method: 'POST', headers: prefer ? { ...H, Prefer: prefer } : H, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('POST ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

const brl = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

// storage_path: <campanha>/produto/<SKU_SANEITIZADO>-<variante>-<formato>.png
// (fabrica_criativos não guarda nome/sku em coluna própria pro lote "estrela" —
// candidato_id é null, ver F3 Task 3b — então recuperamos um rótulo legível a partir do
// storage_path, que é o único lugar onde o sku sobrevive.)
function skuDeStorage(path) {
  const file = (path || '').split('/').pop() || '';
  const semExt = file.replace(/\.png$/, '');
  const semSufixo = semExt.replace(/-(avista|parcelado)-\d+x\d+$/, '');
  return semSufixo.replace(/_/g, ' ');
}

function copyProduto(loja, c) {
  const rotulo = skuDeStorage(c.storage_path);
  return `${rotulo} — de ${brl(c.preco_de)} por ${brl(c.preco_por)} na ${loja.nome}. Chama no WhatsApp e garante o seu!`;
}

function copyPromo(loja) {
  return `50% OFF em peças selecionadas na ${loja.nome}, parcelado em até 10x. Chama no WhatsApp e confira!`;
}

async function buscarCriativos(loja) {
  const promo = await sbGet(`/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.promo&formato=eq.1080x1920&order=created_at`);
  // 1 anúncio por produto: variante=avista + formato=1080x1920 (evita duplicar
  // avista/parcelado × 2 formatos por produto).
  const produto = await sbGet(`/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.produto&variante=eq.avista&formato=eq.1080x1920&order=created_at`);
  return { promo, produto };
}

async function subirConjunto({ loja, campaignId, nomeConjunto, criativos, buildMessage }) {
  const adset = await meta(`/${CFG.ACT}/adsets`, {
    name: `${loja.nome} — ${nomeConjunto}`,
    campaign_id: campaignId,
    daily_budget: CFG.DAILY_BUDGET,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: CFG.PAGE },
    targeting: { geo_locations: { cities: loja.geoCities.map((key) => ({ key })) } },
    status: 'PAUSED',
  }, 'POST');
  const adsetId = adset.d.id;

  const adIds = [];
  for (const c of criativos) {
    // TODO F3.1: confirmar mecanismo de imagem (adimages-url vs picture-url vs patch
    // meta-proxy) na Task 5 — o spike (Task 1, item d) mostrou que POST /adimages com
    // `url` falha hoje (capability do app: "does not have the capability to make this
    // API call"), e o fallback `bytes` base64 quebra no meta-proxy (bug de query string
    // em vez de body). Em --dry isto só imprime o payload pretendido.
    const img = await meta(`/${CFG.ACT}/adimages`, { url: c.url }, 'POST');
    const imageHash = img.d?.images ? Object.values(img.d.images)[0]?.hash : img.d?.hash;

    const creative = await meta(`/${CFG.ACT}/adcreatives`, {
      object_story_spec: {
        page_id: CFG.PAGE,
        instagram_actor_id: CFG.IG,
        link_data: {
          image_hash: imageHash,
          message: buildMessage(c),
          call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } },
        },
      },
    }, 'POST');
    const creativeId = creative.d.id;

    const ad = await meta(`/${CFG.ACT}/ads`, {
      name: `${loja.nome} — ${nomeConjunto} — ${c.id.slice(0, 8)}`,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    }, 'POST');
    adIds.push(ad.d.id);
  }
  return { adsetId, adIds };
}

async function subirLoja(loja) {
  console.log(`\n========== ${loja.nome} ==========`);
  const { promo, produto } = await buscarCriativos(loja);
  console.log(`criativos: ${promo.length} promo (Geral) | ${produto.length} produto (De/Por, 1 por SKU)`);
  if (!promo.length) console.warn(`  aviso: sem criativo promo pra ${loja.nome} — conjunto Geral ficará sem ad`);
  if (!produto.length) console.warn(`  aviso: sem criativos produto pra ${loja.nome} — conjunto De/Por ficará sem ad`);

  const campaign = await meta(`/${CFG.ACT}/campaigns`, {
    name: `${loja.nome} — WhatsApp`,
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false, // exigido pela API v22 (achado do spike, Task 1 item e)
  }, 'POST');
  const campaignId = campaign.d.id;

  const geral = await subirConjunto({ loja, campaignId, nomeConjunto: 'Geral', criativos: promo, buildMessage: () => copyPromo(loja) });
  const dePor = await subirConjunto({ loja, campaignId, nomeConjunto: 'De/Por', criativos: produto, buildMessage: (c) => copyProduto(loja, c) });

  const job = {
    conta_id: null,
    ad_account_id: CFG.ACT,
    loja: loja.nome,
    tipo: 'whatsapp',
    meta_campaign_id: campaignId,
    adset_ids: [geral.adsetId, dePor.adsetId],
    ad_ids: [...geral.adIds, ...dePor.adIds],
    payload: { geoCities: loja.geoCities, criativos: { promo: promo.length, produto: produto.length } },
    status: 'criado',
  };
  if (!DRY) {
    await sbPost('/fabrica_meta_jobs', [job], 'return=minimal');
  } else {
    console.log(`\n[dry] fabrica_meta_jobs (NÃO gravado em --dry):`);
    console.log(JSON.stringify(job, null, 2));
  }
  return { loja: loja.nome, campaignId, adsetIds: job.adset_ids, adCount: job.ad_ids.length };
}

async function main() {
  if (!DRY) TOKEN = await loginServico();
  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));

  console.log('\n========== resumo ==========');
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length * 2} | ads: ${totalAds}`);
  console.log(DRY ? '(--dry) nenhuma chamada real ao Graph. Todos os ids acima são fake.' : '\nsubida concluída — TUDO PAUSED. Revisar no Gerenciador de Anúncios e ativar manualmente.');
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
