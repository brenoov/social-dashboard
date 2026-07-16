import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarFluxoDeSenha } from './detectar-fluxo-de-senha.js'

test('link de recuperacao no hash e detectado', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=recovery&expires_in=3600', ''), 'recovery')
})

test('link de convite no hash e detectado', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=invite', ''), 'invite')
})

test('type=recovery na query string tambem conta', () => {
  assert.equal(detectarFluxoDeSenha('', '?type=recovery&code=xyz'), 'recovery')
})

test('login normal nao dispara nada', () => {
  assert.equal(detectarFluxoDeSenha('', ''), null)
  assert.equal(detectarFluxoDeSenha('#', '?foo=bar'), null)
})

test('type desconhecido nao dispara', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=magiclink', ''), null)
})

test('signup nao e tratado como convite', () => {
  assert.equal(detectarFluxoDeSenha('#access_token=abc&type=signup', ''), null)
})
