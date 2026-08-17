#!/usr/bin/env node
// PREENCHER PARA TRÁS conversas, cadastros, compras e visitas em campaign_insights.
//
// Essas quatro colunas só passaram a ser gravadas em 17/08/2026. O que veio antes
// está nulo — e nulo aparece na tela como "—", que é a verdade. Este script
// pergunta à Meta o que já aconteceu e preenche.
//
// AS QUATRO REGRAS QUE NÃO SE NEGOCIAM:
//
// 1. ESCREVE SÓ AS QUATRO COLUNAS. Nunca spend, likes, comments, shares, saves,
//    impressions, clicks ou reach. Uma resposta parcial da Meta já gravou 0 por
//    cima de dado bom neste projeto (232 mil de alcance com 0 curtidas).
// 2. RESPOSTA VAZIA NÃO VIRA ZERO. Se a Meta não devolver nada para aquela
//    janela, o script PULA — deixa nulo. Gravar zero transformaria "não sei" em
//    "custou zero".
// 3. NUNCA usar o Python legado (projetos/central-inteligencia/redes-sociais/
//    coletor/coletar.py). Ele grava a linha INTEIRA e sobrescreveria coluna boa.
// 4. RITMO. As chamadas usam o mesmo token e o mesmo limite da Meta que a tela ao
//    vivo. Em 07/07/2026 uma recoleta martelou a Meta, as chamadas ao vivo
//    tomaram rate limit e o painel caiu no coletado. Pausa entre chamadas, e de
//    madrugada.
//
// Uso:
//   node coletor/preencher-numeros-de-campanha.mjs --dry          (1 alvo, não grava)
//   node coletor/preencher-numeros-de-campanha.mjs                (tudo, grava)
//   node coletor/preencher-numeros-de-campanha.mjs --pausa 3000   (pausa em ms, padrão 2000)
//
// É seguro parar no meio (Ctrl+C) e rodar de novo: o alvo já feito fica no
// arquivo de retomada, e além disso o UPDATE só toca linha que ainda está nula.

import './lib/carregar-env.mjs';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contagensDaCampanha } from '../supabase/functions/_shared/acoes-de-campanha.js';
import { janelaDoRecorte, alvosPendentes } from './janelas-de-backfill.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL + '/rest/v1';
const GRAPH = 'https://graph.facebook.com/v21.0';
const sb = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

const AQUI = dirname(fileURLToPath(import.meta.url));
const RETOMADA = join(AQUI, '.preencher-numeros-de-campanha.json');

// A LISTA BRANCA. O corpo do UPDATE é montado a partir DESTE array e de mais
// nada. Não existe caminho no script em que uma quinta chave entre no corpo —
// nem se contagensDaCampanha um dia passar a devolver outra coisa.
const AS_QUATRO = ['conversas', 'cadastros', 'compras', 'visitas'];

