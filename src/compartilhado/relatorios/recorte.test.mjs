import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarArvore } from '../arvore-de-locais.js'
import {
  RECORTE_VAZIO, filtrarPorRecorte, rotuloDoRecorte, contarForaDoRecorte, opcoesDeLocal,
  aplicarRecorte,
} from './recorte.js'

// Duas "Fábrica Conchal" de marcas diferentes — o caso real medido no banco
// em 10/08/2026: Vessel tem 148 bens ali e RB Builders tem 2.
const EMPRESAS = [{ id: 'e1', nome: 'Vessel' }, { id: 'e2', nome: 'RB Builders' }]
const LOCAIS = [
  { id: 'l1', nome: 'Fábrica Conchal', empresa_id: 'e1' },
  { id: 'l2', nome: 'Fábrica Conchal', empresa_id: 'e2' },
]
const ARVORE = montarArvore({ empresas: EMPRESAS, locais: LOCAIS, comodos: [] })

const LINHAS = [
  { id: 'a', empresa_id: 'e1', local_id: 'l1' },
  { id: 'b', empresa_id: 'e2', local_id: 'l2' },
  { id: 'c', empresa_id: 'e1', local_id: null },
  { id: 'd', empresa_id: null, local_id: null },
]
const pegarIds = (l) => ({ empresaId: l.empresa_id, localId: l.local_id })
const ids = (ls) => ls.map((l) => l.id)

test('"tudo" não tira ninguém, nem quem está sem marca', () => {
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, RECORTE_VAZIO, pegarIds)), ['a', 'b', 'c', 'd'])
})

test('recorte por marca pega a marca inteira, inclusive quem está sem local', () => {
  const r = { modo: 'marca', empresaId: 'e1', localId: '' }
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, r, pegarIds)), ['a', 'c'])
})

test('recorte por local pega SÓ aquele local, e não o homônimo da outra marca', () => {
  const r = { modo: 'local', empresaId: 'e1', localId: 'l1' }
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, r, pegarIds)), ['a'])
})

test('o rótulo do local traz a marca na frente — senão não identifica nada', () => {
  const opcoes = opcoesDeLocal(ARVORE)
  assert.deepEqual(opcoes.map((o) => o.rotulo), [
    'Vessel › Fábrica Conchal',
    'RB Builders › Fábrica Conchal',
  ])
})

test('o rótulo do recorte diz por extenso o que foi escolhido', () => {
  const ctx = { empresas: EMPRESAS, locais: LOCAIS }
  assert.equal(rotuloDoRecorte(RECORTE_VAZIO, ctx), 'Tudo')
  assert.equal(rotuloDoRecorte({ modo: 'marca', empresaId: 'e2' }, ctx), 'RB Builders')
  assert.equal(rotuloDoRecorte({ modo: 'local', empresaId: 'e1', localId: 'l1' }, ctx),
    'Vessel › Fábrica Conchal')
})

test('conta quantos ficaram sem marca e sem local — para a tela avisar', () => {
  // O caso que motivou isto: os 10 veículos da Frota estão TODOS sem marca.
  // Uma tabela que some com linhas caladas é como relatório vira mentira.
  assert.deepEqual(contarForaDoRecorte(LINHAS, pegarIds), { semMarca: 1, semLocal: 2 })
})

// ─── relatório que se recorta sozinho ────────────────────────────────────────
//
// ESTE DEFEITO CHEGOU A EXISTIR (10/08/2026), e passou por um teste verde.
//
// O Resumo se recorta sozinho: em "Tudo" agrupa por marca, com uma marca
// escolhida agrupa por local. Para o filtro genérico não cortar por cima disso,
// o `pegarIds` dele devolvia `null` — só que o filtro compara por IGUALDADE, e
// `null` nunca é igual a 'e1'. Resultado: escolher Vessel esvaziava a tabela
// inteira. "0 linhas · Vessel".
//
// O teste que existia só afirmava que `pegarIds` devolvia nulo. Nunca perguntou
// o que o FILTRO fazia com esse nulo — testou a peça, não a consequência. Quem
// pegou foi abrir a tela.

test('relatório que se recorta sozinho não passa pelo filtro genérico', () => {
  const relatorio = { recortaSozinho: true, pegarIds: () => ({ empresaId: null, localId: null }) }
  const linhas = [{ id: 'x' }, { id: 'y' }]
  const escolhida = { modo: 'marca', empresaId: 'e1', localId: '' }
  assert.deepEqual(aplicarRecorte(relatorio, linhas, escolhida), linhas)
})

test('relatório comum CONTINUA passando pelo filtro genérico', () => {
  const relatorio = { pegarIds }
  const escolhida = { modo: 'marca', empresaId: 'e1', localId: '' }
  assert.deepEqual(ids(aplicarRecorte(relatorio, LINHAS, escolhida)), ['a', 'c'])
})

test('aplicarRecorte sem relatório devolve lista vazia, e não estoura', () => {
  assert.deepEqual(aplicarRecorte(null, LINHAS, RECORTE_VAZIO), [])
})

test('recorte apontando para id que não existe devolve vazio, não devolve tudo', () => {
  // Falhar para o lado de "não achei" é honesto; devolver a base inteira quando
  // o filtro não casa entrega o relatório errado sem ninguém desconfiar.
  const r = { modo: 'local', empresaId: 'e1', localId: 'nao-existe' }
  assert.deepEqual(filtrarPorRecorte(LINHAS, r, pegarIds), [])
})
