#!/usr/bin/env node
// coletor/validar-orcamento-combos.mjs — VALIDAÇÃO AO VIVO dos 4 combos de orçamento do editor
// por-loja (CBO/ABO x diário/total) do Estúdio. Para cada combo, cria UMA campanha + UM conjunto
// PAUSED na conta de anúncios via meta-proxy, usando o MESMO payloadCampanhaAdset que o
// subir-estudio usa em produção (objetivo 'engajamento' — combo já provado pelo SP-3 — para isolar
// só a variável orçamento), e reporta se o Graph aceitou (com o subcode do erro quando rejeitar).
// No fim APAGA todas as campanhas de teste criadas (status=DELETED via meta-proxy). Nada é ativado;
// nada gasta. Descartável — não faz parte do build.
//
// Precisa das MESMAS credenciais dos outros validadores (env do coletor: SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, + as que loginServico() exige pro usuário de serviço).
//
// Uso: cd coletor && node --import ./lib/curl-fetch.mjs validar-orcamento-combos.mjs [--loja tivoli|dp] [--combos ABO-diario,CBO-total] [--manter]
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
const MANTER = process.argv.includes('--manter'); // se passado, não apaga as campanhas de teste
const CFG = { DAILY_BUDGET: 5000, DATA: 'VALIDACAO-SP5' };

// Os 4 combos do editor de orçamento por loja (SP-5). Datas do "total" hardcoded no futuro próximo
// (validador manual — não usar Date.now()-at-import; apenas datas fixas plausíveis, iguais às dos
// testes de coletor/lib/orcamento.test.mjs).
const TODOS_COMBOS = [
  { modo: 'ABO', tipo: 'diario' },
  { modo: 'ABO', tipo: 'total' },
  { modo: 'CBO', tipo: 'diario' },
  { modo: 'CBO', tipo: 'total' },
];
const chaveCombo = (c) => `${c.modo}-${c.tipo}`;
const INICIO_TOTAL = '2026-08-01T00:00:00-03:00';
const FIM_TOTAL = '2026-08-15T23:59:59-03:00';

const COMBOS_ARG = arg('--combos', null);
const COMBOS = COMBOS_ARG
  ? TODOS_COMBOS.filter((c) => COMBOS_ARG.split(',').map((s) => s.trim()).includes(chaveCombo(c)))
  : TODOS_COMBOS;

function orcamentoDoCombo(c) {
  return c.tipo === 'total'
    ? { modo: c.modo, tipo: c.tipo, valor: 30000, inicio: INICIO_TOTAL, fim: FIM_TOTAL }
    : { modo: c.modo, tipo: c.tipo, valor: 5000 };
}

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

