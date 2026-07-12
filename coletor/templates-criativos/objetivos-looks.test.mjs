import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, objetivosDoTemplate } from './templates.mjs';

test('looks de branding existem e estão etiquetados', () => {
  assert.ok(TEMPLATES['marca-lifestyle'], 'marca-lifestyle existe');
  assert.ok(TEMPLATES['marca-editorial'], 'marca-editorial existe');
  assert.deepEqual(objetivosDoTemplate('marca-lifestyle'), ['branding']);
  assert.deepEqual(objetivosDoTemplate('marca-editorial'), ['branding']);
});

test('um look de preço serve conversão/engajamento e NÃO branding', () => {
  const objs = objetivosDoTemplate('produto-heroi');
  assert.ok(objs.includes('engajamento'));
  assert.ok(!objs.includes('branding'));
});

test('objetivosDoTemplate default [] p/ template sem etiqueta', () => {
  assert.deepEqual(objetivosDoTemplate('__inexistente__'), []);
});

test('render dos looks de branding não contém "50%" nem "POR R$"', () => {
  const dados = { nome: 'Bolsa Cambridge', marca: 'La Vessel', fotoDataUrl: '', cidade: 'Campinas' };
  for (const chave of ['marca-lifestyle', 'marca-editorial']) {
    const html = TEMPLATES[chave].render(dados, '1080x1350');
    assert.ok(!/50%|POR R\$|DE R\$/i.test(html), `${chave} não deve ter preço/oferta`);
  }
});
