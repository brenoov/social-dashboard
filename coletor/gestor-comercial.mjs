#!/usr/bin/env node
// Agente Gestor Comercial — roda no GitHub Actions (cron semanal).
// Coleta faturamento real (Bling via bling-proxy, autenticado como conta de
// serviço), metas e notícias de concorrentes; o Claude (Opus 4.8) escreve o
// briefing; grava em gestao_comercial_briefings. Log em gestor_log.
// Sem deps externas — fetch nativo (Node 18+).

import { metaPace } from './lib/meta-pace.mjs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_GESTOR || process.env.ANTHROPIC_API_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const GESTOR_EMAIL = process.env.GESTOR_USER_EMAIL;
const GESTOR_PASS = process.env.GESTOR_USER_PASSWORD;
const MODEL = process.env.GESTOR_MODEL || 'claude-opus-4-8';

if (!ANTHROPIC_API_KEY || !SERVICE_KEY || !GESTOR_EMAIL || !GESTOR_PASS) {
  console.error('✗ Faltam segredos: ANTHROPIC_API_KEY_GESTOR, SUPABASE_SERVICE_KEY, GESTOR_USER_EMAIL, GESTOR_USER_PASSWORD');
  process.exit(1);
}

const CANAIS = [
  { nome: 'Shopping Tivoli (Santa Bárbara)', loja_id: '205834140' },
  { nome: 'Shopping Dom Pedro',              loja_id: '205657609' },
  { nome: 'Atacado Nuvem Shop',             loja_id: '205451611' },
];
const REST = SUPABASE_URL + '/rest/v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Supabase REST (service key) ──
const sb = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sb });
  if (!r.ok) throw new Error('REST GET ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbInsert(path, body, prefer) {
  const r = await fetch(REST + path, { method: 'POST', headers: prefer ? { ...sb, Prefer: prefer } : sb, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('REST POST ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}
async function logGestor(fase, erro, detalhe) {
  try { await sbInsert('/gestor_log', { fase, erro: erro || null, detalhe: detalhe || null }, 'return=minimal'); }
  catch (e) { console.error('aviso log:', e.message); }
}

// ── Conta de serviço: login → access_token ──
async function loginServico() {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: GESTOR_EMAIL, password: GESTOR_PASS }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('login conta de serviço falhou: ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

// ── Bling via edge function bling-proxy (precisa do token de usuário) ──
// Throttle global: o Bling limita ~3 req/seg → espaçamos ~380ms e retry em 429.
let _lastBling = 0;
async function blingProxy(token, endpoint, params) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const espera = 380 - (Date.now() - _lastBling);
    if (espera > 0) await sleep(espera);
    _lastBling = Date.now();
    const r = await fetch(SUPABASE_URL + '/functions/v1/bling-proxy', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: params || {} }),
    });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) throw new Error('bling-proxy ' + endpoint + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.json();
  }
  throw new Error('bling-proxy ' + endpoint + ' -> 429 repetido');
}
// Lista todas as páginas de pedidos de venda concluídos no intervalo
async function blingPedidos(token, dataInicial, dataFinal) {
  const all = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    let items = [];
    for (let retry = 0; retry < 3; retry++) {
      const resp = await blingProxy(token, 'pedidos/vendas', { dataInicial, dataFinal, 'idsSituacoes[]': 9, pagina, limite: 100 });
      const d = resp.data;
      if (Array.isArray(d) && d.length) { items = d; break; }
      if (retry < 2) await sleep(700);
    }
    if (!items.length) break;
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

// ── Estoque por armazém dos canais foco ──
// Depósito de cada canal foco (mapeado no Bling):
const DEP_FOCO = [
  { canal: 'Shopping Tivoli (Santa Bárbara)', deposito_id: '14888726315' },
  { canal: 'Shopping Dom Pedro',              deposito_id: '14888617206' },
  { canal: 'Atacado Nuvem Shop (Estoque Pulmão)', deposito_id: '14888248253' },
];

// Lista o catálogo de produtos (id → nome/código). Bounded por segurança.
async function blingProdutos(token, maxPaginas = 20) {
  const prod = {};
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const resp = await blingProxy(token, 'produtos', { pagina, limite: 100 });
    const d = resp.data;
    if (!Array.isArray(d) || !d.length) break;
    for (const p of d) prod[String(p.id)] = { nome: (p.nome || '').slice(0, 60), codigo: p.codigo || '' };
    if (d.length < 100) break;
  }
  return prod;
}

