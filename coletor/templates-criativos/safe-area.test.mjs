import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAreaCss, safeAreaTop, SAFE } from './templates.mjs';
import { TEMPLATES } from './templates.mjs';

test('safeAreaCss: story recua mais topo/base que o feed', () => {
  assert.equal(safeAreaCss('1080x1920'), '270px 70px 390px 70px');
  assert.equal(safeAreaCss('1080x1350'), '95px 76px 95px 76px');
  assert.equal(safeAreaCss('desconhecido'), '95px 76px 95px 76px'); // fallback feed
});

test('todo look aplica o safe-area no wrapper (story)', () => {
  const dados = { fotoDataUrl: 'data:,', precoDe: '1', precoPor: '1', parcelas: 10, parcelado: '1', oferta: '50%', nome: 'Bolsa X' };
  const alvo = SAFE['1080x1920'].top + 'px ' + SAFE['1080x1920'].right + 'px ' + SAFE['1080x1920'].bottom + 'px ' + SAFE['1080x1920'].left + 'px';
  for (const chave of Object.keys(TEMPLATES)) {
    const html = TEMPLATES[chave].render(dados, '1080x1920');
    assert.ok(html.includes('padding:' + alvo), `look ${chave} sem safe-area`);
  }
});

test('safeAreaTop retorna só o recuo de topo (story 270 / feed 95)', () => {
  assert.equal(safeAreaTop('1080x1920'), 270);
  assert.equal(safeAreaTop('1080x1350'), 95);
  assert.equal(safeAreaTop('desconhecido'), 95);
});

test('editorial-sale: monograma do painel de imagem sai de baixo da faixa da Meta no story', () => {
  const dados = { fotoDataUrl: 'data:,', precoDe: '1', precoPor: '1', oferta: '50%', nome: 'Bolsa X' };
  // story: max(270, s(78)) = 270 (o monograma recua do topo)
  assert.ok(TEMPLATES['editorial-sale'].render(dados, '1080x1920').includes('padding-top:270px'),
    'editorial-sale story sem recuo de topo no painel de imagem');
  // feed: max(95, round(78*0.76)=59) = 95
  assert.ok(TEMPLATES['editorial-sale'].render(dados, '1080x1350').includes('padding-top:95px'),
    'editorial-sale feed sem recuo de topo no painel de imagem');
});
