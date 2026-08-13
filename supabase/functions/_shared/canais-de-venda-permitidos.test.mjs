import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canaisDoEscopo, estaLimitada, filtrarPedidos, filtrarMapaDeCanais, fraseDoRecorte,
  recortarRespostaDoBling,
} from './canais-de-venda-permitidos.js'

// Os times e canais REAIS, medidos no banco em 12/08/2026.
const TIVOLI = { id: 't1', nome: 'Tivoli', canal_loja_id: 205834140 }
const DOMPEDRO = { id: 't2', nome: 'Dom Pedro', canal_loja_id: 205657609 }
const IGUATEMI = { id: 't3', nome: 'Iguatemi Campinas', canal_loja_id: null }
const TIMES = [TIVOLI, DOMPEDRO, IGUATEMI]
const MAPA = {
  205451611: 'Atacado Nuvem Shop',
  205657609: 'Loja Dom Pedro',
  205834140: "Loja Santa Bárbara d'Oeste",
  205680515: 'Amazon Seller',
}

// ── Quem vê tudo continua vendo tudo ────────────────────────────────────────

test('super-admin nao e limitado', () => {
  assert.equal(canaisDoEscopo({ isSuperadmin: true, escopoPorEquipe: true, meuId: 'u1', times: TIMES, membros: [] }), null)
})

test('quem NAO esta sob escopo por equipe ve tudo — sao 15 dos 17 de hoje', () => {
  // A linha mais importante deste arquivo: o dono pediu explicitamente que
  // NADA mudasse para os outros usuários. `null` é o caminho de "não mexe".
  assert.equal(canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: false, meuId: 'u1', times: TIMES, membros: [] }), null)
})

test('coluna ausente NAO limita ninguem por engano', () => {
  // Se o select de login esquecer a coluna, o certo é o comportamento de hoje
  // (vê tudo), e não zerar a tela de todo mundo.
  assert.equal(canaisDoEscopo({ isSuperadmin: false, meuId: 'u1', times: TIMES, membros: [] }), null)
  assert.equal(canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: null, meuId: 'u1', times: TIMES, membros: [] }), null)
})

// ── Quem é de time vê só a loja dela ────────────────────────────────────────

test('vendedora do Dom Pedro so ve o canal do Dom Pedro', () => {
  // O caso real: Héllen e Juliana, as duas únicas limitadas hoje.
  const membros = [{ equipe_id: 't2', profile_id: 'u1' }]
  assert.deepEqual(
    canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: 'u1', times: TIMES, membros }),
    [205657609],
  )
})

test('quem esta em dois times ve os dois canais', () => {
  const membros = [{ equipe_id: 't1', profile_id: 'u1' }, { equipe_id: 't2', profile_id: 'u1' }]
  const r = canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: 'u1', times: TIMES, membros })
  assert.deepEqual(r.sort(), [205657609, 205834140])
})

test('limitada e sem time nenhum ve NADA — lista vazia, nao "tudo"', () => {
  // A confusão entre `[]` e `null` aqui entregaria a empresa inteira a quem
  // acabou de ser criada. É o defeito mais caro que este módulo previne.
  const r = canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: 'u1', times: TIMES, membros: [] })
  assert.deepEqual(r, [])
  assert.notEqual(r, null)
})

test('time SEM canal do Bling nao acrescenta canal nenhum', () => {
  const membros = [{ equipe_id: 't3', profile_id: 'u1' }]
  assert.deepEqual(canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: 'u1', times: TIMES, membros }), [])
})

test('sem id de usuario nao devolve "tudo"', () => {
  assert.deepEqual(canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: null, times: TIMES, membros: [] }), [])
})

test('canal repetido em dois times nao duplica', () => {
  const times = [{ id: 'a', canal_loja_id: 205657609 }, { id: 'b', canal_loja_id: 205657609 }]
  const membros = [{ equipe_id: 'a', profile_id: 'u1' }, { equipe_id: 'b', profile_id: 'u1' }]
  assert.deepEqual(canaisDoEscopo({ isSuperadmin: false, escopoPorEquipe: true, meuId: 'u1', times, membros }), [205657609])
})

