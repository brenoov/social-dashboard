import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RELATORIOS_DO_PATRIMONIO, acharRelatorio } from './relatorios-do-patrimonio.js'
import { COLUNAS_PLANILHA } from './planilha-e-resumo.js'
import { RECORTE_VAZIO } from '../../compartilhado/relatorios/recorte.js'

// Dublê do supabase-js: só o encadeamento que este catálogo usa.
// Testar contra o banco de verdade tornaria o teste dependente de dado real, e
// este projeto tem regra escrita de não mexer em dado real para testar.
function bancoFalso(linhas, erro = null) {
  const resposta = Promise.resolve({ data: linhas, error: erro })
  const encadeia = {
    select: () => encadeia,
    is: () => encadeia,
    gte: () => encadeia,
    lte: () => encadeia,
    order: () => resposta,
    then: (...a) => resposta.then(...a),
  }
  return { from: () => encadeia }
}

// Igual ao bancoFalso, mas ANOTA os filtros pedidos. Sem isto, um relatório que
// ignora o período passaria no teste — traria linhas, e ninguém veria que ele
// trouxe a base inteira.
function bancoEspiao(pedidos, linhas) {
  const resposta = Promise.resolve({ data: linhas, error: null })
  const encadeia = {
    select: () => encadeia,
    is: () => encadeia,
    gte: (c, v) => { pedidos.push(['gte', c, v]); return encadeia },
    lte: (c, v) => { pedidos.push(['lte', c, v]); return encadeia },
    order: () => resposta,
    then: (...a) => resposta.then(...a),
  }
  return { from: () => encadeia }
}

test('todo relatório declara o que a casca precisa, sem faltar campo', () => {
  for (const r of RELATORIOS_DO_PATRIMONIO) {
    assert.ok(r.chave, 'relatório sem chave')
    assert.ok(r.titulo, `${r.chave} sem título`)
    assert.ok(r.explicacao, `${r.chave} sem explicação`)
    assert.equal(typeof r.periodo, 'boolean', `${r.chave} não diz se pede período`)
    assert.ok(Array.isArray(r.colunas) && r.colunas.length, `${r.chave} sem colunas`)
    assert.equal(typeof r.pegarIds, 'function', `${r.chave} não sabe achar marca/local`)
    assert.equal(typeof r.montar, 'function', `${r.chave} não sabe buscar linhas`)
  }
})

test('as chaves não se repetem — chave repetida some com um relatório da tela', () => {
  const chaves = RELATORIOS_DO_PATRIMONIO.map((r) => r.chave)
  assert.equal(new Set(chaves).size, chaves.length)
})

test('"Bens" usa as MESMAS colunas da Planilha, sem uma segunda lista', () => {
  const bens = acharRelatorio('bens')
  assert.equal(bens.colunas, COLUNAS_PLANILHA)
})

test('"Bens" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorio('bens').periodo, false)
})

test('"Bens" monta a partir do que a tela já carregou, sem ir ao banco de novo', async () => {
  const linhasAchatadas = [{ id: 'a', nome: 'Mesa', _bem: { empresa_id: 'e1', local_id: 'l1' } }]
  const linhas = await acharRelatorio('bens').montar({ linhasAchatadas })
  assert.deepEqual(linhas, linhasAchatadas)
})

test('"Bens" acha marca e local no bem cru, e não na linha achatada', () => {
  // A linha achatada guarda o NOME ("Vessel"), não o id. Recortar por nome
  // quebraria justamente nas duas "Fábrica Conchal".
  const linha = { empresa: 'Vessel', local: 'Fábrica Conchal', _bem: { empresa_id: 'e1', local_id: 'l1' } }
  assert.deepEqual(acharRelatorio('bens').pegarIds(linha), { empresaId: 'e1', localId: 'l1' })
})

test('acharRelatorio devolve null para chave que não existe', () => {
  assert.equal(acharRelatorio('nao-existe'), null)
})

// ─────────────────────────────── Com quem está cada bem ──────────────────────

test('"Com quem está" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorio('com-quem').periodo, false)
})

test('"Com quem está" traz só a posse ABERTA, e casa com o bem', async () => {
  const sbClient = bancoFalso([
    { bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-01-10', ate: null, motivo: 'uso' },
  ])
  const linhasAchatadas = [
    { id: 'b1', numero: 7, nome: 'Notebook', categoria: 'TI', empresa: 'Vessel',
      local: 'Sede', valor_centavos: 500000, _bem: { empresa_id: 'e1', local_id: 'l1' } },
  ]
  const linhas = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas })
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].pessoa, 'Ana')
  assert.equal(linhas[0].nome, 'Notebook')
  assert.equal(linhas[0].desde, '2026-01-10')
})

test('"Com quem está" ignora posse de bem que não existe mais, sem estourar', async () => {
  const sbClient = bancoFalso([{ bem_id: 'sumiu', pessoa_nome: 'Ana', de: '2026-01-10', ate: null }])
  const linhas = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas: [] })
  assert.deepEqual(linhas, [])
})

