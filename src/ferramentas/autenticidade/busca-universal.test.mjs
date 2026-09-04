import { test } from 'node:test'
import assert from 'node:assert/strict'
import { palheiroDe, filtrarEtiquetas, FORA_DA_BUSCA } from './busca-e-arquivamento.js'

const LOTE = {
  id: '7f3a1c22-9b4e-4d51-8a02-1f6c5e8b90aa',
  modelo: 'Handbag Lunea', cor: 'Fendi e Café', sku: 'H0009S',
  quantidade: 12, fabricado_em: '2026-08-30',
  criado_por: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
  fotos: ['fotos/lv1021/1-frente.jpg'],
}
const PECA = {
  codigo: 'PX9FWMYJET', lote_id: LOTE.id, numero_na_serie: 1,
  gravada_em: '2026-09-01T13:55:40.151Z', baixada: false,
}
const achar = (texto, peca = PECA) => filtrarEtiquetas([peca], {
  loteDaPeca: () => LOTE, texto,
}).length === 1

// ══ O QUE JÁ FUNCIONAVA TEM DE CONTINUAR (PADRÃO item 8: nada se perde) ══

test('continua achando pelo codigo, modelo, cor e sku', () => {
  for (const t of ['PX9FWMYJET', 'Lunea', 'Fendi', 'H0009S', 'lunea fendi']) {
    assert.ok(achar(t), `deixou de achar por "${t}"`)
  }
})

// ══ O CORAÇÃO DO PEDIDO ══

test('⚠️ CAMPO QUE AINDA NAO EXISTE JA E PESQUISAVEL', () => {
  // Este teste é a promessa inteira. Se alguém voltar a escrever a lista de
  // campos à mão, ele reprova — e é a ÚNICA coisa que impede a busca de
  // envelhecer calada a cada migração.
  const pecaComCampoNovo = { ...PECA, revisado_por: 'Barbara Franco' }
  assert.ok(achar('Barbara', pecaComCampoNovo),
    'campo novo na etiqueta nasceu invisivel para a busca')
})

test('campo novo no LOTE tambem entra sozinho', () => {
  const loteNovo = { ...LOTE, fornecedor: 'Curtume Aurora' }
  const achou = filtrarEtiquetas([PECA], { loteDaPeca: () => loteNovo, texto: 'Aurora' })
  assert.equal(achou.length, 1, 'campo novo no lote nao entrou no palheiro')
})

test('objeto DENTRO da etiqueta tambem e varrido', () => {
  const peca = { ...PECA, garantia: { onde_comprou: 'Loja Dom Pedro' } }
  assert.ok(achar('Dom Pedro', peca))
})

// ══ AS DUAS PENEIRAS ══

test('⚠️ identificador NAO entra — por NOME', () => {
  assert.ok(!palheiroDe(LOTE).includes(LOTE.id), 'o id do lote entrou no palheiro')
  assert.ok(!palheiroDe(LOTE).includes(LOTE.criado_por), 'o criado_por entrou')
  assert.ok(!palheiroDe(PECA).includes(PECA.lote_id), 'o lote_id entrou')
})

test('⚠️ identificador NAO entra — por FORMA, em coluna que ninguem excluiu', () => {
  // É esta peneira que sobrevive ao futuro: a coluna nova ninguem lembrou de
  // por na lista, e mesmo assim ela nao envenena a busca.
  const peca = { ...PECA, pedido_id: 'dd99ee88-7777-6666-5555-444433332222' }
  assert.ok(!palheiroDe(peca).includes('dd99ee88'), 'identificador entrou por uma coluna nao listada')
  assert.ok(!FORA_DA_BUSCA.has('pedido_id'), 'o teste perdeu a graca: alguem listou o campo')
})

test('digitar UMA LETRA nao devolve tudo — que era o risco do identificador', () => {
  const peca = { ...PECA, pedido_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }
  assert.ok(!achar('eeee', peca), 'pedaco de identificador achou a peca')
})

test('sim/nao nao entra: ninguem digita "true"', () => {
  assert.ok(!palheiroDe({ ...PECA, baixada: true }).includes('true'))
})

test('lista de caminhos de foto fica de fora', () => {
  assert.ok(!palheiroDe(LOTE).includes('1-frente'))
})

// ══ DATA LEGÍVEL ══

test('data e pesquisavel COMO SE ESCREVE, nao como o banco guarda', () => {
  for (const t of ['01/09/2026', '01/09', 'setembro', '2026']) {
    assert.ok(achar(t), `nao achou pela data "${t}"`)
  }
})

test('a data do lote (dia inteiro) tambem', () => {
  assert.ok(achar('30/08'), 'nao achou pela data de fabricacao do lote')
  assert.ok(achar('agosto'), 'nao achou pelo mes do lote')
})

test('o dia sai pelo fuso de Sao Paulo, o mesmo que a tela mostra', () => {
  // 03/09 às 00:42 em UTC é 02/09 às 21:42 em São Paulo. A busca tem de
  // concordar com a lista, senão a pessoa procura pelo dia que está vendo e
  // não acha nada.
  const peca = { ...PECA, gravada_em: '2026-09-03T00:42:59.215Z' }
  assert.ok(achar('02/09', peca), 'a busca discordou do dia que a tela mostra')
})

// ══ NADA DE FALSO POSITIVO ══

test('quem nao tem o termo continua fora', () => {
  for (const t of ['Ravelle', 'Mostarda', 'ZZZZZZ']) {
    assert.ok(!achar(t), `achou "${t}" onde nao existe`)
  }
})

test('cada palavra digitada tem de aparecer, e nao a frase em ordem', () => {
  assert.ok(achar('fendi lunea'), 'trocar a ordem das palavras deixou de achar')
  assert.ok(!achar('lunea mostarda'), 'bastou UMA palavra casar')
})
