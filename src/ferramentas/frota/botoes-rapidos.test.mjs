import { test } from 'node:test'
import assert from 'node:assert/strict'
import { botoesDoMotorista, botoesDaGestao } from './botoes-rapidos.js'

/* Os números são os reais medidos em 12/08/2026: 10 veículos, 2 sem dono,
 * 8 posses abertas, 0 checklists hoje, 2 requisições pendentes. */

const acha = (lista, chave) => lista.find((b) => b.chave === chave)

test('o motorista vê o nome do carro dele e que o checklist falta hoje', () => {
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [{}, {}, {}], comOutros: [] },
    checklistDeHoje: 'falta',
    nomeDoMeuCarro: 'FIAT BRAVO BLACKMOTION',
  })
  assert.equal(acha(b, 'meu-checklist').rotulo, 'Fazer meu checklist')
  assert.equal(acha(b, 'meu-checklist').estado, 'Bravo Blackmotion · falta hoje')
})

test('checklist já feito hoje diz que está feito — e não some', () => {
  // Sumir o botão faria a pessoa achar que perdeu a função. Ele fica, dizendo.
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [], comOutros: [] },
    checklistDeHoje: 'feito', nomeDoMeuCarro: 'HONDA FIT',
  })
  assert.equal(acha(b, 'meu-checklist').estado, 'Honda Fit · feito hoje')
})

test('quem não tem carro fixo não recebe uma promessa vazia', () => {
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [{}], comOutros: [] },
    checklistDeHoje: null, nomeDoMeuCarro: null,
  })
  assert.equal(acha(b, 'meu-checklist').estado, 'você não tem carro fixo')
})

test('"preciso usar um carro" conta os livres, no singular e no plural', () => {
  const um = botoesDoMotorista({ painel: { comigo: [], livres: [{}], comOutros: [] } })
  assert.equal(acha(um, 'preciso-carro').estado, '1 carro livre')
  const tres = botoesDoMotorista({ painel: { comigo: [], livres: [{}, {}, {}], comOutros: [] } })
  assert.equal(acha(tres, 'preciso-carro').estado, '3 carros livres')
})

test('sem carro livre, o botão DIZ isso em vez de sumir', () => {
  const b = botoesDoMotorista({ painel: { comigo: [], livres: [], comOutros: [] } })
  assert.equal(acha(b, 'preciso-carro').estado, 'nenhum carro livre agora')
})

test('a gestão vê quantos faltam conferir hoje', () => {
  // Medido em 12/08: 0 checklists hoje, 10 veículos.
  const b = botoesDaGestao({
    linhas: Array.from({ length: 10 }, () => ({ disponivel: false })),
    cobranca: Array.from({ length: 10 }, (_, i) => ({ fez: i < 2 })),
    fila: [],
  })
  assert.equal(acha(b, 'conferir-checklists').estado, 'faltam 8 de 10 hoje')
})

test('todos conferidos vira uma frase boa, não "faltam 0"', () => {
  const b = botoesDaGestao({
    linhas: [{ disponivel: false }], cobranca: [{ fez: true }], fila: [],
  })
  assert.equal(acha(b, 'conferir-checklists').estado, 'todos conferidos hoje')
})

test('sem quadro de cobrança carregado, o botão fica calado', () => {
  // `null` é "não sei", e não sei não vira número.
  const b = botoesDaGestao({ linhas: [{}], cobranca: null, fila: [] })
  assert.equal(acha(b, 'conferir-checklists').estado, null)
})

test('"veículos do grupo" mostra o total e quantos estão livres', () => {
  const b = botoesDaGestao({
    linhas: [{ disponivel: true }, { disponivel: false }, { disponivel: true }],
    cobranca: [], fila: [],
  })
  assert.equal(acha(b, 'veiculos').estado, '3 veículos · 2 livres')
})

test('reservar avisa quando há pedido esperando decisão', () => {
  const b = botoesDaGestao({ linhas: [], cobranca: [], fila: [{}, {}] })
  assert.equal(acha(b, 'reservar').estado, '2 pedidos esperando')
})

test('sem fila, reservar não inventa aviso', () => {
  const b = botoesDaGestao({ linhas: [], cobranca: [], fila: [] })
  assert.equal(acha(b, 'reservar').estado, null)
})

test('toda tecla e toda ação são únicas — botão repetido é bug de menu', () => {
  for (const lista of [botoesDoMotorista({ painel: {} }), botoesDaGestao({ linhas: [] })]) {
    const chaves = lista.map((b) => b.chave)
    assert.equal(new Set(chaves).size, chaves.length)
    for (const b of lista) assert.ok(b.rotulo && b.acao, 'botão sem rótulo ou sem ação')
  }
})

/* Nomes reais da frota medidos em 12/08/2026: código de modelo com dígito
 * (XC60, X1) remove a marca e fica preservado. Acrônimo final (PHEV) em 3+
 * palavras também fica maiúsculo. Palavra normal (Cayenne, Bravo) fica título-case. */

test('VOLVO XC60: marca cai, código preservado (dígito)', () => {
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [], comOutros: [] },
    checklistDeHoje: 'falta',
    nomeDoMeuCarro: 'VOLVO XC60',
  })
  assert.equal(acha(b, 'meu-checklist').estado, 'XC60 · falta hoje')
})

test('BMW X1: marca cai quando segunda é modelo (tem dígito)', () => {
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [], comOutros: [] },
    checklistDeHoje: 'falta',
    nomeDoMeuCarro: 'BMW X1',
  })
  assert.equal(acha(b, 'meu-checklist').estado, 'X1 · falta hoje')
})

test('PORSCHE CAYENNE PHEV: acrônimo 4-letras no final fica maiúsculo', () => {
  const b = botoesDoMotorista({
    painel: { comigo: [], livres: [], comOutros: [] },
    checklistDeHoje: 'falta',
    nomeDoMeuCarro: 'PORSCHE CAYENNE PHEV',
  })
  assert.equal(acha(b, 'meu-checklist').estado, 'Cayenne PHEV · falta hoje')
})
