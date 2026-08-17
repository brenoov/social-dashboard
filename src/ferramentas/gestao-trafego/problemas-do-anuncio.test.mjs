import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerProblema, agruparProblemas, fraseDosProblemas, anunciosComProblema } from './problemas-do-anuncio.js';

// TODOS OS BRUTOS ABAIXO SAO REAIS, copiados do Graph em 12/08/2026. Inventar
// aqui esconderia justamente o formato que a Meta manda de verdade.

const PUBLICO_SUMIU = {
  level: 'AD_SET', error_code: 1359208, error_summary: 'Público personalizado indisponível',
  error_message: 'Público personalizado indisponível: Este conjunto de anúncios foi pausado porque está usando um ou mais públicos personalizados que não estão mais disponíveis. Você precisará remover esses públicos indisponíveis para reativar seu conjunto de anúncios.',
  error_type: 'HARD_ERROR', mid: '83497a9fb06fe59e5386f8c5a36ca31e',
};
const VIDEO_PEQUENO = {
  level: 'AD', error_code: 2643046, error_summary: 'Erro no processamento do anúncio',
  error_message: 'Erro no processamento do anúncio: Ocorreu um erro ao processar seu vídeo e ele não será veiculado no Instagram. Tente enviar um vídeo diferente, com mais de 500 pixels de largura.',
  error_type: 'SOFT_ERROR',
};
const PAGINAS = {
  level: 'AD', error_code: 1885029, error_summary: 'As Páginas não correspondem',
  error_message: 'As Páginas não correspondem: A Página selecionada para seu anúncio não corresponde à Página associada ao objeto que você está promovendo, como um app ou um post de uma Página. Verifique se as Páginas são as mesmas.',
  error_type: 'HARD_ERROR',
};

test('le o problema real e separa titulo de explicacao', () => {
  const p = lerProblema(PUBLICO_SUMIU);
  assert.equal(p.titulo, 'Público personalizado indisponível');
  assert.equal(p.grave, true);
  assert.equal(p.nivel, 'conjunto', 'AD_SET muda ONDE a pessoa clica pra resolver');
  assert.match(p.detalhe, /^Este conjunto de anúncios foi pausado/, 'o titulo nao pode vir repetido no detalhe');
});

test('SOFT_ERROR nao e grave: o anuncio roda, so nao em todo lugar', () => {
  assert.equal(lerProblema(VIDEO_PEQUENO).grave, false);
  assert.equal(lerProblema(VIDEO_PEQUENO).nivel, 'anuncio');
});

test('cada problema medido tem O QUE FAZER, nao so a descricao', () => {
  for (const bruto of [PUBLICO_SUMIU, VIDEO_PEQUENO, PAGINAS]) {
    assert.ok(lerProblema(bruto).oQueFazer.length > 20, `sem saida pro codigo ${bruto.error_code}`);
  }
  assert.match(lerProblema(VIDEO_PEQUENO).oQueFazer, /500 pixels/);
});

test('codigo NOVO nao ganha conselho inventado', () => {
  // Inventar saida pra erro que ninguem viu seria mandar o dono fazer algo que
  // talvez nao resolva. Melhor mostrar so o que a Meta disse.
  const p = lerProblema({ level: 'AD', error_code: 9999999, error_summary: 'Coisa nova', error_message: 'Coisa nova: sei la', error_type: 'HARD_ERROR' });
  assert.equal(p.oQueFazer, '');
  assert.equal(p.titulo, 'Coisa nova');
  assert.equal(p.detalhe, 'sei la');
});

test('entrada torta nao quebra', () => {
  assert.equal(lerProblema(null).titulo, 'Problema no anúncio');
  assert.equal(lerProblema({}).detalhe, '');
  assert.deepEqual(agruparProblemas(null), []);
  assert.deepEqual(agruparProblemas([null, {}, { issues_info: null }]), []);
  assert.equal(fraseDosProblemas([]), '');
  assert.equal(fraseDosProblemas(null), '');
});

