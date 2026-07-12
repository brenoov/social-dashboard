import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './subir-estudio.mjs';

test('run() exportada', () => { assert.equal(typeof run, 'function'); });

test('run({dry:true}) sem escolhidos retorna adIds vazio', async () => {
  const r = await run({ campanhaId: '00000000-0000-0000-0000-000000000000', destino: { tipo: 'nova', loja: 'tivoli' }, dry: true });
  assert.deepEqual(r.adIds, []);
  assert.equal(r.pendentes, 0);
  assert.equal(r.metaCampaignId, null);
});
