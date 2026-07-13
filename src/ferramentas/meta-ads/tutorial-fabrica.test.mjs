import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximoPassoPendente, CHECKLIST } from './tutorial-fabrica.js';

test('proximoPassoPendente devolve o 1º id não concluído', () => {
  const cl = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(proximoPassoPendente(['a'], cl).id, 'b');
  assert.equal(proximoPassoPendente([], cl).id, 'a');
  assert.equal(proximoPassoPendente(['a', 'b', 'c'], cl), null);
});

test('CHECKLIST tem 5 itens com id/rota', () => {
  assert.equal(CHECKLIST.length, 5);
  for (const i of CHECKLIST) { assert.ok(i.id && i.titulo && i.rota); }
});