// O AGRUPAMENTO: e o ponto. Medido, os 5 conjuntos da Raissa tem o MESMO erro.
test('cinco conjuntos com o MESMO erro viram UMA linha, nao cinco', () => {
  const anuncios = ['HOTEL ORT', 'ARMAZÉM CHURRASCADA', 'O QUE NINGUÉM CONTA', 'RESUMO LENÇÓIS', 'LENÇÓIS PARAÍSO']
    .map((nome) => ({ nome, conta_nome: 'Raíssa Herculano', issues_info: [PUBLICO_SUMIU] }));
  const g = agruparProblemas(anuncios);
  assert.equal(g.length, 1, 'e UMA decisao, nao cinco');
  assert.equal(g[0].quantos, 5);
  assert.equal(g[0].onde.length, 5, 'mas diz QUAIS sao os cinco');
});

test('o mesmo nome nao conta duas vezes na lista de onde', () => {
  // Medido: os 3 videos da Mantova se chamam todos "anúncio 1".
  const anuncios = [1, 2, 3].map(() => ({ nome: 'anúncio 1', issues_info: [VIDEO_PEQUENO] }));
  const g = agruparProblemas(anuncios);
  assert.equal(g[0].quantos, 3, 'sao tres anuncios');
  assert.deepEqual(g[0].onde, ['anúncio 1'], 'mas um nome so');
});

test('problemas DIFERENTES continuam separados', () => {
  const g = agruparProblemas([
    { nome: 'a', issues_info: [PUBLICO_SUMIU] },
    { nome: 'b', issues_info: [VIDEO_PEQUENO] },
    { nome: 'c', issues_info: [PAGINAS] },
  ]);
  assert.equal(g.length, 3);
});

test('o GRAVE vem primeiro, e depois o que pega mais anuncio', () => {
  const g = agruparProblemas([
    { nome: 'v1', issues_info: [VIDEO_PEQUENO] }, { nome: 'v2', issues_info: [VIDEO_PEQUENO] },
    { nome: 'v3', issues_info: [VIDEO_PEQUENO] }, { nome: 'p1', issues_info: [PAGINAS] },
  ]);
  assert.equal(g[0].codigo, 1885029, 'o que IMPEDE de rodar vem antes, mesmo sendo so um');
  assert.equal(g[1].quantos, 3);
});

test('um anuncio com DOIS problemas conta nos dois grupos', () => {
  const g = agruparProblemas([{ nome: 'x', issues_info: [PUBLICO_SUMIU, VIDEO_PEQUENO] }]);
  assert.equal(g.length, 2);
});

test('a frase do topo separa o que IMPEDE do que so atrapalha', () => {
  const g = agruparProblemas([
    { nome: 'a', issues_info: [PUBLICO_SUMIU] },
    { nome: 'b', issues_info: [VIDEO_PEQUENO] }, { nome: 'c', issues_info: [VIDEO_PEQUENO] },
  ]);
  const f = fraseDosProblemas(g);
  assert.match(f, /1 está impedido de rodar/);
  assert.match(f, /2 rodam com limitação/);
});

test('so graves: a frase nao inventa a metade que nao existe', () => {
  const f = fraseDosProblemas(agruparProblemas([{ nome: 'a', issues_info: [PUBLICO_SUMIU] }]));
  assert.match(f, /impedido/);
  assert.doesNotMatch(f, /limitação/);
});

