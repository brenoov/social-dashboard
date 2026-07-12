import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, resolverLoja } from './subir-estudio.mjs';

test('run() exportada', () => { assert.equal(typeof run, 'function'); });

test('resolverLoja com slug vazio/undefined não casa nenhuma loja (evita fallback silencioso pra 1ª ativa)', () => {
  const lojas = [
    { ativo: true, nome: 'Tivoli' },
    { ativo: true, nome: 'Dom Pedro' },
  ];
  assert.equal(resolverLoja(lojas, ''), undefined);
  assert.equal(resolverLoja(lojas, undefined), undefined);
  assert.equal(resolverLoja(lojas, null), undefined);
  // sanity: slug válido continua casando normalmente
  assert.equal(resolverLoja(lojas, 'tivoli').nome, 'Tivoli');
});

test('run({dry:true}) sem escolhidos retorna adIds vazio', async () => {
  const r = await run({ campanhaId: '00000000-0000-0000-0000-000000000000', destino: { tipo: 'nova', loja: 'tivoli' }, dry: true });
  assert.deepEqual(r.adIds, []);
  assert.equal(r.pendentes, 0);
  assert.equal(r.metaCampaignId, null);
});
