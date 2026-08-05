import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PASSOS, AJUDAS, deveAbrirSozinho, marcarComoVisto } from './tutorial.js'

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

test('quem chega depois no MESMO aparelho vê o tutorial', () => {
  // Era o furo: a memória era por navegador. Numa máquina onde o dono já tinha
  // fechado o passeio, quem entrasse depois nunca veria — e é justamente essa
  // pessoa que precisa dele.
  const a = armazem()
  marcarComoVisto(a, 'dono')
  assert.equal(deveAbrirSozinho(a, 'dono'), false)
  assert.equal(deveAbrirSozinho(a, 'larissa'), true, 'outra pessoa tem que ver o tutorial')
})

test('modo privado (armazém que recusa) não quebra nem abre em loop', () => {
  const recusa = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
  assert.equal(deveAbrirSozinho(recusa, 'u1'), false, 'sem poder guardar, é melhor não abrir do que abrir sempre')
  assert.doesNotThrow(() => marcarComoVisto(recusa, 'u1'))
  assert.equal(deveAbrirSozinho(null, 'u1'), false)
})

/* ── O tutorial aponta pra coisas que EXISTEM ────────────────────────────────
   Um passeio que realça um botão que já foi renomeado é pior que nenhum: ele
   ensina errado com cara de certo. Este teste lê a tela de verdade e confere
   que cada seletor citado está lá. */

const TELA = readFileSync(new URL('./tela-de-patrimonio.vue', import.meta.url), 'utf8')

test('todo passo aponta pra um seletor que existe na tela', () => {
  for (const p of PASSOS) {
    // O seletor pode ser composto (".tela-patrimonio .abas") e a classe pode
    // estar em qualquer posição do atributo. A versão anterior só achava se ela
    // fosse a primeira ou viesse seguida de espaço, e dava falso alarme nos dois
    // casos. Aqui: toda classe citada no seletor tem que existir em ALGUM
    // elemento da tela.
    const classes = [...p.selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1])
    const naTela = new Set(
      [...TELA.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))
    const faltando = classes.filter((c) => !naTela.has(c))
    assert.deepEqual(faltando, [],
      `o passo "${p.titulo}" aponta para ${p.selector}, e ${faltando.join(', ')} não existe mais na tela`)
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

/* ── Todo "?" tem que mostrar alguma coisa, e PERTO ──────────────────────────
   Aconteceu de verdade: os textos de "Situação" e "Com quem" foram parar no
   painel de alteração em massa, a 170 linhas dos botões que os abriam. Tocar no
   "?" escrevia a explicação num painel fechado — da tela, nada acontecia.
   O teste confere que cada botão tem o seu texto logo abaixo dele. */

test('cada "?" tem a explicação dele por perto, no mesmo painel', () => {
  const linhas = TELA.split('\n')
  const botoes = []
  const mostras = []
  linhas.forEach((l, i) => {
    const b = l.match(/alternarAjuda\('([a-z]+)'\)/)
    if (b) botoes.push({ chave: b[1], linha: i })
    for (const m of l.matchAll(/ajudaAberta === '([a-z]+)'/g)) mostras.push({ chave: m[1], linha: i })
  })
  assert.ok(botoes.length >= 4, `esperava pelo menos 4 botões de ajuda, achei ${botoes.length}`)

  for (const b of botoes) {
    const perto = mostras.filter((m) => m.chave === b.chave && m.linha > b.linha && m.linha - b.linha <= 20)
    assert.ok(perto.length > 0,
      `o "?" de "${b.chave}" (linha ${b.linha + 1}) não tem a explicação dele nas 20 linhas seguintes — `
      + `provavelmente ela ficou em outro painel, e tocar no botão não mostra nada`)
  }
})

test('toda explicação exibida existe no catálogo AJUDAS', () => {
  for (const m of TELA.matchAll(/ajudaAberta === '([a-z]+)'/g)) {
    assert.ok(AJUDAS[m[1]], `a tela tenta mostrar a ajuda "${m[1]}", que não existe em AJUDAS`)
  }
  for (const m of TELA.matchAll(/alternarAjuda\('([a-z]+)'\)/g)) {
    assert.ok(AJUDAS[m[1]], `o botão abre a ajuda "${m[1]}", que não existe em AJUDAS`)
  }
})
