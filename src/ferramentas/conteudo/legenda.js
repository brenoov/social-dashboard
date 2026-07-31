// Montagem e contagem da legenda do post.
//
// A legenda final é o que a pessoa vai copiar e colar no Instagram na hora H,
// então ela precisa sair pronta: legenda + blocos reutilizáveis + hashtags,
// separados por linha em branco, sem sobra de espaço nem linha vazia à toa.

export const LIMITE_LEGENDA = 2200   // limite do Instagram
export const LIMITE_HASHTAGS = 30    // limite do Instagram

function _limpo(txt) {
  return typeof txt === 'string' ? txt.trim() : ''
}

// Junta legenda, blocos e hashtags na ordem em que aparecem no post.
// Partes vazias somem — é isso que evita a legenda começar com duas quebras.
export function montarLegendaFinal(legenda, hashtags, blocos = []) {
  const partes = [
    _limpo(legenda),
    ...(Array.isArray(blocos) ? blocos.map(_limpo) : []),
    _limpo(hashtags),
  ]
  return partes.filter(Boolean).join('\n\n')
}

// Conta como o Instagram conta: por caractere visível, não por code unit.
// [...texto] percorre por code point, então um emoji vale 1 e não 2.
export function contarCaracteres(texto) {
  return typeof texto === 'string' ? [...texto].length : 0
}

// Aceita o jeito que a pessoa digitar: "#um dois, #três" ou "um, dois".
// Devolve sempre com cerquilha, sem repetição (ignorando maiúsculas).
export function listarHashtags(texto) {
  if (typeof texto !== 'string') return []
  const vistas = new Set()
  const saida = []
  for (const bruta of texto.split(/[\s,]+/)) {
    const palavra = bruta.replace(/^#+/, '').trim()
    if (!palavra) continue
    const chave = palavra.toLowerCase()
    if (vistas.has(chave)) continue
    vistas.add(chave)
    saida.push(`#${palavra}`)
  }
  return saida
}

// Reduz um texto ao seu "esqueleto" para comparar duas legendas que deveriam
// ser a mesma. Usada na Fase 3, para casar a peça agendada com o post real do
// Instagram: entre o que foi escrito aqui e o que saiu lá quase sempre muda
// emoji, acento ou hashtag — mas o miolo do texto continua igual.
export function normalizarParaComparar(texto) {
  if (typeof texto !== 'string') return ''
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acento
    .replace(/[#@][\p{L}\p{N}_]+/gu, ' ')               // tira hashtag e arroba inteiras
    // Emoji + o seletor de variação (FE0F) e o juntador (200D) que montam as
    // sequências tipo 👨‍👩‍👧 — sem eles sobrariam caracteres invisíveis no meio.
    .replace(/[\p{Extended_Pictographic}️‍]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}
