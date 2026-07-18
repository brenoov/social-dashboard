// Lógica pura da LISTA/CONSOLIDADO de patrimônio. Sem tocar banco nem DOM — só
// transformação de dados, pra ser testável de verdade em node (sem subir a tela).
// O dinheiro (centavos) e o histórico de posse já têm sua lógica em patrimonio.js;
// aqui é só o que a aba consolidada e a ficha precisam: somar, filtrar, formatar data
// e montar o texto de uma linha de histórico.

// Soma os valores (em centavos) de uma lista de itens. Item sem valor (null/undefined)
// NÃO entra na conta — "não informado" não é zero. Devolve sempre um inteiro de centavos.
export function somarCentavos(itens) {
  const lista = Array.isArray(itens) ? itens : []
  return lista.reduce((tot, it) => {
    const v = it && it.valor_centavos
    // só soma número de verdade; string, null, undefined ou NaN são ignorados
    return typeof v === 'number' && Number.isFinite(v) ? tot + Math.trunc(v) : tot
  }, 0)
}

// Filtra os itens da aba consolidada. Cada critério é opcional: vazio/nulo = "todos".
// Casa exato (categoria, pessoa_id, status) porque são valores fechados, não busca livre.
export function filtrarItens(itens, filtro) {
  const lista = Array.isArray(itens) ? itens : []
  const f = filtro || {}
  return lista.filter((it) => {
    if (!it) return false
    if (f.categoria && it.categoria !== f.categoria) return false
    if (f.pessoaId && it.pessoa_id !== f.pessoaId) return false
    if (f.status && it.status !== f.status) return false
    return true
  })
}

// Data ISO (AAAA-MM-DD, como vem do Postgres 'date') -> 'DD/MM/AAAA' pra mostrar.
// Sem data devolve travessão. Não usa new Date() de propósito: 'date' não tem fuso,
// e new Date('2026-07-01') vira meia-noite UTC — no Brasil isso volta pro dia anterior.
export function formatarDataBR(iso) {
  if (!iso) return '—'
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return String(iso)
  return `${m[3]}/${m[2]}/${m[1]}`
}

// Monta o texto de UMA linha do histórico de posse: quem teve, de quando até quando.
// 'ate' nulo = ainda é o dono ("desde X · atual"). Motivo entra entre parênteses se houver.
export function textoLinhaHistorico(reg) {
  const r = reg || {}
  const quem = (r.pessoa_nome || '').trim() || 'Sem dono registrado'
  const de = formatarDataBR(r.de)
  let periodo
  if (r.ate === null || r.ate === undefined) {
    periodo = `desde ${de} · atual`
  } else {
    periodo = `${de} → ${formatarDataBR(r.ate)}`
  }
  const motivo = (r.motivo || '').trim()
  return motivo ? `${quem} · ${periodo} (${motivo})` : `${quem} · ${periodo}`
}

// Descobre o nome do dono ATUAL de um item a partir do mapa de pessoas por id.
// Se a pessoa saiu da base (ou o item está sem dono), devolve um rótulo honesto.
export function donoAtualNome(item, pessoasById) {
  const it = item || {}
  const mapa = pessoasById || {}
  if (!it.pessoa_id) return 'Sem dono'
  const p = mapa[it.pessoa_id]
  return (p && p.nome) || 'Pessoa removida'
}
