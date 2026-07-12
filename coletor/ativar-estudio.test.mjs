import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, alvos } from './ativar-estudio.mjs';

test('run() exportada', () => { assert.equal(typeof run, 'function'); });

test('run({dry:true}) não ativa', async () => {
  const r = await run({ adIds: ['a'], adsetIds: ['s'], metaCampaignId: 'c', criouCampanha: true, dry: true });
  assert.equal(r.ativados, 0);
});

test('alvos(): existente = só ads; nova = ads+adsets+campaign', () => {
  assert.deepEqual(alvos({ adIds: ['a1', 'a2'], adsetIds: ['s1'], metaCampaignId: 'c', criouCampanha: false }), ['a1', 'a2']);
  assert.deepEqual(alvos({ adIds: ['a1'], adsetIds: ['s1'], metaCampaignId: 'c', criouCampanha: true }), ['a1', 's1', 'c']);
});
