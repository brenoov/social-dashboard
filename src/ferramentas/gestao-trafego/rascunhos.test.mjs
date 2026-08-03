import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  valeSalvar, mudou, linhaParaSalvar, quando, linhaDoHistorico,
  montarHistorico, rascunhoParaRetomar, DIAS_PARA_OFERECER,
} from './rascunhos.js'

const AGORA = new Date('2026-08-03T15:30:00-03:00')
const horas = (n) => new Date(AGORA.getTime() - n * 3600000).toISOString()
const dias = (n) => new Date(AGORA.getTime() - n * 86400000).toISOString()

test('so salva depois que ha algo a perder', () => {
  // Um rascunho por clique no botão encheria o histórico de linhas vazias: a
  // pessoa abre, olha e fecha, e isso não é uma tentativa de campanha.
  assert.equal(valeSalvar({}), false)
  assert.equal(valeSalvar({ nome: '   ' }), false)
  assert.equal(valeSalvar({ objetivo: 'conversa-whatsapp' }), true)
  assert.equal(valeSalvar({ nome: 'Bolsas' }), true)
})

test('nao grava quando nada mudou', () => {
  const e = { nome: 'X', publico: { cidades: [{ key: '1' }] } }
  assert.equal(mudou(e, { ...e }), false)
  assert.equal(mudou(e, { ...e, nome: 'Y' }), true)
  assert.equal(mudou(null, e), true)
})

test('a linha salva leva o publico INTEIRO — e o base do publico salvo', () => {
  // Sem isto, retomar um rascunho perderia o público salvo aplicado, que é o
  // trabalho mais chato de refazer.
  const estado = {
    nome: 'Bolsas', objetivo: 'conversa-whatsapp',
    publico: { cidades: [{ key: '247071', nome: 'Campinas' }], comportamentos: [{ id: '1' }] },
    _targetingBase: { geo_locations: { cities: [{ key: '247071' }] } },
  }
  const l = linhaParaSalvar({ estado, passo: 3, contaId: 'abc', tipoRotulo: 'Conversa no WhatsApp' })
  assert.equal(l.account_id, 'abc')
  assert.equal(l.passo, 3)
  assert.equal(l.nome, 'Bolsas')
  assert.equal(l.tipo, 'Conversa no WhatsApp')
  assert.equal(l.status, 'rascunho')
  assert.deepEqual(l.estado.publico.comportamentos, [{ id: '1' }])
  assert.ok(l.estado._targetingBase, 'perdeu a base do público salvo')
})

test('a data responde "isto e de agora ou de semana passada?"', () => {
  assert.match(quando(horas(2), AGORA), /^hoje às \d\d:\d\d$/)
  assert.match(quando(dias(1), AGORA), /^ontem às /)
  assert.match(quando(dias(12), AGORA), /^\d\d\/\d\d às /)
  assert.equal(quando('data ruim', AGORA), '')
})

test('a linha do historico diz onde parou — so quando ainda da pra continuar', () => {
  const rascunho = linhaDoHistorico({ id: '1', nome: 'A', status: 'rascunho', passo: 2, updated_at: horas(1) }, AGORA)
  assert.equal(rascunho.ondeParou, 'parou no passo 3')
  assert.equal(rascunho.podeContinuar, true)

  const criada = linhaDoHistorico({ id: '2', nome: 'B', status: 'criada', passo: 4, updated_at: horas(1) }, AGORA)
  assert.equal(criada.ondeParou, '')
  assert.equal(criada.podeContinuar, false)
  assert.equal(criada.rotuloStatus, 'Criada')
})

test('a recusa da Meta fica GUARDADA — meses depois ninguem lembra', () => {
  const l = linhaDoHistorico({
    id: '3', nome: 'C', status: 'falhou', updated_at: horas(3),
    resultado: { erro: "This account isn't eligible to use Profile Visit ads yet" },
  }, AGORA)
  assert.equal(l.rotuloStatus, 'A Meta recusou')
  assert.match(l.motivo, /eligible/)
})

test('sem nome nenhum a linha nao fica em branco', () => {
  assert.equal(linhaDoHistorico({ id: '4', status: 'rascunho' }, AGORA).nome, '(sem nome)')
  assert.equal(linhaDoHistorico({ id: '5', estado: { nome: 'Do estado' } }, AGORA).nome, 'Do estado')
})

test('o historico poe primeiro o que ainda da pra fazer algo', () => {
  const h = montarHistorico([
    { id: '1', status: 'criada', updated_at: horas(1) },
    { id: '2', status: 'rascunho', updated_at: horas(5) },
    { id: '3', status: 'falhou', updated_at: horas(2) },
  ], AGORA)
  assert.equal(h[0].id, '2')
  assert.equal(h.length, 3)
})

test('oferece retomar o rascunho MAIS RECENTE, e so se for recente', () => {
  const linhas = [
    { id: 'velho', status: 'rascunho', estado: { nome: 'A' }, updated_at: dias(DIAS_PARA_OFERECER + 1) },
    { id: 'novo', status: 'rascunho', estado: { nome: 'B' }, updated_at: horas(3) },
    { id: 'meio', status: 'rascunho', estado: { nome: 'C' }, updated_at: dias(2) },
    { id: 'criada', status: 'criada', estado: { nome: 'D' }, updated_at: horas(1) },
  ]
  assert.equal(rascunhoParaRetomar(linhas, AGORA).id, 'novo')

  // Um mês depois ninguém lembra do que começou — e recusar toda vez custa um
  // clique a mais para sempre.
  const sóVelho = [linhas[0]]
  assert.equal(rascunhoParaRetomar(sóVelho, AGORA), null)

  // Rascunho vazio não é oferecido: não há o que retomar.
  assert.equal(rascunhoParaRetomar([{ id: 'x', status: 'rascunho', estado: {}, updated_at: horas(1) }], AGORA), null)
})
