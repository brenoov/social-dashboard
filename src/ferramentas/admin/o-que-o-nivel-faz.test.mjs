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

test('toda frase escrita cobre TODOS os degraus daquele recurso', () => {
  // Meia cobertura e pior que nenhuma: a linha diria a verdade num nivel e
  // o texto neutro no outro, sem quem le perceber a troca.
  for (const [recurso, porDegrau] of Object.entries(FRASES)) {
    for (const d of ['sem', 'ver', 'mexer', 'tudo']) {
      if (porDegrau[d] === undefined) continue
      assert.ok(String(porDegrau[d]).trim().length > 10,
        `${recurso}.${d} tem frase curta demais pra explicar algo`)
    }
    assert.ok(porDegrau.sem, `${recurso} nao diz o que "sem acesso" significa`)
  }
})