test('"Com quem está" recorta pelo bem, não pela pessoa', async () => {
  const sbClient = bancoFalso([{ bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-01-10', ate: null }])
  const linhasAchatadas = [{ id: 'b1', nome: 'Notebook', _bem: { empresa_id: 'e9', local_id: 'l9' } }]
  const [linha] = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas })
  assert.deepEqual(acharRelatorio('com-quem').pegarIds(linha), { empresaId: 'e9', localId: 'l9' })
})

// ─────────────────────────────── Resumo por marca/local ─────────────────────

test('"Resumo" em "Tudo" agrupa por MARCA, com total e fatia', async () => {
  const linhasAchatadas = [
    { id: 'a', empresa: 'Vessel', local: 'Conchal', valor_centavos: 30000, _bem: {} },
    { id: 'b', empresa: 'Vessel', local: 'Sede', valor_centavos: 10000, _bem: {} },
    { id: 'c', empresa: 'RB Builders', local: 'Casa RB', valor_centavos: 10000, _bem: {} },
  ]
  const linhas = await acharRelatorio('resumo').montar({ linhasAchatadas, recorte: RECORTE_VAZIO })
  assert.equal(linhas.length, 2)
  assert.equal(linhas[0].grupo, 'Vessel')
  assert.equal(linhas[0].quantidade, 2)
  assert.equal(linhas[0].total_centavos, 40000)
  assert.equal(linhas[0].fatia, '80,0%')
})

test('"Resumo" com uma marca escolhida desce um nível e agrupa por LOCAL', async () => {
  // Agrupar por marca dentro de uma marca só devolveria uma linha — inútil.
  // Escolher a marca é justamente pedir "e dentro dela, onde está?".
  const linhasAchatadas = [
    { id: 'a', empresa: 'Vessel', local: 'Fábrica Conchal', valor_centavos: 30000, _bem: { empresa_id: 'e1' } },
    { id: 'b', empresa: 'Vessel', local: 'Sede Limeira', valor_centavos: 10000, _bem: { empresa_id: 'e1' } },
  ]
  const linhas = await acharRelatorio('resumo').montar({
    linhasAchatadas, recorte: { modo: 'marca', empresaId: 'e1', localId: '' },
  })
  assert.deepEqual(linhas.map((l) => l.grupo), ['Fábrica Conchal', 'Sede Limeira'])
})

test('"Resumo" com marca escolhida NÃO conta bem de outra marca', async () => {
  const linhasAchatadas = [
    { id: 'a', empresa: 'Vessel', local: 'Fábrica Conchal', valor_centavos: 30000, _bem: { empresa_id: 'e1' } },
    { id: 'b', empresa: 'RB Builders', local: 'Casa RB', valor_centavos: 99999, _bem: { empresa_id: 'e2' } },
  ]
  const linhas = await acharRelatorio('resumo').montar({
    linhasAchatadas, recorte: { modo: 'marca', empresaId: 'e1', localId: '' },
  })
  assert.deepEqual(linhas.map((l) => l.grupo), ['Fábrica Conchal'])
})

test('"Resumo" sem recorte informado não estoura, e agrupa por marca', async () => {
  const linhas = await acharRelatorio('resumo').montar({
    linhasAchatadas: [{ id: 'a', empresa: 'Vessel', valor_centavos: 100, _bem: {} }],
  })
  assert.equal(linhas[0].grupo, 'Vessel')
})

test('"Resumo" não é recortável pelo filtro genérico — ele JÁ é a separação', () => {
  // pegarIds nulo faz o filtro genérico cair sempre em "tudo", que é o certo:
  // cortar por Vessel um relatório que já separa por Vessel tiraria linha duas
  // vezes e deixaria uma só na tabela.
  assert.deepEqual(acharRelatorio('resumo').pegarIds({}), { empresaId: null, localId: null })
})

// ─────────────────────────────── Histórico de movimentação ──────────────────

test('"Histórico" pede período', () => {
  assert.equal(acharRelatorio('historico').periodo, true)
})

test('"Histórico" pergunta ao banco pelo período recebido, e não traz a base toda', async () => {
  const pedidos = []
  const sbClient = bancoEspiao(pedidos, [
    { bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-07-02', ate: '2026-07-20', motivo: 'troca' },
  ])
  const linhasAchatadas = [{ id: 'b1', numero: 7, nome: 'Notebook', _bem: {} }]
  await acharRelatorio('historico').montar({
    sbClient, linhasAchatadas, de: '2026-07-01', ate: '2026-07-31',
  })
  assert.deepEqual(pedidos, [['gte', 'de', '2026-07-01'], ['lte', 'de', '2026-07-31']])
})

test('"Histórico" mostra "ainda está" quando a posse não fechou', async () => {
  // Vazio aqui seria lido como "devolveu e não anotaram". Dizer "ainda está" é
  // a informação que a pessoa foi buscar.
  const sbClient = bancoFalso([{ bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-07-02', ate: null }])
  const linhasAchatadas = [{ id: 'b1', nome: 'Notebook', _bem: {} }]
  const [linha] = await acharRelatorio('historico').montar({
    sbClient, linhasAchatadas, de: '2026-07-01', ate: '2026-07-31',
  })
  assert.equal(linha.ate, 'ainda está')
})

test('"Com quem está" ESTOURA quando o banco recusa, em vez de devolver vazio', async () => {
  // Lista vazia por erro se lê como "ninguém está com nada" — a resposta mais
  // perigosa que este relatório pode dar, porque é exatamente o contrário.
  const sbClient = bancoFalso(null, { message: 'permissão negada' })
  await assert.rejects(
    () => acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas: [] }),
    /permissão negada/,
  )
})
