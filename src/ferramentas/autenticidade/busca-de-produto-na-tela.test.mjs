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

  // O AVISO TEM DE USAR O MESMO PODER QUE ABRE O FORMULÁRIO. Quem entra aqui
  // entrou por `podeCriar`; passando `podeEditar`, quem tem `criar` sem
  // `editar` caía no ramo não-admin do `textoDoAviso` e lia "Não foi possível
  // buscar as VENDAS agora." — numa tela de etiqueta, que não tem venda
  // nenhuma. Ver `src/compartilhado/chamada-do-bling.js`.
  assert.match(TELA, /avisoDoErro\(e, \{ ehAdmin: podeCriar\.value \}\)/,
    'o aviso segue quem PODE CRIAR, que é quem abre o formulário')
})

test('o aviso de falha mostra as DUAS frases, nunca o objeto inteiro', () => {
  assert.match(TELA, /\{\{ erroProdutos\.titulo \}\}/)
  assert.match(TELA, /\{\{ erroProdutos\.detalhe \}\}/)
  assert.doesNotMatch(TELA, /\{\{ erroProdutos \}\}/,
    'o objeto inteiro num `{{ }}` é a pessoa lendo `[object Object]`')
})

test('⚠️ Enter na busca de produto NAO cria o lote', () => {
  /* O PERIGO: o botão de criar é `type="submit"`, então Enter em qualquer campo
   * DENTRO do `<form @submit.prevent="gerarLote">` gravava as peças no banco sem
   * ninguém pedir. A defesa era um `@keydown.enter.prevent` no campo.
   *
   * EM 04/09/2026 A DEFESA FICOU MELHOR: a busca de produto saiu do formulário e
   * foi para um modal próprio (a lista precisava de tela). Fora do form, Enter
   * não tem o que submeter — o perigo deixou de existir por CONSTRUÇÃO, e não
   * por remendo.
   *
   * Por isso a asserção mudou de alvo em vez de ser apagada: ela agora exige a
   * garantia mais forte, que é o campo NÃO ESTAR no formulário. Se alguém um dia
   * trouxer a busca de volta para dentro dele, este teste reprova — e aí a
   * defesa a repor é o `@keydown.enter.prevent`. */
  const form = TELA.slice(TELA.indexOf('@submit.prevent="gerarLote"'))
  const ateOFimDoForm = form.slice(0, form.indexOf('</form>'))
  assert.ok(ateOFimDoForm.length > 0, 'não achei o formulário de gerar lote')
  assert.doesNotMatch(ateOFimDoForm, /v-model="buscaProduto"/,
    'a busca de produto voltou para dentro do form: Enter volta a criar o lote. '
    + 'Ou tire-a de lá, ou reponha o `@keydown.enter.prevent`')
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
