import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoDoAcesso } from './resumo-do-acesso.js'

// Permissões reais, medidas no banco em 11/08/2026.
const RAISSA = {
  frota: ['ver', 'editar'], gestor: ['ver'], social: ['ver', 'exportar'],
  noticias: ['ver'], 'meta.gestor': ['ver', 'editar'], 'sales.metas': ['ver', 'editar'],
  'meta.fabrica': ['ver', 'editar'], 'sales.gestao': ['ver', 'exportar'],
  'sales.analise': ['ver', 'exportar'], 'social.relatorio': ['ver', 'exportar'],
  'gestor.relatorios': ['ver', 'exportar'],
}
const LARISSA = {
  frota: ['ver', 'editar'], social: ['ver', 'exportar'],
  noticias: ['ver'], 'social.relatorio': ['ver', 'exportar'],
}

test('conta quantas ferramentas a pessoa tem', () => {
  assert.equal(resumoDoAcesso(RAISSA).quantos, 11)
  assert.equal(resumoDoAcesso(LARISSA).quantos, 4)
})

test('avisa quantas mexem em dinheiro', () => {
  assert.equal(resumoDoAcesso(RAISSA).comDinheiro, 2)   // meta.gestor + meta.fabrica
  assert.equal(resumoDoAcesso(LARISSA).comDinheiro, 0)
})

test('a frase cita o que a pessoa MEXE, nao o que ela so le', () => {
  // O que diferencia uma pessoa da outra e o poder, nao os paineis de leitura
  // que quase todo mundo tem.
  const f = resumoDoAcesso(RAISSA).frase
  assert.match(f, /anúncios/i)
  assert.match(f, /frota/i)
})

test('quem so le e descrito como quem so le', () => {
  const f = resumoDoAcesso({ social: ['ver'], noticias: ['ver'] }).frase
  assert.match(f, /só (vê|enxerga|lê)|leitura/i)
})

test('sem acesso nenhum diz isso, e nao fica em branco', () => {
  const r = resumoDoAcesso({})
  assert.equal(r.quantos, 0)
  assert.ok(r.frase.length > 0)
})

test('nao estoura com nulo', () => {
  assert.equal(resumoDoAcesso(null).quantos, 0)
})
