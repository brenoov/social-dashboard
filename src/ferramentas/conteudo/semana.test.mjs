import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CADENCIA_PADRAO, segundaDaSemana, proximaSegunda, slotsDaSemana,
  casarSlotsComIdeias, conferirPlano, resumoDaSemana,
} from './semana.js'

// ---------- a segunda-feira ----------

test('segundaDaSemana volta a segunda, de qualquer dia', () => {
  // 2026-08-05 é uma quarta.
  assert.equal(segundaDaSemana('2026-08-05T10:00:00').getDate(), 3)
  // De uma segunda, ela mesma.
  assert.equal(segundaDaSemana('2026-08-03T10:00:00').getDate(), 3)
})

test('DOMINGO pertence à semana que COMEÇOU, não à que vai começar', () => {
  // 2026-08-09 é domingo; a segunda dele é 03, não 10. Quem planeja pensa em
  // semana começando na segunda — errar isto joga o domingo para a semana
  // errada e o plano nasce com um dia fora.
  assert.equal(segundaDaSemana('2026-08-09T10:00:00').getDate(), 3)
})

test('segundaDaSemana zera a hora', () => {
  const d = segundaDaSemana('2026-08-05T23:45:00')
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 0)
})

test('data invalida devolve null, nao Invalid Date', () => {
  for (const v of ['', 'abc', null, undefined]) assert.equal(segundaDaSemana(v), null)
})

test('proximaSegunda pula uma semana inteira', () => {
  // De quarta 05/08 → segunda 10/08, não 03/08 (que já passou).
  const p = proximaSegunda(new Date('2026-08-05T10:00:00'))
  assert.equal(p.getDate(), 10)
})

test('estando NA segunda, propoe a seguinte', () => {
  // Planejar a semana corrente com ela já em curso produziria slots no passado.
  assert.equal(proximaSegunda(new Date('2026-08-03T10:00:00')).getDate(), 10)
})

// ---------- os slots ----------

test('a cadencia padrao dá 3 slots em dias alternados', () => {
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'))
  assert.equal(s.length, 3)
  assert.deepEqual(s.map(x => x.data), ['2026-08-03', '2026-08-05', '2026-08-07'])
  assert.deepEqual(s.map(x => x.nome_do_dia), ['segunda', 'quarta', 'sexta'])
})

test('os slots saem em ordem de data e hora', () => {
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'), [
    { dia: 5, hora: '19:00' }, { dia: 1, hora: '09:00' }, { dia: 1, hora: '19:00' },
  ])
  assert.deepEqual(s.map(x => `${x.data} ${x.hora}`), [
    '2026-08-03 09:00', '2026-08-03 19:00', '2026-08-07 19:00',
  ])
})

test('domingo (dia 0) cai no FIM da semana, nao no comeco', () => {
  // A semana começa na segunda: domingo é o sétimo dia, não o primeiro.
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'), [{ dia: 0, hora: '18:00' }])
  assert.equal(s[0].data, '2026-08-09')
})

test('a data do slot NAO escorrega de fuso', () => {
  // `toISOString()` converteria para UTC e jogaria a segunda brasileira para
  // domingo em qualquer horário antes das 21h.
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'))
  assert.equal(s[0].data, '2026-08-03')
})

test('cadencia suja e ignorada em vez de gerar slot invalido', () => {
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'), [
    { dia: 1, hora: '10:00' }, { dia: 9 }, { dia: -1 }, {}, null,
  ])
  assert.equal(s.length, 1)
})

test('slot sem hora recebe um padrao, nunca vazio', () => {
  const s = slotsDaSemana(new Date('2026-08-03T00:00:00'), [{ dia: 1 }])
  assert.equal(s[0].hora, '12:00')
})

// ---------- casar com o banco de ideias ----------

const BANCO = [
  { id: 'a', titulo: 'Quem é o Breno', formato: 'reels', pilar: 'bastidor' },
  { id: 'b', titulo: 'O erro da marca pessoal', formato: 'reels', pilar: 'educativo' },
]

