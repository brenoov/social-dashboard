import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPublico, PUBLICO_VAZIO, montarTargeting, resumoDasMudancas, avisosDe } from './publico-alvo.js';

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

// Públicos dos testes de Advantage+ precisam de uma localização para isolar o
// comportamento do Advantage+ da regra de localização (que bloqueia sem cidades).
// Sem isso, testes medem duas coisas ao mesmo tempo.
const COM_CIDADE = { ...PUBLICO_VAZIO, cidades: [{ key: '1058', nome: 'Campinas', raio: 0, unidade: 'kilometer' }] };

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

test('sem mudanca, resumo vazio', () => {
  assert.deepEqual(resumoDasMudancas(lerPublico(ALVO_META), lerPublico(ALVO_META)), []);
});

test('cidade entrando e saindo aparecem com nome, nao com codigo', () => {
  const antes = lerPublico(ALVO_META);
  const depois = lerPublico(ALVO_META);
  depois.cidades = [{ key: '999', nome: 'Piracicaba', raio: 0, unidade: 'kilometer' }];
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /Piracicaba/);
  assert.match(r, /Campinas/);
  assert.ok(!/1058|999/.test(r), 'o dono não entende código de cidade');
});

test('idade, genero e advantage+ saem em frase legivel', () => {
  const antes = lerPublico(ALVO_META);
  const d1 = { ...antes, idadeMin: 30 };
  assert.match(resumoDasMudancas(antes, d1).join(' '), /30/);
  const d2 = { ...antes, generos: [] };
  assert.match(resumoDasMudancas(antes, d2).join(' ').toLowerCase(), /gênero|genero|todos/);
  const d3 = { ...antes, advantagePlus: true };
  assert.match(resumoDasMudancas(antes, d3).join(' '), /Advantage/);
});

test('mudanca de raio da mesma cidade e relatada', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [{ key: '1058', nome: 'Campinas', raio: 50, unidade: 'kilometer' }] };
  assert.match(resumoDasMudancas(antes, depois).join(' '), /Campinas.*50|50.*Campinas/);
});

test('publicos personalizados: incluidos e excluidos saem separados', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, incluir: [], excluir: [] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /Visitantes do site/);
  assert.match(r, /Já compraram/);
});

test('toda frase e texto legivel, sem objeto vazando', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, idadeMin: 30, generos: [], interesses: [] };
  for (const frase of resumoDasMudancas(antes, depois)) {
    assert.equal(typeof frase, 'string');
    assert.ok(!frase.includes('[object'), 'objeto vazou pra tela: ' + frase);
  }
});

test('null ou entrada sem key/id nao quebra, entrada valida sobrevive', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [null, { key: '1058', nome: 'Campinas', raio: 30, unidade: 'kilometer' }, null] };
  const r = resumoDasMudancas(antes, depois);
  assert.ok(r.some(linha => linha.includes('Campinas')), 'entrada válida sobrevive');
  assert.ok(!r.some(linha => linha.includes('[object')), 'nenhuma entrada null quebra a saída');
});

test('interesse/publico sem nome mostra "sem nome" + codigo, nunca codigo sozinho', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, interesses: [{ id: '999', name: '' }] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /sem nome.*999|interesse.*sem nome/, 'deve conter "sem nome" e o código');
  assert.ok(!r.match(/^999$|Interesses: \+999/), 'nunca mostra codigo sozinho');
});

test('cidade sem nome mostra "sem nome" + codigo, nao mostra codigo sozinho', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [{ key: '777', nome: '', raio: 0, unidade: 'kilometer' }] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /sem nome.*777|cidade.*sem nome/, 'deve conter "sem nome" e o código');
});

test('publico personalizado sem nome mostra "sem nome" + codigo', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, incluir: [{ id: 'aud_vazio', name: '' }] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /sem nome.*aud_vazio|público.*sem nome/, 'deve conter "sem nome" e o id');
});

test('mudanca de unidade (kilometer <-> mile) no mesmo raio e relatada', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [{ key: '1058', nome: 'Campinas', raio: 25, unidade: 'mile' }] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /Raio de Campinas/, 'deve mencionar a cidade');
  assert.match(r, /25\s*km.*mi|mi.*km/, 'deve mostrar ambas as unidades');
});

