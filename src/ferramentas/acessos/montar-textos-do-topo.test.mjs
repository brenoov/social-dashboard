import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarDetalhePastas } from './montar-textos-do-topo.js'

test('mostra os três provedores na ordem WorkDrive · OneDrive · iCloud', () => {
  assert.equal(
    montarDetalhePastas({ workdrive: 16, onedrive: 32, icloud: 1 }),
    '16 WorkDrive · 32 OneDrive · 1 iCloud'
  )
})

test('esconde provedor com zero pasta (não escreve "0 iCloud")', () => {
  assert.equal(
    montarDetalhePastas({ workdrive: 16, onedrive: 0, icloud: 0 }),
    '16 WorkDrive'
  )
})

test('pula o do meio quando ele está zerado', () => {
  assert.equal(
    montarDetalhePastas({ workdrive: 5, onedrive: 0, icloud: 2 }),
    '5 WorkDrive · 2 iCloud'
  )
})

test('sem pasta nenhuma devolve frase honesta, não vazio', () => {
  assert.equal(montarDetalhePastas({ workdrive: 0, onedrive: 0, icloud: 0 }), 'nenhuma pasta ainda')
})

test('objeto vazio ou nulo não quebra', () => {
  assert.equal(montarDetalhePastas({}), 'nenhuma pasta ainda')
  assert.equal(montarDetalhePastas(null), 'nenhuma pasta ainda')
})

test('valores em texto (como vêm de um count) são tratados como número', () => {
  assert.equal(montarDetalhePastas({ workdrive: '3', onedrive: '4' }), '3 WorkDrive · 4 OneDrive')
})
