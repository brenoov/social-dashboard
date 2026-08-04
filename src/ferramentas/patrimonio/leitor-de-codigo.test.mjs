import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numeroDoCodigo, resultadoDaLeitura, mensagemDoResultado, etiqueta } from './leitor-de-codigo.js'

const BENS = [
  { id: 'a', numero: 19, nome: 'Notebook Dell Latitude' },
  { id: 'b', numero: 7, nome: 'Cadeira giratória' },
  { id: 'c', numero: null, nome: 'Item sem etiqueta' },
]

test('lê o que a etiqueta de verdade guarda', () => {
  // Medido numa etiqueta real da RBV & Co.: o código Code 128 contém "000019"
  // e o número impresso embaixo é o mesmo. Se este teste cair, ou o formato da
  // etiqueta mudou, ou alguém "arrumou" o corte dos zeros.
  assert.equal(numeroDoCodigo('000019'), 19)
  assert.equal(etiqueta(19), '000019')
})

test('zero à esquerda não vira número diferente', () => {
  assert.equal(numeroDoCodigo('000007'), 7)
  assert.equal(numeroDoCodigo('7'), 7)
  assert.equal(numeroDoCodigo('000400'), 400)
})

test('espaço em volta não atrapalha', () => {
  // Alguns leitores devolvem com quebra de linha no fim.
  assert.equal(numeroDoCodigo('  000019 \n'), 19)
})

test('asterisco do Code 39 é descascado', () => {
  // Nenhuma etiqueta nossa usa Code 39 hoje, mas leitor que devolve "*19*" é
  // comum — melhor não descobrir isso no meio do corredor.
  assert.equal(numeroDoCodigo('*000019*'), 19)
})

test('recusa o que NÃO é etiqueta nossa', () => {
  assert.equal(numeroDoCodigo('7891234567895'), null, 'código de barras de produto (13 dígitos) não é patrimônio')
  assert.equal(numeroDoCodigo('000000'), null, 'ninguém tem patrimônio zero')
  assert.equal(numeroDoCodigo('ABC123'), null)
  assert.equal(numeroDoCodigo('12,50'), null)
  assert.equal(numeroDoCodigo(''), null)
  assert.equal(numeroDoCodigo(null), null)
  assert.equal(numeroDoCodigo(undefined), null)
})

test('leitura boa devolve o bem', () => {
  const r = resultadoDaLeitura(BENS, '000019')
  assert.equal(r.ok, true)
  assert.equal(r.numero, 19)
  assert.equal(r.bem.nome, 'Notebook Dell Latitude')
})

test('número válido que ninguém cadastrou é um caso À PARTE de código ilegível', () => {
  // São problemas diferentes e a pessoa precisa saber qual é: num caso ela
  // aproxima a câmera, no outro ela cadastra o item.
  const r = resultadoDaLeitura(BENS, '000350')
  assert.equal(r.ok, false)
  assert.equal(r.motivo, 'nao-cadastrado')
  assert.equal(r.numero, 350, 'o número lido tem que sobreviver, é o que ela vai cadastrar')

  const i = resultadoDaLeitura(BENS, 'xyz')
  assert.equal(i.motivo, 'ilegivel')
  assert.equal(i.numero, null)
})

test('bem sem número nunca casa com leitura nenhuma', () => {
  // Havia 13 bens sem etiqueta na importação. Um `find` frouxo casaria
  // null == undefined e abriria o item errado.
  assert.equal(resultadoDaLeitura(BENS, '0').bem, null)
  assert.equal(resultadoDaLeitura([{ id: 'x', numero: null }], '000019').bem, null)
})

test('lista vazia ou ausente não quebra', () => {
  assert.equal(resultadoDaLeitura([], '000019').motivo, 'nao-cadastrado')
  assert.equal(resultadoDaLeitura(null, '000019').motivo, 'nao-cadastrado')
})

test('as mensagens falam português de gente, e dizem o que fazer', () => {
  const achou = mensagemDoResultado(resultadoDaLeitura(BENS, '000019'))
  assert.match(achou, /000019/, 'mostra a etiqueta como ela está impressa')
  assert.match(achou, /Notebook Dell Latitude/)

  const faltando = mensagemDoResultado(resultadoDaLeitura(BENS, '000350'))
  assert.match(faltando, /000350/)
  assert.match(faltando, /cadastrado/i)

  const ilegivel = mensagemDoResultado(resultadoDaLeitura(BENS, '???'))
  assert.match(ilegivel, /reflexo|aproxime/i, 'tem que ensinar o que fazer, não só dizer que falhou')

  for (const m of [achou, faltando, ilegivel]) {
    for (const jargao of ['null', 'undefined', 'string', 'parse', 'decode', 'erro:']) {
      assert.ok(!m.toLowerCase().includes(jargao), `mensagem com jargão "${jargao}": ${m}`)
    }
  }
})

test('mensagem não quebra sem resultado', () => {
  assert.equal(mensagemDoResultado(null), '')
})
