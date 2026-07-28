import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AJUDA, ajudaDe } from './ajuda.js';

test('toda entrada tem titulo e texto de verdade', () => {
  for (const [chave, v] of Object.entries(AJUDA)) {
    assert.ok(v.titulo && v.titulo.trim().length > 3, chave + ' sem titulo');
    assert.ok(v.texto && v.texto.trim().length > 80, chave + ' com texto raso');
  }
});

test('as metricas que a tela mostra tem explicacao', () => {
  // Se um destes sumir, alguem tirou a ajuda de um numero que decide verba.
  for (const chave of ['ponto', 'custo_por_ponto', 'qualidade', 'pesos',
    'meta_resultado', 'meta_interacao', 'cores', 'veredito',
    'orcamento_sugerido', 'objetivo_declarado',
    'custo_conversa', 'custo_lead', 'cpm', 'custo_visita']) {
    assert.ok(ajudaDe(chave), 'faltou ajuda para ' + chave);
  }
});

test('chave desconhecida devolve null, nao inventa texto', () => {
  assert.equal(ajudaDe('nao-existe'), null);
  assert.equal(ajudaDe(''), null);
  assert.equal(ajudaDe(undefined), null);
});

test('o texto nao usa jargao de programador', () => {
  // A regra da casa e portugues literal. Estes termos ja apareceram em telas
  // antes e confundiram o dono.
  const proibidos = ['endpoint', 'payload', 'array', 'null', 'undefined', 'query', 'insight'];
  for (const [chave, v] of Object.entries(AJUDA)) {
    const t = (v.titulo + ' ' + v.texto).toLowerCase();
    for (const p of proibidos) {
      assert.ok(!t.includes(p), chave + ' usa jargao: ' + p);
    }
  }
});
