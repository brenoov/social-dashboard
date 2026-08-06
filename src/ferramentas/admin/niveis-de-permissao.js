// A ESCADA DE NÍVEIS DO EDITOR DE PERMISSÕES.
//
// POR QUE EXISTE: a matriz antiga era 21 ferramentas × 5 colunas = 105 células,
// das quais só 45 existiam de verdade (a coluna "excluir" tinha 4 caixinhas em
// 21 linhas). Mais da metade da grade era buraco.
//
// POR QUE DÁ PARA SIMPLIFICAR SEM PERDER NADA: medido em 2026-08-06 nas 17
// pessoas, NENHUMA ferramenta tem mais de 2 conjuntos de ações em uso — e todos
// os pares são encaixados. O poder que a matriz oferecia nunca foi usado.
//
// PURO DE PROPÓSITO: recebe o recurso por parâmetro e não importa nada. O teste
// ao lado prova que a escada reproduz todos os conjuntos gravados em produção.
//
// NÃO INVENTA AÇÃO: todo degrau só usa ação que está no catálogo daquele
// recurso. Um degrau que concede ação inexistente é um degrau que mente.

const contem = (acoes, a) => acoes.includes(a)

// Os degraus de UM recurso, do menor para o maior. Recurso que só tem 'ver'
// ganha dois; recurso completo ganha quatro.
export function degrausDoRecurso(recurso) {
  const A = (recurso && recurso.acoes) || []
  const out = [{ chave: 'sem', rotulo: 'Sem acesso', acoes: [] }]
  if (!A.length) return out

  const temVer = contem(A, 'ver')

  // Só dá para ver: o segundo degrau é o único, então o rótulo é afirmativo.
  if (A.length === 1 && temVer) {
    out.push({ chave: 'ver', rotulo: 'Pode ver', acoes: ['ver'] })
    return out
  }

  // GUARDA: só insere o degrau "Só ver" (e qualquer outro que hard-codifique
  // 'ver' no seu conjunto) se o catálogo deste recurso realmente tiver essa
  // ação. Antes, esta linha era incondicional — assumia que todo recurso tem
  // 'ver', contradizendo o "NÃO INVENTA AÇÃO" do topo do arquivo. Hoje nenhum
  // recurso real está nessa situação, mas o próximo pode estar.
  if (temVer) out.push({ chave: 'ver', rotulo: 'Só ver', acoes: ['ver'] })

  const mexe = contem(A, 'editar')
  const cria = contem(A, 'criar') || contem(A, 'excluir')

  // Ferramenta de leitura: ver e baixar, e acabou.
  if (temVer && contem(A, 'exportar') && !mexe && !cria) {
    out.push({ chave: 'exportar', rotulo: 'Ver e baixar', acoes: ['ver', 'exportar'] })
    return out
  }

  // "Mexer" é editar o que já existe — NÃO inclui criar nem excluir. É o degrau
  // das 6 pessoas da Frota, que registram uso sem poder cadastrar veículo.
  if (temVer && mexe) {
    const acoes = ['ver', 'editar']
    if (contem(A, 'exportar')) acoes.push('exportar')
    out.push({ chave: 'mexer', rotulo: 'Ver e mexer', acoes })
  }

  // "Tudo" é o catálogo inteiro. Só aparece quando há criar ou excluir — senão
  // seria igual ao degrau anterior, e degrau repetido confunde.
  if (cria) out.push({ chave: 'tudo', rotulo: 'Tudo', acoes: A.slice() })

  return out
}

const mesmoConjunto = (a, b) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

// Qual degrau corresponde a este conjunto de ações?
//
// Devolve `null` quando nenhum corresponde — e quem chama DEVE preservar o
// conjunto original nesse caso. Aproximar para o degrau mais próximo mudaria o
// acesso de alguém sem ninguém ter pedido.
export function degrauDoConjunto(recurso, acoes) {
  const atual = acoes || []
  for (const d of degrausDoRecurso(recurso)) {
    if (mesmoConjunto(d.acoes, atual)) return d.chave
  }
  return null
}

export function acoesDoDegrau(recurso, chave) {
  const d = degrausDoRecurso(recurso).find((x) => x.chave === chave)
  return d ? d.acoes.slice() : []
}
