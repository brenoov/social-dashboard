import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIAS_DA_SEMANA, NOMES_DOS_MESES, montarMes, diaDaPeca,
  horaDaPeca, dataHoraBRT, paraCampoDeDataHora, deCampoDeDataHora,
} from './grade-do-calendario.js'

const peca = (id, publicar_em) => ({ id, publicar_em, titulo: `peça ${id}` })

test('o cabecalho comeca no domingo, como calendario brasileiro', () => {
  assert.deepEqual(DIAS_DA_SEMANA, ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'])
})

test('os meses estao em portugues', () => {
  assert.equal(NOMES_DOS_MESES.length, 12)
  assert.equal(NOMES_DOS_MESES[6], 'Julho')
})

// ── Forma da grade ──────────────────────────────────────────────────────────

test('toda semana tem exatamente 7 dias', () => {
  for (const mes of [1, 2, 7, 12]) {
    for (const semana of montarMes(2026, mes, []).semanas) {
      assert.equal(semana.length, 7)
    }
  }
})

test('julho de 2026 comeca numa quarta-feira', () => {
  // 2026-07-01 é quarta. Então os 3 primeiros quadros da grade são de junho.
  const { semanas } = montarMes(2026, 7, [])
  const primeira = semanas[0]
  assert.equal(primeira[0].doMes, false)
  assert.equal(primeira[2].doMes, false)
  assert.equal(primeira[3].doMes, true)
  assert.equal(primeira[3].iso, '2026-07-01')
})

test('os dias de fora do mes vem preenchidos, nao nulos (a grade nao tem buraco)', () => {
  for (const semana of montarMes(2026, 7, []).semanas) {
    for (const dia of semana) {
      assert.match(dia.iso, /^\d{4}-\d{2}-\d{2}$/)
      assert.equal(typeof dia.numero, 'number')
      assert.ok(Array.isArray(dia.pecas))
    }
  }
})

test('fevereiro bissexto tem o dia 29', () => {
  const dias = montarMes(2024, 2, []).semanas.flat().filter(d => d.doMes)
  assert.equal(dias.length, 29)
  assert.equal(dias.at(-1).iso, '2024-02-29')
})

test('fevereiro comum tem 28 dias', () => {
  assert.equal(montarMes(2026, 2, []).semanas.flat().filter(d => d.doMes).length, 28)
})

test('as datas sao contiguas do primeiro ao ultimo quadro', () => {
  const todos = montarMes(2026, 7, []).semanas.flat()
  for (let i = 1; i < todos.length; i++) {
    const anterior = new Date(`${todos[i - 1].iso}T12:00:00Z`)
    const atual = new Date(`${todos[i].iso}T12:00:00Z`)
    assert.equal((atual - anterior) / 86400000, 1, `salto entre ${todos[i - 1].iso} e ${todos[i].iso}`)
  }
})

test('a virada de ano funciona (dezembro puxa dias de janeiro seguinte)', () => {
  const ultimo = montarMes(2026, 12, []).semanas.flat().at(-1)
  assert.ok(ultimo.iso.startsWith('2027-01') || ultimo.iso === '2026-12-31')
})

// ── Distribuição das peças ──────────────────────────────────────────────────

test('a peca cai no dia certo em BRT, nao em UTC', () => {
  // 2026-07-10T02:00:00Z = 09/07 às 23h em Brasília. Tem que cair no dia 9.
  const { semanas } = montarMes(2026, 7, [peca('a', '2026-07-10T02:00:00Z')])
  const dia9 = semanas.flat().find(d => d.iso === '2026-07-09')
  const dia10 = semanas.flat().find(d => d.iso === '2026-07-10')
  assert.deepEqual(dia9.pecas.map(p => p.id), ['a'])
  assert.deepEqual(dia10.pecas, [])
})

test('as pecas do dia saem ordenadas por horario', () => {
  const pecas = [
    peca('tarde', '2026-07-15T21:00:00Z'),   // 18h BRT
    peca('manha', '2026-07-15T12:00:00Z'),   // 09h BRT
    peca('meio',  '2026-07-15T15:00:00Z'),   // 12h BRT
  ]
  const dia = montarMes(2026, 7, pecas).semanas.flat().find(d => d.iso === '2026-07-15')
  assert.deepEqual(dia.pecas.map(p => p.id), ['manha', 'meio', 'tarde'])
})

test('peca sem data nao entra na grade e nao quebra', () => {
  const { semanas, semData } = montarMes(2026, 7, [peca('x', null), peca('y', '2026-07-15T15:00:00Z')])
  assert.equal(semanas.flat().reduce((n, d) => n + d.pecas.length, 0), 1)
  assert.deepEqual(semData.map(p => p.id), ['x'])
})

test('peca de outro mes aparece se cair num quadro visivel da grade', () => {
  // 2026-06-30 é terça e aparece na primeira semana de julho.
  const dia = montarMes(2026, 7, [peca('junho', '2026-06-30T15:00:00Z')])
    .semanas.flat().find(d => d.iso === '2026-06-30')
  assert.deepEqual(dia.pecas.map(p => p.id), ['junho'])
})

test('peca fora da janela visivel e simplesmente ignorada', () => {
  const { semanas } = montarMes(2026, 7, [peca('longe', '2026-01-15T15:00:00Z')])
  assert.equal(semanas.flat().reduce((n, d) => n + d.pecas.length, 0), 0)
})

test('lista nula de pecas devolve grade vazia sem erro', () => {
  assert.equal(montarMes(2026, 7, null).semanas.length >= 4, true)
})

test('o total de pecas colocadas bate com o que entrou', () => {
  const pecas = ['2026-07-01', '2026-07-15', '2026-07-31'].map((d, i) => peca(i, `${d}T15:00:00Z`))
  const { semanas } = montarMes(2026, 7, pecas)
  assert.equal(semanas.flat().reduce((n, d) => n + d.pecas.length, 0), 3)
})

// ── diaDaPeca ───────────────────────────────────────────────────────────────

test('diaDaPeca converte para o dia BRT', () => {
  assert.equal(diaDaPeca('2026-07-10T02:00:00Z'), '2026-07-09')
  assert.equal(diaDaPeca('2026-07-10T12:00:00Z'), '2026-07-10')
})

test('diaDaPeca devolve null para data ausente ou invalida', () => {
  assert.equal(diaDaPeca(null), null)
  assert.equal(diaDaPeca('nao é data'), null)
})

// ── Hora e formatação ───────────────────────────────────────────────────────

test('horaDaPeca mostra a hora de Brasilia, nao a UTC', () => {
  assert.equal(horaDaPeca('2026-07-15T21:00:00Z'), '18:00')
  assert.equal(horaDaPeca('2026-07-10T02:30:00Z'), '23:30')
})

test('horaDaPeca devolve vazio sem data', () => {
  assert.equal(horaDaPeca(null), '')
  assert.equal(horaDaPeca('nao é data'), '')
})

test('dataHoraBRT sai no formato brasileiro', () => {
  assert.equal(dataHoraBRT('2026-07-15T21:00:00Z'), '15/07 às 18:00')
  assert.equal(dataHoraBRT(null), '—')
})

// ── Ida e volta do campo de data/hora ───────────────────────────────────────

test('o campo recebe a hora BRT, nao a UTC', () => {
  assert.equal(paraCampoDeDataHora('2026-07-15T21:00:00Z'), '2026-07-15T18:00')
})

test('a virada de dia em BRT nao escorrega para o dia seguinte', () => {
  // 2026-07-10T02:00Z ainda é dia 9 às 23h em Brasília.
  assert.equal(paraCampoDeDataHora('2026-07-10T02:00:00Z'), '2026-07-09T23:00')
})

test('o que o campo devolve vira UTC corretamente', () => {
  assert.equal(deCampoDeDataHora('2026-07-15T18:00'), '2026-07-15T21:00:00.000Z')
})

test('ida e volta preserva o valor (o bug classico mora aqui)', () => {
  for (const iso of ['2026-07-15T21:00:00.000Z', '2026-01-01T02:30:00.000Z', '2026-12-31T23:45:00.000Z']) {
    assert.equal(deCampoDeDataHora(paraCampoDeDataHora(iso)), iso, `perdeu na volta: ${iso}`)
  }
})

test('campo vazio vira nulo dos dois lados', () => {
  assert.equal(paraCampoDeDataHora(null), '')
  assert.equal(deCampoDeDataHora(''), null)
  assert.equal(deCampoDeDataHora(null), null)
})
