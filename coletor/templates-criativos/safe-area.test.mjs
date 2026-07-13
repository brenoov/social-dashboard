import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAreaCss, SAFE } from './templates.mjs';
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
