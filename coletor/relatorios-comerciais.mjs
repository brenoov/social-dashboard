#!/usr/bin/env node
// Job Relatórios Comerciais — pré-agrega vendas por item/mês/canal em
// gc_vendas_item e estoque por depósito foco em gc_estoque_item. Fonte: Bling
// (via bling-proxy, conta de serviço). Idempotente (upsert). Reusa os helpers
// de lib/bling-comercial.mjs (mesma coleta do Gestor).
//
// Uso:
//   node relatorios-comerciais.mjs               # só o mês corrente (roda diário)
//   node relatorios-comerciais.mjs --backfill=12 # os últimos 12 meses (uma vez)
//
// Sem deps externas — fetch nativo (Node 18+).

import './lib/carregar-env.mjs';   // popula process.env do .env ANTES de importar a lib (que lê env no topo)
import { pathToFileURL } from 'node:url';
import {
  loginServico, blingProxy, blingPedidos, blingProdutos, blingSaldoFoco,
  classificarItem, DEP_FOCO,
} from './lib/bling-comercial.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL + '/rest/v1';
const sb = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

// Canais foco (loja.id das vendas no Bling)
const CANAIS = [
  { nome: 'Tivoli',    loja_id: '205834140' },
  { nome: 'Dom Pedro', loja_id: '205657609' },
  { nome: 'Atacado',   loja_id: '205451611' },
];
const CANAL_IDS = new Set(CANAIS.map(c => c.loja_id));

// ── Agregação pura: soma itens dos pedidos DAQUELE canal, por SKU ──
// pedidos: [{ loja:{id}, itens:[{ codigo, descricao, quantidade, valor, produto:{id} }] }]
// Retorna mapa sku → { sku, produto, unidades, faturamento }.
// faturamento = Σ (valor unitário do item × quantidade) — sem rateio de frete/desconto do pedido.
export function agregarVendas(pedidos, canalLojaId) {
  const mapa = {};
  const alvo = String(canalLojaId);
  for (const p of (pedidos || [])) {
    if (String(p?.loja?.id ?? '') !== alvo) continue;
    for (const it of (p.itens || [])) {
      const pid = String(it.produto?.id ?? '');
      const sku = String(it.codigo || pid || '').trim();
      if (!sku) continue;
      const q = Number(it.quantidade) || 0;
      const v = Number(it.valor) || 0;
      if (!mapa[sku]) mapa[sku] = { sku, produto: String(it.descricao || '').slice(0, 120), unidades: 0, faturamento: 0 };
      mapa[sku].unidades += q;
      mapa[sku].faturamento += v * q;
    }
  }
  return mapa;
}

// ── Meses do range: mês corrente, ou os últimos N (inclusive o corrente) ──
// Retorna [{ mes:'YYYY-MM-01', ini:'YYYY-MM-01', fim:'YYYY-MM-DD' }], mais antigo primeiro.
export function mesesRange(backfillN = 0, hoje = new Date()) {
  const n = Math.max(1, backfillN || 1);
  const out = [];
  const y = hoje.getUTCFullYear(), m = hoje.getUTCMonth(); // 0-11
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - k, 1));
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth();
    const p2 = (x) => String(x).padStart(2, '0');
    const ini = `${yy}-${p2(mm + 1)}-01`;
    const ultimo = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    const fim = `${yy}-${p2(mm + 1)}-${p2(ultimo)}`;
    out.push({ mes: ini, ini, fim });
  }
  return out;
}

