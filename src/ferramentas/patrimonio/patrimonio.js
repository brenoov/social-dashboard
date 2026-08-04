// Lógica pura de patrimônio. Sem tocar em banco nem DOM — só transformação de dados,
// pra ser testável de verdade (o teste roda em node, sem subir a tela).

// Categorias sugeridas de bem. Não é trava no banco (a coluna aceita texto livre),
// é o que a tela oferece como opção. "Outro" sempre por último, é o escape.
export const CATEGORIAS_PATRIMONIO = ['TI', 'Móveis', 'Veículos', 'Telefonia', 'Outro']

// Dinheiro é guardado em CENTAVOS inteiros (nunca float — 0.1+0.2 já erra em float).
// Aqui só converte pra mostrar. Sem valor mostra travessão, não "R$ 0,00", porque
// "não informado" e "custou zero" são coisas diferentes.
export function formatarValor(centavos) {
  if (centavos === null || centavos === undefined) return '—'
  const reais = Math.trunc(centavos / 100)
  const resto = Math.abs(centavos % 100)
  const reaisStr = reais.toLocaleString('pt-BR')
  const centStr = String(resto).padStart(2, '0')
  return `R$ ${reaisStr},${centStr}`
}

// Texto que a pessoa digita -> centavos inteiros. Aceita os formatos que aparecem no
// dia a dia: "R$ 1.234,56", "1.234,56", "1234,56", "1234.56", "1234".
// Entrada inválida devolve null (não 0 — zero enganaria, pareceria um valor de verdade).
export function parsearValor(texto) {
  if (texto === null || texto === undefined) return null
  let s = String(texto).trim()
  if (!s) return null
  // tira "R$", espaços e qualquer coisa que não seja dígito, vírgula ou ponto
  s = s.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!/^[\d.,]+$/.test(s)) return null

  // Descobre qual é o separador decimal: o ÚLTIMO ponto ou vírgula manda.
  // "1.234,56" -> decimal é a vírgula; "1234.56" -> decimal é o ponto.
  const ultVirgula = s.lastIndexOf(',')
  const ultPonto = s.lastIndexOf('.')
  let inteiro
  let centavos = '00'
  if (ultVirgula === -1 && ultPonto === -1) {
    inteiro = s // sem decimal: reais cheios
  } else {
    const posDecimal = Math.max(ultVirgula, ultPonto)
    const parteInt = s.slice(0, posDecimal).replace(/[.,]/g, '') // tira separador de milhar
    const parteDec = s.slice(posDecimal + 1).replace(/[.,]/g, '')
    if (parteDec.length === 0) return null
    inteiro = parteInt || '0'
    centavos = (parteDec + '00').slice(0, 2) // completa/corta pra 2 casas
  }
  if (!/^\d+$/.test(inteiro)) return null
  return parseInt(inteiro, 10) * 100 + parseInt(centavos, 10)
}

// Ao trocar o dono de um item, o histórico de posse tem que fechar o dono anterior e
// abrir o novo — assim a gente sabe QUEM teve o quê e QUANDO. Função pura: devolve o
// que gravar, sem gravar. Idempotente: se o dono não mudou, não faz nada.
export function fecharEAbrirHistorico({ historicoAtual, novoDonoId, novoDonoNome, hoje }) {
  const lista = Array.isArray(historicoAtual) ? historicoAtual : []
  // O registro "aberto" é o que não tem data de fim (ate = null). Só pode haver um.
  const aberto = lista.find((h) => h && (h.ate === null || h.ate === undefined))

  // Dono não mudou: nada a fazer.
  if (aberto && aberto.pessoa_id === novoDonoId) {
    return { aFechar: null, aAbrir: null }
  }

  return {
    aFechar: aberto ? { id: aberto.id, ate: hoje } : null,
    aAbrir: { pessoa_id: novoDonoId, pessoa_nome: novoDonoNome, de: hoje, ate: null },
  }
}
