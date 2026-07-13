#!/usr/bin/env node
// coletor/subir-estudio.mjs — sobe os criativos ESCOLHIDOS de uma rodada do Estúdio de Anúncios
// (fabrica_criativos.escolhido=true, não-purgados) pro Meta, de forma idempotente. Diferente do
// subir-campanha-genspark.mjs (que lê PNGs locais), aqui cada item já é uma URL pública na coluna
// `url` de fabrica_criativos — o upload pro /adimages sai direto dessa URL (imageFromUrl).
//
// destino:
//   { tipo: 'existente', campaignId } → injeta os criativos NOS conjuntos da campanha já existente
//       (lê destination_type + whatsapp_phone_number REAIS de cada conjunto, pra payloadCriativa
//        escolher multi-destino vs WhatsApp-puro). Produto cartesiano criativos × conjuntos.
//   { tipo: 'nova', loja } → cria 1 campanha WhatsApp (OUTCOME_ENGAGEMENT, PAUSED) + 1 conjunto e
//       sobe os criativos nesse conjunto.
//
// Idempotência: nomes de ad são determinísticos (nomeAd) — pré-busca os ads já existentes na
// campanha e pula os que já estão lá (permite re-disparar após um blip/rate-limit sem duplicar).
// Em rate limit (Meta code 17) subirCriativos para e devolve pendentes>0 — o chamador re-dispara.
//
// TUDO PAUSED — a ativação agora está disponível via o job 'ativar' (ativar-estudio.mjs), disparado
// à parte pela UI. Só o chamador (Task 5) fecha a rodada (fabrica_campanhas.fechada_em); aqui só sobe.
//
// Uso:
//   node --import ./lib/curl-fetch.mjs subir-estudio.mjs --campanha <uuid> --campaign <metaCampaignId>
//   node --import ./lib/curl-fetch.mjs subir-estudio.mjs --campanha <uuid> --loja tivoli
//   (--dry só valida o guard: não toca no Graph)
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { subirCriativos } from './lib/meta-subir.mjs';
import { carregarMarcasELojas, montarLegenda } from './lib/config-lojas.mjs';
import { carregarObjetivos, mapaObjetivo, montaPromotedObject } from './lib/objetivos.mjs';
import { montarTargeting } from './lib/publico.mjs';

// Fix TLS1.2 (ECONNRESET determinístico atrás do Cloudflare/*.supabase.co nesta máquina). Antes de
// qualquer fetch — inclusive o de dentro do loginServico().
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

const CFG_ADSET = { DAILY_BUDGET: 5000, DATA_CAMPANHA: '11-07-2026' };

// Aliases antigos de slug (CLI --loja tivoli|dp|dompedro) pro `nome` real das lojas na tabela
// fabrica_lojas (que não tem coluna de slug — só deposito_id/nome). Ver Task 3 do plano.
const ALIAS_LOJA = { tivoli: 'tivoli', dp: 'dom pedro', dompedro: 'dom pedro' };
export function resolverLoja(lojas, slug) {
  if (!slug) return undefined;   // slug vazio/undefined -> não casa nada (o chamador lança "loja inválida")
  const alvo = ALIAS_LOJA[String(slug).toLowerCase()] || String(slug).toLowerCase();
  return lojas.find((l) => l.ativo && l.nome.toLowerCase().includes(alvo));
}

let TOKEN;
let MARCA; // marca (ad account/page/ig/caption) resolvida em run(), consumida pelas funções abaixo

