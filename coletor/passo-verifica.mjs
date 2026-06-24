// PASSO 6 (final) do agente: GUARDA DE COMPLETUDE. Audita a rodada recém-criada, loga em coletor_log,
// dispara webhook e SAI com código 1 (sinal de falha no GitHub) se faltar algo crítico.
// Cobre #1 (edição incompleta) e #2 (loja vazia em silêncio).
import fs from 'fs';
import { LOJAS } from './lojas.mjs';

const env = {};
try { for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch (e) {}
const URL_SB = process.env.SUPABASE_URL || env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || env.ALERT_WEBHOOK_URL || '';
const RODADA = process.env.RODADA || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const sbH = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { ...sbH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 160)); return t ? JSON.parse(t) : null;
}
const prods = n => Array.isArray(n && n.produtos) ? n.produtos : [];

const PRODUTO = Object.keys(LOJAS);            // marcas com loja (esperam best-seller + Desenvolvimento)
const MKT_ONLY = ["L'Occitane"];                // monitoradas só em Marketing
const ESPERADAS = [...PRODUTO, ...MKT_ONLY];
const IG_CATS = ['Top Viral', 'Últimos Posts', 'Reels'];

const all = await rest('GET', `noticias_concorrentes?rodada=eq.${RODADA}&select=marca,categoria,produtos`);
const by = {}; for (const r of all) (by[r.marca] = by[r.marca] || []).push(r);

const fail = [], warn = [];
for (const marca of ESPERADAS) {
  const rs = by[marca] || [];
  if (!rs.length) { fail.push(`${marca}: AUSENTE na rodada`); continue; }
  const has = c => rs.some(r => r.categoria === c);
  const igN = rs.filter(r => IG_CATS.includes(r.categoria)).length;
  const ehProduto = PRODUTO.includes(marca);
  if (ehProduto) {
    const bs = rs.find(r => r.categoria === 'Best-seller');
    if (!bs || prods(bs).length < 6) fail.push(`${marca}: best-sellers vazios/insuficientes (loja quebrou?)`);
    if (!has('Desenvolvimento')) warn.push(`${marca}: sem hero Desenvolvimento`);
    if (!has('Resumo Comercial')) fail.push(`${marca}: sem Resumo Comercial`);
  }
  if (!has('Resumo Marketing')) fail.push(`${marca}: sem Resumo Marketing`);
  if (igN === 0) fail.push(`${marca}: sem nenhuma galeria de Instagram`);
  else if (igN < 3) warn.push(`${marca}: só ${igN}/3 galerias de Instagram`);
}

const okN = ESPERADAS.length - new Set([...fail, ...warn].map(s => s.split(':')[0])).size;
const status = fail.length ? 'FALHA' : warn.length ? 'AVISO' : 'OK';
const resumo = `Rodada ${RODADA} · ${status} · ${okN}/${ESPERADAS.length} marcas completas · ❌${fail.length} ⚠️${warn.length}`;
const detalhe = [resumo, ...fail.map(s => '❌ ' + s), ...warn.map(s => '⚠️ ' + s)].join('\n');
console.log(detalhe);

try {
  await rest('POST', 'coletor_log', [{ fase: 'verificacao', encontradas: ESPERADAS.length, inseridas: okN, erro: fail.length ? fail.join(' · ').slice(0, 900) : null, detalhe: detalhe.slice(0, 1500) }]);
} catch (e) { console.log('aviso: falha ao logar verificação:', String(e).slice(0, 100)); }

if (fail.length && WEBHOOK) {
  const msg = `⚠️ Observatório (Vessel) — rodada ${RODADA} saiu INCOMPLETA:\n${fail.map(s => '• ' + s).join('\n')}${warn.length ? '\n(avisos: ' + warn.length + ')' : ''}\nRe-disparar o workflow ou checar lojas/Meta/crédito da API.`;
  try { await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg, content: msg }) }); } catch (e) {}
}

if (fail.length) { console.error(`\n✗ Rodada incompleta — ${fail.length} problemas críticos.`); process.exit(1); }
console.log('\n✓ Rodada completa.');
