import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPonderada, quantidadesDoInsight, PESOS_PADRAO, faixaDoIndice } from './ponderada.js';

test('pontos = soma de quantidade x peso', () => {
  const r = calcularPonderada({ curtidas: 100, comentarios: 2, salvamentos: 3, compartilhamentos: 1, gasto: 50 });
  // 100*1 + 2*10 + 3*30 + 1*20 = 230
  assert.equal(r.pontos, 230);
  assert.equal(r.interacoes, 106);
});

test('custo por ponto = gasto / pontos', () => {
  const r = calcularPonderada({ curtidas: 100, gasto: 50 });
  assert.equal(r.custoPorPonto, 0.5);
});

test('qualidade = pontos / interacoes (quanto vale cada interacao)', () => {
  const r = calcularPonderada({ curtidas: 10, salvamentos: 10, gasto: 1 });
  // pontos 310, interacoes 20
  assert.equal(r.qualidade, 15.5);
});

test('sem interacao nenhuma nao divide por zero: devolve null e sem-dados', () => {
  const r = calcularPonderada({ gasto: 100 }, { meta: 0.2 });
  assert.equal(r.pontos, 0);
  assert.equal(r.custoPorPonto, null);
  assert.equal(r.qualidade, null);
  assert.equal(r.indice, null);
  assert.equal(r.faixa, 'sem-dados');
});

test('meta ausente ou zero nao gera indice', () => {
  const r = calcularPonderada({ curtidas: 100, gasto: 50 }, { meta: 0 });
  assert.equal(r.indice, null);
  assert.equal(r.faixa, 'sem-dados');
});

test('faixas do semaforo nas bordas exatas dos limiares', () => {
  // meta 1 => custoPorPonto = indice. 100 pontos, gasto = indice*100.
  const faixaCom = (indice) => calcularPonderada({ curtidas: 100, gasto: indice * 100 }, { meta: 1 }).faixa;
  assert.equal(faixaCom(0.80), 'escalar-forte');   // borda inferior inclusiva
  assert.equal(faixaCom(0.81), 'dentro-da-meta');
  assert.equal(faixaCom(1.00), 'dentro-da-meta');  // borda inclusiva
  assert.equal(faixaCom(1.01), 'manter');
  assert.equal(faixaCom(1.30), 'manter');          // borda inclusiva
  assert.equal(faixaCom(1.31), 'otimizar');
});

test('pesos e limiares customizados sobrescrevem os padroes', () => {
  const r = calcularPonderada({ curtidas: 10, gasto: 10 }, { pesos: { curtidas: 5 }, meta: 1 });
  assert.equal(r.pontos, 50);
  assert.equal(PESOS_PADRAO.curtidas, 1, 'nao pode mutar o padrao');
});

test('quantidadesDoInsight prefere a metrica LIQUIDA sobre a bruta', () => {
  const row = {
    spend: '30',
    actions: [
      { action_type: 'post_reaction', value: '100' },
      { action_type: 'onsite_conversion.post_net_like', value: '90' },
      { action_type: 'comment', value: '5' },
      { action_type: 'onsite_conversion.post_save', value: '7' },
      { action_type: 'post', value: '3' },
    ],
  };
  const q = quantidadesDoInsight(row);
  assert.equal(q.curtidas, 90, 'liquida vence a bruta');
  assert.equal(q.comentarios, 5, 'sem liquida, usa a bruta');
  assert.equal(q.salvamentos, 7);
  assert.equal(q.compartilhamentos, 3);
  assert.equal(q.gasto, 30);
});

test('liquida presente valendo ZERO e zero mesmo (nao cai pra bruta)', () => {
  const row = {
    spend: '10',
    actions: [
      { action_type: 'post_reaction', value: '100' },
      { action_type: 'onsite_conversion.post_net_like', value: '0' },
    ],
  };
  assert.equal(quantidadesDoInsight(row).curtidas, 0);
});

test('insight sem actions nao quebra', () => {
  const q = quantidadesDoInsight({ spend: '5' });
  assert.deepEqual(q, { curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, gasto: 5 });
});

test('faixaDoIndice é exportada e usa os limiares padrão quando não vierem', () => {
  assert.equal(faixaDoIndice(0.5), 'escalar-forte');
  assert.equal(faixaDoIndice(1.0), 'dentro-da-meta');
  assert.equal(faixaDoIndice(1.2), 'manter');
  assert.equal(faixaDoIndice(2), 'otimizar');
  assert.equal(faixaDoIndice(null), 'sem-dados');
});

test('faixaDoIndice respeita limiares customizados', () => {
  assert.equal(faixaDoIndice(0.9, { escalarForte: 0.95, dentroMeta: 1, manter: 1.1 }), 'escalar-forte');
});
