import test from 'node:test'
import assert from 'node:assert/strict'
import {
  falaDoTake, rotuloDoPasso, duracaoTotalEmSegundos, montarRoteiroParaCopiar,
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
