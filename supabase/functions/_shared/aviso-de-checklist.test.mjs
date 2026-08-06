import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarAviso } from './aviso-de-checklist.js'
import { ehTipoValido, padraoDoTipo } from './notificacoes.js'

const CARRO = { nome: 'HONDA FIT', placa: 'DUB7D72' }

test('o aviso do dia comum diz quantos itens e cita o hodômetro', () => {
  const a = montarAviso({ veiculo: CARRO, itens: [1, 2, 3, 4], cadencias: ['diario'] })
  assert.equal(a.titulo, 'Checklist do HONDA FIT')
  assert.match(a.corpo, /4 itens e o hodômetro/)
})

test('um item só não vira "1 itens"', () => {
  const a = montarAviso({ veiculo: CARRO, itens: [1], cadencias: ['diario'] })
  assert.match(a.corpo, /^1 item e o hodômetro/)
})

test('o dia da conferência da semana avisa que hoje é mais longo', () => {
  // Quem recebe "15 itens" sem explicação acha que o app quebrou.
  const a = montarAviso({ veiculo: CARRO, itens: new Array(15), cadencias: ['diario', 'semanal'] })
  assert.match(a.corpo, /conferência da semana/)
})

test('o mensal vence o semanal no texto', () => {
  const a = montarAviso({ veiculo: CARRO, itens: new Array(10), cadencias: ['diario', 'mensal'] })
  assert.match(a.corpo, /conferência do mês/)
  assert.doesNotMatch(a.corpo, /da semana/)
})

test('o tipo frota existe e nasce DESLIGADO', () => {
  // Regra da casa: chave nova sobe concedida a ninguém.
  assert.equal(ehTipoValido('frota'), true)
  assert.equal(padraoDoTipo('frota'), false)
})
