import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemImg } from './foto-produto.mjs';

test('itemImg: usa imagemURL quando presente', () => {
  assert.equal(itemImg({ imagemURL: 'https://x/bag.jpg' }), 'https://x/bag.jpg');
});

test('itemImg: usa a primeira de midia.imagens.internas', () => {
  assert.equal(itemImg({ midia: { imagens: { internas: [{ link: 'https://x/i.jpg' }] } } }), 'https://x/i.jpg');
});

test('itemImg: NÃO usa banner da descrição — sem imagem real de produto retorna vazio (caso Colmar)', () => {
  const p = {
    imagemURL: '',
    midia: { imagens: { externas: [], internas: [], imagensURL: [] } },
    descricaoComplementar: '<img src="https://x/Descricao%2022.png">',
  };
  assert.equal(itemImg(p), '');
});
