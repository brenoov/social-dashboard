import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDeCopia, SUFIXO_PADRAO, executarPlano, comEspera, ehPedidoDeCalma, retomar } from './duplicar.js';

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

// Meta de mentira: registra as chamadas e devolve o campo certo por nível.
//
// O nível vem do OBJETO CHAMADO (o id no caminho `/{id}/copies`), como na Meta
// de verdade — nunca dos parâmetros enviados. Adivinhar pelos parâmetros
// escondia o nível conjunto: uma cópia de conjunto na raiz manda `deep_copy`
// false e NÃO manda `campaign_id`, e a Meta de mentira respondia
// `copied_campaign_id` ali, deixando o botão do conjunto sem teste de ponta a
// ponta.
const NIVEL_DO_OBJETO = {
  [CAMPANHA.id]: 'campanha',
  ...Object.fromEntries(CONJUNTOS.map(c => [c.id, 'conjunto'])),
  ...Object.fromEntries(ANUNCIOS.map(a => [a.id, 'anuncio'])),
};
const CAMPO_DA_RESPOSTA = {
  campanha: 'copied_campaign_id',
  conjunto: 'copied_adset_id',
  anuncio: 'copied_ad_id',
};

function metaFalsa({ falharNo } = {}) {
  const chamadas = [];
  let n = 0;
  const enviar = async (caminho, params) => {
    chamadas.push({ caminho, params });
    if (falharNo && caminho === falharNo) throw new Error('A Meta recusou.');
    n += 1;
    const idOrigem = String(caminho).split('/')[1];
    const nivel = NIVEL_DO_OBJETO[idOrigem];
    if (!nivel) throw new Error('A Meta de mentira não conhece o objeto ' + idOrigem);
    return { [CAMPO_DA_RESPOSTA[nivel]]: 'novo-' + nivel + '-' + n };
  };
  return { enviar, chamadas };
}

const ALVO_CAMPANHA = { nivel: 'campanha', campanha: CAMPANHA, conjuntos: CONJUNTOS, anuncios: ANUNCIOS };
const ALVO_CONJUNTO = {
  nivel: 'conjunto',
  conjuntos: [CONJUNTOS[0]],
  anuncios: ANUNCIOS.filter(a => a.adset_id === CONJUNTOS[0].id),
};

test('executa todos os passos e devolve o id novo de cada um', async () => {
  const meta = metaFalsa();
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel = await executarPlano(plano, { enviar: meta.enviar });
  assert.equal(rel.falhou, null);
  assert.equal(rel.concluidos.length, 6);
  assert.equal(Object.keys(rel.criados).length, 6);
});

test('cada chamada vai para /{id de origem}/copies', async () => {
  const meta = metaFalsa();
  await executarPlano(planoDeCopia(ALVO_CAMPANHA), { enviar: meta.enviar });
  assert.equal(meta.chamadas[0].caminho, '/100/copies');
  assert.ok(meta.chamadas.some(c => c.caminho === '/200/copies'));
  assert.ok(meta.chamadas.some(c => c.caminho === '/300/copies'));
});

test('o filho recebe o id NOVO do pai, nao o id de origem', async () => {
  const meta = metaFalsa();
  const rel = await executarPlano(planoDeCopia(ALVO_CAMPANHA), { enviar: meta.enviar });
  const idCampNova = rel.criados['c1:camp'];
  const chamadaConjunto = meta.chamadas.find(c => c.caminho === '/200/copies');
  assert.equal(chamadaConjunto.params.campaign_id, idCampNova);
  const idConjNovo = rel.criados['c1:cj:200'];
  const chamadaAnuncio = meta.chamadas.find(c => c.caminho === '/300/copies');
  assert.equal(chamadaAnuncio.params.adset_id, idConjNovo);
});