async function apagar(acct, criadas) {
  if (!criadas.length) return;
  console.log(`\n--- apagando ${criadas.length} campanha(s) de teste ---`);
  const falharam = []; // {chave, campaignId} — não conseguiu apagar (rejeitado OU exceção); cada item
  // tenta isolado num try/catch pra uma falha (ex.: rede caiu no meio) nunca abortar as demais.
  for (const c of criadas) {
    try {
      // proxy é POST-orientado: apaga setando status=DELETED (equivalente ao DELETE /{id}).
      const rd = await chamarProxy({ accountId: acct, path: `/${c.campaignId}`, method: 'POST', params: { status: 'DELETED' } });
      const ok = rd.status === 200 && (rd.d?.success || rd.d?.id);
      if (ok) {
        console.log(`  🗑 apagada — ${c.chave} ${c.campaignId}`);
      } else {
        console.log(`  ⚠ NÃO apagou — apague manualmente no Gerenciador (${resumoErro(rd.d)}) — ${c.chave} ${c.campaignId}`);
        falharam.push(c);
      }
    } catch (e) {
      console.log(`  ⚠ NÃO apagou — exceção (${String(e.message || e).slice(0, 200)}) — ${c.chave} ${c.campaignId}`);
      falharam.push(c);
    }
  }
  if (falharam.length) {
    console.log(`\n⚠️ NÃO consegui apagar ${falharam.length} campanha(s) — apague na mão no Gerenciador: ${falharam.map((c) => c.campaignId).join(', ')}`);
  } else {
    console.log(`\n🗑 todas as ${criadas.length} campanha(s) de teste apagadas.`);
  }
}

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = resolverLoja(lojas, LOJA_SLUG);
  if (!loja) throw new Error(`loja "${LOJA_SLUG}" não encontrada/ativa`);
  const marca = loja.marca || marcaAtiva;
  const { porChave } = await carregarObjetivos(sbGet);
  // objetivo 'engajamento' já provado pelo validar-objetivos-combos (SP-3): isola a variável
  // orçamento sem misturar com risco de rejeição por objective/optimization_goal.
  const objetivoRow = mapaObjetivo(porChave, 'engajamento');
  const acct = marca.accountId;   // carrier id do meta-proxy
  const adAccount = marca.adAccount; // act_...

  console.log(`\n=== VALIDAÇÃO SP-5 (orçamento) · loja ${loja.nome} · conta ${adAccount} ===`);
  console.log(`combos: ${COMBOS.map(chaveCombo).join(', ')} · ${MANTER ? 'MANTÉM' : 'APAGA'} as campanhas de teste no fim\n`);

  const criadas = []; // {chave, campaignId} — só o que ESTE run criou; nunca toca em campanha preexistente
  const resultados = [];

  try {
    for (const combo of COMBOS) {
      const chave = chaveCombo(combo);
      const orcamento = orcamentoDoCombo(combo);
      const linha = { chave, orcamento, campanhaOk: false, conjuntoOk: false, erro: null, campaignId: null };
      try {
        const { campaign, adset } = payloadCampanhaAdset(objetivoRow, marca, loja, CFG, null, orcamento);
        campaign.name = `[VALIDAÇÃO SP-5] orçamento ${chave}`;

        const rc = await chamarProxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'POST', params: campaign });
        if (rc.status !== 200 || !rc.d?.id) { linha.erro = `CAMPANHA rejeitada — ${resumoErro(rc.d)}`; resultados.push(linha); console.log(`  ✗ ${chave}: ${linha.erro}`); continue; }
        linha.campanhaOk = true; linha.campaignId = rc.d.id; criadas.push({ chave, campaignId: rc.d.id });

        const adsetBody = { ...adset, campaign_id: rc.d.id };
        const ra = await chamarProxy({ accountId: acct, path: `/${adAccount}/adsets`, method: 'POST', params: adsetBody });
        if (ra.status !== 200 || !ra.d?.id) { linha.erro = `CONJUNTO rejeitado — ${resumoErro(ra.d)}`; resultados.push(linha); console.log(`  ⚠ ${chave}: campanha OK mas ${linha.erro}`); continue; }
        linha.conjuntoOk = true;
        resultados.push(linha);
        console.log(`  ✓ ${chave}: campanha ${rc.d.id} + conjunto ${ra.d.id} ACEITOS (PAUSED) — ${JSON.stringify({ campaign: campaign, adsetBudget: { daily_budget: adset.daily_budget, lifetime_budget: adset.lifetime_budget, start_time: adset.start_time, end_time: adset.end_time } })}`);
      } catch (e) {
        linha.erro = String(e.message || e).slice(0, 300); resultados.push(linha);
        console.log(`  ✗ ${chave}: exceção — ${linha.erro}`);
      }
    }
  } finally {
    // finally garante que a limpeza roda mesmo se algo inesperado estourar no meio do loop
    // (ex.: payloadCampanhaAdset lançando por um combo malformado) — nunca deixa lixo pra trás.
    if (!MANTER) {
      await apagar(acct, criadas);
    } else if (criadas.length) {
      console.log(`\n--manter: deixei ${criadas.length} campanha(s) PAUSED no Gerenciador p/ inspeção.`);
    }
  }

  console.log('\n=== RESUMO ===');
  for (const r of resultados) {
    const ok = r.campanhaOk && r.conjuntoOk;
    console.log(`  ${ok ? '✓ ACEITO' : '✗ FALHOU'}  ${r.chave.padEnd(11)}${ok ? '' : '  → ' + r.erro}`);
  }
  const falhas = resultados.filter((r) => !(r.campanhaOk && r.conjuntoOk));
  console.log(falhas.length ? `\n${falhas.length} combo(s) precisam de ajuste em coletor/lib/orcamento.mjs.` : `\nTodos os 4 combos aceitos pelo Graph. 🎉`);
  if (falhas.length) process.exitCode = 1;
}

main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
