import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarFunis, etapasDoFunil, porUnidade, quebraDeInteracoes, LEITURA } from './funil.js';

const camp = (balde, extra) => ({
  balde,
  insight: { spend: '1000', reach: '10000', impressions: '20000', clicks: '400', actions: [], ...extra },
});
const comAcao = (tipo, valor) => ({ actions: [{ action_type: tipo, value: String(valor) }] });

test('campanhas do mesmo objetivo somam num funil so', () => {
  const r = montarFunis([camp('mensagens'), camp('mensagens'), camp('trafego')]);
  assert.equal(r.length, 2);
  const msg = r.find((f) => f.balde === 'mensagens');
  assert.equal(msg.campanhas, 2);
  assert.equal(msg.gasto, 2000);
  assert.equal(msg.alcance, 20000);
});

test('vem ordenado por gasto: onde ha mais dinheiro aparece primeiro', () => {
  const r = montarFunis([
    camp('trafego', { spend: '100' }),
    camp('mensagens', { spend: '5000' }),
    camp('engajamento', { spend: '900' }),
  ]);
  assert.deepEqual(r.map((f) => f.balde), ['mensagens', 'engajamento', 'trafego']);
});

// ── a distincao que define o arquivo ───────────────────────────────────────

test('mensagens, leads e vendas sao FUNIL; engajamento e trafego sao PROPORCAO', () => {
  assert.equal(LEITURA.mensagens.tipo, 'funil');
  assert.equal(LEITURA.leads.tipo, 'funil');
  assert.equal(LEITURA.vendas.tipo, 'funil');
  assert.equal(LEITURA.engajamento.tipo, 'proporcao');
  assert.equal(LEITURA.trafego.tipo, 'proporcao');
});

test('funil calcula a queda entre clique e resultado', () => {
  const r = montarFunis([camp('mensagens', comAcao('onsite_conversion.messaging_conversation_started_7d', 50))]);
  assert.equal(r[0].resultados, 50);
  assert.equal(r[0].taxaResultado, 50 / 400, '12,5% de quem clicou');
  assert.equal(r[0].porPessoa, null, 'funil nao usa "por pessoa"');
});

test('proporcao NAO calcula taxa sobre o clique — daria 11.262%', () => {
  // O caso real: 194.809 interacoes contra 3.789 cliques. A interacao acontece
  // NO LUGAR do clique, nao depois dele.
  const r = montarFunis([camp('engajamento', { clicks: '3789', reach: '444678', ...comAcao('post_engagement', 194809) })]);
  assert.equal(r[0].taxaResultado, null, 'nao existe taxa sobre o clique aqui');
  assert.ok(r[0].porPessoa > 0.43 && r[0].porPessoa < 0.44, 'o que faz sentido e por pessoa alcancada');
});

test('reconhecimento conta a propria impressao como resultado', () => {
  const r = montarFunis([camp('reconhecimento', { impressions: '50000' })]);
  assert.equal(r[0].resultados, 50000);
});

test('custo por resultado sai em todos os tipos', () => {
  const f = montarFunis([camp('mensagens', comAcao('onsite_conversion.messaging_conversation_started_7d', 100))]);
  assert.equal(f[0].custoPorResultado, 10, 'R$ 1000 / 100 conversas');
});

test('zero resultado com cliques e 0%, NAO "nao sei"', () => {
  // 400 pessoas clicaram e nenhuma converteu: isso e informacao — e das ruins.
  // null aqui esconderia um funil que esta vazando tudo no ultimo degrau.
  const r = montarFunis([camp('mensagens')]);
  assert.equal(r[0].resultados, 0);
  assert.equal(r[0].taxaResultado, 0, '0% e um numero de verdade');
  assert.equal(r[0].custoPorResultado, null, 'mas custo POR resultado nao existe sem resultado');
});

test('sem clique nenhum a taxa e null: ai sim nao da pra saber', () => {
  const r = montarFunis([camp('mensagens', { clicks: '0' })]);
  assert.equal(r[0].taxaResultado, null);
  assert.equal(r[0].ctr, 0, 'mas o CTR de 20.000 exibicoes e zero, nao desconhecido');
});

// ── as etapas prontas pra desenhar ─────────────────────────────────────────

test('funil tem 3 etapas empilhadas, com largura relativa ao ALCANCE', () => {
  const f = montarFunis([camp('mensagens', comAcao('onsite_conversion.messaging_conversation_started_7d', 50))])[0];
  const e = etapasDoFunil(f);
  assert.equal(e.length, 3);
  assert.equal(e[0].largura, 100, 'o topo e sempre a barra cheia');
  assert.equal(e[1].largura, 4, '400 cliques em 10.000 pessoas');
  assert.ok(e[2].nota.includes('de quem clicou'));
});

test('proporcao: o resultado NAO entra na pilha (sem largura)', () => {
  const f = montarFunis([camp('engajamento', comAcao('post_engagement', 194809))])[0];
  const e = etapasDoFunil(f);
  assert.equal(e[2].largura, null, 'nao e etapa, e razao');
  assert.ok(e[2].nota.includes('por pessoa alcançada'));
});

