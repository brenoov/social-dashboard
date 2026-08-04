import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lerFaixasDeIdade, recomendarIdade, lerConjuntos, recomendarDosConjuntos,
  montarSugestao, MINIMO_DE_RESULTADOS, escolherAcao, contadorDe,
} from './sugerir-publico.js'

// MEDIDO na conta Vessel, 90 dias, 03/08/2026 — copiado da resposta da Meta,
// não inventado. É o dado que originou esta funcionalidade.
const IDADE_REAL = [
  { age: '18-24', spend: '366.39', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '107' }] },
  { age: '25-34', spend: '1206.22', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '149' }] },
  { age: '35-44', spend: '1482.81', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '183' }] },
  { age: '45-54', spend: '2251.04', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '199' }] },
  { age: '55-64', spend: '2093.45', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '153' }] },
  { age: '65+', spend: '1607.76', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '123' }] },
  { age: 'Unknown', spend: '0.29', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' }] },
]
const conversas = (l) => Number((l.actions || []).find((a) => /messaging_conversation_started/.test(a.action_type))?.value || 0)

test('as faixas saem em ordem de idade, com o custo calculado', () => {
  const f = lerFaixasDeIdade(IDADE_REAL, conversas)
  assert.deepEqual(f.map((x) => x.faixa), ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'])
  // 366,39 / 107 = 3,42 — o número que originou tudo isto.
  assert.equal(f[0].custo.toFixed(2), '3.42')
  assert.equal(f[4].custo.toFixed(2), '13.68')
})

test('"Unknown" nao entra: nao da pra segmentar por idade desconhecida', () => {
  assert.ok(!lerFaixasDeIdade(IDADE_REAL, conversas).some((f) => /unknown/i.test(f.faixa)))
})

test('faixa com pouco resultado e MARCADA, e nao escondida', () => {
  // Sumir com ela faria parecer que a faixa não existe.
  const poucos = [{ age: '18-24', spend: '30', actions: [{ action_type: 'x_messaging_conversation_started', value: '3' }] }]
  const f = lerFaixasDeIdade(poucos, conversas)
  assert.equal(f.length, 1)
  assert.equal(f[0].confiavel, false)
})

test('a recomendacao de idade sai do numero real, com o porque junto', () => {
  const r = recomendarIdade(lerFaixasDeIdade(IDADE_REAL, conversas))
  assert.equal(r.idadeMin, 18)
  // 3,42 × 1,5 = 5,13 — só 18–24 fica abaixo disso.
  assert.equal(r.idadeMax, 24)
  assert.match(r.porque, /R\$\s?3,42/)
  // VÍRGULA: a mesma frase escreve "R$ 13,68", e "4.0×" ali no meio era
  // separador decimal de outro idioma.
  assert.match(r.porque, /4,0× mais caro/)
  // O número que dói: o que foi para as faixas caras.
  assert.ok(r.desperdicio > 8000)
  assert.match(r.fraseDoDesperdicio, /últimos 90 dias/)
})

test('diferenca pequena NAO vira recomendacao — apertar publico por ruido e pior', () => {
  const parecidas = [
    { age: '18-24', spend: '100', actions: [{ action_type: 'a_messaging_conversation_started', value: '20' }] },
    { age: '25-34', spend: '110', actions: [{ action_type: 'a_messaging_conversation_started', value: '20' }] },
  ]
  assert.equal(recomendarIdade(lerFaixasDeIdade(parecidas, conversas)), null)
})

test('sem faixa confiavel nenhuma, nao recomenda nada', () => {
  assert.equal(recomendarIdade([]), null)
  assert.equal(recomendarIdade([{ faixa: '18-24', custo: 3, confiavel: true }]), null)
})

// ── Cidades e interesses, pelos conjuntos ──────────────────────────────────

const CONJUNTOS = [
  { id: '1', name: 'bom A', targeting: { geo_locations: { cities: [{ key: '247071', name: 'Campinas' }] }, flexible_spec: [{ interests: [{ id: '6003', name: 'Bolsas' }] }] } },
  { id: '2', name: 'bom B', targeting: { geo_locations: { cities: [{ key: '247071', name: 'Campinas' }, { key: '241913', name: 'Americana' }] }, flexible_spec: [{ interests: [{ id: '6003', name: 'Bolsas' }] }] } },
  { id: '3', name: 'ruim A', targeting: { geo_locations: { cities: [{ key: '999', name: 'Longe' }] }, flexible_spec: [{ interests: [{ id: '7777', name: 'Outra coisa' }] }] } },
  { id: '4', name: 'ruim B', targeting: { geo_locations: { cities: [{ key: '999', name: 'Longe' }] }, flexible_spec: [] } },
]
const INSIGHTS = {
  1: { spend: '100', actions: [{ action_type: 'a_messaging_conversation_started', value: '50' }] },
  2: { spend: '120', actions: [{ action_type: 'a_messaging_conversation_started', value: '40' }] },
  3: { spend: '300', actions: [{ action_type: 'a_messaging_conversation_started', value: '20' }] },
  4: { spend: '400', actions: [{ action_type: 'a_messaging_conversation_started', value: '20' }] },
}

test('conjunto com pouco resultado fica de fora da conta', () => {
  const poucos = { 1: { spend: '10', actions: [{ action_type: 'a_messaging_conversation_started', value: '2' }] } }
  assert.equal(lerConjuntos([CONJUNTOS[0]], poucos, conversas).length, 0)
})

test('a recomendacao vem da METADE mais barata, e nao do melhor sozinho', () => {
  // Um conjunto só pode ter dado certo pelo criativo — aí a cidade dele não
  // explica nada. O que se repete entre os bons é o que vale copiar.
  const r = recomendarDosConjuntos(lerConjuntos(CONJUNTOS, INSIGHTS, conversas))
  assert.deepEqual(r.cidades.map((c) => c.nome), ['Campinas'])
  assert.deepEqual(r.interesses.map((i) => i.nome), ['Bolsas'])
  assert.equal(r.baseadoEm, 2)
  assert.equal(r.deQuantos, 4)
  assert.match(r.porque, /2 conjuntos mais baratos de 4/)
})

test('cidade que aparece uma vez so nao vira recomendacao', () => {
  const r = recomendarDosConjuntos(lerConjuntos(CONJUNTOS, INSIGHTS, conversas))
  assert.ok(!r.cidades.some((c) => c.nome === 'Americana'), 'uma aparição não é padrão')
})

// ── A sugestão inteira ─────────────────────────────────────────────────────

test('a sugestao vem SEMPRE com a evidencia junto', () => {
  const s = montarSugestao({
    faixasDeIdade: lerFaixasDeIdade(IDADE_REAL, conversas),
    conjuntos: lerConjuntos(CONJUNTOS, INSIGHTS, conversas),
  })
  assert.equal(s.temAlgo, true)
  assert.ok(s.idade.porque, 'idade sem o porquê é palpite com cara de número')
  assert.ok(s.porqueDosConjuntos)
  assert.deepEqual(s.cidades.map((c) => c.nome), ['Campinas'])
})

test('sem dado, DIZ por que — e nao so "sem sugestoes"', () => {
  const s = montarSugestao({ faixasDeIdade: [], conjuntos: [] })
  assert.equal(s.temAlgo, false)
  assert.match(s.motivoVazio, new RegExp(`${MINIMO_DE_RESULTADOS} resultados`))
})

// ── Qual resultado contar ──────────────────────────────────────────────────

test('escolhe a acao por VALOR, e nao por volume', () => {
  // Clique sempre ganharia de conversa no volume; julgar por clique premiaria
  // quem compra clique barato, que é o contrário do que se quer.
  const linhas = [{
    actions: [
      { action_type: 'link_click', value: '5000' },
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '40' },
    ],
  }]
  assert.equal(escolherAcao(linhas), 'conversas iniciadas')
})

