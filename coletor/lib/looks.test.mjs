import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarLooks, looksAtivosOrdenados } from './looks.mjs';

test('sincronizarLooks devolve só as chaves faltantes', () => {
  const registry = [{ chave: 'a', nome: 'A', arquetipo: 'produto', objetivos: ['x'] }, { chave: 'b', nome: 'B', arquetipo: 'promo', objetivos: [] }];
  const out = sincronizarLooks(registry, [{ chave: 'a' }]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { chave: 'b', nome: 'B', arquetipo: 'promo', objetivos: [], tipo: 'codigo', ativo: true, ordem: 0 });
});

test('looksAtivosOrdenados: ativo + objetivo + ordem', () => {
  const looks = [
    { chave: 'z', ativo: true, objetivos: ['branding'], ordem: 2 },
    { chave: 'a', ativo: true, objetivos: [], ordem: 1 },            // vazio = todos
    { chave: 'x', ativo: false, objetivos: ['engajamento'], ordem: 0 }, // inativo
    { chave: 'e', ativo: true, objetivos: ['engajamento'], ordem: 3 },
  ];
  assert.deepEqual(looksAtivosOrdenados(looks, 'engajamento'), ['a', 'e']);
  assert.deepEqual(looksAtivosOrdenados(looks, 'branding'), ['a', 'z']);
  // sem objetivo = todos os ativos por ordem
  assert.deepEqual(looksAtivosOrdenados(looks, null), ['a', 'z', 'e']);
});

test('looksAtivosOrdenados: excluído nunca gera (mesmo ativo)', () => {
  const looks = [
    { chave: 'a', ativo: true, objetivos: [], ordem: 1 },
    { chave: 'b', ativo: true, excluido: true, objetivos: [], ordem: 2 }, // excluído da galeria
    { chave: 'c', ativo: true, objetivos: [], ordem: 3 },
  ];
  assert.deepEqual(looksAtivosOrdenados(looks, null), ['a', 'c']);
});
