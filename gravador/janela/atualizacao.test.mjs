import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarAtualizacao, tituloDaJanela, TITULO_BASE } from './atualizacao.js'

// Um dublê do autoUpdater: guarda os ouvintes e deixa o teste disparar cada um.
function dubleDoAtualizador({ aoProcurar } = {}) {
  const ouvintes = {}
  return {
    ouvintes,
    autoDownload: null,
    autoInstallOnAppQuit: null,
    on(evento, f) { (ouvintes[evento] ??= []).push(f) },
    disparar(evento, dado) { (ouvintes[evento] ?? []).forEach((f) => f(dado)) },
    async checkForUpdates() { if (aoProcurar) return aoProcurar() },
  }
}

test('o titulo mostra a versao que esta rodando', () => {
  assert.equal(tituloDaJanela('1.2.0'), `${TITULO_BASE} — v1.2.0`)
})

test('sem versao o titulo nao inventa nada', () => {
  assert.equal(tituloDaJanela(''), TITULO_BASE)
})

test('quando a atualizacao esta baixada o titulo DIZ o que fazer', () => {
  const t = tituloDaJanela('1.2.0', 'baixada')
  assert.match(t, /feche o programa para instalar/)
})

test('fora do instalador nao procura nada — e nao estoura', async () => {
  const d = dubleDoAtualizador({ aoProcurar: () => { throw new Error('nao deveria chegar aqui') } })
  const a = criarAtualizacao({ autoUpdater: d, versao: '1.0.0', empacotado: false })
  assert.equal(await a.procurar(), 'nao-procura')
})

test('baixa sozinha, mas instala so ao fechar', () => {
  const d = dubleDoAtualizador()
  criarAtualizacao({ autoUpdater: d, versao: '1.0.0' })
  assert.equal(d.autoDownload, true, 'tem de baixar sozinha')
  assert.equal(d.autoInstallOnAppQuit, true, 'NAO pode instalar no meio do expediente')
})

test('achou versao nova: o titulo avisa que esta baixando', () => {
  const d = dubleDoAtualizador(); let titulo = ''
  const a = criarAtualizacao({ autoUpdater: d, versao: '1.0.0', aoMudarTitulo: (t) => { titulo = t } })
  d.disparar('update-available', { version: '1.1.0' })
  assert.equal(a.estado(), 'baixando')
  assert.match(titulo, /baixando atualização/)
})

test('baixou: o titulo manda fechar para instalar', () => {
  const d = dubleDoAtualizador(); let titulo = ''
  const a = criarAtualizacao({ autoUpdater: d, versao: '1.0.0', aoMudarTitulo: (t) => { titulo = t } })
  d.disparar('update-downloaded', { version: '1.1.0' })
  assert.equal(a.estado(), 'baixada')
  assert.match(titulo, /ATUALIZAÇÃO PRONTA/)
})

test('erro ao procurar NAO derruba o programa e NAO muda o titulo', async () => {
  const d = dubleDoAtualizador({ aoProcurar: () => { throw new Error('sem internet') } })
  let titulo = ''; const recados = []
  const a = criarAtualizacao({
    autoUpdater: d, versao: '1.0.0',
    aoMudarTitulo: (t) => { titulo = t }, registrar: (m) => recados.push(m),
  })
  assert.equal(await a.procurar(), 'falhou')
  assert.equal(a.estado(), 'nada', 'quem grava nao pode ser incomodado por isso')
  assert.equal(titulo, `${TITULO_BASE} — v1.0.0`)
  assert.match(recados.join(' '), /sem internet/)
})

test('erro vindo do proprio atualizador tambem e engolido', () => {
  const d = dubleDoAtualizador(); const recados = []
  const a = criarAtualizacao({ autoUpdater: d, versao: '1.0.0', registrar: (m) => recados.push(m) })
  d.disparar('error', new Error('GitHub fora do ar'))
  assert.equal(a.estado(), 'nada')
  assert.match(recados.join(' '), /GitHub fora do ar/)
})
