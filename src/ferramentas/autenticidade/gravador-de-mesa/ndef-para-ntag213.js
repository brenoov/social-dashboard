// O TRADUTOR DA ETIQUETA NTAG213.
//
// Recebe o endereço da peça e devolve EXATAMENTE o que escrever em cada página
// da etiqueta. Não fala com o leitor, não fala com USB, não tem DOM e não tem
// rede — é conta pura, como o resto do painel, e por isso se testa de verdade
// com `node --test`, sem etiqueta na mão.
//
// O DOMÍNIO NÃO MORA AQUI. O endereço chega pronto, de `enderecoDaTag`
// (lotes.js). Domínio em dois lugares é domínio errado esperando acontecer — e
// este vai gravado dentro de um chip costurado numa bolsa, onde não se corrige.

// ── A MEMÓRIA DA ETIQUETA (datasheet NXP) ──────────────────────────────────
// A NTAG213 tem páginas de 4 bytes. A página 3 é o Capability Container. As
// páginas 4 a 39 (0x04–0x27) são os 144 bytes de memória do usuário — o único
// lugar onde este arquivo pode escrever. A página 40 são as travas dinâmicas e
// as 41 a 44 são configuração e senha: escrever lá estraga a etiqueta.
const BYTES_POR_PAGINA = 4
export const PRIMEIRA_PAGINA = 4
export const ULTIMA_PAGINA = 39
export const BYTES_DE_USUARIO = (ULTIMA_PAGINA - PRIMEIRA_PAGINA + 1) * BYTES_POR_PAGINA // 144

// ── OS EMBRULHOS TLV (NFC Forum Type 2 Tag) ────────────────────────────────
const TLV_ENCHIMENTO = 0x00 // um byte só, serve de espaço em branco
const TLV_TRAVAS = 0x01 // Lock Control
const TLV_MENSAGEM = 0x03 // a mensagem NDEF
const TLV_FIM = 0xfe // terminador

// O campo de tamanho do TLV tem 1 byte quando o conteúdo tem menos de 255
// bytes. Numa etiqueta de 144 bytes isso nunca acontece, então a forma de 3
// bytes é código morto e NÃO está implementada aqui de propósito: código que
// nunca roda é código que ninguém conferiu. Quem garante isso é a conferência
// de espaço lá embaixo, que recusa muito antes de 255 bytes.

// ── O PREFIXO ABREVIADO DA URL (NFC Forum RTD-URI) ─────────────────────────
// O primeiro byte do conteúdo do registro não é texto: é um número que vale por
// um pedaço do começo da URL. `04` vale `https://`, então de
// `https://<algum-dominio>/verify/ABC` só vai `<algum-dominio>/verify/ABC` como
// texto — 7 bytes de economia numa etiqueta que tem 144.
//
// A tabela oficial tem 36 linhas (`tel:`, `mailto:`, bluetooth, `urn:`...).
// Aqui só entram as de endereço da web, que são as únicas que um endereço de
// peça pode ter. Copiar as outras de cabeça seria copiar uma delas errada.
// A ordem importa na hora de gravar: o `www.` tem de ser testado ANTES do que
// não tem, senão `https://www.x` viraria prefixo `04` com o `www.` no texto.
const PREFIXOS = [
  [0x02, 'https://www.'],
  [0x01, 'http://www.'],
  [0x04, 'https://'],
  [0x03, 'http://'],
  [0x00, ''], // sem abreviação: a URL inteira vai como texto
]

// ── O REGISTRO NDEF DE URL ─────────────────────────────────────────────────
// Cabeçalho `D1 01 <tamanho> 55`:
//   D1 = primeiro e último registro da mensagem, forma curta, tipo conhecido
//   01 = o nome do tipo tem 1 byte
//   55 = 'U', de URI
function registroDeUrl(endereco) {
  const texto = String(endereco ?? '').trim()
  if (!texto) {
    throw new Error('Sem endereço para gravar: a etiqueta ficaria em branco dentro da bolsa.')
  }
  const [codigo, prefixo] = PREFIXOS.find(([, p]) => p && texto.toLowerCase().startsWith(p))
    || [0x00, '']
  const conteudo = [codigo, ...new TextEncoder().encode(texto.slice(prefixo.length))]
  return [0xd1, 0x01, conteudo.length, 0x55, ...conteudo]
}

