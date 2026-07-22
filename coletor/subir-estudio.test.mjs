import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, resolverLoja, payloadCampanhaAdset, lojasDoDestino } from './subir-estudio.mjs';

test('lojasDoDestino: normaliza p/ [{slug, publico, orcamento}] (público por loja)', () => {
  // slugs (retrocompat) + público único da campanha
  assert.deepEqual(lojasDoDestino({ lojas: ['tivoli', 'dp'], publico: { g: 1 } }),
    [{ slug: 'tivoli', publico: { g: 1 }, orcamento: null }, { slug: 'dp', publico: { g: 1 }, orcamento: null }]);
  // público POR loja
  assert.deepEqual(lojasDoDestino({ lojas: [{ slug: 'tivoli', publico: { a: 1 } }, { slug: 'dp', publico: { b: 2 } }] }),
    [{ slug: 'tivoli', publico: { a: 1 }, orcamento: null }, { slug: 'dp', publico: { b: 2 }, orcamento: null }]);
  // single retrocompat
  assert.deepEqual(lojasDoDestino({ loja: 'tivoli' }), [{ slug: 'tivoli', publico: null, orcamento: null }]);
  assert.deepEqual(lojasDoDestino({}), []);
  assert.deepEqual(lojasDoDestino(null), []);
});

const MARCA = { adAccount: 'act_1', pageId: 'P', igId: 'IG' };
const LOJA = { nome: 'Tivoli', whatsapp: '5519...', geoCities: ['1058'] };
const CFG = { DAILY_BUDGET: 5000, DATA: '11-07-2026' };

test('nomes legíveis: campanha "Bolsas · loja · objetivo · dd/mm/aaaa", conjunto "loja · objetivo"', () => {
  const row = { chave: 'engajamento', rotulo: 'Engajamento (WhatsApp)', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, { DAILY_BUDGET: 5000, DATA: '11-07-2026' });
  assert.equal(campaign.name, 'Bolsas · Tivoli · Engajamento (WhatsApp) · 11/07/2026');
  assert.equal(adset.name, 'Tivoli · Engajamento (WhatsApp)');
  // sem rótulo cai na chave (retrocompat)
  const { campaign: c2 } = payloadCampanhaAdset({ ...row, rotulo: null }, MARCA, LOJA, { DAILY_BUDGET: 5000, DATA: '01-01-2026' });
  assert.equal(c2.name, 'Bolsas · Tivoli · engajamento · 01/01/2026');
});

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

test('payloadCampanhaAdset aplica o publico no targeting (cidades+raio+interesses)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const marca = { adAccount: 'act_1', pageId: 'P', igId: 'IG' };
  const loja = { nome: 'Tivoli', whatsapp: '55', geoCities: ['1058'] };
  const publico = { geo: { cities: [{ key: '1058', radius: 15, distance_unit: 'kilometer' }] }, interesses: [{ id: '6003', name: 'Moda' }], generos: [2], idade_min: 25, idade_max: 45 };
  const { adset } = payloadCampanhaAdset(row, marca, loja, { DAILY_BUDGET: 5000, DATA: 'X' }, publico);
  // SP-4 fix: montarTargeting faz clamp do raio pro mínimo do Meta (15 -> 17km)
  assert.deepEqual(adset.targeting.geo_locations.cities, [{ key: '1058', radius: 17, distance_unit: 'kilometer' }]);
  assert.deepEqual(adset.targeting.flexible_spec, [{ interests: [{ id: '6003', name: 'Moda' }] }]);
  assert.equal(adset.targeting.age_min, 25);
});

test('payloadCampanhaAdset sem publico mantém geo da loja (retrocompat)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { adset } = payloadCampanhaAdset(row, { adAccount: 'act_1', pageId: 'P' }, { nome: 'T', whatsapp: '55', geoCities: ['1058'] }, { DAILY_BUDGET: 5000, DATA: 'X' });
  assert.deepEqual(adset.targeting, { geo_locations: { cities: [{ key: '1058' }] } });
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

test('lojasDoDestino inclui orcamento por loja (default null)', () => {
  assert.deepEqual(
    lojasDoDestino({ lojas: [{ slug: 'tivoli', publico: { a: 1 }, orcamento: { modo: 'CBO', tipo: 'diario', valor: 9000 } }] }),
    [{ slug: 'tivoli', publico: { a: 1 }, orcamento: { modo: 'CBO', tipo: 'diario', valor: 9000 } }]);
  // slugs (retrocompat): orcamento null
  assert.deepEqual(lojasDoDestino({ lojas: ['dp'] }), [{ slug: 'dp', publico: null, orcamento: null }]);
});

test('payloadCampanhaAdset sem orcamento = ABO diario DAILY_BUDGET (retrocompat byte-idêntico)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(adset.daily_budget, 5000);
  assert.ok(!('lifetime_budget' in adset));
  assert.ok(!('daily_budget' in campaign));
  assert.equal(campaign.is_adset_budget_sharing_enabled, false);
});

test('payloadCampanhaAdset CBO diario -> budget na campanha, adset sem budget', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG, null, { modo: 'CBO', tipo: 'diario', valor: 12000 });
  assert.equal(campaign.daily_budget, 12000);
  assert.ok(!('daily_budget' in adset));
});

test('payloadCampanhaAdset ABO total -> lifetime + datas no adset', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG, null, { modo: 'ABO', tipo: 'total', valor: 30000, inicio: 'I', fim: 'F' });
  assert.equal(adset.lifetime_budget, 30000);
  assert.equal(adset.start_time, 'I');
  assert.equal(adset.end_time, 'F');
  assert.ok(!('daily_budget' in adset));
  assert.ok(!('lifetime_budget' in campaign));
});
