// Lógica PURA da aba "Pastas & Acessos" (o master-detail de pastas x pessoas).
//
// Como os outros .js desta pasta, aqui NÃO se importa nada, NÃO se fala com o
// banco e NÃO se mexe no DOM. É de propósito: assim dá pra testar com
// `node --test` sem subir a tela. A tela chama estas funções passando o que ela
// já recebeu do proxy/banco; aqui a gente só decide TEXTO honesto e agrupa dado.

// Paleta fixa de cores de avatar. É a "cor do perfil" da pessoa — decorativa e
// determinística: a MESMA pessoa cai SEMPRE na mesma cor (bom pra reconhecer de
// relance). Não sai dos tokens de tema porque isto é sinalização de IDENTIDADE
// (igual à bolinha colorida de app de mensagem), não chrome de UI; e precisa de
// muitas cores distintas, que os tokens não oferecem. As cores foram escolhidas
// pra ter contraste suficiente com texto branco no tema claro E no escuro.
export const PALETA_AVATAR = [
  '#1d4ed8', '#137a4b', '#b45c00', '#7a4fd0',
  '#0e7c86', '#c01f3c', '#5b6b8c', '#9a3d9a',
]

// Escolhe a cor do avatar de forma determinística a partir de uma semente
// (e-mail ou nome). Mesma semente => mesma cor, sempre.
export function corDeAvatar(semente) {
  const s = String(semente == null ? '' : semente)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETA_AVATAR[h % PALETA_AVATAR.length]
}

// Primeira letra pro avatar. Cai no e-mail se não tiver nome, e num "?" se não
// tiver nada — nunca devolve vazio (o círculo ficaria estranho).
export function inicialDe(nome, email) {
  const base = String(nome || email || '').trim()
  const ch = base.charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

/**
 * Decide, de forma HONESTA, o que a coluna de detalhe deve dizer sobre "quem tem
 * acesso" a uma pasta. A regra dura: "0 pessoas" NÃO é sempre "ninguém tem
 * acesso". Pode ser:
 *   - herança: subpasta sem compartilhamento próprio herda de quem está acima;
 *   - ilegível: a leitura falhou, então não sabemos quem tem acesso;
 *   - vazio de verdade: pasta-raiz sem ninguém e sem falha.
 * Nunca afirmamos um fato quando é ausência de dado.
 *
 * @param {{pessoas?:Array, falhas?:Array}} resposta  o que veio do proxy
 * @param {{temMae?:boolean}} opcoes  se esta pasta tem uma pasta-mãe (subpasta)
 * @returns {{tipo:'ok'|'herda'|'ilegivel'|'vazio', incompleto:boolean}}
 */
export function decidirEstadoAcesso(resposta = {}, opcoes = {}) {
  const pessoas = Array.isArray(resposta && resposta.pessoas) ? resposta.pessoas : []
  const falhas = Array.isArray(resposta && resposta.falhas) ? resposta.falhas : []
  const temMae = !!(opcoes && opcoes.temMae)
  const temFalhas = falhas.length > 0

  if (pessoas.length > 0) {
    // Tem gente pra mostrar. Se TAMBÉM houve falha, o quadro pode estar
    // incompleto (mostramos as pessoas + um aviso).
    return { tipo: 'ok', incompleto: temFalhas }
  }
  if (temFalhas) {
    // Ninguém veio E deu erro: não dá pra dizer "ninguém tem acesso" — seria
    // mentira, pode ter gente que a gente não conseguiu ler.
    return { tipo: 'ilegivel', incompleto: true }
  }
  if (temMae) {
    // Subpasta sem compartilhamento próprio: herda de quem está acima.
    return { tipo: 'herda', incompleto: false }
  }
  // Pasta-raiz, sem falha e sem ninguém: não há acesso DIRETO registrado.
  // (Não chamamos de "herda" porque raiz não tem mãe de quem herdar.)
  return { tipo: 'vazio', incompleto: false }
}

// Vira o `tipo` do estado numa frase pro usuário. String vazia quando o estado
// é 'ok' (aí a tela mostra a lista de pessoas, não uma frase).
export function mensagemEstadoVazio(estado = {}) {
  switch (estado && estado.tipo) {
    case 'herda':
      return 'Esta pasta não tem acesso próprio: ela herda quem pode ver da pasta-mãe.'
    case 'ilegivel':
      return 'Não foi possível ler quem tem acesso a esta pasta agora. Tente de novo em instantes.'
    case 'vazio':
      return 'Nenhum acesso direto está registrado nesta pasta.'
    default:
      return ''
  }
}

/**
 * Agrupa as pessoas pelo ESCOPO do acesso (ex.: "Todo o time (workspace)") pra
 * virar chips-resumo no topo do detalhe. Ordena do escopo mais comum pro menos;
 * empate desempata pelo nome do escopo. Pessoa sem escopo vira "Acesso
 * individual" (não some).
 *
 * @param {Array<{escopo?:string}>} pessoas
 * @returns {Array<{escopo:string, quantidade:number}>}
 */
export function agruparPorEscopo(pessoas) {
  const lista = Array.isArray(pessoas) ? pessoas : []
  const mapa = new Map()
  for (const p of lista) {
    const escopo = (p && p.escopo) ? String(p.escopo) : 'Acesso individual'
    mapa.set(escopo, (mapa.get(escopo) || 0) + 1)
  }
  return [...mapa.entries()]
    .map(([escopo, quantidade]) => ({ escopo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.escopo.localeCompare(b.escopo, 'pt-BR'))
}
