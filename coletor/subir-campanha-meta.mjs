#!/usr/bin/env node
// coletor/subir-campanha-meta.mjs — F3 launch limpo (1 ad por produto, LOOK ROTATIVO,
// Story 1080x1920, IG, WhatsApp). WhatsApp (PAUSED) pra conta Vessel.
//
// Estrutura por loja:
//   Campaign "[IA] <Loja> · WhatsApp · 11-07-2026"
//     └ AdSet "Geral (Promo)"  → 1 ad (o criativo promo, Story 1080x1920)
//     └ AdSet "De x Por"       → 1 ad por PRODUTO (SKU), look ROTATIVO, Story 1080x1920
//
// DECISÃO desta rodada (substitui o look fixo produto-heroi de tentativas anteriores):
// 1 ad por produto, mas o LOOK varia produto a produto — índice do SKU (ordem estável) % 3:
// 0=produto-heroi, 1=produto-sage-circulo, 2=produto-preco-tipo. Isso evita que a campanha
// inteira pareça uma "cópia colada" do mesmo template — ver buscarProdutosRotacaoLook().
// Só o formato Story (1080x1920) sobe nesta rodada; os formatos Post (1080x1350) continuam
// ignorados de propósito. Caption limpa e genérica (o PNG já mostra nome do produto + preço,
// não precisa repetir o nome longo do Bling na legenda) — ver CAPTION_PADRAO.
//
// Fallback de look: nem todo SKU tem uma linha pro look sorteado (ex.: produto-preco-tipo não
// existe nos lotes atuais — só heroi/sage-circulo). Se o look sorteado não tiver linha
// 1080x1920 pro SKU, usa QUALQUER linha 1080x1920 daquele produto (não pula o produto só por
// causa do look — ver buscarProdutosRotacaoLook()).
//
// Mecanismo de imagem (validado ao vivo, reaproveitado das tentativas anteriores): POST
// /adimages por BYTES via meta-proxy (`imageFromUrl` — o meta-proxy baixa a imagem no
// servidor e reenvia multipart/form-data pro Graph, contornando tanto o bloqueio de
// `/adimages` por `url` quanto o limite de URL do modo base64/query-string antigo).
// uploadImagemBytes() devolve um image_hash de verdade.
//
// Creative que FUNCIONA (validado ao vivo, com Instagram — effective_instagram_media_id
// presente): `object_story_spec: { page_id, instagram_actor_id, link_data: { image_hash,
// link: wa.me/<número da loja>, message: <caption>, call_to_action: { type:
// 'WHATSAPP_MESSAGE' } } }`. UM ad por produto/promo, sem asset_feed_spec (o creative
// dinâmico não é suportado pra campanhas OUTCOME_ENGAGEMENT com destino WhatsApp — achado de
// rodada anterior, não retestado aqui pois não é mais necessário: 1 formato só).
//
// Gotcha do Instagram (BM): em rodadas anteriores, `instagram_actor_id` era rejeitado pro
// token do system user "coletor" porque a conta IG não estava atribuída como asset. Nesta
// rodada o `instagram_actor_id` (@vessel.brasil, 17841462952561833) FOI aceito (BM corrigido
// entre rodadas) — confirmado ao vivo com `effective_instagram_media_id` presente no creative
// verificado. Ainda assim, criarAdCreative() mantém o fallback automático (tenta sempre COM
// IG primeiro; se cair no erro específico de novo, refaz sem) — não custa nada manter a
// resiliência.
//
// Uso:
//   node --import ./lib/curl-fetch.mjs subir-campanha-meta.mjs --dry [--tivoli <campanhaId>] [--dompedro <campanhaId>]
//                                            # plano completo (2 campanhas/4 conjuntos/~ads), SEM chamar o Graph
//   node --import ./lib/curl-fetch.mjs subir-campanha-meta.mjs [--tivoli <id> --dompedro <id>]
//                                            # subida REAL completa (2 lojas, ~20 ads/campanha, tudo PAUSED)
// --tivoli/--dompedro sobrescrevem o campanhaId (fabrica_campanhas) de origem dos criativos
// por loja — default são os lotes isnet da Config desta task (b5a4bdd0.../730b9e0a...).
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';

