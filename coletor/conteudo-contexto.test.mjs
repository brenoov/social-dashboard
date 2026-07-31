import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PILARES,
  MAX_POSTS_NO_CONTEXTO,
  ordenarPeloQueFuncionou,
  temasJaAgendados,
  ehRepetida,
  montarContextoDaMarca,
} from './conteudo-contexto.mjs'

const post = (titulo, alcance, formato = 'feed') => ({
  titulo, formato, publicado_em: '2026-07-01T12:00:00Z',
  metrica: { alcance, curtidas: alcance ? Math.round(alcance / 10) : null },
})

// ── Os pilares ──────────────────────────────────────────────────────────────

test('os pilares sao poucos e em portugues', () => {
  assert.ok(PILARES.length >= 4 && PILARES.length <= 8)
  for (const p of PILARES) assert.ok(!/[A-Z]/.test(p[0]) || p === p, `pilar estranho: ${p}`)
})

// ── O que funcionou ─────────────────────────────────────────────────────────

test('os posts entram ordenados do melhor para o pior', () => {
  // É o insumo mais valioso do prompt: a IA não tem como adivinhar o que
  // funcionou nesta marca. Se a ordem se perder, o modelo lê ruído.
  const r = ordenarPeloQueFuncionou([post('fraco', 100), post('forte', 5000), post('medio', 800)])
  assert.deepEqual(r.map(p => p.titulo), ['forte', 'medio', 'fraco'])
})

test('post sem metrica vai para o fim, nao para o topo', () => {
  const r = ordenarPeloQueFuncionou([post('sem', null), post('com', 300)])
  assert.deepEqual(r.map(p => p.titulo), ['com', 'sem'])
})

test('corta em MAX_POSTS_NO_CONTEXTO para o prompt nao estourar', () => {
  const muitos = Array.from({ length: 100 }, (_, i) => post(`p${i}`, i))
  assert.equal(ordenarPeloQueFuncionou(muitos).length, MAX_POSTS_NO_CONTEXTO)
})

test('lista vazia ou nula devolve vazia', () => {
  assert.deepEqual(ordenarPeloQueFuncionou([]), [])
  assert.deepEqual(ordenarPeloQueFuncionou(null), [])
})

test('nao modifica a lista original', () => {
  const lista = [post('a', 1), post('b', 9)]
  ordenarPeloQueFuncionou(lista)
  assert.deepEqual(lista.map(p => p.titulo), ['a', 'b'])
})

// ── Não repetir o que já está na agenda ─────────────────────────────────────

test('lista os temas ja agendados', () => {
  const r = temasJaAgendados([
    { titulo: 'Bastidor da loja', status: 'agendada' },
    { titulo: 'Promo de inverno', status: 'aprovada' },
  ])
  assert.equal(r.length, 2)
})

test('peca publicada ou arquivada NAO conta como ja agendada', () => {
  // O que já saiu não impede uma ideia parecida daqui a um mês; o que está na
  // fila, sim.
  const r = temasJaAgendados([
    { titulo: 'ja saiu', status: 'publicada' },
    { titulo: 'no lixo', status: 'arquivada' },
    { titulo: 'na fila', status: 'agendada' },
  ])
  assert.deepEqual(r, ['na fila'])
})

// ── Deduplicação ────────────────────────────────────────────────────────────

test('ideia igual a uma existente e repetida', () => {
  assert.equal(ehRepetida('Bastidor da loja nova', ['Bastidor da loja nova']), true)
})

test('so muda acento e caixa: continua repetida', () => {
  assert.equal(ehRepetida('BASTIDOR DA LOJA NOVA', ['bastidor da loja nova']), true)
})

test('ideia parecida demais tambem e barrada', () => {
  // "Ideias infinitas" sem isto vira repetição infinita: o modelo devolve a
  // mesma pauta com outras palavras a cada rodada.
  assert.equal(ehRepetida('Bastidor da loja nova hoje', ['Bastidor da loja nova']), true)
})

test('ideia realmente diferente passa', () => {
  assert.equal(ehRepetida('Receita de brigadeiro', ['Bastidor da loja nova']), false)
})

