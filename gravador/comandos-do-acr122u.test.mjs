import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  apduDeEscrita,
  apduDeLeitura,
  APDU_NUMERO_DE_SERIE,
  APDU_VERSAO_DO_LEITOR,
  lerResposta,
  emHex,
} from './comandos-do-acr122u.js'

// ── MONTAR O QUE VAI PARA O APARELHO ───────────────────────────────────────
// Os bytes conferidos contra o manual da ACS e provados na bancada do dono em
// 01/09/2026, no ACR122U de firmware ACR122U220.

test('escrever uma página monta FF D6 00 <página> 04 <4 bytes>', () => {
  assert.deepEqual(
    apduDeEscrita(4, [0x01, 0x03, 0xa0, 0x0c]),
    [0xff, 0xd6, 0x00, 0x04, 0x04, 0x01, 0x03, 0xa0, 0x0c],
  )
})

test('escrever aceita Uint8Array, porque o plano de gravação pode vir assim', () => {
  assert.deepEqual(
    apduDeEscrita(39, Uint8Array.from([0, 0, 0, 0xfe])),
    [0xff, 0xd6, 0x00, 0x27, 0x04, 0x00, 0x00, 0x00, 0xfe],
  )
})

test('ler monta FF B0 00 <página> <quantos bytes>', () => {
  assert.deepEqual(apduDeLeitura(3, 4), [0xff, 0xb0, 0x00, 0x03, 0x04])
  assert.deepEqual(apduDeLeitura(4, 16), [0xff, 0xb0, 0x00, 0x04, 0x10])
})

test('o número de série e a versão do leitor são os comandos provados na bancada', () => {
  assert.deepEqual(APDU_NUMERO_DE_SERIE, [0xff, 0xca, 0x00, 0x00, 0x00])
  assert.deepEqual(APDU_VERSAO_DO_LEITOR, [0xff, 0x00, 0x48, 0x00, 0x00])
})

// ── AS RECUSAS, ANTES DE MANDAR PARA O APARELHO ────────────────────────────

test('escrever fora das páginas 4 a 39 é recusado ANTES de sair daqui', () => {
  for (const pagina of [-1, 0, 3, 40, 41, 44, 255]) {
    assert.throws(() => apduDeEscrita(pagina, [0, 0, 0, 0]), /página/i,
      `a página ${pagina} passou, e não podia`)
  }
})

test('a página 3 é recusada na escrita mesmo sendo legítima na leitura', () => {
  assert.throws(() => apduDeEscrita(3, [0xe1, 0x10, 0x12, 0x00]), /Capability Container/i)
  assert.deepEqual(apduDeLeitura(3, 4), [0xff, 0xb0, 0x00, 0x03, 0x04])
})

test('escrever com número de bytes diferente de 4 é recusado', () => {
  assert.throws(() => apduDeEscrita(4, [1, 2, 3]), /4 bytes/i)
  assert.throws(() => apduDeEscrita(4, [1, 2, 3, 4, 5]), /4 bytes/i)
  assert.throws(() => apduDeEscrita(4, []), /4 bytes/i)
  assert.throws(() => apduDeEscrita(4, null), /4 bytes/i)
})

test('escrever byte que não é byte é recusado', () => {
  assert.throws(() => apduDeEscrita(4, [1, 2, 3, 256]), /byte/i)
  assert.throws(() => apduDeEscrita(4, [1, 2, 3, -1]), /byte/i)
  assert.throws(() => apduDeEscrita(4, [1, 2, 3, 1.5]), /byte/i)
  assert.throws(() => apduDeEscrita(4, [1, 2, 3, undefined]), /byte/i)
})

test('página que não é número inteiro é recusada', () => {
  assert.throws(() => apduDeEscrita('4', [0, 0, 0, 0]), /página/i)
  assert.throws(() => apduDeEscrita(4.5, [0, 0, 0, 0]), /página/i)
  assert.throws(() => apduDeLeitura(null, 4), /página/i)
})

test('ler mais de 16 bytes de uma vez é recusado: o comando não vai além disso', () => {
  assert.throws(() => apduDeLeitura(4, 17), /16/)
  assert.throws(() => apduDeLeitura(4, 0), /1 a 16/)
  assert.throws(() => apduDeLeitura(4, -4), /1 a 16/)
})

