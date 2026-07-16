import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listarDias,
  somarGastoPorDia,
  somarSeguidoresPorDia,
  metaDiariaDeInvestimento,
  montarSerieDeInvestimento,
  montarSerieDeCustoPorSeguidor,
} from './series-diarias-de-meta-ads.js';

const g = (captured_at, spend, campaign_id = '1') => ({ captured_at, spend, campaign_id });
const s = (data, novos, saiu = 0) => ({ data, novos, saiu });

test('listarDias devolve todos os dias da janela, inclusive as pontas', () => {
  assert.deepEqual(listarDias('2026-07-01', '2026-07-04'), ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
  assert.deepEqual(listarDias('2026-07-01', '2026-07-01'), ['2026-07-01']);
});

test('listarDias atravessa a virada do mês', () => {
  assert.deepEqual(listarDias('2026-06-29', '2026-07-02'), ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
});

test('listarDias devolve vazio para janela inválida', () => {
  assert.deepEqual(listarDias('2026-07-10', '2026-07-01'), []);
  assert.deepEqual(listarDias(null, '2026-07-01'), []);
  assert.deepEqual(listarDias('2026-07-01', undefined), []);
  assert.deepEqual(listarDias('nada', 'coisa'), []);
});

test('somarGastoPorDia soma as campanhas do mesmo dia', () => {
  const r = somarGastoPorDia([g('2026-07-01', '10.50'), g('2026-07-01', '4.50', '2'), g('2026-07-02', '3')]);
  assert.equal(r['2026-07-01'], 15);
  assert.equal(r['2026-07-02'], 3);
});

test('somarGastoPorDia trata spend nulo/lixo como zero, mas o dia continua coletado', () => {
  const r = somarGastoPorDia([g('2026-07-01', null), g('2026-07-02', 'abc')]);
  assert.equal(r['2026-07-01'], 0);
  assert.equal(r['2026-07-02'], 0);
});

test('somarSeguidoresPorDia devolve o líquido (seguiram − saíram)', () => {
  const r = somarSeguidoresPorDia([s('2026-07-01', 10, 3), s('2026-07-02', 2, 5)]);
  assert.equal(r['2026-07-01'], 7);
  assert.equal(r['2026-07-02'], -3);
});

test('meta diária = budget do período ÷ dias do período', () => {
  assert.equal(metaDiariaDeInvestimento(600, 30), 20);
  assert.equal(metaDiariaDeInvestimento(600, 1), 600);
});

test('meta diária é zero quando não há budget ou não há dias', () => {
  assert.equal(metaDiariaDeInvestimento(0, 30), 0);
  assert.equal(metaDiariaDeInvestimento(600, 0), 0);
  assert.equal(metaDiariaDeInvestimento(NaN, 30), 0);
  assert.equal(metaDiariaDeInvestimento(-10, 30), 0);
});

test('investimento: uma barra por dia da janela, com a meta diária', () => {
  const r = montarSerieDeInvestimento({
    inicio: '2026-07-01', fim: '2026-07-03',
    linhasDeGasto: [g('2026-07-01', '20'), g('2026-07-02', '30'), g('2026-07-03', '10')],
    budgetDoPeriodo: 90,
  });
  assert.equal(r.pontos.length, 3);
  assert.deepEqual(r.pontos.map((p) => p.valor), [20, 30, 10]);
  assert.equal(r.meta, 30);
  assert.equal(r.temDado, true);
});

test('investimento: perfil SEM nenhum dia (Mantova) não quebra e não mente', () => {
  const r = montarSerieDeInvestimento({ inicio: '2026-07-01', fim: '2026-07-03', linhasDeGasto: [], budgetDoPeriodo: 600 });
  assert.equal(r.temDado, false);
  assert.equal(r.pontos.length, 3);
  assert.ok(r.pontos.every((p) => p.semDado === true && p.valor === null && p.motivo === 'sem-coleta'));
});

test('investimento: aguenta linhasDeGasto ausente', () => {
  const r = montarSerieDeInvestimento({ inicio: '2026-07-01', fim: '2026-07-02' });
  assert.equal(r.temDado, false);
  assert.equal(r.pontos.length, 2);
});

test('investimento: dia faltando no meio (Vessel) vira buraco, não zero', () => {
  const r = montarSerieDeInvestimento({
    inicio: '2026-07-01', fim: '2026-07-03',
    linhasDeGasto: [g('2026-07-01', '20'), g('2026-07-03', '10')],
    budgetDoPeriodo: 60,
  });
  assert.equal(r.pontos[1].semDado, true);
  assert.equal(r.pontos[1].valor, null);
  assert.equal(r.pontos[1].motivo, 'sem-coleta');
  assert.equal(r.pontos[0].semDado, false);
  assert.equal(r.pontos[2].semDado, false);
});

test('investimento: dia coletado com gasto zero é dado real (barra zerada), não buraco', () => {
  const r = montarSerieDeInvestimento({
    inicio: '2026-07-01', fim: '2026-07-01',
    linhasDeGasto: [g('2026-07-01', '0')],
    budgetDoPeriodo: 30,
  });
  assert.equal(r.pontos[0].semDado, false);
  assert.equal(r.pontos[0].valor, 0);
});

test('investimento: captured_at com hora ainda cai no dia certo', () => {
  const r = montarSerieDeInvestimento({
    inicio: '2026-07-01', fim: '2026-07-01',
    linhasDeGasto: [{ captured_at: '2026-07-01T09:30:00', spend: '7' }],
    budgetDoPeriodo: 7,
  });
  assert.equal(r.pontos[0].valor, 7);
});

test('custo por seguidor: divide gasto do dia pelos novos do dia', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-02',
    linhasDeGasto: [g('2026-07-01', '20'), g('2026-07-02', '30')],
    linhasDeSeguidores: [s('2026-07-01', 10), s('2026-07-02', 12, 2)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.pontos[0].valor, 2);
  assert.equal(r.pontos[1].valor, 3);
});

test('custo por seguidor: a meta NÃO é dividida pelos dias (já é R$ por seguidor)', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-30',
    linhasDeGasto: [g('2026-07-01', '20')],
    linhasDeSeguidores: [s('2026-07-01', 10)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.meta, 2);
});

