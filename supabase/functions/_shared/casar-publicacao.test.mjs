import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LIMIAR_AUTOMATICO,
  LIMIAR_CONCORRENTE,
  semelhancaDeTexto,
  formatoCombina,
  pontuar,
  casar,
} from './casar-publicacao.js'

// A guarda contra a cópia divergir. casar-publicacao.js tem a própria cópia de
// normalizarParaComparar (o pacote da Edge não leva a pasta do front junto);
// aqui os dois são exercitados lado a lado. Se alguém mexer só num, quebra.
import { normalizarParaComparar } from '../../../src/ferramentas/conteudo/legenda.js'

const HORA = '2026-07-15T21:00:00Z'

test('a normalizacao daqui bate com a do front', () => {
  const casos = [
    'Coleção NOVA 🔥 #vessel @loja',
    'a   b\n\nc',
    'Promoção imperdível! 😍',
    'sem nada especial',
    '',
    'x'.repeat(300),
  ]
  for (const c of casos) {
    // semelhancaDeTexto(x, x) devolve 1 por prefixo; o que se compara aqui é o
    // efeito da normalização: dois textos que o front considera iguais têm que
    // ser iguais aqui também.
    const doFront = normalizarParaComparar(c)
    assert.equal(
      semelhancaDeTexto(c, doFront), doFront ? 1 : 0,
      `a copia divergiu do front em: ${JSON.stringify(c)}`,
    )
  }
})

const peca = (extra = {}) => ({
  id: 'p1', formato: 'feed', publicar_em: HORA,
  legenda: 'Coleção nova chegou na loja', hashtags: '#vessel', ...extra,
})

const midia = (extra = {}) => ({
  id: 'm1', media_type: 'IMAGE', media_product_type: 'FEED',
  timestamp: HORA, caption: 'Coleção nova chegou na loja #vessel', ...extra,
})

// ── Semelhança de texto ─────────────────────────────────────────────────────

test('texto identico vale 1', () => {
  assert.equal(semelhancaDeTexto('bom dia', 'bom dia'), 1)
})

test('so muda emoji, acento e hashtag: continua 1', () => {
  // É o caso real: a legenda é colada no Instagram e alguém acrescenta um emoji.
  assert.equal(semelhancaDeTexto('Promoção! 🔥 #loja', 'promocao!'), 1)
})

test('um texto que comeca com o outro vale 1 (a legenda foi cortada)', () => {
  assert.equal(semelhancaDeTexto('bom dia gente', 'bom dia gente, tudo bem?'), 1)
})

test('textos sem nada a ver ficam perto de zero', () => {
  assert.ok(semelhancaDeTexto('bolsa de couro preta', 'receita de bolo') < 0.3)
})

test('textos parecidos ficam no meio', () => {
  const s = semelhancaDeTexto('coleção nova na loja', 'coleção nova chegou')
  assert.ok(s > 0.3 && s < 1, `esperava meio-termo, veio ${s}`)
})

test('texto vazio nao quebra e nao vale 1', () => {
  assert.equal(semelhancaDeTexto('', ''), 0)
  assert.equal(semelhancaDeTexto('oi', ''), 0)
  assert.equal(semelhancaDeTexto(null, undefined), 0)
})

// ── Compatibilidade de formato ──────────────────────────────────────────────

