/* O NÚMERO DE SÉRIE — a regra pura, e o porquê de cada guarda.
 *
 * A DECISÃO DO DONO, 02/09/2026: os campos REFERÊNCIA e PEÇA viram um número
 * só. O formato é COLADO — só os DÍGITOS da referência, seguidos da sequência
 * da peça, sem separador e sem zeros de enchimento:
 *
 *     referência H0015S, peça 1   →  00151
 *     referência H0015S, peça 12  →  001512
 *     referência C0011S, peça 3   →  00113
 *
 * ⚠️ A TRAVA. Colado só não é ambíguo ENQUANTO TODA REFERÊNCIA TIVER A MESMA
 * QUANTIDADE DE DÍGITOS. Hoje são quatro (0011, 0012, 0015), então "001512" só
 * pode ser a referência 0015 na peça 12. No dia em que entrar uma de três ou de
 * cinco, "001512" passa a poder ser 0015+12 OU 00151+2 — e um número de série
 * que aponta para duas bolsas não é número de série. O dono escolheu o formato
 * sabendo disso; `serieAmbigua` existe para a tela avisar antes que aconteça.
 *
 * ESTA REGRA JÁ EXISTE DO OUTRO LADO, na página pública do certificado
 * (`vessel-brasil/verify/regras.js`). As duas são a MESMA conta de propósito: o
 * número que a etiqueta manda para a cliente e o número que o painel imprime na
 * bancada têm de ser o mesmo, senão a bolsa da mão não bate com a bolsa da tela.
 * Se um dia uma mudar, a outra muda junto — não há terceira dona da regra.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIGITOS_DA_REFERENCIA, numeroDeSerie, serieAmbigua, avisoDeSerieAmbigua,
  rotuloDaSerie, descricaoDaPeca, linhasDaListaDoLote,
} from './lotes.js'

/* ── 1. O FORMATO QUE O DONO ESCOLHEU ─────────────────────────────────────── */

test('o número de série é os DÍGITOS da referência colados na sequência da peça', () => {
  assert.equal(numeroDeSerie('H0015S', 1), '00151')
  assert.equal(numeroDeSerie('H0015S', 12), '001512')
  assert.equal(numeroDeSerie('C0011S', 3), '00113')
})

test('sem separador e sem zero de enchimento: a peça 1 não vira "01"', () => {
  // padStart aqui inventaria um número que a etiqueta da cliente não tem
  assert.equal(numeroDeSerie('H0015S', 1), '00151')
  assert.equal(numeroDeSerie('H0015S', 9), '00159')
  assert.equal(numeroDeSerie('H0015S', 10), '001510')
  assert.equal(numeroDeSerie('H0015S', 500), '0015500')
})

test('as letras da referência não entram — só os dígitos', () => {
  assert.equal(numeroDeSerie('LV1021', 7), '10217')
  assert.equal(numeroDeSerie('h0015s', 7), '00157')
  assert.equal(numeroDeSerie(' H0015S ', 7), '00157')
  assert.equal(numeroDeSerie('H-0015/S', 7), '00157')
})

/* ── 2. SEM REFERÊNCIA NÃO HÁ NÚMERO DE SÉRIE ─────────────────────────────── */

test('referência vazia, nula ou só de letras não produz número de série', () => {
  // a tela mostra então o que já mostrava (`nº 3`), que é a verdade que se tem —
  // e nunca um traço, que não diz nada
  assert.equal(numeroDeSerie('', 3), '')
  assert.equal(numeroDeSerie(null, 3), '')
  assert.equal(numeroDeSerie(undefined, 3), '')
  assert.equal(numeroDeSerie('SEMNUMERO', 3), '')
})

/* ── 3. A GUARDA QUE `Number.isFinite` DEIXAVA PASSAR ─────────────────────── */

test('`Number(null)` é ZERO e é finito — a guarda exige inteiro MAIOR QUE ZERO', () => {
  // Este teste é o que pegou o defeito do outro lado: com `Number.isFinite`, a
  // peça sem número saía como "0015null" na cara da pessoa. Não é sutileza de
  // tipo: é um número de série publicado com a palavra "null" dentro.
  for (const ruim of [null, undefined, '', 0, -1, 1.5, NaN, Infinity, 'abc', {}, []]) {
    const saida = numeroDeSerie('H0015S', ruim)
    assert.equal(saida, '', `numeroDeSerie('H0015S', ${JSON.stringify(ruim)}) devia ser vazio`)
    assert.doesNotMatch(saida, /null|undefined|NaN/,
      'nunca pode sair um número de série com "null" dentro')
  }
})

test('sequência escrita como texto de um inteiro vale — é o que vem do banco', () => {
  assert.equal(numeroDeSerie('H0015S', '12'), '001512')
})

/* ── 4. A TRAVA DA AMBIGUIDADE ────────────────────────────────────────────── */

test('hoje a referência tem quatro dígitos, e é isso que sustenta o formato colado', () => {
  assert.equal(DIGITOS_DA_REFERENCIA, 4)
})

