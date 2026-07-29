import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPublico, PUBLICO_VAZIO } from './publico-alvo.js';

// Forma real devolvida pela Meta (campos conferidos em coletor/lib/publico.mjs).
const ALVO_META = {
  geo_locations: { cities: [{ key: '1058', name: 'Campinas', radius: 25, distance_unit: 'kilometer' }] },
  excluded_geo_locations: { cities: [{ key: '2777', name: 'Americana' }], regions: [{ key: '456', name: 'Litoral' }] },
  age_min: 25,
  age_max: 45,
  genders: [2],
  flexible_spec: [{ interests: [{ id: '6003', name: 'Moda' }] }],
  custom_audiences: [{ id: 'aud1', name: 'Visitantes do site' }],
  excluded_custom_audiences: [{ id: 'aud2', name: 'Já compraram' }],
  targeting_automation: { advantage_audience: 0 },
  // NÃO gerenciados por este editor — presentes de propósito:
  publisher_platforms: ['facebook', 'instagram'],
  instagram_positions: ['stream', 'story'],
};

test('le todos os campos que o editor gerencia', () => {
  const p = lerPublico(ALVO_META);
  assert.deepEqual(p.cidades, [{ key: '1058', nome: 'Campinas', raio: 25, unidade: 'kilometer' }]);
  assert.equal(p.idadeMin, 25);
  assert.equal(p.idadeMax, 45);
  assert.deepEqual(p.generos, [2]);
  assert.deepEqual(p.interesses, [{ id: '6003', name: 'Moda' }]);
  assert.deepEqual(p.incluir, [{ id: 'aud1', name: 'Visitantes do site' }]);
  assert.deepEqual(p.excluir, [{ id: 'aud2', name: 'Já compraram' }]);
});

test('cidade e regiao excluidas vem separadas por tipo', () => {
  const p = lerPublico(ALVO_META);
  assert.deepEqual(p.excluidas, [
    { key: '2777', nome: 'Americana', tipo: 'cidade' },
    { key: '456', nome: 'Litoral', tipo: 'regiao' },
  ]);
});

test('advantage_audience 0 e desligado; 1 e ausente sao ligado', () => {
  assert.equal(lerPublico({ targeting_automation: { advantage_audience: 0 } }).advantagePlus, false);
  assert.equal(lerPublico({ targeting_automation: { advantage_audience: 1 } }).advantagePlus, true);
  // Ausente = padrão da Meta, que é LIGADO. Assumir desligado faria a tela
  // mentir sobre o estado atual da conta do dono.
  assert.equal(lerPublico({}).advantagePlus, true);
});

test('interesses saem de qualquer entrada do flexible_spec, nao so da primeira', () => {
  const p = lerPublico({ flexible_spec: [
    { behaviors: [{ id: 'b1', name: 'Viajantes' }] },
    { interests: [{ id: '1', name: 'Bolsas' }, { id: '2', name: 'Moda' }] },
  ] });
  assert.deepEqual(p.interesses, [{ id: '1', name: 'Bolsas' }, { id: '2', name: 'Moda' }]);
});

test('publico ausente, vazio ou malformado nao quebra', () => {
  for (const entrada of [null, undefined, {}, { geo_locations: null }, { flexible_spec: 'lixo' }]) {
    const p = lerPublico(entrada);
    assert.deepEqual(p.cidades, []);
    assert.deepEqual(p.interesses, []);
    assert.equal(typeof p.idadeMin, 'number');
  }
});

test('PUBLICO_VAZIO tem a forma completa, sem campo faltando', () => {
  for (const chave of ['cidades','excluidas','idadeMin','idadeMax','generos','interesses','incluir','excluir','advantagePlus'])
    assert.ok(chave in PUBLICO_VAZIO, 'faltou ' + chave);
});

test('null em geo_locations.cities nao quebra, entrada valida ao lado sobrevive', () => {
  const p = lerPublico({ geo_locations: { cities: [null, { key: '123', name: 'Válida' }, null] } });
  assert.deepEqual(p.cidades, [{ key: '123', nome: 'Válida', raio: 0, unidade: 'kilometer' }]);
});

test('null em excluded_geo_locations (cities e regions) nao quebra', () => {
  const p = lerPublico({ excluded_geo_locations: { cities: [null, { key: '1', name: 'São Paulo' }], regions: [{ key: '2', name: 'Valid' }, null] } });
  assert.deepEqual(p.excluidas, [
    { key: '1', nome: 'São Paulo', tipo: 'cidade' },
    { key: '2', nome: 'Valid', tipo: 'regiao' },
  ]);
});

test('null em custom_audiences e excluded_custom_audiences nao quebra', () => {
  const p = lerPublico({ custom_audiences: [null, { id: 'a1', name: 'Aud1' }], excluded_custom_audiences: [{ id: 'a2', name: 'Aud2' }, null] });
  assert.deepEqual(p.incluir, [{ id: 'a1', name: 'Aud1' }]);
  assert.deepEqual(p.excluir, [{ id: 'a2', name: 'Aud2' }]);
});

test('null em flexible_spec nao quebra', () => {
  const p = lerPublico({ flexible_spec: [null, { interests: [null, { id: '1', name: 'Ok' }] }] });
  assert.deepEqual(p.interesses, [{ id: '1', name: 'Ok' }]);
});

test('age_min e age_max invalidos (NaN) recebem os valores padrao', () => {
  const p = lerPublico({ age_min: 'abc', age_max: null });
  assert.equal(p.idadeMin, PUBLICO_VAZIO.idadeMin);
  assert.equal(p.idadeMax, PUBLICO_VAZIO.idadeMax);

  const p2 = lerPublico({ age_min: {}, age_max: 'xyz' });
  assert.equal(p2.idadeMin, PUBLICO_VAZIO.idadeMin);
  assert.equal(p2.idadeMax, PUBLICO_VAZIO.idadeMax);
});
