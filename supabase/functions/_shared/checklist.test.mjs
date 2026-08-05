import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  diaDaSemana, ehDiaDoMensal, diasEntre,
  semanalAtrasado, mensalAtrasado, cadenciasDoDia,
} from './checklist.js'

// Padrão do banco: semanal na sexta, mensal na 1ª quarta-feira.
const CONFIG = { dia_semanal: 5, semana_mensal: 1, dia_mensal: 3 }

test('o dia da semana sai da data em UTC, não do fuso da máquina', () => {
  // 2026-08-05 é uma quarta-feira. Contar no fuso local faria a data virar e a
  // conferência de sexta cair no sábado, quando ninguém trabalha.
  assert.equal(diaDaSemana('2026-08-05'), 3)
  assert.equal(diaDaSemana('2026-08-07'), 5)  // sexta
  assert.equal(diaDaSemana('2026-08-08'), 6)  // sábado
  assert.equal(diaDaSemana('2026-08-09'), 7)  // domingo
})

test('a 1ª quarta-feira do mês é reconhecida, e a 2ª não', () => {
  assert.equal(ehDiaDoMensal('2026-08-05', CONFIG), true)   // 1ª quarta de agosto
  assert.equal(ehDiaDoMensal('2026-08-12', CONFIG), false)  // 2ª quarta
  assert.equal(ehDiaDoMensal('2026-08-07', CONFIG), false)  // sexta, não é quarta
})

test('dias entre duas datas', () => {
  assert.equal(diasEntre('2026-08-01', '2026-08-08'), 7)
  assert.equal(diasEntre('2026-08-08', '2026-08-08'), 0)
})

/* ── O que o dia pede ────────────────────────────────────────────────────── */

test('dia de semana comum pede só o diário', () => {
  // Segunda-feira. O semanal NÃO se empilha aqui — decisão do dono: nenhum dia
  // pesado.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-08-07', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario'])
})

test('sexta pede o diário e o semanal', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-07', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('a 1ª quarta pede o diário e o mensal, e nunca o semanal junto', () => {
  // Primeira quarta nunca é sexta, então os dois pesados jamais colidem.
  const c = cadenciasDoDia({ hoje: '2026-08-05', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-07-01' })
  assert.deepEqual(c, ['diario', 'mensal'])
})

test('sábado e domingo não pedem nada', () => {
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-08', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-09', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
})

/* ── O atrasado ──────────────────────────────────────────────────────────── */

test('semanal não feito há mais de 7 dias está atrasado e entra no próximo dia útil', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-29', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('atrasado NÃO acumula: uma semana pulada vira uma conferência, não duas', () => {
  // Vinte dias sem semanal continua devolvendo UM 'semanal'.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-21', ultimaMensal: '2026-08-05' })
  assert.equal(c.filter((x) => x === 'semanal').length, 1)
})

test('nunca feito NÃO conta como atrasado — espera o dia próprio', () => {
  // Se contasse, o primeiro dia da funcionalidade jogaria os 21 itens na cara
  // de todo mundo, que é exatamente o dia pesado que o dono não quis.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null })
  assert.deepEqual(c, ['diario'])
})

test('semanalAtrasado e mensalAtrasado isolados', () => {
  assert.equal(semanalAtrasado('2026-08-10', null), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-07'), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-01'), true)
  assert.equal(mensalAtrasado('2026-08-10', null), false)
  assert.equal(mensalAtrasado('2026-08-10', '2026-07-20'), false)
  assert.equal(mensalAtrasado('2026-09-20', '2026-08-05'), true)
})
