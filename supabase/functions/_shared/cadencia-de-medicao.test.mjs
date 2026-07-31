import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIAS_DE_ACOMPANHAMENTO, precisaMedir, lerMetricas } from './cadencia-de-medicao.js'

const HOJE = new Date('2026-07-20T12:00:00Z')
const dias = (n) => new Date(HOJE.getTime() - n * 86400000).toISOString()

test('acompanha por 30 dias', () => {
  assert.equal(DIAS_DE_ACOMPANHAMENTO, 30)
})

test('peca publicada hoje e medida', () => {
  assert.equal(precisaMedir({ publicado_em: dias(0) }, null, HOJE), true)
})

test('na primeira semana mede todo dia', () => {
  // Medida ontem, publicada ha 3 dias: mede de novo hoje.
  assert.equal(precisaMedir({ publicado_em: dias(3) }, '2026-07-19', HOJE), true)
})

test('nao mede duas vezes no mesmo dia', () => {
  // A cadencia e diaria, e a chave da tabela e (peca, dia): medir de novo so
  // gastaria cota da Meta para reescrever a mesma linha.
  assert.equal(precisaMedir({ publicado_em: dias(3) }, '2026-07-20', HOJE), false)
})

test('depois de 7 dias passa a medir uma vez por semana', () => {
  const peca = { publicado_em: dias(15) }
  assert.equal(precisaMedir(peca, '2026-07-19', HOJE), false, 'medida ontem: ainda nao')
  assert.equal(precisaMedir(peca, '2026-07-12', HOJE), true, 'medida ha 8 dias: mede')
})

test('depois de 30 dias para de medir', () => {
  // Post velho nao muda mais, e a cota da Graph e finita.
  assert.equal(precisaMedir({ publicado_em: dias(31) }, '2026-06-25', HOJE), false)
  assert.equal(precisaMedir({ publicado_em: dias(60) }, null, HOJE), false)
})

test('peca sem data de publicacao nao e medida', () => {
  assert.equal(precisaMedir({ publicado_em: null }, null, HOJE), false)
  assert.equal(precisaMedir({}, null, HOJE), false)
  assert.equal(precisaMedir(null, null, HOJE), false)
})

test('data invalida nao quebra', () => {
  assert.equal(precisaMedir({ publicado_em: 'nao é data' }, null, HOJE), false)
})

// ── Leitura da resposta da Meta ─────────────────────────────────────────────

test('le os campos que vem no objeto da midia', () => {
  const m = lerMetricas({ like_count: 12, comments_count: 3 }, null)
  assert.equal(m.curtidas, 12)
  assert.equal(m.comentarios, 3)
})

test('le os insights, que vem numa lista de {name, values:[{value}]}', () => {
  const insights = { data: [
    { name: 'reach', values: [{ value: 500 }] },
    { name: 'saved', values: [{ value: 8 }] },
    { name: 'shares', values: [{ value: 2 }] },
    { name: 'views', values: [{ value: 900 }] },
  ] }
  const m = lerMetricas({}, insights)
  assert.equal(m.alcance, 500)
  assert.equal(m.salvamentos, 8)
  assert.equal(m.compartilhamentos, 2)
  assert.equal(m.visualizacoes, 900)
})

test('metrica ausente vira null, NUNCA zero', () => {
  // Zero e uma afirmacao ("ninguem salvou"); null e a verdade ("a Meta nao me
  // disse"). Trocar um pelo outro faz o painel mentir com cara de dado.
  const m = lerMetricas({}, { data: [] })
  assert.equal(m.alcance, null)
  assert.equal(m.curtidas, null)
})

test('zero de verdade e preservado', () => {
  const m = lerMetricas({ like_count: 0 }, { data: [{ name: 'reach', values: [{ value: 0 }] }] })
  assert.equal(m.curtidas, 0)
  assert.equal(m.alcance, 0)
})

test('impressions serve de reserva para views (a Meta trocou o nome)', () => {
  const m = lerMetricas({}, { data: [{ name: 'impressions', values: [{ value: 700 }] }] })
  assert.equal(m.visualizacoes, 700)
})

test('resposta vazia ou quebrada nao explode', () => {
  for (const caso of [[null, null], [{}, {}], [undefined, { data: null }]]) {
    const m = lerMetricas(caso[0], caso[1])
    assert.equal(m.curtidas, null)
    assert.ok('bruto' in m)
  }
})

test('guarda a resposta crua para poder recalcular depois', () => {
  const insights = { data: [{ name: 'reach', values: [{ value: 5 }] }] }
  const m = lerMetricas({ like_count: 1 }, insights)
  assert.ok(m.bruto)
  assert.deepEqual(m.bruto.insights, insights)
})
