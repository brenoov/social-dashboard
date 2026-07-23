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

// Casa o canal de venda (nome) a um depósito físico. Aproxima por palavra-chave (Tivoli/Dom Pedro).
// Canal sem depósito casável -> só o Pulmão aparece.
export function depositosVisiveis(canalNome) {
  if (!canalNome || canalNome === 'todos') return DEPOSITOS.slice();
  const n = String(canalNome).toLowerCase();
  const loja = DEPOSITOS.find((d) => !d.pulmao && (
    (d.nome.toLowerCase().includes('tivoli') && n.includes('tivoli')) ||
    (d.nome.toLowerCase().includes('dom pedro') && n.includes('dom pedro')) ||
    (n.includes('pulmão') || n.includes('pulmao') || n.includes('atacado'))
  ));
  // pulmão sempre; se casou uma loja, ela vem antes
  return loja ? [loja, PULMAO] : [PULMAO];
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

export function filtrarPedidosPorCanal(pedidos, canalId) {
  if (canalId == null) return pedidos || [];
  return (pedidos || []).filter((p) => p.loja && p.loja.id === canalId);
}