test('cidade existente sem nome, raio muda, mostra "sem nome" nao codigo', () => {
  const antes = lerPublico(ALVO_META);
  const depois = { ...antes, cidades: [{ key: '1058', nome: '', raio: 50, unidade: 'kilometer' }] };
  const r = resumoDasMudancas(antes, depois).join(' | ');
  assert.match(r, /sem nome.*1058|Raio.*sem nome/, 'deve conter "sem nome" e código');
  assert.ok(!r.match(/Raio de 1058/), 'nunca mostra codigo sozinho no raio');
});

test('cidade com raio 0 (cidade inteira) em ambos lados, unidade muda, nao gera linha', () => {
  const antes = { cidades: [{ key: '1058', nome: 'Campinas', raio: 0, unidade: 'kilometer' }], excluidas: [], idadeMin: 18, idadeMax: 65, generos: [], interesses: [], incluir: [], excluir: [], advantagePlus: true };
  const depois = { ...antes, cidades: [{ key: '1058', nome: 'Campinas', raio: 0, unidade: 'mile' }] };
  const r = resumoDasMudancas(antes, depois);
  assert.ok(!r.some(linha => linha.includes('Raio de Campinas')), 'nao deve gerar linha de raio quando ambos sao 0');
});

test('conjunto ATIVO avisa que reinicia o aprendizado; pausado nao avisa', () => {
  const a = lerPublico(ALVO_META), d = { ...a, idadeMin: 30 };
  const ativo = avisosDe(a, d, { ativo: true, ajustes: [] });
  assert.ok(ativo.some(x => /aprendizado/i.test(x.texto)));
  const pausado = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(!pausado.some(x => /aprendizado/i.test(x.texto)),
    'aviso que aparece sempre é aviso que ninguém lê');
});

test('sem mudanca nenhuma, nao avisa nada — nem em conjunto ativo', () => {
  const a = lerPublico(ALVO_META);
  assert.deepEqual(avisosDe(a, a, { ativo: true, ajustes: [] }), []);
});

test('LIGAR advantage+ com restricao manual BLOQUEIA — a Meta recusa (1870227)', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, advantagePlus: true };   // ALVO_META tem idade, gênero e interesses
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  const conflito = avisos.find(x => x.bloqueia);
  assert.ok(conflito, 'combinação que a Meta recusa não pode ser oferecida como se funcionasse');
  assert.match(conflito.texto, /Advantage/);
});

test('ligar advantage+ SEM restricao manual nao bloqueia', () => {
  const a = { ...COM_CIDADE, advantagePlus: false };
  const d = { ...COM_CIDADE, advantagePlus: true };
  assert.ok(!avisosDe(a, d, { ativo: false, ajustes: [] }).some(x => x.bloqueia));
});

test('desligar advantage+ avisa, mas nao bloqueia', () => {
  const a = { ...COM_CIDADE, advantagePlus: true };
  const d = { ...COM_CIDADE, advantagePlus: false, idadeMin: 25 };
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(avisos.some(x => /desligado/i.test(x.texto)));
  assert.ok(!avisos.some(x => x.bloqueia));
});

test('ajuste de raio vira aviso com a cidade pelo nome', () => {
  const a = lerPublico(ALVO_META);
  const avisos = avisosDe(a, a, { ativo: false, ajustes: [{ cidade: 'Campinas', de: 5, para: 17, unidade: 'kilometer' }] });
  const r = avisos.find(x => /Campinas/.test(x.texto));
  assert.ok(r);
  assert.match(r.texto, /17/);
});

test('publico sem lugar nenhum BLOQUEIA — a Meta exige localizacao', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, cidades: [] };
  const bloq = avisosDe(a, d, { ativo: false, ajustes: [] }).find(x => x.bloqueia);
  assert.ok(bloq, 'conjunto não pode mirar em lugar nenhum');
  assert.match(bloq.texto.toLowerCase(), /cidade|lugar|local/);
});