// Fix de ambiente (achado em rodada anterior): o handshake TLS1.3 default do `fetch`/`https`
// do Node é resetado (ECONNRESET, 100% determinístico) por trás do Cloudflare que serve
// *.supabase.co, nesta máquina — forçar TLS1.2 programaticamente resolve. Precisa rodar ANTES
// de qualquer fetch/https (inclusive dentro de loginServico()), por isso fica logo depois dos
// imports.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const DRY = process.argv.includes('--dry');

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}
const CLI_TIVOLI = argVal('--tivoli');
const CLI_DOMPEDRO = argVal('--dompedro');

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
// Fallback = anon key pública do projeto (mesmo default hardcoded em lib/bling-comercial.mjs).
// SUPABASE_ANON_KEY não está no .env local — sem este fallback, `apikey` ia undefined e toda
// chamada real ao meta-proxy (e a qualquer function) falhava com 401 "no apikey".
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

// --- CFG: valores REAIS (conta Vessel, app Live) ------------------------------------------
const CFG = {
  ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174', // accountId do meta-proxy
  ACT: 'act_1197997517858139',
  PAGE: '324679337390168',
  IG: '17841462952561833',
  DAILY_BUDGET: 5000, // centavos = R$50/dia por conjunto (ABO)
  DATA_CAMPANHA: '11-07-2026',
};

// Caption limpa e genérica — o PNG (qualquer look) já mostra nome do produto + preço, não
// precisa repetir o nome longo do Bling na legenda. Usada em TODOS os ads (produto e
// promo), pra manter a coerência visual/textual da campanha.
const CAPTION_PADRAO = '50% OFF em bolsas La Vessel · chame no WhatsApp 💬';

// Lojas: campanhaId = lote isnet (F3, cutout corrigido) que contém os criativos `produto`
// (looks produto-heroi + produto-sage-circulo, à-vista, 2 formatos por SKU) E `promo` (Geral,
// 1 par dual-formato) daquela loja. Só Story (1080x1920) sobe nesta rodada, com o look
// rotacionando por produto (ver buscarProdutosRotacaoLook()). canalLojaId usado só pra
// enriquecer o nome do produto via gc_vendas_item (não vai pro Graph).
const LOJAS = [
  {
    nome: 'Tivoli',
    campanhaId: 'b5a4bdd0-a56f-48c3-a07c-09cf822c1de5',
    whatsapp: '+5519971690502',
    geoCities: [267873, 241913], // Santa Bárbara d'Oeste, Americana
    canalLojaId: '205834140',
  },
  {
    nome: 'Dom Pedro',
    campanhaId: '730b9e0a-6fc1-498c-ae17-39f6776c1a16',
    whatsapp: '+5519999545112',
    geoCities: [247071], // Campinas
    canalLojaId: '205657609',
  },
];
if (CLI_TIVOLI) LOJAS[0].campanhaId = CLI_TIVOLI;
if (CLI_DOMPEDRO) LOJAS[1].campanhaId = CLI_DOMPEDRO;

let TOKEN;

// --- chamarProxy(): chamada de baixo nível ao meta-proxy, com retry em erro de rede E em
// 429/5xx (até 4 tentativas, backoff exponencial 1s/2s/4s). --dry nunca toca o Graph: só
// imprime o corpo e devolve uma resposta fake pro fluxo seguir até o fim. meta() (GET/POST/
// DELETE via query string) e uploadImagemBytes() (POST multipart via imageFromUrl — ver
// cabeçalho do arquivo) são as duas casas que usam isto.
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