test('ler além da página 39 é recusado: a leitura atravessa páginas e cairia nas travas', () => {
  // a página 39 é a última do usuário; 16 bytes a partir dela invadem as
  // páginas 40 em diante (travas dinâmicas, configuração e senha)
  assert.throws(() => apduDeLeitura(39, 16), /39/)
  assert.throws(() => apduDeLeitura(38, 16), /39/)
  // 36..39 são exatamente os últimos 16 bytes do usuário: esta TEM de passar
  assert.deepEqual(apduDeLeitura(36, 16), [0xff, 0xb0, 0x00, 0x24, 0x10])
})

// ── LER O QUE O APARELHO RESPONDEU ─────────────────────────────────────────

test('resposta que termina em 90 00 é boa, e os dados vêm sem o 90 00', () => {
  const r = lerResposta([0xe1, 0x10, 0x12, 0x00, 0x90, 0x00])
  assert.equal(r.ok, true)
  assert.deepEqual(r.dados, [0xe1, 0x10, 0x12, 0x00])
  assert.equal(r.aviso, '')
})

test('escrita bem-sucedida responde só 90 00, com zero dados', () => {
  const r = lerResposta([0x90, 0x00])
  assert.equal(r.ok, true)
  assert.deepEqual(r.dados, [])
})

test('resposta aceita Buffer e Uint8Array, que é o que a biblioteca devolve', () => {
  assert.equal(lerResposta(Uint8Array.from([0x90, 0x00])).ok, true)
  assert.deepEqual(lerResposta(Buffer.from([0xaa, 0x90, 0x00])).dados, [0xaa])
})

test('qualquer final que não seja 90 00 é FALHA, nunca sucesso silencioso', () => {
  const r = lerResposta([0x63, 0x00])
  assert.equal(r.ok, false)
  assert.match(r.aviso, /\S/)
  assert.deepEqual(r.dados, [])
})

test('os códigos de recusa mais comuns viram frase de bancada, não hexadecimal cru', () => {
  assert.match(lerResposta([0x63, 0x00]).aviso, /etiqueta/i)
  assert.match(lerResposta([0x6a, 0x81]).aviso, /não aceita|não suporta/i)
  assert.match(lerResposta([0x6b, 0x00]).aviso, /página/i)
})

test('código desconhecido diz o hexadecimal, em vez de inventar um motivo', () => {
  const r = lerResposta([0x6f, 0x42])
  assert.equal(r.ok, false)
  assert.match(r.aviso, /6F 42/)
})

test('resposta com menos de 2 bytes é resposta TRUNCADA, e truncada não é boa', () => {
  for (const curta of [[], [0x90]]) {
    const r = lerResposta(curta)
    assert.equal(r.ok, false, `${JSON.stringify(curta)} passou, e não podia`)
    assert.match(r.aviso, /cortou|truncad|no meio/i)
  }
})

test('resposta nula ou de tipo errado é falha, nunca "leu vazio"', () => {
  for (const lixo of [null, undefined, 'oi', 42, {}]) {
    assert.equal(lerResposta(lixo).ok, false, `${String(lixo)} passou, e não podia`)
  }
})

// ⚠️ A CICATRIZ QUE MAIS IMPORTA DESTE ARQUIVO: uma leitura CURTA que termina em
// 90 00 é uma resposta "boa" que trouxe menos bytes do que se pediu. Sem esta
// conferência, ler 16 bytes e receber 4 devolveria uma memória incompleta, o
// tradutor diria "não achei endereço", e a tela concluiria ETIQUETA EM BRANCO —
// autorizando gravar por cima de uma bolsa que já tem dono.
test('leitura que veio com menos bytes do que se pediu NÃO é sucesso', () => {
  const r = lerResposta([0x01, 0x03, 0x90, 0x00], { bytesEsperados: 16 })
  assert.equal(r.ok, false)
  assert.match(r.aviso, /2 de 16|incompleta|cortou/i)
})

test('leitura com a quantidade exata de bytes pedida passa', () => {
  const r = lerResposta([1, 2, 3, 4, 0x90, 0x00], { bytesEsperados: 4 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.dados, [1, 2, 3, 4])
})

test('leitura que veio com bytes DEMAIS também não passa', () => {
  const r = lerResposta([1, 2, 3, 4, 5, 0x90, 0x00], { bytesEsperados: 4 })
  assert.equal(r.ok, false)
})

test('emHex escreve os bytes do jeito que o manual e o log escrevem', () => {
  assert.equal(emHex([0xff, 0x00, 0x0a]), 'FF 00 0A')
  assert.equal(emHex([]), '')
})
