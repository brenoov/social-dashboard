import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orcamentoDe,
  detectarNivelOrcamento,
  podeEditarOrcamentoDaCampanha,
  podeEditarOrcamentoDoConjunto,
  montarHierarquia,
  orcamentoEfetivoDaCampanha,
} from './orcamento-hierarquia.js';

// A Meta manda orçamento como STRING em centavos.
const camp = (extra) => Object.assign({ id: 'c1', name: 'Campanha', effective_status: 'ACTIVE' }, extra);
const conj = (id, extra) => Object.assign({ id, name: 'Conjunto ' + id, campaign_id: 'c1' }, extra);
const ad = (id, adsetId, spend, extra) => Object.assign(
  { ad_id: id, ad_name: 'Anúncio ' + id, adset_id: adsetId, adset_name: 'Conjunto ' + adsetId, spend: String(spend), campaign_id: 'c1' },
  extra,
);

// ── orcamentoDe ──
test('orcamentoDe lê daily_budget em centavos e converte pra reais', () => {
  assert.deepEqual(orcamentoDe({ daily_budget: '5000' }), { tipo: 'diario', centavos: 5000, reais: 50 });
});

test('orcamentoDe prefere o diário quando os dois vêm preenchidos', () => {
  assert.equal(orcamentoDe({ daily_budget: '5000', lifetime_budget: '90000' }).tipo, 'diario');
});

test('orcamentoDe entende orçamento total (lifetime)', () => {
  assert.deepEqual(orcamentoDe({ lifetime_budget: '90000' }), { tipo: 'total', centavos: 90000, reais: 900 });
});

test('orcamentoDe trata ausente/vazio/zero como SEM orçamento', () => {
  assert.equal(orcamentoDe(null), null);
  assert.equal(orcamentoDe({}), null);
  assert.equal(orcamentoDe({ daily_budget: '' }), null);
  assert.equal(orcamentoDe({ daily_budget: '0' }), null); // "0" = não usa esse nível
  assert.equal(orcamentoDe({ daily_budget: 'abacaxi' }), null);
});

// ── detectarNivelOrcamento: a pergunta do dono, "é ABO ou CBO?" ──
test('campanha COM orçamento próprio = CBO (orçamento na campanha)', () => {
  const r = detectarNivelOrcamento(camp({ daily_budget: '10000' }), [conj('s1')]);
  assert.equal(r.nivel, 'campanha');
  assert.equal(r.sigla, 'CBO');
});

test('campanha SEM orçamento e conjuntos COM orçamento = ABO (orçamento no conjunto)', () => {
  const r = detectarNivelOrcamento(camp(), [conj('s1', { daily_budget: '3000' }), conj('s2')]);
  assert.equal(r.nivel, 'conjunto');
  assert.equal(r.sigla, 'ABO');
});

test('ABO também vale com orçamento total no conjunto', () => {
  assert.equal(detectarNivelOrcamento(camp(), [conj('s1', { lifetime_budget: '50000' })]).sigla, 'ABO');
});

test('CBO com orçamento total na campanha continua sendo CBO', () => {
  assert.equal(detectarNivelOrcamento(camp({ lifetime_budget: '80000' }), [conj('s1')]).sigla, 'CBO');
});

test('campanha com orçamento vence mesmo se algum conjunto também tiver', () => {
  const r = detectarNivelOrcamento(camp({ daily_budget: '10000' }), [conj('s1', { daily_budget: '3000' })]);
  assert.equal(r.sigla, 'CBO');
});

test('sem orçamento em lugar nenhum = indefinido, sem sigla e sem promessa', () => {
  const r = detectarNivelOrcamento(camp(), [conj('s1')]);
  assert.equal(r.nivel, 'indefinido');
  assert.equal(r.sigla, null);
});

test('conjuntos vazios (busca falhou) NÃO viram ABO por chute', () => {
  assert.equal(detectarNivelOrcamento(camp(), []).nivel, 'indefinido');
  assert.equal(detectarNivelOrcamento(camp(), null).nivel, 'indefinido');
});

// ── onde o orçamento é editável ──
test('CBO: edita na campanha, NÃO no conjunto', () => {
  const c = camp({ daily_budget: '10000' });
  const cjs = [conj('s1')];
  assert.equal(podeEditarOrcamentoDaCampanha(c, cjs).editavel, true);
  assert.equal(podeEditarOrcamentoDaCampanha(c, cjs).atualReais, 100);
  const noConj = podeEditarOrcamentoDoConjunto(c, cjs[0], cjs);
  assert.equal(noConj.editavel, false);
  assert.match(noConj.motivo, /campanha \(CBO\)/);
});