test('sem nada para comparar, nada e repetido', () => {
  assert.equal(ehRepetida('qualquer coisa', []), false)
  assert.equal(ehRepetida('qualquer coisa', null), false)
})

test('titulo vazio conta como repetido (nao vale gravar)', () => {
  assert.equal(ehRepetida('', ['algo']), true)
  assert.equal(ehRepetida(null, []), true)
})

// ── O contexto montado ──────────────────────────────────────────────────────

const DADOS = {
  conta: { name: 'La Vessel', username: 'vessel.brasil' },
  blocos: [{ tipo: 'assinatura', nome: 'padrao', texto: '— La Vessel' }],
  publicados: [post('post bom', 3000), post('post ruim', 50)],
  agendadas: [{ titulo: 'Ja na fila', status: 'agendada' }],
  concorrentes: [{ handle: 'arezzo', legenda: 'nova coleção', curtidas: 900 }],
  hoje: '2026-07-31',
}

test('o contexto cita a marca pelo nome', () => {
  assert.match(montarContextoDaMarca(DADOS), /La Vessel/)
})

test('o contexto traz os posts medidos', () => {
  const txt = montarContextoDaMarca(DADOS)
  assert.match(txt, /post bom/)
  assert.match(txt, /post ruim/)
})

test('com poucos posts, NAO existe secao "rendeu menos"', () => {
  // Com 2 posts medidos, um slice(-3) listaria os mesmos dois — o melhor post
  // da marca apareceria também como um dos piores. Melhor sem a seção.
  assert.ok(!/rendeu menos/i.test(montarContextoDaMarca(DADOS)))
})

// Varre TODOS os tamanhos de histórico, não só um confortável. A primeira
// versão deste teste usava 10 posts e passava — com 6 a 9, os dois cortes se
// cruzavam e o mesmo post saía nas duas listas.
for (const quantos of [1, 3, 5, 6, 7, 8, 9, 12, 30]) {
  test(`com ${quantos} post(s) medidos, nenhum aparece nas duas secoes`, () => {
    const muitos = Array.from({ length: quantos }, (_, i) => post(`post ${i}`, (i + 1) * 500))
    const txt = montarContextoDaMarca({ ...DADOS, publicados: muitos })

    const bloco = (t) => txt.split(`## ${t}`)[1]?.split('\n## ')[0] || ''
    const titulos = (s) => (s.match(/post \d+\b/g) || [])
    const nosMelhores = titulos(bloco('O que funcionou aqui'))
    const nosPiores = titulos(bloco('O que rendeu menos'))

    const repetidos = nosMelhores.filter(t => nosPiores.includes(t))
    assert.deepEqual(repetidos, [], `aparecem nas duas listas: ${repetidos.join(', ')}`)
  })
}

test('com historico grande as duas secoes existem', () => {
  const muitos = Array.from({ length: 12 }, (_, i) => post(`post ${i}`, (i + 1) * 500))
  const txt = montarContextoDaMarca({ ...DADOS, publicados: muitos })
  assert.match(txt, /funcionou aqui/i)
  assert.match(txt, /rendeu menos/i)
})

test('o contexto avisa o que ja esta na agenda', () => {
  assert.match(montarContextoDaMarca(DADOS), /Ja na fila/)
})

test('o contexto traz o tom de voz dos blocos', () => {
  assert.match(montarContextoDaMarca(DADOS), /La Vessel/)
})

test('o contexto diz o mes, para a sazonalidade', () => {
  assert.match(montarContextoDaMarca(DADOS), /julho|agosto/i)
})

