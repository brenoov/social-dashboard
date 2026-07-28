import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDeCopia, SUFIXO_PADRAO } from './duplicar.js';

const CAMPANHA = { id: '100', name: 'Bolsas · Tivoli · Vendas' };
const CONJUNTOS = [{ id: '200', name: 'Tivoli · Vendas' }, { id: '201', name: 'Tivoli · Remarketing' }];
const ANUNCIOS = [
  { id: '300', name: 'Anúncio A', adset_id: '200' },
  { id: '301', name: 'Anúncio B', adset_id: '200' },
  { id: '302', name: 'Anúncio C', adset_id: '201' },
];

test('campanha: o plano sai na ordem campanha -> conjuntos -> anuncios', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  assert.deepEqual(plano.map(p => p.nivel), [
    'campanha', 'conjunto', 'anuncio', 'anuncio', 'conjunto', 'anuncio',
  ]);
  assert.equal(plano.length, 6, 'campanha + 2 conjuntos + 3 anuncios');
});

test('cada filho aponta para o PASSO do pai, nao para o id de origem', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  const campanha = plano[0];
  const conjunto = plano.find(p => p.nivel === 'conjunto' && p.origemId === '200');
  const anuncio = plano.find(p => p.nivel === 'anuncio' && p.origemId === '300');
  assert.equal(campanha.paiPasso, null);
  assert.equal(conjunto.paiPasso, campanha.id);
  assert.equal(conjunto.paiCampo, 'campaign_id');
  assert.equal(anuncio.paiPasso, conjunto.id);
  assert.equal(anuncio.paiCampo, 'adset_id');
});

test('TODO passo manda status_option PAUSED — nenhuma copia nasce gastando', () => {
  const alvos = [
    { nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS },
    { nivel: 'conjunto', conjuntos: [CONJUNTOS[0]], anuncios: ANUNCIOS.filter(a => a.adset_id === '200') },
    { nivel: 'anuncio', anuncios: [ANUNCIOS[0]] },
  ];
  for (const alvo of alvos) {
    const plano = planoDeCopia(alvo, { quantidade: 3 });
    assert.ok(plano.length > 0, 'plano vazio em ' + alvo.nivel);
    for (const p of plano) assert.equal(p.params.status_option, 'PAUSED', p.id + ' sem PAUSED');
  }
});

test('campanha e conjunto mandam deep_copy false — a cascata e nossa, nao da Meta', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  for (const p of plano.filter(x => x.nivel !== 'anuncio')) assert.equal(p.params.deep_copy, false);
});

test('so o objeto duplicado e renomeado; os filhos mantem o nome', () => {
  const plano = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS });
  const renomeia = JSON.parse(plano[0].params.rename_options);
  assert.equal(renomeia.rename_strategy, 'ONLY_TOP_LEVEL_RENAME');
  assert.ok(renomeia.rename_suffix.includes(SUFIXO_PADRAO));
  for (const p of plano.slice(1)) assert.equal(p.params.rename_options, undefined, p.id + ' nao devia renomear');
});

test('varias copias geram sufixos distintos e passos com ids distintos', () => {
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] }, { quantidade: 3 });
  assert.equal(plano.length, 3);
  const sufixos = plano.map(p => JSON.parse(p.params.rename_options).rename_suffix);
  assert.equal(new Set(sufixos).size, 3, 'sufixos repetidos criariam nomes iguais');
  assert.equal(new Set(plano.map(p => p.id)).size, 3, 'ids de passo repetidos quebram a cascata');
});

test('quantidade e presa entre 1 e 5, mesmo recebendo lixo', () => {
  const alvo = { nivel: 'anuncio', anuncios: [ANUNCIOS[0]] };
  assert.equal(planoDeCopia(alvo, { quantidade: 0 }).length, 1);
  assert.equal(planoDeCopia(alvo, { quantidade: 99 }).length, 5);
  assert.equal(planoDeCopia(alvo, { quantidade: 'abc' }).length, 1);
  assert.equal(planoDeCopia(alvo).length, 1);
});

test('faltando dado, devolve plano vazio em vez de quebrar', () => {
  assert.deepEqual(planoDeCopia({ nivel: 'inventado', campanha: CAMPANHA }), []);
  assert.deepEqual(planoDeCopia({ nivel: 'campanha' }), []);
  assert.deepEqual(planoDeCopia({ nivel: 'conjunto', conjuntos: [] }), []);
  assert.deepEqual(planoDeCopia(null), []);
  assert.deepEqual(planoDeCopia(undefined), []);
});

test('campanha sem conjunto e conjunto sem anuncio copiam so o que existe', () => {
  const soCamp = planoDeCopia({ nivel: 'campanha', campanha: CAMPANHA, conjuntos: [], anuncios: [] });
  assert.deepEqual(soCamp.map(p => p.nivel), ['campanha']);
  const soConj = planoDeCopia({ nivel: 'conjunto', conjuntos: [CONJUNTOS[0]], anuncios: [] });
  assert.deepEqual(soConj.map(p => p.nivel), ['conjunto']);
});

test('anuncio orfao (adset_id que nao esta na lista) nao entra no plano', () => {
  const plano = planoDeCopia({
    nivel: 'campanha', campanha: CAMPANHA, conjuntos: [CONJUNTOS[0]],
    anuncios: [...ANUNCIOS, { id: '999', name: 'Órfão', adset_id: '777' }],
  });
  assert.ok(!plano.some(p => p.origemId === '999'), 'anuncio sem pai no plano ficaria sem adset_id');
});
