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

// ── main (nesta task, só extração; enriquecimento/gravação vêm na Task 4) ──
async function main() {
  const token = await loginServico();
  console.log('login serviço ok');
  const briefing = await buscarUltimoBriefing();
  console.log('briefing:', briefing.rodada, '—', briefing.periodo);
  const candidatos = await extrairCandidatos(briefing);
  console.log('candidatos extraídos:', candidatos.length);
  for (const c of candidatos) console.log(`  [${c.fonte}] ${c.nome} (sku=${c.sku || '—'}) :: ${c.angulo.slice(0, 60)}`);
  if (DRY) { console.log('\n(--dry) parando antes de enriquecer/gravar.'); return; }
  console.log('\n(TODO Task 4: enriquecer via Bling + gravar)');
}

main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });

export { buscarUltimoBriefing, extrairCandidatos, normalizarFonte };
