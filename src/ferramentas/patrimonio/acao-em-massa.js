// O que muda quando se altera VÁRIOS bens de uma vez. Lógica pura: não toca
// banco nem DOM.
//
// A ideia central: o formulário em massa começa todo vazio, e campo vazio quer
// dizer "não mexe nisso". Só o que a pessoa escolheu explicitamente entra no
// que vai ser gravado — senão marcar 80 itens pra trocar a situação apagaria o
// dono, o local e a categoria de todos eles.
import { somarCentavos } from './patrimonio-lista.js'

// Valor especial para "quero ESVAZIAR este campo", que é diferente de "não
// mexe". Sem ele não haveria como tirar o dono de vários bens de uma vez.
export const LIMPAR = '__limpar__'

const CAMPOS = {
  situacao: 'situacao',
  empresaId: 'empresa_id',
  localId: 'local_id',
  comodoId: 'comodo_id',
  categoriaId: 'categoria_id',
  pessoaId: 'pessoa_id',
}

// Monta o que gravar a partir do que a pessoa escolheu.
// Devolve { alteracao, avisos }: `alteracao` é o objeto pronto pro update, e
// `avisos` são as consequências que ela precisa saber ANTES de confirmar.
export function montarAlteracaoEmMassa(escolhas, contexto = {}) {
  const e = escolhas || {}
  const alteracao = {}
  const avisos = []

  for (const [chave, coluna] of Object.entries(CAMPOS)) {
    const v = e[chave]
    if (v === undefined || v === null || v === '') continue   // vazio = não mexe
    alteracao[coluna] = v === LIMPAR ? null : v
  }

  // A árvore Marca → Local → Cômodo não pode ficar torta. Trocar a marca sem
  // trocar o local deixaria o bem num local de outra marca; o banco aceitaria,
  // e a navegação passaria a mentir. Então o filho é limpo junto.
  if ('empresa_id' in alteracao && !('local_id' in alteracao)) {
    alteracao.local_id = null
    alteracao.comodo_id = null
    avisos.push('Trocar a marca solta o local e o cômodo: os itens ficam em "Sem local" até você endereçar.')
  }
  if ('local_id' in alteracao && !('comodo_id' in alteracao)) {
    alteracao.comodo_id = null
    avisos.push('Trocar o local solta o cômodo: os itens ficam em "Sem cômodo".')
  }
  // Dono que não existe mais como colaborador cadastrado: o texto solto sai
  // junto quando se aponta uma pessoa de verdade.
  if ('pessoa_id' in alteracao && alteracao.pessoa_id !== null) alteracao.dono_texto = null

  if (contexto.quantidade > 1 && 'pessoa_id' in alteracao && alteracao.pessoa_id !== null) {
    avisos.push(`Os ${contexto.quantidade} itens passam a constar com a mesma pessoa.`)
  }
  return { alteracao, avisos }
}

// Vale a pena gravar? Formulário em branco não deve disparar update nenhum.
export function temAlgoParaMudar(escolhas) {
  const { alteracao } = montarAlteracaoEmMassa(escolhas)
  return Object.keys(alteracao).length > 0
}

// Quantos itens e quanto valor estão marcados agora — é o que a barra de baixo
// mostra pra pessoa saber o tamanho do que está prestes a mexer.
export function resumoDaSelecao(bens, idsSelecionados) {
  const ids = idsSelecionados instanceof Set ? idsSelecionados : new Set(idsSelecionados || [])
  const marcados = (bens || []).filter((b) => b && ids.has(b.id))
  return { quantidade: marcados.length, totalCentavos: somarCentavos(marcados) }
}

// Marcar/desmarcar tudo que está VISÍVEL (já filtrado). Devolve um Set novo.
// Preserva o que estava marcado fora da tela atual: a pessoa pode filtrar por
// uma sala, marcar tudo, trocar de sala e marcar mais — e as duas seleções
// somam, em vez de a segunda apagar a primeira.
export function alternarTodosVisiveis(selecionados, bensVisiveis, ligar) {
  const saida = new Set(selecionados || [])
  for (const b of bensVisiveis || []) {
    if (ligar) saida.add(b.id); else saida.delete(b.id)
  }
  return saida
}

// 'vazio' | 'parcial' | 'cheio' para o botão de marcar tudo da tela atual.
export function estadoDaSelecaoVisivel(selecionados, bensVisiveis) {
  const ids = selecionados instanceof Set ? selecionados : new Set(selecionados || [])
  const lista = bensVisiveis || []
  if (!lista.length) return 'vazio'
  const marcados = lista.filter((b) => ids.has(b.id)).length
  if (marcados === 0) return 'vazio'
  return marcados === lista.length ? 'cheio' : 'parcial'
}
