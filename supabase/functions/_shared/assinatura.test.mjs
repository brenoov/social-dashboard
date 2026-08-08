import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoParaAssinar, impressaoDigital, tempoDePreenchimento, SEGUNDOS_SUSPEITOS, conferirCorrente } from './assinatura.js'

const FICHA = {
  veiculo_id: 'v1', feita_em: '2026-08-06', pessoa_id: 'p1',
  hodometro: 148520, hodometro_justificativa: null,
  cadencias: ['diario'], resultado: 'liberado', anomalias: null,
  assinada_em: '2026-08-06T12:00:00.000Z',
}
const RESPOSTAS = [
  { item_texto: 'Painel — luzes de advertência', estado: 'ok', observacao: null },
  { item_texto: 'Vazamentos sob o veículo', estado: 'nao_ok', observacao: 'mancha no chão' },
]

test('o texto canônico traz o conteúdo inteiro, na ordem fixa', () => {
  const t = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: 'abc123' })
  // Cada dado num campo próprio, separado por | — o formato importa menos que
  // ser ESTÁVEL, porque é o que se recalcula pra conferir depois.
  assert.match(t, /v1/)
  assert.match(t, /2026-08-06/)
  assert.match(t, /148520/)
  assert.match(t, /Painel — luzes de advertência/)
  assert.match(t, /mancha no chão/)
  assert.match(t, /abc123/)
})

test('a ORDEM dos itens faz parte da prova', () => {
  // Trocar dois itens de lugar tem que dar texto diferente: senão daria pra
  // reordenar as respostas de uma ficha assinada sem quebrar o hash.
  const a = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  const b = textoParaAssinar({ ficha: FICHA, respostas: [RESPOSTAS[1], RESPOSTAS[0]], hashAnterior: '' })
  assert.notEqual(a, b)
})

test('mudar QUALQUER campo muda o texto', () => {
  const base = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  for (const [campo, valor] of [
    ['veiculo_id', 'v2'], ['feita_em', '2026-08-07'], ['pessoa_id', 'p2'],
    ['hodometro', 148521], ['resultado', 'com_ressalvas'], ['anomalias', 'x'],
    ['assinada_em', '2026-08-06T12:00:01.000Z'],
  ]) {
    const t = textoParaAssinar({ ficha: { ...FICHA, [campo]: valor }, respostas: RESPOSTAS, hashAnterior: '' })
    assert.notEqual(t, base, `mudar ${campo} tinha que mudar o texto`)
  }
})

test('mudar a resposta de um item muda o texto', () => {
  const base = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  const outras = [{ ...RESPOSTAS[0], estado: 'nao_ok' }, RESPOSTAS[1]]
  assert.notEqual(textoParaAssinar({ ficha: FICHA, respostas: outras, hashAnterior: '' }), base)
})

test('nulo e vazio não se confundem', () => {
  // Se `null` e '' virassem o mesmo texto, dava pra trocar um pelo outro numa
  // ficha assinada sem quebrar nada.
  const comNulo = textoParaAssinar({ ficha: { ...FICHA, anomalias: null }, respostas: RESPOSTAS, hashAnterior: '' })
  const comVazio = textoParaAssinar({ ficha: { ...FICHA, anomalias: '' }, respostas: RESPOSTAS, hashAnterior: '' })
  assert.notEqual(comNulo, comVazio)
})

test('a primeira ficha do carro encadeia em vazio, e isso é explícito', () => {
  const t = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: null })
  assert.match(t, /PRIMEIRA/)
})

/* ── A impressão digital ─────────────────────────────────────────────────── */

test('a impressão digital tem 64 caracteres hexadecimais', async () => {
  const h = await impressaoDigital('qualquer coisa')
  assert.equal(h.length, 64)
  assert.match(h, /^[0-9a-f]{64}$/)
})

test('o mesmo texto dá sempre a mesma impressão; texto diferente, diferente', async () => {
  assert.equal(await impressaoDigital('abc'), await impressaoDigital('abc'))
  assert.notEqual(await impressaoDigital('abc'), await impressaoDigital('abd'))
})

