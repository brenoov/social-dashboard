import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────
// O CAMINHO DE FALHA DA BUSCA, e o Enter que criava lote.
//
// A tradução do erro em duas frases se prova por comportamento em
// `src/compartilhado/chamada-do-bling.test.mjs` (`avisoDoErro`). O que se prova
// AQUI é a ligação: que a tela usa aquele caminho em vez de refazê-lo à mão —
// foi refazendo-o à mão que ela mandou `[object Object]` para a pessoa e culpou
// o Bling por um 403 de crachá.
//
// É pelo código-fonte porque `node --test` não compila `.vue` — mesma técnica de
// `gravar-marca-a-peca-certa.test.mjs`.
// ─────────────────────────────────────────────────────────────────────────
const TELA = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8')

test('carregarProdutos traduz a falha pelo caminho de sempre, nao a mao', () => {
  assert.match(TELA, /erroProdutos\.value = avisoDoErro\(e, \{ ehAdmin/,
    'o catch tem de passar o ERRO para o avisoDoErro')
  assert.doesNotMatch(TELA, /textoDoAviso\(e\.message/,
    '`e.message` é o texto TÉCNICO: nenhuma causa casa com ele, e todo erro virava "O Bling não respondeu"')
})

test('o aviso de falha mostra as DUAS frases, nunca o objeto inteiro', () => {
  assert.match(TELA, /\{\{ erroProdutos\.titulo \}\}/)
  assert.match(TELA, /\{\{ erroProdutos\.detalhe \}\}/)
  assert.doesNotMatch(TELA, /\{\{ erroProdutos \}\}/,
    'o objeto inteiro num `{{ }}` é a pessoa lendo `[object Object]`')
})

test('Enter na busca de produto NAO cria o lote', () => {
  // O campo mora dentro do `<form @submit.prevent="gerarLote">`, e o botão é
  // `type="submit"`: sem isto, Enter gravava as peças no banco sem ninguém pedir.
  const campo = TELA.slice(TELA.indexOf('v-model="buscaProduto"'))
  assert.match(campo.slice(0, campo.indexOf('</label>')), /@keydown\.enter\.prevent/)
})

test('a lista e os avisos da busca acompanham o recuo dos campos', () => {
  // A `.au-folha` tem `padding:22px 0` — cada filho paga o seu recuo lateral.
  // Sem isto a lista e os avisos encostavam na borda com o resto do formulário
  // recuado em 24px (16px no celular).
  assert.match(TELA, /\.au-escolha-produto > \.au-aviso-menor\{padding-left:24px/)
  assert.match(TELA, /\.au-produtos\{[^}]*padding:0 16px/)
  // O `@media` que vale é o do FIM do arquivo: as regras-base deste bloco vêm
  // depois do `@media` de cima e, com a mesma especificidade, o ganhador é o
  // último. Este teste lê a partir da regra-base, então só passa com o `@media`
  // colocado DEPOIS dela.
  const celular = TELA.slice(TELA.indexOf('.au-produtos{list-style'))
  assert.match(celular, /\.au-escolha-produto > \.au-aviso-menor\{padding-left:16px/)
  assert.match(celular, /\.au-produtos\{padding-left:8px/)
})

test('o import morto do chamarBling saiu', () => {
  assert.doesNotMatch(TELA, /\bchamarBling\b/,
    'importado e nunca usado — import morto engana quem for ler depois')
})
