import test from 'node:test'
import assert from 'node:assert/strict'
import {
  falaDoTake, rotuloDoPasso, duracaoTotalEmSegundos, montarRoteiroParaCopiar,
  ideiaEmBranco, limparParaGravar,
} from './roteiro.js'

const IDEIA = {
  titulo: 'Quem é Breno Vale em 30 segundos',
  formato: 'reels',
  gancho: 'Se a gente nunca se falou, presta atenção nesses 30 segundos.',
  producao: 'Um canto com luz de janela, celular na altura do peito.',
  roteiro: [
    { cena: 1, imagem: 'Peito pra cima, parede lisa atrás.', narracao: 'Se a gente nunca se falou…', duracao_s: 4 },
    { cena: 2, imagem: 'Andando pela sala.', narracao: 'Eu ajudo pessoa comum a construir marca.', texto_na_tela: 'sem fórmula mágica', duracao_s: 8 },
  ],
  legenda_sugerida: 'Comecei do zero mais de uma vez.',
  cta: 'Me segue pra não perder os próximos.',
  hashtags_sugeridas: '#marcapessoal #empreendedorismo',
}

// ---------- compatibilidade com o formato antigo ----------
// As ideias geradas antes do roteiro completo usam `fala`. Elas continuam no
// banco; se a tela lesse só `narracao`, sumiriam sem erro nenhum.

test('le a narracao no formato novo', () => {
  assert.equal(falaDoTake({ narracao: 'olha isso' }), 'olha isso')
})

test('le `fala` das ideias antigas', () => {
  assert.equal(falaDoTake({ fala: 'texto antigo' }), 'texto antigo')
})

test('narracao vence quando os dois existem', () => {
  assert.equal(falaDoTake({ narracao: 'nova', fala: 'velha' }), 'nova')
})

test('narracao so de espacos cai para `fala`', () => {
  assert.equal(falaDoTake({ narracao: '   ', fala: 'velha' }), 'velha')
})

test('take sem fala nenhuma devolve vazio, nunca undefined', () => {
  for (const t of [{}, null, undefined, { imagem: 'so imagem' }, { narracao: 42 }]) {
    assert.equal(falaDoTake(t), '')
  }
})

// ---------- rotulos por formato ----------

test('o passo muda de nome conforme o formato', () => {
  assert.equal(rotuloDoPasso(3, 'reels'), 'takes')
  assert.equal(rotuloDoPasso(3, 'stories'), 'takes')
  assert.equal(rotuloDoPasso(3, 'carrossel'), 'cards')
  assert.equal(rotuloDoPasso(1, 'carrossel'), 'card')
  assert.equal(rotuloDoPasso(1, 'feed'), 'imagem')
})

// ---------- duracao ----------

test('soma a duracao dos takes', () => {
  assert.equal(duracaoTotalEmSegundos(IDEIA.roteiro), 12)
})

test('duracao ausente ou suja conta como zero, nao vira NaN', () => {
  assert.equal(duracaoTotalEmSegundos([{ duracao_s: 5 }, {}, { duracao_s: 'abc' }, null]), 5)
  assert.equal(duracaoTotalEmSegundos(null), 0)
})

// ---------- o texto copiado ----------
// É o caminho real de uso: copiar, colar no WhatsApp, ler do celular gravando.

