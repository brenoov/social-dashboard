import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PASSOS, TEXTOS, PASSOS_VEICULO, PASSOS_ITEM, PASSOS_FICHA_DETALHE,
  PASSOS_PEDIDO, PASSOS_DECISAO, PASSOS_FICHA, deveAbrirSozinho, marcarComoVisto,
} from './tutorial.js'

// Um armazém de mentira, pra testar sem navegador.
const armazem = (inicial = {}) => {
  const d = { ...inicial }
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v }, _d: d }
}

test('o passeio abre sozinho só na primeira vez daquela pessoa', () => {
  const a = armazem()
  assert.equal(deveAbrirSozinho(a, 'u1'), true)
  marcarComoVisto(a, 'u1')
  assert.equal(deveAbrirSozinho(a, 'u1'), false)
})

test('ter visto o tutorial do Patrimônio não marca o da Frota como visto', () => {
  // A chave leva o prefixo 'fr-tutorial-visto', diferente do 'pat-tutorial-
  // visto' — é por isso que este teste roda em módulos separados: prova que
  // a mesma pessoa precisa ver os dois, um por ferramenta.
  const a = armazem()
  a.setItem('pat-tutorial-visto:u1', '1')
  assert.equal(deveAbrirSozinho(a, 'u1'), true)
})

test('modo privado (armazém que recusa) não quebra nem abre em loop', () => {
  const recusa = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
  assert.equal(deveAbrirSozinho(recusa, 'u1'), false, 'sem poder guardar, é melhor não abrir do que abrir sempre')
  assert.doesNotThrow(() => marcarComoVisto(recusa, 'u1'))
  assert.equal(deveAbrirSozinho(null, 'u1'), false)
})

/* ── Todo passo aponta pra algo que EXISTE na tela ───────────────────────────
   Igual ao teste do Patrimônio: um passeio que realça algo que já foi
   renomeado é pior que nenhum. Cada `selector` é ou uma classe CSS
   (".fr-novo") ou um atributo `data-tour="chave"` — os dois têm que existir
   literalmente no arquivo da tela (ou no dele, pra quem aponta pra dentro de
   um modal). */
const TELA = readFileSync(new URL('./tela-de-frota.vue', import.meta.url), 'utf8')

function existeNaTela(selector) {
  const dataTour = selector.match(/^\[data-tour="([a-z0-9-]+)"\]$/)
  if (dataTour) {
    const chave = dataTour[1]
    // Estático (`data-tour="x"`) ou ligado (`:data-tour="cond ? 'x' : null"`,
    // caso do item-desativar, que só existe pro item que está sendo editado).
    return TELA.includes(`data-tour="${chave}"`) || TELA.includes(`'${chave}'`)
  }
  const classes = [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1])
  const naTela = new Set(
    [...TELA.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))
  return classes.every((c) => naTela.has(c))
}

function confereTodos(passos, nome) {
  for (const p of passos) {
    assert.ok(existeNaTela(p.selector),
      `${nome}: o passo "${p.titulo}" aponta pra ${p.selector}, que não existe em tela-de-frota.vue`)
    assert.ok(p.titulo && p.titulo.length > 2, `${nome}: passo sem título (${p.selector})`)
    assert.ok(p.texto && p.texto.length > 30, `${nome}: texto curto demais em "${p.titulo}"`)
  }
}

test('o passeio da tela inteira aponta pra seletores que existem', () => {
  assert.ok(PASSOS.length >= 5, 'o pedido do dono cobre 5 assuntos')
  confereTodos(PASSOS, 'PASSOS')
})

test('os 6 passeios de modal apontam pra seletores que existem', () => {
  confereTodos(PASSOS_VEICULO, 'PASSOS_VEICULO')
  confereTodos(PASSOS_ITEM, 'PASSOS_ITEM')
  confereTodos(PASSOS_FICHA_DETALHE, 'PASSOS_FICHA_DETALHE')
  confereTodos(PASSOS_PEDIDO, 'PASSOS_PEDIDO')
  confereTodos(PASSOS_DECISAO, 'PASSOS_DECISAO')
  confereTodos(PASSOS_FICHA, 'PASSOS_FICHA')
})

/* ── Os textos fixos aparecem VERBATIM na tela ───────────────────────────── */

test('cada texto fixo de TEXTOS é usado (verbatim) em algum modal da tela', () => {
  for (const [chave, texto] of Object.entries(TEXTOS)) {
    assert.ok(TELA.includes(`TEXTOS.${chave}`) || TELA.includes(texto),
      `TEXTOS.${chave} não aparece em tela-de-frota.vue — o modal ficou sem o texto fixo?`)
  }
})

test('os textos fixos não usam jargão de programador', () => {
  const proibidas = ['null', 'string', 'array', 'campo booleano', 'foreign', 'query', 'registro', 'entidade', 'vínculo']
  for (const [chave, texto] of Object.entries(TEXTOS)) {
    const t = texto.toLowerCase()
    for (const p of proibidas) {
      assert.ok(!t.includes(p), `TEXTOS.${chave} usa jargão: "${p}"`)
    }
  }
})
