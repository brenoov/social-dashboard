// coletor/lib/meta-pace.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaPace } from './meta-pace.mjs';

test('acumula meta diária até o dia corrente e calcula status/projeção', () => {
  const daily = {};
  for (let d = 1; d <= 30; d++) daily[String(d)] = 1000;
  const r = metaPace({ metaValor: 30000, dailyGoals: daily, diaDoMes: 10, diasNoMes: 30, realizado: 12000 });
  assert.equal(r.esperadoAteHoje, 10000);
  assert.equal(r.realizado, 12000);
  assert.equal(r.status, 'adiantado');
  assert.equal(r.projecaoFechamento, 36000);
  assert.equal(r.percentMeta, 40);
});

test('status atrasado quando realizado abaixo do esperado', () => {
  const daily = {}; for (let d = 1; d <= 31; d++) daily[String(d)] = 1000;
  const r = metaPace({ metaValor: 31000, dailyGoals: daily, diaDoMes: 20, diasNoMes: 31, realizado: 15000 });
  assert.equal(r.esperadoAteHoje, 20000);
  assert.equal(r.status, 'atrasado');
});

test('sem dailyGoals usa distribuição linear da metaValor', () => {
  const r = metaPace({ metaValor: 30000, dailyGoals: null, diaDoMes: 10, diasNoMes: 30, realizado: 9000 });
  assert.equal(r.esperadoAteHoje, 10000);
  assert.equal(r.status, 'atrasado');
});