// ─────────────────────────────────────────────────────────────────────────────
// O PAINEL SÓ OLHAVA ANÚNCIO ATIVO — E ANÚNCIO COM PROBLEMA NUNCA ESTÁ ATIVO.
//
// O DEFEITO REAL (17/08/2026): este módulo foi escrito em 12/08 justamente para
// mostrar os 13 problemas medidos naquele dia, e NUNCA mostrou nenhum. A lista
// que alimentava `agruparProblemas` vinha de `info.anuncios`, e essa lista era
// montada com `if (effective_status !== 'ACTIVE') continue` — filtro certo para
// o outro uso dela (criativos sem tração, que só fazem sentido rodando) e
// fatalmente errado para este.
//
// Medido no Graph em 17/08, nas 5 contas: dos 13 anúncios com `issues_info`,
// **zero** estão ACTIVE — 10 são WITH_ISSUES e 3 PAUSED. Ou seja, o filtro não
// escondia parte dos problemas: escondia TODOS, sempre.
//
// É a mesma família do pin no mapa: o módulo estava certo, a tela estava certa,
// e o que ligava os dois entregava uma lista vazia. Defeito que nenhum teste
// pegava porque a seleção morava dentro do `.vue`, que `node --test` não compila.
// Por isso ela sai de lá e vira função pura aqui.

test('anúncio com problema NÃO está ativo — é o caso normal, não a exceção', () => {
  const anuncios = [
    { id: '1', name: 'pausado pela Meta', effective_status: 'WITH_ISSUES', issues_info: [{ error_code: 1359208, error_summary: 'Público personalizado indisponível', error_type: 'HARD_ERROR', level: 'AD_SET' }] },
    { id: '2', name: 'vídeo pequeno', effective_status: 'PAUSED', issues_info: [{ error_code: 2643046, error_summary: 'Vídeo abaixo do mínimo', error_type: 'SOFT_ERROR', level: 'AD' }] },
    { id: '3', name: 'saudável', effective_status: 'ACTIVE', issues_info: null },
  ]
  const escolhidos = anunciosComProblema(anuncios)
  assert.equal(escolhidos.length, 2, 'os dois com problema têm de entrar, ativos ou não')
  assert.deepEqual(escolhidos.map((a) => a.id).sort(), ['1', '2'])
})

test('o filtro antigo (só ACTIVE) esconderia os DOIS — é a prova do defeito', () => {
  const anuncios = [
    { id: '1', effective_status: 'WITH_ISSUES', issues_info: [{ error_code: 1359208, error_type: 'HARD_ERROR' }] },
    { id: '2', effective_status: 'PAUSED', issues_info: [{ error_code: 2643046, error_type: 'SOFT_ERROR' }] },
  ]
  const comoEra = anuncios.filter((a) => String(a.effective_status).toUpperCase() === 'ACTIVE')
  assert.deepEqual(agruparProblemas(comoEra), [], 'era assim que a tela ficava vazia')
  assert.equal(agruparProblemas(anunciosComProblema(anuncios)).length, 2, 'e é assim que ela passa a falar')
})

test('anúncio sem problema não entra, mesmo parado', () => {
  const anuncios = [
    { id: '9', effective_status: 'PAUSED', issues_info: [] },
    { id: '10', effective_status: 'ARCHIVED' },
  ]
  assert.deepEqual(anunciosComProblema(anuncios), [])
})

test('o contexto da conta e da campanha viaja junto — sem ele o dono não sabe ONDE', () => {
  const anuncios = [{ id: '1', name: 'meu anúncio', effective_status: 'WITH_ISSUES', issues_info: [{ error_code: 1359208, error_summary: 'X', error_type: 'HARD_ERROR' }] }]
  const [a] = anunciosComProblema(anuncios, { conta_nome: 'C1 - Raissa', campanha_nome: '[ENGAJAMENTO] HOTEL' })
  assert.equal(a.conta_nome, 'C1 - Raissa')
  assert.equal(a.campanha_nome, '[ENGAJAMENTO] HOTEL')
  assert.equal(a.nome, 'meu anúncio')
})

test('lista vazia ou nula não quebra', () => {
  assert.deepEqual(anunciosComProblema(null), [])
  assert.deepEqual(anunciosComProblema([]), [])
})