// O botão do MEIO (duplicar só o conjunto de anúncios) tem uma armadilha
// própria: o passo raiz é um conjunto SEM campaign_id, e a Meta responde
// `copied_adset_id`. Se algum dia o motor pedir o campo errado aqui, a cascata
// morre no primeiro passo com "a Meta não devolveu o número da cópia".
test('conjunto: executa a cascata inteira e os anuncios entram no conjunto NOVO', async () => {
  const meta = metaFalsa();
  const plano = planoDeCopia(ALVO_CONJUNTO);
  assert.deepEqual(plano.map(p => p.nivel), ['conjunto', 'anuncio', 'anuncio']);

  const rel = await executarPlano(plano, { enviar: meta.enviar });
  assert.equal(rel.falhou, null, 'a cascata do conjunto nao pode falhar');
  assert.equal(rel.concluidos.length, 3, 'conjunto + 2 anuncios');

  const idCjNovo = rel.criados['c1:cj'];
  assert.match(idCjNovo, /^novo-conjunto-/, 'o nivel conjunto responde copied_adset_id');

  const chamadaRaiz = meta.chamadas.find(c => c.caminho === '/200/copies');
  assert.equal(chamadaRaiz.params.deep_copy, false, 'a cascata e nossa, nao da Meta');
  assert.equal(chamadaRaiz.params.campaign_id, undefined, 'o conjunto continua na campanha de origem');

  const dosAnuncios = meta.chamadas.filter(c => c.caminho !== '/200/copies');
  assert.deepEqual(dosAnuncios.map(c => c.caminho), ['/300/copies', '/301/copies']);
  for (const c of dosAnuncios) {
    assert.equal(c.params.adset_id, idCjNovo, 'anuncio precisa entrar na COPIA do conjunto');
    assert.equal(c.params.status_option, 'PAUSED');
  }
});

test('falha no meio para ali, relata o que deu certo e nao tenta o resto', async () => {
  const meta = metaFalsa({ falharNo: '/301/copies' });
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel = await executarPlano(plano, { enviar: meta.enviar });
  assert.ok(rel.falhou, 'devia ter falhado');
  assert.equal(rel.falhou.passo.origemId, '301');
  assert.match(rel.falhou.motivo, /recusou/);
  assert.equal(rel.concluidos.length, 3, 'campanha + conjunto 200 + anuncio 300');
  assert.ok(!meta.chamadas.some(c => c.caminho === '/302/copies'), 'nao devia seguir apos falhar');
});

test('resposta sem o id da copia e tratada como falha, nao como sucesso', async () => {
  const rel = await executarPlano(planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] }), {
    enviar: async () => ({}),
  });
  assert.ok(rel.falhou);
  assert.match(rel.falhou.motivo, /não devolveu/i);
});

