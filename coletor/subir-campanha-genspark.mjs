#!/usr/bin/env node
// coletor/subir-campanha-genspark.mjs — sobe os criativos GERADOS PELO GENSPARK (PNGs locais
// em ~/Downloads/criativos/{tivoli,dp}) pra 2 campanhas Meta, nomenclatura [GENSPARK] (espelha
// o subir-campanha-meta.mjs, que usa [IA] pros criativos do Claude Design).
//
// Diferença central pro subir-campanha-meta.mjs: os criativos do Genspark são PNGs SOLTOS no
// disco, sem metadados (nada de SKU/preço/look/arquétipo no Supabase). Então:
//   1) cada PNG é enviado pro bucket público `fabrica-criativos` (prefixo genspark/<loja>/),
//      virando URL pública;
//   2) essa URL entra no MESMO mecanismo /adimages-por-bytes (imageFromUrl) do script original —
//      o meta-proxy baixa a imagem e reenvia multipart pro Graph, devolvendo image_hash real.
//
// Estrutura por loja (mais simples que o [IA], porque não há distinção promo/produto):
//   Campaign "[GENSPARK] <Loja> · WhatsApp · 11-07-2026"
//     └ AdSet "Criativos Genspark" → 1 ad por PNG (todos PAUSED)
//
// Conta/página/IG/targeting/legenda: IDÊNTICOS ao subir-campanha-meta.mjs (mesma conta Vessel,
// mesmas lojas Tivoli/Dom Pedro, mesma CAPTION_PADRAO). Tudo sobe PAUSED — revisar e ativar no
// Gerenciador manualmente.
//
// Uso:
//   node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs --dry
//        # plano completo (2 campanhas / 2 conjuntos / 59 ads), SEM chamar o Graph nem o Storage
//   node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs
//        # subida REAL: sobe PNGs pro Storage + cria campanhas/conjuntos/ads (tudo PAUSED)
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loginServico } from './lib/bling-comercial.mjs';

// Mesmo fix TLS1.2 do script original (ECONNRESET determinístico atrás do Cloudflare/supabase.co
// nesta máquina). Precisa vir antes de qualquer fetch.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const DRY = process.argv.includes('--dry');

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;

// --- CFG: valores REAIS (conta Vessel, app Live) — copiados do subir-campanha-meta.mjs -------
const CFG = {
  ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174', // accountId do meta-proxy
  ACT: 'act_1197997517858139',
  PAGE: '324679337390168',
  IG: '17841462952561833',
  DAILY_BUDGET: 5000, // centavos = R$50/dia por conjunto (ABO)
  DATA_CAMPANHA: '11-07-2026',
  BUCKET: 'fabrica-criativos', // bucket público que hospeda os PNGs pro imageFromUrl
};

// Mesma legenda genérica do [IA] — o PNG já mostra SALE 50% OFF / La Vessel / shopping, não
// precisa repetir nada na caption. Usada em todos os ads das duas lojas.
const CAPTION_PADRAO = '50% OFF em bolsas La Vessel · chame no WhatsApp 💬';

const DIR_BASE = join(homedir(), 'Downloads', 'criativos');

// Lojas: mesma config de negócio do subir-campanha-meta.mjs; `pasta` = subpasta local com os
// PNGs do Genspark daquela loja.
const LOJAS = [
  {
    nome: 'Tivoli',
    pasta: 'tivoli',
    whatsapp: '+5519971690502',
    geoCities: [267873, 241913], // Santa Bárbara d'Oeste, Americana
  },
  {
    nome: 'Dom Pedro',
    pasta: 'dp',
    whatsapp: '+5519999545112',
    geoCities: [247071], // Campinas
  },
];

let TOKEN;

