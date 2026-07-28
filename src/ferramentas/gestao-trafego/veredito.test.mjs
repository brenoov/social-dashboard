import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirVeredito } from './veredito.js';

test('saude mandando pausar VETA tudo, por mais barato que esteja', () => {
  const r = decidirVeredito({
    saude: { veredito: 'pausar', justificativa: 'Frequência 5,2× — criativo com fadiga.' },
    opus: { veredito: 'escalar', justificativa: 'performance boa' },
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'pausar');
  assert.equal(r.origem, 'saude');
  assert.match(r.porque, /fadiga/);
});

test('saude ok e Opus presente: vale o Opus', () => {
  const r = decidirVeredito({
    saude: { veredito: 'manter', justificativa: 'sem sinal de fadiga' },
    opus: { veredito: 'reduzir', justificativa: 'CPA subindo há 3 dias' },
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'reduzir');
  assert.equal(r.origem, 'opus');
});

test('saude ok e SEM Opus: vale a ponderada', () => {
  const r = decidirVeredito({
    saude: { veredito: 'manter', justificativa: '' },
    opus: null,
    ponderada: { faixa: 'escalar-forte', custoPorPonto: 0.05, meta: 0.2 },
  });
  assert.equal(r.veredito, 'escalar');
  assert.equal(r.origem, 'ponderada');
  assert.match(r.porque, /0,05/);
  assert.match(r.porque, /0,20/);
});

test('cada faixa da ponderada vira o veredito certo', () => {
  const de = (faixa) => decidirVeredito({ saude: null, opus: null, ponderada: { faixa, custoPorPonto: 1, meta: 1 } }).veredito;
  assert.equal(de('escalar-forte'), 'escalar');
  assert.equal(de('dentro-da-meta'), 'escalar');
  assert.equal(de('manter'), 'manter');
  assert.equal(de('otimizar'), 'otimizar');
});

test('nada decidivel: sem-dados, nunca um palpite', () => {
  const r = decidirVeredito({ saude: null, opus: null, ponderada: { faixa: 'sem-dados' } });
  assert.equal(r.veredito, 'sem-dados');
  assert.equal(r.origem, 'nenhuma');
});

test('ponderada ausente por completo tambem da sem-dados', () => {
  assert.equal(decidirVeredito({}).veredito, 'sem-dados');
});

test('ponderada sem-dados mas saude presente com veredito: vale a saude (volume baixo)', () => {
  const r = decidirVeredito({
    saude: { veredito: 'manter', justificativa: 'Volume baixo, sem recomendação confiável ainda.' },
    opus: null,
    ponderada: { faixa: 'sem-dados' },
  });
  assert.equal(r.veredito, 'manter');
  assert.equal(r.origem, 'saude');
  assert.match(r.porque, /Volume baixo/);
});

test('nada em lugar nenhum (nem ponderada, nem saude, nem opus): sem-dados/nenhuma', () => {
  const r = decidirVeredito({ saude: null, opus: null, ponderada: null });
  assert.equal(r.veredito, 'sem-dados');
  assert.equal(r.origem, 'nenhuma');
});

test('faixa reconhecida mas custoPorPonto ausente: nunca mostra R$ NaN', () => {
  const r = decidirVeredito({
    saude: null,
    opus: null,
    ponderada: { faixa: 'escalar-forte', meta: 0.2 },
  });
  assert.equal(r.veredito, 'escalar');
  assert.equal(r.origem, 'ponderada');
  assert.doesNotMatch(r.porque, /NaN/);
  assert.doesNotMatch(r.porque, /undefined/);
  assert.match(r.porque, /Barato por ponto/);
});

test('faixa reconhecida mas meta ausente: nunca mostra R$ NaN', () => {
  const r = decidirVeredito({
    saude: null,
    opus: null,
    ponderada: { faixa: 'manter', custoPorPonto: 0.3 },
  });
  assert.equal(r.veredito, 'manter');
  assert.equal(r.origem, 'ponderada');
  assert.doesNotMatch(r.porque, /NaN/);
  assert.doesNotMatch(r.porque, /undefined/);
  assert.match(r.porque, /acima da meta/);
});
