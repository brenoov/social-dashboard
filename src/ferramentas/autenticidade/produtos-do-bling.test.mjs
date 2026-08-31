import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ehProdutoVessel, corDoProduto, modeloDoProduto, produtosParaEscolher, procurarProduto,
} from './produtos-do-bling.js'

// Os exemplos abaixo NAO sao inventados: sairam do Bling de verdade em
// 31/08/2026, de uma varredura dos 400 produtos ativos.

test('ehProdutoVessel: so o SKU do formato NOVO', () => {
  assert.equal(ehProdutoVessel('SS1088-Mostarda'), true)
  assert.equal(ehProdutoVessel('SS-00002-1.01.03.01.01'), true)
  assert.equal(ehProdutoVessel('LV1021-Quartz'), false, 'a linha antiga nao recebe etiqueta')
  assert.equal(ehProdutoVessel(''), false)
  assert.equal(ehProdutoVessel(null), false)
})

test('corDoProduto: um hifen, e a cor termina o nome', () => {
  assert.equal(corDoProduto('SS1088-Mostarda', 'Bolsa De Mão Média Bath Mostarda'), 'Mostarda')
})

test('corDoProduto: DOIS hifens — pega o pedaco que termina o nome', () => {
  // "Fly Amendoa" e o forro, nao a cor. Quem manda e o nome do produto.
  assert.equal(
    corDoProduto('SS1234-Caramelo-Fly Amendoa', 'Bolsa de Mão Angers Caramelo'),
    'Caramelo')
})

test('corDoProduto: sem acento e sem caixa, os dois lados', () => {
  assert.equal(corDoProduto('SS1088-Bordo', 'Bolsa Tote Grande Paris Bordô'), 'Bordo')
})

test('corDoProduto: quando o codigo NAO tem cor, volta VAZIO', () => {
  // Campo vazio a pessoa ve; campo errado ela nao. Foi assim que o catalogo
  // leu "Bolsa Tote Grande Florenca Caramelo" como modelo "Caramelo".
  assert.equal(corDoProduto('SS-00002-1.01.03.01.01', 'Bolsa Tote Grande Paris Bordô'), '')
})

test('corDoProduto: pedaco que NAO termina o nome nao vira cor', () => {
  assert.equal(corDoProduto('SS1088-Mostarda', 'Bolsa Bath Mostarda Especial'), '')
})

test('modeloDoProduto: tira o "Bolsa" da frente e a cor do fim', () => {
  assert.equal(
    modeloDoProduto('Bolsa De Mão Média Bath Mostarda', 'Mostarda'),
    'De Mão Média Bath')
})

test('modeloDoProduto: sem cor, tira so o "Bolsa"', () => {
  assert.equal(modeloDoProduto('Bolsa Tote Grande Paris Bordô', ''), 'Tote Grande Paris Bordô')
})

test('modeloDoProduto: nao deixa o modelo VAZIO', () => {
  // se o nome inteiro fosse a cor, cortar deixaria a pessoa sem nada na tela
  assert.equal(modeloDoProduto('Bolsa Mostarda', 'Mostarda'), 'Mostarda')
})

test('produtosParaEscolher: filtra a linha antiga e ordena por nome', () => {
  const doBling = [
    { codigo: 'LV1021-Quartz', nome: 'Bolsa De Ombro Grande Mônaco Quartz' },
    { codigo: 'SS1088-Mostarda', nome: 'Bolsa De Mão Média Bath Mostarda' },
    { codigo: 'SS1234-Caramelo-Fly Amendoa', nome: 'Bolsa de Mão Angers Caramelo' },
  ]
  const lista = produtosParaEscolher(doBling)
  assert.equal(lista.length, 2, 'a LV fica de fora')
  assert.deepEqual(lista.map((p) => p.codigo),
    ['SS1234-Caramelo-Fly Amendoa', 'SS1088-Mostarda'])
  assert.equal(lista[1].cor, 'Mostarda')
  assert.equal(lista[1].modelo, 'De Mão Média Bath')
})

test('produtosParaEscolher: entrada estranha nao quebra a tela', () => {
  assert.deepEqual(produtosParaEscolher(null), [])
  assert.deepEqual(produtosParaEscolher([{ codigo: 'SS1', nome: null }])[0].nome, '')
})

test('procurarProduto: acha sem acento e sem caixa', () => {
  const lista = produtosParaEscolher([
    { codigo: 'SS1088-Mostarda', nome: 'Bolsa De Mão Média Bath Mostarda' },
  ])
  assert.equal(procurarProduto(lista, 'MAO').length, 1, 'sem acento tem de achar')
  assert.equal(procurarProduto(lista, 'bath').length, 1)
  assert.equal(procurarProduto(lista, 'ss1088').length, 1, 'quem tem o SKU procura por ele')
  assert.equal(procurarProduto(lista, 'monaco').length, 0)
})

test('procurarProduto: busca vazia devolve a lista inteira', () => {
  const lista = [{ codigo: 'SS1', nome: 'a', cor: '', modelo: 'a' }]
  assert.equal(procurarProduto(lista, '').length, 1)
  assert.equal(procurarProduto(lista, '   ').length, 1)
})
