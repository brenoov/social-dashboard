import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRegua, metaDoBalde } from './regua.js';
import { PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

test('linha vazia ou nula cai inteira no padrao', () => {
  assert.deepEqual(normalizarRegua(null).pesos, PESOS_PADRAO);
  assert.deepEqual(normalizarRegua(null).limiares, LIMIARES_PADRAO);
  assert.deepEqual(normalizarRegua(undefined).pesos, PESOS_PADRAO);
});

test('preenche so o que faltou, mantendo o que veio do banco', () => {
  const r = normalizarRegua({ pesos: { curtidas: 2 } });
  assert.equal(r.pesos.curtidas, 2, 'respeita o do banco');
  assert.equal(r.pesos.salvamentos, 30, 'completa com o padrao');
});

test('valor invalido (texto, negativo, NaN) cai no padrao daquele campo', () => {
  const r = normalizarRegua({ pesos: { curtidas: 'abc', comentarios: -5 }, limiares: { escalarForte: null } });
  assert.equal(r.pesos.curtidas, 1);
  assert.equal(r.pesos.comentarios, 10);
  assert.equal(r.limiares.escalarForte, 0.8);
});

test('metaDoBalde devolve a meta do balde e cai em padrao quando nao ha', () => {
  const r = normalizarRegua({ metas: { engajamento: 0.15, padrao: 0.3 } });
  assert.equal(metaDoBalde(r, 'engajamento'), 0.15);
  assert.equal(metaDoBalde(r, 'balde-que-nao-existe'), 0.3);
});

test('sem meta nenhuma devolve 0 (que o calculo trata como sem-dados)', () => {
  const r = normalizarRegua({ metas: {} });
  assert.equal(metaDoBalde(r, 'engajamento'), 0);
});

test('metaDoBalde coerce string da meta solicitada pra number', () => {
  const r = { metas: { engajamento: '5' } };
  const resultado = metaDoBalde(r, 'engajamento');
  assert.equal(typeof resultado, 'number', 'deve ser number, não string');
  assert.equal(resultado, 5, 'deve coercir "5" pro número 5');
});

test('metaDoBalde coerce string do padrao quando a meta solicitada nao existe', () => {
  const r = { metas: { padrao: '10' } };
  const resultado = metaDoBalde(r, 'curtidas');
  assert.equal(typeof resultado, 'number', 'deve ser number, não string');
  assert.equal(resultado, 10, 'deve coercir "10" pro número 10');
});

test('metaDoBalde passa numero real direto e devolve como number', () => {
  const r = { metas: { engajamento: 7.5 } };
  const resultado = metaDoBalde(r, 'engajamento');
  assert.equal(typeof resultado, 'number', 'deve ser number');
  assert.equal(resultado, 7.5, 'deve preservar o valor');
});

test('metaDoBalde sem nenhuma meta devolve 0 como number', () => {
  const r = { metas: {} };
  const resultado = metaDoBalde(r, 'engajamento');
  assert.equal(typeof resultado, 'number', 'deve ser number');
  assert.equal(resultado, 0, 'deve ser 0');
});
