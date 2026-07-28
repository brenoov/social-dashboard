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
    metas,
  };
}

// Meta do balde; sem ela, tenta o 'padrao'; sem nenhum, devolve 0 — e 0 faz o
// cálculo devolver "sem-dados", que é melhor que inventar uma meta.
export function metaDoBalde(regua, balde) {
  const m = (regua && regua.metas) || {};
  if (m[balde] > 0) return m[balde];
  if (m.padrao > 0) return m.padrao;
  return 0;
}
