import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PASSOS, AJUDAS, deveAbrirSozinho, marcarComoVisto } from './tutorial.js'

// Um armazém de mentira, pra testar sem navegador.
const armazem = (inicial = {}) => {
  const d = { ...inicial }
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v }, _d: d }
}

test('o passeio abre sozinho só na primeira vez', () => {
  const a = armazem()
  assert.equal(deveAbrirSozinho(a), true)
  marcarComoVisto(a)
  assert.equal(deveAbrirSozinho(a), false)
})

test('modo privado (armazém que recusa) não quebra nem abre em loop', () => {
  const recusa = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
  assert.equal(deveAbrirSozinho(recusa), false, 'sem poder guardar, é melhor não abrir do que abrir sempre')
  assert.doesNotThrow(() => marcarComoVisto(recusa))
  assert.equal(deveAbrirSozinho(null), false)
})

/* ── O tutorial aponta pra coisas que EXISTEM ────────────────────────────────
   Um passeio que realça um botão que já foi renomeado é pior que nenhum: ele
   ensina errado com cara de certo. Este teste lê a tela de verdade e confere
   que cada seletor citado está lá. */

const TELA = readFileSync(new URL('./tela-de-patrimonio.vue', import.meta.url), 'utf8')

test('todo passo aponta pra um seletor que existe na tela', () => {
  for (const p of PASSOS) {
    const classe = p.selector.replace(/^\./, '')
    assert.ok(TELA.includes(`class="${classe}`) || TELA.includes(`${classe} `) || TELA.includes(`"${classe}"`),
      `o passo "${p.titulo}" aponta para ${p.selector}, que não existe mais na tela`)
  }
})

test('todo passo tem título e texto de verdade', () => {
  assert.ok(PASSOS.length >= 5, 'o desenho pede pelo menos 5 passos')
  for (const p of PASSOS) {
    assert.ok(p.titulo && p.titulo.length > 3, `passo sem título: ${p.selector}`)
    assert.ok(p.texto && p.texto.length > 40, `texto curto demais em "${p.titulo}"`)
  }
})

test('as explicações do "?" não usam jargão de programador', () => {
  const proibidas = ['null', 'string', 'array', 'id ', 'campo booleano', 'foreign', 'query']
  for (const [chave, texto] of Object.entries(AJUDAS)) {
    const t = texto.toLowerCase()
    for (const p of proibidas) {
      assert.ok(!t.includes(p), `a ajuda "${chave}" usa jargão: "${p}"`)
    }
    assert.ok(texto.length > 60, `a ajuda "${chave}" está curta demais para ensinar`)
  }
})

test('a ajuda da alteração em massa avisa da regra que protege o dado', () => {
  // Se este texto sumir, a pessoa pode achar que campo em branco apaga.
  assert.ok(/branco.*(não|NÃO) é alterado/i.test(AJUDAS.massa))
})