// ── O recorte aplicado ──────────────────────────────────────────────────────

test('estaLimitada separa "todos" de "nenhum"', () => {
  assert.equal(estaLimitada(null), false)
  assert.equal(estaLimitada([]), true)
  assert.equal(estaLimitada([1]), true)
})

test('pedidos: null devolve a MESMA lista, sem copiar nem reordenar', () => {
  const pedidos = [{ id: 1, loja: { id: 205657609 } }, { id: 2, loja: { id: 205834140 } }]
  assert.equal(filtrarPedidos(pedidos, null), pedidos)
})

test('pedidos: so os do canal permitido', () => {
  const pedidos = [
    { id: 1, loja: { id: 205657609 } },
    { id: 2, loja: { id: 205834140 } },
    { id: 3, loja: { id: 205451611 } },
  ]
  assert.deepEqual(filtrarPedidos(pedidos, [205657609]).map((p) => p.id), [1])
})

test('pedido SEM loja nao passa quando ha recorte', () => {
  // O Bling manda pedido sem `loja` (venda avulsa). Deixá-lo passar somaria ao
  // faturamento da vendedora uma venda que não é do canal dela.
  const pedidos = [{ id: 1 }, { id: 2, loja: {} }, { id: 3, loja: { id: 205657609 } }]
  assert.deepEqual(filtrarPedidos(pedidos, [205657609]).map((p) => p.id), [3])
})

test('id numero x id texto da no mesmo', () => {
  const pedidos = [{ id: 1, loja: { id: '205657609' } }]
  assert.equal(filtrarPedidos(pedidos, [205657609]).length, 1)
})

test('mapa de canais: recorta o seletor, para nao oferecer o que nao se ve', () => {
  assert.deepEqual(Object.keys(filtrarMapaDeCanais(MAPA, [205657609])), ['205657609'])
  assert.equal(Object.keys(filtrarMapaDeCanais(MAPA, null)).length, 4)
  assert.deepEqual(filtrarMapaDeCanais(MAPA, []), {})
})

// ── A frase ─────────────────────────────────────────────────────────────────

test('sem recorte nao ha frase', () => {
  assert.equal(fraseDoRecorte(null, MAPA), '')
})

test('a frase diz o NOME do canal, e nao o numero', () => {
  const f = fraseDoRecorte([205657609], MAPA)
  assert.match(f, /Loja Dom Pedro/)
  assert.match(f, /o seu canal/)
})

test('sem canal nenhum a frase diz o que fazer, nao so que esta vazio', () => {
  // Tela zerada sem explicação parece defeito. A frase precisa dizer o passo.
  const f = fraseDoRecorte([], MAPA)
  assert.match(f, /não está em nenhum time/)
  assert.match(f, /te colocar no time/)
})

test('canal que o mapa nao conhece vira numero, nao frase muda', () => {
  assert.match(fraseDoRecorte([999], MAPA), /canal 999/)
})

// ── O lado da EDGE: recortar a resposta do Bling (B1f) ──────────────────────
//
// A diferença para os testes de cima: lá o assunto é o que a TELA desenha; aqui
// é o que sequer sai do servidor. Uma falha aqui é vazamento, não é layout.

const PEDIDO_TIVOLI = { id: 1, numero: '100', loja: { id: 205834140 } }
const PEDIDO_DOMPEDRO = { id: 2, numero: '200', loja: { id: 205657609 } }
const LISTA = { data: [PEDIDO_TIVOLI, PEDIDO_DOMPEDRO] }

test('quem NAO esta limitada recebe o corpo intacto, o MESMO objeto', () => {
  // Identidade, não igualdade: o caminho de quase todo mundo e dos robôs não
  // pode nem copiar nem reordenar por engano.
  const r = recortarRespostaDoBling('pedidos/vendas', LISTA, null)
  assert.equal(r.corpo, LISTA)
  assert.equal(r.negado, false)
})

