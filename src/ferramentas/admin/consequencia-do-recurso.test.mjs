import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mexeEmDinheiro, SELO_DINHEIRO } from './consequencia-do-recurso.js'

test('gasta verba real: Trafego e Fabrica', () => {
  assert.equal(mexeEmDinheiro('meta.gestor'), true)
  assert.equal(mexeEmDinheiro('meta.fabrica'), true)
})

test('meta de venda NAO mexe em dinheiro', () => {
  // Eu tinha colocado na conversa e esta errado: meta e alvo de faturamento,
  // nao gasto. Mexer nela nao tira dinheiro de lugar nenhum.
  assert.equal(mexeEmDinheiro('sales.metas'), false)
})

test('so ver nao vale selo — o selo e sobre poder gastar', () => {
  assert.equal(mexeEmDinheiro('social'), false)
  assert.equal(mexeEmDinheiro('noticias'), false)
})

test('nao estoura com chave desconhecida', () => {
  assert.equal(mexeEmDinheiro('inventado'), false)
  assert.equal(mexeEmDinheiro(null), false)
})

test('o selo tem texto', () => {
  assert.ok(SELO_DINHEIRO.length > 0)
})
