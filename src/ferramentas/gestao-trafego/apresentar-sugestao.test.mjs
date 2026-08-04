import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  manchete, comparacao, repetidos, paragrafosDaLeitura, vezesEmTexto, contarPartes,
} from './apresentar-sugestao.js'
import { recomendarIdade, montarSugestao } from './sugerir-publico.js'

// As faixas como a Meta devolveu na conta C1 em 04/08/2026 — o caso real que
// gerou a queixa ("2,5× mais caro" perdido no meio de um parágrafo).
const FAIXAS = [
  { faixa: '25-34', custo: 1164.60, gasto: 20962.72, confiavel: true },
  { faixa: '35-44', custo: 460.75, gasto: 8000, confiavel: true },
  { faixa: '45-54', custo: 520.00, gasto: 5000, confiavel: true },
  { faixa: '55-64', custo: 610.00, gasto: 3000, confiavel: true },
]

test('a manchete diz O QUE FAZER e QUANTO, sem parágrafo', () => {
  const s = { idade: recomendarIdade(FAIXAS) }
  const m = manchete(s)
  assert.match(m.titulo, /^Mire de \d+ a \d+ anos$/)
  assert.match(m.numero, /mais barato/)
  assert.ok(m.titulo.length < 40, 'manchete não é frase longa')
})

test('o numero da manchete e o mesmo que a frase longa diz', () => {
  // Se estes dois divergirem, a tela mostra dois números diferentes para o
  // mesmo fato — e nenhum deles é confiável depois disso.
  const i = recomendarIdade(FAIXAS)
  const m = manchete({ idade: i })
  const daFrase = i.porque.match(/([\d,]+)× mais caro/)[1]
  assert.equal(m.numero, daFrase + '× mais barato')
})

test('o desperdicio entra na manchete quando existe, com o valor', () => {
  const m = manchete({ idade: recomendarIdade(FAIXAS) })
  assert.match(m.custou, /R\$ 20\.962,72/)
})

test('sem desperdicio, nao inventa a linha', () => {
  const semGasto = FAIXAS.map((f) => ({ ...f, gasto: 0 }))
  assert.equal(manchete({ idade: recomendarIdade(semGasto) }).custou, '')
})

test('sem diferenca que justifique, NAO ha manchete', () => {
  // Morno não vira destaque: destacar o que não é achado ensina a ignorar
  // destaque.
  const parelhas = [
    { faixa: '25-34', custo: 100, gasto: 500, confiavel: true },
    { faixa: '35-44', custo: 110, gasto: 500, confiavel: true },
  ]
  assert.equal(recomendarIdade(parelhas), null)
  assert.equal(manchete({ idade: null }), null)
  assert.equal(manchete(null), null)
})

test('a comparacao sai em duas linhas alinhaveis, barata primeiro', () => {
  const c = comparacao({ idade: recomendarIdade(FAIXAS) })
  assert.equal(c.length, 2)
  assert.equal(c[0].tom, 'bom')
  assert.equal(c[1].tom, 'ruim')
  assert.match(c[0].valor, /^R\$ /)
  assert.match(c[1].valor, /^R\$ /)
})

test('sem idade recomendada nao ha comparacao', () => {
  assert.deepEqual(comparacao({ idade: null }), [])
  assert.deepEqual(comparacao(null), [])
})

test('vezes e escrito como gente fala', () => {
  assert.equal(vezesEmTexto(2.53), '2,5×')
  assert.equal(vezesEmTexto(12.34), '12×', 'acima de 10 a casa decimal só polui')
  assert.equal(vezesEmTexto(1), '', 'igual não é comparação')
  assert.equal(vezesEmTexto(0.5), '')
  assert.equal(vezesEmTexto(null), '')
})

test('cidades e interesses viram LISTA, e nao frase com virgulas', () => {
  const r = repetidos({
    cidades: [{ nome: 'Campinas' }, { nome: 'Limeira' }],
    interesses: [{ nome: 'Moda' }, { nome: 'Luxo' }, { nome: 'Bolsas' }],
  })
  assert.equal(r.length, 2)
  assert.deepEqual(r[0].itens, ['Campinas', 'Limeira'])
  assert.equal(r[1].itens.length, 3)
})

test('sem cidade nem interesse, nao sobra secao vazia', () => {
  assert.deepEqual(repetidos({ cidades: [], interesses: [] }), [])
  assert.deepEqual(repetidos(null), [])
})

test('a leitura da IA e quebrada em paragrafos', () => {
  const t = 'A faixa de 35 a 64 traz conversas por R$ 460,75. A de 25-34 custa R$ 1.164,60. '
    + 'Isso indica que o público mais maduro responde melhor. Nos últimos 90 dias houve desperdício.'
  const p = paragrafosDaLeitura(t)
  assert.equal(p.length, 2, 'quatro frases viram dois blocos de duas')
  assert.match(p[0], /^A faixa de 35/)
  assert.ok(p.join(' ').length >= t.length - 4, 'nada do texto pode se perder no caminho')
})

test('leitura vazia nao vira paragrafo em branco', () => {
  assert.deepEqual(paragrafosDaLeitura(''), [])
  assert.deepEqual(paragrafosDaLeitura(null), [])
  assert.deepEqual(paragrafosDaLeitura('   '), [])
})

test('medido e opiniao sao contados SEPARADOS', () => {
  // Somar os dois faria a tela dizer "5 sugestões" quando 3 são medidas e 2 são
  // palpite — e é justamente essa diferença que o editor inteiro protege.
  const c = contarPartes({
    idade: { idadeMin: 35 }, cidades: [{ nome: 'a' }], interesses: [{ nome: 'b' }],
    interessesIA: [{ id: '1' }, { id: '2' }], leitura: 'algo',
  })
  assert.equal(c.medido, 3)
  assert.equal(c.daIA, 3)
})

test('a sugestao inteira, do jeito que a tela recebe, atravessa sem quebrar', () => {
  const s = montarSugestao({ faixasDeIdade: FAIXAS, conjuntos: [] })
  assert.ok(s.temAlgo)
  assert.ok(manchete(s))
  assert.equal(comparacao(s).length, 2)
})