// --- Storage: sobe um PNG local pro bucket público e devolve a URL pública -------------------
// Em --dry não toca o Storage: devolve uma URL fake determinística.
function pubUrl(objPath) {
  return `${URL}/storage/v1/object/public/${CFG.BUCKET}/${objPath}`;
}
async function subirParaStorage(localPath, objPath) {
  if (DRY) return pubUrl(objPath);
  const bytes = readFileSync(localPath);
  const r = await fetch(`${URL}/storage/v1/object/${CFG.BUCKET}/${objPath}`, {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!r.ok && ![200, 201].includes(r.status)) {
    throw new Error(`upload Storage ${objPath} falhou (${r.status}): ${(await r.text()).slice(0, 300)}`);
  }
  return pubUrl(objPath);
}

// --- chamarProxy / meta / uploadImagemBytes: mesmos do subir-campanha-meta.mjs ----------------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let fakeSeq = 0;
async function chamarProxy(body) {
  const { path, method = 'GET', imageFromUrl } = body;
  if (DRY) {
    console.log(`\n[dry] ${method} ${path}${imageFromUrl ? ' (imageFromUrl, field=' + body.imageField + ')' : ''}`);
    console.log(JSON.stringify(imageFromUrl ? { ...body, imageFromUrl: '<url omitida no log>' } : body.params, null, 2));
    fakeSeq++;
    if (imageFromUrl) return { status: 200, d: { images: { [`fake-${fakeSeq}.png`]: { hash: `fake_hash_${fakeSeq}` } } } };
    if (method === 'POST') return { status: 200, d: { id: `fake_id_${fakeSeq}` } };
    return { status: 200, d: {} };
  }
  const MAX_TENTATIVAS = 4;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const r = await fetch(URL + '/functions/v1/meta-proxy', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        const espera = 1000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> HTTP ${r.status}, tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
      return { status: r.status, d };
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS) {
        const espera = 1000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> erro de rede (${e.message}), tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
    }
  }
  throw ultimoErro || new Error(`chamarProxy() falhou após ${MAX_TENTATIVAS} tentativas: ${method} ${path}`);
}

async function meta(path, params = {}, method = 'GET') {
  return chamarProxy({ accountId: CFG.ACCOUNT_ID, path, params, method });
}

async function uploadImagemBytes(url, field) {
  const r = await chamarProxy({ accountId: CFG.ACCOUNT_ID, path: `/${CFG.ACT}/adimages`, method: 'POST', imageFromUrl: url, imageField: field });
  if (r.status !== 200 || !r.d?.images) {
    throw new Error(`POST /adimages (bytes, field=${field}) falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 500)}`);
  }
  const hash = Object.values(r.d.images)[0]?.hash;
  if (!hash) throw new Error(`POST /adimages (bytes, field=${field}) sem hash na resposta: ${JSON.stringify(r.d).slice(0, 500)}`);
  return hash;
}

const waLink = (loja) => 'https://wa.me/' + String(loja.whatsapp).replace(/\D/g, '');

// --- creative / ad / campanha / adset: mesmos do subir-campanha-meta.mjs ----------------------
async function criarAdCreative(params) {
  let r = await meta(`/${CFG.ACT}/adcreatives`, params, 'POST');
  if (r.status !== 200 && /instagram_(user|actor)_id/i.test(JSON.stringify(r.d))) {
    console.warn('  aviso: instagram_user_id rejeitado — refazendo SEM Instagram (ad roda só no Facebook)');
    const semIG = JSON.parse(JSON.stringify(params));
    if (semIG.object_story_spec) { delete semIG.object_story_spec.instagram_user_id; delete semIG.object_story_spec.instagram_actor_id; }
    r = await meta(`/${CFG.ACT}/adcreatives`, semIG, 'POST');
    params = semIG;
  }
  if (r.status !== 200 || !r.d?.id) {
    throw new Error(`POST /adcreatives falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 800)}\npayload enviado: ${JSON.stringify(params).slice(0, 800)}`);
  }
  return { creativeId: r.d.id, payload: params };
}

function payloadImagemUnica({ hash, waLinkUrl, mensagem }) {
  return {
    object_story_spec: {
      page_id: CFG.PAGE,
      instagram_user_id: CFG.IG,
      link_data: {
        image_hash: hash,
        link: waLinkUrl,
        message: mensagem,
        call_to_action: { type: 'WHATSAPP_MESSAGE' },
      },
    },
  };
}

