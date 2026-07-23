// Lógica pura do filtro por canal + seção de estoque da Gestão à Vista. Sem Vue/DOM (node-testável).
export const DEPOSITOS = [
  { id: 14888726315, nome: 'Shopping Tivoli',   pulmao: false },
  { id: 14888617206, nome: 'Shopping Dom Pedro', pulmao: false },
  { id: 14888248253, nome: 'Estoque Pulmão',     pulmao: true  },
];
const PULMAO = DEPOSITOS.find((d) => d.pulmao);

export function statusSaldo(saldo, { crit = 3, low = 8 } = {}) {
  const q = Number(saldo) || 0;
  return q <= crit ? 'crit' : q <= low ? 'low' : 'ok';
}

// Casa os canais de venda (nomes) aos depósitos físicos. Aproxima por palavra-chave
// (Tivoli/Dom Pedro). Aceita array/Set de nomes -> retorna a UNIÃO dos depósitos
// casados, sempre com o Pulmão, deduplicados, na ordem de DEPOSITOS.
// Vazio/null -> todos os depósitos.
export function depositosVisiveis(canaisNomes) {
  const nomes = canaisNomes == null ? [] : Array.from(canaisNomes).filter((n) => n && n !== 'todos');
  if (nomes.length === 0) return DEPOSITOS.slice();
  const nomesLower = nomes.map((n) => String(n).toLowerCase());
  const lojasCasadas = new Set();
  for (const n of nomesLower) {
    const loja = DEPOSITOS.find((d) => !d.pulmao && (
      (d.nome.toLowerCase().includes('tivoli') && n.includes('tivoli')) ||
      (d.nome.toLowerCase().includes('dom pedro') && n.includes('dom pedro'))
    ));
    if (loja) lojasCasadas.add(loja.id);
  }
  // pulmão sempre; ordem = ordem de DEPOSITOS
  return DEPOSITOS.filter((d) => d.pulmao || lojasCasadas.has(d.id));
}

export function prepararEstoque(itens, { busca = '', status = 'todos', sort = 'qasc', limit = 'all' } = {}) {
  const b = String(busca).trim().toLowerCase();
  let rows = (itens || []).filter((it) => {
    if (b && !(String(it.sku).toLowerCase().includes(b) || String(it.produto || '').toLowerCase().includes(b))) return false;
    const s = statusSaldo(it.saldo);
    return status === 'todos' || (status === 'crit' && s === 'crit') || (status === 'baixocrit' && (s === 'crit' || s === 'low'));
  });
  rows.sort((a, b2) => {
    if (sort === 'qasc') return a.saldo - b2.saldo;
    if (sort === 'qdesc') return b2.saldo - a.saldo;
    if (sort === 'sku') return String(a.sku) < String(b2.sku) ? -1 : 1;
    return String(a.produto || '') < String(b2.produto || '') ? -1 : 1;
  });
  const full = rows.length;
  if (limit !== 'all') rows = rows.slice(0, Number(limit) || full);
  return { rows, full };
}

// canaisIds: array/Set de loja.id selecionados. Vazio/null -> todos os pedidos.
export function filtrarPedidosPorCanal(pedidos, canaisIds) {
  const ids = canaisIds == null ? [] : Array.from(canaisIds);
  if (ids.length === 0) return pedidos || [];
  const set = new Set(ids);
  return (pedidos || []).filter((p) => p.loja && set.has(p.loja.id));
}
