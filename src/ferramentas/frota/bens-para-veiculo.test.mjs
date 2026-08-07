import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bensLivresParaFrota, patchDoBem } from './bens-para-veiculo.js'

const CAT_VEICULO = 'cat-veiculos'
const CAT_OUTRA = 'cat-moveis'

test('bensLivresParaFrota: só bens da categoria Veículos e sem carro ligado', () => {
  // Espelha o dado real que motivou a regra: 3 bens na categoria, um já
  // ligado a um carro da frota (Volvo), um fora da categoria (cadeira) — só o
  // primeiro (BMW) deveria sobrar.
  const bens = [
    { id: 'b1', categoria_id: CAT_VEICULO, nome: 'BMW X1' },
    { id: 'b2', categoria_id: CAT_VEICULO, nome: 'Volvo XC90' },
    { id: 'b3', categoria_id: CAT_OUTRA, nome: 'Cadeira' },
  ]
  const veiculos = [{ id: 'v1', bem_id: 'b2' }]
  const livres = bensLivresParaFrota(bens, veiculos, CAT_VEICULO)
  assert.deepEqual(livres.map((b) => b.id), ['b1'])
})

test('bensLivresParaFrota: sem a categoria Veículos identificada, não oferece nada', () => {
  // Se a busca da categoria falhar (Patrimônio fora do ar, nome mudou), o
  // seletor tem que sumir, não mostrar bens de qualquer categoria.
  const bens = [{ id: 'b1', categoria_id: CAT_VEICULO, nome: 'BMW X1' }]
  assert.deepEqual(bensLivresParaFrota(bens, [], null), [])
})

test('bensLivresParaFrota: listas vazias ou nulas não quebram', () => {
  assert.deepEqual(bensLivresParaFrota([], [], CAT_VEICULO), [])
  assert.deepEqual(bensLivresParaFrota(null, null, CAT_VEICULO), [])
})

test('patchDoBem: preenche nome, marca, fipe e código a partir do bem', () => {
  const vForm = { nome: '', marca: '', fipe: '', codigo_patrimonial: '' }
  const bem = { nome: 'BMW X1', marca: 'BMW', valor_centavos: 18500000, numero: 42 }
  assert.deepEqual(patchDoBem(vForm, bem), {
    nome: 'BMW X1', marca: 'BMW', fipe: '185000', codigo_patrimonial: '000042',
  })
})

test('patchDoBem: não sobrescreve o que a pessoa já digitou', () => {
  const vForm = { nome: 'Nome digitado à mão', marca: '', fipe: '', codigo_patrimonial: '' }
  const bem = { nome: 'BMW X1', marca: 'BMW', valor_centavos: null, numero: null }
  assert.deepEqual(patchDoBem(vForm, bem), { marca: 'BMW' })
})

test('patchDoBem: bem sem numero ou valor não gera campo vazio', () => {
  const vForm = { nome: '', marca: '', fipe: '', codigo_patrimonial: '' }
  const bem = { nome: 'BMW X1', marca: null, valor_centavos: null, numero: null }
  assert.deepEqual(patchDoBem(vForm, bem), { nome: 'BMW X1' })
})
