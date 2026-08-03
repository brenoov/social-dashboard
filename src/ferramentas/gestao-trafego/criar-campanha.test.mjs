import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSOS, estadoInicial, faltaNoPasso, podeAvancar, primeiroPassoIncompleto,
  imagemServe, resumoDoQueVaiSerCriado, payloadsDoAssistente, publicoParaFabrica,
  LADO_MINIMO_PX, ORCAMENTO_MINIMO_CENTAVOS,
} from './criar-campanha.js'

const cheio = () => ({
  ...estadoInicial(),
  objetivo: 'engajamento', nome: 'Bolsas — Campinas',
  publico: { cidades: [{ key: '267873', nome: 'Campinas', raio: 20, unidade: 'kilometer' }], idadeMin: 25, idadeMax: 45, interesses: [{ id: '6003', name: 'Bolsas' }] },
  imagemHash: 'abc123', texto: 'Bolsas com 30% OFF',
})

test('sao quatro passos, na ordem da decisao', () => {
  assert.deepEqual(PASSOS.map((p) => p.chave), ['objetivo', 'orcamento', 'publico', 'anuncio'])
})

test('o estado novo nao avanca em nada — e diz o que falta, em portugues', () => {
  const e = estadoInicial()
  assert.match(faltaNoPasso('objetivo', e)[0], /Escolha o que você quer/)
  assert.match(faltaNoPasso('anuncio', e)[0], /Escolha uma imagem/)
  assert.equal(podeAvancar('objetivo', e), false)
})

test('nome vazio segura o passo 1 — sem nome ninguem acha a campanha depois', () => {
  const e = { ...estadoInicial(), objetivo: 'engajamento' }
  assert.equal(podeAvancar('objetivo', e), false)
  assert.ok(faltaNoPasso('objetivo', e).some((f) => /nome/i.test(f)))
})

test('orcamento abaixo do minimo e barrado ANTES de a Meta recusar', () => {
  const e = { ...cheio(), orcamentoCentavos: ORCAMENTO_MINIMO_CENTAVOS - 1 }
  assert.match(faltaNoPasso('orcamento', e)[0], /não aceita menos de/)
  assert.equal(podeAvancar('orcamento', { ...cheio(), orcamentoCentavos: ORCAMENTO_MINIMO_CENTAVOS }), true)
})

test('sem lugar nao avanca — e a Meta EXIGE lugar', () => {
  const e = { ...cheio(), publico: { cidades: [] } }
  assert.match(faltaNoPasso('publico', e)[0], /pelo menos uma cidade ou região/)
  // Região ou país também servem: o editor gerencia cidade, mas o conjunto pode
  // ter outras localidades que ele preserva sem desenhar.
  assert.equal(podeAvancar('publico', { ...cheio(), publico: { cidades: [], outrasLocalizacoes: [{ tipo: 'pais' }] } }), true)
})

test('primeiroPassoIncompleto aponta ONDE parar, nao so que falta algo', () => {
  assert.equal(primeiroPassoIncompleto(estadoInicial()), 'objetivo')
  assert.equal(primeiroPassoIncompleto({ ...cheio(), imagemHash: '' }), 'anuncio')
  assert.equal(primeiroPassoIncompleto(cheio()), null)
})

// ── A imagem, conferida ANTES de subir ──────────────────────────────────────

test('imagem pequena e barrada no navegador, antes do envio', () => {
  // Medido: um PNG de 95 bytes voltou 100/2446496 da Meta. Descobrir isso depois
  // de esperar o upload é o pior momento possível.
  const r = imagemServe({ bytes: 95, largura: 8, altura: 8 })
  assert.equal(r.ok, false)
  assert.equal(r.problemas.length, 2)
  assert.match(r.problemas[1], new RegExp(`${LADO_MINIMO_PX}×${LADO_MINIMO_PX}`))
})

test('imagem boa passa', () => {
  assert.equal(imagemServe({ bytes: 104223, largura: 600, altura: 600 }).ok, true)
})

test('o que nao se sabe NAO vira acusacao', () => {
  // Nem todo navegador entrega dimensão de todo formato. Faltar dado não pode
  // barrar uma imagem que talvez esteja boa.
  assert.equal(imagemServe({}).ok, true)
  assert.equal(imagemServe({ bytes: 500000 }).ok, true)
})

// ── O resumo da confirmação ────────────────────────────────────────────────

test('o resumo lista o que vai ser criado, com nome de gente', () => {
  const l = resumoDoQueVaiSerCriado(cheio(), 'Conversas no WhatsApp')
  assert.match(l[0], /"Bolsas — Campinas" — Conversas no WhatsApp/)
  assert.match(l[1], /1 conjunto com R\$\s?50,00 por dia/)
  assert.ok(l.some((x) => /Em Campinas/.test(x)))
  assert.ok(l.some((x) => /Idade 25–45/.test(x)))
  assert.ok(l.some((x) => /Interesses: Bolsas/.test(x)))
})

// ── A tradução entre o editor e a Fábrica ──────────────────────────────────

test('traduz a cidade do editor para a forma da Fabrica', () => {
  const f = publicoParaFabrica(cheio().publico, {})
  assert.deepEqual(f.geo.cities, [{ key: '267873', radius: 20, distance_unit: 'kilometer' }])
  assert.deepEqual(f.interesses, [{ id: '6003', name: 'Bolsas' }])
})

test('cidade inteira (raio 0) vai SEM radius — nao inventa um raio', () => {
  const f = publicoParaFabrica({ cidades: [{ key: '1', raio: 0 }] }, {})
  assert.deepEqual(f.geo.cities, [{ key: '1' }])
})

// ── O payload final ────────────────────────────────────────────────────────

const ROW = { chave: 'engajamento', rotulo: 'Conversas', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'page' }
const MARCA = { nome: 'La Vessel', pageId: '324679337390168', igId: '17841462952561833' }
const LOJA = { nome: 'Tivoli', geoCities: ['267873'], whatsapp: '5519999999999' }

test('o payload sai do montador COMPARTILHADO, com os campos que a Meta exige', () => {
  // Os dois campos abaixo foram justamente os que faltaram nas recusas 4834011 e
  // 1870227 quando eu escrevi payload próprio. Vêm de graça ao reusar.
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, marca: MARCA, loja: LOJA })
  assert.equal(campaign.objective, 'OUTCOME_ENGAGEMENT')
  assert.equal(campaign.status, 'PAUSED')
  assert.equal(campaign.is_adset_budget_sharing_enabled, false)
  assert.equal(adset.status, 'PAUSED')
  assert.equal(adset.destination_type, 'WHATSAPP')
  assert.ok(adset.targeting)
})

test('o nome DIGITADO manda sobre o nome automatico', () => {
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, marca: MARCA, loja: LOJA })
  assert.equal(campaign.name, 'Bolsas — Campinas')
  assert.match(adset.name, /^Bolsas — Campinas · conjunto$/)
})

test('tudo nasce PAUSED — a promessa que garante que nada gasta', () => {
  const { campaign, adset } = payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, marca: MARCA, loja: LOJA })
  assert.equal(campaign.status, 'PAUSED')
  assert.equal(adset.status, 'PAUSED')
})

test('sem objetivo, marca ou loja nao monta payload nenhum', () => {
  assert.equal(payloadsDoAssistente({ estado: cheio(), objetivoRow: null, marca: MARCA, loja: LOJA }), null)
  assert.equal(payloadsDoAssistente({ estado: cheio(), objetivoRow: ROW, marca: null, loja: LOJA }), null)
})
