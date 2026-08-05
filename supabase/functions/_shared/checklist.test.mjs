import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  diaDaSemana, ehDiaDoMensal, diasEntre,
  semanalAtrasado, mensalAtrasado, cadenciasDoDia,
  itensDaFicha, hodometroAceito, problemasDaFicha,
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

/* ── Os itens que entram na ficha ────────────────────────────────────────── */

const ITENS = [
  { id: 'd1', item: 'Painel — luzes de advertência', cadencia: 'diario',  ordem: 1, ativo: true },
  { id: 'd2', item: 'Vazamentos sob o veículo',      cadencia: 'diario',  ordem: 2, ativo: true },
  { id: 'd9', item: 'Item desligado',                cadencia: 'diario',  ordem: 3, ativo: false },
  { id: 's1', item: 'Faróis',                        cadencia: 'semanal', ordem: 10, ativo: true },
  { id: 'm1', item: 'Nível do óleo do motor',        cadencia: 'mensal',  ordem: 30, ativo: true },
]

test('a ficha traz só os itens das cadências do dia, na ordem', () => {
  const f = itensDaFicha(ITENS, ['diario', 'semanal'])
  assert.deepEqual(f.map((i) => i.id), ['d1', 'd2', 's1'])
})

test('item desligado pelo gestor não entra na ficha', () => {
  assert.equal(itensDaFicha(ITENS, ['diario']).some((i) => i.id === 'd9'), false)
})

test('fim de semana: nenhuma cadência, nenhum item', () => {
  assert.deepEqual(itensDaFicha(ITENS, []), [])
})

/* ── O hodômetro ─────────────────────────────────────────────────────────── */

test('hodômetro em branco ou zero não passa', () => {
  assert.equal(hodometroAceito(null, 100000).ok, false)
  assert.equal(hodometroAceito(0, 100000).ok, false)
})

test('primeiro hodômetro do carro passa: não há com o que comparar', () => {
  const r = hodometroAceito(148320, null)
  assert.equal(r.ok, true)
  assert.equal(r.precisaJustificar, false)
})

test('hodômetro que anda para trás não passa, e diz qual era o último', () => {
  // O caso real: a planilha trazia o Doblo com 136.172 atual contra troca de
  // óleo em 272.257, e a importação recusou o dado de propósito.
  const r = hodometroAceito(136172, 272257)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /272\.257/)
})

test('salto grande demais pede confirmação, mas é justificável', () => {
  const r = hodometroAceito(160000, 148000)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /12\.000/)
})

test('avanço normal passa liso', () => {
  assert.deepEqual(hodometroAceito(148500, 148320),
    { ok: true, precisaJustificar: false, motivo: '' })
})

/* ── A ficha inteira ─────────────────────────────────────────────────────── */

const DIARIOS = ITENS.filter((i) => i.cadencia === 'diario' && i.ativo)

test('ficha completa e com hodômetro bom não tem problema nenhum', () => {
  assert.deepEqual(problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok', d2: 'nao_ok' }, itens: DIARIOS,
  }), [])
})

test('item sem resposta é problema, e a mensagem diz qual', () => {
  const p = problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
  assert.match(p[0], /Vazamentos sob o veículo/)
})

test('hodômetro para trás COM justificativa escrita passa', () => {
  // A trava não impede: ela obriga a pessoa a dizer o que aconteceu, pra o
  // número estranho ficar explicado no registro em vez de virar mistério.
  assert.deepEqual(problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257,
    justificativa: 'Painel trocado na oficina semana passada, zerou.',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  }), [])
})

test('hodômetro para trás com justificativa curta demais NÃO passa', () => {
  const p = problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257, justificativa: 'sei la',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
})
