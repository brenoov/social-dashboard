import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizar, ehBalcao, agruparVendedores, lojaDaVendedora, comoDizerALoja,
  viraConta, emailSugerido,
} from './vendedoras.js'

// Os 22 registros REAIS de bling_vendedores, medidos em 04/08/2026. É contra
// esta lista que as regras foram escritas — e é ela que garante que uma regra
// nova não quebre um caso que já funcionava.
const REAIS = [
  { vendor_id: 15596779093, nome: 'Silvia Lie Fukuda', pedidos: 153, ultima_venda: '2026-08-03' },
  { vendor_id: 15596873009, nome: 'Ana Caroline Moreira', pedidos: 106, ultima_venda: '2026-07-27' },
  { vendor_id: 15596885412, nome: 'Maria Eduarda Florêncio', pedidos: 85, ultima_venda: '2026-07-22' },
  { vendor_id: 15596873010, nome: 'Thaina Mikaela de Godoy Pimenta', pedidos: 81, ultima_venda: '2026-07-27' },
  { vendor_id: 15596887125, nome: 'Maria Eduarda Cristina Schettini', pedidos: 44, ultima_venda: '2026-07-21' },
  { vendor_id: 15596870656, nome: 'Lavinia Neblon Cecilio dos Santos', pedidos: 42, ultima_venda: '2026-06-06' },
  { vendor_id: 15596552528, nome: 'Fernanda Moretto', pedidos: 38, ultima_venda: '2026-06-30' },
  { vendor_id: 15596565431, nome: 'Fábrica', pedidos: 35, ultima_venda: '2026-08-04' },
  { vendor_id: 15596891486, nome: 'Geovanna de Godoy Alves', pedidos: 35, ultima_venda: '2026-07-21' },
  { vendor_id: 15596926376, nome: 'Najla Souza', pedidos: 17, ultima_venda: '2026-08-03' },
  { vendor_id: 15596850784, nome: 'Maria Paula Pellet Almeida', pedidos: 15, ultima_venda: '2026-04-20' },
  { vendor_id: 15596873012, nome: 'loja tivoli', pedidos: 14, ultima_venda: '2026-05-06' },
  { vendor_id: 15596891489, nome: 'Alexandra Aleíde de Abreu Pinto', pedidos: 13, ultima_venda: '2026-05-30' },
  { vendor_id: 15596842585, nome: 'Vanessa Lopes Ramos', pedidos: 8, ultima_venda: '2026-04-11' },
  { vendor_id: 15596930684, nome: 'Matheus Henrique de Jesus Brito', pedidos: 6, ultima_venda: '2026-08-04' },
  { vendor_id: 15596891313, nome: 'Elen Simone Lopes', pedidos: 5, ultima_venda: '2026-06-10' },
  { vendor_id: 15596878463, nome: 'Elen Simone Lopes', pedidos: 4, ultima_venda: '2026-04-08' },
  { vendor_id: 15596885410, nome: 'Elen Lopes', pedidos: 2, ultima_venda: '2026-04-24' },
  { vendor_id: 15596928583, nome: 'Juliana Patrícia dos Santos', pedidos: 2, ultima_venda: '2026-08-04' },
  { vendor_id: 15596869199, nome: 'Maria Cristina', pedidos: 2, ultima_venda: '2026-04-12' },
  { vendor_id: 15596778788, nome: 'Najla Rocha', pedidos: 2, ultima_venda: '2026-05-02' },
  { vendor_id: 15596779095, nome: 'Veridiana Cristina Silva', pedidos: 1, ultima_venda: '2026-04-04' },
]

const acha = (grupos, nome) => grupos.find((g) => g.nome === nome)

// ── As três Elen viram uma ──────────────────────────────────────────────────

test('os TRES cadastros da Elen viram UM, somando os pedidos', () => {
  const g = agruparVendedores(REAIS)
  const elen = g.filter((x) => /elen/i.test(x.nome))
  assert.equal(elen.length, 1, 'sobrou mais de uma Elen')
  assert.equal(elen[0].ids.length, 3)
  assert.equal(elen[0].pedidos, 5 + 4 + 2)
})

