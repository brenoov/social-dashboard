import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matrizParaExcel } from './exportar.js'

const COLUNAS = [
  { chave: 'nome', titulo: 'Item', tipo: 'texto' },
  { chave: 'valor_centavos', titulo: 'Valor', tipo: 'dinheiro' },
]

test('a primeira linha é o cabeçalho, na ordem das colunas', () => {
  assert.deepEqual(matrizParaExcel(COLUNAS, []), [['Item', 'Valor']])
})

test('dinheiro sai NÚMERO em reais, para o Excel somar', () => {
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: 800000 }])
  assert.deepEqual(m[1], ['Mesa', 8000])
})

test('dinheiro sem valor vira null, e não zero', () => {
  // Zero mentiria: "não informado" não é "custou nada", e zero entra na soma.
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: null }])
  assert.deepEqual(m[1], ['Mesa', null])
})

test('texto vazio ou ausente vira string vazia, nunca "undefined"', () => {
  const m = matrizParaExcel(COLUNAS, [{ valor_centavos: 100 }])
  assert.equal(m[1][0], '')
})

test('sem linhas, devolve só o cabeçalho — não estoura', () => {
  assert.equal(matrizParaExcel(COLUNAS, null).length, 1)
})
