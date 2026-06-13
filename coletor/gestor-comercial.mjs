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
    for (const p of d) prod[String(p.id)] = { nome: (p.nome || '').slice(0, 60), codigo: p.codigo || '', preco: Number(p.preco) || 0 };
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

// Percorre os detalhes dos pedidos (janela ~90d) e retorna, por produto:
// giro = unidades vendidas NO MÊS (data >= mesStart) e ultimaVenda = data da
// venda mais recente (para "dias sem vender" nas oportunidades).
async function blingVendas(token, pedidos, mesStart, maxPedidos = 500) {
  const giro = {}, ultimaVenda = {};
  for (const p of pedidos.slice(0, maxPedidos)) {
    const dataPedido = String(p.data || '').slice(0, 10);
    const resp = await blingProxy(token, 'pedidos/vendas/' + p.id, {});
    for (const it of (resp.data?.itens || [])) {
      const pid = String(it.produto?.id || '');
      if (!pid) continue;
      const q = Number(it.quantidade) || 0;
      if (dataPedido >= mesStart) giro[pid] = (giro[pid] || 0) + q;
      if (!ultimaVenda[pid] || dataPedido > ultimaVenda[pid]) ultimaVenda[pid] = dataPedido;
    }
  }
  return { giro, ultimaVenda };
}

// Classifica o item pela descrição. Retorna a categoria, ou null se NÃO for
// produto vendável (sacola/TNT/embalagem/matéria-prima → ignorar no comercial).
function classificarItem(nome) {
  const n = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/(sacola|tnt|embalagem|caixa|linha|poliamida|poliester|nylon|tinta|materia.?prima|aviamento|ziper|ziper|tecido|forro|cola|verniz|fivela a granel)/.test(n)) return null;
  if (/carteira/.test(n)) return 'Carteira';
  if (/transversal|tiracolo|crossbody/.test(n)) return 'Transversal';
  if (/tote/.test(n)) return 'Tote';
  if (/mochila/.test(n)) return 'Mochila';
  if (/clutch|festa|baguete/.test(n)) return 'Festa/Clutch';
  if (/ombro/.test(n)) return 'Bolsa de ombro';
  if (/(alca de mao|de mao|handbag)/.test(n)) return 'Bolsa de mão';
  if (/(porta.?cartao|porta cartao| cartao)/.test(n)) return 'Porta-cartão';
  if (/(porta.?niquel|niquel|porta.?moeda|moedeir)/.test(n)) return 'Porta-níquel';
  if (/necessaire|nessaire/.test(n)) return 'Necessaire';
  if (/oculos/.test(n)) return 'Óculos';
  if (/cinto/.test(n)) return 'Cinto';
  if (/chaveiro/.test(n)) return 'Chaveiro';
  if (/mala/.test(n)) return 'Mala/Viagem';
  if (/bolsa|bag/.test(n)) return 'Bolsa (outros)';
  return 'Outros acessórios';
}

// Resumo estratégico de estoque por canal foco: só produtos vendáveis (LV),
// agrupados por CATEGORIA, com estoque vs giro do mês e os itens parados (com
// estoque e sem venda no mês) — base para ações por categoria e por item.
function montarEstoque(saldoPorDep, prodMap, giro, diaDoMes) {
  return DEP_FOCO.map(x => {
    const saldos = saldoPorDep[x.deposito_id] || {};
    const porCat = {};   // categoria → { skus, unidEstoque, vendidoMes, parados[] }
    const rupturas = []; // itens que giram e estão com estoque baixo
    let totalUnid = 0, totalSkus = 0;
    for (const [pid, saldo] of Object.entries(saldos)) {
      const nome = prodMap[pid]?.nome || pid;
      const cat = classificarItem(nome);
      if (!cat) continue;            // ignora não-vendável (sacola/tnt/insumo)
      const vendidoMes = giro[pid] || 0;
      totalUnid += saldo; totalSkus++;
      const c = porCat[cat] || (porCat[cat] = { categoria: cat, skus: 0, unidEstoque: 0, vendidoMes: 0, parados: [] });
      c.skus++; c.unidEstoque += saldo; c.vendidoMes += vendidoMes;
      if (vendidoMes === 0) c.parados.push({ nome, codigo: prodMap[pid]?.codigo || '', saldo });
      // Ruptura: vende de verdade (>=2/mês) e tem menos de ~1 mês de cobertura
      if (vendidoMes >= 2) {
        const ritmoDia = vendidoMes / (diaDoMes || 1);
        const diasCobertura = ritmoDia > 0 ? Math.round(saldo / ritmoDia) : 999;
        if (diasCobertura <= 20) rupturas.push({ nome, codigo: prodMap[pid]?.codigo || '', categoria: cat, saldo, vendidoMes, diasCobertura });
      }
    }
    const categorias = Object.values(porCat)
      .map(c => ({ ...c, parados: c.parados.sort((a, b) => b.saldo - a.saldo).slice(0, 6) }))
      .sort((a, b) => b.unidEstoque - a.unidEstoque);
    rupturas.sort((a, b) => a.diasCobertura - b.diasCobertura);
    return { canal: x.canal, skusVendaveis: totalSkus, unidadesEmEstoque: totalUnid, categorias, rupturas: rupturas.slice(0, 10) };
  });
}

