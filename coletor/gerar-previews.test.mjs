import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dadosAmostra } from './gerar-previews.mjs';

test('dadosAmostra: cand e campanha de exemplo coerentes (De/Por + pct)', () => {
  const { cand, campanha } = dadosAmostra();
  assert.ok(cand.nome && cand.preco > 0);
  assert.equal(campanha.desconto_pct, 50);
  assert.ok(cand.sku);
});