test('ABO (o caso do dono): NÃO edita na campanha, edita em cada conjunto', () => {
  const c = camp();
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2', { daily_budget: '4500' })];
  const naCamp = podeEditarOrcamentoDaCampanha(c, cjs);
  assert.equal(naCamp.editavel, false);
  assert.match(naCamp.motivo, /conjunto/);
  assert.equal(podeEditarOrcamentoDoConjunto(c, cjs[0], cjs).editavel, true);
  assert.equal(podeEditarOrcamentoDoConjunto(c, cjs[0], cjs).atualReais, 30);
  assert.equal(podeEditarOrcamentoDoConjunto(c, cjs[1], cjs).atualReais, 45);
});

test('ABO: conjunto sem orçamento próprio não é editável', () => {
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2')];
  const r = podeEditarOrcamentoDoConjunto(camp(), cjs[1], cjs);
  assert.equal(r.editavel, false);
  assert.match(r.motivo, /não tem orçamento próprio/);
});

test('orçamento TOTAL não é editável pelo campo R$/dia (campanha e conjunto)', () => {
  const cCbo = camp({ lifetime_budget: '80000' });
  const rCamp = podeEditarOrcamentoDaCampanha(cCbo, []);
  assert.equal(rCamp.editavel, false);
  assert.match(rCamp.motivo, /orçamento total/);
  const cjs = [conj('s1', { lifetime_budget: '50000' })];
  const rConj = podeEditarOrcamentoDoConjunto(camp(), cjs[0], cjs);
  assert.equal(rConj.editavel, false);
  assert.match(rConj.motivo, /orçamento total/);
});

test('indefinido: nada é editável e o motivo aponta o Gerenciador da Meta', () => {
  assert.equal(podeEditarOrcamentoDaCampanha(camp(), []).editavel, false);
  const r = podeEditarOrcamentoDoConjunto(camp(), conj('s1'), []);
  assert.equal(r.editavel, false);
});

// ── hierarquia campanha → conjuntos → anúncios ──
test('agrupa anúncios por conjunto e ordena por gasto desc', () => {
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2', { daily_budget: '4000' })];
  const ads = [ad('a1', 's1', 10), ad('a2', 's2', 90), ad('a3', 's1', 5)];
  const h = montarHierarquia(cjs, ads);
  assert.deepEqual(h.map((g) => g.id), ['s2', 's1']);
  assert.equal(h[0].gasto, 90);
  assert.equal(h[1].gasto, 15);
  assert.equal(h[1].anuncios.length, 2);
  assert.equal(h[0].conjunto.daily_budget, '4000');
});

test('conjunto sem anúncio com gasto continua na lista (dá pra editar o orçamento)', () => {
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2', { daily_budget: '4000' })];
  const h = montarHierarquia(cjs, [ad('a1', 's1', 10)]);
  assert.equal(h.length, 2);
  const vazio = h.find((g) => g.id === 's2');
  assert.equal(vazio.gasto, 0);
  assert.deepEqual(vazio.anuncios, []);
});

test('conjunto ARQUIVADO e sem gasto nenhum não entulha a lista', () => {
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2', { effective_status: 'ARCHIVED' })];
  const h = montarHierarquia(cjs, [ad('a1', 's1', 10)]);
  assert.deepEqual(h.map((g) => g.id), ['s1']);
});

test('conjunto ARQUIVADO que gastou no período continua visível (o dinheiro saiu)', () => {
  const cjs = [conj('s1', { daily_budget: '3000' }), conj('s2', { effective_status: 'ARCHIVED' })];
  const h = montarHierarquia(cjs, [ad('a1', 's1', 10), ad('a2', 's2', 40)]);
  assert.deepEqual(h.map((g) => g.id), ['s2', 's1']);
});

test('conjunto PAUSADO sem gasto continua visível (dá pra editar o orçamento dele)', () => {
  const cjs = [conj('s1', { effective_status: 'PAUSED', daily_budget: '3000' })];
  assert.equal(montarHierarquia(cjs, []).length, 1);
});

test('anúncio de conjunto que não veio na busca NÃO some — vira conjunto do próprio insight', () => {
  const h = montarHierarquia([], [ad('a1', 's9', 20)]);
  assert.equal(h.length, 1);
  assert.equal(h[0].id, 's9');
  assert.equal(h[0].nome, 'Conjunto s9'); // nome reconstruído do adset_name do insight
  assert.equal(h[0].conjunto, null); // sem objeto = sem orçamento conhecido
  assert.equal(h[0].anuncios.length, 1);
});

test('anúncio sem adset_id cai num balde próprio, sem quebrar', () => {
  const h = montarHierarquia([], [{ ad_id: 'a1', ad_name: 'solto', spend: '7' }]);
  assert.equal(h.length, 1);
  assert.equal(h[0].id, '_sem_conjunto');
  assert.equal(h[0].gasto, 7);
});

