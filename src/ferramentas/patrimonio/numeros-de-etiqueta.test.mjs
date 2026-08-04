import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TETO_PADRAO, agruparEmFaixas, textoDaFaixa, mapaDeNumeros, aumentarTeto, ehRecente,
} from './numeros-de-etiqueta.js'

test('junta números seguidos numa faixa só', () => {
  assert.deepEqual(agruparEmFaixas([1, 2, 3, 7, 8, 20]),
    [{ de: 1, ate: 3 }, { de: 7, ate: 8 }, { de: 20, ate: 20 }])
})

test('agrupar aceita bagunça: fora de ordem, repetido e lixo', () => {
  assert.deepEqual(agruparEmFaixas([3, 1, 2, 2, null, undefined, 'x', 1.5]), [{ de: 1, ate: 3 }])
  assert.deepEqual(agruparEmFaixas([]), [])
  assert.deepEqual(agruparEmFaixas(null), [])
})

test('faixa de um número só não vira "7–7"', () => {
  assert.equal(textoDaFaixa({ de: 7, ate: 7 }), '7')
  assert.equal(textoDaFaixa({ de: 7, ate: 9 }), '7–9')
  assert.equal(textoDaFaixa(null), '')
})

const BENS = [
  { numero: 1 }, { numero: 2 }, { numero: 3 }, { numero: 5 }, { numero: 380 },
  { numero: null }, { nome: 'sem número' },
]

test('o mapa diz o que está em uso, o que sobrou e qual é o próximo livre', () => {
  const m = mapaDeNumeros(BENS, 400)
  assert.equal(m.teto, 400)
  assert.equal(m.usados, 5)
  assert.equal(m.livres, 395)
  assert.equal(m.proximoLivre, 4, 'o próximo livre é o buraco, não o fim da fila')
  assert.equal(m.semNumero, 2)
  assert.deepEqual(m.faixasUsadas, [{ de: 1, ate: 3 }, { de: 5, ate: 5 }, { de: 380, ate: 380 }])
  assert.deepEqual(m.faixasLivres.slice(0, 2), [{ de: 4, ate: 4 }, { de: 6, ate: 379 }])
})

test('numeração cheia não inventa próximo livre', () => {
  const m = mapaDeNumeros([{ numero: 1 }, { numero: 2 }], 2)
  assert.equal(m.livres, 0)
  assert.equal(m.proximoLivre, null)
  assert.deepEqual(m.faixasLivres, [])
})

test('número ACIMA do teto não some do relatório', () => {
  // Veio da planilha com 380 e o teto foi posto em 100: a etiqueta existe,
  // está colada num bem, e sumir dela seria mentir.
  const m = mapaDeNumeros([{ numero: 5 }, { numero: 380 }], 100)
  assert.deepEqual(m.acimaDoTeto, [{ de: 380, ate: 380 }])
  assert.equal(m.usados, 1, 'quem está fora do teto não conta como uso dentro dele')
})

test('teto inválido cai no padrão em vez de quebrar', () => {
  assert.equal(mapaDeNumeros([], 0).teto, TETO_PADRAO)
  assert.equal(mapaDeNumeros([], -5).teto, TETO_PADRAO)
  assert.equal(mapaDeNumeros([], null).teto, TETO_PADRAO)
})

test('aumentar o teto só sobe, nunca desce', () => {
  assert.equal(aumentarTeto(400), 500)
  assert.equal(aumentarTeto(400, 50), 450)
  assert.equal(aumentarTeto(400, -100), 500, 'passo negativo não pode encolher a numeração')
  assert.equal(aumentarTeto(null), TETO_PADRAO + 100)
})

/* ── selo de "novo" ─────────────────────────────────────────────────────── */

const AGORA = '2026-08-04T12:00:00.000Z'

test('bem cadastrado agora há pouco é novo', () => {
  assert.equal(ehRecente('2026-08-04T11:00:00.000Z', AGORA), true)
  assert.equal(ehRecente('2026-08-03T13:00:00.000Z', AGORA), true, '23h ainda é novo')
})

test('bem antigo não é novo', () => {
  assert.equal(ehRecente('2026-08-03T11:00:00.000Z', AGORA), false, '25h já não é')
  assert.equal(ehRecente('2026-07-01T12:00:00.000Z', AGORA), false)
})

test('a janela é ajustável', () => {
  assert.equal(ehRecente('2026-08-04T09:00:00.000Z', AGORA, 2), false)
  assert.equal(ehRecente('2026-08-04T09:00:00.000Z', AGORA, 4), true)
})

test('data ruim ou no futuro não vira selo nem quebra', () => {
  assert.equal(ehRecente(null, AGORA), false)
  assert.equal(ehRecente('nada disso', AGORA), false)
  assert.equal(ehRecente('2026-08-05T12:00:00.000Z', AGORA), false, 'relógio adiantado não é "novo"')
  assert.equal(ehRecente('2026-08-04T11:00:00.000Z', 'lixo'), false)
})
