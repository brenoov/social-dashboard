import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarSenhaForte } from './senha.js';

test('gerarSenhaForte: comprimento pedido (default 14)', () => {
  assert.equal(gerarSenhaForte().length, 14);
  assert.equal(gerarSenhaForte(20).length, 20);
});

test('gerarSenhaForte: mínimo 6 mesmo pedindo menos', () => {
  assert.equal(gerarSenhaForte(3).length, 6);
});

test('gerarSenhaForte: sem caracteres ambíguos (0 O 1 l I)', () => {
  const s = gerarSenhaForte(200);
  assert.ok(!/[0O1lI]/.test(s), 'não deve conter 0/O/1/l/I');
});

test('gerarSenhaForte: varia entre chamadas', () => {
  assert.notEqual(gerarSenhaForte(14), gerarSenhaForte(14));
});