// Saldo físico por depósito foco, por produto (em lotes de idsProdutos).
async function blingSaldoFoco(token, prodMap) {
  const ids = Object.keys(prodMap);
  const saldoPorDep = {};            // deposito_id → { produtoId → saldo }
  for (const x of DEP_FOCO) saldoPorDep[x.deposito_id] = {};
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const params = {};
    batch.forEach((id, k) => { params['idsProdutos[' + k + ']'] = id; });
    const resp = await blingProxy(token, 'estoques/saldos', params);
    for (const row of (resp.data || [])) {
      const pid = String(row.produto?.id || '');
      for (const dep of (row.depositos || [])) {
        const did = String(dep.id);
        if (did in saldoPorDep) {
          const saldo = Number(dep.saldoFisico) || 0;
          if (saldo > 0) saldoPorDep[did][pid] = saldo;
        }
      }
    }
  }
  return saldoPorDep;
}

// Unidades vendidas por produto no mês (dos detalhes dos pedidos) → giro.
async function blingGiroMes(token, pedidos, maxPedidos = 400) {
  const vendidos = {};               // produtoId → unidades no mês
  for (const p of pedidos.slice(0, maxPedidos)) {
    const resp = await blingProxy(token, 'pedidos/vendas/' + p.id, {});
    for (const it of (resp.data?.itens || [])) {
      const pid = String(it.produto?.id || '');
      if (pid) vendidos[pid] = (vendidos[pid] || 0) + (Number(it.quantidade) || 0);
    }
  }
  return vendidos;
}

// Monta o resumo de estoque por canal foco: itens PARADOS (com estoque e sem
// venda no mês) como candidatos a promoção, + total de itens com estoque.
function montarEstoque(saldoPorDep, prodMap, giro) {
  return DEP_FOCO.map(x => {
    const saldos = saldoPorDep[x.deposito_id] || {};
    const itens = Object.entries(saldos).map(([pid, saldo]) => ({
      nome: prodMap[pid]?.nome || pid,
      codigo: prodMap[pid]?.codigo || '',
      saldo,
      vendidoMes: giro[pid] || 0,
    }));
    const parados = itens.filter(it => it.vendidoMes === 0).sort((a, b) => b.saldo - a.saldo).slice(0, 12);
    const totalUnid = itens.reduce((s, it) => s + it.saldo, 0);
    return {
      canal: x.canal,
      skusComEstoque: itens.length,
      unidadesEmEstoque: totalUnid,
      itensParados: parados,         // estoque > 0 e sem venda no mês
    };
  });
}

// ── Anthropic (retry em 429/5xx/rede) ──
async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { console.log('  rede falhou; aguardando…'); await sleep(Math.min(60, 8 * (t + 1)) * 1000); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { const ra = parseInt(r.headers.get('retry-after') || '0', 10); console.log('  rate/sobrecarga ' + r.status + '; aguardando…'); await sleep((ra > 0 ? ra : Math.min(60, 8 * (t + 1))) * 1000); continue; }
    throw new Error('Anthropic ' + r.status + ' ' + JSON.stringify(await r.json().catch(() => ({}))).slice(0, 300));
  }
  throw new Error('Anthropic: tentativas esgotadas');
}

// ── Datas (America/Sao_Paulo) ──
function hojeBR() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date()); // YYYY-MM-DD
}

