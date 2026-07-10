#!/usr/bin/env node
// coletor/fabrica-anuncios.mjs
// F1 da Fábrica de Anúncios: lê o último briefing do Gestor, extrai candidatos
// (IA), enriquece via Bling (preço + estoque por loja) e grava fabrica_*.
// Padrão herdado de gestor-comercial.mjs. Sem deps externas (fetch nativo).
//
// Uso:
//   node fabrica-anuncios.mjs         # roda completo (extrai + enriquece + grava)
//   node fabrica-anuncios.mjs --dry   # só imprime o que extrairia/gravaria, sem escrever

// carrega coletor/.env ANTES de importar bling-comercial.mjs (que lê process.env
// no topo do módulo — imports ESM são avaliados antes do corpo deste arquivo;
// mesmo padrão de relatorios-comerciais.mjs).
import './lib/carregar-env.mjs';
import { loginServico, blingProdutos, blingSaldoFoco, classificarItem, DEP_FOCO } from './lib/bling-comercial.mjs';

const DRY = process.argv.includes('--dry');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL + '/rest/v1';
const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_FABRICA || process.env.ANTHROPIC_API_KEY_GESTOR;
const MODEL = process.env.FABRICA_MODEL || 'claude-opus-4-8';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── REST helpers (service key) ──
async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sbHeaders });
  if (!r.ok) throw new Error('REST GET ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function sbPost(path, body, prefer) {
  const r = await fetch(REST + path, { method: 'POST', headers: prefer ? { ...sbHeaders, Prefer: prefer } : sbHeaders, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('REST POST ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

// Lojas ativas (depósitos) lidas da tabela — respeita o toggle ativo/extensível.
async function lojasAtivas() {
  const rows = await sbGet('/fabrica_lojas?select=deposito_id,nome,ativo&ativo=eq.true&order=ordem');
  return rows; // [{deposito_id, nome, ativo}]
}

// Regra de pré-seleção (default A): oportunidade/estrela/interrogacao/garimpo entram marcados.
function preSelecionar(fonte) { return ['oportunidade', 'estrela', 'interrogacao', 'garimpo'].includes(fonte); }

// Casa um candidato extraído com o produto do Bling (por código/SKU, depois por nome).
function casarProduto(cand, prodPorCodigo, prodPorId) {
  if (cand.sku) {
    const chave = cand.sku.toUpperCase();
    if (prodPorCodigo[chave]) return prodPorCodigo[chave];
    // prefixo (SKU do briefing vem com sufixo de cor/variação sobre o código
    // base do catálogo — a chave extraída começa com o código, não o contrário).
    // Exige tamanho mínimo de 4 no código do catálogo (sem matches genéricos
    // ultracurtos) e prefere o mais específico (mais longo) entre os que batem.
    let melhor = null;
    for (const k of Object.keys(prodPorCodigo)) {
      if (k.length >= 4 && chave.startsWith(k) && (!melhor || k.length > melhor.length)) melhor = k;
    }
    if (melhor) return prodPorCodigo[melhor];
  }
  // fallback por nome (contains, normalizado)
  const alvo = cand.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hit = Object.values(prodPorId).find(p => {
    const n = (p.nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return n && (n.includes(alvo) || alvo.includes(n));
  });
  return hit || null;
}

// ── Último briefing do Gestor ──
async function buscarUltimoBriefing() {
  const rows = await sbGet('/gestao_comercial_briefings?select=id,rodada,periodo,conteudo,dados_json&order=rodada.desc&limit=1');
  if (!rows.length) throw new Error('nenhum briefing em gestao_comercial_briefings');
  return rows[0];
}

// ── Anthropic (retry, herdado de gestor-comercial.mjs) ──
async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) { await sleep(1500 * (t + 1)); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (t + 1)); continue; }
    throw new Error('Anthropic ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  throw new Error('Anthropic falhou após retries');
}

// Normaliza a fonte que o modelo devolve pra um vocabulário fixo.
function normalizarFonte(f) {
  const n = (f || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('oportunidade')) return 'oportunidade';
  if (n.includes('estrela')) return 'estrela';
  if (n.includes('interrog')) return 'interrogacao';
  if (n.includes('garimpo')) return 'garimpo';
  return 'garimpo'; // default conservador
}

// ── Extração IA: prosa do briefing → lista estruturada ──
async function extrairCandidatos(briefing) {
  const sys = 'Você é um extrator de dados. Lê o briefing comercial semanal (markdown) e devolve APENAS os produtos que valem virar anúncio nesta semana. Não invente produtos. Ignore itens da matriz "Abacaxi" (baixo giro sem ângulo). Responda SOMENTE com um bloco ```json contendo um array.';
  const user = [
    'Briefing (markdown):', '"""', (briefing.conteudo || '').slice(0, 24000), '"""',
    '',
    'Dados estruturados do briefing (se houver):',
    JSON.stringify(briefing.dados_json || {}).slice(0, 6000),
    '',
    'Extraia os produtos-anúncio. Para cada um devolva:',
    '- "sku": o código/SKU do Bling se aparecer no texto (ex.: "LV108-Sand Liz"); senão null',
    '- "nome": nome do produto como no briefing',
    '- "fonte": um de "oportunidade" (Oportunidades da Semana), "estrela", "interrogacao", "garimpo" (garimpo do Gestor)',
    '- "angulo": a frase curta de venda/argumento que o briefing sugere pra esse item',
    '',
    'Formato exato: ```json\n[{"sku":"...","nome":"...","fonte":"...","angulo":"..."}]\n```',
  ].join('\n');

  const resp = await anthropic({ model: MODEL, max_tokens: 4000, system: sys, messages: [{ role: 'user', content: user }] });
  const texto = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const m = texto.match(/```json\s*([\s\S]*?)```/);
  const cru = m ? m[1] : texto;
  let arr;
  try { arr = JSON.parse(cru.trim()); } catch (e) { throw new Error('extração não devolveu JSON válido: ' + texto.slice(0, 300)); }
  if (!Array.isArray(arr)) throw new Error('extração não devolveu array');
  return arr
    .filter(x => x && x.nome)
    .map(x => ({ sku: x.sku ? String(x.sku).trim() : null, nome: String(x.nome).trim(), fonte: normalizarFonte(x.fonte), angulo: (x.angulo || '').toString().trim() }));
}

// ── main ──
async function main() {
  const token = await loginServico();
  console.log('login serviço ok');
  const briefing = await buscarUltimoBriefing();
  console.log('briefing:', briefing.rodada, '—', briefing.periodo);
  const candidatos = await extrairCandidatos(briefing);
  console.log('candidatos extraídos:', candidatos.length);
  for (const c of candidatos) console.log(`  [${c.fonte}] ${c.nome} (sku=${c.sku || '—'}) :: ${c.angulo.slice(0, 60)}`);

  // 1) catálogo Bling: id->{nome,codigo,preco} e índice por código (SKU)
  const prodPorId = await blingProdutos(token);
  const prodPorCodigo = {};
  for (const [id, p] of Object.entries(prodPorId)) {
    p.id = id;
    if (p.codigo) prodPorCodigo[p.codigo.toUpperCase()] = p;
  }
  console.log('produtos Bling:', Object.keys(prodPorId).length);

  // 2) saldo por depósito
  const saldoPorDep = await blingSaldoFoco(token, prodPorId);

  // 3) lojas ativas
  const lojas = await lojasAtivas();
  console.log('lojas ativas:', lojas.map(l => l.nome).join(', '));

  // 4) monta linhas produto × loja (só onde há estoque)
  const linhas = [];
  const semMatch = [];
  for (const c of candidatos) {
    const prod = casarProduto(c, prodPorCodigo, prodPorId);
    if (!prod) { semMatch.push(c.nome); continue; }
    for (const loja of lojas) {
      const saldo = (saldoPorDep[loja.deposito_id] || {})[prod.id] || 0;
      if (saldo <= 0) continue;
      linhas.push({
        sku: prod.codigo || c.sku || null,
        nome: prod.nome || c.nome,
        categoria: classificarItem(prod.nome || c.nome),
        fonte: c.fonte,
        angulo: c.angulo,
        preco: prod.preco || null,
        deposito_id: loja.deposito_id,
        loja_nome: loja.nome,
        estoque: saldo,
        selecionado: preSelecionar(c.fonte),
      });
    }
  }
  console.log('linhas produto×loja:', linhas.length, '| sem match no Bling:', semMatch.length, semMatch.slice(0, 8));

  // dedupe (sku, deposito_id): a UNIQUE(rodada_id, sku, deposito_id) da tabela
  // rejeitaria o batch inteiro se duas variações (ex.: cores) casarem com o
  // mesmo produto do Bling na mesma loja. Mantém a 1ª ocorrência. Linhas com
  // sku nulo são distintas sob a constraint (NULL != NULL) e ficam intactas.
  const vistos = new Set();
  const linhasDedup = [];
  let duplicados = 0;
  for (const l of linhas) {
    if (l.sku) {
      const chave = l.sku + '::' + l.deposito_id;
      if (vistos.has(chave)) { duplicados++; continue; }
      vistos.add(chave);
    }
    linhasDedup.push(l);
  }
  console.log('duplicados removidos:', duplicados);

  if (DRY) { console.log('\n(--dry) não gravou.'); return; }

  if (!linhasDedup.length) { console.log('nenhuma linha para gravar — rodada não criada.'); return; }

  // 5) grava rodada + candidatos (a rodada precisa existir primeiro pro FK dos
  // candidatos; se o insert dos candidatos falhar por qualquer motivo, apaga
  // a rodada órfã pra não deixar a tela apontando pra uma rodada vazia).
  const rRod = await sbPost('/fabrica_rodadas',
    [{ rodada: briefing.rodada, periodo: briefing.periodo, briefing_id: briefing.id, status: 'rascunho' }],
    'return=representation');
  const rodada = (await rRod.json())[0];
  const comRodada = linhasDedup.map(l => ({ ...l, rodada_id: rodada.id }));
  try {
    // insere em lotes de 200
    for (let i = 0; i < comRodada.length; i += 200) {
      await sbPost('/fabrica_candidatos', comRodada.slice(i, i + 200), 'return=minimal');
    }
  } catch (e) {
    console.error('falha ao gravar candidatos, removendo rodada órfã', rodada.id, ':', e.message);
    try {
      await fetch(REST + '/fabrica_rodadas?id=eq.' + rodada.id, { method: 'DELETE', headers: sbHeaders });
    } catch (e2) {
      console.error('falha ao remover rodada órfã', rodada.id, ':', e2.message);
    }
    throw e;
  }
  console.log('gravado: rodada', rodada.id, 'com', comRodada.length, 'candidatos.');
}

main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });

export { buscarUltimoBriefing, extrairCandidatos, normalizarFonte };