test('a lista de pedidos perde o que nao e dos canais dela', () => {
  const r = recortarRespostaDoBling('pedidos/vendas', LISTA, [205657609])
  assert.deepEqual(r.corpo.data, [PEDIDO_DOMPEDRO])
  assert.equal(r.negado, false)
})

test('sem canal nenhum a lista vem vazia, e nao inteira', () => {
  // `[]` (nenhum canal) NÃO é `null` (todos). Confundir os dois é o defeito que
  // faz quem não tem time enxergar a empresa inteira.
  const r = recortarRespostaDoBling('pedidos/vendas', LISTA, [])
  assert.deepEqual(r.corpo.data, [])
})

test('recortar a lista nao estraga o resto do corpo (paginacao do Bling)', () => {
  const comPaginacao = { data: [PEDIDO_TIVOLI, PEDIDO_DOMPEDRO], pagina: 3, total: 87 }
  const r = recortarRespostaDoBling('pedidos/vendas', comPaginacao, [205834140])
  assert.equal(r.corpo.pagina, 3)
  assert.equal(r.corpo.total, 87)
  assert.deepEqual(r.corpo.data, [PEDIDO_TIVOLI])
})

test('UM pedido de outra loja e NEGADO, nao devolvido vazio', () => {
  // Devolver vazio diria "não existe essa venda". O certo é dizer "você não
  // pode ver", que é uma frase diferente e verdadeira.
  const r = recortarRespostaDoBling('pedidos/vendas/2', { data: PEDIDO_DOMPEDRO }, [205834140])
  assert.equal(r.negado, true)
  assert.equal(r.corpo, null)
})

test('UM pedido da loja dela passa', () => {
  const corpo = { data: PEDIDO_DOMPEDRO }
  const r = recortarRespostaDoBling('pedidos/vendas/2', corpo, [205657609])
  assert.equal(r.negado, false)
  assert.equal(r.corpo, corpo)
})

test('pedido sem loja nao vira "de todo mundo"', () => {
  // Sem canal identificável, o lado seguro é negar: o outro lado entrega
  // faturamento de loja alheia.
  const r = recortarRespostaDoBling('pedidos/vendas/9', { data: { id: 9 } }, [205657609])
  assert.equal(r.negado, true)
})

test('nota fiscal e NEGADA para quem esta limitada', () => {
  // É o faturamento de todas as lojas pela porta dos fundos. Nenhuma tela chama
  // esses caminhos — só o robô, que entra com a conta de serviço, não limitada.
  for (const caminho of ['nfe', 'nfe/123', 'nfce', 'nfce/456']) {
    assert.equal(recortarRespostaDoBling(caminho, { data: [] }, [205657609]).negado, true, caminho)
  }
})

test('nota fiscal PASSA para quem nao esta limitada (o robo)', () => {
  const corpo = { data: [{ id: 1 }] }
  assert.equal(recortarRespostaDoBling('nfe', corpo, null).negado, false)
  assert.equal(recortarRespostaDoBling('nfe', corpo, null).corpo, corpo)
})

test('produto e saldo nao falam de canal: passam ate para quem esta limitada', () => {
  const corpo = { data: [{ id: 1 }] }
  for (const caminho of ['produtos', 'produtos/7', 'estoques/saldos', 'vendedores/3']) {
    const r = recortarRespostaDoBling(caminho, corpo, [205657609])
    assert.equal(r.negado, false, caminho)
    assert.equal(r.corpo, corpo, caminho)
  }
})

test('resposta de ERRO do Bling nao e confundida com lista', () => {
  // O Bling responde `{error:...}` sem `data`. Recortar isso não pode explodir
  // nem virar lista vazia — a tela precisa ver o erro que veio.
  const erro = { error: { description: 'limite excedido' } }
  const r = recortarRespostaDoBling('pedidos/vendas', erro, [205657609])
  assert.equal(r.negado, false)
  assert.equal(r.corpo, erro)
})
