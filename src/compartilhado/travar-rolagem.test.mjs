import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { travarRolagem, destravarRolagem, _zerarTrava } from './travar-rolagem.js'

// Documento de mentira: só o que o módulo toca.
const fingirDoc = () => ({ body: { style: {} } })

beforeEach(() => _zerarTrava())

test('travar esconde a rolagem e desliga o arrasto', () => {
  const d = fingirDoc()
  travarRolagem(d)
  assert.equal(d.body.style.overflow, 'hidden')
  assert.equal(d.body.style.touchAction, 'none')
})

test('destravar devolve a pagina ao normal', () => {
  const d = fingirDoc()
  travarRolagem(d); destravarRolagem(d)
  assert.equal(d.body.style.overflow, '')
  assert.equal(d.body.style.touchAction, '')
})

test('DOIS modais: fechar o de cima NAO destrava com o de baixo aberto', () => {
  // O caso real: abrir o editor de permissoes de dentro da ficha. Com booleano
  // em vez de contador, fechar o editor destravaria a pagina e o arrasto
  // voltaria com a ficha ainda na tela.
  const d = fingirDoc()
  travarRolagem(d)   // ficha
  travarRolagem(d)   // editor por cima
  destravarRolagem(d) // fecha o editor
  assert.equal(d.body.style.overflow, 'hidden', 'ainda ha um modal aberto')
  destravarRolagem(d) // fecha a ficha
  assert.equal(d.body.style.overflow, '', 'agora sim')
})

test('destravar a mais nao quebra o proximo travar', () => {
  // Fechar duas vezes (clique no X e clique no fundo) nao pode zerar o contador
  // abaixo de zero: o proximo modal ficaria sem trava.
  const d = fingirDoc()
  travarRolagem(d); destravarRolagem(d); destravarRolagem(d); destravarRolagem(d)
  travarRolagem(d)
  assert.equal(d.body.style.overflow, 'hidden')
})

test('sem documento nao estoura', () => {
  assert.doesNotThrow(() => { travarRolagem(null); destravarRolagem(null) })
})
