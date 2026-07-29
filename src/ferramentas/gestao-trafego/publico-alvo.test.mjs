import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPublico, PUBLICO_VAZIO, montarTargeting } from './publico-alvo.js';

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

test('CAMPO DESCONHECIDO SOBREVIVE A IDA E VOLTA — o teste que segura tudo', () => {
  const original = {
    ...ALVO_META,
    device_platforms: ['mobile'],
    locales: [6],
    algo_que_a_meta_inventar_amanha: { seja_o_que_for: true },
  };
  const { targeting } = montarTargeting(lerPublico(original), original);
  assert.deepEqual(targeting.publisher_platforms, ['facebook', 'instagram'],
    'onde o anúncio aparece NÃO pode sumir por editar público');
  assert.deepEqual(targeting.instagram_positions, ['stream', 'story']);
  assert.deepEqual(targeting.device_platforms, ['mobile']);
  assert.deepEqual(targeting.locales, [6]);
  assert.deepEqual(targeting.algo_que_a_meta_inventar_amanha, { seja_o_que_for: true });
});

test('ida e volta sem mexer em nada devolve o mesmo publico', () => {
  const { targeting } = montarTargeting(lerPublico(ALVO_META), ALVO_META);
  const lido = lerPublico(targeting);
  const original = lerPublico(ALVO_META);

  // Nomes de cidades, regiões e públicos são read-only echoes da Meta, não
  // sobrevivem à escrita (publico.mjs:9, 36). Comparar tudo mais — chaves,
  // raios, idades, gêneros, interesses (esses sim viajam), advantage+.
  assert.deepEqual(lido.cidades.map((c) => ({ key: c.key, raio: c.raio, unidade: c.unidade })),
    original.cidades.map((c) => ({ key: c.key, raio: c.raio, unidade: c.unidade })));
  assert.deepEqual(lido.excluidas.map((e) => ({ key: e.key, tipo: e.tipo })),
    original.excluidas.map((e) => ({ key: e.key, tipo: e.tipo })));
  assert.deepEqual(lido.idadeMin, original.idadeMin);
  assert.deepEqual(lido.idadeMax, original.idadeMax);
  assert.deepEqual(lido.generos, original.generos);
  assert.deepEqual(lido.interesses, original.interesses);
  assert.deepEqual(lido.incluir.map((a) => ({ id: a.id })), original.incluir.map((a) => ({ id: a.id })));
  assert.deepEqual(lido.excluir.map((a) => ({ id: a.id })), original.excluir.map((a) => ({ id: a.id })));
  assert.deepEqual(lido.advantagePlus, original.advantagePlus);
});

test('so as chaves gerenciadas mudam', () => {
  const p = lerPublico(ALVO_META);
  p.idadeMin = 30;
  const { targeting } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.age_min, 30);
  for (const k of ['publisher_platforms', 'instagram_positions'])
    assert.deepEqual(targeting[k], ALVO_META[k], k + ' não devia mudar');
});

test('comportamentos no flexible_spec sobrevivem a troca de interesses', () => {
  const original = { flexible_spec: [
    { behaviors: [{ id: 'b1', name: 'Viajantes' }] },
    { interests: [{ id: '1', name: 'Bolsas' }] },
  ] };
  const p = lerPublico(original);
  p.interesses = [{ id: '9', name: 'Sapatos' }];
  const { targeting } = montarTargeting(p, original);
  assert.ok(targeting.flexible_spec.some(g => g.behaviors),
    'comportamento é do mesmo pacote e não pode ser apagado por editar interesse');
  const ints = targeting.flexible_spec.flatMap(g => g.interests || []);
  assert.deepEqual(ints, [{ id: '9', name: 'Sapatos' }]);
});

test('esvaziar um campo REMOVE a chave em vez de mandar lista vazia', () => {
  const p = lerPublico(ALVO_META);
  p.interesses = []; p.incluir = []; p.excluir = []; p.excluidas = []; p.generos = [];
  const { targeting } = montarTargeting(p, ALVO_META);
  for (const k of ['flexible_spec','custom_audiences','excluded_custom_audiences','excluded_geo_locations','genders'])
    assert.ok(!(k in targeting), k + ' vazio deve sair do pacote, não ir como []');
});

test('advantage+ liga e desliga nos dois sentidos', () => {
  const p = lerPublico(ALVO_META);
  p.advantagePlus = true;
  assert.equal(montarTargeting(p, ALVO_META).targeting.targeting_automation.advantage_audience, 1);
  p.advantagePlus = false;
  assert.equal(montarTargeting(p, ALVO_META).targeting.targeting_automation.advantage_audience, 0);
});

test('raio abaixo do minimo e ajustado E RELATADO, nunca em silencio', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 5, unidade: 'kilometer' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.geo_locations.cities[0].radius, 17);
  assert.deepEqual(ajustes, [{ cidade: 'Campinas', de: 5, para: 17, unidade: 'kilometer' }]);
});

test('raio em milhas usa o minimo em milhas', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 3, unidade: 'mile' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.equal(targeting.geo_locations.cities[0].radius, 10);
  assert.equal(ajustes.length, 1);
});

