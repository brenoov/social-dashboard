#!/usr/bin/env node
// coletor/subir-campanha-genspark.mjs — sobe os criativos GERADOS PELO GENSPARK (PNGs locais em
// ~/Downloads/criativos/{tivoli,dp}) INJETANDO-OS nas campanhas [VENDAS] SALE 50% que o Breno
// criou na mão no Gerenciador. NÃO cria campanhas nem conjuntos — usa os já existentes.
//
// Regra (decidida pelo Breno em 2026-07-11): pra cada loja, achar a campanha SALE 50% da loja,
// listar TODOS os conjuntos dela, e subir CADA criativo (PNG) em CADA conjunto (produto cartesiano
// criativos × conjuntos), como ad WhatsApp usando o wa.me do número DAQUELE conjunto. Tudo PAUSED —
// o Breno ativa depois no Gerenciador.
//
// Mecânica de imagem (mesma do subir-campanha-meta.mjs):
//   1) cada PNG sobe 1x pro bucket público `fabrica-criativos` (prefixo genspark/<loja>/<data>/),
//      virando URL pública;
//   2) essa URL vai pro /adimages via imageFromUrl (o meta-proxy baixa e reenvia multipart pro
//      Graph, devolvendo image_hash real). O hash é do NÍVEL DA CONTA, então sobe 1x por PNG e
//      é reusado em todos os conjuntos.
//   3) por conjunto: 1 adcreative (link = wa.me do número do conjunto) + 1 ad PAUSED.
//
// Conta/página/IG/legenda: IDÊNTICOS ao subir-campanha-meta.mjs (conta Vessel). Só CRIA (nunca
// apaga/pausa/edita ads existentes).
//
// Uso:
//   node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs --dry
//        # acha campanhas/conjuntos DE VERDADE (GET é read-only) e imprime o plano completo
//        # (loja × conjuntos × criativos = total de ads), SEM subir Storage nem criar nada
//   node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs
//        # subida REAL: sobe PNGs + cria adcreatives/ads PAUSED em cada conjunto
//   flags extras: --loja tivoli|dp  (só uma loja)   --limite N  (só os N primeiros PNGs, p/ teste)
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loginServico } from './lib/bling-comercial.mjs';
import { nomeAd, payloadCriativa } from './lib/meta-subir.mjs';

