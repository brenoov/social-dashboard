// Testes da lógica pura de patrimônio: formatar/parsear valor em reais e
// fechar/abrir o histórico de posse ao trocar o dono de um item.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatarValor,
  parsearValor,
  CATEGORIAS_PATRIMONIO,
  fecharEAbrirHistorico,
} from './patrimonio.js'

// --- formatarValor: centavos (int) -> "R$ 1.234,56" ---
test('formatarValor formata centavos como reais brasileiros', () => {
  assert.equal(formatarValor(123456), 'R$ 1.234,56')
  assert.equal(formatarValor(0), 'R$ 0,00')
  assert.equal(formatarValor(5), 'R$ 0,05')
  assert.equal(formatarValor(100), 'R$ 1,00')
  assert.equal(formatarValor(199990), 'R$ 1.999,90')
})

test('formatarValor sem valor mostra travessão, não "R$ 0,00"', () => {
  assert.equal(formatarValor(null), '—')
  assert.equal(formatarValor(undefined), '—')
})

// --- parsearValor: texto do usuário -> centavos (int) ---
test('parsearValor entende os formatos que uma pessoa digita', () => {
  assert.equal(parsearValor('R$ 1.234,56'), 123456)
  assert.equal(parsearValor('1.234,56'), 123456)
  assert.equal(parsearValor('1234,56'), 123456)
  assert.equal(parsearValor('1234.56'), 123456) // ponto decimal (formato máquina)
  assert.equal(parsearValor('1234'), 123400)     // inteiro = reais cheios
  assert.equal(parsearValor('0'), 0)
})

test('parsearValor devolve null pra entrada inválida (não zero, que enganaria)', () => {
  assert.equal(parsearValor('abc'), null)
  assert.equal(parsearValor(''), null)
  assert.equal(parsearValor(null), null)
  assert.equal(parsearValor(undefined), null)
})

test('formatar e parsear são inversos (ida e volta não perde centavo)', () => {
  for (const c of [0, 5, 100, 123456, 199990]) {
    assert.equal(parsearValor(formatarValor(c)), c)
  }
})

test('as categorias sugeridas existem e cobrem os tipos de bem', () => {
  assert.ok(Array.isArray(CATEGORIAS_PATRIMONIO))
  for (const cat of ['TI', 'Móveis', 'Veículos', 'Telefonia', 'Outro']) {
    assert.ok(CATEGORIAS_PATRIMONIO.includes(cat), `falta categoria ${cat}`)
  }
})

// --- fecharEAbrirHistorico: troca de dono ---
const HOJE = '2026-07-17'

test('item sem histórico: só abre o registro do primeiro dono', () => {
  const r = fecharEAbrirHistorico({ historicoAtual: [], novoDonoId: 'p1', novoDonoNome: 'Ana', hoje: HOJE })
  assert.equal(r.aFechar, null)
  assert.deepEqual(r.aAbrir, { pessoa_id: 'p1', pessoa_nome: 'Ana', de: HOJE, ate: null })
})

test('trocar de dono fecha o aberto (ate=hoje) e abre o novo', () => {
  const historicoAtual = [{ id: 'h1', pessoa_id: 'p1', pessoa_nome: 'Ana', de: '2026-01-01', ate: null }]
  const r = fecharEAbrirHistorico({ historicoAtual, novoDonoId: 'p2', novoDonoNome: 'Beto', hoje: HOJE })
  assert.deepEqual(r.aFechar, { id: 'h1', ate: HOJE })
  assert.deepEqual(r.aAbrir, { pessoa_id: 'p2', pessoa_nome: 'Beto', de: HOJE, ate: null })
})

test('mesmo dono é no-op (não fecha nem abre nada — idempotente)', () => {
  const historicoAtual = [{ id: 'h1', pessoa_id: 'p1', pessoa_nome: 'Ana', de: '2026-01-01', ate: null }]
  const r = fecharEAbrirHistorico({ historicoAtual, novoDonoId: 'p1', novoDonoNome: 'Ana', hoje: HOJE })
  assert.equal(r.aFechar, null)
  assert.equal(r.aAbrir, null)
})

test('registros já fechados são ignorados na hora de decidir o que fechar', () => {
  const historicoAtual = [
    { id: 'h0', pessoa_id: 'p0', pessoa_nome: 'Antigo', de: '2025-01-01', ate: '2026-01-01' },
    { id: 'h1', pessoa_id: 'p1', pessoa_nome: 'Ana', de: '2026-01-01', ate: null },
  ]
  const r = fecharEAbrirHistorico({ historicoAtual, novoDonoId: 'p2', novoDonoNome: 'Beto', hoje: HOJE })
  assert.deepEqual(r.aFechar, { id: 'h1', ate: HOJE }) // fecha o aberto, não o já-fechado
  assert.deepEqual(r.aAbrir, { pessoa_id: 'p2', pessoa_nome: 'Beto', de: HOJE, ate: null })
})