test('depois.cidades: null nao quebra e bloqueia por sem-lugar', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, cidades: null };
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(avisos.length > 0, 'não deve quebrar, deve retornar avisos');
  const bloq = avisos.find(x => x.bloqueia && /cidade|lugar|local/i.test(x.texto));
  assert.ok(bloq, 'null em cidades é "sem lugar", deve bloquear');
});

test('depois.cidades: undefined nao quebra e bloqueia por sem-lugar', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, cidades: undefined };
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(avisos.length > 0, 'não deve quebrar, deve retornar avisos');
  const bloq = avisos.find(x => x.bloqueia && /cidade|lugar|local/i.test(x.texto));
  assert.ok(bloq, 'undefined em cidades é "sem lugar", deve bloquear');
});

test('antes.cidades: null nao quebra', () => {
  const a = { ...COM_CIDADE, cidades: null };
  const d = lerPublico(ALVO_META);
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(Array.isArray(avisos), 'não deve quebrar, deve retornar array');
});

test('antes.cidades: undefined nao quebra', () => {
  const a = { ...COM_CIDADE, cidades: undefined };
  const d = lerPublico(ALVO_META);
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  assert.ok(Array.isArray(avisos), 'não deve quebrar, deve retornar array');
});

test('todo aviso tem texto legivel e marca de bloqueio explicita', () => {
  const a = lerPublico(ALVO_META);
  const d = { ...a, advantagePlus: true, idadeMin: 30 };
  for (const x of avisosDe(a, d, { ativo: true, ajustes: [] })) {
    assert.equal(typeof x.texto, 'string');
    assert.ok(x.texto.length > 15);
    assert.equal(typeof x.bloqueia, 'boolean');
  }
});

test('sem cidade E advantage+ conflict coexistem — dois bloqueios, nenhum se perde', () => {
  const a = lerPublico(ALVO_META);
  // Remove cidades E liga Advantage+ com restrição manual (ambas condições de bloqueio)
  const d = { ...a, cidades: [], advantagePlus: true };
  const avisos = avisosDe(a, d, { ativo: false, ajustes: [] });
  const bloqueios = avisos.filter(x => x.bloqueia);
  assert.ok(bloqueios.length >= 2, 'deve ter pelo menos 2 avisos bloqueantes: sem-cidade E conflito Advantage+');
  assert.ok(bloqueios.some(x => /cidade|lugar|local/i.test(x.texto)), 'um bloqueio é sobre localização');
  assert.ok(bloqueios.some(x => /Advantage/i.test(x.texto)), 'outro bloqueio é sobre Advantage+');
});

test('lerPublico: targeting com regions popula outrasLocalizacoes', () => {
  const comRegioes = { geo_locations: { cities: [{ key: '1058', name: 'Campinas' }], regions: [{ key: '456', name: 'SP' }] } };
  const p = lerPublico(comRegioes);
  assert.ok(p.outrasLocalizacoes.includes('regions'), 'deve listar regions em outrasLocalizacoes');
  assert.deepEqual(p.cidades.length, 1, 'cities ainda aparecem normalmente');
});

test('lerPublico: targeting com countries e zips popula outrasLocalizacoes', () => {
  const comPaises = { geo_locations: { countries: [{ key: 'BR' }], zips: [{ key: '13000' }] } };
  const p = lerPublico(comPaises);
  assert.ok(p.outrasLocalizacoes.includes('countries'), 'deve listar countries');
  assert.ok(p.outrasLocalizacoes.includes('zips'), 'deve listar zips');
  assert.deepEqual(p.cidades.length, 0, 'sem cities, cidades vazio');
});

test('lerPublico: só cities não popula outrasLocalizacoes', () => {
  const p = lerPublico(ALVO_META);
  assert.deepEqual(p.outrasLocalizacoes, [], 'outrasLocalizacoes vazio quando só cities');
});

