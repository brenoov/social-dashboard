import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sugestoesParaOConjunto, linhaDeOrigem, montarFaixaDeSugestoes, MAXIMO_DE_CHIPS } from './sugestoes-de-interesse.js'

const SUGERIDOS = [
  {
    objetivo: 'vendas',
    itens: [
      { id: '6003', nome: 'Bolsas (acessórios)', audience_size: 486_100_000 },
      { id: '6005', nome: 'Cinto', audience_size: 37_100_000 },
      { id: '6007', nome: 'Carteira (acessórios)', audience_size: 64_000_000 },
    ],
  },
  {
    objetivo: 'mensagens',
    itens: [{ id: '6009', nome: 'Óculos de sol (óculos)', audience_size: 435_700_000 }],
  },
]

test('mostra as sugestoes do objetivo da campanha, nao as de outro', () => {
  const r = sugestoesParaOConjunto(SUGERIDOS, 'mensagens', [])
  assert.deepEqual(r.map((i) => i.nome), ['Óculos de sol (óculos)'])
})

test('o que JA esta no publico nao vira quadradinho', () => {
  // Quadradinho que não faz nada ao ser clicado corrói a confiança na tela toda.
  const r = sugestoesParaOConjunto(SUGERIDOS, 'vendas', [{ id: '6005', name: 'Cinto' }])
  assert.deepEqual(r.map((i) => i.nome), ['Bolsas (acessórios)', 'Carteira (acessórios)'])
})

test('compara por ID, nao por nome — grafia diferente nao duplica', () => {
  const r = sugestoesParaOConjunto(SUGERIDOS, 'vendas', [{ id: '6003', name: 'BOLSAS' }])
  assert.ok(!r.some((i) => i.id === '6003'))
})

test('objetivo "padrao" (a Meta mandou objetivo desconhecido) NAO mostra nada', () => {
  // Sem objetivo não há linha certa, e mostrar a de outro é pior que não mostrar.
  assert.deepEqual(sugestoesParaOConjunto(SUGERIDOS, 'padrao', []), [])
  assert.deepEqual(sugestoesParaOConjunto(SUGERIDOS, '', []), [])
  assert.deepEqual(sugestoesParaOConjunto(SUGERIDOS, null, []), [])
})

test('marca sem rodada para aquele objetivo devolve vazio, sem erro', () => {
  assert.deepEqual(sugestoesParaOConjunto(SUGERIDOS, 'leads', []), [])
  assert.deepEqual(sugestoesParaOConjunto([], 'vendas', []), [])
  assert.deepEqual(sugestoesParaOConjunto(null, 'vendas', []), [])
})

test('quando tudo ja esta escolhido, a faixa some — nao aparece vazia', () => {
  const todos = [{ id: '6003' }, { id: '6005' }, { id: '6007' }]
  assert.deepEqual(sugestoesParaOConjunto(SUGERIDOS, 'vendas', todos), [])
})

test('linha estragada e pulada, e a boa do lado SOBREVIVE', () => {
  const ruim = [{
    objetivo: 'vendas',
    itens: [null, 'lixo', { id: '', nome: 'Sem id' }, { id: '9', nome: '  ' }, { id: '6003', nome: 'Bolsas' }],
  }]
  assert.deepEqual(sugestoesParaOConjunto(ruim, 'vendas', []).map((i) => i.nome), ['Bolsas'])
})

test('a faixa e capada — ela divide espaco com a busca da Meta logo abaixo', () => {
  const muitos = [{
    objetivo: 'vendas',
    itens: Array.from({ length: 20 }, (_, i) => ({ id: String(i), nome: 'I' + i })),
  }]
  assert.equal(sugestoesParaOConjunto(muitos, 'vendas', []).length, MAXIMO_DE_CHIPS)
  assert.equal(sugestoesParaOConjunto(muitos, 'vendas', [], 3).length, 3)
})

test('tamanho ausente vira null, nunca 0 — desconhecido nao e zero', () => {
  const sem = [{ objetivo: 'vendas', itens: [{ id: '1', nome: 'X' }] }]
  assert.equal(sugestoesParaOConjunto(sem, 'vendas', [])[0].audience_size, null)
})

// ── A frase de procedência ──────────────────────────────────────────────────

test('a frase diz o objetivo e a data da rodada', () => {
  assert.equal(linhaDeOrigem('vendas', new Date(2026, 7, 1)),
    'Sugestões da IA para campanhas de vendas (01/08). Clique para acrescentar.')
})

test('sem data a frase continua inteira, sem parenteses solto', () => {
  const l = linhaDeOrigem('mensagens', null)
  assert.equal(l, 'Sugestões da IA para campanhas de mensagens. Clique para acrescentar.')
  assert.ok(!l.includes('()'))
  assert.ok(!linhaDeOrigem('vendas', 'data podre').includes('NaN'))
})

test('sem objetivo nao ha frase', () => {
  assert.equal(linhaDeOrigem('', new Date()), '')
  assert.equal(linhaDeOrigem(), '')
})

