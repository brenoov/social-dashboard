import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candsDeItens, linhaCriativoProduto, filtraLooksModelo } from './gerar-criativos.mjs';

test('candsDeItens resolve preço via mapa e mantém pct/deposito por item', () => {
  const r = candsDeItens(
    [{ sku: 'ABC', deposito: 'd1', pct: 30 }, { sku: 'XYZ', deposito: 'd2', pct: 50 }],
    { ABC: 449.9, XYZ: 200 });
  assert.equal(r.length, 2);
  assert.deepEqual({ sku: r[0].sku, preco: r[0].preco, deposito_id: r[0].deposito_id, pct: r[0].pct, id: r[0].id },
    { sku: 'ABC', preco: 449.9, deposito_id: 'd1', pct: 30, id: null });
});

test('candsDeItens pula item sem preço', () => {
  assert.equal(candsDeItens([{ sku: 'NOPE', deposito: 'd1', pct: 10 }], {}).length, 0);
});

test('candsDeItens usa o nome descritivo do Bling (p/ a IA extrair a cidade), não o SKU', () => {
  const r = candsDeItens(
    [{ sku: 'LV1159-Panacota', deposito: 'd1', pct: 20 }],
    { 'LV1159-PANACOTA': 449.9 },
    { 'LV1159-PANACOTA': 'Bolsa Executiva Grande Pisa Panacota' });
  assert.equal(r[0].nome, 'Bolsa Executiva Grande Pisa Panacota');
});

test('candsDeItens cai no SKU quando não há nome no mapa (fallback seguro)', () => {
  const r = candsDeItens([{ sku: 'ABC', deposito: 'd1', pct: 30 }], { ABC: 10 }, {});
  assert.equal(r[0].nome, 'ABC');
});

test('filtraLooksModelo: sem foto de modelo remove produto-modelo; com foto mantém tudo', () => {
  const looks = ['produto-heroi', 'produto-modelo', 'produto-split'];
  assert.deepEqual(filtraLooksModelo(looks, false), ['produto-heroi', 'produto-split']);
  assert.deepEqual(filtraLooksModelo(looks, true), looks);
});

test('linhaCriativoProduto inclui o sku do candidato', () => {
  const row = linhaCriativoProduto({
    campanhaId: 'c1',
    cand: { sku: 'LV1159-Panacota' },
    v: { template: 'produto-heroi', formato: '1080x1350', variante: 'produto-heroi-avista', preco_de: 449.9, preco_por: 359.92 },
    url: 'https://x/y.png',
    legenda: 'compre',
  });
  assert.equal(row.sku, 'LV1159-Panacota');
  assert.equal(row.campanha_id, 'c1');
  assert.equal(row.template, 'produto-heroi');
  assert.equal(row.storage_path, undefined); // storage_path é montado no run(), não aqui
});
