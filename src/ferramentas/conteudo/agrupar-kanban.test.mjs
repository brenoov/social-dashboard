import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COLUNAS_KANBAN, agruparPorStatus, contarPorStatus , pecasReprovadas } from './agrupar-kanban.js'

const peca = (id, status, publicar_em = null) => ({ id, status, publicar_em, titulo: `peça ${id}` })

test('as colunas seguem o caminho do trabalho, da esquerda para a direita', () => {
  assert.deepEqual(COLUNAS_KANBAN, ['rascunho', 'em_aprovacao', 'aprovada', 'agendada', 'publicada'])
})

test('reprovada e arquivada NAO viram coluna (poluiriam o quadro)', () => {
  assert.ok(!COLUNAS_KANBAN.includes('arquivada'))
  assert.ok(!COLUNAS_KANBAN.includes('reprovada'))
})

test('sem pecas, as colunas continuam existindo e vazias', () => {
  // Coluna que some quebra o arrastar: não há onde soltar o cartão.
  const colunas = agruparPorStatus([])
  assert.equal(colunas.length, COLUNAS_KANBAN.length)
  for (const c of colunas) {
    assert.deepEqual(c.pecas, [])
    assert.equal(c.total, 0)
    assert.ok(c.rotulo)
    assert.match(c.cor, /^#[0-9a-f]{6}$/i)
  }
})

test('cada peca cai na sua coluna', () => {
  const colunas = agruparPorStatus([
    peca(1, 'rascunho'),
    peca(2, 'agendada', '2026-07-15T15:00:00Z'),
    peca(3, 'rascunho'),
  ])
  const porChave = Object.fromEntries(colunas.map(c => [c.chave, c.pecas.map(p => p.id)]))
  assert.deepEqual(porChave.rascunho, [1, 3])
  assert.deepEqual(porChave.agendada, [2])
  assert.deepEqual(porChave.publicada, [])
})

test('total bate com a quantidade de cartoes da coluna', () => {
  for (const c of agruparPorStatus([peca(1, 'rascunho'), peca(2, 'rascunho')])) {
    assert.equal(c.total, c.pecas.length)
  }
})

test('reprovada e arquivada nao entram em coluna nenhuma', () => {
  const colunas = agruparPorStatus([peca(1, 'reprovada'), peca(2, 'arquivada')])
  assert.equal(colunas.reduce((n, c) => n + c.total, 0), 0)
})

test('status desconhecido e descartado sem quebrar o quadro', () => {
  const colunas = agruparPorStatus([peca(1, 'coisa_estranha'), peca(2, 'rascunho')])
  assert.equal(colunas.reduce((n, c) => n + c.total, 0), 1)
})

test('a ordem das colunas nao depende da ordem das pecas', () => {
  const a = agruparPorStatus([peca(1, 'publicada'), peca(2, 'rascunho')]).map(c => c.chave)
  const b = agruparPorStatus([peca(2, 'rascunho'), peca(1, 'publicada')]).map(c => c.chave)
  assert.deepEqual(a, COLUNAS_KANBAN)
  assert.deepEqual(a, b)
})

test('dentro da coluna, quem tem data marcada vem primeiro e em ordem', () => {
  const colunas = agruparPorStatus([
    peca('depois', 'agendada', '2026-07-20T15:00:00Z'),
    peca('sem', 'agendada', null),
    peca('antes', 'agendada', '2026-07-01T15:00:00Z'),
  ])
  const agendada = colunas.find(c => c.chave === 'agendada')
  assert.deepEqual(agendada.pecas.map(p => p.id), ['antes', 'depois', 'sem'])
})

test('lista nula devolve o quadro vazio, nao um erro', () => {
  assert.equal(agruparPorStatus(null).length, COLUNAS_KANBAN.length)
})

test('a lista original nao e modificada', () => {
  const pecas = [peca(2, 'agendada', '2026-07-20T15:00:00Z'), peca(1, 'agendada', '2026-07-01T15:00:00Z')]
  agruparPorStatus(pecas)
  assert.deepEqual(pecas.map(p => p.id), [2, 1])
})

// ── contarPorStatus (usado pelos selos da topbar) ───────────────────────────

test('contarPorStatus conta TODOS os status, inclusive os que nao viram coluna', () => {
  const c = contarPorStatus([peca(1, 'rascunho'), peca(2, 'arquivada'), peca(3, 'rascunho')])
  assert.equal(c.rascunho, 2)
  assert.equal(c.arquivada, 1)
  assert.equal(c.publicada, 0)
})

test('contarPorStatus devolve zero em todo status quando nao ha peca', () => {
  const c = contarPorStatus([])
  assert.equal(Object.values(c).every(n => n === 0), true)
  assert.ok('em_aprovacao' in c)
})

// ---------- as reprovadas nao podem sumir em silencio ----------

test('pecasReprovadas devolve so as reprovadas', () => {
  const lista = [
    { id: 'a', status: 'rascunho' },
    { id: 'b', status: 'reprovada', publicar_em: '2026-08-02T12:00:00Z' },
    { id: 'c', status: 'arquivada' },
    { id: 'd', status: 'reprovada', publicar_em: '2026-08-01T12:00:00Z' },
  ]
  const r = pecasReprovadas(lista)
  assert.deepEqual(r.map(p => p.id), ['d', 'b'], 'ordena por data, mais cedo primeiro')
})

test('reprovada NAO vira coluna do quadro', () => {
  const colunas = agruparPorStatus([{ id: 'x', status: 'reprovada' }])
  assert.ok(!colunas.some(c => c.chave === 'reprovada'))
  assert.equal(colunas.reduce((s, c) => s + c.total, 0), 0, 'nao entra em coluna nenhuma')
})

test('arquivada fica de fora dos dois lugares', () => {
  const lista = [{ id: 'x', status: 'arquivada' }]
  assert.deepEqual(pecasReprovadas(lista), [])
  assert.equal(agruparPorStatus(lista).reduce((s, c) => s + c.total, 0), 0)
})

test('pecasReprovadas aguenta lixo', () => {
  for (const v of [null, undefined, [], [null], [{}]]) {
    assert.deepEqual(pecasReprovadas(v), [])
  }
})