// ── Supabase REST upsert (service key) ──
async function upsert(table, conflict, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${REST}/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...sb, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!r.ok && ![200, 201, 204].includes(r.status)) {
      throw new Error(`upsert ${table} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
  }
}

// ── Apaga o que DEIXOU de existir no mês ─────────────────────────────────
//
// POR QUE: o upsert só insere e atualiza — nunca remove. Se um pedido saiu de
// setembro para outubro (porque a venda passa a contar no dia da NOTA) e ele era
// a única venda daquele SKU em setembro, o recálculo de setembro simplesmente
// não produz aquela linha... e a linha ANTIGA fica no banco, com o valor velho.
// O SKU passa a aparecer nos dois meses, inflando a Curva ABC e a Matriz BCG.
//
// A regra: quem não foi tocado por ESTA rodada não pertence mais a este mês.
// Por isso o carimbo é enviado explicitamente — é ele que separa "recalculado
// agora" de "sobra de uma rodada antiga".
//
// Apaga DEPOIS de gravar, nunca antes: se a rodada morrer no meio, o mês fica
// com o dado velho (que é ruim) em vez de vazio (que é pior).
async function limparSobrasDoMes(mes, canalLojaId, carimbo) {
  const alvo = `${REST}/gc_vendas_item?mes=eq.${mes}&canal_loja_id=eq.${canalLojaId}` +
               `&atualizado_em=lt.${encodeURIComponent(carimbo)}`;
  const r = await fetch(alvo, { method: 'DELETE', headers: { ...sb, Prefer: 'return=representation' } });
  if (!r.ok) throw new Error(`limpar sobras ${mes}/${canalLojaId} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  const apagadas = await r.json().catch(() => []);
  if (apagadas.length) console.log(`      (${apagadas.length} linha(s) que deixaram de existir neste mês foram removidas)`);
}

async function main() {
  if (!SERVICE_KEY) { console.error('✗ Falta SUPABASE_SERVICE_KEY'); process.exit(1); }
  const bf = Number((process.argv.find(a => a.startsWith('--backfill=')) || '').split('=')[1]) || 0;
  const meses = mesesRange(bf);
  console.log(`→ Relatórios comerciais: ${meses.length} mês(es) [${meses[0].mes}..${meses.at(-1).mes}]`);

  const token = await loginServico();
  // Marca desta rodada: o que ficar com carimbo anterior a isto é sobra.
  const carimbo = new Date().toISOString();

  // ── Vendas por item/mês/canal ──
  for (const { mes, ini, fim } of meses) {
    const pedidos = await blingPedidos(token, ini, fim);
    if (pedidos.length >= 1000) console.warn(`  ⚠ ${mes}: ${pedidos.length} pedidos (limite de paginação atingido — possível truncamento)`);
    const foco = pedidos.filter(p => CANAL_IDS.has(String(p?.loja?.id ?? '')));
    console.log(`  ${mes}: ${pedidos.length} pedidos, ${foco.length} nos canais foco — detalhando itens…`);

    const detalhados = [];
    for (const p of foco) {
      let d;
      try { d = await blingProxy(token, 'pedidos/vendas/' + p.id, {}); }
      catch (e) { console.warn(`    pedido ${p.id} falhou (segue):`, e.message); continue; }
      detalhados.push({ loja: p.loja, itens: d.data?.itens || [] });
    }

    for (const canal of CANAIS) {
      const mapa = agregarVendas(detalhados, canal.loja_id);
      const rows = Object.values(mapa).map(x => ({
        mes, canal_loja_id: Number(canal.loja_id), sku: x.sku, produto: x.produto,
        categoria: classificarItem(x.produto), unidades: Math.round(x.unidades),
        faturamento: Math.round(x.faturamento * 100) / 100,
        // O carimbo vai EXPLÍCITO: o default do banco só vale quando a linha
        // nasce, e o upsert regrava apenas as colunas enviadas. Sem isto, uma
        // linha recalculada hoje continua exibindo a data da primeira vez — foi
        // essa coluna mentindo que me fez achar que set/2025 não tinha sido
        // reprocessado, quando tinha.
        atualizado_em: carimbo,
      }));
      await upsert('gc_vendas_item', 'mes,canal_loja_id,sku', rows);
      // A limpeza só roda se o mês trouxe pedidos. Um mês que volta VAZIO do
      // Bling é muito mais provavelmente um soluço de rede do que um mês sem
      // nenhuma venda — e limpar em cima disso apagaria o mês inteiro.
      if (pedidos.length) await limparSobrasDoMes(mes, canal.loja_id, carimbo);
      const fat = rows.reduce((s, r) => s + r.faturamento, 0);
      console.log(`    ${canal.nome}: ${rows.length} SKUs, R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  }

  // ── Estoque por depósito foco (snapshot atual) ──
  console.log('→ Estoque por depósito foco…');
  const prodMap = await blingProdutos(token);
  const saldoPorDep = await blingSaldoFoco(token, prodMap);
  for (const { deposito_id, canal } of DEP_FOCO) {
    const saldos = saldoPorDep[deposito_id] || {};
    const rows = Object.entries(saldos).map(([pid, saldo]) => {
      const meta = prodMap[pid] || {};
      const nome = meta.nome || '';
      return {
        deposito_id: Number(deposito_id), sku: String(meta.codigo || pid), produto: nome.slice(0, 120),
        categoria: classificarItem(nome), saldo: Math.round(Number(saldo) || 0),
      };
    });
    await upsert('gc_estoque_item', 'deposito_id,sku', rows);
    console.log(`  ${canal}: ${rows.length} SKUs com saldo`);
  }

  console.log('✓ concluído.');
}

// só executa main() quando chamado direto (o teste importa agregarVendas sem rodar a coleta)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
}