test('o roteiro copiado tem tudo que a pessoa precisa para gravar', () => {
  const txt = montarRoteiroParaCopiar(IDEIA)
  assert.match(txt, /QUEM É BRENO VALE EM 30 SEGUNDOS/)
  assert.match(txt, /OS 3 PRIMEIROS SEGUNDOS/)
  assert.match(txt, /ANTES DE GRAVAR/)
  assert.match(txt, /TAKES/)
  assert.match(txt, /Imagem: Peito pra cima/)
  assert.match(txt, /Fala: "Eu ajudo pessoa comum/)
  assert.match(txt, /Na tela: sem fórmula mágica/)
  assert.match(txt, /Chamada: Me segue/)
  assert.match(txt, /#marcapessoal/)
})

test('o texto copiado nunca sai com undefined nem [object Object]', () => {
  for (const ideia of [
    {},
    { titulo: 'so titulo' },
    { roteiro: [{}, null] },
    { roteiro: [{ cena: 1, imagem: 'x' }], legenda_sugerida: '' },
    IDEIA,
  ]) {
    const txt = montarRoteiroParaCopiar(ideia)
    assert.ok(!/undefined|null|NaN|\[object/.test(txt), `texto sujo: ${txt}`)
  }
})

test('ideia vazia devolve texto vazio em vez de cabecalho solto', () => {
  assert.equal(montarRoteiroParaCopiar({}), '')
  assert.equal(montarRoteiroParaCopiar(), '')
})

test('take sem numero usa a posicao na lista', () => {
  const txt = montarRoteiroParaCopiar({ roteiro: [{ imagem: 'a' }, { imagem: 'b' }] })
  assert.match(txt, /^1\.$/m)
  assert.match(txt, /^2\.$/m)
})

test('o roteiro copiado usa o rotulo do formato certo', () => {
  assert.match(montarRoteiroParaCopiar({ formato: 'carrossel', roteiro: [{ imagem: 'a' }] }), /^CARD$/m)
  assert.match(montarRoteiroParaCopiar({ formato: 'reels', roteiro: [{ imagem: 'a' }, { imagem: 'b' }] }), /^TAKES$/m)
})

test('ideia no formato antigo continua copiavel', () => {
  const txt = montarRoteiroParaCopiar({
    titulo: 'Ideia velha', formato: 'reels',
    roteiro: [{ cena: 1, fala: 'o que se falava antes' }],
  })
  assert.match(txt, /Fala: "o que se falava antes"/)
})

// ---------- escrever uma ideia à mão ----------

test('ideiaEmBranco devolve tudo string, nunca null', () => {
  // `v-model` num campo de texto com null escreve a palavra "null" no campo.
  const r = ideiaEmBranco()
  for (const [chave, valor] of Object.entries(r)) {
    if (chave === 'roteiro') { assert.ok(Array.isArray(valor)); continue }
    assert.equal(typeof valor, 'string', `${chave} nao e string: ${valor}`)
  }
})

test('ideiaEmBranco copia uma ideia existente inteira', () => {
  const r = ideiaEmBranco(IDEIA)
  assert.equal(r.titulo, IDEIA.titulo)
  assert.equal(r.gancho, IDEIA.gancho)
  assert.equal(r.roteiro.length, 2)
  assert.equal(r.roteiro[1].texto_na_tela, 'sem fórmula mágica')
})

test('editar ideia ANTIGA nao apaga o que ela tinha escrito', () => {
  // O formato velho usa `fala`; sem ler os dois, abrir para editar apagaria.
  const r = ideiaEmBranco({ titulo: 'velha', roteiro: [{ cena: 1, fala: 'o texto antigo' }] })
  assert.equal(r.roteiro[0].narracao, 'o texto antigo')
})

test('ideiaEmBranco NAO compartilha o roteiro com a original', () => {
  // Sem copia profunda, editar um take mexeria no objeto que a lista de tras
  // esta mostrando.
  const original = { roteiro: [{ cena: 1, imagem: 'antes' }] }
  const r = ideiaEmBranco(original)
  r.roteiro[0].imagem = 'depois'
  assert.equal(original.roteiro[0].imagem, 'antes')
})

test('limparParaGravar troca texto vazio por null', () => {
  const g = limparParaGravar({ titulo: 'X', gancho: '   ', cta: '' })
  assert.equal(g.titulo, 'X')
  assert.equal(g.gancho, null)
  assert.equal(g.cta, null)
})

test('limparParaGravar descarta take totalmente vazio', () => {
  const g = limparParaGravar({
    titulo: 'X',
    roteiro: [
      { cena: 1, imagem: 'tem', narracao: '', texto_na_tela: '' },
      { cena: 2, imagem: '', narracao: '  ', texto_na_tela: '' },
      { cena: 3, imagem: '', narracao: 'so fala', texto_na_tela: '' },
    ],
  })
  assert.equal(g.roteiro.length, 2, 'o take vazio do meio some')
  assert.deepEqual(g.roteiro.map(t => t.cena), [1, 2], 'e a numeracao e refeita')
})

test('limparParaGravar renumera pela ordem final', () => {
  const g = limparParaGravar({
    titulo: 'X',
    roteiro: [{ cena: 9, imagem: 'a' }, { cena: 3, imagem: 'b' }],
  })
  assert.deepEqual(g.roteiro.map(t => t.cena), [1, 2])
})

test('duracao invalida vira null, nunca NaN', () => {
  const g = limparParaGravar({ titulo: 'X', roteiro: [{ imagem: 'a', duracao_s: 'abc' }] })
  assert.equal(g.roteiro[0].duracao_s, null)
})

test('limparParaGravar aguenta rascunho vazio', () => {
  for (const v of [undefined, null, {}, { roteiro: null }]) {
    const g = limparParaGravar(v)
    assert.equal(g.titulo, '')
    assert.deepEqual(g.roteiro, [])
  }
})

test('o que sai de limparParaGravar volta legivel em montarRoteiroParaCopiar', () => {
  // Ida e volta: escrever à mão e copiar tem que dar o mesmo tipo de texto que
  // uma ideia da IA.
  const g = limparParaGravar(ideiaEmBranco(IDEIA))
  const txt = montarRoteiroParaCopiar(g)
  assert.match(txt, /OS 3 PRIMEIROS SEGUNDOS/)
  assert.match(txt, /Fala: "Eu ajudo pessoa comum/)
  assert.ok(!/undefined|null|NaN/.test(txt), txt)
})
