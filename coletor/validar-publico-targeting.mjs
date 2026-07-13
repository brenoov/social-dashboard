#!/usr/bin/env node
// coletor/validar-publico-targeting.mjs — VALIDAÇÃO AO VIVO do targeting do SP-4.
// Monta UMA campanha + conjunto PAUSED (objetivo engajamento) com um público de teste
// (cidades da loja + raio + 1 interesse buscado + idade/gênero), via o MESMO payloadCampanhaAdset/
// montarTargeting da produção, e reporta se o Graph aceitou o targeting. Apaga a campanha no fim.
// Nada é ativado; nada gasta. Descartável.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-publico-targeting.mjs [--loja tivoli] [--manter]
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { carregarObjetivos, mapaObjetivo } from './lib/objetivos.mjs';
import { payloadCampanhaAdset, resolverLoja } from './subir-estudio.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY;
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const LOJA_SLUG = arg('--loja', 'tivoli');
const MANTER = process.argv.includes('--manter');
const CFG = { DAILY_BUDGET: 5000, DATA: 'VALIDACAO-SP4' };

let TOKEN;
async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function chamarProxy(body) {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
}
function resumoErro(d) {
  const e = d?.error;
  if (!e) return JSON.stringify(d).slice(0, 300);
  return `code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}: ${e.message || e.error_user_msg || ''}`.slice(0, 300);
}

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = resolverLoja(lojas, LOJA_SLUG);
  if (!loja) throw new Error(`loja "${LOJA_SLUG}" não encontrada/ativa`);
  const marca = loja.marca || marcaAtiva;
  const acct = marca.accountId;
  const adAccount = marca.adAccount;
  const { porChave } = await carregarObjetivos(sbGet);
  const objetivoRow = mapaObjetivo(porChave, 'engajamento'); // combo provado; isolamos o targeting

  // busca 1 interesse real
  const rint = await chamarProxy({ accountId: acct, path: '/search', params: { type: 'adinterest', q: 'moda feminina', limit: 1 }, method: 'GET' });
  const interesse = rint.d?.data?.[0];
  const interesses = interesse ? [{ id: interesse.id, name: interesse.name }] : [];

  // público de teste: cidades da loja com raio + interesse + idade/gênero
  const cities = (loja.geoCities || []).slice(0, 2).map((key) => ({ key, radius: 15, distance_unit: 'kilometer' }));
  const publico = { geo: { cities, excluded: [] }, idade_min: 25, idade_max: 45, generos: [2], interesses, custom_audiences: [] };

  const { campaign, adset } = payloadCampanhaAdset(objetivoRow, marca, loja, CFG, publico);
  campaign.name = '[VALIDAÇÃO SP-4] targeting geo+raio+interesse';

  console.log(`\n=== VALIDAÇÃO SP-4 · loja ${loja.nome} · conta ${adAccount} ===`);
  console.log('targeting montado:', JSON.stringify(adset.targeting));
  console.log(`interesse usado: ${interesse ? interesse.name + ' (' + interesse.id + ')' : 'NENHUM (busca vazia)'}\n`);

  let campaignId = null;
  try {
    const rc = await chamarProxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'POST', params: campaign });
    if (rc.status !== 200 || !rc.d?.id) { console.log(`✗ CAMPANHA rejeitada — ${resumoErro(rc.d)}`); process.exit(1); }
    campaignId = rc.d.id;
    const ra = await chamarProxy({ accountId: acct, path: `/${adAccount}/adsets`, method: 'POST', params: { ...adset, campaign_id: campaignId } });
    if (ra.status !== 200 || !ra.d?.id) { console.log(`✗ CONJUNTO rejeitado (targeting) — ${resumoErro(ra.d)}`); }
    else console.log(`✓ TARGETING ACEITO: campanha ${campaignId} + conjunto ${ra.d.id} (PAUSED)`);
  } finally {
    if (campaignId && !MANTER) {
      const rd = await chamarProxy({ accountId: acct, path: `/${campaignId}`, method: 'POST', params: { status: 'DELETED' } });
      console.log(`  ${rd.status === 200 && (rd.d?.success || rd.d?.id) ? '🗑 campanha de teste apagada' : '⚠ não apagou (' + resumoErro(rd.d) + ')'}`);
    }
  }
}
main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
