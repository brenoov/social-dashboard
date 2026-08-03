import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOGO, GRUPOS, acharSubobjetivo, marcarUsados, bloqueio, podeSerCriado,
  pedeNumeroDeWhatsapp, pedeEnderecoDoSite, CRIATIVO_PUBLICACAO,
} from './subobjetivos.js'

// Os conjuntos como a Meta os devolve — copiados da medição real de 03/08/2026
// nas cinco contas, e não inventados.
const CONJUNTOS_REAIS = [
  ...Array(57).fill({ campaign: { objective: 'OUTCOME_TRAFFIC' }, optimization_goal: 'PROFILE_VISIT', destination_type: 'INSTAGRAM_PROFILE' }),
  ...Array(42).fill({ campaign: { objective: 'OUTCOME_ENGAGEMENT' }, optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP' }),
  ...Array(30).fill({ campaign: { objective: 'OUTCOME_LEADS' }, optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP' }),
  ...Array(24).fill({ campaign: { objective: 'OUTCOME_ENGAGEMENT' }, optimization_goal: 'POST_ENGAGEMENT', destination_type: 'ON_POST' }),
  ...Array(4).fill({ campaign: { objective: 'OUTCOME_TRAFFIC' }, optimization_goal: 'LINK_CLICKS', destination_type: 'UNDEFINED' }),
  { campaign: { objective: 'OUTCOME_ENGAGEMENT' }, optimization_goal: 'THRUPLAY', destination_type: 'ON_VIDEO' },
]

test('o catalogo cobre o que as contas MAIS rodam, e nao so as 4 receitas antigas', () => {
  // O gatilho desta funcionalidade: a combinação mais usada do negócio inteiro
  // (57 conjuntos, nas cinco contas) não podia ser criada pela tela.
  const marcado = marcarUsados(CATALOGO, CONJUNTOS_REAIS)
  const perfil = marcado.find((s) => s.id === 'visita-perfil')
  assert.equal(perfil.usos, 57)

  const whats = marcado.find((s) => s.id === 'conversa-whatsapp')
  assert.equal(whats.usos, 42)
})

test('conversa no WhatsApp por ENGAJAMENTO e por CADASTROS sao contadas separado', () => {
  // Não é detalhe: 30 conjuntos rodam como OUTCOME_LEADS e estavam sendo
  // chamados de "Engajamento". A Meta entrega para perfis diferentes.
  const m = marcarUsados(CATALOGO, CONJUNTOS_REAIS)
  assert.equal(m.find((s) => s.id === 'conversa-whatsapp').usos, 42)
  assert.equal(m.find((s) => s.id === 'conversa-whatsapp-cadastros').usos, 30)
})

test('UNDEFINED da Meta e destino vazio do catalogo sao a MESMA coisa', () => {
  // A Meta devolve "UNDEFINED" onde guardamos null. Sem normalizar, "Cliques
  // para o site" nunca casaria com os 4 conjuntos que existem.
  const m = marcarUsados(CATALOGO, CONJUNTOS_REAIS)
  assert.equal(m.find((s) => s.id === 'site-cliques').usos, 4)
})

test('o que a conta nunca rodou fica com zero, e nao some', () => {
  const m = marcarUsados(CATALOGO, CONJUNTOS_REAIS)
  const messenger = m.find((s) => s.id === 'conversa-todos')
  assert.equal(messenger.usos, 0)
  assert.equal(m.length, CATALOGO.length, 'marcar não pode filtrar — a lista é fixa')
})

test('conta nova (sem conjunto nenhum) ainda ve o catalogo inteiro', () => {
  // É a razão de o catálogo ser fixo em vez de vir do que a conta usou.
  const m = marcarUsados(CATALOGO, [])
  assert.equal(m.length, CATALOGO.length)
  assert.ok(m.every((s) => s.usos === 0))
})

test('todo grupo do catalogo esta na ordem de exibicao, e vice-versa', () => {
  const usados = [...new Set(CATALOGO.map((s) => s.grupo))]
  assert.deepEqual(usados.slice().sort(), GRUPOS.slice().sort())
})

test('todo item tem rotulo e explicacao em portugues, sem sigla da Meta', () => {
  for (const s of CATALOGO) {
    assert.ok(s.rotulo && s.rotulo.length > 3, `${s.id} sem rótulo`)
    assert.ok(s.explicacao && s.explicacao.length > 25, `${s.id} sem explicação de verdade`)
    assert.ok(!/OUTCOME_|_GOAL|OFFSITE|THRUPLAY|LINK_CLICKS/.test(s.rotulo), `${s.id}: sigla da Meta no rótulo`)
  }
})

test('todo id e unico — senao a escolha da tela pega o item errado', () => {
  const ids = CATALOGO.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length)
})

// ── O que ainda não dá para criar ───────────────────────────────────────────

test('impulsionar publicacao aparece, mas BLOQUEADO e com o motivo', () => {
  // Medido: os anúncios de ON_POST e INSTAGRAM_PROFILE não têm imagem própria —
  // carregam effective_object_story_id apontando para um post real.
  for (const id of ['visita-perfil', 'engajamento-post', 'video-thruplay']) {
    const s = acharSubobjetivo(id)
    assert.equal(s.criativo, CRIATIVO_PUBLICACAO)
    assert.equal(podeSerCriado(s), false)
    assert.match(bloqueio(s), /publicação que já está no perfil/)
  }
})

test('conversao no site pede pixel, e o motivo diz isso', () => {
  const s = acharSubobjetivo('site-conversao')
  assert.match(bloqueio(s), /pixel/)
})

test('o que DA para criar hoje nao tem bloqueio nenhum', () => {
  const criaveis = CATALOGO.filter(podeSerCriado).map((s) => s.id)
  assert.deepEqual(criaveis, [
    'conversa-whatsapp', 'conversa-whatsapp-cadastros', 'conversa-whatsapp-vendas',
    'conversa-direct', 'conversa-todos',
    'site-cliques', 'site-visitas',
    'alcance', 'lembranca',
  ])
})

// ── O que cada um pergunta a mais ───────────────────────────────────────────

test('so quem leva pro WhatsApp pede numero', () => {
  assert.equal(pedeNumeroDeWhatsapp(acharSubobjetivo('conversa-whatsapp')), true)
  assert.equal(pedeNumeroDeWhatsapp(acharSubobjetivo('conversa-direct')), false)
  assert.equal(pedeNumeroDeWhatsapp(acharSubobjetivo('alcance')), false)
})

test('so quem leva pro site pede endereco', () => {
  assert.equal(pedeEnderecoDoSite(acharSubobjetivo('site-cliques')), true)
  assert.equal(pedeEnderecoDoSite(acharSubobjetivo('site-visitas')), true)
  assert.equal(pedeEnderecoDoSite(acharSubobjetivo('conversa-whatsapp')), false)
})

test('acharSubobjetivo devolve null pro que nao existe, sem estourar', () => {
  assert.equal(acharSubobjetivo('nao-existe'), null)
  assert.equal(acharSubobjetivo(''), null)
  assert.equal(acharSubobjetivo(undefined), null)
})