// Aceita array comum ou Uint8Array. Qualquer outra coisa — nulo, texto, número,
// "não li nada" — vira memória desconhecida, e memória desconhecida é tratada
// como etiqueta sem Lock Control: a mensagem começa na página 4.
function bytesLidos(memoriaAtual) {
  if (Array.isArray(memoriaAtual)) return memoriaAtual
  if (ArrayBuffer.isView(memoriaAtual)) return Array.from(memoriaAtual)
  return []
}

// ONDE A MENSAGEM PODE COMEÇAR.
//
// ⚠️ A ARMADILHA QUE MAIS IMPORTA: uma NTAG213 de fábrica NÃO vem em branco. As
// páginas 4 e 5 saem da fábrica com `01 03 A0 0C 34 03 00 FE` — os cinco
// primeiros bytes são um Lock Control TLV. Escrever por cima dele às cegas
// destrói uma estrutura que a etiqueta espera ter. Por isso este arquivo NÃO
// decide sozinho onde começar: ele lê o que já está lá.
function ondeComecaAMensagem(memoria) {
  if (memoria[0] !== TLV_TRAVAS) return 0
  const tamanho = memoria[1]
  if (typeof tamanho !== 'number') {
    throw new Error(
      'A leitura da etiqueta parou no meio do Lock Control. '
      + 'Leia as páginas 4 e 5 inteiras antes de gravar.',
    )
  }
  // 1 byte de tipo + 1 de tamanho + o conteúdo. Na NTAG213 é sempre `01 03` e
  // dá 5, mas o tamanho se lê da etiqueta em vez de se supor.
  return 2 + tamanho
}

// Recebe o endereço e o que JÁ ESTÁ gravado na memória do usuário (bytes lidos
// a partir da página 4; pode vir vazio quando não se leu nada).
// Devolve a lista de escritas: [{ pagina: 4, bytes: [.., .., .., ..] }, ...]
export function planoDeGravacao(endereco, memoriaAtual) {
  const memoria = bytesLidos(memoriaAtual)
  const inicio = ondeComecaAMensagem(memoria)

  const mensagem = registroDeUrl(endereco)
  const conteudo = [TLV_MENSAGEM, mensagem.length, ...mensagem, TLV_FIM]
  const fim = inicio + conteudo.length // primeiro byte DEPOIS do conteúdo

  // NÃO COUBE, ENTÃO NÃO GRAVA. Cortar o endereço no meio em silêncio grava uma
  // etiqueta que abre um endereço que não existe — a cliente encosta o celular
  // e conclui que a bolsa é falsa. E passar da página 39 escreve nas travas
  // dinâmicas e na senha da etiqueta, que é estragar a etiqueta de vez.
  if (fim > BYTES_DE_USUARIO) {
    throw new Error(
      `Este endereço é longo demais para a etiqueta: precisa de ${fim} bytes e `
      + `cabem ${BYTES_DE_USUARIO}. Encurte o endereço ou use uma etiqueta maior.`,
    )
  }

  const primeira = Math.floor(inicio / BYTES_POR_PAGINA)
  const ultima = Math.floor((fim - 1) / BYTES_POR_PAGINA)

  const escritas = []
  for (let pagina = primeira; pagina <= ultima; pagina++) {
    const bytes = []
    for (let i = 0; i < BYTES_POR_PAGINA; i++) {
      const onde = pagina * BYTES_POR_PAGINA + i
      if (onde < inicio) {
        // Byte que já estava na etiqueta — o rabo do Lock Control, que cai no
        // meio de uma página nossa. A escrita é de página inteira: se este byte
        // fosse zero, a trava iria embora junto com a gravação.
        if (typeof memoria[onde] !== 'number') {
          throw new Error(
            'Não dá para gravar sem ter lido a página inteira onde a mensagem começa: '
            + 'metade dela é do Lock Control da etiqueta.',
          )
        }
        bytes.push(memoria[onde])
      } else if (onde < fim) {
        bytes.push(conteudo[onde - inicio])
      } else {
        // A escrita é de 4 em 4 bytes, não existe meia página: o que sobra da
        // última vai com zero.
        bytes.push(TLV_ENCHIMENTO)
      }
    }
    escritas.push({ pagina: PRIMEIRA_PAGINA + pagina, bytes })
  }
  return escritas
}

