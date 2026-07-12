import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, resolverLoja, payloadCampanhaAdset } from './subir-estudio.mjs';

const MARCA = { adAccount: 'act_1', pageId: 'P', igId: 'IG' };
const LOJA = { nome: 'Tivoli', whatsapp: '5519...', geoCities: ['1058'] };
const CFG = { DAILY_BUDGET: 5000, DATA: '11-07-2026' };

test('payloadCampanhaAdset: engajamento -> OUTCOME_ENGAGEMENT + CONVERSATIONS + WHATSAPP + promoted whatsapp', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(campaign.objective, 'OUTCOME_ENGAGEMENT');
  assert.equal(campaign.status, 'PAUSED');
  assert.equal(adset.optimization_goal, 'CONVERSATIONS');
  assert.equal(adset.destination_type, 'WHATSAPP');
  assert.deepEqual(adset.promoted_object, { page_id: 'P', whatsapp_phone_number: '5519...' });
  assert.equal(adset.status, 'PAUSED');
});

test('payloadCampanhaAdset: branding -> OUTCOME_AWARENESS + REACH + sem destination_type + sem promoted_object', () => {
  const row = { chave: 'branding', meta_objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH', billing_event: 'IMPRESSIONS', destination_type: null, promoted_object_tipo: 'none' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(campaign.objective, 'OUTCOME_AWARENESS');
  assert.equal(adset.optimization_goal, 'REACH');
  assert.ok(!('destination_type' in adset) || adset.destination_type == null);
  assert.ok(!('promoted_object' in adset) || adset.promoted_object === undefined);
});

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
