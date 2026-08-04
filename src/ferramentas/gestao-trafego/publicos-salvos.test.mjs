import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoDoSalvo, cidadesDoSalvo, trazLocalizacao, lerSalvos } from './publicos-salvos.js'
import { lerPublico } from './publico-alvo.js'

// Copiado da medição real na conta Vessel, 03/08/2026 — não inventado.
const SALVO_REAL = {
  id: '120210459025900342',
  name: 'Público La Vessel',
  targeting: {
    age_min: 25, age_max: 65, genders: [0],
    geo_locations: {
      cities: [
        { key: '241913', name: 'Americana', country: 'BR', distance_unit: 'mile' },
        { key: '247071', name: 'Campinas', country: 'BR', distance_unit: 'mile' },
        { key: '254719', name: 'Hortolândia', country: 'BR', distance_unit: 'mile' },
      ],
    },
    flexible_spec: [{
      interests: [
        { id: '6003198476967', name: 'Bolsas (acessórios)' },
        { id: '6007828099136', name: 'Bens de luxo (varejo)' },
      ],
      behaviors: [
        { id: '6071631541183', name: 'Engaged Shoppers' },
        { id: '6002714895372', name: 'Frequent Travelers' },
      ],
    }],
  },
}

test('o resumo diz o que o publico TRAZ, e nao so o nome dele', () => {
  // Nomes como "[PÚBLICOSALVO][NÃO SEGUIDORES][COM INTERESSES][BR]" não dizem
  // nada sobre o que vai ser aplicado.
  const r = resumoDoSalvo(SALVO_REAL.targeting)
  assert.match(r, /3 cidades/)
  assert.match(r, /25–65 anos/)
  assert.match(r, /2 interesses/)
  assert.match(r, /2 comportamentos/)
})

test('publico sem localizacao DIZ que nao tem', () => {
  assert.match(resumoDoSalvo({ age_min: 18 }), /sem localização/)
  assert.equal(trazLocalizacao({ age_min: 18 }), false)
  assert.equal(trazLocalizacao(SALVO_REAL.targeting), true)
})

test('as cidades saem por NOME — e e essa a resposta pra reclamacao original', () => {
  // "o público salvo já tem localização e você pede de novo".
  assert.deepEqual(cidadesDoSalvo(SALVO_REAL.targeting), ['Americana', 'Campinas', 'Hortolândia'])
})

test('publico salvo SEM targeting some da lista, em vez de nao fazer nada', () => {
  const lidos = lerSalvos([SALVO_REAL, { id: '9', name: 'quebrado' }, null])
  assert.equal(lidos.length, 1)
  assert.equal(lidos[0].nome, 'Público La Vessel')
  assert.equal(lidos[0].temLocalizacao, true)
})

test('o publico salvo entra INTEIRO no editor — inclusive os comportamentos', () => {
  // O QUE ISTO IMPEDE: aplicar um público salvo e perder os comportamentos em
  // silêncio. Um público sem eles é um público DIFERENTE, mais largo — e não é
  // o que a pessoa escolheu.
  const p = lerPublico(SALVO_REAL.targeting)
  assert.deepEqual(p.cidades.map((c) => c.nome), ['Americana', 'Campinas', 'Hortolândia'])
  assert.equal(p.idadeMin, 25)
  assert.equal(p.idadeMax, 65)
  assert.deepEqual(p.interesses.map((i) => i.name), ['Bolsas (acessórios)', 'Bens de luxo (varejo)'])
  assert.deepEqual(p.comportamentos.map((b) => b.name), ['Engaged Shoppers', 'Frequent Travelers'])
})

test('sem comportamento nenhum a lista fica vazia, e nao undefined', () => {
  const p = lerPublico({ age_min: 20 })
  assert.deepEqual(p.comportamentos, [])
})
