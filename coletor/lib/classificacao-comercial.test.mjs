import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bcgClass, faixaABC } from './classificacao-comercial.mjs';

test('bcgClass cobre os 4 quadrantes', () => {
  assert.equal(bcgClass({ giro: 10, estoqueLoja: 2, diasSemVender: 1 }), 'Estrela');   // st=0.83
  assert.equal(bcgClass({ giro: 5, estoqueLoja: 12, diasSemVender: 1 }), 'Vaca leiteira'); // st=0.29
  assert.equal(bcgClass({ giro: 0, estoqueLoja: 5, diasSemVender: 10 }), 'Interrogação'); // recente
  assert.equal(bcgClass({ giro: 0, estoqueLoja: 5, diasSemVender: 90 }), 'Abacaxi');
});

test('faixaABC marca A/B/C por faturamento acumulado', () => {
  const r = faixaABC([{ sku: 'x', faturamento: 80 }, { sku: 'y', faturamento: 15 }, { sku: 'z', faturamento: 5 }]);
  assert.equal(r.find((i) => i.sku === 'x').faixa, 'A');
  assert.equal(r.find((i) => i.sku === 'y').faixa, 'B');
  assert.equal(r.find((i) => i.sku === 'z').faixa, 'C');
});
