import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  textoDoAnuncio, agruparPorTexto, pareceVaga, marcarVagas,
  montarSugestaoDeTexto, linhaDoTexto, MINIMO_DE_RESULTADOS, AVISO_DAS_VAGAS,
} from './sugerir-texto.js'

// OS TEXTOS SÃO REAIS, da conta Vessel — medidos em 03/08/2026 sobre tudo o que
// a conta já rodou. Incluindo o que originou este módulo: os quatro textos mais
// baratos são anúncios de VAGA.
const ANUNCIOS = [
  { id: 'a1', creative: { object_story_spec: { link_data: { message: 'Você é apaixonada por vendas, moda e bolsas? Encontre sua vaga aqui' } } } },
  { id: 'a2', creative: { object_story_spec: { link_data: { message: 'Estamos com vaga aberta para Conselheira de Moda na loja do Shopping' } } } },
  { id: 'a3', creative: { object_story_spec: { video_data: { message: 'Não perca vendas por falta de estoque: garanta os modelos que mais saem' } } } },
  { id: 'a4', creative: { object_story_spec: { link_data: { message: 'Elegância europeia, design que chama atenção' } } } },
  { id: 'a5', creative: { object_story_spec: { link_data: { message: 'Cada Bolsa Uma História!' } } } },
  { id: 'a6', creative: { object_story_spec: { link_data: { message: 'Não perca vendas por falta de estoque: garanta os modelos que mais saem' } } } },
]
const conv = (l) => Number((l.actions || []).find((a) => /messaging_conversation_started/.test(a.action_type))?.value || 0)
const ins = (spend, c, campanha) => ({ spend: String(spend), campaign_name: campanha, actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(c) }] })
const INSIGHTS = {
  a1: ins(92.4, 168, '[RH] Vagas loja'),
  a2: ins(201.9, 98, '[RH] Vagas loja'),
  a3: ins(400, 150, '[ATACADO] Estoque'),
  a4: ins(3879, 21, '[BRANDING] Institucional'),
  a5: ins(801, 11, '[BRANDING] Institucional'),
  a6: ins(260, 100, '[ATACADO] Estoque'),
}

test('o texto sai de imagem, de video ou do corpo do criativo', () => {
  assert.match(textoDoAnuncio(ANUNCIOS[0]), /apaixonada por vendas/)
  assert.match(textoDoAnuncio(ANUNCIOS[2]), /Não perca vendas/)   // video_data
  assert.equal(textoDoAnuncio({ creative: { body: 'do corpo' } }), 'do corpo')
  assert.equal(textoDoAnuncio(null), '')
})

test('agrupa PELO TEXTO, e nao pelo anuncio', () => {
  // O mesmo texto roda em vários anúncios, e é o texto que está sendo julgado.
  const g = agruparPorTexto(ANUNCIOS, INSIGHTS, conv)
  const estoque = g.find((x) => /Não perca vendas/.test(x.texto))
  assert.equal(estoque.anuncios, 2)
  assert.equal(estoque.resultados, 250)
  assert.equal(estoque.custo.toFixed(2), '2.64')
})

test('texto com pouco resultado nao entra na comparacao', () => {
  const poucos = agruparPorTexto([ANUNCIOS[0]], { a1: ins(10, 3) }, conv)
  assert.equal(poucos.length, 0, `abaixo de ${MINIMO_DE_RESULTADOS} não sustenta comparação`)
})

test('reconhece anuncio de VAGA — no texto e no nome da campanha', () => {
  assert.equal(pareceVaga('Estamos com vaga aberta para Vendedora'), true)
  assert.equal(pareceVaga('Trabalhe conosco'), true)
  assert.equal(pareceVaga('Envie seu currículo'), true)
  assert.equal(pareceVaga('50% OFF em bolsas'), false)
  // O nome da campanha entrega mesmo quando o texto não usa a palavra.
  const g = marcarVagas(agruparPorTexto(ANUNCIOS, INSIGHTS, conv))
  const apaixonada = g.find((x) => /apaixonada por vendas/.test(x.texto))
  assert.equal(apaixonada.vaga, true)
})

test('VAGA NAO VIRA MODELO para vender produto — mas nao some', () => {
  // Foi o achado que fez este módulo existir: os textos mais baratos da conta
  // são vagas de emprego (R$ 0,55/conversa). Uma lista crua mandaria escrever
  // anúncio de recrutamento para vender bolsa.
  const s = montarSugestaoDeTexto(agruparPorTexto(ANUNCIOS, INSIGHTS, conv))
  assert.ok(!s.melhores.some((x) => x.vaga), 'vaga entrou como modelo')
  assert.equal(s.vagas.length, 2, 'as vagas sumiram — elas têm que aparecer, marcadas')
  // O melhor comparável é o de atacado, não a vaga.
  assert.match(s.melhores[0].texto, /Não perca vendas/)
})

test('a diferenca entre o melhor e o pior e o argumento inteiro', () => {
  const s = montarSugestaoDeTexto(agruparPorTexto(ANUNCIOS, INSIGHTS, conv))
  // R$ 184,72 contra R$ 2,64 — setenta vezes.
  assert.ok(s.diferenca > 60, `esperava diferença grande, deu ${s.diferenca}`)
})

test('com menos de dois comparaveis, DIZ por que — e nao mostra lista', () => {
  const so1 = montarSugestaoDeTexto(agruparPorTexto([ANUNCIOS[2]], { a3: INSIGHTS.a3 }, conv))
  assert.equal(so1.temAlgo, false)
  assert.match(so1.motivoVazio, new RegExp(`${MINIMO_DE_RESULTADOS} resultados`))
})

test('a linha poe o numero primeiro, porque e ele que ordena', () => {
  const l = linhaDoTexto({ custo: 2.64, resultados: 250, anuncios: 2 })
  assert.match(l, /^R\$\s?2,64 por resultado · 250 resultados · 2 anúncios$/)
  assert.match(linhaDoTexto({ custo: 5, resultados: 1, anuncios: 1 }), /1 resultado$/)
})

test('o aviso das vagas explica POR QUE elas estao separadas', () => {
  assert.match(AVISO_DAS_VAGAS, /não servem de modelo/)
  assert.match(AVISO_DAS_VAGAS, /recrutamento/)
})
