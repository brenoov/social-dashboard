// Traduz a config de orçamento do Estúdio (por loja) nos campos de budget do Meta.
// orcamento = { modo:'ABO'|'CBO', tipo:'diario'|'total', valor:<centavos>, inicio?, fim? }.
// ABO = orçamento no CONJUNTO; CBO = orçamento na CAMPANHA (a Meta divide entre conjuntos).
// Total (lifetime) exige start_time/end_time (sempre no adset — pacing do conjunto).
// Sem config -> ABO/diario/defaultDaily = comportamento atual (retrocompat byte-idêntico).

export function normalizarOrcamento(orcamento, defaultDaily = 5000) {
  if (!orcamento) return { modo: 'ABO', tipo: 'diario', valor: defaultDaily };
  return {
    modo: orcamento.modo === 'CBO' ? 'CBO' : 'ABO',
    tipo: orcamento.tipo === 'total' ? 'total' : 'diario',
    valor: orcamento.valor ?? defaultDaily,
    ...(orcamento.inicio !== undefined ? { inicio: orcamento.inicio } : {}),
    ...(orcamento.fim !== undefined ? { fim: orcamento.fim } : {}),
  };
}

export function orcamentoMeta(orcamento, defaultDaily = 5000) {
  const o = normalizarOrcamento(orcamento, defaultDaily);
  const campaign = {};
  const adset = {};
  const alvo = o.modo === 'CBO' ? campaign : adset;
  if (o.tipo === 'total') {
    alvo.lifetime_budget = o.valor;
    adset.start_time = o.inicio;   // datas SEMPRE no adset (pacing do conjunto), mesmo em CBO
    adset.end_time = o.fim;
  } else {
    alvo.daily_budget = o.valor;
  }
  return { campaign, adset };
}