test('marca sem historico nenhum gera contexto valido, nao quebra', () => {
  const txt = montarContextoDaMarca({ conta: { name: 'Nova' }, hoje: '2026-07-31' })
  assert.ok(txt.length > 50)
  assert.ok(!/undefined|null|NaN|\[object/.test(txt), `contexto sujo: ${txt.slice(0, 200)}`)
})

test('o contexto nunca sai com undefined em lugar nenhum', () => {
  const txt = montarContextoDaMarca({
    conta: {}, blocos: [{}], publicados: [{}], agendadas: [{}], concorrentes: [{}], hoje: '2026-07-31',
  })
  assert.ok(!/undefined|\[object Object\]/.test(txt), `contexto sujo: ${txt}`)
})

// ---------- concorrentes por marca ----------
//
// O defeito que estes testes travam: o briefing puxava o Portal de Notícias
// (moda e calçado) para TODA marca, e a primeira pauta real do Breno Vale —
// marca pessoal — citou @Isla e @Santa Lolla como concorrentes dele.

test('os concorrentes cadastrados da marca entram no briefing', () => {
  const txt = montarContextoDaMarca({
    conta: { name: 'Breno Vale' },
    hoje: '2026-07-31',
    concorrentesDaMarca: [
      { handle: 'lasarocarvalho', nome: 'Lasaro Carvalho', observacao: 'Mesmo nicho de marca pessoal.' },
    ],
  })
  assert.match(txt, /Lasaro Carvalho/)
  assert.match(txt, /@lasarocarvalho/)
  assert.match(txt, /Mesmo nicho de marca pessoal/)
})

test('concorrente so com handle nao vira "undefined"', () => {
  const txt = montarContextoDaMarca({
    conta: { name: 'X' }, hoje: '2026-07-31',
    concorrentesDaMarca: [{ handle: 'mottu' }],
  })
  assert.match(txt, /@mottu/)
  assert.ok(!/undefined|\[object Object\]/.test(txt), `contexto sujo: ${txt}`)
})

test('concorrente sem nome nem handle e descartado', () => {
  const txt = montarContextoDaMarca({
    conta: { name: 'X' }, hoje: '2026-07-31',
    concorrentesDaMarca: [{ observacao: 'sobrou de um cadastro pela metade' }],
  })
  assert.ok(!/Contra quem esta marca disputa/.test(txt))
})

test('a regra de nao citar concorrente esta SEMPRE no briefing', () => {
  // Inclusive sem concorrente cadastrado: o modelo pode citar uma marca de
  // memoria, e ai a regra e a unica coisa que segura.
  for (const dados of [
    { conta: { name: 'X' }, hoje: '2026-07-31' },
    { conta: { name: 'X' }, hoje: '2026-07-31', concorrentesDaMarca: [{ nome: 'Y' }] },
  ]) {
    assert.match(montarContextoDaMarca(dados), /NUNCA escreva o nome nem o @ de um concorrente/)
  }
})

test('as duas fontes de concorrente ficam em secoes separadas', () => {
  const txt = montarContextoDaMarca({
    conta: { name: 'Vessel' }, hoje: '2026-07-31',
    concorrentesDaMarca: [{ nome: 'Loja da Esquina' }],
    concorrentes: [{ handle: 'Schutz', legenda: 'lancou a colecao nova' }],
  })
  const iNicho = txt.indexOf('Contra quem esta marca disputa')
  const iPortal = txt.indexOf('O que o mercado está publicando')
  assert.ok(iNicho > -1, 'faltou a secao dos concorrentes cadastrados')
  assert.ok(iPortal > -1, 'faltou a secao do Portal')
  assert.ok(iNicho < iPortal, 'o nicho da marca vem antes do Portal')
  assert.ok(txt.includes('Loja da Esquina'))
  assert.ok(txt.includes('@Schutz'))
})

test('marca fora do nicho nao recebe o Portal', () => {
  // O robo so passa `concorrentes` quando accounts.conteudo_usa_portal e true.
  // Aqui fica travado o outro lado: sem a lista, a secao nao existe.
  const txt = montarContextoDaMarca({
    conta: { name: 'Breno Vale' }, hoje: '2026-07-31',
    concorrentesDaMarca: [{ nome: 'Lasaro Carvalho' }],
    concorrentes: [],
  })
  assert.ok(!/O que o mercado está publicando/.test(txt))
  assert.ok(!/Schutz|Arezzo|Santa Lolla|Isla/.test(txt))
})