test('custo por seguidor: gasto > 0 com 0 novos seguidores não divide por zero', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-01',
    linhasDeGasto: [g('2026-07-01', '20')],
    linhasDeSeguidores: [s('2026-07-01', 0)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.pontos[0].valor, null);
  assert.equal(r.pontos[0].semDado, true);
  assert.equal(r.pontos[0].motivo, 'sem-seguidor');
  assert.equal(r.temDado, false);
});

test('custo por seguidor: dia que perdeu seguidor (líquido negativo) fica sem dado', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-01',
    linhasDeGasto: [g('2026-07-01', '20')],
    linhasDeSeguidores: [s('2026-07-01', 1, 5)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.pontos[0].valor, null);
  assert.equal(r.pontos[0].motivo, 'sem-seguidor');
});

test('custo por seguidor: dia sem coleta de gasto é buraco, não sem-seguidor', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-02',
    linhasDeGasto: [g('2026-07-02', '10')],
    linhasDeSeguidores: [s('2026-07-01', 5), s('2026-07-02', 5)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.pontos[0].motivo, 'sem-coleta');
  assert.equal(r.pontos[1].valor, 2);
});

test('custo por seguidor: ganhou seguidor sem gastar = custo zero', () => {
  const r = montarSerieDeCustoPorSeguidor({
    inicio: '2026-07-01', fim: '2026-07-01',
    linhasDeGasto: [g('2026-07-01', '0')],
    linhasDeSeguidores: [s('2026-07-01', 8)],
    metaDeCustoPorSeguidor: 2,
  });
  assert.equal(r.pontos[0].valor, 0);
  assert.equal(r.pontos[0].semDado, false);
});

test('custo por seguidor: perfil sem nada não quebra', () => {
  const r = montarSerieDeCustoPorSeguidor({ inicio: '2026-07-01', fim: '2026-07-03' });
  assert.equal(r.temDado, false);
  assert.equal(r.pontos.length, 3);
  assert.equal(r.meta, 0);
});

test('período de 1 dia só (Hoje) gera exatamente 1 ponto nas duas séries', () => {
  const inv = montarSerieDeInvestimento({ inicio: '2026-07-16', fim: '2026-07-16', linhasDeGasto: [g('2026-07-16', '45')], budgetDoPeriodo: 45 });
  assert.equal(inv.pontos.length, 1);
  assert.equal(inv.meta, 45);
  const cps = montarSerieDeCustoPorSeguidor({ inicio: '2026-07-16', fim: '2026-07-16', linhasDeGasto: [g('2026-07-16', '45')], linhasDeSeguidores: [s('2026-07-16', 9)], metaDeCustoPorSeguidor: 3 });
  assert.equal(cps.pontos.length, 1);
  assert.equal(cps.pontos[0].valor, 5);
});
