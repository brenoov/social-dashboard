import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LIMITE_LEGENDA,
  LIMITE_HASHTAGS,
  montarLegendaFinal,
  contarCaracteres,
  listarHashtags,
  normalizarParaComparar,
} from './legenda.js'

// ── Montagem ────────────────────────────────────────────────────────────────

test('legenda sozinha sai igual', () => {
  assert.equal(montarLegendaFinal('Bom dia!', '', []), 'Bom dia!')
})

test('hashtags entram depois de uma linha em branco', () => {
  assert.equal(montarLegendaFinal('Bom dia!', '#vessel #bolsa'), 'Bom dia!\n\n#vessel #bolsa')
})

test('blocos entram entre a legenda e as hashtags, na ordem recebida', () => {
  const r = montarLegendaFinal('Olha só', '#tag', ['Frete grátis', '— La Vessel'])
  assert.equal(r, 'Olha só\n\nFrete grátis\n\n— La Vessel\n\n#tag')
})

test('partes vazias nao deixam linhas em branco sobrando', () => {
  assert.equal(montarLegendaFinal('', '#tag', []), '#tag')
  assert.equal(montarLegendaFinal('Texto', '', ['', null, undefined]), 'Texto')
  assert.equal(montarLegendaFinal('', '', []), '')
})

test('espacos nas pontas somem, mas a quebra de linha de dentro fica', () => {
  assert.equal(montarLegendaFinal('  linha 1\nlinha 2  ', ''), 'linha 1\nlinha 2')
})

test('entradas nulas nao quebram', () => {
  assert.equal(montarLegendaFinal(null, undefined, null), '')
})

// ── Contagem ────────────────────────────────────────────────────────────────

test('o limite do Instagram e 2200', () => {
  assert.equal(LIMITE_LEGENDA, 2200)
})

test('contarCaracteres conta o texto montado, nao so a legenda', () => {
  assert.equal(contarCaracteres('abc'), 3)
  assert.equal(contarCaracteres(''), 0)
  assert.equal(contarCaracteres(null), 0)
})

test('emoji conta como um caractere, nao dois', () => {
  // Sem isso o contador acusa estouro antes da hora — '❤️' e '👨‍👩‍👧' têm
  // mais de um code unit em UTF-16.
  assert.equal(contarCaracteres('👍'), 1)
  assert.equal(contarCaracteres('a👍b'), 3)
})

// ── Hashtags ────────────────────────────────────────────────────────────────

test('o limite do Instagram e 30 hashtags', () => {
  assert.equal(LIMITE_HASHTAGS, 30)
})

test('listarHashtags aceita com e sem cerquilha, separadas por espaco ou virgula', () => {
  assert.deepEqual(listarHashtags('#um dois, #tres'), ['#um', '#dois', '#tres'])
})

test('listarHashtags remove repetidas ignorando maiuscula', () => {
  assert.deepEqual(listarHashtags('#Vessel #vessel #VESSEL'), ['#Vessel'])
})

test('listarHashtags devolve lista vazia para entrada vazia ou nula', () => {
  assert.deepEqual(listarHashtags(''), [])
  assert.deepEqual(listarHashtags(null), [])
  assert.deepEqual(listarHashtags('   '), [])
})

test('listarHashtags nao devolve cerquilha solta', () => {
  assert.deepEqual(listarHashtags('# ## #ok'), ['#ok'])
})

// ── Normalização (usada pelo casamento com o post real, na Fase 3) ──────────

test('normalizar tira acento, emoji, hashtag, arroba e caixa', () => {
  assert.equal(normalizarParaComparar('Coleção NOVA 🔥 #vessel @loja'), 'colecao nova')
})

test('normalizar colapsa espaco e quebra de linha', () => {
  assert.equal(normalizarParaComparar('a   b\n\nc'), 'a b c')
})

test('normalizar corta em 200 caracteres', () => {
  assert.equal(normalizarParaComparar('a'.repeat(500)).length, 200)
})

test('normalizar aguenta entrada nula', () => {
  assert.equal(normalizarParaComparar(null), '')
  assert.equal(normalizarParaComparar(undefined), '')
})

test('dois textos que so diferem em emoji e acento ficam iguais', () => {
  assert.equal(
    normalizarParaComparar('Promoção imperdível! 😍'),
    normalizarParaComparar('promocao imperdivel!'),
  )
})
