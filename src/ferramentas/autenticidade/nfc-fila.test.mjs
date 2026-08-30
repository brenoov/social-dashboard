import test from 'node:test'
import assert from 'node:assert/strict'
import { codigoDoEndereco, conferirLeitura } from './nfc-fila.js'

test('codigoDoEndereco: tira o codigo de um endereco do selo', () => {
  assert.equal(
    codigoDoEndereco('https://vesselbrasil.com.br/verify/K7M4X9QP2R'),
    'K7M4X9QP2R',
  )
})

test('codigoDoEndereco: aceita minusculo e devolve MAIUSCULO', () => {
  // o app de NFC de terceiros pode devolver o endereco em caixa baixa
  assert.equal(
    codigoDoEndereco('https://vesselbrasil.com.br/verify/k7m4x9qp2r'),
    'K7M4X9QP2R',
  )
})

test('codigoDoEndereco: ignora barra, interrogacao e cerquilha no fim', () => {
  const esperado = 'K7M4X9QP2R'
  assert.equal(codigoDoEndereco('https://vesselbrasil.com.br/verify/K7M4X9QP2R/'), esperado)
  assert.equal(codigoDoEndereco('https://vesselbrasil.com.br/verify/K7M4X9QP2R?x=1'), esperado)
  assert.equal(codigoDoEndereco('https://vesselbrasil.com.br/verify/K7M4X9QP2R#a'), esperado)
})

test('codigoDoEndereco: endereco de OUTRO site nao vale', () => {
  assert.equal(codigoDoEndereco('https://exemplo.com/verify/K7M4X9QP2R'), null)
})

test('codigoDoEndereco: vazio, nulo e lixo devolvem nulo', () => {
  assert.equal(codigoDoEndereco(''), null)
  assert.equal(codigoDoEndereco(null), null)
  assert.equal(codigoDoEndereco('qualquer coisa'), null)
})

test('conferirLeitura: a etiqueta devolveu exatamente esta peca', () => {
  assert.equal(
    conferirLeitura('https://vesselbrasil.com.br/verify/K7M4X9QP2R', 'K7M4X9QP2R'),
    'confere',
  )
})

test('conferirLeitura: etiqueta em branco', () => {
  assert.equal(conferirLeitura('', 'K7M4X9QP2R'), 'vazia')
  assert.equal(conferirLeitura(null, 'K7M4X9QP2R'), 'vazia')
})

test('conferirLeitura: etiqueta com OUTRA peca — e o caso que salva duas bolsas', () => {
  assert.equal(
    conferirLeitura('https://vesselbrasil.com.br/verify/T3H8ZC5WVN', 'K7M4X9QP2R'),
    'outra-peca',
  )
})

test('conferirLeitura: etiqueta com coisa que nao e do selo', () => {
  assert.equal(conferirLeitura('https://google.com', 'K7M4X9QP2R'), 'nao-e-vessel')
})
