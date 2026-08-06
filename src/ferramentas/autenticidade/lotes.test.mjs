import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enderecoDaTag, progressoDoLote, proximaPorGravar, linhasDoCsv, resumoDeAlertas,
} from './lotes.js'

test('enderecoDaTag: e exatamente o que vai gravado na etiqueta', () => {
  assert.equal(enderecoDaTag('K7M4X9QP2R'), 'https://vesselbrasil.com.br/verify/K7M4X9QP2R')
})

test('progressoDoLote: conta so as que ja foram gravadas', () => {
  const pecas = [{ gravada_em: '2026-08-05T10:00:00Z' }, { gravada_em: null }, { gravada_em: null }]
  assert.deepEqual(progressoDoLote(pecas), { gravadas: 1, total: 3, texto: '1 de 3' })
})

test('progressoDoLote: lote vazio nao divide por zero', () => {
  assert.deepEqual(progressoDoLote([]), { gravadas: 0, total: 0, texto: '0 de 0' })
})

test('proximaPorGravar: a primeira sem gravacao, na ordem da serie', () => {
  // de proposito fora de ordem: o banco nao garante ordem sem order by
  const pecas = [
    { codigo: 'B', numero_na_serie: 2, gravada_em: null },
    { codigo: 'A', numero_na_serie: 1, gravada_em: '2026-08-05T10:00:00Z' },
    { codigo: 'C', numero_na_serie: 3, gravada_em: null },
  ]
  assert.equal(proximaPorGravar(pecas).codigo, 'B')
})

test('proximaPorGravar: lote inteiro gravado devolve nulo', () => {
  assert.equal(proximaPorGravar([{ codigo: 'A', numero_na_serie: 1, gravada_em: 'x' }]), null)
})

test('linhasDoCsv: cabecalho + uma linha por registro', () => {
  const csv = linhasDoCsv([{
    codigo: 'K7M4X9QP2R', nome: 'Ana', whatsapp: '19998887766',
    onde_comprou: 'Loja Tivoli', comprado_em: '2026-08-01', garantia_ate: '2028-08-01',
  }])
  const linhas = csv.split('\n')
  assert.equal(linhas[0], 'codigo;nome;whatsapp;onde comprou;comprado em;garantia ate')
  assert.equal(linhas[1], 'K7M4X9QP2R;Ana;19998887766;Loja Tivoli;2026-08-01;2028-08-01')
})

test('linhasDoCsv: ponto-e-virgula no texto nao quebra a coluna', () => {
  // "Ana; Maria" sem aspas viraria DUAS colunas e desalinharia a planilha toda
  const csv = linhasDoCsv([{ codigo: 'A', nome: 'Ana; Maria', whatsapp: '1' }])
  assert.equal(csv.split('\n')[1], 'A;"Ana; Maria";1;;;')
})

test('linhasDoCsv: aspas dentro do texto sao escapadas', () => {
  const csv = linhasDoCsv([{ codigo: 'A', nome: 'Ana "Aninha"', whatsapp: '1' }])
  assert.equal(csv.split('\n')[1], 'A;"Ana ""Aninha""";1;;;')
})

test('resumoDeAlertas: sem nada suspeito, diz que esta limpo', () => {
  assert.equal(resumoDeAlertas({ repetidas: [], invalidas: [] }).limpo, true)
})

test('resumoDeAlertas: conta os dois tipos', () => {
  const r = resumoDeAlertas({ repetidas: [{ codigo: 'A' }], invalidas: [{ codigo: 'B' }, { codigo: 'C' }] })
  assert.deepEqual({ limpo: r.limpo, repetidas: r.repetidas, invalidas: r.invalidas },
    { limpo: false, repetidas: 1, invalidas: 2 })
})

test('resumoDeAlertas: resposta vazia do banco nao quebra a tela', () => {
  assert.equal(resumoDeAlertas(null).limpo, true)
  assert.equal(resumoDeAlertas({}).limpo, true)
})