test('sem conversa, cai para o proximo que existir', () => {
  assert.equal(escolherAcao([{ actions: [{ action_type: 'link_click', value: '10' }] }]), 'cliques no link')
  assert.equal(escolherAcao([{ actions: [{ action_type: 'landing_page_view', value: '3' }] }]), 'visitas que carregaram')
  assert.equal(escolherAcao([{ actions: [] }]), null)
  assert.equal(escolherAcao(null), null)
})

test('o contador soma so a acao escolhida, e ignora as variantes de janela', () => {
  // A Meta manda a mesma conversa em várias janelas de atribuição (_7d, _1d…).
  const conta = contadorDe('conversas iniciadas')
  const n = conta({ actions: [
    { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' },
    { action_type: 'link_click', value: '999' },
  ] })
  assert.equal(n, 10)
  assert.equal(contadorDe('inexistente')({ actions: [] }), 0)
})

test('a frase da idade CONCORDA — "a faixa custa", "as faixas custam"', () => {
  // Visto ao vivo na conta: "a faixa 18-24 custam a partir de R$ 3,42".
  // Texto errado numa tela que pede confiança em número é o pior lugar para
  // economizar cuidado.
  const umaSo = recomendarIdade(lerFaixasDeIdade(IDADE_REAL, conversas))
  assert.match(umaSo.porque, /a faixa 18-24 custa a partir/)
  assert.ok(!/faixa 18-24 custam/.test(umaSo.porque))

  // Duas faixas baratas e uma cara: o plural tem que voltar.
  const duasBaratas = [
    { age: '18-24', spend: '100', actions: [{ action_type: 'a_messaging_conversation_started', value: '50' }] },
    { age: '25-34', spend: '120', actions: [{ action_type: 'a_messaging_conversation_started', value: '50' }] },
    { age: '55-64', spend: '600', actions: [{ action_type: 'a_messaging_conversation_started', value: '50' }] },
  ]
  const varias = recomendarIdade(lerFaixasDeIdade(duasBaratas, conversas))
  assert.match(varias.porque, /as faixas de 18 a 34 anos custam a partir/)
})