// Mesmo fix TLS1.2 do script original (ECONNRESET determinístico atrás do Cloudflare/supabase.co
// nesta máquina). Precisa vir antes de qualquer fetch.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const DRY = process.argv.includes('--dry');
function flagValor(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
const SO_LOJA = (flagValor('--loja') || '').toLowerCase() || null; // 'tivoli' | 'dp'
const LIMITE = flagValor('--limite') ? parseInt(flagValor('--limite'), 10) : null;

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;

// --- CFG: valores REAIS (conta Vessel, app Live) — copiados do subir-campanha-meta.mjs -------
const CFG = {
  ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174', // accountId do meta-proxy
  ACT: 'act_1197997517858139',
  PAGE: '324679337390168',
  IG: '17841462952561833',
  DATA_CAMPANHA: '11-07-2026',
  BUCKET: 'fabrica-criativos', // bucket público que hospeda os PNGs pro imageFromUrl
};

// Mesma legenda genérica do [IA] — o PNG já mostra SALE 50% OFF / La Vessel / shopping, não
// precisa repetir nada na caption. Usada em todos os ads das duas lojas.
const CAPTION_PADRAO = '50% OFF em bolsas La Vessel · chame a gente 💬';

const DIR_BASE = join(homedir(), 'Downloads', 'criativos');

// Lojas: `pasta` = subpasta local com os PNGs do Genspark; `matchCampanha` = termos que o NOME da
// campanha SALE 50% precisa conter (case-insensitive, todos) pra ser a campanha da loja; `whatsapp`
// = fallback caso um conjunto não exponha promoted_object.whatsapp_phone_number.
const LOJAS = [
  {
    nome: 'Tivoli',
    pasta: 'tivoli',
    matchCampanha: ['sale 50%', 'tivoli'],
    whatsapp: '+5519971690502',
  },
  {
    nome: 'Dom Pedro',
    pasta: 'dp',
    matchCampanha: ['sale 50%', 'dom pedro'],
    whatsapp: '+5519999545112',
  },
];

let TOKEN;

// --- Storage: sobe um PNG local pro bucket público e devolve a URL pública -------------------
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

// --- chamarProxy: GET sempre REAL (read-only, seguro em --dry); só POST/imageFromUrl são stubados.
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let fakeSeq = 0;
function ehRateLimit(status, d) {
  // Meta code 17 (User request limit reached) / 4 (App limit) / 613 (calls). Pode vir 400/429/500.
  const code = d?.error?.code;
  return status === 429 || status >= 500 || [4, 17, 32, 613].includes(code);
}
async function chamarProxy(body) {
  const { path, method = 'GET', imageFromUrl } = body;
  const mutante = imageFromUrl || method === 'POST' || method === 'DELETE';
  if (DRY && mutante) {
    fakeSeq++;
    if (imageFromUrl) return { status: 200, d: { images: { [`fake-${fakeSeq}.png`]: { hash: `fake_hash_${fakeSeq}` } } } };
    return { status: 200, d: { id: `fake_id_${fakeSeq}` } };
  }
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
        const espera = 3000 * 2 ** (tentativa - 1); // 3s,6s,12s,24s — rate limit da conta é lento pra ceder
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
  return chamarProxy({ accountId: CFG.ACCOUNT_ID, path, params, method });
}

// GET paginado seguindo paging.cursors.after — devolve todos os itens (.data concatenado).
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

async function uploadImagemBytes(url, field) {
  const r = await chamarProxy({ accountId: CFG.ACCOUNT_ID, path: `/${CFG.ACT}/adimages`, method: 'POST', imageFromUrl: url, imageField: field });
  if (r.status !== 200 || !r.d?.images) {
    throw new Error(`POST /adimages (bytes, field=${field}) falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 500)}`);
  }
  const hash = Object.values(r.d.images)[0]?.hash;
  if (!hash) throw new Error(`POST /adimages (bytes, field=${field}) sem hash na resposta: ${JSON.stringify(r.d).slice(0, 500)}`);
  return hash;
}

// soDigitos, DOF_SPEC (as 82 features OPT_OUT) e payloadCriativa (multi-destino Messenger+WhatsApp+
// Instagram — os conjuntos SALE do Breno usam destination_type
// MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP) agora vêm de ./lib/meta-subir.mjs (extraído pra
// ser reusado pelo estúdio de anúncios). Página e Instagram são os mesmos das 2 lojas; só o número
// de WhatsApp muda por loja.

// --- achar campanha da loja + listar conjuntos ------------------------------------------------
async function acharCampanha(loja) {
  const camps = await metaTodos(`/${CFG.ACT}/campaigns`, { fields: 'id,name,effective_status', limit: 200 });
  const bate = camps.filter((c) => {
    const n = (c.name || '').toLowerCase();
    return loja.matchCampanha.every((t) => n.includes(t));
  });
  if (bate.length === 0) {
    throw new Error(`nenhuma campanha bate com [${loja.matchCampanha.join(' + ')}] pra ${loja.nome}. Campanhas na conta:\n` +
      camps.map((c) => `  - ${c.name} (${c.id}, ${c.effective_status})`).join('\n'));
  }
  if (bate.length > 1) {
    throw new Error(`AMBÍGUO: ${bate.length} campanhas batem com [${loja.matchCampanha.join(' + ')}] pra ${loja.nome}:\n` +
      bate.map((c) => `  - ${c.name} (${c.id})`).join('\n') + `\nRefine matchCampanha.`);
  }
  return bate[0];
}

async function listarAdsets(campaignId) {
  const adsets = await metaTodos(`/${campaignId}/adsets`, { fields: 'id,name,effective_status,promoted_object', limit: 200 });
  return adsets.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.effective_status,
    whatsapp: a.promoted_object?.whatsapp_phone_number || null,
  }));
}

// --- creative / ad (mesmos do subir-campanha-meta.mjs) ----------------------------------------
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

// --- lista os PNGs locais da loja (ignora .DS_Store e não-.png), ordem estável ---------------
function pngsDaLoja(loja) {
  const dir = join(DIR_BASE, loja.pasta);
  let itens = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => ({ file: f, local: join(dir, f) }));
  if (LIMITE) itens = itens.slice(0, LIMITE);
  return itens;
}