test('acento não quebra a impressão digital', async () => {
  // Os itens do checklist têm acento ("advertência", "veículo"). Se a conversão
  // pra bytes fosse por caractere em vez de UTF-8, o hash mudaria de máquina
  // pra máquina e a corrente inteira ficaria impossível de conferir.
  const h = await impressaoDigital('Painel — luzes de advertência')
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.equal(h, await impressaoDigital('Painel — luzes de advertência'))
})

/* ── O tempo de preenchimento (D20) ──────────────────────────────────────── */

test('conta os segundos entre abrir e assinar', () => {
  const t = tempoDePreenchimento('2026-08-06T12:00:00.000Z', '2026-08-06T12:01:30.000Z')
  assert.equal(t.segundos, 90)
  assert.equal(t.rapidoDemais, false)
})

test('rápido demais é sinalizado', () => {
  // 4 itens em 3 segundos não foram olhados.
  const t = tempoDePreenchimento('2026-08-06T12:00:00.000Z', '2026-08-06T12:00:03.000Z')
  assert.equal(t.segundos, 3)
  assert.equal(t.rapidoDemais, true)
})

test('sem os dois instantes, não inventa número', () => {
  assert.deepEqual(tempoDePreenchimento(null, '2026-08-06T12:00:00.000Z'), { segundos: null, rapidoDemais: false })
  assert.deepEqual(tempoDePreenchimento('2026-08-06T12:00:00.000Z', null), { segundos: null, rapidoDemais: false })
  assert.deepEqual(tempoDePreenchimento('nao é data', 'nem isso'), { segundos: null, rapidoDemais: false })
})

test('instantes em formatos diferentes dão o mesmo resultado', () => {
  // O Postgres devolve '+00:00' sem milissegundos; o app grava '.000Z'.
  // Comparar como texto erraria — é o mesmo defeito já corrigido em posse.js.
  const a = tempoDePreenchimento('2026-08-06T12:00:00+00:00', '2026-08-06T12:01:00.000Z')
  assert.equal(a.segundos, 60)
})

test('o limiar é uma constante nomeada, não número solto', () => {
  assert.equal(typeof SEGUNDOS_SUSPEITOS, 'number')
})

/* ── Colisões: o separador dentro do próprio conteúdo ────────────────────── */
// Achado da revisão da Tarefa 1: os separadores entre campos e entre itens
// não eram escapados, então um campo de TEXTO LIVRE (a observação de um
// item, por exemplo — a pessoa aperta Enter e escreve mais de uma linha)
// podia carregar o próprio separador e fazer dois conteúdos DIFERENTES
// darem o MESMO texto canônico. `frota_checklist` ainda não tinha nenhuma
// linha quando isso foi achado, então não havia nada assinado pra
// invalidar — mas se a correção for desfeita depois de existir a primeira
// assinatura real, ela vira uma migração de dados, não uma troca de código.

test('deslocar o separador \\u001f entre item_texto e estado não engana mais o texto', () => {
  // Antes da correção este par colidia byte a byte: "A" + SEP + "B" + SEP +
  // "C" era o mesmo texto não importa onde a fronteira real do dado caía.
  const r1 = [{ item_texto: 'A', estado: 'B\x1fC', observacao: null }]
  const r2 = [{ item_texto: 'A\x1fB', estado: 'C', observacao: null }]
  const t1 = textoParaAssinar({ ficha: FICHA, respostas: r1, hashAnterior: '' })
  const t2 = textoParaAssinar({ ficha: FICHA, respostas: r2, hashAnterior: '' })
  assert.notEqual(t1, t2)
})

test('uma quebra de linha dentro de um campo da ficha não se confunde com a quebra entre linhas', () => {
  // '\\n' é o separador entre os campos de nível de ficha (textoParaAssinar
  // usa linhas.join('\\n')). Sem escape, um '\n' DENTRO de `anomalias`
  // desloca a fronteira: o mesmo texto final sai tanto de
  // (anomalias='x\ny', assinada_em='Z') quanto de (anomalias='x',
  // assinada_em='y\nZ') — nos dois casos o formato antigo produzia
  // "...x\ny\nZ..." byte a byte igual. Provado rodando este par contra o
  // código de antes da correção (commit aa36cd0): colide lá, não colide
  // aqui. Ver task-1-report.md pela saída das duas rodadas.
  const fichaA = { ...FICHA, resultado: 'R', anomalias: 'x\ny', assinada_em: 'Z' }
  const fichaB = { ...FICHA, resultado: 'R', anomalias: 'x', assinada_em: 'y\nZ' }
  const a = textoParaAssinar({ ficha: fichaA, respostas: RESPOSTAS, hashAnterior: '' })
  const b = textoParaAssinar({ ficha: fichaB, respostas: RESPOSTAS, hashAnterior: '' })
  assert.notEqual(a, b)
})

