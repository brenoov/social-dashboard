// coletor/lib/comercial-canais.mjs
// Canais foco do Gestor Comercial + montagem PURA dos números por canal
// (faturamento real do Bling + ritmo de meta). Sem I/O — testável.
// Reusado pelo briefing semanal (gestor-comercial.mjs) e pelo atualizador
// diário dos cards (atualizar-cards-comercial.mjs). Extraído do inline do
// gestor-comercial.mjs sem mudar comportamento.
import { metaPace } from './meta-pace.mjs';

// Os 3 canais foco (loja_id do Bling). Fonte única de verdade.
export const CANAIS = [
  { nome: 'Shopping Tivoli (Santa Bárbara)', loja_id: '205834140' },
  { nome: 'Shopping Dom Pedro',              loja_id: '205657609' },
  { nome: 'Atacado Nuvem Shop',             loja_id: '205451611' },
];

// Soma o faturamento real (R$) por canal a partir dos pedidos do Bling.
// Só conta pedidos cuja loja.id casa com um canal foco. Idêntico ao trecho
// que estava inline no main() do gestor-comercial.mjs.
export function realPorCanalDe(pedidos, canais = CANAIS) {
  const realPorCanal = {};
  for (const c of canais) realPorCanal[c.loja_id] = 0;
  for (const p of (pedidos || [])) {
    const lid = String(p.loja?.id || '');
    if (lid in realPorCanal) realPorCanal[lid] += parseFloat(p.total || 0);
  }
  return realPorCanal;
}

// Monta o resumo por canal (nome + números do metaPace), casando cada canal
// com sua meta do mês. Idêntico ao canaisResumo inline do gestor-comercial.mjs.
export function canaisFocoDe({ canais = CANAIS, metas, realPorCanal, diaDoMes, diasNoMes }) {
  return canais.map(c => {
    const meta = (metas || []).find(mm => String(mm.loja_id) === c.loja_id);
    const pace = metaPace({ metaValor: meta?.meta_valor, dailyGoals: meta?.daily_goals, diaDoMes, diasNoMes, realizado: realPorCanal[c.loja_id] });
    return { canal: c.nome, ...pace };
  });
}
