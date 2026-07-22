import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOrcamento, orcamentoMeta } from './orcamento.mjs';

test('normalizarOrcamento: sem config -> ABO/diario/default (retrocompat)', () => {
  assert.deepEqual(normalizarOrcamento(null, 5000), { modo: 'ABO', tipo: 'diario', valor: 5000 });
  assert.deepEqual(normalizarOrcamento(undefined), { modo: 'ABO', tipo: 'diario', valor: 5000 });
});

test('normalizarOrcamento: preenche defaults de campos faltando', () => {
  assert.deepEqual(normalizarOrcamento({ valor: 8000 }, 5000), { modo: 'ABO', tipo: 'diario', valor: 8000 });
});

test('orcamentoMeta ABO diario -> daily_budget no adset, nada na campanha', () => {
  const r = orcamentoMeta({ modo: 'ABO', tipo: 'diario', valor: 7000 }, 5000);
  assert.deepEqual(r, { campaign: {}, adset: { daily_budget: 7000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' } });
});

test('orcamentoMeta ABO total -> lifetime_budget + datas no adset', () => {
  const r = orcamentoMeta({ modo: 'ABO', tipo: 'total', valor: 30000, inicio: '2026-08-01T00:00:00-03:00', fim: '2026-08-15T23:59:59-03:00' }, 5000);
  assert.deepEqual(r, { campaign: {}, adset: { lifetime_budget: 30000, start_time: '2026-08-01T00:00:00-03:00', end_time: '2026-08-15T23:59:59-03:00', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' } });
});

test('orcamentoMeta CBO diario -> daily_budget na campanha, nada no adset', () => {
  const r = orcamentoMeta({ modo: 'CBO', tipo: 'diario', valor: 9000 }, 5000);
  assert.deepEqual(r, { campaign: { daily_budget: 9000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' }, adset: {} });
});

test('orcamentoMeta CBO total -> lifetime_budget na campanha, datas no adset', () => {
  const r = orcamentoMeta({ modo: 'CBO', tipo: 'total', valor: 50000, inicio: 'I', fim: 'F' }, 5000);
  assert.deepEqual(r, { campaign: { lifetime_budget: 50000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' }, adset: { start_time: 'I', end_time: 'F' } });
});

test('orcamentoMeta sem config -> ABO/diario/default (byte-idêntico ao de hoje)', () => {
  assert.deepEqual(orcamentoMeta(null, 5000), { campaign: {}, adset: { daily_budget: 5000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' } });
});