test('um hashAnterior real que valesse a palavra PRIMEIRA não se confunde com "não há ficha anterior"', () => {
  // Achado da re-revisão: `hashAnterior` era o único campo que não passava
  // por `campo()`, indo cru pro texto como `ANTERIOR:${hashAnterior ||
  // 'PRIMEIRA'}`. Isso fazia a string literal "PRIMEIRA" dar o MESMO texto
  // que "não há ficha anterior" — justamente o campo que garante a corrente
  // contra alteração retroativa. Na prática o valor real é sempre vazio ou
  // um SHA-256 hex, então nunca seria literalmente "PRIMEIRA" — mas fechar
  // agora custa uma linha, e depois da primeira assinatura custaria
  // descartar assinaturas.
  const comHashLiteralPrimeira = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: 'PRIMEIRA' })
  const semFichaAnterior = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: null })
  assert.notEqual(comHashLiteralPrimeira, semFichaAnterior)
})

test('uma cadência com vírgula não se confunde com duas cadências separadas', () => {
  // (ficha.cadencias || []).join(',') dava o mesmo texto pra ['a,b'] e
  // ['a', 'b']. Agora o array inteiro é serializado, não só concatenado.
  const comVirgulaDentro = textoParaAssinar({
    ficha: { ...FICHA, cadencias: ['a,b'] }, respostas: RESPOSTAS, hashAnterior: '',
  })
  const duasCadencias = textoParaAssinar({
    ficha: { ...FICHA, cadencias: ['a', 'b'] }, respostas: RESPOSTAS, hashAnterior: '',
  })
  assert.notEqual(comVirgulaDentro, duasCadencias)
})

test('caso realista (ESTABILIDADE, não colisão): observação com Enter dá texto diferente do normal, e o hash não muda de uma chamada pra outra', async () => {
  // Este teste NÃO prova colisão — 'pneu murcho\nlevar na borracharia' não
  // colide com mais nada, nem antes nem depois da correção. Ele prova a
  // outra metade da garantia: o caso realista (a pessoa aperta Enter numa
  // caixa de texto de verdade) continua dando um texto DIFERENTE do normal
  // e uma impressão digital REPETÍVEL — que é a base de tudo o que a
  // assinatura promete, com ou sem separador escapado.
  const ficha = { ...FICHA, anomalias: 'pneu murcho\nlevar na borracharia' }
  const t = textoParaAssinar({ ficha, respostas: RESPOSTAS, hashAnterior: '' })
  const outra = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  assert.notEqual(t, outra)

  const h1 = await impressaoDigital(t)
  const h2 = await impressaoDigital(t)
  assert.equal(h1, h2)
})

/* ── A conferência da corrente ───────────────────────────────────────────── */

// Monta uma corrente de verdade: cada ficha assinada em cima da anterior.
async function montarCorrente(quantas) {
  const fichas = [], porFicha = {}
  let anterior = null
  for (let i = 0; i < quantas; i++) {
    const ficha = {
      id: 'f' + i, veiculo_id: 'v1', feita_em: `2026-08-0${i + 1}`, pessoa_id: 'p1',
      hodometro: 148000 + i * 100, hodometro_justificativa: null,
      cadencias: ['diario'], resultado: 'liberado', anomalias: null,
      assinada_em: `2026-08-0${i + 1}T12:00:00.000Z`,
      assinatura_hash_anterior: anterior,
    }
    const respostas = [{ item_texto: 'Pneus', estado: 'ok', observacao: null }]
    ficha.assinatura_hash = await impressaoDigital(
      textoParaAssinar({ ficha, respostas, hashAnterior: anterior }))
    anterior = ficha.assinatura_hash
    fichas.push(ficha)
    porFicha[ficha.id] = respostas
  }
  return { fichas, porFicha }
}

