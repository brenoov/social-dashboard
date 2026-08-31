import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { enderecoDaTag } from '../lotes.js'
import { planoDeGravacao } from './ndef-para-ntag213.js'

// O codigo de peca de verdade: 10 letras do alfabeto sem O, 0, I e 1 — as
// quatro que a pessoa confunde lendo em cima do couro.
const CODIGO = 'K7M4X9QP2R'
// O endereco NASCE de enderecoDaTag, nunca escrito a mao. Dominio em dois
// lugares e dominio errado esperando acontecer — e este vai gravado dentro de
// um chip costurado numa bolsa, onde nao se corrige.
const ENDERECO = enderecoDaTag(CODIGO)

// A NTAG213 NAO SAI DA FABRICA EM BRANCO. As paginas 4 e 5 vem com isto:
// `01 03 A0 0C 34` e um Lock Control TLV (cinco bytes), `03 00` e uma mensagem
// NDEF vazia e `FE` e o terminador.
const DE_FABRICA = [0x01, 0x03, 0xa0, 0x0c, 0x34, 0x03, 0x00, 0xfe]

// Remonta a memoria do usuario a partir das escritas, como a etiqueta ficaria
// depois de gravada. E assim que se confere sem hardware.
function memoriaDepois(escritas, antes = []) {
  const memoria = Array.from({ length: 144 }, (_, i) => antes[i] ?? 0)
  for (const { pagina, bytes } of escritas) {
    const inicio = (pagina - 4) * 4
    bytes.forEach((b, i) => { memoria[inicio + i] = b })
  }
  return memoria
}

// ── REGRA 1: PRESERVA O LOCK CONTROL TLV ───────────────────────────────────
test('regra 1: com Lock Control na etiqueta, a mensagem comeca DEPOIS dele', () => {
  const escritas = planoDeGravacao(ENDERECO, DE_FABRICA)
  // pagina 4 e Lock Control inteiro (`01 03 A0 0C`): nao se escreve nela
  assert.equal(escritas[0].pagina, 5, 'a pagina 4 e so Lock Control, nao se toca nela')
  // o quinto byte do Lock Control (`34`) mora no comeco da pagina 5 e tem de
  // sobreviver: escrever zero por cima destroi a trava que a etiqueta espera ter
  assert.equal(escritas[0].bytes[0], 0x34, 'o quinto byte do Lock Control foi apagado')
  // e so depois dele comeca o TLV da mensagem NDEF
  assert.equal(escritas[0].bytes[1], 0x03, 'o TLV de mensagem tem de comecar no byte seguinte')
})

test('regra 1: os cinco bytes do Lock Control continuam iguais depois de gravar', () => {
  const memoria = memoriaDepois(planoDeGravacao(ENDERECO, DE_FABRICA), DE_FABRICA)
  assert.deepEqual(memoria.slice(0, 5), [0x01, 0x03, 0xa0, 0x0c, 0x34])
})

// ── REGRA 2: SEM LOCK CONTROL, COMECA NA PAGINA 4 ──────────────────────────
test('regra 2: memoria vazia — a mensagem comeca na pagina 4', () => {
  const escritas = planoDeGravacao(ENDERECO, [])
  assert.equal(escritas[0].pagina, 4)
  assert.equal(escritas[0].bytes[0], 0x03, 'o TLV de mensagem abre a pagina 4')
})

test('regra 2: memoria nula ou nao lida — a mensagem comeca na pagina 4', () => {
  for (const nada of [null, undefined, 'nao e byte nenhum', 42]) {
    const escritas = planoDeGravacao(ENDERECO, nada)
    assert.equal(escritas[0].pagina, 4, `memoria ${String(nada)} deveria comecar na pagina 4`)
  }
})

test('regra 2: memoria que NAO comeca com Lock Control comeca na pagina 4', () => {
  // etiqueta que ja tem so uma mensagem NDEF, sem Lock Control
  const escritas = planoDeGravacao(ENDERECO, [0x03, 0x00, 0xfe, 0x00])
  assert.equal(escritas[0].pagina, 4)
})

