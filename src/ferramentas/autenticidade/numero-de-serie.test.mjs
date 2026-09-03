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
import { readFileSync } from 'node:fs'
import {
  DIGITOS_DA_REFERENCIA, numeroDeSerie, serieAmbigua, avisoDeSerieAmbigua,
  rotuloDaSerie, prefixoDaSerie, descricaoDaPeca, linhasDaListaDoLote,
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

test('`curto` é só o número, para onde o cabeçalho da coluna já diz o que ele é', () => {
  assert.equal(rotuloDaSerie({ numero_na_serie: 12 }, { sku: 'H0015S' }, { curto: true }), '001512')
})

test('o `curto` NÃO encurta o fallback: sem referência a célula continua dizendo `nº 3`', () => {
  // é esse "nº" que avisa que ali não há número de série. Um "3" pelado embaixo
  // do cabeçalho "Nº DE SÉRIE" seria a tela dizendo que a série desta bolsa é 3.
  assert.equal(rotuloDaSerie({ numero_na_serie: 3 }, null, { curto: true }), 'nº 3')
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

/* ── 7½. O RÓTULO SÓ SOME ONDE O CABEÇALHO O SUBSTITUI ────────────────────
 * No computador a lista de peças é TABELA, e a coluna "Nº DE SÉRIE" diz o que
 * o número é. No celular a MESMA lista vira cartão e o cabeçalho some
 * (`display:none` na regra-base) — e ali "00151" encostado em "K7M4X001QP"
 * são dois amontoados de caractere sem nada dizendo qual é qual.
 * O prefixo é separado do número justamente para poder sumir só onde há
 * cabeçalho, em vez de sumir sempre. */

test('o prefixo existe quando há número de série, e não quando não há', () => {
  assert.equal(prefixoDaSerie({ numero_na_serie: 12 }, { sku: 'H0015S' }), 'nº de série ')
  // sem referência o número já sai como "nº 3": um prefixo aqui daria "nº de série nº 3"
  assert.equal(prefixoDaSerie({ numero_na_serie: 3 }, null), '')
  assert.equal(prefixoDaSerie({}, { sku: 'H0015S' }), '')
  assert.equal(prefixoDaSerie(null, null), '')
})

test('prefixo + número curto formam exatamente o rótulo longo', () => {
  // as duas formas não podem divergir: são a mesma frase, montada em dois
  // pedaços só para o pedaço da frente poder sumir no computador
  for (const lote of [{ sku: 'H0015S' }, { sku: '' }, null]) {
    for (const n of [1, 12, 500]) {
      const peca = { numero_na_serie: n }
      assert.equal(prefixoDaSerie(peca, lote) + rotuloDaSerie(peca, lote, { curto: true }),
        rotuloDaSerie(peca, lote))
    }
  }
})

/* ── 8. NA TELA ───────────────────────────────────────────────────────────
 * A regra pura acima é metade: o que decide se a pessoa vê o número de série é
 * o template. Estes testes leem o arquivo da tela — é o mesmo motor das provas
 * de tela das irmãs, e é o que impede que a regra fique certa e a tela velha.
 */
const tela = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8')
const template = tela.slice(0, tela.indexOf('<script setup>'))

test('as confirmações de excluir e de dar baixa nomeiam a peça pelo número de série', () => {
  // do outro lado destas duas perguntas há uma bolsa de couro. Perguntar "dar
  // baixa na peça 3?" com três lotes abertos é perguntar sobre três bolsas.
  assert.match(template, /Excluir a peça \{\{ rotuloDaSerie\(proxima, loteAtual\) \}\}, de código/)
  assert.match(template, /Dar baixa na peça \{\{ rotuloDaSerie\(proxima, loteAtual\) \}\}\?/)
})

test('a lista das peças baixadas nomeia a peça pelo número de série', () => {
  assert.match(template, /Peça \{\{ rotuloDaSerie\(pc, loteAtual\) \}\} — \{\{ rotuloDoMotivo/)
})

test('no celular o número de série leva o rótulo junto; no computador, o cabeçalho', () => {
  // a lista de peças é tabela no computador e cartão no celular. O cabeçalho
  // "Nº DE SÉRIE" nasce `display:none` e só o `@media (min-width)` o acende —
  // então é no computador, e SÓ nele, que o prefixo pode sumir.
  assert.match(template, /<span class="au-rot-serie">\{\{ prefixoDaSerie\(pc, l\) \}\}<\/span>/)
  const grande = estilo.slice(estilo.indexOf('@media (min-width:900px){'),
    estilo.lastIndexOf('@media (max-width:520px){'))
  assert.match(grande, /\.au-tabela-pecas \.au-rot-serie\{display:none\}/,
    'o prefixo tem de sumir no computador, onde o cabeçalho da coluna já o diz')
  assert.doesNotMatch(estilo.slice(0, estilo.indexOf('@media (min-width:900px){')),
    /\.au-rot-serie\{display:none\}/,
    'o prefixo sumiu na regra-base: aí ele some no celular também, que é onde ele serve')
})

test('nenhum lugar da tela escreve `nº {{ …numero_na_serie }}` à mão', () => {
  // varredura do arquivo INTEIRO, e não da lista que eu lembrei de conferir: é
  // assim que sobra um canto com o número velho depois de a regra ter mudado.
  // A ÚNICA EXCEÇÃO É O NÚMERO GRANDE DA BANCADA, logo abaixo.
  const sobras = [...template.matchAll(/nº \{\{ ([^}]+?)\.numero_na_serie \}\}/g)]
    .map((m) => m[0])
  assert.deepEqual(sobras, ['nº {{ proxima.numero_na_serie }}'],
    'sobrou um lugar mostrando o número da peça cru em vez do número de série')
})

/* ── 9. O NÚMERO GRANDE DA BANCADA CONTINUA SENDO A POSIÇÃO ──────────────── */

test('o "nº 8 de 20" da bancada NÃO virou número de série, e isso é decisão', () => {
  /* ELE NÃO IDENTIFICA A BOLSA: aponta a posição na fila. É a resposta para
   * "qual peça está na minha mão agora", lida de pé, de longe, no meio de um
   * gesto — e o número de série é PIOR nessa única coisa. Duas peças seguidas
   * são "001517" e "001518": a 32px, do outro lado da bancada, são a mesma
   * mancha, e só o último dígito separa uma da outra. "7 de 20" e "8 de 20" não
   * se confundem. E o "de 20" só existe com a sequência: "001518 de 20" não é
   * frase nenhuma.
   *
   * Quem identifica a bolsa ali é o endereço ao lado, o código, e a fila logo
   * abaixo — que desde esta entrega diz o número de série de cada peça.
   *
   * Este teste existe para que a próxima pessoa que "padronizar" a tela tenha
   * de apagar a decisão de propósito, e não de passagem. */
  assert.match(template,
    /class="au-bancada-peca">\s*nº \{\{ proxima\.numero_na_serie \}\} de \{\{ loteAtual\?\.quantidade \}\}/,
    'o número grande da bancada mudou: ele é a POSIÇÃO na fila, não a identidade da bolsa')
})

/* ── 10. A TRAVA DA AMBIGUIDADE, NA TELA ─────────────────────────────────── */

const script = tela.slice(tela.indexOf('<script setup>'))
const estilo = tela.slice(tela.indexOf('<style'))

test('as DUAS portas do lote avisam quando a referência faria número de série ambíguo', () => {
  // só a criação não basta — a referência também se corrige na edição; só a
  // edição não basta — é na criação que ela entra
  assert.match(script, /const avisoDaSerieNova = computed\(\(\) => avisoDeSerieAmbigua\(novo\.sku\)\)/)
  assert.match(script, /const avisoDaSerieEditada = computed\(\(\) => avisoDeSerieAmbigua\(edicao\.sku\)\)/)
  assert.match(template, /v-if="avisoDaSerieNova"/)
  assert.match(template, /v-if="avisoDaSerieEditada"/)
})

test('o aviso segue o que está DIGITADO, e não o que está gravado', () => {
  // quem está corrigindo a referência precisa ver o aviso sumir enquanto digita
  for (const campo of ['novo.sku', 'edicao.sku']) {
    assert.ok(script.includes(`avisoDeSerieAmbigua(${campo})`),
      `o aviso não lê ${campo}: ele mostraria o estado de antes da correção`)
  }
})

test('a tela AVISA e não IMPEDE: nada trava por causa da ambiguidade', () => {
  // o dono escolheu o formato sabendo da ressalva. Quem decide se a referência
  // muda é ele, e um botão travado tiraria essa decisão dele.
  assert.doesNotMatch(script, /serieAmbigua\([^)]*\)[^\n]*\breturn\b/,
    'alguma conta passou a recusar por causa da ambiguidade — o combinado é avisar')
  assert.doesNotMatch(template, /:disabled="[^"]*[sS]erie[aA]mbigua/,
    'um botão ficou travado pela ambiguidade — o combinado é avisar, não impedir')
})

test('o cartão do lote mostra o selo, e a referência CRUA continua lá', () => {
  // PADRÃO item 8: o número de série leva só os DÍGITOS da referência. As letras
  // ("H", "S") não entram nele em lugar nenhum — sem esta linha elas sumiriam da
  // tela inteira, e este é o lugar delas.
  assert.match(template, /<span v-if="l\.sku" class="au-ref">ref\. \{\{ l\.sku \}\}<\/span>/,
    'a referência crua sumiu do cartão: as letras dela não moram em mais lugar nenhum')
  assert.match(template, /v-if="serieAmbigua\(l\.sku\)" class="selo selo-atencao"/)
})

test('o aviso é bloco de aviso da casa, e não cor escolhida no olho', () => {
  // PADRÃO item 2: cor só de token, e o texto em `--text` porque a cor é o
  // SINAL. `.au-confirma` é o desenho de aviso que esta tela já tem.
  assert.match(template, /class="au-confirma au-aviso-serie/,
    'o aviso tem de reaproveitar `.au-confirma`, o bloco de aviso desta tela')
  const regra = estilo.match(/\n\.au-aviso-serie\{([^}]*)\}/)
  assert.ok(regra, 'sumiu a regra do recuo do aviso')
  assert.doesNotMatch(regra[1], /#[0-9a-f]{3,8}/i, 'hex de cor no aviso')
  assert.doesNotMatch(regra[1], /font-size:\s*\d/, 'tamanho de texto escolhido no olho')
})

test('o recuo do celular do aviso vive no `@media` do FIM do arquivo', () => {
  // duas regras de mesma especificidade, ganha a última: um ajuste de celular
  // escrito antes das regras-base seria apagado em silêncio
  const celular = estilo.lastIndexOf('@media (max-width:520px){')
  assert.notEqual(celular, -1)
  assert.ok(estilo.indexOf('.au-aviso-serie{') < celular,
    'a regra-base do aviso tem de vir ANTES do `@media` do celular')
  assert.match(estilo.slice(celular), /\.au-aviso-serie\{margin-left:16px/,
    'o aviso não recuou junto com os campos a 375px')
})
