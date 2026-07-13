import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTargeting } from './publico.mjs';

const LOJA = { geoCities: ['1058', '2777'] };

test('sem publico = amplo: só as cidades da loja', () => {
  assert.deepEqual(montarTargeting(null, LOJA), { geo_locations: { cities: [{ key: '1058' }, { key: '2777' }] } });
});

test('cidades com raio + unidade', () => {
  const t = montarTargeting({ geo: { cities: [{ key: '1058', radius: 15, distance_unit: 'kilometer' }] } }, LOJA);
  assert.deepEqual(t.geo_locations.cities, [{ key: '1058', radius: 15, distance_unit: 'kilometer' }]);
});

test('geo.cities vazio cai pras cidades da loja', () => {
  const t = montarTargeting({ geo: { cities: [] }, generos: [] }, LOJA);
  assert.deepEqual(t.geo_locations.cities, [{ key: '1058' }, { key: '2777' }]);
});

test('excluidas agrupadas por tipo', () => {
  const t = montarTargeting({ geo: { cities: [{ key: '1058' }], excluded: [{ key: '9', type: 'city' }, { key: 'R', type: 'region' }] } }, LOJA);
  assert.deepEqual(t.excluded_geo_locations, { cities: [{ key: '9' }], regions: [{ key: 'R' }] });
});

test('idade/genero: genders só quando houver', () => {
  const t = montarTargeting({ idade_min: 25, idade_max: 45, generos: [2] }, LOJA);
  assert.equal(t.age_min, 25); assert.equal(t.age_max, 45); assert.deepEqual(t.genders, [2]);
  const t2 = montarTargeting({ generos: [] }, LOJA);
  assert.ok(!('genders' in t2));
});

test('interesses viram flexible_spec; custom_audiences só quando houver', () => {
  const t = montarTargeting({ interesses: [{ id: '6003', name: 'Moda' }], custom_audiences: [{ id: 'A1' }] }, LOJA);
  assert.deepEqual(t.flexible_spec, [{ interests: [{ id: '6003', name: 'Moda' }] }]);
  assert.deepEqual(t.custom_audiences, [{ id: 'A1' }]);
  const t2 = montarTargeting({ interesses: [] }, LOJA);
  assert.ok(!('flexible_spec' in t2)); assert.ok(!('custom_audiences' in t2));
});
