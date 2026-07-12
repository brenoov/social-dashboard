import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './gerar-criativos.mjs';

test('run() é exportada e aceita opts', () => {
  assert.equal(typeof run, 'function');
});

test('run({dry:true, limite:0}) não lança e retorna shape', async () => {
  const r = await run({ dry: true, limite: 0 });
  assert.ok(r && typeof r === 'object');
  assert.ok('criativos' in r);
});
