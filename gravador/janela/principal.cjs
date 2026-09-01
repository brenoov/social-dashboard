// O PROGRAMA. É ele que abre a janela e empresta o leitor para a tela.
//
// TUDO O QUE ELE FAZ ESTÁ EM OUTROS ARQUIVOS, de propósito: aqui só se liga o
// Electron de verdade nas peças que já se provam com `node --test`. Este é o
// único arquivo da pasta que NÃO tem teste, e por isso ele não pode ter regra
// nenhuma dentro.
//
// ⚠️ POR QUE ELE É CommonJS E OS OUTROS SÃO ESM: o motor (`../leitor-de-mesa.js`
// e companhia) é ESM, e o `import()` dinâmico atravessa de CommonJS para ESM em
// qualquer Electron moderno. O caminho contrário — entrada em ESM — depende da
// versão e traz junto o sumiço do `__dirname`, que aqui é o que aponta o
// preload. Esta é a forma que menos surpreende na bancada.
const path = require('node:path')
const { app, BrowserWindow, shell, ipcMain } = require('electron')

let atendente = null

// UM PROGRAMA SÓ POR MÁQUINA. O ACR122U é segurado por um processo de cada vez:
// com duas janelas abertas, a segunda encontraria o leitor "tomado por outro
// programa" — e a frase, que está certa, mandaria a pessoa procurar defeito que
// não existe. Abrir de novo traz para a frente a janela que já está aberta.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [janela] = BrowserWindow.getAllWindows()
    if (!janela) return
    if (janela.isMinimized()) janela.restore()
    janela.focus()
  })

  app.whenReady().then(async () => {
    const [{ abrirAJanela }, { criarAtendente }, { criarLeitorDeVerdade }] = await Promise.all([
      import('./abrir-a-janela.js'),
      import('./atendente-do-leitor.js'),
      import('../leitor-de-mesa.js'),
    ])

    // O LEITOR SÓ NASCE NO PRIMEIRO PEDIDO. Criar aqui abriria o processo do
    // PowerShell antes de alguém querer gravar — e, num computador sem leitor
    // ligado, o programa morreria na abertura em vez de abrir a tela e explicar.
    atendente = criarAtendente({ criarLeitor: () => criarLeitorDeVerdade() })
    atendente.registrar(ipcMain)

    abrirAJanela({
      BrowserWindow,
      shell,
      caminhoDoPreload: path.join(__dirname, 'preload.cjs'),
    })
  })

  // Fechar a janela solta a etiqueta e fecha o processo do PowerShell. Sem isto
  // ele ficaria vivo segurando o leitor, e a próxima abertura encontraria o
  // aparelho tomado — por ele mesmo.
  app.on('window-all-closed', async () => {
    try { await atendente?.fechar() } catch { /* fechando de qualquer jeito */ }
    app.quit()
  })
}