test('hierarquia aguenta entradas vazias/nulas', () => {
  assert.deepEqual(montarHierarquia(null, null), []);
  assert.deepEqual(montarHierarquia([], []), []);
  assert.equal(montarHierarquia([conj('s1')], [ad('a1', 's1', 'abacaxi')])[0].gasto, 0);
});

test('id do conjunto casa mesmo se a Meta mandar número num lado e string no outro', () => {
  const h = montarHierarquia([{ id: 123, name: 'Conjunto' }], [{ ad_id: 'a1', adset_id: 123, spend: '5' }]);
  assert.equal(h.length, 1);
  assert.equal(h[0].anuncios.length, 1);
});

// ---------------------------------------------------------------------------
// ORCAMENTO EFETIVO (2026-07-29). O robo de budget lia so o daily_budget da
// CAMPANHA; em ABO isso e nulo, entao ele via R$ 0 e sugeria em cima do zero.
// ---------------------------------------------------------------------------

test('CBO: o orcamento e o da propria campanha', () => {
  const r = orcamentoEfetivoDaCampanha({ daily_budget: '3500' }, []);
  assert.equal(r.sigla, 'CBO');
  assert.equal(r.centavos, 3500);
  assert.equal(r.tipo, 'diario');
  assert.equal(r.conjuntosSomados, 0);
});

test('ABO: soma os conjuntos em vez de devolver zero', () => {
  // O caso real: campanha sem orcamento proprio, R$ 90/dia espalhados em 3 conjuntos.
  const conjuntos = [
    { daily_budget: '3000', effective_status: 'ACTIVE' },
    { daily_budget: '3000', effective_status: 'ACTIVE' },
    { daily_budget: '3000', effective_status: 'ACTIVE' },
  ];
  const r = orcamentoEfetivoDaCampanha({}, conjuntos);
  assert.equal(r.sigla, 'ABO');
  assert.equal(r.centavos, 9000, 'R$ 90, nao R$ 0');
  assert.equal(r.conjuntosSomados, 3);
});

test('ABO: conjunto PAUSADO nao entra na soma — ele nao gasta', () => {
  // "MODA & BOLSAS" real: R$ 290 configurados, R$ 230 no ar (um de R$ 60 parado).
  const conjuntos = [
    { daily_budget: '20000', effective_status: 'ACTIVE' },
    { daily_budget: '3000', effective_status: 'ACTIVE' },
    { daily_budget: '6000', effective_status: 'PAUSED' },
  ];
  const r = orcamentoEfetivoDaCampanha({}, conjuntos);
  assert.equal(r.centavos, 23000, 'so o que esta rodando');
  assert.equal(r.configuradoCentavos, 29000, 'mas o configurado fica disponivel');
  assert.equal(r.conjuntosIgnorados, 1);
});

test('ABO com TODOS pausados: devolve o configurado, nao zero', () => {
  // Zero aqui esconderia que existe orcamento montado na campanha.
  const r = orcamentoEfetivoDaCampanha({}, [
    { daily_budget: '5000', effective_status: 'PAUSED' },
    { daily_budget: '5000', effective_status: 'PAUSED' },
  ]);
  assert.equal(r.centavos, 10000);
  assert.equal(r.conjuntosSomados, 2);
});

test('sem orcamento em lugar nenhum devolve null — e null NAO e zero', () => {
  // null significa "nao sei", e e isso que impede uma sugestao calculada em
  // cima de nada. Zero seria uma afirmacao falsa sobre o gasto.
  const r = orcamentoEfetivoDaCampanha({}, [{ effective_status: 'ACTIVE' }]);
  assert.equal(r.nivel, 'indefinido');
  assert.equal(r.centavos, null);
  assert.notEqual(r.centavos, 0);
});

test('ABO misturando diario e total marca tipo "misto"', () => {
  const r = orcamentoEfetivoDaCampanha({}, [
    { daily_budget: '3000', effective_status: 'ACTIVE' },
    { lifetime_budget: '50000', effective_status: 'ACTIVE' },
  ]);
  assert.equal(r.tipo, 'misto', 'R$/dia e R$ total nao somam a mesma unidade');
});

test('aceita `status` quando `effective_status` nao veio', () => {
  const r = orcamentoEfetivoDaCampanha({}, [
    { daily_budget: '3000', status: 'ACTIVE' },
    { daily_budget: '3000', status: 'PAUSED' },
  ]);
  assert.equal(r.centavos, 3000);
});

test('CBO ganha da soma dos conjuntos: quem manda e a campanha', () => {
  const r = orcamentoEfetivoDaCampanha({ daily_budget: '10000' }, [
    { daily_budget: '3000', effective_status: 'ACTIVE' },
  ]);
  assert.equal(r.sigla, 'CBO');
  assert.equal(r.centavos, 10000);
});
