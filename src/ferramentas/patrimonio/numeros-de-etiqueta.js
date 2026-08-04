// Os números das etiquetas: quais já estão colados num bem e quais sobraram.
// Lógica pura: não toca banco nem DOM.
//
// Por que isso vira tela: quem cadastra um bem precisa saber que número usar, e
// a resposta ("qual é o próximo livre?") não está em lugar nenhum hoje — a
// pessoa teria que varrer 341 linhas procurando buraco.

// Quantos números a numeração vai até, quando ninguém configurou nada. O dono
// já usa de 1 a 380, então 400 é o teto natural de partida.
export const TETO_PADRAO = 400

// Junta números seguidos numa faixa só. É o que faz a tela caber: "livres:
// 381–400" em vez de vinte etiquetas soltas.
// Recebe uma lista de números e devolve [{de, ate}] em ordem.
export function agruparEmFaixas(numeros) {
  const ordenados = [...new Set((numeros || []).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b)
  const faixas = []
  for (const n of ordenados) {
    const ultima = faixas[faixas.length - 1]
    if (ultima && n === ultima.ate + 1) ultima.ate = n
    else faixas.push({ de: n, ate: n })
  }
  return faixas
}

// Como a faixa aparece escrita: número sozinho não vira "7–7".
export function textoDaFaixa(f) {
  if (!f) return ''
  return f.de === f.ate ? String(f.de) : `${f.de}–${f.ate}`
}

// O retrato da numeração: quantos números existem, quantos estão em uso, quais
// sobraram (em faixas) e qual é o próximo livre.
export function mapaDeNumeros(bens, teto = TETO_PADRAO) {
  const limite = Number.isInteger(teto) && teto > 0 ? teto : TETO_PADRAO
  const usados = new Set()
  // Número fora do teto existe de verdade (veio da planilha) e não pode sumir do
  // relatório só porque não cabe na régua — ele aparece à parte.
  const acimaDoTeto = []
  for (const b of bens || []) {
    const n = b?.numero
    if (!Number.isInteger(n)) continue
    if (n > limite) acimaDoTeto.push(n)
    else usados.add(n)
  }
  const livres = []
  for (let n = 1; n <= limite; n++) if (!usados.has(n)) livres.push(n)

  return {
    teto: limite,
    usados: usados.size,
    livres: livres.length,
    semNumero: (bens || []).filter((b) => !Number.isInteger(b?.numero)).length,
    faixasLivres: agruparEmFaixas(livres),
    faixasUsadas: agruparEmFaixas([...usados]),
    proximoLivre: livres.length ? livres[0] : null,
    acimaDoTeto: agruparEmFaixas(acimaDoTeto),
  }
}

// Quanto o teto sobe quando a pessoa pede mais números. Sempre pra cima, nunca
// pra baixo: diminuir o teto esconderia etiqueta que já está colada num bem.
export function aumentarTeto(tetoAtual, quanto = 100) {
  const base = Number.isInteger(tetoAtual) && tetoAtual > 0 ? tetoAtual : TETO_PADRAO
  const passo = Number.isInteger(quanto) && quanto > 0 ? quanto : 100
  return base + passo
}

// Um bem é "novo" nas primeiras horas depois de cadastrado. Serve pra pessoa
// achar de volta o que acabou de criar, no meio de 341 itens.
// `agora` entra por parâmetro (não `Date.now()` aqui dentro) pra o teste poder
// fixar o relógio.
export function ehRecente(criadoEm, agora, horas = 24) {
  if (!criadoEm) return false
  const t = new Date(criadoEm).getTime()
  if (!Number.isFinite(t)) return false
  const fim = new Date(agora).getTime()
  if (!Number.isFinite(fim)) return false
  const diff = fim - t
  // Data no futuro (relógio do aparelho adiantado) não conta como recente nem
  // quebra: o selo é um carinho, não pode virar bug.
  if (diff < 0) return false
  return diff <= horas * 3600 * 1000
}