// ===== A MONTAGEM DA FAIXA =====
//
// Um `document` de mentira, do tamanho exato do que a faixa usa. Existe porque a
// faixa vive numa tela de 4 mil linhas que exige login e dados ao vivo da Meta —
// e o que não se consegue abrir sozinho, ninguém confere.

function docFalso() {
  const criar = (tag) => ({
    tag,
    filhos: [],
    style: { cssText: '' },
    textContent: '',
    title: '',
    type: '',
    onclick: null,
    appendChild(f) { this.filhos.push(f); return f },
    // O texto inteiro da subárvore — é assim que se pergunta "apareceu?" sem
    // depender de qual span carrega qual pedaço.
    get texto() { return (this.textContent || '') + this.filhos.map((f) => f.texto).join('') },
    get botoes() { return this.filhos.flatMap((f) => (f.tag === 'button' ? [f] : f.botoes)) },
  })
  return { createElement: criar }
}

const BASE = () => ({
  doc: docFalso(),
  sugeridos: SUGERIDOS,
  objetivo: 'vendas',
  jaEscolhidos: [],
  ajuda: (t) => { const d = docFalso().createElement('div'); d.textContent = t; return d },
  linha: () => docFalso().createElement('div'),
  tamanho: (n) => (n >= 999_500 ? Math.round(n / 1e6) + ' mi' : String(n)),
})

test('monta um botao por sugestao, com o nome dentro', () => {
  const el = montarFaixaDeSugestoes(BASE())
  assert.ok(el, 'a faixa tem de existir quando há sugestão')
  assert.equal(el.botoes.length, 3)
  assert.ok(el.texto.includes('Bolsas (acessórios)'))
  assert.ok(el.texto.includes('Cinto'))
})

test('cada botao mostra o "+" — o gesto e ACRESCENTAR, nao tirar', () => {
  // Reusar o chip do editor (que tem "×") faria a faixa parecer a lista do que
  // já está escolhido, o oposto do que ela é.
  const el = montarFaixaDeSugestoes(BASE())
  for (const b of el.botoes) assert.ok(b.texto.startsWith('+'), 'botão sem o +: ' + b.texto)
})

test('clicar avisa QUAL item foi escolhido, com id e nome', () => {
  const escolhidos = []
  const el = montarFaixaDeSugestoes({ ...BASE(), aoEscolher: (i) => escolhidos.push(i) })
  el.botoes[1].onclick({ stopPropagation() {} })
  assert.deepEqual(escolhidos, [{ id: '6005', nome: 'Cinto', audience_size: 37_100_000 }])
})

test('o clique nao vaza para a janela atras (stopPropagation)', () => {
  // Sem isto, o clique fecharia o painel por trás da faixa — o mesmo defeito
  // que o editor já teve com o fechar-clicando-fora.
  let parou = false
  const el = montarFaixaDeSugestoes({ ...BASE(), aoEscolher() {} })
  el.botoes[0].onclick({ stopPropagation() { parou = true } })
  assert.equal(parou, true)
})

test('clique sem aoEscolher, ou com evento torto, NAO estoura', () => {
  const el = montarFaixaDeSugestoes(BASE())
  el.botoes[0].onclick({})
  el.botoes[0].onclick(null)
})

test('a frase de procedencia entra na faixa', () => {
  const el = montarFaixaDeSugestoes({ ...BASE(), quando: new Date(2026, 7, 1) })
  assert.ok(el.texto.includes('Sugestões da IA para campanhas de vendas (01/08)'))
})

test('o titulo do botao traz o tamanho do publico, e sem tamanho nao mente', () => {
  const el = montarFaixaDeSugestoes(BASE())
  assert.match(el.botoes[0].title, /Cerca de 486 mi de pessoas/)
  const semTam = montarFaixaDeSugestoes({
    ...BASE(),
    sugeridos: [{ objetivo: 'vendas', itens: [{ id: '1', nome: 'X' }] }],
  })
  assert.equal(semTam.botoes[0].title, 'Sugestão da IA')
})

test('sem nada a mostrar devolve NULL — nao uma faixa vazia', () => {
  assert.equal(montarFaixaDeSugestoes({ ...BASE(), objetivo: 'padrao' }), null)
  assert.equal(montarFaixaDeSugestoes({ ...BASE(), sugeridos: null }), null)
  assert.equal(montarFaixaDeSugestoes({ ...BASE(), jaEscolhidos: [{ id: '6003' }, { id: '6005' }, { id: '6007' }] }), null)
})

test('sem document nao tenta desenhar — devolve null em vez de estourar', () => {
  assert.equal(montarFaixaDeSugestoes({ ...BASE(), doc: null }), null)
  assert.equal(montarFaixaDeSugestoes(), null)
})

test('sem os ajudantes da tela ainda monta — degrada, nao quebra', () => {
  const el = montarFaixaDeSugestoes({ doc: docFalso(), sugeridos: SUGERIDOS, objetivo: 'vendas', jaEscolhidos: [] })
  assert.ok(el)
  assert.equal(el.botoes.length, 3)
})
