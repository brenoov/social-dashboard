import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  corDeAvatar,
  inicialDe,
  decidirEstadoAcesso,
  mensagemEstadoVazio,
  agruparPorEscopo,
  PALETA_AVATAR,
} from './acesso-da-pasta.js'

// ===== corDeAvatar =====
test('corDeAvatar é determinística: mesma semente, mesma cor', () => {
  assert.equal(corDeAvatar('breno@rbvcompany.com'), corDeAvatar('breno@rbvcompany.com'))
})

test('corDeAvatar sempre devolve uma cor da paleta', () => {
  for (const seed of ['a', 'erick@x.com', 'Theo Vieira', '', null, undefined, 12345]) {
    assert.ok(PALETA_AVATAR.includes(corDeAvatar(seed)), 'cor fora da paleta para ' + seed)
  }
})

// ===== inicialDe =====
test('inicialDe usa a primeira letra do nome, em maiúscula', () => {
  assert.equal(inicialDe('breno', 'x@y.com'), 'B')
})

test('inicialDe cai no e-mail quando não há nome', () => {
  assert.equal(inicialDe('', 'erick@rbv.com'), 'E')
  assert.equal(inicialDe(null, 'ana@rbv.com'), 'A')
})

test('inicialDe devolve "?" quando não há nome nem e-mail (nunca vazio)', () => {
  assert.equal(inicialDe('', ''), '?')
  assert.equal(inicialDe(null, null), '?')
})

// ===== decidirEstadoAcesso — o coração da honestidade =====
test('tem pessoas e nenhuma falha => ok, não incompleto', () => {
  const e = decidirEstadoAcesso({ pessoas: [{ nome: 'Breno' }], falhas: [] }, { temMae: false })
  assert.deepEqual(e, { tipo: 'ok', incompleto: false })
})

test('tem pessoas MAS houve falha => ok porém incompleto (quadro parcial)', () => {
  const e = decidirEstadoAcesso({ pessoas: [{ nome: 'Breno' }], falhas: [{ msg: 'x' }] }, {})
  assert.deepEqual(e, { tipo: 'ok', incompleto: true })
})

test('zero pessoas numa SUBPASTA sem falha => herda (não "ninguém")', () => {
  const e = decidirEstadoAcesso({ pessoas: [], falhas: [] }, { temMae: true })
  assert.equal(e.tipo, 'herda')
  assert.equal(e.incompleto, false)
})

test('zero pessoas numa RAIZ sem falha => vazio (raiz não herda)', () => {
  const e = decidirEstadoAcesso({ pessoas: [], falhas: [] }, { temMae: false })
  assert.equal(e.tipo, 'vazio')
})

test('zero pessoas COM falha => ilegível (não sabemos), mesmo tendo mãe', () => {
  const e = decidirEstadoAcesso({ pessoas: [], falhas: [{ msg: 'timeout' }] }, { temMae: true })
  assert.equal(e.tipo, 'ilegivel')
  assert.equal(e.incompleto, true)
})

test('resposta indefinida/vazia não quebra e cai no caminho seguro', () => {
  assert.equal(decidirEstadoAcesso().tipo, 'vazio')
  assert.equal(decidirEstadoAcesso({}, {}).tipo, 'vazio')
  assert.equal(decidirEstadoAcesso(null, null).tipo, 'vazio')
})

// ===== mensagemEstadoVazio =====
test('cada estado vazio tem sua frase; "ok" não tem frase', () => {
  assert.match(mensagemEstadoVazio({ tipo: 'herda' }), /herda/i)
  assert.match(mensagemEstadoVazio({ tipo: 'ilegivel' }), /não foi possível/i)
  assert.match(mensagemEstadoVazio({ tipo: 'vazio' }), /nenhum acesso direto/i)
  assert.equal(mensagemEstadoVazio({ tipo: 'ok' }), '')
  assert.equal(mensagemEstadoVazio(), '')
})

test('a frase de herança NÃO diz "ninguém tem acesso" (evita mentira)', () => {
  assert.doesNotMatch(mensagemEstadoVazio({ tipo: 'herda' }), /ningu[eé]m/i)
})

// ===== agruparPorEscopo =====
test('agrupa por escopo e conta certo, ordenando do mais comum pro menos', () => {
  const pessoas = [
    { escopo: 'Todo o time (workspace)' },
    { escopo: 'Todo o time (workspace)' },
    { escopo: 'Todo o time (workspace)' },
    { escopo: 'Só convidados' },
  ]
  assert.deepEqual(agruparPorEscopo(pessoas), [
    { escopo: 'Todo o time (workspace)', quantidade: 3 },
    { escopo: 'Só convidados', quantidade: 1 },
  ])
})

test('pessoa sem escopo vira "Acesso individual" (não some)', () => {
  const g = agruparPorEscopo([{ nome: 'X' }, { escopo: '' }])
  assert.deepEqual(g, [{ escopo: 'Acesso individual', quantidade: 2 }])
})

test('lista vazia/indefinida devolve []', () => {
  assert.deepEqual(agruparPorEscopo([]), [])
  assert.deepEqual(agruparPorEscopo(null), [])
  assert.deepEqual(agruparPorEscopo(undefined), [])
})
