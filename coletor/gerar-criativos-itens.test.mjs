import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candsDeItens } from './gerar-criativos.mjs';

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
