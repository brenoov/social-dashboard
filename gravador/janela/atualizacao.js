// A ATUALIZAÇÃO SOZINHA — as regras, longe do `principal.cjs`.
//
// O `principal.cjs` não pode ter regra dentro (ele é o único arquivo da pasta
// sem teste). Então tudo o que DECIDE mora aqui, e recebe o `autoUpdater` por
// injeção: assim o teste roda com um dublê, sem Electron e sem rede.

export const TITULO_BASE = 'Gravador de etiquetas de mesa — Vessel'

// O QUE A PESSOA NA BANCADA VÊ. A versão vai no título da janela porque a tela
// de dentro vem da web e não é nossa para escrever nela — e porque a pergunta
// "que versão está rodando aqui?" precisa ter resposta SEM abrir menu nenhum.
export function tituloDaJanela(versao, estado = 'nada') {
  const v = versao ? ` — v${versao}` : ''
  if (estado === 'baixando') return `${TITULO_BASE}${v} — baixando atualização…`
  if (estado === 'baixada') return `${TITULO_BASE}${v} — ATUALIZAÇÃO PRONTA: feche o programa para instalar`
  return `${TITULO_BASE}${v}`
}

export function criarAtualizacao({
  autoUpdater,
  versao = '',
  empacotado = true,
  aoMudarTitulo = () => {},
  registrar = () => {},
} = {}) {
  let estado = 'nada'

  const mostrar = () => aoMudarTitulo(tituloDaJanela(versao, estado))
  const mudarPara = (novo) => { estado = novo; mostrar() }

  // FORA DO INSTALADOR NÃO SE PROCURA NADA. Rodando pelo `npm run janela` não
  // existe o arquivo que diz de onde baixar, e o electron-updater estoura. Erro
  // no arranque do programa, por causa de uma checagem que nem era para
  // acontecer, é o pior tipo de defeito: assusta e não ensina nada.
  if (!empacotado || !autoUpdater) {
    mostrar()
    return { estado: () => estado, procurar: async () => 'nao-procura' }
  }

  // BAIXA SOZINHA, MAS INSTALA SÓ AO FECHAR. Instalar no meio do expediente
  // fecharia o programa com etiqueta na mão e com a fila pela metade. O
  // download roda em segundo plano; a troca acontece quando a pessoa termina.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on?.('update-available', (info) => {
    registrar(`versão nova encontrada: ${info?.version ?? '(sem número)'}`)
    mudarPara('baixando')
  })
  autoUpdater.on?.('update-not-available', () => registrar('já está na versão mais nova'))
  autoUpdater.on?.('update-downloaded', (info) => {
    registrar(`versão ${info?.version ?? '(sem número)'} baixada; instala ao fechar`)
    mudarPara('baixada')
  })

  // ERRO DE ATUALIZAÇÃO NUNCA PODE VIRAR SUSTO NA BANCADA. Sem internet, com o
  // GitHub fora do ar ou com o proxy da empresa no caminho, isto aqui falha — e
  // gravar etiqueta não depende disso. Registra e segue: o título não muda, e
  // quem está gravando não fica sabendo de nada.
  autoUpdater.on?.('error', (e) => registrar(`não consegui procurar atualização: ${e?.message ?? e}`))

  mostrar()

  return {
    estado: () => estado,
    async procurar() {
      try {
        await autoUpdater.checkForUpdates()
        return 'procurou'
      } catch (e) {
        registrar(`não consegui procurar atualização: ${e?.message ?? e}`)
        return 'falhou'
      }
    },
  }
}