// ── Oportunidades da Semana (vitrine de ofertas do varejo) ──
// Degradê de % (amplo/base): rotaciona entre as categorias a cada semana.
const PARES_OPP = [[40, 15], [35, 20], [30, 25], [25, 30], [20, 35], [15, 40]];
const CAT_OFERTA = ['Transversal', 'Tote', 'Festa/Clutch', 'Bolsa de ombro', 'Bolsa de mão', 'Mochila', 'Bolsa (outros)'];
const LOJAS_VAREJO = [
  { loja: 'Tivoli (Santa Bárbara)', deposito_id: '14888726315' },
  { loja: 'Shopping Dom Pedro',     deposito_id: '14888617206' },
];
const DEP_PULMAO = '14888248253';
function _diasSemVender(ultima, hoje) {
  if (!ultima) return '90+';
  const d = Math.round((new Date(hoje + 'T00:00:00') - new Date(ultima + 'T00:00:00')) / 864e5);
  return String(Math.max(0, d));
}
// 12 itens por loja de varejo: 6 categorias (mais estoque parado) × (1 Amplo + 1 Base),
// com o degradê de % rotacionado pela semana. Só bolsas/mochilas, encalhados primeiro.
function montarOportunidades(saldoPorDep, prodMap, giro, ultimaVenda, hoje, weekNum) {
  const saldoPulmao = saldoPorDep[DEP_PULMAO] || {};
  return LOJAS_VAREJO.map(L => {
    const saldos = saldoPorDep[L.deposito_id] || {};
    const porCat = {};
    for (const [pid, saldo] of Object.entries(saldos)) {
      const meta = prodMap[pid]; if (!meta) continue;
      const cat = classificarItem(meta.nome);
      if (!cat || !CAT_OFERTA.includes(cat)) continue;
      if (saldo < 2 || (Number(meta.preco) || 0) <= 0) continue;
      (porCat[cat] = porCat[cat] || []).push({ pid, nome: meta.nome, codigo: meta.codigo, preco: Number(meta.preco), saldo, vendidoMes: giro[pid] || 0 });
    }
    for (const cat in porCat) porCat[cat].sort((a, b) => (a.vendidoMes - b.vendidoMes) || (b.saldo - a.saldo));
    const cats = Object.keys(porCat).filter(c => porCat[c].length).sort((a, b) => {
      const pk = arr => arr.filter(i => i.vendidoMes === 0).reduce((s, i) => s + i.saldo, 0);
      const da = porCat[a].length >= 2 ? 1 : 0, db = porCat[b].length >= 2 ? 1 : 0; // prefere quem dá amplo+base
      if (da !== db) return db - da;
      return pk(porCat[b]) - pk(porCat[a]);
    });
    const cats6 = cats.slice(0, 6);
    if (!cats6.length) return { loja: L.loja, itens: [] };
    const cursor = {}; cats6.forEach(c => cursor[c] = 0);
    const usados = new Set();
    const pickFrom = cat => { const a = porCat[cat] || []; while (cursor[cat] < a.length) { const it = a[cursor[cat]++]; if (!usados.has(it.pid)) { usados.add(it.pid); return it; } } return null; };
    const pickPool = () => { const all = [].concat(...cats6.map(c => porCat[c])).filter(i => !usados.has(i.pid)).sort((a, b) => (a.vendidoMes - b.vendidoMes) || (b.saldo - a.saldo)); if (all.length) { usados.add(all[0].pid); return all[0]; } return null; };
    const offset = ((weekNum % cats6.length) + cats6.length) % cats6.length;
    const itens = [];
    for (let p = 0; p < 6; p++) {
      const pair = PARES_OPP[p];
      const cat = cats6[(p + offset) % cats6.length];
      for (const [publico, pct] of [['Amplo', pair[0]], ['Base', pair[1]]]) {
        const it = pickFrom(cat) || pickPool();
        if (!it) continue;
        const precoDesc = it.preco * (1 - pct / 100);
        itens.push({
          sku: it.codigo, descricao: it.nome, categoria: classificarItem(it.nome) || cat, publico,
          precoOriginal: Math.round(it.preco * 100) / 100, pct,
          precoComDesconto: Math.round(precoDesc * 100) / 100,
          parcela6x: Math.round((precoDesc / 6) * 100) / 100,
          estoqueLoja: it.saldo, estoquePulmao: saldoPulmao[it.pid] || 0,
          diasSemVender: _diasSemVender(ultimaVenda[it.pid], hoje),
        });
      }
    }
    return { loja: L.loja, itens };
  });
}
function _rOpp(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function buildOportunidadesMd(opp) {
  let md = '## Oportunidades da Semana\n\n*Vitrine de ofertas do varejo (Tivoli e Dom Pedro, independentes) — estoque parado de bolsas e mochilas. Preços calculados pelo sistema.*\n';
  for (const loja of opp) {
    md += '\n### ' + loja.loja + '\n\n';
    if (!loja.itens.length) { md += '_Sem itens elegíveis com estoque esta semana._\n'; continue; }
    md += '| SKU | Descrição | Categoria | Público | Preço orig. | % | Com desconto | 6x | Estoque (loja/pulmão) | Dias s/ vender |\n|---|---|---|---|---|---|---|---|---|---|\n';
    for (const it of loja.itens) {
      md += '| ' + it.sku + ' | ' + it.descricao + ' | ' + it.categoria + ' | ' + it.publico + ' | ' + _rOpp(it.precoOriginal) + ' | ' + it.pct + '% | ' + _rOpp(it.precoComDesconto) + ' | ' + _rOpp(it.parcela6x) + ' | ' + it.estoqueLoja + ' / ' + it.estoquePulmao + ' | ' + it.diasSemVender + ' |\n';
    }
  }
  return md;
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
  let estoque = [], oportunidades = [];
  try {
    const prodMap = await blingProdutos(token);
    const saldoPorDep = await blingSaldoFoco(token, prodMap);
    const di90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const pedidos90 = await blingPedidos(token, di90, df);
    const { giro, ultimaVenda } = await blingVendas(token, pedidos90, di);
    estoque = montarEstoque(saldoPorDep, prodMap, giro, d);
    const weekNum = Math.floor(Date.now() / (7 * 864e5));
    oportunidades = montarOportunidades(saldoPorDep, prodMap, giro, ultimaVenda, hoje, weekNum);
    console.log('estoque/opp:', estoque.map(e => `${e.canal}=${e.rupturas.length} rupt`).join(' · '), '| ofertas:', oportunidades.map(o => `${o.loja}=${o.itens.length}`).join(' · '));
  } catch (e) {
    console.error('aviso estoque/opp:', e.message); // não derruba o briefing
  }

  // 3.6) comparativo com o briefing anterior (semana vs semana)
  let comparativo = null;
  try {
    const ant = await sbGet('/gestao_comercial_briefings?select=rodada,dados_json&order=created_at.desc&limit=8');
    const prev = (ant || []).find(b => b.rodada !== hoje && b.dados_json);
    if (prev) {
      const prevCanais = prev.dados_json.canaisFoco || [];
      comparativo = {
        rodadaAnterior: prev.rodada,
        canais: CANAIS.map(c => {
          const at = realPorCanal[c.loja_id];
          const pv = prevCanais.find(p => p.canal === c.nome);
          return {
            canal: c.nome,
            realizadoAnterior: pv ? pv.realizado : null,
            realizadoAtual: Math.round(at),
            deltaRealizado: pv ? Math.round(at - pv.realizado) : null,
            percentMetaAnterior: pv ? pv.percentMeta : null,
          };
        }),
      };
      console.log('comparativo vs', prev.rodada, 'montado');
    } else {
      console.log('sem briefing anterior de outra data p/ comparar');
    }
  } catch (e) { console.error('aviso comparativo:', e.message); }

  // 4) monta o pacote de números (com ritmo de meta por canal foco)
  const canaisResumo = CANAIS.map(c => {
    const meta = metas.find(mm => String(mm.loja_id) === c.loja_id);
    const pace = metaPace({ metaValor: meta?.meta_valor, dailyGoals: meta?.daily_goals, diaDoMes: d, diasNoMes, realizado: realPorCanal[c.loja_id] });
    return { canal: c.nome, ...pace };
  });
  const dados = { rodada: hoje, mesReferencia: `${y}-${String(m).padStart(2, '0')}`, diaDoMes: d, diasNoMes, canaisFoco: canaisResumo, totalPedidosMes: pedidos.length, comparativo, estoque };

  // 5) Claude escreve o briefing (persona de gestor veterano)
  const sys = 'Você é um gestor comercial veterano de varejo e atacado de moda (bolsas, marca Vessel). '
    + 'Escreve briefings semanais diretos, práticos e acionáveis — chão de loja, sem encheção. '
    + 'Foco TOTAL em 3 canais: Shopping Tivoli (Santa Bárbara), Shopping Dom Pedro e Atacado Nuvem Shop.';
  const user = 'Dados desta semana (R$ reais do Bling, metas e movimento de concorrentes):\n\n'
    + 'NÚMEROS:\n' + JSON.stringify(dados, null, 2) + '\n\n'
    + 'CONCORRENTES (últimas 2 semanas):\n' + noticias.map(n => `- [${n.marca}/${n.categoria}] ${n.titulo} (${n.fonte}, ${n.data_publicacao})`).join('\n') + '\n\n'
    + 'Escreva o briefing em markdown com estas seções: '
    + '## Resumo executivo (3-5 bullets) · ## Ritmo das metas (por canal foco: % da meta, adiantado/atrasado, projeção de fechamento) · '
    + '## Evolução vs. semana anterior (use dados.comparativo, se houver: por canal, o faturamento subiu ou caiu vs a rodada anterior — deltaRealizado em R$ — e comente o ritmo; se comparativo for null, diga que é a 1ª medição e pule a comparação) · '
    + '## Alerta de ruptura (use dados.estoque[].rupturas: itens que VENDEM e estão com poucos dias de cobertura (diasCobertura) — risco de FALTAR. Liste os mais urgentes por canal e recomende reposição/realocação imediata, citando produto/código, saldo e quanto vendeu no mês) · '
    + '## Frente competitiva (o que os concorrentes fizeram + resposta promocional sugerida) · '
    + '## Calendário comercial (próximas datas relevantes e o que preparar) · '
    + '## Estoque & ações estratégicas (em dados.estoque há, por canal foco, o estoque de PRODUTOS VENDÁVEIS agrupado por CATEGORIA — carteira, transversal, tote, ombro, mão, festa, mochila, porta-cartão, óculos etc. — com unidEstoque (em estoque), vendidoMes (giro) e parados (itens com estoque e sem venda no mês). Seja ESTRATÉGICO: (a) por CATEGORIA, diga quais estão ENCALHADAS (muito estoque, pouco/zero giro) vs GIRANDO (repor/dar destaque); (b) sugira ações concretas — promoção/queima, COMBO (ex.: carteira + bolsa), brinde, vitrine por categoria/cor da estação; (c) aponte REALOCAÇÃO entre lojas quando um item/categoria está parado num canal e girando em outro; (d) destaque os itens parados de maior capital. Cite produtos pelo nome/código. NÃO mencione sacola/TNT/insumo — já foram excluídos.) · '
    + '## Performance (destaques/alertas) · ## Ações priorizadas (lista numerada: o quê, onde, urgência). '
    + 'Use os números reais fornecidos. Não invente faturamento nem produtos que não estão nos dados. '
    + 'NÃO escreva a seção "Oportunidades da Semana" — ela é gerada automaticamente pelo sistema com os preços exatos e anexada depois. '
    + 'No fim, escreva numa última linha SÓ um resumo de 1 frase prefixado por "RESUMO: " para usar no card.';

  const resp = await anthropic({ model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' }, system: sys, messages: [{ role: 'user', content: user }] });
  const bruto = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const mResumo = bruto.match(/RESUMO:\s*(.+)\s*$/);
  const resumo = mResumo ? mResumo[1].trim() : (canaisResumo.map(c => `${c.canal}: ${c.percentMeta}% da meta`).join(' · '));
  // monta o conteúdo final: corpo do LLM + tabelas de oportunidades (preços exatos) + RESUMO
  let corpo = bruto.replace(/\n*RESUMO:.*$/s, '').trim();
  if (oportunidades.some(o => o.itens.length)) corpo += '\n\n' + buildOportunidadesMd(oportunidades);
  const conteudo = corpo + '\n\nRESUMO: ' + resumo;
  const periodo = `Semana de ${hoje} (${dados.mesReferencia})`;

  // 6) grava o briefing
  await sbInsert('/gestao_comercial_briefings', [{ rodada: hoje, periodo, resumo, conteudo, dados_json: { ...dados, oportunidades } }], 'return=minimal');
  console.log('briefing gravado. canais:', canaisResumo.map(c => `${c.canal}=${c.percentMeta}%`).join(', '));
  await logGestor('fim', null, 'pedidos=' + pedidos.length + ' · ' + canaisResumo.map(c => `${c.canal}:${c.status}`).join(' · '));
}

main().catch(async (e) => { console.error('FALHA:', e.message); await logGestor('fim', e.message.slice(0, 500), 'falha geral'); process.exit(1); });