// ── REGRA 3: SEMPRE TERMINA COM O TERMINADOR FE ────────────────────────────
test('regra 3: depois da mensagem vem o terminador FE', () => {
  for (const antes of [[], DE_FABRICA]) {
    const escritas = planoDeGravacao(ENDERECO, antes)
    const memoria = memoriaDepois(escritas, antes)
    const inicio = antes.length ? 5 : 0
    const tamanhoDaMensagem = memoria[inicio + 1]
    // TLV: [03][tamanho][mensagem...][FE]
    assert.equal(memoria[inicio], 0x03, 'o TLV de mensagem NDEF abre com 03')
    assert.equal(memoria[inicio + 2 + tamanhoDaMensagem], 0xfe,
      'sem o terminador FE o leitor continua lendo lixo depois da mensagem')
  }
})

// ── REGRA 4: COMPLETA A ULTIMA PAGINA COM ZEROS ────────────────────────────
test('regra 4: toda escrita tem exatamente 4 bytes', () => {
  const escritas = planoDeGravacao(ENDERECO, DE_FABRICA)
  for (const escrita of escritas) {
    assert.equal(escrita.bytes.length, 4,
      `a pagina ${escrita.pagina} nao tem 4 bytes: nao existe meia pagina na NTAG213`)
    for (const b of escrita.bytes) {
      assert.ok(Number.isInteger(b) && b >= 0 && b <= 255, 'byte fora de 0..255')
    }
  }
})

test('regra 4: a sobra da ultima pagina vai com zero', () => {
  const escritas = planoDeGravacao(ENDERECO, DE_FABRICA)
  const memoria = memoriaDepois(escritas, DE_FABRICA)
  // 5 do Lock Control + 45 do TLV (2 + 42 da mensagem + FE) = 50 bytes usados;
  // a ultima pagina vai ate o byte 51, e os dois que sobram sao zero
  const ultima = escritas[escritas.length - 1]
  assert.equal(ultima.bytes[2], 0x00)
  assert.equal(ultima.bytes[3], 0x00)
  assert.equal(memoria[50], 0x00)
})

// ── REGRA 6: NUNCA AS PAGINAS 0, 1, 2 OU 3 ─────────────────────────────────
test('regra 6: nenhuma escrita cai nas paginas 0 a 3', () => {
  // A pagina 3 e o Capability Container e ja vem certo de fabrica; os bits dele
  // so mudam num sentido, com OR, e a mudanca e IRREVERSIVEL. As paginas 0 a 2
  // sao o numero de serie da etiqueta, que nem se escreve.
  for (const antes of [[], DE_FABRICA, [0x03, 0x00, 0xfe, 0x00]]) {
    for (const { pagina } of planoDeGravacao(ENDERECO, antes)) {
      assert.ok(pagina >= 4, `escrita na pagina ${pagina}: fora da memoria do usuario`)
      assert.ok(pagina <= 39, `escrita na pagina ${pagina}: passou da memoria do usuario`)
    }
  }
})

// ── O REGISTRO DE URL ──────────────────────────────────────────────────────
test('o prefixo 04 troca o `https://` por um byte so', () => {
  const memoria = memoriaDepois(planoDeGravacao(ENDERECO, []), [])
  // [03][tamanho do TLV] [D1 01 tamanho 55] [04] texto...
  assert.deepEqual(memoria.slice(0, 6), [0x03, 0x2a, 0xd1, 0x01, 0x26, 0x55])
  assert.equal(memoria[6], 0x04, '04 e o prefixo abreviado de https://')
  const texto = String.fromCharCode(...memoria.slice(7, 7 + 37))
  assert.equal(texto, `vesselbrasil.com.br/verify/${CODIGO}`,
    'so o resto do endereco vai como texto')
})

// ── O DOMINIO NAO MORA AQUI ────────────────────────────────────────────────
test('o tradutor nao escreve o dominio: ele recebe o endereco pronto', () => {
  const fonte = readFileSync(new URL('./ndef-para-ntag213.js', import.meta.url).pathname, 'utf8')
  assert.doesNotMatch(fonte, /vesselbrasil/i,
    'o dominio mora em lotes.js (enderecoDaTag) e em lugar nenhum mais')
})
