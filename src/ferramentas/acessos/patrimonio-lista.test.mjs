// Testes da lógica pura da lista/consolidado de patrimônio: somar valores, filtrar
// por categoria/pessoa/status, formatar data e montar o texto do histórico de posse.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  somarCentavos,
  filtrarItens,
  formatarDataBR,
  textoLinhaHistorico,
  donoAtualNome,
} from './patrimonio-lista.js'

// --- somarCentavos: soma em inteiro, ignora "não informado" ---
test('somarCentavos soma só os valores informados', () => {
  const itens = [
    { valor_centavos: 100000 },
    { valor_centavos: 50 },
    { valor_centavos: null }, // não informado: NÃO é zero, fica de fora
    { valor_centavos: undefined },
    {}, // sem a chave
  ]
  assert.equal(somarCentavos(itens), 100050)
})

test('somarCentavos de lista vazia/inválida é 0', () => {
  assert.equal(somarCentavos([]), 0)
  assert.equal(somarCentavos(null), 0)
  assert.equal(somarCentavos(undefined), 0)
})

test('somarCentavos ignora valor que não é número (nada de float/NaN)', () => {
  assert.equal(somarCentavos([{ valor_centavos: '123' }, { valor_centavos: NaN }, { valor_centavos: 200 }]), 200)
})

// --- filtrarItens: cada critério é opcional (vazio = todos) ---
const AMOSTRA = [
  { id: 'a', categoria: 'TI', pessoa_id: 'p1', status: 'em_uso' },
  { id: 'b', categoria: 'Veículos', pessoa_id: 'p1', status: 'devolvido' },
  { id: 'c', categoria: 'TI', pessoa_id: 'p2', status: 'em_uso' },
]

test('filtrarItens sem filtro devolve todos', () => {
  assert.equal(filtrarItens(AMOSTRA, {}).length, 3)
  assert.equal(filtrarItens(AMOSTRA, null).length, 3)
})

test('filtrarItens por categoria', () => {
  const r = filtrarItens(AMOSTRA, { categoria: 'TI' })
  assert.deepEqual(r.map((x) => x.id), ['a', 'c'])
})

test('filtrarItens por pessoa e status combinados', () => {
  const r = filtrarItens(AMOSTRA, { pessoaId: 'p1', status: 'em_uso' })
  assert.deepEqual(r.map((x) => x.id), ['a'])
})

test('filtrarItens por status inexistente devolve vazio', () => {
  assert.equal(filtrarItens(AMOSTRA, { status: 'perdido' }).length, 0)
})

// --- formatarDataBR: ISO -> DD/MM/AAAA, sem sofrer com fuso ---
test('formatarDataBR converte AAAA-MM-DD em DD/MM/AAAA', () => {
  assert.equal(formatarDataBR('2026-07-01'), '01/07/2026')
  assert.equal(formatarDataBR('2026-12-25'), '25/12/2026')
})

test('formatarDataBR aceita timestamp (corta na data)', () => {
  assert.equal(formatarDataBR('2026-07-01T10:00:00Z'), '01/07/2026')
})

test('formatarDataBR sem data mostra travessão', () => {
  assert.equal(formatarDataBR(null), '—')
  assert.equal(formatarDataBR(''), '—')
})

// --- textoLinhaHistorico: quem teve, de-até ---
test('textoLinhaHistorico com posse atual (ate=null)', () => {
  assert.equal(
    textoLinhaHistorico({ pessoa_nome: 'Ana', de: '2026-07-01', ate: null }),
    'Ana · desde 01/07/2026 · atual',
  )
})

test('textoLinhaHistorico com período fechado e motivo', () => {
  assert.equal(
    textoLinhaHistorico({ pessoa_nome: 'Bruno', de: '2026-01-10', ate: '2026-07-01', motivo: 'trocou de setor' }),
    'Bruno · 10/01/2026 → 01/07/2026 (trocou de setor)',
  )
})

test('textoLinhaHistorico sem nome usa rótulo honesto', () => {
  assert.equal(textoLinhaHistorico({ de: '2026-07-01', ate: null }), 'Sem dono registrado · desde 01/07/2026 · atual')
})

// --- donoAtualNome ---
test('donoAtualNome resolve pelo mapa de pessoas', () => {
  const mapa = { p1: { nome: 'Ana' } }
  assert.equal(donoAtualNome({ pessoa_id: 'p1' }, mapa), 'Ana')
})

test('donoAtualNome é honesto quando não há dono ou a pessoa sumiu', () => {
  assert.equal(donoAtualNome({ pessoa_id: null }, {}), 'Sem dono')
  assert.equal(donoAtualNome({ pessoa_id: 'sumida' }, {}), 'Pessoa removida')
})
