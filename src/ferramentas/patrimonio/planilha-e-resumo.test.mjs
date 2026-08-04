import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COLUNAS_PLANILHA, ordenarPlanilha, resumirPor, totaisGerais, montarLinhasParaExcel,
} from './planilha-e-resumo.js'

const LINHAS = [
  { numero: 3, nome: 'Macbook Air M4', categoria: 'Computadores', empresa: 'Vessel', valor_centavos: 800000, situacao: 'em_uso' },
  { numero: 47, nome: 'Xiaomi Redmi', categoria: 'Celulares', empresa: 'Moto Easy', valor_centavos: 120000, situacao: 'em_estoque' },
  { numero: 99, nome: 'Ábaco', categoria: 'Móveis', empresa: 'Vessel', valor_centavos: null, situacao: 'em_uso' },
  { numero: null, nome: 'Cadeira', categoria: 'Móveis', empresa: '', valor_centavos: 50000, situacao: 'em_uso' },
]

test('a planilha tem as colunas que faltavam na tela', () => {
  const chaves = COLUNAS_PLANILHA.map((c) => c.chave)
  for (const c of ['tipo', 'marca', 'etiquetado', 'data_compra', 'observacao']) {
    assert.ok(chaves.includes(c), `faltou a coluna ${c}`)
  }
})

test('ordena por texto respeitando acento do português', () => {
  // 'Ábaco' tem que vir antes de 'Cadeira' — comparar por código de caractere
  // jogaria toda palavra acentuada pro fim da lista.
  assert.deepEqual(ordenarPlanilha(LINHAS, 'nome', true).map((l) => l.nome),
    ['Ábaco', 'Cadeira', 'Macbook Air M4', 'Xiaomi Redmi'])
})

test('ordena por número de verdade, não como texto', () => {
  // Como texto, "47" viria antes de "9". Como número, não.
  const r = ordenarPlanilha([{ numero: 9 }, { numero: 47 }, { numero: 300 }], 'numero', true)
  assert.deepEqual(r.map((l) => l.numero), [9, 47, 300])
})

test('vazio vai pro FIM nas duas direções', () => {
  const cresc = ordenarPlanilha(LINHAS, 'valor_centavos', true)
  const decr = ordenarPlanilha(LINHAS, 'valor_centavos', false)
  assert.equal(cresc[cresc.length - 1].valor_centavos, null, 'sem valor tem que ficar por último')
  assert.equal(decr[decr.length - 1].valor_centavos, null, 'sem valor não pode virar o mais barato')
  assert.deepEqual(cresc.slice(0, 3).map((l) => l.valor_centavos), [50000, 120000, 800000])
})

test('ordenar não muta a lista original', () => {
  const antes = LINHAS.map((l) => l.numero)
  ordenarPlanilha(LINHAS, 'nome', true)
  assert.deepEqual(LINHAS.map((l) => l.numero), antes)
})

test('resumo ranqueia por valor, do maior pro menor', () => {
  const r = resumirPor(LINHAS, (b) => b.categoria)
  assert.deepEqual(r.map((g) => g.chave), ['Computadores', 'Celulares', 'Móveis'])
  assert.equal(r[0].totalCentavos, 800000)
  assert.equal(r[2].quantidade, 2, 'Móveis tem 2 itens mesmo com um deles sem valor')
})

test('resumo calcula a fatia de cada grupo', () => {
  const r = resumirPor(LINHAS, (b) => b.categoria)
  const soma = r.reduce((a, g) => a + g.fatia, 0)
  assert.ok(Math.abs(soma - 1) < 1e-9, 'as fatias têm que somar 1')
  assert.ok(Math.abs(r[0].fatia - 800000 / 970000) < 1e-9)
})

test('grupo vazio ganha rótulo honesto em vez de sumir', () => {
  const r = resumirPor(LINHAS, (b) => b.empresa)
  assert.ok(r.some((g) => g.chave === 'Não informado'), 'o bem sem marca precisa aparecer')
})

test('resumo de lista vazia não quebra', () => {
  assert.deepEqual(resumirPor([], (b) => b.categoria), [])
  assert.deepEqual(resumirPor(null, (b) => b.categoria), [])
})

test('totais do topo separam em uso de em estoque', () => {
  const t = totaisGerais(LINHAS)
  assert.equal(t.itens, 4)
  assert.equal(t.totalCentavos, 970000)
  assert.equal(t.emUso, 3)
  assert.equal(t.emUsoCentavos, 850000)
  assert.equal(t.emEstoque, 1)
  assert.equal(t.emEstoqueCentavos, 120000)
  assert.equal(t.semValor, 1)
})

test('exportação manda dinheiro como NÚMERO em reais, pra somar no Excel', () => {
  const m = montarLinhasParaExcel([LINHAS[0]])
  const iValor = COLUNAS_PLANILHA.findIndex((c) => c.chave === 'valor_centavos')
  assert.equal(m[0][iValor], 'Valor')
  assert.equal(m[1][iValor], 8000)                    // 800000 centavos = 8000 reais
  assert.equal(typeof m[1][iValor], 'number', 'como texto o Excel não soma')
})

test('exportação não escreve "null" nas células vazias', () => {
  const m = montarLinhasParaExcel([{ nome: 'X' }])
  assert.ok(!m[1].some((v) => v === null && typeof v === 'string'))
  assert.ok(m[1].every((v) => v !== 'null' && v !== 'undefined'))
})

test('cabeçalho da exportação bate com as colunas da tela', () => {
  assert.deepEqual(montarLinhasParaExcel([])[0], COLUNAS_PLANILHA.map((c) => c.titulo))
})
