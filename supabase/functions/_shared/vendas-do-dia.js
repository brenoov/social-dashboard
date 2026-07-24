// Lógica pura (sem rede) de agregação das vendas do dia por canal e montagem do
// corpo da notificação. Importada pela Edge enviar-push-vendas E testada por node --test.

export function variacao(hoje, ontem) {
  if (!ontem) return null;              // ontem 0/undefined -> "novo"/"—", nunca +∞
  return (hoje - ontem) / ontem;
}

function metricasVazias() { return { valor: 0, vendas: 0, itens: 0 }; }

function somaPorLoja(pedidos) {
  const m = new Map();
  for (const p of (pedidos || [])) {
    const k = p.loja_id;
    const cur = m.get(k) || metricasVazias();
    cur.valor += Number(p.total) || 0;
    cur.vendas += 1;
    cur.itens += Number(p.itens) || 0;
    m.set(k, cur);
  }
  return m;
}

function comPct(hoje, ontem) {
  return {
    valor: hoje.valor, vendas: hoje.vendas, itens: hoje.itens,
    pct: {
      valor: variacao(hoje.valor, ontem.valor),
      vendas: variacao(hoje.vendas, ontem.vendas),
      itens: variacao(hoje.itens, ontem.itens),
    },
  };
}

export function agregarVendasPorCanal({ pedidosHoje, pedidosOntem, lojas }) {
  const hoje = somaPorLoja(pedidosHoje);
  const ontem = somaPorLoja(pedidosOntem);

  const canais = (lojas || []).map((l) => {
    const h = hoje.get(l.loja_id) || metricasVazias();
    const o = ontem.get(l.loja_id) || metricasVazias();
    return { loja_id: l.loja_id, nome: l.nome, ...comPct(h, o) };
  }).sort((a, b) => b.valor - a.valor);

  const soma = (arr, campo) => arr.reduce((s, x) => s + x[campo], 0);
  const totH = { valor: soma(canais, 'valor'), vendas: soma(canais, 'vendas'), itens: soma(canais, 'itens') };
  const totO = {
    valor: [...ontem.values()].reduce((s, x) => s + x.valor, 0),
    vendas: [...ontem.values()].reduce((s, x) => s + x.vendas, 0),
    itens: [...ontem.values()].reduce((s, x) => s + x.itens, 0),
  };
  return { total: comPct(totH, totO), canais };
}

function brl(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function pctStr(p) {
  if (p === null || p === undefined) return 'novo';
  const s = Math.round(p * 100);
  return (s > 0 ? '+' : '') + s + '%';
}

export function montarCorpo(agg, { parcial } = {}) {
  const t = agg.total;
  const title = `Vendas de hoje · ${brl(t.valor)} (${pctStr(t.pct.valor)})`;
  const linhas = [
    `${t.vendas} vendas (${pctStr(t.pct.vendas)}) · ${t.itens} itens (${pctStr(t.pct.itens)})`,
    '──────────────',
    ...agg.canais.map((c) => `${c.nome}  ${brl(c.valor)} (${pctStr(c.pct.valor)})`),
  ];
  if (parcial) linhas.push('⚠️ dados parciais (Bling instável às 22h)');
  return { title, body: linhas.join('\n'), url: '/gestao-a-vista', tag: 'vendas-do-dia' };
}
