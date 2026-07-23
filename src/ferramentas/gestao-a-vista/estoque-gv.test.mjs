// src/ferramentas/gestao-a-vista/estoque-gv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOSITOS, statusSaldo, depositosVisiveis, prepararEstoque, filtrarPedidosPorCanal } from './estoque-gv.js';

test('statusSaldo: limiares default (crit<=3, low<=8)', () => {
  assert.equal(statusSaldo(0), 'crit'); assert.equal(statusSaldo(3), 'crit');
  assert.equal(statusSaldo(4), 'low'); assert.equal(statusSaldo(8), 'low');
  assert.equal(statusSaldo(9), 'ok');
});

test('depositosVisiveis: Pulmão sempre; canal casado mostra loja+Pulmão; todos=3', () => {
  assert.deepEqual(depositosVisiveis('').map(d=>d.id), [14888726315,14888617206,14888248253]);
  assert.deepEqual(depositosVisiveis('Shopping Tivoli').map(d=>d.id), [14888726315,14888248253]);
  // canal sem depósito casável -> só o Pulmão
  assert.deepEqual(depositosVisiveis('Loja Online').map(d=>d.id), [14888248253]);
});

test('prepararEstoque: busca + status + ordena + limita', () => {
  const itens = [
    {sku:'LV1',produto:'Bolsa Foggia',saldo:2},{sku:'LV2',produto:'Bolsa Porto',saldo:15},
    {sku:'LV3',produto:'Bolsa Pisa',saldo:6},{sku:'LV4',produto:'Bolsa Siena',saldo:20},
  ];
  // status crítico + ordena estoque asc
  let r = prepararEstoque(itens, {busca:'', status:'crit', sort:'qasc', limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['LV1']); assert.equal(r.full, 1);
  // busca por nome
  r = prepararEstoque(itens, {busca:'porto', status:'todos', sort:'qasc', limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['LV2']);
  // limite corta e full guarda o total
  r = prepararEstoque(itens, {busca:'', status:'todos', sort:'qasc', limit:2});
  assert.deepEqual(r.rows.map(x=>x.saldo), [2,6]); assert.equal(r.full, 4);
});

test('filtrarPedidosPorCanal', () => {
  const peds=[{loja:{id:1}},{loja:{id:2}},{loja:{id:1}}];
  assert.equal(filtrarPedidosPorCanal(peds, null).length, 3);
  assert.equal(filtrarPedidosPorCanal(peds, 1).length, 2);
});