// --- Supabase REST (leitura service-role dos criativos escolhidos) ----------------------------
async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbPost(p, body, prefer) {
  const r = await fetch(REST + p, { method: 'POST', headers: prefer ? { ...H, Prefer: prefer } : H, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('POST ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

// --- meta-proxy: GET/POST com retry em rede/429/5xx/rate-limit (padrão do genspark) -----------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ehRateLimit(status, d) {
  const code = d?.error?.code;
  return status === 429 || status >= 500 || [4, 17, 32, 613].includes(code);
}
async function chamarProxy(body) {
  const { path, method = 'GET' } = body;
  const MAX_TENTATIVAS = 5;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const r = await fetch(URL + '/functions/v1/meta-proxy', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (ehRateLimit(r.status, d) && tentativa < MAX_TENTATIVAS) {
        const espera = 3000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> HTTP ${r.status}${d?.error?.code ? ' code ' + d.error.code : ''}, tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
      return { status: r.status, d };
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS) {
        const espera = 3000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> erro de rede (${e.message}), tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
    }
  }
  throw ultimoErro || new Error(`chamarProxy() falhou após ${MAX_TENTATIVAS} tentativas: ${method} ${path}`);
}

async function meta(path, params = {}, method = 'GET') {
  const r = await chamarProxy({ accountId: MARCA.accountId, path, params, method });
  // subirCriativos detecta rate limit pela mensagem do throw (regex code 17 / request limit).
  if ((method === 'POST') && r.status !== 200 && ehRateLimit(r.status, r.d)) {
    throw new Error(`meta ${method} ${path} rate limit / code ${r.d?.error?.code}: ${JSON.stringify(r.d).slice(0, 200)}`);
  }
  return r;
}

// GET paginado (segue paging.cursors.after) — devolve .data concatenado.
async function metaTodos(path, params = {}) {
  const itens = [];
  let after = null;
  do {
    const p = after ? { ...params, after } : params;
    const r = await meta(path, p, 'GET');
    if (r.status !== 200 || !r.d) throw new Error(`GET ${path} falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 400)}`);
    if (Array.isArray(r.d.data)) itens.push(...r.d.data);
    after = r.d.paging?.cursors?.after && r.d.data?.length ? r.d.paging.cursors.after : null;
  } while (after);
  return itens;
}

// Upload da imagem pública (fabrica_criativos.url) pro /adimages via imageFromUrl → image_hash real
// (nível da conta, reusado em todos os conjuntos). Igual ao uploadImagemBytes do genspark.
async function uploadImagemBytes(url, field) {
  const r = await chamarProxy({ accountId: MARCA.accountId, path: `/${MARCA.adAccount}/adimages`, method: 'POST', imageFromUrl: url, imageField: field });
  if (r.status !== 200 || !r.d?.images) {
    if (ehRateLimit(r.status, r.d)) throw new Error(`/adimages rate limit / code ${r.d?.error?.code}`);
    throw new Error(`POST /adimages (field=${field}) falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 500)}`);
  }
  const hash = Object.values(r.d.images)[0]?.hash;
  if (!hash) throw new Error(`POST /adimages (field=${field}) sem hash: ${JSON.stringify(r.d).slice(0, 500)}`);
  return hash;
}

// --- destino 'existente': lista os conjuntos REAIS (destination_type + whatsapp por conjunto) --
async function adsetsDaCampanha(campaignId) {
  const raw = await metaTodos(`/${campaignId}/adsets`, { fields: 'id,name,effective_status,destination_type,promoted_object', limit: 200 });
  return raw.map((a) => ({
    id: a.id,
    name: a.name,
    destinationType: a.destination_type,
    whatsapp: a.promoted_object?.whatsapp_phone_number || null,
  }));
}

// --- payload puro (sem Graph) de campaign+adset a partir da linha de fabrica_objetivos --------
// row = linha de fabrica_objetivos (mapaObjetivo); cfg = { DAILY_BUDGET, DATA }. destination_type só
// entra se a linha tiver (branding não tem => omitido); promoted_object só entra se
// montaPromotedObject(...) devolver objeto (branding='none' => undefined => omitido).
export function payloadCampanhaAdset(row, marca, loja, cfg, publico = null) {
  const campaign = {
    name: `[Estudio] ${loja.nome} · ${row.chave} · ${cfg.DATA}`,
    objective: row.meta_objective,
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  };
  const adset = {
    name: 'Estudio · Geral',
    daily_budget: cfg.DAILY_BUDGET,
    billing_event: row.billing_event || 'IMPRESSIONS',
    optimization_goal: row.optimization_goal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    targeting: montarTargeting(publico, loja),
  };
  if (row.destination_type) adset.destination_type = row.destination_type;
  const po = montaPromotedObject(row.promoted_object_tipo, marca, loja);
  if (po) adset.promoted_object = po;
  return { campaign, adset };
}

// --- destino 'nova': cria campanha + 1 conjunto a partir do objetivo da rodada -----------------
async function criarCampanhaNova(loja, objetivoRow, publico = null) {
  const { campaign: campaignPayload, adset: adsetPayload } = payloadCampanhaAdset(
    objetivoRow, MARCA, loja, { DAILY_BUDGET: CFG_ADSET.DAILY_BUDGET, DATA: CFG_ADSET.DATA_CAMPANHA }, publico,
  );

  const campaign = await meta(`/${MARCA.adAccount}/campaigns`, campaignPayload, 'POST');
  if (campaign.status !== 200 || !campaign.d?.id) throw new Error(`POST /campaigns falhou (status ${campaign.status}): ${JSON.stringify(campaign.d).slice(0, 500)}`);
  const campaignId = campaign.d.id;

  const adset = await meta(`/${MARCA.adAccount}/adsets`, { ...adsetPayload, campaign_id: campaignId }, 'POST');
  if (adset.status !== 200 || !adset.d?.id) throw new Error(`POST /adsets falhou (status ${adset.status}): ${JSON.stringify(adset.d).slice(0, 500)}`);

  return { campaignId, adsets: [{ id: adset.d.id, name: 'Estudio · Geral', destinationType: objetivoRow.destination_type, whatsapp: loja.whatsapp }] };
}

// --- run(): API pública do módulo -------------------------------------------------------------
export async function run({ campanhaId, destino, dry = false }) {
  const criouCampanha = destino?.tipo === 'nova';
  if (dry) return { adIds: [], pendentes: 0, metaCampaignId: null, adsetIds: [], criouCampanha };

  TOKEN = await loginServico();

  // 0) marca+lojas da tabela (fabrica_marcas/fabrica_lojas) — substitui CFG/LOJAS hardcoded.
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  if (!marcaAtiva) throw new Error('nenhuma marca ativa configurada (fabrica_marcas.ativo)');
  MARCA = marcaAtiva; // conta usada p/ upload de imagem e (destino 'existente') pros conjuntos já existentes

  // 1) criativos escolhidos (não-purgados) da rodada
  const escolhidos = await sbGet(`/fabrica_criativos?select=id,url,storage_path,legenda&campanha_id=eq.${campanhaId}&escolhido=eq.true&purgado_em=is.null`);
  if (escolhidos.length === 0) return { adIds: [], pendentes: 0, metaCampaignId: null, adsetIds: [], criouCampanha };

  // 2) resolve metaCampaignId + adsets conforme o destino
  let metaCampaignId, adsets, lojaNova;
  if (destino?.tipo === 'existente') {
    metaCampaignId = destino.campaignId;
    adsets = await adsetsDaCampanha(metaCampaignId);
  } else if (destino?.tipo === 'nova') {
    lojaNova = resolverLoja(lojas, destino.loja);
    if (!lojaNova || !lojaNova.marca) throw new Error(`loja inválida p/ destino 'nova': ${destino.loja} (use tivoli|dp)`);
    MARCA = lojaNova.marca; // a loja pode pertencer a uma marca diferente da marcaAtiva global
    // objetivo da rodada (fabrica_campanhas.objetivo) -> linha de fabrica_objetivos (fallback 'engajamento')
    const campanha = (await sbGet(`/fabrica_campanhas?select=objetivo&id=eq.${campanhaId}`))[0];
    const { porChave } = await carregarObjetivos(sbGet);
    const objetivoRow = mapaObjetivo(porChave, campanha?.objetivo || 'engajamento');
    const publico = destino.publico || null;
    ({ campaignId: metaCampaignId, adsets } = await criarCampanhaNova(lojaNova, objetivoRow, publico));
  } else {
    throw new Error(`destino inválido: ${JSON.stringify(destino)} (use {tipo:'existente',campaignId} ou {tipo:'nova',loja})`);
  }
  if (!adsets.length) throw new Error(`campanha ${metaCampaignId} não tem conjuntos — nada onde subir`);

  // 3) idempotência: ads já existentes na campanha (nome determinístico via nomeAd)
  const existentes = await metaTodos(`/${metaCampaignId}/ads`, { fields: 'name,adset_id', limit: 500 });
  const jaTem = new Set(existentes.map((a) => `${a.adset_id}::${a.name}`));

  // Legenda de MARCA a partir do template (fabrica_marcas.caption_template). Este fluxo não tem um
  // desconto_pct já resolvido (fica em fabrica_campanhas, não em fabrica_criativos) — sem inventar
  // número aqui, monta só com {marca} e deixa {desconto} vazio (trim tira o espaço sobrando). É o
  // FALLBACK duplo: por item (quando c.legenda é null) e como mensagem global do subirCriativos.
  const legendaMarca = montarLegenda(MARCA.captionTemplate, { marca: MARCA.nome }).trim();

  // 4) itens: cada criativo escolhido vira 1 item; getHash sobe a URL pública 1x (hash da conta).
  // mensagem por item = legenda persuasiva por produto (gerada no gerar) ou a legenda de marca.
  const itens = escolhidos.map((c, i) => ({ chave: c.id, url: c.url, mensagem: c.legenda || legendaMarca, getHash: () => uploadImagemBytes(c.url, 'img' + i) }));

  // 5) sobe (item × adset), PAUSED, idempotente; onAd coleta os adIds pro rastro
  const adIds = [];
  const res = await subirCriativos({
    meta, act: MARCA.adAccount, page: MARCA.pageId, ig: MARCA.igId,
    itens, adsets, prefixo: 'Estudio', mensagem: legendaMarca, jaTem,
    onAd: ({ adId }) => adIds.push(adId),
  });

  // 6) rastro em fabrica_meta_jobs (uma linha por rodada; ad_ids/adset_ids são jsonb — migration 016)
  try {
    await sbPost('/fabrica_meta_jobs', [{
      ad_account_id: MARCA.adAccount,
      loja: destino?.tipo === 'nova' ? (lojaNova?.nome || destino.loja) : null,
      tipo: 'estudio',
      meta_campaign_id: metaCampaignId,
      adset_ids: adsets.map((a) => a.id),
      ad_ids: adIds,
      payload: { campanhaId, destino, escolhidos: escolhidos.length, caption: legendaMarca },
      status: res.pendentes ? 'parcial' : 'criado',
      erro: res.rateLimited ? `rate limit — ${res.pendentes} pendente(s)` : null,
    }], 'return=minimal');
  } catch (e) {
    console.warn(`aviso: não gravou fabrica_meta_jobs (${e.message}) — subida seguiu normal`);
  }

  return { adIds, pendentes: res.pendentes, metaCampaignId, adsetIds: adsets.map((a) => a.id), criouCampanha };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
  run({
    campanhaId: arg('--campanha'),
    destino: arg('--campaign') ? { tipo: 'existente', campaignId: arg('--campaign') } : { tipo: 'nova', loja: arg('--loja') },
    dry: process.argv.includes('--dry'),
  }).then((r) => console.log('subir concluído:', r)).catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
}