test('cities E regions: round-trip preserva regions enquanto cities atualiza', () => {
  const original = {
    geo_locations: {
      cities: [{ key: '1058', name: 'Campinas', radius: 25, distance_unit: 'kilometer' }],
      regions: [{ key: '456', name: 'SP' }],
    },
  };
  const p = lerPublico(original);
  p.cidades = [{ key: '999', nome: 'Piracicaba', raio: 0, unidade: 'kilometer' }];
  const { targeting } = montarTargeting(p, original);
  // Regions devem permanecer intactas
  assert.ok(targeting.geo_locations.regions, 'regions sobrevivem');
  assert.deepEqual(targeting.geo_locations.regions, [{ key: '456', name: 'SP' }], 'regions preservadas intactas');
  // Cities devem ser atualizadas
  assert.deepEqual(targeting.geo_locations.cities[0].key, '999', 'cities atualizada');
});

test('só regions: montarTargeting NÃO deleta geo_locations inteira', () => {
  const original = { geo_locations: { regions: [{ key: '456', name: 'SP' }] } };
  const p = { ...PUBLICO_VAZIO, outrasLocalizacoes: ['regions'] };
  const { targeting } = montarTargeting(p, original);
  assert.ok('geo_locations' in targeting, 'geo_locations deve existir');
  assert.ok(targeting.geo_locations.regions, 'regions deve estar lá');
  assert.ok(!('cities' in targeting.geo_locations), 'cities não deve estar (foi vazia)');
});

test('cities esvaziada (só tinha cities): geo_locations removida, compatível com comportamento anterior', () => {
  const original = { geo_locations: { cities: [{ key: '1058', name: 'Campinas' }] } };
  const p = { ...PUBLICO_VAZIO, cidades: [] };
  const { targeting } = montarTargeting(p, original);
  assert.ok(!('geo_locations' in targeting), 'geo_locations removida quando cities vazia e nada mais tem');
});

test('tipo geo desconhecido survives round-trip e é contado em outrasLocalizacoes', () => {
  const original = {
    geo_locations: {
      cities: [{ key: '1058', name: 'Campinas' }],
      geo_algo_novo: [{ id: 'x' }],
    },
  };
  const p = lerPublico(original);
  // Tipo desconhecido aparece em outrasLocalizacoes
  assert.ok(p.outrasLocalizacoes.includes('geo_algo_novo'), 'tipo desconhecido é listado');
  const { targeting } = montarTargeting(p, original);
  // Tipo desconhecido survives
  assert.ok(targeting.geo_locations.geo_algo_novo, 'tipo desconhecido sobrevive');
  assert.deepEqual(targeting.geo_locations.geo_algo_novo, [{ id: 'x' }], 'conteúdo intacto');
});

test('avisosDe: só regions → SEM bloqueio, mas aviso informativo com tradução', () => {
  const p = { ...PUBLICO_VAZIO, outrasLocalizacoes: ['regions'] };
  const avisos = avisosDe(p, p, { ativo: false, ajustes: [] });
  const bloqueios = avisos.filter(x => x.bloqueia);
  assert.ok(!bloqueios.length, 'não deve bloquear quando há regiões');
  const info = avisos.find(x => x.tipo === 'outras-localizacoes');
  assert.ok(info, 'deve ter aviso informativo');
  assert.ok(/região/i.test(info.texto), 'deve traduzir "regions" para "região"');
  assert.ok(/mantid/i.test(info.texto), 'deve avisar que será mantida');
});

test('avisosDe: múltiplas outrasLocalizacoes na mensagem separadas por vírgula', () => {
  const p = { ...PUBLICO_VAZIO, outrasLocalizacoes: ['regions', 'countries', 'zips'] };
  const avisos = avisosDe(p, p, { ativo: false, ajustes: [] });
  const info = avisos.find(x => x.tipo === 'outras-localizacoes');
  assert.ok(/região.*país.*CEP/i.test(info.texto) || /CEP.*país.*região/i.test(info.texto), 'deve listar todas com português');
});

test('avisosDe: realmente sem localização nenhuma BLOQUEIA (nem cities, nem outras)', () => {
  const p = { ...PUBLICO_VAZIO, cidades: [], outrasLocalizacoes: [] };
  const avisos = avisosDe(p, p, { ativo: false, ajustes: [] });
  const bloqueio = avisos.find(x => x.bloqueia && /localização/i.test(x.texto));
  assert.ok(bloqueio, 'deve bloquear quando nem cidades nem outras localidades existem');
});
