// Monta a grade do calendário mensal: semanas × 7 dias, com as peças de cada dia.
//
// Duas armadilhas moram aqui, e as duas já morderam este projeto antes:
//
// 1. FUSO. `publicar_em` vem do banco como timestamptz (UTC). Um post das 23h
//    de 9 de julho em Brasília chega como 2026-07-10T02:00:00Z. Se a gente
//    fatiasse a string ISO, ele apareceria no dia 10 — um dia errado, todo dia,
//    das 21h à meia-noite. Por isso a conversão passa por America/Sao_Paulo.
//
// 2. BURACO NA GRADE. Os quadros antes do dia 1 e depois do último dia vêm
//    preenchidos com os dias vizinhos (doMes: false), nunca com null. Grade com
//    buraco quebra o CSS grid e não tem onde soltar um cartão arrastado.
//
// A aritmética de dias é feita em UTC de propósito: aqui os dias são só rótulos
// ISO, e UTC não tem horário de verão para escorregar.

const TZ = 'America/Sao_Paulo'

export const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// O dia (BRT) em que uma peça deve aparecer no calendário. null se não tem data.
export function diaDaPeca(publicarEm) {
  if (!publicarEm) return null
  const d = new Date(publicarEm)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: TZ })   // 'en-CA' dá YYYY-MM-DD
}

// A hora BRT que a peça deve aparecer, como "18:30". String vazia se não tem data.
export function horaDaPeca(publicarEm) {
  if (!publicarEm) return ''
  const d = new Date(publicarEm)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

// "15/07 às 18:30" — o jeito que a data aparece nas listas e no histórico.
export function dataHoraBRT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dia = d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
  return `${dia} às ${horaDaPeca(iso)}`
}

// O que o <input type="datetime-local"> precisa receber e devolver: ele fala em
// hora local do NAVEGADOR, e a nossa hora local é sempre BRT. Sem esta conversão
// quem abrisse o painel de outro fuso agendaria para a hora errada.
export function paraCampoDeDataHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('en-CA', { timeZone: TZ })
  const hora = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  return `${dia}T${hora}`
}

export function deCampoDeDataHora(valor) {
  if (!valor) return null
  // O -03:00 fixo é BRT: o Brasil não tem mais horário de verão desde 2019.
  const d = new Date(`${valor}:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function _iso(data) {
  return data.toISOString().slice(0, 10)
}

// Monta o mês. `pecas` é a lista crua do banco; devolve também as que ficaram
// de fora por não ter data, para a tela poder mostrá-las numa gaveta lateral.
export function montarMes(ano, mes, pecas) {
  const lista = Array.isArray(pecas) ? pecas : []

  // Agrupa por dia BRT antes de montar a grade — assim cada quadro é uma busca
  // num objeto, e não uma varredura da lista inteira.
  const porDia = {}
  const semData = []
  for (const peca of lista) {
    const dia = diaDaPeca(peca?.publicar_em)
    if (!dia) { semData.push(peca); continue }
    ;(porDia[dia] ||= []).push(peca)
  }
  for (const dia of Object.keys(porDia)) {
    porDia[dia].sort((a, b) => String(a.publicar_em).localeCompare(String(b.publicar_em)))
  }

  const primeiro = new Date(Date.UTC(ano, mes - 1, 1))
  const ultimo = new Date(Date.UTC(ano, mes, 0))

  // Recua até o domingo anterior (ou fica, se o dia 1 já for domingo).
  const inicio = new Date(primeiro)
  inicio.setUTCDate(inicio.getUTCDate() - primeiro.getUTCDay())
  // Avança até o sábado seguinte.
  const fim = new Date(ultimo)
  fim.setUTCDate(fim.getUTCDate() + (6 - ultimo.getUTCDay()))

  const semanas = []
  let semana = []
  for (const cursor = new Date(inicio); cursor <= fim; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = _iso(cursor)
    semana.push({
      iso,
      numero: cursor.getUTCDate(),
      doMes: cursor.getUTCMonth() === mes - 1 && cursor.getUTCFullYear() === ano,
      pecas: porDia[iso] || [],
    })
    if (semana.length === 7) { semanas.push(semana); semana = [] }
  }

  return { ano, mes, nomeDoMes: NOMES_DOS_MESES[mes - 1], semanas, semData }
}
