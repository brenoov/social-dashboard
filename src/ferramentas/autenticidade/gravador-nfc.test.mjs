import test from 'node:test'
import assert from 'node:assert/strict'
import { temSuporte, urlDaMensagem, traduzirFalha, criarGravador } from './gravador-nfc.js'

// ── um NDEFReader de mentira ────────────────────────────────────────────────
// node --test nao abre navegador e nao tem NDEFReader. E por isso que ele entra
// por injecao: sem isso, nada aqui seria testavel.
function janelaDeMentira({ aoLer, aoGravar, aoTravar } = {}) {
  class NDEFReaderFalso {
    async scan() {
      if (typeof aoLer === 'function') return aoLer(this)
    }
    async write(dado) {
      if (typeof aoGravar === 'function') return aoGravar(dado)
    }
    async makeReadOnly() {
      if (typeof aoTravar === 'function') return aoTravar()
    }
    addEventListener(nome, ouvinte) { (this.ouvintes ||= {})[nome] = ouvinte }
  }
  return { NDEFReader: NDEFReaderFalso }
}

const mensagemComUrl = (url) => ({
  records: [{ recordType: 'url', encoding: 'utf-8', data: new TextEncoder().encode(url) }],
})

test('temSuporte: falso quando o navegador nao tem NDEFReader', () => {
  assert.equal(temSuporte({}), false)
})

test('temSuporte: verdadeiro quando tem', () => {
  assert.equal(temSuporte(janelaDeMentira()), true)
})

test('urlDaMensagem: tira o endereco do registro de url', () => {
  assert.equal(
    urlDaMensagem(mensagemComUrl('https://vesselbrasil.com.br/verify/AAA111')),
    'https://vesselbrasil.com.br/verify/AAA111',
  )
})

test('urlDaMensagem: etiqueta em branco devolve vazio', () => {
  assert.equal(urlDaMensagem({ records: [] }), '')
  assert.equal(urlDaMensagem(null), '')
})

test('urlDaMensagem: ignora registro que nao e endereco', () => {
  const so_texto = { records: [{ recordType: 'text', data: new TextEncoder().encode('oi') }] }
  assert.equal(urlDaMensagem(so_texto), '')
})

test('traduzirFalha: etiqueta pequena demais', () => {
  const e = new Error('x'); e.name = 'NotSupportedError'
  assert.match(traduzirFalha(e), /espaço/i)
})

test('traduzirFalha: NFC desligado', () => {
  const e = new Error('x'); e.name = 'NotReadableError'
  assert.match(traduzirFalha(e), /ligue o nfc/i)
})

test('traduzirFalha: etiqueta saiu de perto', () => {
  const e = new Error('x'); e.name = 'NetworkError'
  assert.match(traduzirFalha(e), /encoste de novo/i)
})

test('traduzirFalha: permissao negada', () => {
  const e = new Error('x'); e.name = 'NotAllowedError'
  assert.match(traduzirFalha(e), /permiss/i)
})

test('traduzirFalha: falha desconhecida nao vira mensagem vazia', () => {
  const e = new Error('coisa estranha'); e.name = 'CoisaEstranha'
  const frase = traduzirFalha(e)
  assert.ok(frase.length > 10, 'a frase precisa dizer alguma coisa')
})

test('criarGravador: devolve nulo quando o navegador nao grava NFC', () => {
  assert.equal(criarGravador({ janela: {} }), null)
})

test('criarGravador: gravar passa o endereco adiante', async () => {
  let recebido = null
  const g = criarGravador({ janela: janelaDeMentira({ aoGravar: (d) => { recebido = d } }) })
  await g.gravar('https://vesselbrasil.com.br/verify/AAA111')
  assert.equal(recebido, 'https://vesselbrasil.com.br/verify/AAA111')
})

test('criarGravador: travar chama makeReadOnly', async () => {
  let travou = false
  const g = criarGravador({ janela: janelaDeMentira({ aoTravar: () => { travou = true } }) })
  await g.travar()
  assert.equal(travou, true)
})

test('criarGravador: lerUmaVez devolve o endereco que veio na etiqueta', async () => {
  const janela = janelaDeMentira({
    aoLer: (leitor) => { setTimeout(() => leitor.ouvintes.reading({ message: mensagemComUrl('https://vesselbrasil.com.br/verify/AAA111') }), 0) },
  })
  const g = criarGravador({ janela })
  assert.equal(await g.lerUmaVez({ milissegundos: 500 }),
    'https://vesselbrasil.com.br/verify/AAA111')
})

test('criarGravador: lerUmaVez desiste quando ninguem encosta a etiqueta', async () => {
  // A recusa carrega o NOME do erro, nao a frase em portugues: traduzir e
  // trabalho de traduzirFalha, e so dele. Conferir a frase aqui amarraria dois
  // trabalhos no mesmo teste.
  const g = criarGravador({ janela: janelaDeMentira({ aoLer: () => {} }) })
  await assert.rejects(
    () => g.lerUmaVez({ milissegundos: 30 }),
    (erro) => erro.name === 'AbortError',
  )
})