test('corrente intacta confere', async () => {
  const { fichas, porFicha } = await montarCorrente(3)
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, true)
  assert.equal(r.total, 3)
  assert.equal(r.conferidas, 3)
  assert.equal(r.primeiraQuebra, null)
})

test('alterar o hodômetro de uma ficha assinada QUEBRA a corrente', async () => {
  // É o ponto da funcionalidade inteira.
  const { fichas, porFicha } = await montarCorrente(3)
  fichas[1].hodometro = 999999
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f1')
  assert.match(r.primeiraQuebra.motivo, /conteúdo/i)
})

test('alterar a RESPOSTA de um item também quebra', async () => {
  const { fichas, porFicha } = await montarCorrente(2)
  porFicha['f0'][0].estado = 'nao_ok'
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f0')
})

test('apagar uma ficha do meio quebra o elo seguinte', async () => {
  const { fichas, porFicha } = await montarCorrente(3)
  const semMeio = [fichas[0], fichas[2]]
  const r = await conferirCorrente(semMeio, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f2')
  assert.match(r.primeiraQuebra.motivo, /anterior/i)
})

test('aponta a PRIMEIRA quebra, não a última', async () => {
  const { fichas, porFicha } = await montarCorrente(4)
  fichas[1].hodometro = 111
  fichas[3].hodometro = 222
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.primeiraQuebra.id, 'f1')
})

test('ficha SEM assinatura é pulada, não conta como quebra', async () => {
  // D22: quem não tem login preenche mas não assina. Isso não pode fazer a
  // corrente do carro parecer adulterada.
  const { fichas, porFicha } = await montarCorrente(2)
  const semAssinatura = { id: 'fx', veiculo_id: 'v1', feita_em: '2026-08-09',
    assinada_em: null, assinatura_hash: null }
  const r = await conferirCorrente([fichas[0], semAssinatura, fichas[1]], porFicha)
  assert.equal(r.ok, true)
  assert.equal(r.total, 3)
  assert.equal(r.conferidas, 2)
})

test('lista vazia confere, e diz que não conferiu nada', async () => {
  const r = await conferirCorrente([], {})
  assert.equal(r.ok, true)
  assert.equal(r.conferidas, 0)
})

/* ── Chave ausente em respostasPorFicha NÃO é acusação ───────────────────── */
// Achado da revisão: `respostasPorFicha[id]` ausente (`undefined`) virava
// `[]` do mesmo jeito que uma ficha que REALMENTE não tem resposta nenhuma —
// as duas caíam na mesma conta e a corrente acusava "conteúdo alterado" numa
// ficha que pode estar intacta. A distinção que importa: chave ausente é
// FALHA DE QUEM CHAMOU (não conseguiu ler), não um fato sobre a ficha.

test('chave ausente em respostasPorFicha não vira quebra — vira "não conferida", com mensagem de falha de leitura', async () => {
  const { fichas, porFicha } = await montarCorrente(3)
  delete porFicha['f1']
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra, null)
  assert.equal(r.naoConferida.id, 'f1')
  assert.match(r.naoConferida.motivo, /não foi possível conferir/i)
  assert.match(r.naoConferida.motivo, /leitura/i)
})

test('respostas: [] de VERDADE (a chave existe) é conteúdo diferente do assinado — continua sendo quebra, com a mensagem de conteúdo alterado, não a de leitura', async () => {
  const { fichas, porFicha } = await montarCorrente(2)
  porFicha['f0'] = []
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f0')
  assert.match(r.primeiraQuebra.motivo, /conteúdo/i)
  assert.equal(r.naoConferida, null)
})

test('uma ficha não conferida não esconde uma quebra de verdade mais adiante na mesma corrente', async () => {
  const { fichas, porFicha } = await montarCorrente(4)
  delete porFicha['f1'] // lacuna de leitura no meio
  fichas[2].hodometro = 999999 // adulteração de verdade, depois da lacuna
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.naoConferida.id, 'f1')
  assert.equal(r.primeiraQuebra.id, 'f2')
})