async function main() {
  const hoje = hojeBR();
  const [y, m, d] = hoje.split('-').map(Number);
  const diasNoMes = new Date(y, m, 0).getDate();
  const di = `${y}-${String(m).padStart(2, '0')}-01`;
  const df = hoje;
  console.log('== Gestor Comercial · ' + hoje + ' · ' + MODEL + ' ==');
  await logGestor('inicio', null, 'rodada ' + hoje + ' (' + MODEL + ')');

  // 1) faturamento real por canal (mês corrente) via bling-proxy
  const token = await loginServico();
  const pedidos = await blingPedidos(token, di, df);
  const realPorCanal = {};
  for (const c of CANAIS) realPorCanal[c.loja_id] = 0;
  for (const p of pedidos) {
    const lid = String(p.loja?.id || '');
    if (lid in realPorCanal) realPorCanal[lid] += parseFloat(p.total || 0);
  }

  // 2) metas do mês (todas as lojas; casa pelos canais foco quando houver)
  const metas = await sbGet(`/bling_metas?year=eq.${y}&month=eq.${m}&select=loja_id,loja_nome,meta_valor,daily_goals`);

  // 3) concorrentes recentes (últimas ~2 semanas)
  const desde = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const noticias = await sbGet(`/noticias_concorrentes?rodada=gte.${desde}&select=marca,titulo,resumo,categoria,fonte,data_publicacao&order=data_publicacao.desc&limit=40`);

  // 3.5) estoque por armazém dos canais foco + giro do mês (itens parados)
  let estoque = [];
  try {
    const prodMap = await blingProdutos(token);
    const saldoPorDep = await blingSaldoFoco(token, prodMap);
    const giro = await blingGiroMes(token, pedidos);
    estoque = montarEstoque(saldoPorDep, prodMap, giro);
    console.log('estoque coletado:', estoque.map(e => `${e.canal}=${e.skusComEstoque} SKUs/${e.itensParados.length} parados`).join(' · '));
  } catch (e) {
    console.error('aviso estoque:', e.message); // não derruba o briefing se o estoque falhar
  }

  // 4) monta o pacote de números (com ritmo de meta por canal foco)
  const canaisResumo = CANAIS.map(c => {
    const meta = metas.find(mm => String(mm.loja_id) === c.loja_id);
    const pace = metaPace({ metaValor: meta?.meta_valor, dailyGoals: meta?.daily_goals, diaDoMes: d, diasNoMes, realizado: realPorCanal[c.loja_id] });
    return { canal: c.nome, ...pace };
  });
  const dados = { rodada: hoje, mesReferencia: `${y}-${String(m).padStart(2, '0')}`, diaDoMes: d, diasNoMes, canaisFoco: canaisResumo, totalPedidosMes: pedidos.length, estoque };

  // 5) Claude escreve o briefing (persona de gestor veterano)
  const sys = 'Você é um gestor comercial veterano de varejo e atacado de moda (bolsas, marca Vessel). '
    + 'Escreve briefings semanais diretos, práticos e acionáveis — chão de loja, sem encheção. '
    + 'Foco TOTAL em 3 canais: Shopping Tivoli (Santa Bárbara), Shopping Dom Pedro e Atacado Nuvem Shop.';
  const user = 'Dados desta semana (R$ reais do Bling, metas e movimento de concorrentes):\n\n'
    + 'NÚMEROS:\n' + JSON.stringify(dados, null, 2) + '\n\n'
    + 'CONCORRENTES (últimas 2 semanas):\n' + noticias.map(n => `- [${n.marca}/${n.categoria}] ${n.titulo} (${n.fonte}, ${n.data_publicacao})`).join('\n') + '\n\n'
    + 'Escreva o briefing em markdown com estas seções: '
    + '## Resumo executivo (3-5 bullets) · ## Ritmo das metas (por canal foco: % da meta, adiantado/atrasado, projeção de fechamento) · '
    + '## Frente competitiva (o que os concorrentes fizeram + resposta promocional sugerida) · '
    + '## Calendário comercial (próximas datas relevantes e o que preparar) · '
    + '## Estoque & ações no item (em dados.estoque há, por armazém de cada canal foco, os itensParados = produtos COM estoque e SEM venda no mês; aponte os principais candidatos a PROMOÇÃO/queima por item e por canal, com a quantidade parada; priorize quem tem mais unidade encalhada) · '
    + '## Performance (destaques/alertas) · ## Ações priorizadas (lista numerada: o quê, onde, urgência). '
    + 'Use os números reais fornecidos. Não invente faturamento nem produtos que não estão nos dados. '
    + 'No fim, escreva numa última linha SÓ um resumo de 1 frase prefixado por "RESUMO: " para usar no card.';

  const resp = await anthropic({ model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' }, system: sys, messages: [{ role: 'user', content: user }] });
  const conteudo = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const mResumo = conteudo.match(/RESUMO:\s*(.+)\s*$/);
  const resumo = mResumo ? mResumo[1].trim() : (canaisResumo.map(c => `${c.canal}: ${c.percentMeta}% da meta`).join(' · '));
  const periodo = `Semana de ${hoje} (${dados.mesReferencia})`;

  // 6) grava o briefing
  await sbInsert('/gestao_comercial_briefings', [{ rodada: hoje, periodo, resumo, conteudo, dados_json: dados }], 'return=minimal');
  console.log('briefing gravado. canais:', canaisResumo.map(c => `${c.canal}=${c.percentMeta}%`).join(', '));
  await logGestor('fim', null, 'pedidos=' + pedidos.length + ' · ' + canaisResumo.map(c => `${c.canal}:${c.status}`).join(' · '));
}

main().catch(async (e) => { console.error('FALHA:', e.message); await logGestor('fim', e.message.slice(0, 500), 'falha geral'); process.exit(1); });