async function subirLoja(loja) {
  console.log(`\n========== ${loja.nome} ==========`);
  const itens = pngsDaLoja(loja);
  const campanha = await acharCampanha(loja);
  const adsets = await listarAdsets(campanha.id);
  console.log(`campanha: ${campanha.name} (${campanha.id})`);
  console.log(`conjuntos: ${adsets.length}`);
  for (const a of adsets) console.log(`  - ${a.name} (${a.id}) wa=${a.whatsapp || '[usa fallback ' + loja.whatsapp + ']'} [${a.status}]`);
  console.log(`criativos Genspark: ${itens.length}`);
  console.log(`=> ${itens.length} × ${adsets.length} = ${itens.length * adsets.length} ads (PAUSED)`);
  if (adsets.length === 0) throw new Error(`campanha ${campanha.name} não tem conjuntos — nada onde subir`);

  // Idempotência: nomes de ad são determinísticos, então buscamos os que JÁ existem na campanha
  // e pulamos — permite re-rodar após um blip de rede sem duplicar (e ignora os do teste).
  // prefixo `Genspark · ${loja.nome}` reproduz EXATAMENTE o nome que o script já vinha gerando
  // antes da extração pra lib/meta-subir.mjs (não quebra a idempotência com ads já criados).
  const prefixo = `Genspark · ${loja.nome}`;
  const existentes = DRY ? [] : await metaTodos(`/${campanha.id}/ads`, { fields: 'name,adset_id', limit: 500 });
  const jaTem = new Set(existentes.map((a) => `${a.adset_id}::${a.name}`));
  if (jaTem.size) console.log(`(idempotência) ${jaTem.size} ads já existem na campanha — serão pulados`);

  let feitos = 0, pulados = 0;
  const total = itens.length * adsets.length;
  let idx = 0;
  for (const item of itens) {
    // pula o PNG inteiro se TODOS os conjuntos já têm o ad dele (evita Storage+hash à toa)
    const faltam = adsets.filter((a) => !jaTem.has(`${a.id}::${nomeAd(prefixo, item.file, a.name)}`));
    if (faltam.length === 0) { pulados += adsets.length; idx++; continue; }
    // 1x por PNG: Storage + image_hash (hash é da conta, vale pra todos os conjuntos)
    const objPath = `genspark/${loja.pasta}/${CFG.DATA_CAMPANHA}/${item.file}`;
    const url = await subirParaStorage(item.local, objPath);
    const hash = await uploadImagemBytes(url, `img${idx}`);
    idx++;
    for (const a of adsets) {
      const nome = nomeAd(prefixo, item.file, a.name);
      if (jaTem.has(`${a.id}::${nome}`)) { pulados++; continue; }
      const numero = a.whatsapp || loja.whatsapp;
      // Conjuntos SALE são sempre multi-destino (ver comentário acima de acharCampanha) — o
      // listarAdsets não busca destination_type, então forçamos o valor que ativa o ramo
      // multi-destino de payloadCriativa (mesmo comportamento de antes da extração).
      const params = payloadCriativa({ hash, adsetDestinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP', waNumero: numero, page: CFG.PAGE, ig: CFG.IG, mensagem: CAPTION_PADRAO });
      const { creativeId } = await criarAdCreative(params);
      const adId = await criarAd({ adsetId: a.id, name: nome, creativeId });
      feitos++;
      if (!DRY) {
        console.log(`  [${feitos + pulados}/${total}] ad ${adId} <- ${item.file} @ ${a.name}`);
        await sleep(400); // throttle leve contra rate limit code 17
      }
    }
  }
  return { loja: loja.nome, campanha: campanha.name, campaignId: campanha.id, conjuntos: adsets.length, criativos: itens.length, ads: feitos, pulados };
}

async function main() {
  TOKEN = await loginServico(); // read-only service login; necessário até em --dry (GETs reais)

  const lojas = SO_LOJA ? LOJAS.filter((l) => l.pasta === SO_LOJA) : LOJAS;
  if (lojas.length === 0) { console.error(`--loja ${SO_LOJA} inválido (use tivoli|dp)`); process.exit(1); }

  const resumo = [];
  for (const loja of lojas) resumo.push(await subirLoja(loja));

  console.log(`\n========== resumo${DRY ? ' (--dry)' : ''} ==========`);
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.ads, 0);
  const totalPulados = resumo.reduce((s, r) => s + (r.pulados || 0), 0);
  console.log(`\nlojas: ${resumo.length} | ads criados: ${totalAds}${totalPulados ? ` | pulados (já existiam): ${totalPulados}` : ''}`);
  if (DRY) console.log('(--dry) campanhas/conjuntos foram lidos DE VERDADE, mas nada foi subido nem criado. Rode sem --dry pra valer.');
  else console.log('\nsubida concluída — TUDO PAUSED. Revisar no Gerenciador de Anúncios e ativar manualmente.');
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
