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

/**
 * O recorte de UM relatório — é isto que a tela chama, e não `filtrarPorRecorte`
 * direto.
 *
 * Existe por causa de um defeito real (10/08/2026): há relatório que se recorta
 * SOZINHO. O Resumo, em "Tudo", agrupa por marca; com uma marca escolhida, ele
 * mesmo desce e agrupa por local. Para o filtro genérico não cortar por cima
 * disso, o `pegarIds` dele devolvia `null` — só que o filtro compara por
 * IGUALDADE, e `null` nunca é igual a 'e1'. Escolher Vessel esvaziava a tabela:
 * "0 linhas · Vessel".
 *
 * A intenção agora é declarada, não deduzida de um valor nulo.
 */
export function aplicarRecorte(relatorio, linhas, recorte) {
  if (!relatorio) return []
  if (relatorio.recortaSozinho) return linhas || []
  return filtrarPorRecorte(linhas, recorte, relatorio.pegarIds)
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

/**
 * A frase de "isto aqui ficou de fora do recorte".
 *
 * A PALAVRA É PARÂMETRO por um motivo concreto: na Frota ela não pode ser
 * "marca". Lá `marca` já quer dizer Volvo, BMW, Fiat — e está preenchida nos 10
 * veículos, enquanto a empresa do grupo está vazia. O dono olhou a ficha, viu
 * "marca" preenchida e concluiu, com razão, que estava tudo certo. São dois
 * campos com o mesmo nome. Na Frota o filtro se chama "Empresa" (decisão dele,
 * 10/08/2026); no Patrimônio segue "marca".
 *
 * E o gênero muda com a palavra: "marca" e "empresa" pedem "apontada", "local"
 * pede "apontado". Uma frase só, com um dos dois cravado, escreveria "sem marca
 * apontado" na tela.
 */
export function avisoDeForaDoRecorte(modo, quantos, palavraDaMarca = 'marca') {
  if (!quantos) return ''
  const falta = modo === 'marca'
    ? `${palavraDaMarca} apontada`   // marca, empresa — femininas
    : 'local apontado'               // masculino
  return quantos === 1
    ? `1 linha ainda está sem ${falta} — ela só aparece em "Tudo".`
    : `${quantos} linhas ainda estão sem ${falta} — elas só aparecem em "Tudo".`
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
