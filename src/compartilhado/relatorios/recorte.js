// O recorte dos relatórios: tudo, uma marca inteira, ou um local só.
//
// POR QUE O LOCAL NUNCA APARECE SOZINHO NA LISTA
// ----------------------------------------------
// Medido no banco em 10/08/2026: "Fábrica Conchal" existe em DUAS marcas
// (Vessel, 148 bens; RB Builders, 2) e "Sede Limeira" também (RBV Company, 40;
// Vessel, 10). A migration 034 já tinha escrito o motivo: "o defeito real é a
// tela mostrar 'Fábrica Conchal' duas vezes sem dizer de quem é — quem escolhe
// não tem como acertar". Um relatório com o recorte errado é pior que nenhum,
// porque ninguém desconfia dele.

import { listarLocais } from '../arvore-de-locais.js'

export const RECORTE_VAZIO = { modo: 'tudo', empresaId: '', localId: '' }

/** Só as linhas do recorte escolhido. `pegarIds` diz onde, NAQUELA linha, moram
 * a marca e o local — cada relatório guarda isso num campo diferente. */
export function filtrarPorRecorte(linhas, recorte, pegarIds) {
  const lista = (linhas || []).filter(Boolean)
  const r = recorte || RECORTE_VAZIO
  if (r.modo === 'marca' && r.empresaId) {
    return lista.filter((l) => pegarIds(l).empresaId === r.empresaId)
  }
  if (r.modo === 'local' && r.localId) {
    return lista.filter((l) => pegarIds(l).localId === r.localId)
  }
  // 'tudo', ou escolha pela metade: devolve tudo. Nunca esconde linha.
  return lista
}

/** Quantos ficaram fora de qualquer recorte. É o número que a tela precisa
 * mostrar para a pessoa não achar que sumiu dado. */
export function contarForaDoRecorte(linhas, pegarIds) {
  const lista = (linhas || []).filter(Boolean)
  let semMarca = 0
  let semLocal = 0
  for (const l of lista) {
    const { empresaId, localId } = pegarIds(l)
    if (!empresaId) semMarca++
    if (!localId) semLocal++
  }
  return { semMarca, semLocal }
}

/** Os locais para o seletor, com a marca SEMPRE na frente. */
export function opcoesDeLocal(arvore) {
  return listarLocais(arvore).map((l) => ({
    id: l.id,
    rotulo: [l.empresaNome, l.nome].filter(Boolean).join(' › '),
  }))
}

/** O recorte escrito por extenso, para o cabeçalho da folha e da tela. */
export function rotuloDoRecorte(recorte, { empresas, locais } = {}) {
  const r = recorte || RECORTE_VAZIO
  const nomeEmpresa = (id) => (empresas || []).find((e) => e.id === id)?.nome || 'Sem marca'
  const nomeLocal = (id) => (locais || []).find((l) => l.id === id)?.nome || 'Sem local'
  if (r.modo === 'marca' && r.empresaId) return nomeEmpresa(r.empresaId)
  if (r.modo === 'local' && r.localId) {
    const loc = (locais || []).find((l) => l.id === r.localId)
    return [nomeEmpresa(loc?.empresa_id), nomeLocal(r.localId)].filter(Boolean).join(' › ')
  }
  return 'Tudo'
}
