import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sugestoesParaOConjunto, linhaDeOrigem, MAXIMO_DE_CHIPS } from './sugestoes-de-interesse.js'

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
