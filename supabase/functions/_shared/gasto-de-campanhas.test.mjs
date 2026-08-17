import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somarGasto } from './gasto-de-campanhas.js';

// Resposta real de act_X/insights com level=campaign: uma linha por campanha,
// `spend` em TEXTO.
//
// A campanha 1 usa um id com menos dígitos do que o formato real de 18 dígitos
// da Meta DE PROPÓSITO: um id de 18 dígitos escrito como literal numérico do JS
// (o caso do teste "id number bate com id text" logo abaixo) já perde precisão
// na hora em que o PRÓPRIO ARQUIVO DE TESTE é interpretado — antes de qualquer
// linha do módulo rodar (120249301837840342 vira 120249301837840340 só de
// escrever o número no código-fonte; Number.MAX_SAFE_INTEGER tem 16 dígitos).
// Isso não é um bug de somarGasto: é a prova de que um id de campanha da Meta
// JAMAIS pode viajar como Number em nenhum ponto do caminho, só como texto.
const resposta = { data: [
  { campaign_id: '12024930183784', spend: '461.52' },
  { campaign_id: '120230000000000001', spend: '2254.02' },
  { campaign_id: '120230000000000002', spend: '168.90' },
] };

test('sem ids, soma tudo', () => {
  assert.equal(somarGasto(resposta, null).toFixed(2), '2884.44');
  assert.equal(somarGasto(resposta, []).toFixed(2), '2884.44');
});

test('com ids, soma só as escolhidas', () => {
  assert.equal(somarGasto(resposta, ['12024930183784', '120230000000000002']).toFixed(2), '630.42');
});

test('id que não veio na resposta não inventa gasto', () => {
  assert.equal(somarGasto(resposta, ['999']), 0);
});

test('id number bate com id text — o PostgREST devolve texto, a Meta também', () => {
  assert.equal(somarGasto(resposta, [12024930183784]).toFixed(2), '461.52');
});

test('resposta vazia ou quebrada vira zero, nunca erro', () => {
  assert.equal(somarGasto({}, ['1']), 0);
  assert.equal(somarGasto(null, ['1']), 0);
  assert.equal(somarGasto({ data: [] }, null), 0);
  assert.equal(somarGasto({ data: [{ campaign_id: '1', spend: 'xis' }] }, null), 0);
});