test('o nome que fica e o MAIS COMPLETO', () => {
  // "Elen Simone Lopes" diz mais que "Elen Lopes".
  const g = agruparVendedores(REAIS)
  assert.equal(g.filter((x) => /elen/i.test(x.nome))[0].nome, 'Elen Simone Lopes')
})

test('a ultima venda do grupo e a mais RECENTE das tres', () => {
  const g = agruparVendedores(REAIS)
  assert.equal(g.filter((x) => /elen/i.test(x.nome))[0].ultima_venda, '2026-06-10')
})

// ── O que NÃO pode ser juntado ──────────────────────────────────────────────

test('Najla Souza e Najla Rocha NAO sao juntadas', () => {
  // Sobrenomes diferentes. Juntar duas mulheres diferentes numa conta dá a uma
  // o faturamento da outra — quando a máquina não tem certeza, quem decide é
  // quem conhece a equipe.
  const g = agruparVendedores(REAIS)
  assert.ok(acha(g, 'Najla Souza'), 'Najla Souza sumiu')
  assert.ok(acha(g, 'Najla Rocha'), 'Najla Rocha sumiu')
})

test('mas as duas Najla ficam MARCADAS como parecidas', () => {
  const g = agruparVendedores(REAIS)
  assert.deepEqual(acha(g, 'Najla Souza').parecidos, ['Najla Rocha'])
  assert.deepEqual(acha(g, 'Najla Rocha').parecidos, ['Najla Souza'])
})

test('as duas Maria Eduarda continuam separadas', () => {
  // "Maria Eduarda Florêncio" e "Maria Eduarda Cristina Schettini": mesmo
  // começo, pessoas diferentes.
  const g = agruparVendedores(REAIS)
  assert.ok(acha(g, 'Maria Eduarda Florêncio'))
  assert.ok(acha(g, 'Maria Eduarda Cristina Schettini'))
})

test('"Maria Cristina" nao e engolida por "Maria Eduarda Cristina Schettini"', () => {
  // CONFIRMADO PELO DONO em 04/08/2026, e é por isso que este teste existe:
  // "já teve uma maria cristina só que em hortolândia, e essa maria eduarda
  // cristina deve ser outra pessoa". São duas mulheres, de lojas diferentes.
  //
  // A primeira versão da regra juntava as duas — as palavras "maria" e
  // "cristina" aparecem nas duas, na mesma ordem. Juntá-las daria a uma o
  // faturamento da outra. Se alguém for afrouxar o agrupamento algum dia, que
  // seja depois de reler isto.
  const g = agruparVendedores(REAIS)
  assert.ok(acha(g, 'Maria Cristina'), 'Maria Cristina (Hortolândia) foi engolida')
  assert.ok(acha(g, 'Maria Eduarda Cristina Schettini'), 'a outra Maria sumiu')
  assert.equal(acha(g, 'Maria Cristina').ids.length, 1, 'não pode ter absorvido outro cadastro')
})

// ── Balcão não é pessoa ─────────────────────────────────────────────────────

test('"Fabrica" e "loja tivoli" sao BALCAO, nao pessoa', () => {
  const g = agruparVendedores(REAIS)
  assert.equal(acha(g, 'Fábrica').balcao, true)
  assert.equal(acha(g, 'loja tivoli').balcao, true)
})

test('balcao NAO some — a venda dele e real e precisa cair num time', () => {
  // Decisão do dono: "considere os que não são pessoas também".
  const g = agruparVendedores(REAIS)
  assert.equal(acha(g, 'Fábrica').pedidos, 35)
  assert.equal(acha(g, 'loja tivoli').pedidos, 14)
})

test('balcao nao vira conta de acesso — nao ha quem entre nela', () => {
  const g = agruparVendedores(REAIS)
  assert.equal(viraConta(acha(g, 'Fábrica')), false)
  assert.equal(viraConta(acha(g, 'Silvia Lie Fukuda')), true)
})