test('avisa o progresso a cada passo, com a conta certa', async () => {
  const meta = metaFalsa();
  const vistos = [];
  await executarPlano(planoDeCopia(ALVO_CAMPANHA), {
    enviar: meta.enviar,
    aoProgredir: (p) => vistos.push(p.feitos + '/' + p.total),
  });
  assert.deepEqual(vistos, ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']);
});

test('plano vazio nao chama a Meta nenhuma vez', async () => {
  const meta = metaFalsa();
  const rel = await executarPlano([], { enviar: meta.enviar });
  assert.equal(meta.chamadas.length, 0);
  assert.equal(rel.falhou, null);
  assert.deepEqual(rel.concluidos, []);
});

test('reconhece o pedido de calma da Meta e ignora os outros erros', () => {
  assert.equal(ehPedidoDeCalma(new Error('(#17) User request limit reached')), true);
  assert.equal(ehPedidoDeCalma(new Error('(#4) Too many calls')), true);
  assert.equal(ehPedidoDeCalma(new Error('please reduce the amount of data')), true);
  assert.equal(ehPedidoDeCalma(new Error('(#200) Permissions error')), false);
  assert.equal(ehPedidoDeCalma(new Error('qualquer outra coisa')), false);
  assert.equal(ehPedidoDeCalma(null), false);
});

test('repete no limite de chamadas e devolve o sucesso da tentativa seguinte', async () => {
  let n = 0;
  const esperas = [];
  const enviar = comEspera(async () => {
    n += 1;
    if (n < 3) throw new Error('(#17) User request limit reached');
    return { copied_ad_id: 'ok' };
  }, { esperar: async (ms) => { esperas.push(ms); } });

  const r = await enviar('/1/copies', {});
  assert.deepEqual(r, { copied_ad_id: 'ok' });
  assert.equal(n, 3, 'devia ter tentado 3 vezes');
  assert.deepEqual(esperas, [2000, 4000], 'a espera precisa crescer entre as tentativas');
});

test('NAO repete erro que nao e de limite — nao adianta insistir em permissao', async () => {
  let n = 0;
  const enviar = comEspera(async () => { n += 1; throw new Error('(#200) Permissions error'); },
    { esperar: async () => {} });
  await assert.rejects(() => enviar('/1/copies', {}), /Permissions/);
  assert.equal(n, 1, 'insistir so demoraria pra dar a ma noticia');
});

test('desiste depois das tentativas e propaga o erro da Meta', async () => {
  let n = 0;
  const enviar = comEspera(async () => { n += 1; throw new Error('(#17) User request limit reached'); },
    { tentativas: 3, esperar: async () => {} });
  await assert.rejects(() => enviar('/1/copies', {}), /#17/);
  assert.equal(n, 3);
});

test('a espera envolvida continua repassando caminho e parametros intactos', async () => {
  const vistas = [];
  const enviar = comEspera(async (caminho, params) => { vistas.push({ caminho, params }); return { copied_ad_id: '1' }; },
    { esperar: async () => {} });
  await enviar('/300/copies', { status_option: 'PAUSED', adset_id: '9' });
  assert.deepEqual(vistas, [{ caminho: '/300/copies', params: { status_option: 'PAUSED', adset_id: '9' } }]);
});

test('retomar refaz so o que faltou, sem recriar o que ja existe', async () => {
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const primeira = metaFalsa({ falharNo: '/301/copies' });
  const rel1 = await executarPlano(plano, { enviar: primeira.enviar });
  assert.equal(rel1.concluidos.length, 3);

  const segunda = metaFalsa();
  const rel2 = await retomar(plano, rel1, { enviar: segunda.enviar });
  assert.equal(rel2.falhou, null);
  assert.equal(rel2.concluidos.length, 6, 'o relatorio final cobre o plano inteiro');
  const refeitos = segunda.chamadas.map(c => c.caminho);
  assert.ok(!refeitos.includes('/100/copies'), 'a campanha ja existia, nao podia ser recriada');
  assert.ok(!refeitos.includes('/200/copies'), 'o conjunto ja existia');
  assert.ok(refeitos.includes('/301/copies'), 'o passo que falhou precisa ser refeito');
});

test('retomar mantem os ids ja criados no relatorio final', async () => {
  const plano = planoDeCopia(ALVO_CAMPANHA);
  const rel1 = await executarPlano(plano, { enviar: metaFalsa({ falharNo: '/301/copies' }).enviar });
  const idCampOriginal = rel1.criados['c1:camp'];
  const rel2 = await retomar(plano, rel1, { enviar: metaFalsa().enviar });
  assert.equal(rel2.criados['c1:camp'], idCampOriginal, 'nao pode trocar o id do que ja existe');
});

test('retomar sem relatorio anterior e o mesmo que executar do zero', async () => {
  const meta = metaFalsa();
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] });
  const rel = await retomar(plano, null, { enviar: meta.enviar });
  assert.equal(rel.concluidos.length, 1);
  assert.equal(meta.chamadas.length, 1);
});

test('retomar um plano ja completo nao chama a Meta', async () => {
  const plano = planoDeCopia({ nivel: 'anuncio', anuncios: [ANUNCIOS[0]] });
  const rel1 = await executarPlano(plano, { enviar: metaFalsa().enviar });
  const meta = metaFalsa();
  const rel2 = await retomar(plano, rel1, { enviar: meta.enviar });
  assert.equal(meta.chamadas.length, 0);
  assert.equal(rel2.falhou, null);
});
