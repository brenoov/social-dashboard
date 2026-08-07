import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  contarAbertura, contarFechamento, larguraDaBarra, travar, destravar,
  abrirModal, fecharModal, modaisAbertos, _reiniciarParaTeste, vTravaRolagem,
} from './travar-rolagem-de-fundo.js'

/* Um "documento"/"janela" falso — mesmo padrão de versao-do-app.test.mjs:
 * testa a decisão inteira sem abrir navegador nenhum. */
function documentoFalso({ clientWidth = 1200 } = {}) {
  return { documentElement: { style: {}, clientWidth }, body: { style: {} } }
}
function janelaFalsa({ innerWidth = 1200, scrollY = 0 } = {}) {
  const chamadasDeScrollTo = []
  return { innerWidth, scrollY, scrollTo: (x, y) => chamadasDeScrollTo.push([x, y]), _chamadasDeScrollTo: chamadasDeScrollTo }
}

/* ── O contador (item 1: um modal abre outro, o primeiro a fechar não pode destravar tudo) ── */

test('contarAbertura soma 1', () => {
  assert.equal(contarAbertura(0), 1)
  assert.equal(contarAbertura(1), 2)
  assert.equal(contarAbertura(undefined), 1)
})

test('contarFechamento nunca vai a negativo', () => {
  // Um "fechar" a mais do que os "abrir" não pode deixar o contador negativo:
  // isso faria o PRÓXIMO abrir de verdade precisar de dois fechamentos.
  assert.equal(contarFechamento(1), 0)
  assert.equal(contarFechamento(0), 0)
  assert.equal(contarFechamento(undefined), 0)
})

/* ── A largura da barra (item 2: compensar pra não pular a página) ── */

test('larguraDaBarra: sem diferença entre innerWidth e clientWidth, dá 0', () => {
  // Celular / barra sobreposta: não há largura pra compensar.
  assert.equal(larguraDaBarra(janelaFalsa({ innerWidth: 400 }), documentoFalso({ clientWidth: 400 })), 0)
})

test('larguraDaBarra: desktop com barra de 17px', () => {
  assert.equal(larguraDaBarra(janelaFalsa({ innerWidth: 1200 }), documentoFalso({ clientWidth: 1183 })), 17)
})

test('larguraDaBarra: nunca devolve negativo', () => {
  assert.equal(larguraDaBarra(janelaFalsa({ innerWidth: 1183 }), documentoFalso({ clientWidth: 1200 })), 0)
})

test('larguraDaBarra: sem janela/documento não explode', () => {
  assert.equal(larguraDaBarra(null, documentoFalso()), 0)
  assert.equal(larguraDaBarra(janelaFalsa(), null), 0)
  assert.equal(larguraDaBarra(null, null), 0)
})

/* ── travar/destravar (item 3: position:fixed no body, não só overflow:hidden) ── */

test('travar: esconde a rolagem e compensa a barra medida', () => {
  const doc = documentoFalso({ clientWidth: 1183 })
  const win = janelaFalsa({ innerWidth: 1200, scrollY: 340 })
  travar(doc, win)
  assert.equal(doc.documentElement.style.overflow, 'hidden')
  assert.equal(doc.documentElement.style.paddingRight, '17px')
  // O body é fixado NA POSIÇÃO ATUAL — é o que segura o rubber-band do iOS.
  assert.equal(doc.body.style.position, 'fixed')
  assert.equal(doc.body.style.top, '-340px')
  assert.equal(doc.body.style.width, '100%')
})

test('travar: sem barra pra compensar (celular), não escreve padding nenhum', () => {
  const doc = documentoFalso({ clientWidth: 400 })
  const win = janelaFalsa({ innerWidth: 400 })
  travar(doc, win)
  assert.equal(doc.documentElement.style.paddingRight, undefined)
})

test('destravar: limpa tudo e devolve a página pra onde ela estava', () => {
  const doc = documentoFalso({ clientWidth: 1183 })
  const win = janelaFalsa({ innerWidth: 1200, scrollY: 700 })
  travar(doc, win)
  destravar(doc, win)
  assert.equal(doc.documentElement.style.overflow, '')
  assert.equal(doc.documentElement.style.paddingRight, '')
  assert.equal(doc.body.style.position, '')
  assert.equal(doc.body.style.top, '')
  // Sem isso a página "saltaria" pro topo: o body ficou fixo lá embaixo.
  assert.deepEqual(win._chamadasDeScrollTo, [[0, 700]])
})

/* ── abrirModal/fecharModal (a integração: só trava no 1º, só destrava no último) ── */

test('um modal só: abre trava, fecha destrava', () => {
  _reiniciarParaTeste()
  const doc = documentoFalso()
  const win = janelaFalsa()
  abrirModal(doc, win)
  assert.equal(modaisAbertos(), 1)
  assert.equal(doc.documentElement.style.overflow, 'hidden')
  fecharModal(doc, win)
  assert.equal(modaisAbertos(), 0)
  assert.equal(doc.documentElement.style.overflow, '')
})

test('modal abre outro por cima: o primeiro fechar NÃO destrava o fundo', () => {
  // O caso real: confirmar exclusão em cima da ficha aberta.
  _reiniciarParaTeste()
  const doc = documentoFalso()
  const win = janelaFalsa()
  abrirModal(doc, win)          // ficha abre
  abrirModal(doc, win)          // confirmação abre por cima
  assert.equal(modaisAbertos(), 2)
  fecharModal(doc, win)         // confirmação fecha
  assert.equal(modaisAbertos(), 1)
  assert.equal(doc.documentElement.style.overflow, 'hidden', 'a ficha ainda está aberta — o fundo não pode rolar')
  fecharModal(doc, win)         // ficha fecha
  assert.equal(modaisAbertos(), 0)
  assert.equal(doc.documentElement.style.overflow, '')
})

test('fechar sem abrir (imbalanço) não deixa o contador negativo nem destrava à toa', () => {
  _reiniciarParaTeste()
  const doc = documentoFalso()
  const win = janelaFalsa()
  fecharModal(doc, win)
  assert.equal(modaisAbertos(), 0)
})

/* ── vTravaRolagem (item 4 pro caminho v-if: some com o componente = destrava) ── */

test('vTravaRolagem: mounted trava, unmounted destrava', () => {
  _reiniciarParaTeste()
  const el = {}
  vTravaRolagem.mounted(el)
  assert.equal(modaisAbertos(), 1)
  vTravaRolagem.unmounted(el)
  assert.equal(modaisAbertos(), 0)
})

test('vTravaRolagem: unmounted duas vezes seguidas (Vue não deveria, mas) não destrava em dobro', () => {
  _reiniciarParaTeste()
  const el = {}
  vTravaRolagem.mounted(el)
  vTravaRolagem.unmounted(el)
  vTravaRolagem.unmounted(el)
  assert.equal(modaisAbertos(), 0)
})
