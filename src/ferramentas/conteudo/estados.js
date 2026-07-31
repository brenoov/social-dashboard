// Os estados de uma peça de conteúdo e as passagens permitidas entre eles.
//
// Este arquivo é a regra de negócio inteira da Central de Conteúdo, isolada de
// Vue e de banco justamente para caber num teste de 1 linha. Se você mudar a
// lista de status aqui, mude junto o CHECK de `conteudo_pecas.status` na
// migration — o teste "as chaves batem com o CHECK" existe para lembrar disso.
//
// ATENÇÃO: nada aqui é segurança. O front é público. Quem realmente impede um
// não-aprovador de aprovar é a trigger `conteudo_guarda_aprovacao` no banco.
// O que está aqui é para a tela não oferecer um botão que vai dar erro.

export const STATUS = [
  { chave: 'rascunho',     rotulo: 'Rascunho',     cor: '#94a3b8', ordem: 1 },
  { chave: 'em_aprovacao', rotulo: 'Em aprovação', cor: '#f59e0b', ordem: 2 },
  { chave: 'aprovada',     rotulo: 'Aprovada',     cor: '#10b981', ordem: 3 },
  { chave: 'agendada',     rotulo: 'Agendada',     cor: '#3b82f6', ordem: 4 },
  { chave: 'publicada',    rotulo: 'Publicada',    cor: '#8b5cf6', ordem: 5 },
  { chave: 'reprovada',    rotulo: 'Reprovada',    cor: '#ef4444', ordem: 6 },
  { chave: 'arquivada',    rotulo: 'Arquivada',    cor: '#64748b', ordem: 7 },
]

const _porChave = Object.fromEntries(STATUS.map(s => [s.chave, s]))

const CINZA_DE_RESERVA = '#94a3b8'

export function rotuloDeStatus(chave) {
  return _porChave[chave]?.rotulo || String(chave ?? '')
}

export function corDeStatus(chave) {
  return _porChave[chave]?.cor || CINZA_DE_RESERVA
}

// O grafo. Só o que está escrito aqui pode acontecer — qualquer outra passagem
// é recusada. Falha fechada: status desconhecido não vai a lugar nenhum.
const CAMINHOS = {
  rascunho:     ['em_aprovacao', 'arquivada'],
  // Voltar para rascunho é desistir do pedido, não decidir sobre ele: por isso
  // não exige permissão de aprovar (quem enviou pode se arrepender).
  em_aprovacao: ['aprovada', 'reprovada', 'rascunho'],
  aprovada:     ['agendada', 'rascunho', 'arquivada'],
  reprovada:    ['rascunho', 'arquivada'],
  agendada:     ['publicada', 'aprovada', 'arquivada'],
  publicada:    ['arquivada'],
  arquivada:    ['rascunho'],
}

// As duas passagens que só um aprovador pode fazer.
const EXIGEM_APROVADOR = new Set(['aprovada', 'reprovada'])

export function transicoesPermitidas(status) {
  return CAMINHOS[status] ? [...CAMINHOS[status]] : []
}

// Devolve { ok, motivo }. O motivo é texto pronto para mostrar na tela, em
// português de gente — ele vira o `title` do botão desabilitado.
export function podeTransicionar(de, para, opcoes = {}) {
  const { podeAprovar = false, temData = false } = opcoes

  if (!CAMINHOS[de]) {
    return { ok: false, motivo: `Não conheço o estado "${de}", então não sei para onde ele pode ir.` }
  }
  if (!CAMINHOS[de].includes(para)) {
    return {
      ok: false,
      motivo: `Uma peça em "${rotuloDeStatus(de)}" não pode ir direto para "${rotuloDeStatus(para)}".`,
    }
  }
  if (EXIGEM_APROVADOR.has(para) && !podeAprovar) {
    return { ok: false, motivo: 'Só quem tem permissão de aprovar pode decidir esta peça.' }
  }
  if (para === 'agendada' && !temData) {
    return { ok: false, motivo: 'Escolha a data e a hora da publicação antes de agendar.' }
  }
  return { ok: true, motivo: null }
}
