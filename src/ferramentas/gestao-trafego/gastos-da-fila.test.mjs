import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerGastos, gastoDaLinha, usoDoOrcamento, linhasDoModal, LIMITE_DE_USO } from './gastos-da-fila.js'

// Formato REAL de campaign_insights, conferido no banco em 2026-08-03:
// spend vem como texto com 4 casas, e period_days 0=hoje 1=ontem 7/14/30=janela.
const LINHAS = [
  { captured_at: '2026-08-03', period_days: 0, spend: '9.9000' },
  { captured_at: '2026-08-03', period_days: 1, spend: '104.5300' },
  { captured_at: '2026-08-03', period_days: 7, spend: '829.5200' },
  { captured_at: '2026-08-03', period_days: 30, spend: '3600.0000' },
  // Captura de ONTEM: as janelas se sobrepõem, então não pode entrar na conta.
  { captured_at: '2026-08-02', period_days: 7, spend: '970.0500' },
]

test('so a captura MAIS RECENTE conta — janelas de dias diferentes se sobrepoem', () => {
  const g = lerGastos(LINHAS)
  assert.equal(g.capturadoEm, '2026-08-03')
  assert.equal(g.d7.total, 829.52, 'a de ontem (970,05) não pode vazar')
})

test('le hoje, ontem e as janelas, com a media junto do total', () => {
  const g = lerGastos(LINHAS)
  assert.equal(g.hoje, 9.9)
  assert.equal(g.ontem, 104.53)
  assert.equal(Math.round(g.d7.media * 100) / 100, 118.5)
  assert.equal(g.d30.media, 120)
})

test('sem linha nenhuma devolve null, e nao um objeto de zeros', () => {
  // Zero e "não sei" são fatos diferentes: zerado diria que a campanha não gasta.
  assert.equal(lerGastos([]), null)
  assert.equal(lerGastos(null), null)
})

// ── O número da linha ───────────────────────────────────────────────────────

test('a linha mostra ONTEM, nao hoje', () => {
  // Hoje é parcial: às 9h da manhã toda campanha pareceria ter parado.
  const l = gastoDaLinha(lerGastos(LINHAS))
  assert.equal(l.rotulo, 'ontem')
  assert.match(l.texto, /R\$\s?104,53 ontem/)
})

test('sem ontem, cai na media da semana — o segundo mais honesto', () => {
  const g = lerGastos([{ captured_at: '2026-08-03', period_days: 7, spend: '700.0000' }])
  const l = gastoDaLinha(g)
  assert.equal(l.rotulo, 'média/dia')
  assert.match(l.texto, /R\$\s?100,00\/dia na semana/)
})

test('so com o parcial de hoje NAO mostra numero na linha', () => {
  // Hoje sozinho enganaria: de manhã, R$ 5 pareceria a campanha inteira.
  assert.equal(gastoDaLinha(lerGastos([{ captured_at: '2026-08-03', period_days: 0, spend: '5.00' }])), null)
  assert.equal(gastoDaLinha(null), null)
})

// ── A leitura que muda a decisão ────────────────────────────────────────────

test('campanha que NAO usa o teto e sinalizada — e o texto diz por que importa', () => {
  // R$ 104,53 gastos com teto de R$ 230/dia = 45% do que já podia gastar.
  const u = usoDoOrcamento(lerGastos(LINHAS), 23000)
  assert.equal(u.aperta, true)
  assert.match(u.texto, /está usando 45% do que já pode gastar/)
  assert.match(u.texto, /Subir o teto não faz gastar mais/)
})

test('campanha que USA o teto nao gera alarme', () => {
  const u = usoDoOrcamento(lerGastos(LINHAS), 11000)  // 104,53 de 110 = 95%
  assert.equal(u.aperta, false)
  assert.equal(u.texto, '')
})

test('o limite e folgado de proposito — a Meta oscila dia a dia', () => {
  assert.equal(LIMITE_DE_USO, 0.8)
  const noLimite = usoDoOrcamento({ ontem: 80 }, 10000)
  assert.equal(noLimite.aperta, false, 'exatamente 80% não é alarme')
})

test('sem teto ou sem gasto nao ha leitura — nao se divide pelo desconhecido', () => {
  assert.equal(usoDoOrcamento(lerGastos(LINHAS), null), null)
  assert.equal(usoDoOrcamento(lerGastos(LINHAS), 0), null)
  assert.equal(usoDoOrcamento(null, 23000), null)
})

// ── O modal ─────────────────────────────────────────────────────────────────

test('o modal vai do mais recente ao mais largo, e marca o dia que nao fechou', () => {
  const l = linhasDoModal(lerGastos(LINHAS))
  assert.deepEqual(l.map((x) => x.rotulo), ['Hoje', 'Ontem', '7 dias', '30 dias'])
  assert.equal(l[0].parcial, true)
  assert.match(l[0].nota, /ainda não fechou/)
  assert.match(l[2].nota, /R\$\s?118,50 por dia, em média/)
})

test('periodo que nao veio simplesmente nao aparece', () => {
  const l = linhasDoModal(lerGastos([{ captured_at: '2026-08-03', period_days: 1, spend: '50.00' }]))
  assert.deepEqual(l.map((x) => x.rotulo), ['Ontem'])
})