test('a largura ancora no ALCANCE, nao no maior numero', () => {
  // Em engajamento as interacoes PASSAM das pessoas alcancadas. Ancorar no maior
  // faria a barra do topo encolher, como se menos gente tivesse visto.
  const f = montarFunis([camp('engajamento', { reach: '1000', ...comAcao('post_engagement', 50000) })])[0];
  const e = etapasDoFunil(f);
  assert.equal(e[0].largura, 100, 'o alcance continua sendo a barra cheia');
});

test('a frequencia aparece na etapa do alcance', () => {
  const f = montarFunis([camp('mensagens', { reach: '10000', impressions: '31000' })])[0];
  assert.match(etapasDoFunil(f)[0].nota, /3,1× cada/);
});

test('entrada vazia ou desconhecida nao quebra', () => {
  assert.deepEqual(montarFunis([]), []);
  assert.deepEqual(montarFunis(null), []);
  assert.deepEqual(montarFunis([{ balde: 'inventado' }]), [], 'objetivo sem leitura definida fica de fora');
  assert.deepEqual(etapasDoFunil(null), []);
});

// ── numero que arredonda pra zero e pior que numero nenhum ─────────────────

test('acima de um centavo le normal', () => {
  assert.equal(porUnidade(1000, 100, 'conversa', 'conversas', true).texto, 'R$ 10,00 por conversa');
});

test('abaixo de um centavo INVERTE em vez de virar "R$ 0,00"', () => {
  // O caso real: R$ 415 por 212.407 interacoes = R$ 0,00195. "R$ 0,00 por
  // interacao" faz parecer que nao custa nada.
  const r = porUnidade(415, 212407, 'interação', 'interações', true);
  assert.equal(r.invertido, true);
  assert.equal(r.texto, 'R$ 1 compra 512 interações', 'plural CERTO — "interaçãos" foi o primeiro texto gerado');
  assert.ok(!r.texto.includes('0,00'));
});

test('sem quantidade ou sem valor nao inventa razao', () => {
  assert.equal(porUnidade(100, 0, 'x', 'xs', true), null);
  assert.equal(porUnidade(0, 100, 'x', 'xs', true), null);
  assert.equal(porUnidade(null, 100, 'x', 'xs', true), null);
});

test('proporcao com resultado raro le "1 a cada N pessoas"', () => {
  // Vessel, trafego: 15 visitas em 15.580 pessoas. "0 por pessoa" nao diz nada.
  const f = montarFunis([camp('trafego', { reach: '15580', ...comAcao('landing_page_view', 15) })])[0];
  const nota = etapasDoFunil(f)[2].nota;
  assert.match(nota, /1 visita a cada 1\.039 pessoas/);
  assert.ok(!/^0 por/.test(nota));
});

// ── engajamento aberto por tipo de interacao (2026-07-29) ──────────────────

test('engajamento se abre por tipo, do mais frequente pro menos', () => {
  // "212.407 interacoes" nao diz se foram curtidas de passagem ou salvamentos.
  const f = montarFunis([{ balde: 'engajamento', insight: { spend: '415', reach: '10000', actions: [
    { action_type: 'post_reaction', value: '5000' },
    { action_type: 'comment', value: '80' },
    { action_type: 'onsite_conversion.post_save', value: '300' },
  ] } }])[0];
  const q = quebraDeInteracoes(f);
  assert.deepEqual(q.map((l) => l.chave), ['curtidas', 'salvamentos', 'comentarios']);
  assert.equal(q[0].quantidade, 5000);
});

test('cada linha carrega o PESO da regua', () => {
  // E o que explica 200 mil curtidas valerem menos que 500 salvamentos.
  const f = montarFunis([{ balde: 'engajamento', insight: { actions: [
    { action_type: 'post_reaction', value: '10' },
    { action_type: 'onsite_conversion.post_save', value: '10' },
  ] } }])[0];
  const q = quebraDeInteracoes(f);
  assert.equal(q.find((l) => l.chave === 'curtidas').peso, 1);
  assert.equal(q.find((l) => l.chave === 'salvamentos').peso, 30);
});

test('as fatias somam 100%', () => {
  const f = montarFunis([{ balde: 'engajamento', insight: { actions: [
    { action_type: 'post_reaction', value: '75' },
    { action_type: 'comment', value: '25' },
  ] } }])[0];
  const q = quebraDeInteracoes(f);
  assert.equal(Math.round(q.reduce((t, l) => t + l.fatia, 0) * 100), 100);
  assert.equal(q[0].fatia, 0.75);
});

test('tipo sem nenhuma interacao nao vira linha vazia', () => {
  const f = montarFunis([{ balde: 'engajamento', insight: { actions: [{ action_type: 'post_reaction', value: '10' }] } }])[0];
  assert.equal(quebraDeInteracoes(f).length, 1);
});

test('so engajamento tem quebra — nos outros nao faz sentido', () => {
  const msg = montarFunis([camp('mensagens')])[0];
  assert.deepEqual(quebraDeInteracoes(msg), []);
  assert.deepEqual(quebraDeInteracoes(null), []);
});
