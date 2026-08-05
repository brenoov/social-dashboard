import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posseAberta, passarPara, quemEstavaCom, abrirPossesQueFaltam } from './posse.js'

const AGORA = '2026-08-05T12:00:00.000Z'

test('a posse aberta de um carro é a linha de posse sem volta', () => {
  const usos = [
    { id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p1', saida_em: '2026-08-01T00:00:00Z', volta_em: null },
    { id: 'u2', veiculo_id: 'v1', tipo: 'viagem', pessoa_id: 'p2', saida_em: '2026-08-04T00:00:00Z', volta_em: null },
  ]
  assert.equal(posseAberta(usos, 'v1').id, 'u1')
  assert.equal(posseAberta(usos, 'v9'), null)
})

test('passar o carro fecha a posse de quem estava e abre a de quem pegou', () => {
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p1', saida_em: '2026-08-01T00:00:00Z', volta_em: null }]
  const r = passarPara({ usos, veiculoId: 'v1', para: { id: 'p2', nome: 'Marcus' }, quando: AGORA })
  assert.deepEqual(r.fechar, { id: 'u1', volta_em: AGORA })
  assert.equal(r.abrir.pessoa_id, 'p2')
  assert.equal(r.abrir.pessoa_nome, 'Marcus')
  assert.equal(r.abrir.tipo, 'posse')
  assert.equal(r.abrir.volta_em, undefined)
})

test('devolver ao dono sem apontar ninguém só fecha a posse', () => {
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p2', saida_em: '2026-08-01T00:00:00Z', volta_em: null }]
  const r = passarPara({ usos, veiculoId: 'v1', para: null, quando: AGORA })
  assert.deepEqual(r.fechar, { id: 'u1', volta_em: AGORA })
  assert.equal(r.abrir, null)
})

test('carro que nunca teve posse só abre, sem fechar nada', () => {
  const r = passarPara({ usos: [], veiculoId: 'v1', para: { id: 'p1', nome: 'Humberto' }, quando: AGORA })
  assert.equal(r.fechar, null)
  assert.equal(r.abrir.pessoa_id, 'p1')
})

/* ── A pergunta que a multa faz ──────────────────────────────────────────── */

const LINHA_DO_TEMPO = [
  { id: 'a', veiculo_id: 'v1', tipo: 'posse',  pessoa_id: 'p1', pessoa_nome: 'Humberto',
    saida_em: '2026-08-01T00:00:00Z', volta_em: '2026-08-10T00:00:00Z' },
  { id: 'b', veiculo_id: 'v1', tipo: 'posse',  pessoa_id: 'p2', pessoa_nome: 'Marcus',
    saida_em: '2026-08-10T00:00:00Z', volta_em: null },
  { id: 'c', veiculo_id: 'v1', tipo: 'viagem', pessoa_id: 'p3', pessoa_nome: 'Barbara',
    saida_em: '2026-08-14T08:00:00Z', volta_em: '2026-08-14T18:00:00Z' },
]

test('quem estava com o carro numa data', () => {
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-05T10:00:00Z').pessoa_nome, 'Humberto')
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-12T10:00:00Z').pessoa_nome, 'Marcus')
})

test('viagem vence posse: quem pegou emprestado é quem estava dirigindo', () => {
  // É a resposta que a multa precisa. A multa de 14/08 às 15h40 é da Barbara,
  // que pegou o carro emprestado, não do Marcus, que é o dono.
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-14T15:40:00Z').pessoa_nome, 'Barbara')
})

test('antes de existir registro, a resposta é NÃO SEI — nunca um chute', () => {
  // Acusar alguém com dado inventado é pior do que não responder.
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-07-20T10:00:00Z'), null)
  assert.equal(quemEstavaCom([], 'v1', '2026-08-05T10:00:00Z'), null)
})

/* ── A virada de chave ───────────────────────────────────────────────────── */

test('abre uma posse por carro com dono, e nenhuma pros de rodízio', () => {
  const veiculos = [
    { id: 'v1', pessoa_id: 'p1', situacao: 'ativo' },
    { id: 'v2', pessoa_id: null, situacao: 'ativo' },
    { id: 'v3', pessoa_id: 'p3', situacao: 'ativo' },
  ]
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', volta_em: null, saida_em: '2026-08-01T00:00:00Z' }]
  const novas = abrirPossesQueFaltam(veiculos, usos, AGORA)
  assert.equal(novas.length, 1)
  assert.equal(novas[0].veiculo_id, 'v3')
  assert.equal(novas[0].saida_em, AGORA)
})
