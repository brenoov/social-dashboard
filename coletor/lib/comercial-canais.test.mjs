// coletor/lib/comercial-canais.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANAIS, realPorCanalDe, canaisFocoDe } from './comercial-canais.mjs';

test('realPorCanalDe soma o total só dos canais foco (ignora outras lojas)', () => {
  const pedidos = [
    { loja: { id: 205834140 }, total: '100.50' }, // Tivoli
    { loja: { id: 205834140 }, total: 49.5 },      // Tivoli
    { loja: { id: 205657609 }, total: '200' },     // Dom Pedro
    { loja: { id: 999999999 }, total: '999' },     // fora dos canais foco → ignora
    { loja: null, total: '50' },                    // sem loja → ignora
  ];
  const r = realPorCanalDe(pedidos);
  assert.equal(r['205834140'], 150);
  assert.equal(r['205657609'], 200);
  assert.equal(r['205451611'], 0); // canal foco sem pedidos zera
  assert.ok(!('999999999' in r));  // loja fora dos canais foco não entra
});

test('realPorCanalDe zera todos os canais quando não há pedidos', () => {
  const r = realPorCanalDe([]);
  for (const c of CANAIS) assert.equal(r[c.loja_id], 0);
});

test('canaisFocoDe casa cada canal com sua meta e devolve os números do metaPace', () => {
  const realPorCanal = { '205834140': 12000, '205657609': 0, '205451611': 5000 };
  const metas = [
    { loja_id: '205834140', meta_valor: 30000, daily_goals: null },
    // Dom Pedro sem meta cadastrada → metaValor 0, percentMeta 0
    { loja_id: '205451611', meta_valor: 10000, daily_goals: null },
  ];
  const out = canaisFocoDe({ metas, realPorCanal, diaDoMes: 10, diasNoMes: 30 });
  assert.equal(out.length, 3);
  // ordem e nomes seguem CANAIS
  assert.deepEqual(out.map(c => c.canal), CANAIS.map(c => c.nome));
  const tivoli = out.find(c => c.canal === CANAIS[0].nome);
  assert.equal(tivoli.realizado, 12000);
  assert.equal(tivoli.metaValor, 30000);
  assert.equal(tivoli.percentMeta, 40);
  assert.equal(tivoli.projecaoFechamento, 36000);
  assert.equal(tivoli.status, 'adiantado'); // esperado linear até dia 10 = 10000
  const domPedro = out.find(c => c.canal === CANAIS[1].nome);
  assert.equal(domPedro.metaValor, 0);
  assert.equal(domPedro.percentMeta, 0);
});