test('cada formato so casa com o tipo certo de midia', () => {
  assert.equal(formatoCombina('feed', { media_type: 'IMAGE', media_product_type: 'FEED' }), true)
  assert.equal(formatoCombina('reels', { media_type: 'VIDEO', media_product_type: 'REELS' }), true)
  assert.equal(formatoCombina('carrossel', { media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED' }), true)
})

test('reels nao casa com foto do feed, nem carrossel com imagem solta', () => {
  assert.equal(formatoCombina('reels', { media_type: 'IMAGE', media_product_type: 'FEED' }), false)
  assert.equal(formatoCombina('carrossel', { media_type: 'IMAGE', media_product_type: 'FEED' }), false)
  assert.equal(formatoCombina('feed', { media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED' }), false)
})

test('STORY nunca combina com nada', () => {
  // /{ig}/media nao devolve story de forma confiavel (some em 24h). Casar story
  // automaticamente daria falso positivo silencioso — pior que não casar.
  assert.equal(formatoCombina('stories', { media_type: 'IMAGE', media_product_type: 'STORY' }), false)
  assert.equal(formatoCombina('stories', { media_type: 'IMAGE', media_product_type: 'FEED' }), false)
})

// ── Pontuação ───────────────────────────────────────────────────────────────

test('peca e post iguais, na mesma hora: nota quase cheia', () => {
  const r = pontuar(peca(), midia())
  assert.ok(r.total > 0.95, `esperava alto, veio ${r.total}`)
})

test('a legenda pesa mais que o horario', () => {
  // Legenda certa 3h depois vale mais que legenda errada na hora exata.
  const certaMaisTarde = pontuar(peca(), midia({ timestamp: '2026-07-16T00:00:00Z' }))
  const erradaNaHora = pontuar(peca(), midia({ caption: 'nada a ver com isso aqui' }))
  assert.ok(certaMaisTarde.total > erradaNaHora.total)
})

test('post fora da janela de tempo e recusado', () => {
  assert.equal(pontuar(peca(), midia({ timestamp: '2026-07-13T21:00:00Z' })), null)  // 2 dias antes
  assert.equal(pontuar(peca(), midia({ timestamp: '2026-07-17T21:00:00Z' })), null)  // 2 dias depois
})

test('a janela aceita ate 2h antes e 24h depois', () => {
  // Antes: quem publica adiantado. Depois: quem esqueceu e postou no dia seguinte.
  assert.ok(pontuar(peca(), midia({ timestamp: '2026-07-15T19:30:00Z' })), 'devia aceitar 1h30 antes')
  assert.equal(pontuar(peca(), midia({ timestamp: '2026-07-15T18:00:00Z' })), null, 'nao devia aceitar 3h antes')
  assert.ok(pontuar(peca(), midia({ timestamp: '2026-07-16T20:00:00Z' })), 'devia aceitar 23h depois')
})

test('formato incompativel e recusado antes de pontuar', () => {
  assert.equal(pontuar(peca({ formato: 'reels' }), midia()), null)
})

test('peca sem data nao pontua', () => {
  assert.equal(pontuar(peca({ publicar_em: null }), midia()), null)
})

test('o resultado explica o porque, para aparecer na tela', () => {
  const r = pontuar(peca(), midia())
  assert.ok(r.motivo && r.motivo.length > 5)
  assert.ok(!/undefined|NaN/.test(r.motivo))
  assert.ok(r.legenda >= 0 && r.legenda <= 1)
  assert.ok(r.tempo >= 0 && r.tempo <= 1)
})

// ── Casamento ───────────────────────────────────────────────────────────────

test('os limiares sao conservadores', () => {
  assert.ok(LIMIAR_AUTOMATICO >= 0.8)
  assert.ok(LIMIAR_CONCORRENTE < LIMIAR_AUTOMATICO)
})

test('caso limpo: um post obvio casa sozinho', () => {
  const r = casar([peca()], [midia()])
  assert.equal(r.length, 1)
  assert.equal(r[0].situacao, 'automatico')
  assert.equal(r[0].ig_media_id, 'm1')
})

test('dois posts parecidos NAO casam sozinhos: viram sugestao', () => {
  // O caso perigoso. Duas peças com a mesma legenda (ex.: mesma campanha em
  // dias seguidos) fariam o automático vincular a errada em silêncio.
  const r = casar([peca()], [midia(), midia({ id: 'm2', timestamp: '2026-07-15T22:00:00Z' })])
  assert.equal(r.length, 1)
  assert.equal(r[0].situacao, 'sugerido')
})

test('nota baixa vira sugestao, nunca automatico', () => {
  const r = casar([peca()], [midia({ caption: 'outra coisa totalmente diferente' })])
  assert.equal(r[0]?.situacao, 'sugerido')
})

test('cada post do Instagram e usado uma vez so', () => {
  const pecas = [peca(), peca({ id: 'p2', publicar_em: '2026-07-15T21:30:00Z' })]
  const r = casar(pecas, [midia()])
  assert.equal(r.length, 1, 'o mesmo post foi dado a duas peças')
})

test('cada peca recebe no maximo um post', () => {
  const r = casar([peca()], [midia(), midia({ id: 'm2' }), midia({ id: 'm3' })])
  assert.equal(r.filter(x => x.peca_id === 'p1').length, 1)
})

test('o melhor par vence, mesmo fora de ordem na lista', () => {
  const pecas = [
    peca({ id: 'bolsa', legenda: 'bolsa de couro preta' }),
    peca({ id: 'sapato', legenda: 'sapato de salto vermelho' }),
  ]
  const midias = [
    midia({ id: 'mSapato', caption: 'sapato de salto vermelho' }),
    midia({ id: 'mBolsa', caption: 'bolsa de couro preta' }),
  ]
  const r = casar(pecas, midias)
  const porPeca = Object.fromEntries(r.map(x => [x.peca_id, x.ig_media_id]))
  assert.equal(porPeca.bolsa, 'mBolsa')
  assert.equal(porPeca.sapato, 'mSapato')
})

test('post ja vinculado a outra peca e ignorado', () => {
  const r = casar([peca()], [midia()], { jaUsados: ['m1'] })
  assert.deepEqual(r, [])
})

test('story nunca casa, nem com legenda identica', () => {
  const r = casar([peca({ formato: 'stories' })], [midia({ media_product_type: 'STORY' })])
  assert.deepEqual(r, [])
})

test('listas vazias ou nulas devolvem lista vazia', () => {
  assert.deepEqual(casar([], []), [])
  assert.deepEqual(casar(null, null), [])
  assert.deepEqual(casar([peca()], []), [])
})

test('o resultado traz o que a tela precisa mostrar', () => {
  const [r] = casar([peca()], [midia({ permalink: 'https://instagram.com/p/x', thumbnail_url: 'https://t/x.jpg' })])
  assert.equal(r.peca_id, 'p1')
  assert.equal(r.ig_permalink, 'https://instagram.com/p/x')
  assert.equal(r.ig_caption, 'Coleção nova chegou na loja #vessel')
  assert.ok(typeof r.pontuacao === 'number')
  assert.ok(r.ig_timestamp)
})
