import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorLojaEPares } from './curar-agrupar.js';

const lojas = [{ deposito_id: 'dT', nome: 'Tivoli' }, { deposito_id: 'dP', nome: 'Dom Pedro' }];
const cri = (id, sku, variante, formato) => ({ id, url: id + '.png', sku, variante, formato, escolhido: false, purgado_em: null });

test('agrupa por loja e pareia feed/story por variante', () => {
  const criativos = [
    cri('1', 'LV1', 'produto-heroi-avista', '1080x1350'),
    cri('2', 'LV1', 'produto-heroi-avista', '1080x1920'),
  ];
  const itens = [{ sku: 'LV1', deposito: 'dT', pct: 20 }];
  const r = agruparPorLojaEPares(criativos, itens, lojas);
  assert.equal(r.length, 1);
  assert.equal(r[0].loja, 'Tivoli');
  assert.equal(r[0].pares.length, 1);
  assert.equal(r[0].pares[0].feed.id, '1');
  assert.equal(r[0].pares[0].story.id, '2');
});

test('SKU em 2 lojas aparece nas 2 seções', () => {
  const criativos = [cri('1', 'LV1', 'v', '1080x1350')];
  const itens = [{ sku: 'LV1', deposito: 'dT' }, { sku: 'LV1', deposito: 'dP' }];
  const r = agruparPorLojaEPares(criativos, itens, lojas);
  assert.deepEqual(r.map((s) => s.loja).sort(), ['Dom Pedro', 'Tivoli']);
});

test('itens lista os 4 formatos por (sku,variante), na ordem canônica', () => {
  const criativos = [
    cri('a', 'LV1', 'hero-ia-desconto', '1920x1080'), // 16:9 (chega 1º, mas vai por último)
    cri('b', 'LV1', 'hero-ia-desconto', '1080x1080'), // 1:1
    cri('c', 'LV1', 'hero-ia-desconto', '1080x1350'), // 4:5
    cri('d', 'LV1', 'hero-ia-desconto', '1080x1920'), // 9:16
  ];
  const r = agruparPorLojaEPares(criativos, [{ sku: 'LV1', deposito: 'dT' }], lojas);
  const par = r[0].pares[0];
  assert.equal(par.itens.length, 4);
  assert.deepEqual(par.itens.map((i) => i.formato), ['1080x1350', '1080x1920', '1080x1080', '1920x1080']);
  assert.deepEqual(par.itens.map((i) => i.label), ['Feed 4:5', 'Story 9:16', 'Feed 1:1', 'YouTube 16:9']);
});

test('sku null ou sem match vai pra Outros', () => {
  const criativos = [cri('1', null, 'v', '1080x1350'), cri('2', 'ZZZ', 'v', '1080x1350')];
  const r = agruparPorLojaEPares(criativos, [{ sku: 'LV1', deposito: 'dT' }], lojas);
  const outros = r.find((s) => s.loja === 'Outros');
  assert.ok(outros);
  assert.equal(outros.pares.length, 2);
});
