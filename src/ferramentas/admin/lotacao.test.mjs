import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPor, DIMENSOES } from './lotacao.js'

const P = (nome, extra = {}) => ({ id: nome, nome, email: nome + '@x.com', papel: 'viewer', marca: null, local: null, setor: null, temCadastro: true, ...extra })

test('as tres gavetas existem, nesta ordem', () => {
  assert.deepEqual(DIMENSOES.map((d) => d.chave), ['marca', 'local', 'setor'])
})

test('agrupa por marca e conta cada grupo', () => {
  const g = agruparPor([P('Ana', { marca: 'Vessel' }), P('Bia', { marca: 'Vessel' }), P('Caio', { marca: 'Moto Easy' })], 'marca')
  assert.deepEqual(g.map((x) => [x.rotulo, x.quantos]), [['Moto Easy', 1], ['Vessel', 2]])
})

test('os grupos saem em ordem alfabetica, para a lista nao dancar', () => {
  const g = agruparPor([P('A', { setor: 'RH' }), P('B', { setor: 'Comercial' })], 'setor')
  assert.deepEqual(g.map((x) => x.rotulo), ['Comercial', 'RH'])
})

test('quem nao tem lotacao vai para um grupo proprio, SEMPRE por ultimo', () => {
  // Mesmo sendo o maior grupo. Ele e um lembrete, nao o assunto principal —
  // se abrisse a lista, a tela pareceria vazia.
  const g = agruparPor([P('Ana'), P('Bia'), P('Caio', { marca: 'Vessel' })], 'marca')
  assert.equal(g.length, 2)
  assert.equal(g[0].rotulo, 'Vessel')
  assert.equal(g[1].semLotacao, true)
  assert.equal(g[1].quantos, 2)
  assert.match(g[1].rotulo, /[Ss]em marca/)
})

test('sem ninguem sem lotacao, o grupo "sem" nao aparece', () => {
  const g = agruparPor([P('Ana', { local: 'Sede Centro' })], 'local')
  assert.equal(g.length, 1)
  assert.equal(g[0].semLotacao, undefined)
})

test('lista vazia devolve lista vazia, sem estourar', () => {
  assert.deepEqual(agruparPor([], 'marca'), [])
  assert.deepEqual(agruparPor(null, 'marca'), [])
})

test('dimensao desconhecida joga todo mundo em "sem", em vez de sumir com as pessoas', () => {
  // Falhar mostrando todo mundo e melhor que falhar mostrando ninguem: uma tela
  // vazia parece "nao ha usuarios", que e a mentira mais cara aqui.
  const g = agruparPor([P('Ana', { marca: 'Vessel' })], 'inventada')
  assert.equal(g.length, 1)
  assert.equal(g[0].semLotacao, true)
  assert.equal(g[0].quantos, 1)
})

test('as pessoas de cada grupo vem em ordem alfabetica', () => {
  const g = agruparPor([P('Zeca', { setor: 'RH' }), P('Ana', { setor: 'RH' })], 'setor')
  assert.deepEqual(g[0].pessoas.map((p) => p.nome), ['Ana', 'Zeca'])
})
