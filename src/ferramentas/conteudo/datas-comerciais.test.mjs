import test from 'node:test'
import assert from 'node:assert/strict'
import { nomeDoMes, datasDoMes, descricaoDoMes, SEM_DATA, MESES } from './datas-comerciais.js'

// Este módulo é lido pelos DOIS lados: o robô manda no briefing, a tela mostra
// o que foi mandado. Um erro de um mês aqui aparece nas duas pontas.

test('os 12 meses tem nome', () => {
  assert.equal(MESES.length, 12)
  assert.equal(nomeDoMes(1), 'janeiro')
  assert.equal(nomeDoMes(12), 'dezembro')
})

test('mes fora da faixa nao quebra', () => {
  for (const m of [0, 13, -1, null, undefined, 'abc']) {
    assert.equal(nomeDoMes(m), '')
    assert.equal(datasDoMes(m), SEM_DATA)
  }
})

test('todo mes tem data comercial', () => {
  for (let m = 1; m <= 12; m++) {
    assert.notEqual(datasDoMes(m), SEM_DATA, `mês ${m} ficou sem data`)
  }
})

test('descricaoDoMes aceita Date sem erro de um mes', () => {
  // Janeiro é getMonth()===0. Passar o Date direto é o caminho que a tela usa,
  // e é exatamente onde nasce o erro clássico de um mês.
  assert.match(descricaoDoMes(new Date(2026, 0, 15)), /^Janeiro:/)
  assert.match(descricaoDoMes(new Date(2026, 11, 25)), /^Dezembro:/)
  assert.match(descricaoDoMes(new Date(2026, 6, 31)), /^Julho:.*liquidação de inverno/)
})

test('descricaoDoMes aceita o numero do mes', () => {
  assert.match(descricaoDoMes(5), /^Maio:.*Dia das Mães/)
})

test('descricaoDoMes com entrada invalida devolve frase, nao undefined', () => {
  for (const v of [0, 99, null, 'x']) {
    const txt = descricaoDoMes(v)
    assert.ok(txt && !/undefined|NaN/.test(txt), `saída suja: ${txt}`)
  }
})
