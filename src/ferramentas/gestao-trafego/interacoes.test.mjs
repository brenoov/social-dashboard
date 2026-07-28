import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERACOES, interacaoValida, custoDaInteracao } from './interacoes.js';

const q = { curtidas: 100, comentarios: 2, salvamentos: 5, compartilhamentos: 10, gasto: 200 };

test('as quatro interacoes tem rotulo proprio para a tela', () => {
  assert.deepEqual(Object.keys(INTERACOES).sort(),
    ['comentarios', 'compartilhamentos', 'curtidas', 'salvamentos']);
  for (const [k, i] of Object.entries(INTERACOES)) {
    assert.ok(i.rotulo && i.rotuloCusto && i.ajuda, k + ' incompleta');
  }
});

test('custo da interacao = gasto dividido pela quantidade dela', () => {
  assert.equal(custoDaInteracao(q, 'curtidas'), 2);
  assert.equal(custoDaInteracao(q, 'salvamentos'), 40);
  assert.equal(custoDaInteracao(q, 'compartilhamentos'), 20);
  assert.equal(custoDaInteracao(q, 'comentarios'), 100);
});

test('quantidade zero nao vira R$ 0,00 — devolve null (sem dados)', () => {
  assert.equal(custoDaInteracao({ curtidas: 0, gasto: 100 }, 'curtidas'), null);
  assert.equal(custoDaInteracao({ gasto: 100 }, 'salvamentos'), null);
});

test('interacao desconhecida nao inventa numero', () => {
  assert.equal(custoDaInteracao(q, 'republicacoes'), null);
  assert.equal(custoDaInteracao(q, undefined), null);
  assert.equal(interacaoValida('curtidas'), true);
  assert.equal(interacaoValida('republicacoes'), false);
  assert.equal(interacaoValida(null), false);
});

test('sem gasto informado nao inventa custo: devolve null (sem dados)', () => {
  // Regra da casa: dado ausente e "nao sei", nunca zero. Dizer que custou R$ 0,00
  // seria afirmar algo falso num numero que decide verba.
  assert.equal(custoDaInteracao({ curtidas: 10 }, 'curtidas'), null);
});

test('gasto ZERO com interacao e custo zero de verdade (veio de graca)', () => {
  // Aqui o gasto foi informado e vale 0 — diferente de nao ter vindo.
  assert.equal(custoDaInteracao({ curtidas: 10, gasto: 0 }, 'curtidas'), 0);
});