test('referência com quantidade de dígitos diferente de quatro é AMBÍGUA', () => {
  assert.equal(serieAmbigua('H0015S'), false, '0015 tem quatro — é o padrão de hoje')
  assert.equal(serieAmbigua('C0011S'), false)
  assert.equal(serieAmbigua('H015S'), true, 'três dígitos')
  assert.equal(serieAmbigua('H00151S'), true, 'cinco dígitos')
})

test('referência sem dígito nenhum não é ambígua — ela simplesmente não tem série', () => {
  // avisar aqui seria aviso que aparece sempre, e aviso que aparece sempre vira
  // paisagem (PADRÃO item 9)
  assert.equal(serieAmbigua(''), false)
  assert.equal(serieAmbigua(null), false)
  assert.equal(serieAmbigua('SEMNUMERO'), false)
})

test('o aviso diz quantos dígitos são, e mostra as DUAS leituras possíveis', () => {
  assert.equal(avisoDeSerieAmbigua('H0015S'), '', 'com quatro dígitos não há o que avisar')
  assert.equal(avisoDeSerieAmbigua(''), '')
  const aviso = avisoDeSerieAmbigua('H00151S')
  assert.match(aviso, /5 dígitos/, 'a pessoa precisa saber QUANTOS são')
  assert.match(aviso, /4 dígitos|quatro/, 'e quantos as outras têm')
  // sem os dois exemplos lado a lado, "ambíguo" é palavra de programador
  assert.match(aviso, /001512/)
  assert.match(aviso, /Nada está bloqueado|Nada foi bloqueado/,
    'a tela avisa, não impede: quem decide se a referência muda é o dono')
})

/* ── 5. O RÓTULO QUE A TELA ESCREVE ───────────────────────────────────────── */

test('com referência, o rótulo é o número de série', () => {
  assert.equal(rotuloDaSerie({ numero_na_serie: 12 }, { sku: 'H0015S' }), 'nº de série 001512')
})

test('SEM referência o rótulo volta a ser o `nº 3` de sempre', () => {
  // a verdade que se tem, em vez de um traço que não diz nada
  assert.equal(rotuloDaSerie({ numero_na_serie: 3 }, { sku: '' }), 'nº 3')
  assert.equal(rotuloDaSerie({ numero_na_serie: 3 }, null), 'nº 3')
  assert.equal(rotuloDaSerie({ numero_na_serie: 3 }, {}), 'nº 3')
})

test('sem peça e sem número não sai rótulo nenhum — nem "nº undefined"', () => {
  assert.equal(rotuloDaSerie(null, { sku: 'H0015S' }), '')
  assert.equal(rotuloDaSerie({}, { sku: 'H0015S' }), '')
  assert.equal(rotuloDaSerie({ numero_na_serie: null }, null), '')
})

/* ── 6. ONDE A PEÇA É NOMEADA, ELA É NOMEADA PELO NÚMERO DE SÉRIE ─────────── */

test('descricaoDaPeca nomeia a bolsa pelo número de série quando há referência', () => {
  const f = descricaoDaPeca(
    { numero_na_serie: 7, codigo: 'k7m4x9qp2r' },
    { modelo: 'Mônaco', cor: 'Quartz', sku: 'H0015S' })
  assert.equal(f, 'Mônaco · Quartz · nº de série 00157 — K7M4X9QP2R')
})

test('descricaoDaPeca sem referência continua dizendo `nº 7`, como sempre disse', () => {
  const f = descricaoDaPeca(
    { numero_na_serie: 7, codigo: 'k7m4x9qp2r' },
    { modelo: 'Mônaco', cor: 'Quartz' })
  assert.equal(f, 'Mônaco · Quartz · nº 7 — K7M4X9QP2R')
})

/* ── 7. A LISTA QUE SE BAIXA EM PLANILHA ──────────────────────────────────── */

test('a lista do lote ganha a coluna do número de série, e ELA VEM PRIMEIRO', () => {
  // quem arquiva a ordem de produção procura pelo número que está na bolsa
  const csv = linhasDaListaDoLote(
    [{ numero_na_serie: 12, codigo: 'AAA111' }], { sku: 'H0015S' })
  const [cab, linha] = csv.split('\n')
  assert.equal(cab, 'numero de serie;numero;codigo;endereco;estado;gravada em;motivo da baixa')
  assert.match(linha, /^001512;12;AAA111;/)
})

test('a coluna do NÚMERO DA PEÇA continua na planilha — nada se perde', () => {
  // PADRÃO item 8. O número de série carrega só os DÍGITOS da referência: as
  // letras ("H", "S") não entram nele em lugar nenhum, e o número da peça é o
  // que casa com a ordem de produção antiga.
  const csv = linhasDaListaDoLote([{ numero_na_serie: 12, codigo: 'AAA111' }], { sku: 'H0015S' })
  assert.match(csv.split('\n')[0], /numero de serie;numero;/)
})

test('lote sem referência: a coluna existe e sai VAZIA, nunca com "null" dentro', () => {
  const csv = linhasDaListaDoLote([{ numero_na_serie: 12, codigo: 'AAA111' }])
  const [cab, linha] = csv.split('\n')
  assert.match(cab, /^numero de serie;/)
  assert.match(linha, /^;12;AAA111;/)
  assert.doesNotMatch(csv, /null|undefined|NaN/)
})
