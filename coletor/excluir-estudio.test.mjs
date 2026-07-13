import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, alvos } from './excluir-estudio.mjs';

test('alvos: campanha nova -> apaga as campanhas (cascateia conjuntos/ads), não os ads soltos', () => {
  assert.deepEqual(
    alvos({ adIds: ['a1', 'a2'], adsetIds: ['s1'], metaCampaignIds: ['c1', 'c2'], criouCampanha: true }),
    ['c1', 'c2'],
  );
  // retrocompat single
  assert.deepEqual(alvos({ adIds: ['a1'], metaCampaignId: 'c1', criouCampanha: true }), ['c1']);
});

test('alvos: campanha existente -> apaga só os ads desta remessa (preserva a campanha)', () => {
  assert.deepEqual(alvos({ adIds: ['a1', 'a2'], metaCampaignId: 'c1', criouCampanha: false }), ['a1', 'a2']);
});

test('run() dry não toca no Graph', async () => {
  const r = await run({ adIds: ['a1'], metaCampaignIds: ['c1'], criouCampanha: true, dry: true });
  assert.deepEqual(r, { excluidos: 0, total: 0, falhas: [] });
});

test('run() DELETA cada alvo e conta sucessos/falhas (meta injetado)', async () => {
  const chamados = [];
  const metaStub = async (path, _params, method) => {
    chamados.push({ path, method });
    return path === '/c2' ? { status: 400, d: { error: { message: 'x' } } } : { status: 200, d: { success: true } };
  };
  const r = await run({ metaCampaignIds: ['c1', 'c2', 'c3'], criouCampanha: true, meta: metaStub });
  assert.equal(r.total, 3);
  assert.equal(r.excluidos, 2);
  assert.deepEqual(r.falhas, ['c2']);
  assert.deepEqual(chamados.map((c) => c.method), ['DELETE', 'DELETE', 'DELETE']);
});
