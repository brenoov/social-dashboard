import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deveAbrirSozinho, marcarComoVisto } from './tutorial-visto.js'

// Um armazém de mentira, pra testar sem navegador.
const armazem = (inicial = {}) => {
  const d = { ...inicial }
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v }, _d: d }
}

test('o passeio abre sozinho só na primeira vez daquela pessoa, naquela ferramenta', () => {
  const a = armazem()
  assert.equal(deveAbrirSozinho(a, 'u1', 'fr-tutorial-visto'), true)
  marcarComoVisto(a, 'u1', 'fr-tutorial-visto')
  assert.equal(deveAbrirSozinho(a, 'u1', 'fr-tutorial-visto'), false)
})

test('quem chega depois no MESMO aparelho vê o tutorial', () => {
  const a = armazem()
  marcarComoVisto(a, 'dono', 'fr-tutorial-visto')
  assert.equal(deveAbrirSozinho(a, 'dono', 'fr-tutorial-visto'), false)
  assert.equal(deveAbrirSozinho(a, 'larissa', 'fr-tutorial-visto'), true, 'outra pessoa tem que ver o tutorial')
})

test('ter visto o tutorial de UMA ferramenta não marca as outras como vistas', () => {
  // É o motivo de existir o prefixo: sem ele, fechar o passeio da Frota
  // esconderia pra sempre o passeio do Patrimônio da mesma pessoa.
  const a = armazem()
  marcarComoVisto(a, 'u1', 'fr-tutorial-visto')
  assert.equal(deveAbrirSozinho(a, 'u1', 'pat-tutorial-visto'), true, 'ferramenta diferente, tutorial diferente')
})

test('modo privado (armazém que recusa) não quebra nem abre em loop', () => {
  const recusa = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
  assert.equal(deveAbrirSozinho(recusa, 'u1', 'fr-tutorial-visto'), false, 'sem poder guardar, é melhor não abrir do que abrir sempre')
  assert.doesNotThrow(() => marcarComoVisto(recusa, 'u1', 'fr-tutorial-visto'))
  assert.equal(deveAbrirSozinho(null, 'u1', 'fr-tutorial-visto'), false)
})
