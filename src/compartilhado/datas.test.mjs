import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { hojeLocal, diasAtras, primeiroDiaDoMes, ultimoDiaDoMes } from './datas.js'

// 2026-07-17T01:30:00Z = 16/07/2026 às 22h30 em Brasília (UTC-3).
// É a janela exata do bug: o toISOString() do código atual já diz "17".
const NOITE_DO_DIA_16 = new Date('2026-07-17T01:30:00Z')

test('as 22h30 BRT do dia 16, hoje ainda e o dia 16', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(hojeLocal(), '2026-07-16')
  mock.timers.reset()
})

test('as 22h30 BRT, ontem e o dia 15 (nao o 16)', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(diasAtras(1), '2026-07-15')
  mock.timers.reset()
})

test('as 22h30 BRT, 7 dias atras e o dia 09', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(diasAtras(7), '2026-07-09')
  mock.timers.reset()
})

test('de manha o resultado e o mesmo dia', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-16T13:00:00Z') }) // 10h BRT
  assert.equal(hojeLocal(), '2026-07-16')
  assert.equal(diasAtras(1), '2026-07-15')
  mock.timers.reset()
})

test('diasAtras atravessa a virada do mes', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-02T15:00:00Z') }) // 02/07 12h BRT
  assert.equal(diasAtras(3), '2026-06-29')
  mock.timers.reset()
})

test('diasAtras atravessa a virada do ano', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-02T15:00:00Z') })
  assert.equal(diasAtras(3), '2025-12-30')
  mock.timers.reset()
})

test('primeiro e ultimo dia do mes atual', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(primeiroDiaDoMes(), '2026-07-01')
  assert.equal(ultimoDiaDoMes(), '2026-07-31')
  mock.timers.reset()
})

test('primeiro e ultimo dia do mes passado', () => {
  mock.timers.enable({ apis: ['Date'], now: NOITE_DO_DIA_16 })
  assert.equal(primeiroDiaDoMes(-1), '2026-06-01')
  assert.equal(ultimoDiaDoMes(-1), '2026-06-30')
  mock.timers.reset()
})

test('ultimo dia do mes lida com fevereiro bissexto', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2028-03-10T15:00:00Z') })
  assert.equal(ultimoDiaDoMes(-1), '2028-02-29')
  mock.timers.reset()
})
