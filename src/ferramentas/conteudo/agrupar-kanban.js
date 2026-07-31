// Agrupa as peças nas colunas do quadro (kanban).
//
// As colunas são FIXAS e sempre todas aparecem, mesmo vazias: uma coluna que
// some quando esvazia deixa o usuário sem lugar para soltar o cartão arrastado.
//
// "Reprovada" e "Arquivada" não viram coluna de propósito — são becos, não
// etapas do trabalho. Elas aparecem na visão de lista, com filtro próprio.

import { STATUS, rotuloDeStatus, corDeStatus } from './estados.js'

export const COLUNAS_KANBAN = ['rascunho', 'em_aprovacao', 'aprovada', 'agendada', 'publicada']

// Dentro da coluna: quem tem data marcada vem primeiro, em ordem de horário;
// quem ainda não tem data desce para o fim (é o que falta resolver).
function _porData(a, b) {
  const da = a?.publicar_em
  const db = b?.publicar_em
  if (da && db) return String(da).localeCompare(String(db))
  if (da) return -1
  if (db) return 1
  return 0
}

export function agruparPorStatus(pecas) {
  const lista = Array.isArray(pecas) ? pecas : []

  const baldes = Object.fromEntries(COLUNAS_KANBAN.map(c => [c, []]))
  for (const peca of lista) {
    // Status fora das colunas (arquivada, reprovada, ou lixo) é ignorado aqui.
    if (baldes[peca?.status]) baldes[peca.status].push(peca)
  }

  return COLUNAS_KANBAN.map((chave) => {
    // [...] antes do sort: ordenar o balde não pode reordenar a lista de quem chamou.
    const ordenadas = [...baldes[chave]].sort(_porData)
    return {
      chave,
      rotulo: rotuloDeStatus(chave),
      cor: corDeStatus(chave),
      pecas: ordenadas,
      total: ordenadas.length,
    }
  })
}

// Conta TODOS os status, inclusive os que não viram coluna — é o que alimenta
// os selos da topbar ("3 esperando aprovação", "2 reprovadas").
export function contarPorStatus(pecas) {
  const contagem = Object.fromEntries(STATUS.map(s => [s.chave, 0]))
  for (const peca of Array.isArray(pecas) ? pecas : []) {
    if (peca?.status in contagem) contagem[peca.status]++
  }
  return contagem
}
