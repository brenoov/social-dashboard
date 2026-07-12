// Classificação comercial compartilhada — Matriz BCG por item (determinístico) e
// faixa ABC por faturamento acumulado. Extraído de gestor-comercial.mjs (_bcgClass),
// lógica IDÊNTICA — só reusada aqui pra outros consumidores (Estúdio etc.).
// Estrela = vende e gira; Vaca leiteira = vende muito mas com estoque alto; Interrogação
// = parado mas se mexeu recentemente (potencial); Abacaxi = parado e sem girar (liquidar).
export function bcgClass({ estoqueLoja, giro, diasSemVender }) {
  const estoque = Number(estoqueLoja) || 0;
  const g = Number(giro) || 0;
  const diasN = parseInt(diasSemVender, 10);
  const recente = Number.isFinite(diasN) && diasN <= 21;
  const st = g / Math.max(1, g + estoque);
  if (g > 0 && st >= 0.5) return 'Estrela';
  if (g > 0 && st >= 0.25) return 'Vaca leiteira';
  if (recente || g > 0) return 'Interrogação';
  return 'Abacaxi';
}

export function faixaABC(itens) {
  const ord = [...itens].sort((a, b) => (Number(b.faturamento) || 0) - (Number(a.faturamento) || 0));
  const total = ord.reduce((s, i) => s + (Number(i.faturamento) || 0), 0) || 1;
  let acc = 0;
  return ord.map((i) => {
    acc += Number(i.faturamento) || 0;
    const p = acc / total;
    return { ...i, faixa: p <= 0.8 ? 'A' : p <= 0.95 ? 'B' : 'C' };
  });
}
