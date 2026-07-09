// Testes da lógica pura do job de relatórios comerciais (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { agregarVendas, mesesRange } from './relatorios-comerciais.mjs';

test('agregarVendas: soma unidades/faturamento por SKU e filtra por canal', () => {
  const pedidos = [
    { loja: { id: '205834140' }, itens: [
      { codigo: 'A1', descricao: 'Bolsa Tote', quantidade: 2, valor: 100, produto: { id: '1' } },
      { codigo: 'A1', descricao: 'Bolsa Tote', quantidade: 1, valor: 100, produto: { id: '1' } },
      { codigo: 'B2', descricao: 'Carteira',   quantidade: 3, valor: 50,  produto: { id: '2' } },
    ] },
    // outro canal — deve ser ignorado
    { loja: { id: '999' }, itens: [
      { codigo: 'A1', descricao: 'Bolsa Tote', quantidade: 10, valor: 100, produto: { id: '1' } },
    ] },
  ];
  const m = agregarVendas(pedidos, '205834140');
  assert.equal(Object.keys(m).length, 2);
  assert.equal(m['A1'].unidades, 3);
  assert.equal(m['A1'].faturamento, 300);
  assert.equal(m['A1'].produto, 'Bolsa Tote');
  assert.equal(m['B2'].unidades, 3);
  assert.equal(m['B2'].faturamento, 150);
});

test('agregarVendas: SKU cai no produto.id quando não há codigo', () => {
  const pedidos = [{ loja: { id: '205657609' }, itens: [
    { descricao: 'Sem código', quantidade: 4, valor: 25, produto: { id: '77' } },
  ] }];
  const m = agregarVendas(pedidos, '205657609');
  assert.equal(m['77'].unidades, 4);
  assert.equal(m['77'].faturamento, 100);
});

test('agregarVendas: canal aceita id numérico ou string', () => {
  const pedidos = [{ loja: { id: 205451611 }, itens: [
    { codigo: 'C3', descricao: 'Mochila', quantidade: 1, valor: 200, produto: { id: '9' } },
  ] }];
  assert.equal(agregarVendas(pedidos, '205451611')['C3'].faturamento, 200);
  assert.equal(agregarVendas(pedidos, 205451611)['C3'].faturamento, 200);
});

test('agregarVendas: entradas vazias/robustez', () => {
  assert.deepEqual(agregarVendas([], '1'), {});
  assert.deepEqual(agregarVendas(null, '1'), {});
  assert.deepEqual(agregarVendas([{ loja: { id: '1' } }], '1'), {}); // sem itens
});

test('mesesRange: mês corrente por padrão', () => {
  const r = mesesRange(0, new Date(Date.UTC(2026, 6, 9))); // jul/2026
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { mes: '2026-07-01', ini: '2026-07-01', fim: '2026-07-31' });
});

test('mesesRange: backfill de 3 meses, mais antigo primeiro, cruza ano', () => {
  const r = mesesRange(3, new Date(Date.UTC(2026, 1, 15))); // fev/2026
  assert.equal(r.length, 3);
  assert.deepEqual(r.map(x => x.mes), ['2025-12-01', '2026-01-01', '2026-02-01']);
  assert.equal(r[0].fim, '2025-12-31');
  assert.equal(r[1].fim, '2026-01-31');
  assert.equal(r[2].fim, '2026-02-28'); // 2026 não é bissexto
});