/* ── O instante da assinatura sobrevive à ida e volta do banco ─────────────── */

// O DEFEITO QUE ESTES TESTES FECHAM: `assinada_em` é o único campo da ficha que
// o Postgres reescreve. Medido no banco de verdade:
//   manda '2026-08-07T12:00:00.000Z'  ->  devolve '2026-08-07T12:00:00+00:00'
//   manda '2026-08-07T12:00:00.120Z'  ->  devolve '2026-08-07T12:00:00.12+00:00'
//   manda '2026-08-07T12:00:00.123Z'  ->  devolve '2026-08-07T12:00:00.123+00:00'
// Com o texto cru no hash, o valor calculado ao assinar NUNCA bateria com o
// recalculado ao conferir, e conferirCorrente acusaria de adulterada toda ficha
// honesta. Estes casos são os três formatos reais que saem do banco.
const IDAS_E_VOLTAS = [
  ['2026-08-07T12:00:00.000Z', '2026-08-07T12:00:00+00:00'],
  ['2026-08-07T12:00:00.120Z', '2026-08-07T12:00:00.12+00:00'],
  ['2026-08-07T12:00:00.123Z', '2026-08-07T12:00:00.123+00:00'],
]

test('assinada_em: o texto que o navegador manda e o que o Postgres devolve dão o MESMO hash', async () => {
  for (const [mandado, devolvido] of IDAS_E_VOLTAS) {
    assert.notEqual(mandado, devolvido, 'o caso do teste tem que ser mesmo dois textos diferentes')
    const aoAssinar = await impressaoDigital(textoParaAssinar({
      ficha: { ...FICHA, assinada_em: mandado }, respostas: RESPOSTAS, hashAnterior: null,
    }))
    const aoConferir = await impressaoDigital(textoParaAssinar({
      ficha: { ...FICHA, assinada_em: devolvido }, respostas: RESPOSTAS, hashAnterior: null,
    }))
    assert.equal(aoConferir, aoAssinar, `${mandado} e ${devolvido} são o mesmo instante`)
  }
})

test('assinada_em: instantes DIFERENTES continuam dando hashes diferentes', async () => {
  // A canonização não pode ter apagado a discriminação junto com o formato: se
  // qualquer instante virasse o mesmo texto, dava pra reescrever a hora da
  // assinatura sem quebrar o hash.
  const a = textoParaAssinar({ ficha: { ...FICHA, assinada_em: '2026-08-07T12:00:00.000Z' }, respostas: RESPOSTAS, hashAnterior: null })
  const b = textoParaAssinar({ ficha: { ...FICHA, assinada_em: '2026-08-07T12:00:00.001Z' }, respostas: RESPOSTAS, hashAnterior: null })
  const c = textoParaAssinar({ ficha: { ...FICHA, assinada_em: '2026-08-07T09:00:00.000-03:00' }, respostas: RESPOSTAS, hashAnterior: null })
  assert.notEqual(a, b, 'um milésimo de diferença tem que mudar o texto')
  assert.equal(a, c, 'o mesmo instante em outro fuso é o mesmo instante')
})

test('assinada_em nulo continua diferente de assinada_em preenchido, e texto ilegível não vira data inventada', () => {
  const semNada = textoParaAssinar({ ficha: { ...FICHA, assinada_em: null }, respostas: RESPOSTAS, hashAnterior: null })
  const comData = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: null })
  assert.notEqual(semNada, comData)
  // Texto que não é instante passa cru em vez de virar `null` (que seria "não
  // assinada") ou uma data qualquer: preferimos o valor ilegível de volta a
  // inventar dado.
  const lixoA = textoParaAssinar({ ficha: { ...FICHA, assinada_em: 'nem-data' }, respostas: RESPOSTAS, hashAnterior: null })
  const lixoB = textoParaAssinar({ ficha: { ...FICHA, assinada_em: 'outra-coisa' }, respostas: RESPOSTAS, hashAnterior: null })
  assert.notEqual(lixoA, semNada)
  assert.notEqual(lixoA, lixoB)
})