const DRY = process.argv.includes('--dry');
const PAUSA = (() => {
  const i = process.argv.indexOf('--pausa');
  const n = i > -1 ? parseInt(process.argv[i + 1], 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 2000;
})();
// Erro atrás de erro quase sempre é rate limit. Insistir foi exatamente o que
// derrubou o painel em julho: para e deixa a retomada guardar o que já foi.
const ERROS_SEGUIDOS_ATE_DESISTIR = 5;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chaveDoAlvo = (a) => `${a.account_id}|${a.captured_at}|${a.period_days}`;

// ---------------------------------------------------------------- Supabase

async function sbGet(caminho, extras = {}) {
  const r = await fetch(REST + caminho, { headers: { ...sb, ...extras } });
  if (!r.ok) throw new Error(`GET ${caminho} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return { linhas: await r.json() };
}

// PostgREST corta a resposta num teto (hoje 1000). São ~15 mil linhas nulas: sem
// paginar, o script leria só o primeiro pedaço e diria que terminou.
// Ordem total e estável (as 4 colunas da chave) para as páginas não se sobreporem
// nem pularem linha.
async function lerLinhasNulas() {
  const todas = [];
  let de = 0;
  for (;;) {
    const ate = de + 999;
    const { linhas } = await sbGet(
      '/campaign_insights?select=account_id,captured_at,period_days'
      + '&conversas=is.null&order=captured_at.asc,account_id.asc,period_days.asc,campaign_id.asc',
      { Range: `${de}-${ate}`, 'Range-Unit': 'items' },
    );
    todas.push(...linhas);
    if (!linhas.length || linhas.length < ate - de + 1) break;
    de += linhas.length;
  }
  return todas;
}

// O ÚNICO ponto do script que escreve no banco.
//
// Corpo: as quatro colunas, e só. Filtro: a chave primária inteira MAIS
// `conversas=is.null` — assim, mesmo que a retomada se perca e o script rode duas
// vezes, ele não consegue passar por cima de um número que o coletor gravou bem.
async function atualizarAsQuatro({ campaign_id, account_id, captured_at, period_days }, contagens) {
  const corpo = {};
  for (const chave of AS_QUATRO) corpo[chave] = Number(contagens[chave]) || 0;

  const filtro = `campaign_id=eq.${encodeURIComponent(campaign_id)}`
    + `&account_id=eq.${encodeURIComponent(account_id)}`
    + `&captured_at=eq.${captured_at}`
    + `&period_days=eq.${period_days}`
    + `&conversas=is.null`;

  const r = await fetch(`${REST}/campaign_insights?${filtro}&select=campaign_id`, {
    method: 'PATCH',
    headers: { ...sb, Prefer: 'return=representation' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`PATCH ${campaign_id} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  const atualizadas = await r.json().catch(() => []);
  return Array.isArray(atualizadas) ? atualizadas.length : 0;
}

// ---------------------------------------------------------------- Meta

// Só campaign_id e actions: é tudo de que as quatro contagens precisam. Pedir
// spend/impressions/reach seria carregar na mão o dado que não se pode gravar.
async function insightsDaJanela(adAccountId, token, since, until) {
  const url = new URL(`${GRAPH}/act_${adAccountId}/insights`);
  url.searchParams.set('fields', 'campaign_id,actions');
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);

  const todos = [];
  let proxima = url.toString();
  while (proxima) {
    const r = await fetch(proxima);
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.data) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    todos.push(...j.data);
    // A Graph às vezes manda `paging.next` numa página já vazia. Sem esta linha o
    // laço giraria para sempre queimando o limite de taxa.
    proxima = j.data.length ? (j.paging?.next || null) : null;
  }
  return todos;
}

// ---------------------------------------------------------------- retomada

function lerRetomada() {
  if (!existsSync(RETOMADA)) return new Set();
  try {
    const j = JSON.parse(readFileSync(RETOMADA, 'utf8'));
    return new Set(Array.isArray(j?.feitos) ? j.feitos : []);
  } catch {
    // Arquivo truncado por uma parada no meio da gravação. Recomeçar do zero
    // custa tempo, não custa dado: o UPDATE é idempotente e só toca linha nula.
    console.log('⚠ arquivo de retomada ilegível — recomeçando do início');
    return new Set();
  }
}

// Grava em arquivo temporário e renomeia: rename é atômico, então um Ctrl+C no
// meio nunca deixa um JSON pela metade no lugar do bom.
function salvarRetomada(feitos) {
  const tmp = RETOMADA + '.tmp';
  writeFileSync(tmp, JSON.stringify({ feitos: [...feitos] }));
  renameSync(tmp, RETOMADA);
}

// ---------------------------------------------------------------- principal

