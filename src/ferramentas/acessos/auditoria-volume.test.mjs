// Testes da lógica pura da auditoria: classificar o volume de acesso ao OneDrive
// (nenhuma / algumas / muitas) que a tela usa pra dar destaque de atenção.
import test from 'node:test'
import assert from 'node:assert/strict'
import { volumeDeAcesso, LIMITE_MUITAS_PASTAS } from './auditoria-volume.js'

test('zero pastas é "nenhuma", sem destaque', () => {
  const r = volumeDeAcesso(0)
  assert.equal(r.nivel, 'nenhuma')
  assert.equal(r.muitas, false)
  assert.equal(r.quantidade, 0)
})

test('poucas pastas é "algumas", sem destaque', () => {
  const r = volumeDeAcesso(3)
  assert.equal(r.nivel, 'algumas')
  assert.equal(r.muitas, false)
  assert.equal(r.quantidade, 3)
})

test('logo abaixo do limite ainda é "algumas"', () => {
  const r = volumeDeAcesso(LIMITE_MUITAS_PASTAS - 1)
  assert.equal(r.nivel, 'algumas')
  assert.equal(r.muitas, false)
})

test('no limite exato já é "muitas" (destaque de atenção)', () => {
  const r = volumeDeAcesso(LIMITE_MUITAS_PASTAS)
  assert.equal(r.nivel, 'muitas')
  assert.equal(r.muitas, true)
  assert.equal(r.quantidade, LIMITE_MUITAS_PASTAS)
})

test('bem acima do limite é "muitas"', () => {
  const r = volumeDeAcesso(31)
  assert.equal(r.nivel, 'muitas')
  assert.equal(r.muitas, true)
  assert.equal(r.quantidade, 31)
})

test('número inválido ou negativo vira zero, nunca quebra', () => {
  for (const bad of [NaN, undefined, null, -5, 'muitas', {}]) {
    const r = volumeDeAcesso(bad)
    assert.equal(r.quantidade, 0)
    assert.equal(r.nivel, 'nenhuma')
    assert.equal(r.muitas, false)
  }
})

test('valor fracionário é truncado (não arredonda pra cima)', () => {
  const r = volumeDeAcesso(9.9)
  assert.equal(r.quantidade, 9)
  assert.equal(r.nivel, 'algumas')
})
