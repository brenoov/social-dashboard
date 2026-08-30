// A ÚNICA PORTA PARA O NFC DO NAVEGADOR.
//
// Todo o resto do painel é conta pura e se testa com `node --test`. Isto aqui
// não: `NDEFReader` só existe no Chrome do Android. Por isso ele entra por
// INJEÇÃO — o teste passa um de mentira e consegue simular etiqueta pequena
// demais, NFC desligado e etiqueta que saiu de perto no meio.
// Se este arquivo crescer para além de "falar com o chip", ele está errado.

export function temSuporte(janela = globalThis) {
  return typeof janela?.NDEFReader === 'function'
}

// Uma mensagem NFC tem vários registros; o nosso é o de endereço.
export function urlDaMensagem(mensagem) {
  for (const registro of mensagem?.records || []) {
    if (registro.recordType !== 'url' && registro.recordType !== 'absolute-url') continue
    try {
      return new TextDecoder(registro.encoding || 'utf-8').decode(registro.data)
    } catch { return '' }
  }
  return ''
}

// O navegador fala em nome de erro; quem grava está de pé na fábrica.
const FRASES = {
  NotSupportedError: 'Esta etiqueta não tem espaço para o endereço, ou não aceita gravação. Troque a etiqueta.',
  NotReadableError: 'Não consegui falar com a etiqueta. Ligue o NFC nos ajustes do celular e tente de novo.',
  NetworkError: 'A etiqueta saiu de perto no meio. Encoste de novo e segure parado.',
  AbortError: 'Passou do tempo. Encoste de novo e segure parado.',
  NotAllowedError: 'O navegador não deu permissão de NFC. Recarregue a página e aceite quando ele perguntar.',
}

export function traduzirFalha(erro) {
  const nome = erro?.name || ''
  return FRASES[nome]
    || `Não consegui gravar (${nome || 'motivo desconhecido'}). Encoste de novo; se repetir, troque a etiqueta.`
}

export function criarGravador({ janela = globalThis } = {}) {
  if (!temSuporte(janela)) return null
  const leitor = new janela.NDEFReader()

  return {
    // Lê UMA etiqueta e para. O tempo existe porque, sem ele, a tela ficaria
    // esperando para sempre alguém que já foi embora.
    async lerUmaVez({ milissegundos = 8000 } = {}) {
      return new Promise((resolver, recusar) => {
        const relogio = setTimeout(() => {
          recusar(Object.assign(new Error('sem etiqueta'), { name: 'AbortError' }))
        }, milissegundos)
        leitor.addEventListener('reading', (evento) => {
          clearTimeout(relogio)
          resolver(urlDaMensagem(evento?.message))
        })
        leitor.addEventListener('readingerror', () => {
          clearTimeout(relogio)
          recusar(Object.assign(new Error('leitura falhou'), { name: 'NotReadableError' }))
        })
        Promise.resolve(leitor.scan()).catch((e) => { clearTimeout(relogio); recusar(e) })
      })
    },

    async gravar(endereco) {
      await leitor.write(endereco)
    },

    // ⚠️ PERMANENTE. Etiqueta travada nunca mais se regrava. A tela só chama
    // isto com o interruptor ligado, e o interruptor nasce desligado.
    // O primeiro teste com etiqueta de verdade tem de ser numa descartável.
    async travar() {
      await leitor.makeReadOnly()
    },
  }
}
