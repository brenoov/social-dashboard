import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FILTRO_VAZIO, filtrarBens, resumoDaLista, normalizar } from './filtro-de-bens.js'

const BENS = [
  { id: 'a', numero: 3, nome: 'Macbook Air M4', valor_centavos: 800000, empresa_id: 'e1', local_id: 'l1', categoria_id: 'c1', situacao: 'em_uso', pessoa_id: 'p1', marca: 'Macbook' },
  { id: 'b', numero: 47, nome: 'Xiaomi Redmi', valor_centavos: 120000, empresa_id: 'e2', local_id: 'l2', categoria_id: 'c2', situacao: 'em_estoque', pessoa_id: null, marca: 'Xiaomi' },
  { id: 'c', numero: 99, nome: 'Cadeira Presidente', valor_centavos: null, empresa_id: 'e1', local_id: 'l1', categoria_id: 'c3', situacao: 'em_uso', pessoa_id: null, dono_texto: 'Raíssa' },
]

test('filtro vazio devolve tudo', () => {
  assert.equal(filtrarBens(BENS, FILTRO_VAZIO).length, 3)
  assert.equal(filtrarBens(BENS, {}).length, 3)
  assert.equal(filtrarBens(BENS, null).length, 3)
})

test('busca por parte do nome, sem ligar pra maiúscula', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'macbook' }).map(b => b.id), ['a'])
  assert.deepEqual(filtrarBens(BENS, { busca: 'MAC' }).map(b => b.id), ['a'])
})

test('busca ignora acento nos dois lados', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'cadeira' }).map(b => b.id), ['c'])
  assert.deepEqual(filtrarBens([{ id: 'x', nome: 'Televisão LG' }], { busca: 'televisao' }).map(b => b.id), ['x'])
})

test('busca pelo número da etiqueta (é assim que se procura com o bem na mão)', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: '47' }).map(b => b.id), ['b'])
})

test('busca acha pelo nome solto de quem está com o bem', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'raissa' }).map(b => b.id), ['c'])
})

test('filtros de lista casam exato e se somam', () => {
  assert.deepEqual(filtrarBens(BENS, { empresaId: 'e1' }).map(b => b.id), ['a', 'c'])
  assert.deepEqual(filtrarBens(BENS, { situacao: 'em_uso' }).map(b => b.id), ['a', 'c'])
  assert.deepEqual(filtrarBens(BENS, { empresaId: 'e1', categoriaId: 'c3' }).map(b => b.id), ['c'])
  assert.deepEqual(filtrarBens(BENS, { localId: 'l2' }).map(b => b.id), ['b'])
})

test('filtro "sem dono" pega quem não tem colaborador ligado', () => {
  assert.deepEqual(filtrarBens(BENS, { semDono: true }).map(b => b.id), ['b', 'c'])
})

test('filtro por pessoa pega só o dela', () => {
  assert.deepEqual(filtrarBens(BENS, { pessoaId: 'p1' }).map(b => b.id), ['a'])
})

test('nada casa devolve lista vazia, não erro', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'jacaré' }), [])
})

test('resumo conta os itens e soma só quem tem valor', () => {
  assert.deepEqual(resumoDaLista(BENS), { quantidade: 3, totalCentavos: 920000 })
  assert.deepEqual(resumoDaLista([]), { quantidade: 0, totalCentavos: 0 })
  assert.deepEqual(resumoDaLista(null), { quantidade: 0, totalCentavos: 0 })
})

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('Televisão LG'), 'televisao lg')
  assert.equal(normalizar(null), '')
})