test('o slot aponta a ideia do banco pelo INDICE', () => {
  const r = casarSlotsComIdeias(
    [{ data: '2026-08-03', hora: '19:00', ideia_do_banco: 1 }], BANCO,
  )
  assert.equal(r[0].ideia.id, 'b')
  assert.equal(r[0].formato, 'reels', 'herda o formato da ideia quando o slot não diz')
})

test('indice fora da lista NAO inventa ideia', () => {
  for (const i of [5, -1, 'x', null]) {
    const r = casarSlotsComIdeias([{ data: '2026-08-03', ideia_do_banco: i, titulo_novo: 'nova' }], BANCO)
    assert.equal(r[0].ideia, null)
    assert.equal(r[0].titulo_novo, 'nova')
  }
})

test('slot sem ideia e sem titulo novo e descartado', () => {
  const r = casarSlotsComIdeias([{ data: '2026-08-03', hora: '19:00' }], BANCO)
  assert.deepEqual(r, [])
})

test('slot sem data e descartado', () => {
  assert.deepEqual(casarSlotsComIdeias([{ titulo_novo: 'x' }], BANCO), [])
})

test('quando vem do banco, o titulo novo e ignorado', () => {
  // Senão a tela mostraria dois títulos para a mesma coisa.
  const r = casarSlotsComIdeias(
    [{ data: '2026-08-03', ideia_do_banco: 0, titulo_novo: 'outro nome' }], BANCO,
  )
  assert.equal(r[0].titulo_novo, null)
  assert.equal(r[0].ideia.titulo, 'Quem é o Breno')
})

// ---------- a conferência ----------

test('plano vazio e problema', () => {
  assert.deepEqual(conferirPlano([], new Date('2026-08-03')), ['O plano voltou vazio.'])
})

test('acusa data fora da semana planejada', () => {
  const p = conferirPlano(
    [{ data: '2026-08-20', titulo_novo: 'x' }], new Date('2026-08-03T00:00:00'),
  )
  assert.match(p.join(' '), /fora da semana/)
})

test('acusa a MESMA pauta em dois dias', () => {
  // O engano mais comum quando a IA tem um banco grande para escolher.
  const p = conferirPlano([
    { data: '2026-08-03', ideia: { id: 'a', titulo: 'Quem é o Breno' } },
    { data: '2026-08-05', ideia: { id: 'a', titulo: 'Quem é o Breno' } },
  ], new Date('2026-08-03T00:00:00'))
  assert.match(p.join(' '), /duas vezes/)
})

test('plano bom nao acusa nada', () => {
  const p = conferirPlano([
    { data: '2026-08-03', ideia: { id: 'a' } },
    { data: '2026-08-05', ideia: { id: 'b' } },
    { data: '2026-08-07', titulo_novo: 'pauta nova' },
  ], new Date('2026-08-03T00:00:00'))
  assert.deepEqual(p, [])
})

test('data invalida no plano e acusada, nao ignorada', () => {
  const p = conferirPlano([{ data: 'quarta-feira', titulo_novo: 'x' }], new Date('2026-08-03'))
  assert.match(p.join(' '), /inválida/)
})

// ---------- o resumo ----------

test('o resumo conta formato, pilar e origem', () => {
  const r = resumoDaSemana([
    { formato: 'reels', ideia: { id: 'a', pilar: 'bastidor' } },
    { formato: 'reels', ideia: { id: 'b', pilar: 'educativo' } },
    { formato: 'carrossel', titulo_novo: 'nova' },
  ])
  assert.equal(r.total, 3)
  assert.equal(r.formatos.reels, 2)
  assert.equal(r.formatos.carrossel, 1)
  assert.equal(r.doBanco, 2)
  assert.equal(r.novas, 1)
})

test('resumo de lista vazia nao quebra', () => {
  for (const v of [null, undefined, []]) {
    const r = resumoDaSemana(v)
    assert.equal(r.total, 0)
    assert.deepEqual(r.formatos, {})
  }
})

test('a cadencia padrao nao tem dois posts no mesmo dia', () => {
  const dias = CADENCIA_PADRAO.map(c => c.dia)
  assert.equal(new Set(dias).size, dias.length)
})