// --- uploadImagemBytes(): POST /adimages por BYTES (meta-proxy, param `imageFromUrl`), não
// por `url`. Devolve o image_hash de verdade. `field` só nomeia o campo do multipart/filename
// (ex.: "img0") — não afeta o hash.
async function uploadImagemBytes(url, field) {
  const r = await chamarProxy({ accountId: CFG.ACCOUNT_ID, path: `/${CFG.ACT}/adimages`, method: 'POST', imageFromUrl: url, imageField: field });
  if (r.status !== 200 || !r.d?.images) {
    throw new Error(`POST /adimages (bytes, field=${field}) falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 500)}`);
  }
  const hash = Object.values(r.d.images)[0]?.hash;
  if (!hash) throw new Error(`POST /adimages (bytes, field=${field}) sem hash na resposta: ${JSON.stringify(r.d).slice(0, 500)}`);
  return hash;
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

// storage_path: <campanha>/produto/<sku-saneado>-<variante>-<formato>.png (variante já inclui
// o look, ex.: produto-heroi-avista, produto-sage-circulo-avista). Extrai o sku saneado
// tirando o sufixo conhecido -variante-formato.png.
function skuDe(storagePath, variante, formato) {
  const file = (storagePath || '').split('/').pop() || '';
  const sufixo = `-${variante}-${formato}.png`;
  return file.endsWith(sufixo) ? file.slice(0, -sufixo.length) : file.replace(/\.png$/, '');
}

// Nome real do produto via gc_vendas_item (o sku no storage é saneado — espaços viram "_" —
// então tenta exato, depois com "_"→" "; se não achar nada, cai num rótulo legível a partir
// do próprio sku saneado). Usado só pro NOME do ad (`<sku> · <nome>`), nunca na caption.
const nomeCache = new Map();
async function nomeProduto(skuSane) {
  if (nomeCache.has(skuSane)) return nomeCache.get(skuSane);
  let rows = await sbGet(`/gc_vendas_item?select=produto&sku=eq.${encodeURIComponent(skuSane)}&limit=1`);
  if (!rows.length) {
    const comEspacos = skuSane.replace(/_/g, ' ');
    if (comEspacos !== skuSane) rows = await sbGet(`/gc_vendas_item?select=produto&sku=eq.${encodeURIComponent(comEspacos)}&limit=1`);
  }
  const nome = rows[0]?.produto || null;
  nomeCache.set(skuSane, nome);
  return nome;
}

// --- LOOKS: ordem de rotação (índice do SKU, ordem estável, % 3) --------------------------
// 0=produto-heroi, 1=produto-sage-circulo, 2=produto-preco-tipo. "produto-preco-tipo" ainda
// não existe nos lotes atuais (só heroi/sage-circulo) — cai sempre no fallback abaixo, o que é
// esperado (não é bug: o requisito é "não pular produto por falta de look", não "só rotacionar
// entre looks existentes").
const LOOKS = ['heroi', 'sage-circulo', 'preco-tipo'];

// --- buscarProdutosRotacaoLook(): DECISÃO desta rodada — 1 ad por PRODUTO (SKU distinto), com
// o LOOK rotacionando produto a produto (índice do SKU em ordem estável % 3 → LOOKS acima), só
// no formato Story (1080x1920). Os formatos Post (1080x1350) continuam ignorados de propósito.
// Busca todas as linhas 1080x1920/produto da loja numa query só (evita N+1), agrupa por SKU
// (ordem de 1ª aparição em `order=storage_path` = ordem estável e determinística) e, pra cada
// SKU, tenta achar a linha do look sorteado; se não achar (ex.: produto-preco-tipo ainda não
// existe), cai pra QUALQUER linha 1080x1920 daquele SKU — nenhum produto é pulado só por causa
// do look.
async function buscarProdutosRotacaoLook(loja) {
  const rows = await sbGet(
    `/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.produto&formato=eq.1080x1920&order=storage_path`
  );
  const porSku = new Map(); // sku -> linhas 1080x1920 (todas as variantes) daquele SKU
  const ordemSkus = [];
  for (const r of rows) {
    const sku = skuDe(r.storage_path, r.variante, r.formato);
    if (!porSku.has(sku)) { porSku.set(sku, []); ordemSkus.push(sku); }
    porSku.get(sku).push(r);
  }
  return ordemSkus.map((sku, i) => {
    const candidatas = porSku.get(sku);
    const lookAlvo = LOOKS[i % 3];
    let row = candidatas.find((r) => r.variante && r.variante.includes(lookAlvo));
    if (!row) {
      row = candidatas[0]; // fallback: nenhuma linha do look sorteado — usa qualquer 1080x1920 do SKU
      console.warn(`  aviso: SKU ${sku} sem look "${lookAlvo}" (Story) — fallback pra "${row.variante}"`);
    }
    return {
      sku,
      variante: row.variante,
      look: row.variante.includes(lookAlvo) ? lookAlvo : row.variante,
      precoDe: row.preco_de,
      precoPor: row.preco_por,
      url: row.url,
    };
  });
}

async function buscarPromoStory(loja) {
  const rows = await sbGet(`/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.promo&formato=eq.1080x1920`);
  return rows[0] || null;
}

const waLink = (loja) => 'https://wa.me/' + String(loja.whatsapp).replace(/\D/g, '');

// --- POST /adcreatives com fallback automático de instagram_actor_id -----------------------
// Tenta sempre COM IG primeiro; se cair no erro específico de "instagram_actor_id must be a
// valid Instagram account id" (gotcha do BM de rodadas anteriores — ver cabeçalho do
// arquivo), refaz sem IG e avisa no log.
async function criarAdCreative(params) {
  let r = await meta(`/${CFG.ACT}/adcreatives`, params, 'POST');
  if (r.status !== 200 && /instagram_actor_id must be a valid Instagram account id/.test(JSON.stringify(r.d))) {
    console.warn('  aviso: instagram_actor_id rejeitado — refazendo SEM Instagram (ad roda só no Facebook)');
    const semIG = JSON.parse(JSON.stringify(params));
    if (semIG.object_story_spec) delete semIG.object_story_spec.instagram_actor_id;
    r = await meta(`/${CFG.ACT}/adcreatives`, semIG, 'POST');
    params = semIG;
  }
  if (r.status !== 200 || !r.d?.id) {
    throw new Error(`POST /adcreatives falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 800)}\npayload enviado: ${JSON.stringify(params).slice(0, 800)}`);
  }
  return { creativeId: r.d.id, payload: params };
}

// Payload do creative validado ao vivo (com Instagram — effective_instagram_media_id
// presente): object_story_spec.link_data com image_hash direto, sem asset_feed_spec (1
// formato só nesta rodada, não precisa de creative dinâmico/placement-aware).
function payloadImagemUnica({ hash, waLinkUrl, mensagem }) {
  return {
    object_story_spec: {
      page_id: CFG.PAGE,
      instagram_actor_id: CFG.IG,
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

// --- criarAdDeImagem(): upload por bytes (uploadImagemBytes) + creative (payloadImagemUnica,
// com fallback de IG) + 1 ad, PAUSED. Usado tanto pro conjunto "De x Por" (1 por produto)
// quanto pro "Geral (Promo)" (1 pro criativo promo).
async function criarAdDeImagem(loja, { adsetId, nome, storyUrl }) {
  const hash = await uploadImagemBytes(storyUrl, 'img0');
  const waLinkUrl = waLink(loja);
  const params = payloadImagemUnica({ hash, waLinkUrl, mensagem: CAPTION_PADRAO });
  const { creativeId } = await criarAdCreative(params);
  const adId = await criarAd({ adsetId, name: nome, creativeId });
  return { adId, hash };
}

async function criarCampanha(loja) {
  const campaign = await meta(`/${CFG.ACT}/campaigns`, {
    name: `[IA] ${loja.nome} · WhatsApp · ${CFG.DATA_CAMPANHA}`,
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
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // conta exige estratégia de lance explícita
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

// --- subida completa (2 lojas, PAUSED) ----------------------------------------------------
// 1 ad por produto (De x Por) + 1 ad promo (Geral) — ver DECISÃO no cabeçalho do arquivo.
async function subirConjuntoProduto(loja, campaignId) {
  const produtos = await buscarProdutosRotacaoLook(loja);
  const adsetId = await criarAdSet(loja, campaignId, 'De x Por');
  const adIds = [];
  const looksUsados = [];
  for (const p of produtos) {
    const nomeReal = await nomeProduto(p.sku);
    const nome = `${p.sku} · ${nomeReal || p.sku} · [${p.look}]`;
    const { adId } = await criarAdDeImagem(loja, { adsetId, nome, storyUrl: p.url });
    adIds.push(adId);
    looksUsados.push(p.look);
  }
  return { adsetId, adIds, count: produtos.length, looksUsados };
}

async function subirConjuntoPromo(loja, campaignId) {
  const promo = await buscarPromoStory(loja);
  const adsetId = await criarAdSet(loja, campaignId, 'Geral (Promo)');
  const adIds = [];
  if (promo) {
    const { adId } = await criarAdDeImagem(loja, { adsetId, nome: `Geral (Promo) · ${loja.nome}`, storyUrl: promo.url });
    adIds.push(adId);
  } else {
    console.warn(`  aviso: sem criativo promo (Story 1080x1920) pra ${loja.nome} — conjunto Geral (Promo) ficará sem ad`);
  }
  return { adsetId, adIds, count: adIds.length };
}

async function subirLoja(loja) {
  console.log(`\n========== ${loja.nome} ==========`);
  const campaignId = await criarCampanha(loja);
  const geral = await subirConjuntoPromo(loja, campaignId);
  const dePor = await subirConjuntoProduto(loja, campaignId);

  const job = {
    conta_id: null,
    ad_account_id: CFG.ACT,
    loja: loja.nome,
    tipo: 'whatsapp',
    meta_campaign_id: campaignId,
    adset_ids: [geral.adsetId, dePor.adsetId],
    ad_ids: [...geral.adIds, ...dePor.adIds],
    payload: { geoCities: loja.geoCities, whatsapp: loja.whatsapp, criativos: { promo: geral.count, produto: dePor.count }, looks: 'rotativo (heroi/sage-circulo/preco-tipo, %3 por SKU)', looksUsados: dePor.looksUsados, formato: '1080x1920', caption: CAPTION_PADRAO },
    status: 'criado',
  };
  if (!DRY) await sbPost('/fabrica_meta_jobs', [job], 'return=minimal');
  else console.log(`\n[dry] fabrica_meta_jobs (NÃO gravado em --dry):\n${JSON.stringify(job, null, 2)}`);

  return { loja: loja.nome, campaignId, adsetIds: job.adset_ids, adCount: job.ad_ids.length };
}

// --- --dry: plano completo, sem chamadas reais ao Graph -----------------------------------
async function rodarDry() {
  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));
  console.log('\n========== resumo (--dry) ==========');
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length * 2} | ads: ${totalAds}`);
  console.log('(--dry) nenhuma chamada real ao Graph. Todos os ids acima são fake.');
}

async function main() {
  if (DRY) return rodarDry();

  TOKEN = await loginServico();

  // Subida REAL completa (2 lojas, ~20 ads/loja).
  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));
  console.log('\n========== resumo ==========');
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length * 2} | ads: ${totalAds}`);
  console.log('\nsubida concluída — TUDO PAUSED. Revisar no Gerenciador de Anúncios e ativar manualmente.');
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
