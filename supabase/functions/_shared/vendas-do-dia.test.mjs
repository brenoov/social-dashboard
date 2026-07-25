import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variacao, agregarVendasPorCanal, montarCorpo } from './vendas-do-dia.js';

test('variacao: fração normal e ontem=0 vira null', () => {
  assert.equal(variacao(120, 100), 0.2);
  assert.equal(variacao(80, 100), -0.2);
  assert.equal(variacao(50, 0), null);
  assert.equal(variacao(0, 0), null);
});

const lojas = [{ loja_id: 1, nome: 'Tivoli' }, { loja_id: 2, nome: 'Dom Pedro' }, { loja_id: 3, nome: 'Shopee' }];

test('agrega por canal: total, contagem, itens e % vs ontem', () => {
  const pedidosHoje = [
    { loja_id: 1, total: 3000, itens: 30 }, { loja_id: 1, total: 1200, itens: 10 },
    { loja_id: 2, total: 2100, itens: 22 },
  ];
  const pedidosOntem = [
    { loja_id: 1, total: 3750, itens: 41 },
    { loja_id: 2, total: 2283, itens: 20 },
  ];
  const agg = agregarVendasPorCanal({ pedidosHoje, pedidosOntem, lojas });
  assert.equal(agg.total.valor, 6300);
  assert.equal(agg.total.vendas, 3);
  assert.equal(agg.total.itens, 62);
  const tiv = agg.canais.find(c => c.loja_id === 1);
  assert.equal(tiv.valor, 4200);
  assert.equal(tiv.vendas, 2);
  assert.equal(tiv.itens, 40);
  assert.equal(tiv.pct.valor, 0.12); // (4200-3750)/3750
});

test('canal sem venda hoje aparece com zero; ontem=0 => pct null (novo)', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 3, total: 900, itens: 14 }],
    pedidosOntem: [],
    lojas,
  });
  const shopee = agg.canais.find(c => c.loja_id === 3);
  assert.equal(shopee.valor, 900);
  assert.equal(shopee.pct.valor, null); // ontem=0
  const domPedro = agg.canais.find(c => c.loja_id === 2);
  assert.equal(domPedro.valor, 0);
  assert.equal(domPedro.vendas, 0);
});

test('canais ordenados por faturamento desc', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 2, total: 100, itens: 1 }, { loja_id: 1, total: 500, itens: 1 }],
    pedidosOntem: [], lojas,
  });
  assert.deepEqual(agg.canais.map(c => c.loja_id), [1, 2, 3]);
});

test('total soma TODOS os pedidos (inclui loja fora de bling_lojas); hoje simétrico a ontem', () => {
  const agg = agregarVendasPorCanal({
    // loja 99 NÃO está em `lojas` (órfã) — tem que entrar no total, mas não na quebra
    pedidosHoje: [{ loja_id: 1, total: 500, itens: 5 }, { loja_id: 99, total: 300, itens: 3 }],
    pedidosOntem: [{ loja_id: 99, total: 200, itens: 2 }],
    lojas,
  });
  assert.equal(agg.total.valor, 800);      // 500 + 300 (inclui a órfã)
  assert.equal(agg.total.vendas, 2);
  assert.equal(agg.total.itens, 8);
  assert.equal(agg.total.pct.valor, 3);    // (800 - 200) / 200
  assert.ok(!agg.canais.find((c) => c.loja_id === 99)); // órfã não aparece na quebra
});

test('montarCorpo: título com total, quebra por canal e link da GV', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 1, total: 4200, itens: 40 }],
    pedidosOntem: [{ loja_id: 1, total: 3750, itens: 41 }], lojas,
  });
  const n = montarCorpo(agg);
  assert.match(n.title, /Vendas de hoje/);
  assert.match(n.title, /R\$/);
  assert.match(n.body, /Tivoli/);
  assert.equal(n.url, '/gestao-vista');
  assert.ok(!/parciais/i.test(n.body)); // nunca manda "parcial": ou é exato, ou nem envia
});

test('montarCorpo: rótulos configuráveis (recap da manhã = ontem vs anteontem)', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 1, total: 500, itens: 5 }],  // "referência" = ontem
    pedidosOntem: [{ loja_id: 1, total: 400, itens: 4 }], // "comparação" = anteontem
    lojas,
  });
  const n = montarCorpo(agg, { refLabel: 'ontem', cmpLabel: 'anteontem' });
  assert.match(n.title, /Vendas de ontem/);
  assert.match(n.body, /vs anteontem/);
});

test('montarCorpo: só entram canais com movimento HOJE (venda > 0)', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 1, total: 500, itens: 5 }],   // só Tivoli vendeu hoje
    pedidosOntem: [{ loja_id: 2, total: 900, itens: 9 }],  // Dom Pedro só vendeu ontem
    lojas,
  });
  const n = montarCorpo(agg, {});
  assert.match(n.body, /Tivoli/);
  assert.ok(!n.body.includes('Dom Pedro')); // parado hoje -> fora da notificação
  assert.ok(!n.body.includes('Shopee'));    // nunca vendeu -> fora
  assert.match(n.body, /vs ontem/);
});
