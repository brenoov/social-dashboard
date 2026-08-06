import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoParaAssinar, impressaoDigital, tempoDePreenchimento, SEGUNDOS_SUSPEITOS } from './assinatura.js'

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
