// src/ferramentas/gestao-a-vista/estoque-gv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOSITOS, statusSaldo, depositosVisiveis, prepararEstoque, filtrarPedidosPorCanal, ehMateriaPrima, categoriasDisponiveis } from './estoque-gv.js';

test('statusSaldo: limiares default (crit<=3, low<=8)', () => {
  assert.equal(statusSaldo(0), 'crit'); assert.equal(statusSaldo(3), 'crit');
  assert.equal(statusSaldo(4), 'low'); assert.equal(statusSaldo(8), 'low');
  assert.equal(statusSaldo(9), 'ok');
});

test('depositosVisiveis: Pulmão sempre; canal casado mostra loja+Pulmão; todos=3', () => {
  assert.deepEqual(depositosVisiveis([]).map(d=>d.id), [14888726315,14888617206,14888248253]);
  assert.deepEqual(depositosVisiveis(['Shopping Tivoli']).map(d=>d.id), [14888726315,14888248253]);
  // canal sem depósito casável -> só o Pulmão
  assert.deepEqual(depositosVisiveis(['Loja Online']).map(d=>d.id), [14888248253]);
  // regressão: canal "atacado/pulmão" não deve casar a loja Tivoli por engano
  assert.deepEqual(depositosVisiveis(['Atacado Nuvem Shop']).map(d=>d.id), [14888248253]);
  assert.deepEqual(depositosVisiveis(['Shopping Dom Pedro']).map(d=>d.id), [14888617206,14888248253]);
  // multi-select: união de dois canais casados -> Tivoli, Dom Pedro, Pulmão (ordem DEPOSITOS)
  assert.deepEqual(depositosVisiveis(['Shopping Tivoli','Shopping Dom Pedro']).map(d=>d.id), [14888726315,14888617206,14888248253]);
  // conjunto vazio explícito -> os 3
  assert.deepEqual(depositosVisiveis(new Set()).map(d=>d.id), [14888726315,14888617206,14888248253]);
});

test('prepararEstoque: busca + status + ordena + limita', () => {
  const itens = [
    {sku:'LV1',produto:'Bolsa Foggia',saldo:2,categoria:'Bolsa (outros)'},{sku:'LV2',produto:'Bolsa Porto',saldo:15,categoria:'Bolsa (outros)'},
    {sku:'LV3',produto:'Bolsa Pisa',saldo:6,categoria:'Bolsa (outros)'},{sku:'LV4',produto:'Bolsa Siena',saldo:20,categoria:'Bolsa (outros)'},
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

test('ehMateriaPrima: categoria vazia/nula/whitespace = insumo; categoria real = produto', () => {
  assert.equal(ehMateriaPrima({sku:'X',categoria:null}), true);
  assert.equal(ehMateriaPrima({sku:'X'}), true);              // sem a chave
  assert.equal(ehMateriaPrima({sku:'X',categoria:''}), true);
  assert.equal(ehMateriaPrima({sku:'X',categoria:'   '}), true);
  assert.equal(ehMateriaPrima(null), true);
  assert.equal(ehMateriaPrima({sku:'X',categoria:'Cinto'}), false);
});

test('prepararEstoque: oculta matéria-prima (categoria vazia) por regra fixa', () => {
  const itens = [
    {sku:'LV1',produto:'Cinto Astana',saldo:5,categoria:'Cinto'},
    {sku:'EMB1',produto:'Bobina Papel Embalagem',saldo:99,categoria:null}, // insumo
    {sku:'AV1',produto:'Fivela a granel',saldo:99,categoria:''},           // insumo
  ];
  const r = prepararEstoque(itens, {status:'todos', limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['LV1']); assert.equal(r.full, 1);
});

test('prepararEstoque: filtro por categoria (multi-seleção)', () => {
  const itens = [
    {sku:'A',produto:'Cinto A',saldo:5,categoria:'Cinto'},
    {sku:'B',produto:'Bolsa B',saldo:5,categoria:'Tote'},
    {sku:'C',produto:'Cinto C',saldo:5,categoria:'Cinto'},
    {sku:'D',produto:'Óculos D',saldo:5,categoria:'Óculos'},
  ];
  // uma categoria
  let r = prepararEstoque(itens, {categorias:['Cinto'], limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku).sort(), ['A','C']);
  // várias categorias (união)
  r = prepararEstoque(itens, {categorias:['Cinto','Óculos'], limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku).sort(), ['A','C','D']);
  // aceita Set
  r = prepararEstoque(itens, {categorias:new Set(['Tote']), limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['B']);
  // vazio/null = todas
  assert.equal(prepararEstoque(itens, {categorias:[], limit:'all'}).full, 4);
  assert.equal(prepararEstoque(itens, {limit:'all'}).full, 4);
});

test('categoriasDisponiveis: únicas, sem matéria-prima, ordenadas pt-BR', () => {
  const itens = [
    {sku:'A',categoria:'Óculos'},{sku:'B',categoria:'Cinto'},{sku:'C',categoria:'Cinto'},
    {sku:'D',categoria:null},{sku:'E',categoria:'Bolsa de ombro'},
  ];
  assert.deepEqual(categoriasDisponiveis(itens), ['Bolsa de ombro','Cinto','Óculos']);
});

test('filtrarPedidosPorCanal', () => {
  const peds=[{loja:{id:1}},{loja:{id:2}},{loja:{id:1}}];
  assert.equal(filtrarPedidosPorCanal(peds, null).length, 3);
  assert.equal(filtrarPedidosPorCanal(peds, []).length, 3);
  assert.equal(filtrarPedidosPorCanal(peds, [1]).length, 2);
  // multi-select: união de dois canais
  assert.equal(filtrarPedidosPorCanal(peds, [1,2]).length, 3);
  assert.deepEqual(filtrarPedidosPorCanal(peds, [2]).map(p=>p.loja.id), [2]);
  // aceita Set também
  assert.equal(filtrarPedidosPorCanal(peds, new Set([1,2])).length, 3);
});