test('quem nunca vendeu nada nao vira conta', () => {
  assert.equal(viraConta({ nome: 'Alguém', pedidos: 0, balcao: false }), false)
  assert.equal(viraConta(null), false)
})

test('balcao nao entra em grupo de pessoa', () => {
  // "loja tivoli" não pode ser confundida com uma vendedora chamada Tivoli.
  const g = agruparVendedores([
    { vendor_id: 1, nome: 'loja tivoli', pedidos: 14 },
    { vendor_id: 2, nome: 'Tivoli Souza', pedidos: 3 },
  ])
  assert.equal(g.length, 2)
})

test('reconhece outras formas de balcao', () => {
  assert.equal(ehBalcao('Atacado Nuvem Shop'), true)
  assert.equal(ehBalcao('Varejo Fábrica'), true)
  assert.equal(ehBalcao('Institucional'), true)
  assert.equal(ehBalcao('Ana Caroline Moreira'), false)
  assert.equal(ehBalcao(''), false)
})

// ── A lista inteira ─────────────────────────────────────────────────────────

test('os 22 do Bling viram 20 linhas — e nenhum pedido se perde', () => {
  const g = agruparVendedores(REAIS)
  assert.equal(g.length, 20, 'só as três Elen deviam ter se juntado')
  const somaOriginal = REAIS.reduce((s, v) => s + v.pedidos, 0)
  const somaAgrupada = g.reduce((s, x) => s + x.pedidos, 0)
  assert.equal(somaAgrupada, somaOriginal, 'sumiu pedido no agrupamento')
})

test('a lista sai de quem mais vende para quem menos vende', () => {
  const g = agruparVendedores(REAIS)
  assert.equal(g[0].nome, 'Silvia Lie Fukuda')
  for (let i = 1; i < g.length; i++) assert.ok(g[i - 1].pedidos >= g[i].pedidos)
})

test('lista vazia nao estoura', () => {
  assert.deepEqual(agruparVendedores([]), [])
  assert.deepEqual(agruparVendedores(null), [])
})

test('registro sem id e descartado', () => {
  assert.equal(agruparVendedores([{ nome: 'Sem id' }]).length, 0)
})

// ── De qual loja é cada uma ─────────────────────────────────────────────────

test('a loja e aquela onde ela mais vendeu', () => {
  const e = lojaDaVendedora([
    { loja_id: 205834140 }, { loja_id: 205834140 }, { loja_id: 205834140 },
    { loja_id: 205657609 },
  ])
  assert.equal(e.loja_id, 205834140)
  assert.equal(e.certeza, 0.75)
  assert.deepEqual(e.outras, [{ loja_id: 205657609, pedidos: 1 }])
})

test('venda avulsa noutra loja nao muda o time dela', () => {
  const e = lojaDaVendedora(Array(19).fill({ loja_id: 1 }).concat([{ loja_id: 2 }]))
  assert.equal(e.loja_id, 1)
  assert.ok(e.certeza > 0.9)
})

test('sem loja gravada, DIZ que nao sabe — em vez de chutar', () => {
  // "sem loja" e "loja desconhecida" levam a ações diferentes: a primeira se
  // resolve abrindo a tela de vendas uma vez.
  const e = lojaDaVendedora([{ loja_id: null }, {}])
  assert.equal(e.loja_id, null)
  assert.match(comoDizerALoja(e), /ainda sem loja/)
})

test('quando a divisao e parelha, a tela mostra a porcentagem', () => {
  const e = lojaDaVendedora([{ loja_id: 1 }, { loja_id: 1 }, { loja_id: 2 }])
  assert.match(comoDizerALoja(e, 'Tivoli'), /Tivoli \(67% das vendas dela\)/)
})

test('quando e claro, mostra so o nome da loja', () => {
  const e = lojaDaVendedora(Array(10).fill({ loja_id: 1 }))
  assert.equal(comoDizerALoja(e, 'Tivoli'), 'Tivoli')
})

// ── O e-mail sugerido ───────────────────────────────────────────────────────

