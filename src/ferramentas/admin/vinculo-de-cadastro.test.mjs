import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoDoVinculo } from './vinculo-de-cadastro.js'

const LOGIN = { id: 'u-1', email: 'raissaherculano@rbvcompany.com' }
const C = (extra) => ({ id: 'c-1', nome: 'Raissa Herculano', email_corporativo: null, conta_apple: null, profile_id: null, ...extra })

test('ja ligado: o vinculo existe e nao ha nada a sugerir', () => {
  const r = estadoDoVinculo(LOGIN, [C({ profile_id: 'u-1' })])
  assert.equal(r.estado, 'ligado')
  assert.equal(r.colaborador.nome, 'Raissa Herculano')
})

test('o caso REAL da Raissa: cadastro existe, e-mail bate, profile_id nulo', () => {
  // Este e o defeito que motivou a etapa 2. A tela dizia "sem cadastro de
  // colaborador" porque so cruzava por profile_id.
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'raissaherculano@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
  assert.equal(r.colaborador.nome, 'Raissa Herculano')
})

test('maiuscula nao atrapalha o casamento', () => {
  const r = estadoDoVinculo({ id: 'u-1', email: 'Raissa@RBVcompany.com' }, [C({ email_corporativo: 'raissa@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
})

test('casa tambem pela conta Apple, nao so pelo e-mail corporativo', () => {
  const r = estadoDoVinculo(LOGIN, [C({ conta_apple: 'raissaherculano@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
})

test('colaborador JA LIGADO A OUTRO login nao vira sugestao', () => {
  // Sugerir aqui levaria a roubar o cadastro de outra pessoa: um clique e a
  // lotacao e o historico dela mudam de dono.
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'raissaherculano@rbvcompany.com', profile_id: 'u-OUTRO' })])
  assert.equal(r.estado, 'sem-cadastro')
  assert.equal(r.colaborador, null)
})

test('dois colaboradores com o mesmo e-mail: ambiguo, nao sugere nenhum', () => {
  // Caixa compartilhada (ti@, tv@) e o caso real disso. Escolher um seria
  // chutar qual pessoa recebe a lotacao.
  const dois = [C({ id: 'c-1', email_corporativo: 'ti@rbvcompany.com' }),
                C({ id: 'c-2', nome: 'Outra', email_corporativo: 'ti@rbvcompany.com' })]
  const r = estadoDoVinculo({ id: 'u-9', email: 'ti@rbvcompany.com' }, dois)
  assert.equal(r.estado, 'ambiguo')
  assert.equal(r.colaborador, null)
})

test('o ja-ligado vence a ambiguidade', () => {
  const lista = [C({ id: 'c-1', profile_id: 'u-1' }),
                 C({ id: 'c-2', nome: 'Homonima', email_corporativo: 'raissaherculano@rbvcompany.com' })]
  assert.equal(estadoDoVinculo(LOGIN, lista).estado, 'ligado')
})

test('ninguem parecido: sem cadastro', () => {
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'outra@rbvcompany.com' })])
  assert.equal(r.estado, 'sem-cadastro')
  assert.equal(r.colaborador, null)
})

test('e-mail vazio dos dois lados NAO casa (senao todo mundo casaria com todo mundo)', () => {
  const r = estadoDoVinculo({ id: 'u-1', email: '' }, [C({ email_corporativo: '' })])
  assert.equal(r.estado, 'sem-cadastro')
})

test('lista vazia e entradas nulas nao estouram', () => {
  assert.equal(estadoDoVinculo(LOGIN, []).estado, 'sem-cadastro')
  assert.equal(estadoDoVinculo(LOGIN, null).estado, 'sem-cadastro')
  assert.equal(estadoDoVinculo(null, [C({})]).estado, 'sem-cadastro')
})