async function main() {
  if (!SERVICE_KEY) { console.error('✗ Falta SUPABASE_SERVICE_KEY (coletor/.env)'); process.exit(1); }
  const comecou = Date.now();

  const { linhas: contas } = await sbGet('/accounts?select=id,name,ad_account_id,access_token');
  const porId = Object.fromEntries(contas.map((c) => [c.id, c]));

  const linhas = await lerLinhasNulas();
  const todos = alvosPendentes(linhas);
  // --dry LÊ a retomada (para prever o próximo alvo de verdade, não um já feito),
  // mas nunca a escreve.
  const feitos = lerRetomada();
  const alvos = todos.filter((a) => !feitos.has(chaveDoAlvo(a)));

  console.log(`${linhas.length} linha(s) nula(s) → ${todos.length} alvo(s); ${todos.length - alvos.length} já feito(s); ${alvos.length} pela frente.`);
  if (DRY) console.log('PRÉVIA (--dry): UM alvo, o mais antigo, e NADA é gravado.\n');
  else console.log(`Pausa de ${PAUSA}ms entre chamadas. ~${Math.round((alvos.length * PAUSA) / 60000)} min só de pausa.\n`);
  if (!alvos.length) { console.log('Nada a fazer.'); return; }

  const fila = DRY ? alvos.slice(0, 1) : alvos;
  let feitosAgora = 0, vazios = 0, erros = 0, semConta = 0, atualizadas = 0, errosSeguidos = 0;

  for (const alvo of fila) {
    const conta = porId[alvo.account_id];
    const rotulo = `${(conta?.name || alvo.account_id).slice(0, 18).padEnd(18)} ${alvo.captured_at} p${String(alvo.period_days).padEnd(2)}`;
    if (!conta?.access_token || !conta?.ad_account_id) {
      semConta++; console.log(`  ! ${rotulo}  sem token ou sem conta de anúncio`); continue;
    }

    const janela = janelaDoRecorte(alvo.captured_at, alvo.period_days);
    if (!janela) { semConta++; console.log(`  ! ${rotulo}  recorte sem janela conhecida`); continue; }

    let itens;
    try {
      itens = await insightsDaJanela(conta.ad_account_id, conta.access_token, janela.since, janela.until);
      errosSeguidos = 0;
    } catch (e) {
      erros++; errosSeguidos++;
      console.log(`  ! ${rotulo}  ${janela.since}..${janela.until}  Meta: ${String(e.message).slice(0, 90)}`);
      if (errosSeguidos >= ERROS_SEGUIDOS_ATE_DESISTIR) {
        console.log(`\n✗ ${errosSeguidos} erros seguidos — parando para não martelar a Meta. Rode de novo mais tarde: a retomada guardou o que já foi feito.`);
        break;
      }
      await dormir(PAUSA * 5); // recuo: erro em série é quase sempre limite de taxa
      continue;
    }

    // REGRA 2: resposta vazia NÃO vira zero. Não grava e NÃO marca como feito —
    // pode ter sido a Meta engasgando, e a próxima execução tenta de novo.
    if (!itens.length) {
      vazios++;
      console.log(`  · ${rotulo}  ${janela.since}..${janela.until}  a Meta não devolveu nada — deixado nulo`);
      await dormir(PAUSA);
      continue;
    }

    let nesteAlvo = 0;
    for (const item of itens) {
      if (!item?.campaign_id) continue;
      const contagens = contagensDaCampanha(item.actions);
      const alvoDaLinha = { campaign_id: item.campaign_id, ...alvo };
      if (DRY) {
        console.log(`      ${item.campaign_id}  ` + AS_QUATRO.map((k) => `${k}=${contagens[k]}`).join('  '));
        nesteAlvo++;
      } else {
        nesteAlvo += await atualizarAsQuatro(alvoDaLinha, contagens);
      }
    }
    atualizadas += nesteAlvo;
    feitosAgora++;
    console.log(`  ${DRY ? '·' : '✓'} ${rotulo}  ${janela.since}..${janela.until}  ${itens.length} campanha(s), ${nesteAlvo} linha(s)${DRY ? ' seriam atualizadas' : ' atualizadas'}`);

    if (!DRY) { feitos.add(chaveDoAlvo(alvo)); salvarRetomada(feitos); }
    await dormir(PAUSA);
  }

  const minutos = ((Date.now() - comecou) / 60000).toFixed(1);
  console.log(`\nalvos feitos: ${feitosAgora} · vazios (deixados nulos): ${vazios} · erro: ${erros} · sem conta/janela: ${semConta}`);
  console.log(`linhas ${DRY ? 'que seriam ' : ''}atualizadas: ${atualizadas} · ${minutos} min`);
  if (DRY) console.log('\nPRÉVIA: nada foi gravado. Rode sem --dry para valer.');
}

main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
