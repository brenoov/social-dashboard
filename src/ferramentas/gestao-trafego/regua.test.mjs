import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRegua, metaDoBalde } from './regua.js';
import { PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

test('linha vazia ou nula cai inteira no padrao', () => {
  assert.deepEqual(normalizarRegua(null).pesos, PESOS_PADRAO);
  assert.deepEqual(normalizarRegua(null).limiares, LIMIARES_PADRAO);
  assert.deepEqual(normalizarRegua(null).limiares_resultado, LIMIARES_PADRAO);
  assert.deepEqual(normalizarRegua(undefined).pesos, PESOS_PADRAO);
});

test('limiares_resultado (Seção 2) preenche so o que faltou, mantendo o que veio do banco', () => {
  const r = normalizarRegua({ limiares_resultado: { escalarForte: 0.9 } });
  assert.equal(r.limiares_resultado.escalarForte, 0.9, 'respeita o do banco');
  assert.equal(r.limiares_resultado.dentroMeta, 1.0, 'completa com o padrao');
  assert.equal(r.limiares_resultado.manter, 1.3, 'completa com o padrao');
});

test('limiares_resultado com valor invalido (texto, negativo, NaN) cai no padrao daquele campo', () => {
  const r = normalizarRegua({ limiares_resultado: { escalarForte: 'abc', dentroMeta: -1, manter: null } });
  assert.equal(r.limiares_resultado.escalarForte, 0.8);
  assert.equal(r.limiares_resultado.dentroMeta, 1.0);
  assert.equal(r.limiares_resultado.manter, 1.3);
});

test('os dois conjuntos de limiar sao INDEPENDENTES: mudar um nao mexe no outro', () => {
  const r = normalizarRegua({ limiares: { escalarForte: 0.8 }, limiares_resultado: { escalarForte: 0.9 } });
  assert.equal(r.limiares.escalarForte, 0.8, 'Seção 1 (ponto/interação) fica no dela');
  assert.equal(r.limiares_resultado.escalarForte, 0.9, 'Seção 2 (resultado) fica no dela, sem herdar da 1');
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

test('metaDoBalde devolve a meta do PROPRIO balde, nunca a de outro', () => {
  const r = normalizarRegua({ metas: { engajamento: 0.15, trafego: 0.25 } });
  assert.equal(metaDoBalde(r, 'engajamento'), 0.15);
  assert.equal(metaDoBalde(r, 'trafego'), 0.25);
  assert.equal(metaDoBalde(r, 'balde-que-nao-existe'), 0, 'balde sem meta propria devolve 0, nunca empresta de outro');
});

test('sem meta nenhuma devolve 0 (que o calculo trata como sem-dados)', () => {
  const r = normalizarRegua({ metas: {} });
  assert.equal(metaDoBalde(r, 'engajamento'), 0);
});

test('nao existe mais reserva em "padrao": cada balde tem sua propria unidade (I4 do review final, 2026-07-28)', () => {
  assert.equal(metaDoBalde({ metas: { padrao: 0.2 } }, 'vendas'), 0, 'padrao nao pode virar meta de vendas (unidades diferentes)');
  assert.equal(metaDoBalde({ metas: { padrao: 0.2 } }, 'leads'), 0);
  assert.equal(metaDoBalde({ metas: { padrao: 0.2 } }, 'reconhecimento'), 0);
});

test('metaDoBalde coerce string da meta solicitada pra number', () => {
  const r = { metas: { engajamento: '5' } };
  const resultado = metaDoBalde(r, 'engajamento');
  assert.equal(typeof resultado, 'number', 'deve ser number, não string');
  assert.equal(resultado, 5, 'deve coercir "5" pro número 5');
});

test('metaDoBalde NAO usa "padrao" quando a meta solicitada nao existe (devolve 0)', () => {
  const r = { metas: { padrao: '10' } };
  const resultado = metaDoBalde(r, 'curtidas');
  assert.equal(typeof resultado, 'number', 'deve ser number, não string');
  assert.equal(resultado, 0, 'padrao nao serve de reserva; deve devolver 0');
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
