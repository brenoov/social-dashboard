// Os formatos de publicação do Instagram e as regras de arquivo de cada um.
//
// As mensagens de erro daqui vão direto para a tela, então são escritas para
// quem não é técnico: dizem qual arquivo, qual o problema e qual é o limite.
//
// As chaves precisam bater com o CHECK de `conteudo_pecas.formato`.

export const LIMITE_IMAGEM = 15 * 1024 * 1024   // 15 MB
export const LIMITE_VIDEO = 300 * 1024 * 1024   // 300 MB

// HEIC/HEIF é o padrão da câmera do iPhone. Ficar de fora fazia o erro mais
// provável do primeiro uso ser justamente "arrastei a foto do meu celular".
// O Instagram converte na hora de publicar, então aceitar aqui não cria
// problema lá na frente.
const MIMES_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MIMES_VIDEO = ['video/mp4', 'video/quicktime']

// O que dizer quando o arquivo não serve. Listar a extensão (e não o tipo MIME)
// porque é o que a pessoa vê no nome do arquivo.
export const EXTENSOES_ACEITAS = 'JPG, PNG, WEBP, HEIC, MP4 ou MOV'

export const FORMATOS = [
  {
    chave: 'feed',
    rotulo: 'Post do feed',
    ajuda: 'Uma imagem ou um vídeo só.',
    minArquivos: 1,
    maxArquivos: 1,
    mimes: [...MIMES_IMAGEM, ...MIMES_VIDEO],
  },
  {
    chave: 'carrossel',
    rotulo: 'Carrossel',
    ajuda: 'De 2 a 20 imagens ou vídeos, na ordem em que vão aparecer.',
    minArquivos: 2,
    maxArquivos: 20,
    mimes: [...MIMES_IMAGEM, ...MIMES_VIDEO],
  },
  {
    chave: 'reels',
    rotulo: 'Reels',
    ajuda: 'Só vídeo, em pé (9:16).',
    minArquivos: 1,
    maxArquivos: 1,
    mimes: [...MIMES_VIDEO],
  },
  {
    chave: 'stories',
    rotulo: 'Story',
    ajuda: 'Uma imagem ou um vídeo, em pé (9:16). Some em 24 horas.',
    minArquivos: 1,
    maxArquivos: 1,
    mimes: [...MIMES_IMAGEM, ...MIMES_VIDEO],
  },
]

const _porChave = Object.fromEntries(FORMATOS.map(f => [f.chave, f]))

export function regrasDoFormato(chave) {
  return _porChave[chave] || null
}

export function tipoDoMime(mime) {
  if (typeof mime !== 'string') return null
  if (mime.startsWith('image/')) return 'imagem'
  if (mime.startsWith('video/')) return 'video'
  return null
}

function _mb(bytes) {
  // Uma casa decimal só: "15 MB" e "1,5 MB" leem melhor que "15,00 MB".
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

// Peso de arquivo para mostrar na lista. Abaixo de 1 MB vai em KB, senão a
// coluna fica cheia de "0,0 MB".
export function formatarBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return _mb(n)
}

function _nome(arquivo) {
  return arquivo?.nome || 'o arquivo'
}

// Devolve a LISTA de problemas (vazia = tudo certo). Lista, não o primeiro
// problema: quem sobe 8 fotos quer saber de todas as que estão erradas de uma
// vez, não descobrir uma por vez a cada tentativa.
export function validarArquivos(formato, arquivos) {
  const regras = regrasDoFormato(formato)
  if (!regras) return [`Não conheço o formato "${formato}".`]

  const lista = Array.isArray(arquivos) ? arquivos : []
  const problemas = []

  if (lista.length < regras.minArquivos) {
    problemas.push(
      regras.minArquivos === 1
        ? `${regras.rotulo} precisa de 1 arquivo. Nenhum foi enviado.`
        : `${regras.rotulo} precisa de pelo menos ${regras.minArquivos} arquivos — você enviou ${lista.length}.`,
    )
  }
  if (lista.length > regras.maxArquivos) {
    problemas.push(
      `${regras.rotulo} aceita no máximo ${regras.maxArquivos} arquivos — você enviou ${lista.length}.`,
    )
  }

  for (const arquivo of lista) {
    const tipo = tipoDoMime(arquivo?.mime)

    // TODA MENSAGEM DE RECUSA TERMINA DIZENDO O QUE SERVE. Antes elas paravam
    // no diagnóstico ("não é uma imagem nem um vídeo") e deixavam a pessoa
    // adivinhando — e o caso mais comum, a foto do iPhone, caía exatamente aí.
    if (!tipo) {
      problemas.push(
        `${_nome(arquivo)} não é uma imagem nem um vídeo que o Instagram aceite. `
        + `Use ${EXTENSOES_ACEITAS}.`,
      )
      continue
    }
    if (!regras.mimes.includes(arquivo.mime)) {
      const soVideo = regras.mimes.includes(MIMES_VIDEO[0]) && !regras.mimes.includes(MIMES_IMAGEM[0])
      problemas.push(
        soVideo
          ? `${_nome(arquivo)}: ${regras.rotulo} só aceita vídeo — use MP4 ou MOV.`
          : `${_nome(arquivo)}: ${regras.rotulo} não aceita este tipo de arquivo. Use ${EXTENSOES_ACEITAS}.`,
      )
      continue
    }

    const limite = tipo === 'video' ? LIMITE_VIDEO : LIMITE_IMAGEM
    const bytes = Number(arquivo?.bytes)
    if (Number.isFinite(bytes) && bytes > limite) {
      problemas.push(
        `${_nome(arquivo)} tem ${_mb(bytes)} e o limite para ${tipo === 'video' ? 'vídeo' : 'imagem'} é ${_mb(limite)}.`,
      )
    }
  }

  return problemas
}
