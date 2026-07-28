// Filtro entre o banco e a conta. A tela NUNCA pode quebrar porque a linha da régua
// sumiu, veio pela metade ou com texto no lugar de número — aqui tudo vira número
// válido, caindo no padrão campo a campo. PURO: sem rede, sem tela.
import { PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

// Número positivo e finito; qualquer outra coisa devolve o padrão daquele campo.
function positivoOu(valor, padrao) {
  const n = Number(valor);
  return (Number.isFinite(n) && n > 0) ? n : padrao;
}

function completar(vindo, padrao) {
  const saida = {};
  for (const chave of Object.keys(padrao)) saida[chave] = positivoOu(vindo && vindo[chave], padrao[chave]);
  return saida;
}

// DOIS conjuntos de limiar, um por seção da régua (decisão do dono, 2026-07-28):
// `limiares` governa a Seção 1 (custo por ponto e por interação declarada);
// `limiares_resultado` governa a Seção 2 (custo por lead/conversa/venda/visita/
// mil impressões). A REGRA a lembrar: quem é DONO da meta é quem é DONO do
// limiar — cada seção tem sua própria meta (custo por ponto de um lado, custo
// por resultado do outro), então cada uma precisa poder "escalar forte" num
// multiplicador diferente (ex.: 0,8× pra engajamento, 0,9× pra vendas) sem que
// mexer numa mexa na outra. Os dois nascem com os MESMOS valores de fábrica
// (LIMIARES_PADRAO) porque é o mesmo ponto de partida — só divergem quando o
// dono ajustar um dos dois na tela.
export function normalizarRegua(linha) {
  const l = linha || {};
  const metas = {};
  for (const [balde, valor] of Object.entries(l.metas || {})) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) metas[balde] = n;
  }
  return {
    pesos: completar(l.pesos, PESOS_PADRAO),
    limiares: completar(l.limiares, LIMIARES_PADRAO),
    limiares_resultado: completar(l.limiares_resultado, LIMIARES_PADRAO),
    metas,
  };
}

// Meta do balde; sem meta salva PARA ESTE BALDE, devolve 0 — e 0 faz o cálculo
// devolver "sem-dados", que é melhor que inventar uma meta.
// NÃO existe mais reserva em 'padrao': desde a generalização de metas por
// objetivo (2026-07-28, ver alvos.js), cada balde tem sua PRÓPRIA unidade —
// R$ por ponto, R$ por lead, R$ por venda, R$ por visita, R$ por mil pessoas,
// R$ por conversa. Aplicar a meta de um balde a outro por "reserva" misturaria
// unidades diferentes como se fossem a mesma régua (I4 do review final,
// 2026-07-28). Se 'padrao' ainda aparecer salvo no banco (versão antiga ou
// restore), ele é ignorado de propósito aqui.
// SEMPRE devolve um número: texto é coercido, valores inválidos devolvem 0.
export function metaDoBalde(regua, balde) {
  const m = (regua && regua.metas) || {};
  if (m[balde] > 0) return Number(m[balde]);
  return 0;
}