// ── O CONTRÁRIO: O QUE ESTÁ NA ETIQUETA ────────────────────────────────────
// Conferir é metade do trabalho. É por aqui que se prova que a gravação deu
// certo, e é por aqui que se descobre que a etiqueta JÁ TEM outra peça antes de
// escrever por cima — gravar em cima apagaria a etiqueta de outra bolsa, que
// não tem como ser reaberta para trocar.

// Lê UM registro NDEF e devolve o endereço dele. Devolve '' para tudo que não
// for um registro de URL: registro de texto, de tipo estranho, cortado no meio.
// Vazio quer dizer "não achei endereço aqui" — nunca um endereço adivinhado.
function enderecoDoRegistro(bytes) {
  let i = 0
  const cabecalho = bytes[i++]
  if (typeof cabecalho !== 'number') return ''
  const tipoDeNome = cabecalho & 0x07 // TNF: 1 = tipo conhecido do NFC Forum
  const forma_curta = (cabecalho & 0x10) !== 0
  const temId = (cabecalho & 0x08) !== 0
  // A forma longa gasta 4 bytes de tamanho e só existe acima de 255 bytes de
  // conteúdo — não cabe numa etiqueta de 144. Se aparecer, é lixo.
  if (tipoDeNome !== 0x01 || !forma_curta) return ''

  const tamanhoDoNome = bytes[i++]
  const tamanhoDoConteudo = bytes[i++]
  const tamanhoDoId = temId ? bytes[i++] : 0
  const nome = bytes.slice(i, i + tamanhoDoNome)
  i += tamanhoDoNome + tamanhoDoId
  if (tamanhoDoNome !== 1 || nome[0] !== 0x55) return '' // 55 = 'U', de URI

  const conteudo = bytes.slice(i, i + tamanhoDoConteudo)
  if (conteudo.length !== tamanhoDoConteudo || conteudo.length === 0) return ''
  const prefixo = PREFIXOS.find(([codigo]) => codigo === conteudo[0])
  if (!prefixo) return '' // `tel:`, `mailto:` e companhia não são endereço de peça
  return prefixo[1] + new TextDecoder().decode(Uint8Array.from(conteudo.slice(1)))
}

// Recebe os bytes lidos da etiqueta (a partir da página 4) e devolve o endereço
// que está lá — ou '' se não houver mensagem NDEF de URL.
export function enderecoNaEtiqueta(memoriaAtual) {
  const memoria = bytesLidos(memoriaAtual)
  let i = 0
  while (i < memoria.length) {
    const tipo = memoria[i]
    if (tipo === TLV_FIM) return '' // terminador: daqui para a frente não há nada
    if (tipo === TLV_ENCHIMENTO) { i += 1; continue } // enchimento gasta 1 byte só
    const tamanho = memoria[i + 1]
    if (typeof tamanho !== 'number' || tamanho === 0xff) return ''
    if (tipo === TLV_MENSAGEM) return enderecoDoRegistro(memoria.slice(i + 2, i + 2 + tamanho))
    // qualquer outro embrulho (Lock Control, memória reservada) se pula inteiro
    i += 2 + tamanho
  }
  return ''
}
