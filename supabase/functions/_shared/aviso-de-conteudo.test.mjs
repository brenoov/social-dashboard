import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HORAS_DE_TOLERANCIA,
  atrasadaDemais,
  montarAvisoDePeca,
  alvosDoAviso,
} from './aviso-de-conteudo.js'

const AGORA = new Date('2026-07-15T21:05:00Z')   // 18h05 BRT

const peca = (extra = {}) => ({
  id: 'p1', titulo: 'Bastidor da loja', formato: 'reels',
  publicar_em: '2026-07-15T21:00:00Z', ...extra,
})

// ── Guarda de atraso ────────────────────────────────────────────────────────

test('a tolerancia e de 12 horas', () => {
  assert.equal(HORAS_DE_TOLERANCIA, 12)
})

test('peca no horario nao esta atrasada', () => {
  assert.equal(atrasadaDemais('2026-07-15T21:00:00Z', AGORA), false)
})

test('peca de 11 horas atras ainda vale o aviso', () => {
  assert.equal(atrasadaDemais('2026-07-15T10:05:00Z', AGORA), false)
})

test('peca de 13 horas atras NAO vira push', () => {
  // Sem isto, o primeiro deploy dispararia um push para cada peça com data no
  // passado — o jeito mais rápido de ensinar alguém a desligar a notificação.
  assert.equal(atrasadaDemais('2026-07-15T08:00:00Z', AGORA), true)
})

test('data ausente ou invalida conta como atrasada (falha fechada)', () => {
  assert.equal(atrasadaDemais(null, AGORA), true)
  assert.equal(atrasadaDemais('nao é data', AGORA), true)
})

// ── O aviso ─────────────────────────────────────────────────────────────────

test('o aviso diz o que fazer, de qual perfil, e leva para a peca', () => {
  const a = montarAvisoDePeca(peca(), { name: 'Vessel' })
  assert.match(a.title, /Bastidor da loja/)
  assert.match(a.body, /Vessel/)
  assert.match(a.body, /Reels/i)
  assert.equal(a.url, '/conteudo/peca/p1')
})

test('a tag e POR PECA, nunca fixa', () => {
  // sw-push.js usa renotify:true. Com tag fixa, duas peças marcadas para a
  // mesma hora se sobrescreveriam e uma delas nunca seria vista.
  const a = montarAvisoDePeca(peca(), { name: 'Vessel' })
  const b = montarAvisoDePeca(peca({ id: 'p2' }), { name: 'Vessel' })
  assert.equal(a.tag, 'conteudo-p1')
  assert.notEqual(a.tag, b.tag)
})

test('peca sem titulo e conta sem nome nao geram texto quebrado', () => {
  const a = montarAvisoDePeca(peca({ titulo: '', formato: 'xpto' }), {})
  assert.ok(!/undefined|null|NaN/.test(a.title + a.body), `texto ruim: ${a.title} / ${a.body}`)
  assert.ok(a.title.length > 3)
})

// ── Quem recebe ─────────────────────────────────────────────────────────────

const sub = (user_id, endpoint = `e-${user_id}`) => ({ user_id, endpoint, p256dh: 'k', auth: 'a' })

const PERFIS = [
  { id: 'u1', role: 'viewer', is_superadmin: false, features: ['conteudo'] },
  { id: 'u2', role: 'viewer', is_superadmin: false, features: ['social'] },      // nao tem a ferramenta
  { id: 'u3', role: 'admin', is_superadmin: false, features: [] },               // admin passa
  { id: 'u4', role: 'viewer', is_superadmin: true, features: [] },               // superadmin passa
]

test('so recebe quem TEM a ferramenta, mesmo querendo o tipo', () => {
  // inscricoesDoTipo sozinha só conhece preferência, não permissão. Sem este
  // cruzamento, quem não pode abrir a peça receberia o aviso com o título dela.
  const subs = [sub('u1'), sub('u2')]
  const prefs = [{ user_id: 'u1', tipo: 'conteudo', ativo: true }, { user_id: 'u2', tipo: 'conteudo', ativo: true }]
  assert.deepEqual(alvosDoAviso(subs, prefs, PERFIS).map(s => s.user_id), ['u1'])
})

test('admin e superadmin recebem sem precisar da feature', () => {
  const subs = [sub('u3'), sub('u4')]
  const prefs = [{ user_id: 'u3', tipo: 'conteudo', ativo: true }, { user_id: 'u4', tipo: 'conteudo', ativo: true }]
  assert.deepEqual(alvosDoAviso(subs, prefs, PERFIS).map(s => s.user_id).sort(), ['u3', 'u4'])
})

test('quem desligou o tipo nao recebe, mesmo tendo a ferramenta', () => {
  const subs = [sub('u1')]
  const prefs = [{ user_id: 'u1', tipo: 'conteudo', ativo: false }]
  assert.deepEqual(alvosDoAviso(subs, prefs, PERFIS), [])
})

test('sem preferencia salva vale o padrao do tipo (conteudo nasce LIGADO)', () => {
  // Diferente de "saldo": quem entra nesta ferramenta entrou para publicar, e o
  // aviso da hora H é a razão de ela existir.
  assert.deepEqual(alvosDoAviso([sub('u1')], [], PERFIS).map(s => s.user_id), ['u1'])
})

test('inscricao sem dono fica de fora', () => {
  assert.deepEqual(alvosDoAviso([sub(null)], [], PERFIS), [])
})

test('perfil desconhecido fica de fora (falha fechada)', () => {
  assert.deepEqual(alvosDoAviso([sub('fantasma')], [], PERFIS), [])
})

test('listas nulas nao quebram', () => {
  assert.deepEqual(alvosDoAviso(null, null, null), [])
})
