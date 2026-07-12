#!/usr/bin/env node
// coletor/ativar-estudio.mjs — ativa (status: 'ACTIVE') os ads da rodada do Estúdio de Anúncios
// e, se a rodada criou campanha nova (destino.tipo==='nova' em subir-estudio.mjs), também ativa
// os conjuntos e a campanha. Reusa o mesmo padrão de proxy do subir-estudio.mjs (meta-proxy via
// loginServico + fetch com retry). Ads/conjuntos/campanha que já estão ACTIVE: setar ACTIVE de
// novo é no-op no Graph — sem risco de duplicar nada.
//
// Uso:
//   node --import ./lib/curl-fetch.mjs ativar-estudio.mjs --ads a1,a2 --adsets s1 --campaign c1 --nova
//   node --import ./lib/curl-fetch.mjs ativar-estudio.mjs --ads a1,a2 --campaign c1
//   (--dry só valida o guard: não toca no Graph)
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';

// Fix TLS1.2 (ECONNRESET determinístico atrás do Cloudflare/*.supabase.co nesta máquina) — mesmo
// motivo do subir-estudio.mjs.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const CFG = { ACT: 'act_1197997517858139', ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174' };

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';

let TOKEN;

// --- meta-proxy: GET/POST com retry em rede/429/5xx/rate-limit (mesmo padrão do subir-estudio) --
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
  const r = await chamarProxy({ accountId: CFG.ACCOUNT_ID, path, params, method });
  if (method === 'POST' && r.status !== 200 && ehRateLimit(r.status, r.d)) {
    throw new Error(`meta ${method} ${path} rate limit / code ${r.d?.error?.code}: ${JSON.stringify(r.d).slice(0, 200)}`);
  }
  return r;
}

// --- alvos(): função pura — resolve quais ids do Graph precisam virar ACTIVE. Numa campanha já
// existente só os ads mudam (conjunto/campanha já estavam ativos); numa campanha nova (criada
// pelo subir-estudio.mjs, tudo PAUSED) também precisa ativar o conjunto e a campanha. ---
export function alvos({ adIds, adsetIds, metaCampaignId, criouCampanha }) {
  return criouCampanha ? [...adIds, ...adsetIds, metaCampaignId] : [...adIds];
}

// --- run(): API pública do módulo -------------------------------------------------------------
export async function run({ adIds, adsetIds, metaCampaignId, criouCampanha, dry = false }) {
  if (dry) return { ativados: 0 };

  TOKEN = await loginServico();

  let ativados = 0;
  for (const id of alvos({ adIds, adsetIds, metaCampaignId, criouCampanha })) {
    const r = await meta('/' + id, { status: 'ACTIVE' }, 'POST');
    if (r.status === 200) ativados++;
  }
  return { ativados };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
  const csv = (v) => (v ? v.split(',').filter(Boolean) : []);
  run({
    adIds: csv(arg('--ads')),
    adsetIds: csv(arg('--adsets')),
    metaCampaignId: arg('--campaign'),
    criouCampanha: process.argv.includes('--nova'),
    dry: process.argv.includes('--dry'),
  }).then((r) => console.log('ativar concluído:', r)).catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
}