test('sugere primeiro.ultimo, sem acento', () => {
  assert.equal(emailSugerido('Maria Eduarda Florêncio'), 'maria.florencio@rbvcompany.com')
  assert.equal(emailSugerido('Silvia Lie Fukuda'), 'silvia.fukuda@rbvcompany.com')
})

test('nome de uma palavra so nao vira ponto solto', () => {
  assert.equal(emailSugerido('Fábrica'), 'fabrica@rbvcompany.com')
})

test('sem nome, sem e-mail — nao inventa "@rbvcompany.com" sozinho', () => {
  assert.equal(emailSugerido(''), '')
  assert.equal(emailSugerido(null), '')
})

test('normalizar tira acento, caixa e pontuacao', () => {
  assert.equal(normalizar('Alexandra Aleíde de Abreu Pinto'), 'alexandra aleide de abreu pinto')
  assert.equal(normalizar('  Elen   Lopes  '), 'elen lopes')
})

// ── Amostra fina fala baixo ─────────────────────────────────────────────────

test('12 pedidos com loja de 153 NAO viram uma afirmacao', () => {
  // O CASO REAL, visto na tela em 05/08/2026: a Silvia tem 153 pedidos e só 12
  // com loja gravada (a coluna acabou de nascer — 30 de 713 no cache inteiro).
  // A tela dizia "Loja Dom Pedro" com a cara de quem sabe.
  const pedidos = Array(12).fill({ loja_id: 205657609 }).concat(Array(141).fill({ loja_id: null }))
  const e = lojaDaVendedora(pedidos)
  assert.equal(e.pedidosDela, 153)
  assert.equal(e.comLoja, 12)
  assert.ok(e.cobertura < 0.1)
  const frase = comoDizerALoja(e, 'Dom Pedro')
  assert.match(frase, /^talvez Dom Pedro/)
  assert.match(frase, /12 dos 153/)
})

test('com a maioria dos pedidos carregando loja, volta a afirmar', () => {
  const pedidos = Array(90).fill({ loja_id: 1 }).concat(Array(10).fill({ loja_id: null }))
  assert.equal(comoDizerALoja(lojaDaVendedora(pedidos), 'Tivoli'), 'Tivoli')
})

test('cobertura boa mas divisao parelha continua mostrando a porcentagem', () => {
  const pedidos = Array(6).fill({ loja_id: 1 }).concat(Array(4).fill({ loja_id: 2 }))
  assert.match(comoDizerALoja(lojaDaVendedora(pedidos), 'Tivoli'), /Tivoli \(60% das vendas dela\)/)
})

// ── Avisar demais é não avisar ──────────────────────────────────────────────

test('as duas Najla continuam se avisando — o caso que motivou o aviso', () => {
  const g = agruparVendedores(REAIS)
  assert.deepEqual(acha(g, 'Najla Souza').parecidos, ['Najla Rocha'])
})

test('as duas Maria Eduarda se avisam: os DOIS primeiros nomes batem', () => {
  const g = agruparVendedores(REAIS)
  assert.ok(acha(g, 'Maria Eduarda Florêncio').parecidos.includes('Maria Eduarda Cristina Schettini'))
})

test('Maria Eduarda NAO e parecida com Maria Paula — sao obviamente outras', () => {
  // Seis avisos apareceram na tela por causa disso. Aviso onde não devia ensina
  // a ignorar aviso, e aí ele não serve para o caso em que importa.
  const g = agruparVendedores(REAIS)
  assert.ok(!acha(g, 'Maria Eduarda Florêncio').parecidos.includes('Maria Paula Pellet Almeida'))
  assert.ok(!acha(g, 'Maria Cristina').parecidos.includes('Maria Paula Pellet Almeida'))
})

test('o barulho caiu: menos avisos do que nomes', () => {
  const g = agruparVendedores(REAIS)
  const total = g.reduce((s, x) => s + (x.parecidos || []).length, 0)
  assert.ok(total <= 4, `avisos demais: ${total}`)
})
