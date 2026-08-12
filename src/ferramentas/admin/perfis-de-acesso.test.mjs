import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acessoEfetivo, excecaoDe } from './perfis-de-acesso.js'

const PERFIL = { social: ['ver', 'exportar'], 'meta.gestor': ['ver', 'editar'] }

test('sem excecao, o acesso e o do perfil', () => {
  assert.deepEqual(acessoEfetivo(PERFIL, {}), PERFIL)
})

test('a excecao SOBREVIVE — e o D9', () => {
  // A Raissa esta no perfil "Anuncios" e ganhou a Frota so pra ela. Mexer no
  // perfil nao pode apagar a Frota dela.
  const efetivo = acessoEfetivo(PERFIL, { frota: ['ver', 'editar'] })
  assert.deepEqual(efetivo.frota, ['ver', 'editar'])
  assert.deepEqual(efetivo.social, ['ver', 'exportar'])
})

test('excecao na MESMA chave do perfil ganha do perfil', () => {
  // Alguem deu explicitamente um nivel diferente naquela ferramenta: e uma
  // decisao sobre aquela pessoa, e o perfil nao pode desfaze-la calado.
  const efetivo = acessoEfetivo(PERFIL, { 'meta.gestor': ['ver'] })
  assert.deepEqual(efetivo['meta.gestor'], ['ver'])
})

test('chave que saiu do perfil some de quem nao a tinha por excecao', () => {
  // O perfil encolheu: quem estava nele perde o que o perfil deixou de dar.
  // E o proposito do perfil vivo (D8) — e por isso D11 mostra quem perde.
  const menor = { social: ['ver', 'exportar'] }
  assert.equal(acessoEfetivo(menor, {})['meta.gestor'], undefined)
})

test('excecao vazia nao inventa chave', () => {
  const efetivo = acessoEfetivo(PERFIL, { frota: [] })
  assert.equal(efetivo.frota, undefined, 'lista vazia e "sem acesso", nao uma chave concedida')
})

test('nao estoura com nulo', () => {
  assert.deepEqual(acessoEfetivo(null, null), {})
  assert.deepEqual(acessoEfetivo(PERFIL, null), PERFIL)
})

// --- descobrir a excecao a partir do que a pessoa ja tem ---

test('o que a pessoa tem alem do perfil vira excecao', () => {
  const atual = { ...PERFIL, frota: ['ver', 'editar'] }
  assert.deepEqual(excecaoDe(PERFIL, atual), { frota: ['ver', 'editar'] })
})

test('nivel diferente na mesma chave tambem e excecao', () => {
  const atual = { ...PERFIL, 'meta.gestor': ['ver'] }
  assert.deepEqual(excecaoDe(PERFIL, atual), { 'meta.gestor': ['ver'] })
})

test('quem e identico ao perfil nao tem excecao nenhuma', () => {
  assert.deepEqual(excecaoDe(PERFIL, { ...PERFIL }), {})
})

test('ordem das acoes nao inventa excecao', () => {
  // ['editar','ver'] e ['ver','editar'] sao o MESMO acesso. Comparar sem
  // ordenar criaria excecao fantasma pra metade das pessoas.
  const atual = { social: ['exportar', 'ver'], 'meta.gestor': ['editar', 'ver'] }
  assert.deepEqual(excecaoDe(PERFIL, atual), {})
})

test('ida e volta: aplicar a excecao de volta devolve o acesso original', () => {
  const atual = { ...PERFIL, frota: ['ver', 'editar'], 'meta.gestor': ['ver'] }
  const exc = excecaoDe(PERFIL, atual)
  assert.deepEqual(acessoEfetivo(PERFIL, exc), atual)
})