async function criarAd({ adsetId, name, creativeId }) {
  const ad = await meta(`/${CFG.ACT}/ads`, {
    name,
    adset_id: adsetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  }, 'POST');
  if (ad.status !== 200 || !ad.d?.id) {
    throw new Error(`POST /ads falhou (status ${ad.status}): ${JSON.stringify(ad.d).slice(0, 500)}`);
  }
  return ad.d.id;
}

async function criarCampanha(loja) {
  const campaign = await meta(`/${CFG.ACT}/campaigns`, {
    name: `[GENSPARK] ${loja.nome} · WhatsApp · ${CFG.DATA_CAMPANHA}`,
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  }, 'POST');
  if (campaign.status !== 200 || !campaign.d?.id) {
    throw new Error(`POST /campaigns falhou (status ${campaign.status}): ${JSON.stringify(campaign.d).slice(0, 500)}`);
  }
  return campaign.d.id;
}

async function criarAdSet(loja, campaignId, nomeConjunto) {
  const targeting = { geo_locations: { cities: loja.geoCities.map((key) => ({ key })) } };
  const adset = await meta(`/${CFG.ACT}/adsets`, {
    name: nomeConjunto,
    campaign_id: campaignId,
    daily_budget: CFG.DAILY_BUDGET,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: CFG.PAGE, whatsapp_phone_number: loja.whatsapp },
    targeting,
    status: 'PAUSED',
  }, 'POST');
  if (adset.status !== 200 || !adset.d?.id) {
    throw new Error(`POST /adsets falhou (status ${adset.status}): ${JSON.stringify(adset.d).slice(0, 500)}`);
  }
  return adset.d.id;
}

// --- lista os PNGs locais da loja (ignora .DS_Store e não-.png), ordem estável ---------------
function pngsDaLoja(loja) {
  const dir = join(DIR_BASE, loja.pasta);
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => ({ file: f, local: join(dir, f) }));
}

// --- criarAdDeArquivo(): Storage upload + adimages + creative (fallback IG) + ad PAUSED --------
async function criarAdDeArquivo(loja, { adsetId, item, idx }) {
  const objPath = `genspark/${loja.pasta}/${CFG.DATA_CAMPANHA}/${item.file}`;
  const url = await subirParaStorage(item.local, objPath);
  const hash = await uploadImagemBytes(url, `img${idx}`);
  const params = payloadImagemUnica({ hash, waLinkUrl: waLink(loja), mensagem: CAPTION_PADRAO });
  const { creativeId } = await criarAdCreative(params);
  const nome = `Genspark · ${loja.nome} · ${item.file.replace(/\.png$/i, '')}`;
  const adId = await criarAd({ adsetId, name: nome, creativeId });
  return { adId, hash, url };
}

async function subirLoja(loja) {
  console.log(`\n========== ${loja.nome} ==========`);
  const itens = pngsDaLoja(loja);
  console.log(`criativos Genspark encontrados: ${itens.length}`);
  const campaignId = await criarCampanha(loja);
  const adsetId = await criarAdSet(loja, campaignId, 'Criativos Genspark');
  const adIds = [];
  let idx = 0;
  for (const item of itens) {
    const { adId } = await criarAdDeArquivo(loja, { adsetId, item, idx });
    adIds.push(adId);
    idx++;
    if (!DRY) console.log(`  [${idx}/${itens.length}] ad ${adId} <- ${item.file}`);
  }
  return { loja: loja.nome, campaignId, adsetId, adCount: adIds.length };
}

async function main() {
  if (!DRY) TOKEN = await loginServico();

  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));

  console.log(`\n========== resumo${DRY ? ' (--dry)' : ''} ==========`);
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length} | ads: ${totalAds}`);
  if (DRY) console.log('(--dry) nenhuma chamada real ao Graph nem ao Storage. Todos os ids/urls são fake.');
  else console.log('\nsubida concluída — TUDO PAUSED. Revisar no Gerenciador de Anúncios e ativar manualmente.');
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
