#!/usr/bin/env node
// coletor/validar-objetivos-combos.mjs — VALIDAÇÃO AO VIVO dos combos objetivo->Meta do SP-3.
// Para cada objetivo (default: conversao, branding, trafego — engajamento já é provado), cria UMA
// campanha + UM conjunto PAUSED na conta de anúncios via meta-proxy, usando o MESMO payloadCampanhaAdset
// que o subir-estudio usa em produção, e reporta se o Graph aceitou. No fim APAGA todas as campanhas
// de teste criadas (DELETE /{id}). Nada é ativado; nada gasta. Descartável — não faz parte do build.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-objetivos-combos.mjs [--objetivos conversao,branding,trafego] [--loja tivoli] [--manter]
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
const OBJETIVOS = (arg('--objetivos', 'conversao,branding,trafego')).split(',').map((s) => s.trim()).filter(Boolean);
const LOJA_SLUG = arg('--loja', 'tivoli');
const MANTER = process.argv.includes('--manter'); // se passado, não apaga as campanhas de teste
const CFG = { DAILY_BUDGET: 5000, DATA: 'VALIDACAO-SP3' };

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
  const { porChave } = await carregarObjetivos(sbGet);
  const acct = marca.accountId;   // carrier id do meta-proxy
  const adAccount = marca.adAccount; // act_...

  console.log(`\n=== VALIDAÇÃO SP-3 · loja ${loja.nome} · conta ${adAccount} ===`);
  console.log(`objetivos: ${OBJETIVOS.join(', ')} · ${MANTER ? 'MANTÉM' : 'APAGA'} as campanhas de teste no fim\n`);

  const criadas = []; // {chave, campaignId}
  const resultados = [];

  for (const chave of OBJETIVOS) {
    const row = mapaObjetivo(porChave, chave);
    const { campaign, adset } = payloadCampanhaAdset(row, marca, loja, CFG);
    campaign.name = `[VALIDAÇÃO SP-3] ${chave} · ${row.meta_objective}`;
    const linha = { chave, meta_objective: row.meta_objective, optimization_goal: row.optimization_goal, campanhaOk: false, conjuntoOk: false, erro: null, campaignId: null };
    try {
      const rc = await chamarProxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'POST', params: campaign });
      if (rc.status !== 200 || !rc.d?.id) { linha.erro = `CAMPANHA rejeitada — ${resumoErro(rc.d)}`; resultados.push(linha); console.log(`  ✗ ${chave}: ${linha.erro}`); continue; }
      linha.campanhaOk = true; linha.campaignId = rc.d.id; criadas.push({ chave, campaignId: rc.d.id });
      const adsetBody = { ...adset, campaign_id: rc.d.id };
      const ra = await chamarProxy({ accountId: acct, path: `/${adAccount}/adsets`, method: 'POST', params: adsetBody });
      if (ra.status !== 200 || !ra.d?.id) { linha.erro = `CONJUNTO rejeitado — ${resumoErro(ra.d)}`; resultados.push(linha); console.log(`  ⚠ ${chave}: campanha OK mas ${linha.erro}`); continue; }
      linha.conjuntoOk = true;
      resultados.push(linha);
      console.log(`  ✓ ${chave}: campanha ${rc.d.id} + conjunto ${ra.d.id} ACEITOS (PAUSED)`);
    } catch (e) {
      linha.erro = String(e.message || e).slice(0, 300); resultados.push(linha);
      console.log(`  ✗ ${chave}: exceção — ${linha.erro}`);
    }
  }

  // limpeza: apaga as campanhas de teste (DELETE remove os conjuntos junto)
  if (!MANTER && criadas.length) {
    console.log(`\n--- apagando ${criadas.length} campanha(s) de teste ---`);
    for (const c of criadas) {
      // proxy é POST-orientado: apaga setando status=DELETED (equivalente ao DELETE /{id}).
      const rd = await chamarProxy({ accountId: acct, path: `/${c.campaignId}`, method: 'POST', params: { status: 'DELETED' } });
      const ok = rd.status === 200 && (rd.d?.success || rd.d?.id);
      console.log(`  ${ok ? '🗑 apagada' : '⚠ não apagou (' + resumoErro(rd.d) + ')'} — ${c.chave} ${c.campaignId}`);
    }
  } else if (MANTER && criadas.length) {
    console.log(`\n--manter: deixei ${criadas.length} campanha(s) PAUSED no Gerenciador p/ inspeção.`);
  }

  console.log('\n=== RESUMO ===');
  for (const r of resultados) {
    const ok = r.campanhaOk && r.conjuntoOk;
    console.log(`  ${ok ? '✓ ACEITO' : '✗ FALHOU'}  ${r.chave.padEnd(11)} ${r.meta_objective}/${r.optimization_goal}${ok ? '' : '  → ' + r.erro}`);
  }
  const falhas = resultados.filter((r) => !(r.campanhaOk && r.conjuntoOk));
  console.log(falhas.length ? `\n${falhas.length} combo(s) precisam de ajuste na linha de fabrica_objetivos.` : `\nTodos os combos aceitos pelo Graph. 🎉`);
}

main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