test('raio zero significa a cidade inteira e NAO e ajustado', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [{ key: '1058', nome: 'Campinas', raio: 0, unidade: 'kilometer' }];
  const { targeting, ajustes } = montarTargeting(p, ALVO_META);
  assert.ok(!('radius' in targeting.geo_locations.cities[0]), 'raio 0 = cidade inteira');
  assert.deepEqual(ajustes, []);
});

test('incluir e excluir publico nao se misturam', () => {
  const p = lerPublico(ALVO_META);
  const { targeting } = montarTargeting(p, ALVO_META);
  assert.deepEqual(targeting.custom_audiences, [{ id: 'aud1' }]);
  assert.deepEqual(targeting.excluded_custom_audiences, [{ id: 'aud2' }]);
  assert.ok(!('exclusions' in targeting), 'público em exclusions está descontinuado na Meta');
});

test('sem original (conjunto sem targeting) monta do zero sem quebrar', () => {
  const { targeting } = montarTargeting(PUBLICO_VAZIO, null);
  assert.equal(typeof targeting, 'object');
});

test('publico SEM cidade nenhuma nao restaura as antigas em silencio', () => {
  const p = lerPublico(ALVO_META);
  p.cidades = [];
  const { targeting } = montarTargeting(p, ALVO_META);
  // A Meta exige localização (conjunto não mira em lugar nenhum), mas
  // ressuscitar as cidades antigas caladamente faria a tela mentir: o dono
  // apagou tudo e veria o de antes voltar. Quem barra é o aviso bloqueante
  // da Task 4; aqui a chave simplesmente sai do pacote.
  assert.ok(!('geo_locations' in targeting));
});

test('null em cidades nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [null, { key: '1', nome: 'Válida', raio: 25, unidade: 'kilometer' }, null], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [], interesses: [], incluir: [], excluir: [], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  assert.deepEqual(targeting.geo_locations.cities.length, 1);
  assert.equal(targeting.geo_locations.cities[0].key, '1');
});

test('null em excluidas nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [], excluidas: [null, { key: '1', nome: 'Válida', tipo: 'cidade' }, { key: '2', nome: 'Região', tipo: 'regiao' }, null], idadeMin: 18, idadeMax: 65, generos: [], interesses: [], incluir: [], excluir: [], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  assert.deepEqual(targeting.excluded_geo_locations.cities.length, 1);
  assert.deepEqual(targeting.excluded_geo_locations.regions.length, 1);
});

test('null em interesses nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [], interesses: [null, { id: '1', name: 'Válido' }, null], incluir: [], excluir: [], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  const ints = targeting.flexible_spec.flatMap(g => g.interests || []);
  assert.deepEqual(ints.length, 1);
  assert.equal(ints[0].id, '1');
});

test('null em incluir nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [], interesses: [], incluir: [null, { id: 'a1', name: 'Válido' }, null], excluir: [], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  assert.deepEqual(targeting.custom_audiences.length, 1);
  assert.equal(targeting.custom_audiences[0].id, 'a1');
});

test('null em excluir nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [], interesses: [], incluir: [], excluir: [null, { id: 'a2', name: 'Válido' }, null], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  assert.deepEqual(targeting.excluded_custom_audiences.length, 1);
  assert.equal(targeting.excluded_custom_audiences[0].id, 'a2');
});

test('null em generos nao quebra, entrada valida sobrevive', () => {
  const p = { cidades: [], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [null, 1, null, 2, null], interesses: [], incluir: [], excluir: [], advantagePlus: true };
  const { targeting } = montarTargeting(p, {});
  assert.deepEqual(targeting.genders, [1, 2]);
});

test('excluida sem key (ou malformada) nao quebra, entrada valida sobrevive, nenhuma chave undefined', () => {
  // {} tem tipo undefined; { tipo: 'cidade' } tem key undefined; ambas devem ser saltadas
  const p = {
    cidades: [],
    excluidas: [
      {},
      { key: '1', nome: 'Válida', tipo: 'cidade' },
      { tipo: 'cidade' },
      { key: '2', nome: 'Região', tipo: 'regiao' },
      { tipo: 'regiao' }
    ],
    idadeMin: 18,
    idadeMax: 65,
    generos: [],
    interesses: [],
    incluir: [],
    excluir: [],
    advantagePlus: true
  };
  const { targeting } = montarTargeting(p, {});

  // Entradas válidas sobrevivem
  assert.deepEqual(targeting.excluded_geo_locations.cities.length, 1, 'uma cidade válida');
  assert.equal(targeting.excluded_geo_locations.cities[0].key, '1', 'chave correta da cidade');
  assert.deepEqual(targeting.excluded_geo_locations.regions.length, 1, 'uma região válida');
  assert.equal(targeting.excluded_geo_locations.regions[0].key, '2', 'chave correta da região');

  // Nunca produz chaves undefined ou null
  for (const c of targeting.excluded_geo_locations.cities || [])
    assert.notEqual(c.key, 'undefined', 'nunca escreve key: undefined nas cities');
  for (const r of targeting.excluded_geo_locations.regions || [])
    assert.notEqual(r.key, 'undefined', 'nunca escreve key: undefined nas regions');
});
