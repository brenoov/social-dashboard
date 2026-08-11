import { test } from 'node:test'
import assert from 'node:assert/strict'
import { oQueONivelFaz, temFraseConferida, FRASES, NEUTRO } from './o-que-o-nivel-faz.js'

test('a frase diz o que a pessoa CONSEGUE e o que NAO consegue', () => {
  const f = oQueONivelFaz('frota', 'mexer')
  assert.match(f, /checklist/i)
  assert.match(f, /não cadastra/i)
})

test('o mesmo degrau em ferramentas diferentes NAO da a mesma frase', () => {
  // E o defeito que motivou tudo: "Ver e mexer" na Frota e pegar carro;
  // na Gestao de Trafego e mexer em orcamento que esta gastando agora.
  assert.notEqual(oQueONivelFaz('frota', 'mexer'), oQueONivelFaz('meta.gestor', 'mexer'))
})

test('ferramenta sem frase conferida cai no texto neutro, e nao inventa nada', () => {
  // A garantia real: quando nao ha frase conferida, a tela usa o texto que
  // descreve o EFEITO DO NIVEL (verdade em qualquer ferramenta) e nunca um
  // texto sobre aquela ferramenta. Comparar com o proprio NEUTRO e mais
  // preciso que farejar palavras: "apaga" e generico e legitimo, "cadastra
  // veiculo" nao seria.
  assert.equal(temFraseConferida('escritorio3d'), false)
  assert.equal(oQueONivelFaz('escritorio3d', 'tudo'), NEUTRO.tudo)
  assert.equal(oQueONivelFaz('escritorio3d', 'sem'), NEUTRO.sem)
  assert.ok(oQueONivelFaz('escritorio3d', 'tudo').length > 0, 'nunca devolve vazio')
})

test('"sem acesso" fala do MENU, que e o efeito visivel', () => {
  assert.match(oQueONivelFaz('frota', 'sem'), /não aparece/i)
})

test('recurso desconhecido nao estoura', () => {
  assert.ok(oQueONivelFaz('inventado', 'tudo').length > 0)
  assert.ok(oQueONivelFaz(null, null).length > 0)
})

test('as frases batem com os degraus que a ferramenta REALMENTE tem', async () => {
  // O teste antigo so olhava para dentro de FRASES: nao pegava frase de um
  // degrau inexistente (meta.gestor nao tem "tudo") nem frase faltando num
  // degrau que existe. Sem cruzar com o catalogo, ele valida so a coerencia
  // do proprio erro.
  globalThis.window = { supabase: { createClient: () => ({}) } }
  const { RECURSOS } = await import('../../compartilhado/controle-de-login-e-usuario.js')
  const { degrausDoRecurso } = await import('./niveis-de-permissao.js')

  for (const [chave, porDegrau] of Object.entries(FRASES)) {
    const recurso = RECURSOS.find((r) => r.key === chave)
    assert.ok(recurso, `${chave} tem frase e nao existe em RECURSOS`)
    const reais = new Set(degrausDoRecurso(recurso).map((d) => d.chave))

    for (const escrito of Object.keys(porDegrau)) {
      assert.ok(reais.has(escrito),
        `${chave}.${escrito}: frase para um degrau que a tela nunca oferece`)
    }
    for (const real of reais) {
      assert.ok(porDegrau[real],
        `${chave}.${real}: degrau existe e ficou sem frase — cairia no texto neutro no meio de uma ferramenta conferida`)
    }
  }
})
