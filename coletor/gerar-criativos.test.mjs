import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './gerar-criativos.mjs';

test('run() é exportada e aceita opts', () => {
  assert.equal(typeof run, 'function');
});

test('run({dry:true, limite:0}) sem itens/--estrela falha rápido (fabrica_rodadas/candidatos foram dropadas na migration 019)', async () => {
  await assert.rejects(
    () => run({ dry: true, limite: 0 }),
    /forneça itens \(modo Estúdio\) ou --estrela/
  );
});
