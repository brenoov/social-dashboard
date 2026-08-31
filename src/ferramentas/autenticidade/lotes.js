// Regras puras do painel de Autenticidade. Sem DOM, sem rede — por isso dá pra
// testar de verdade, sem abrir navegador.

// O endereço do domínio novo, não o do painel: é ISTO que vai gravado dentro da
// etiqueta NFC e é o que a cliente vai ver quando encostar o celular.
const DOMINIO = 'https://vesselbrasil.com.br'

export function enderecoDaTag(codigo) {
  return `${DOMINIO}/verify/${String(codigo || '').trim().toUpperCase()}`
}

// PEÇA BAIXADA SAI DA FILA. Sem isto a tela mandaria alguém gravar a etiqueta
// de uma peça dada como refugo, e a etiqueta iria para dentro de uma bolsa que
// não deveria existir.
const naFila = (p) => !p.baixada

export function progressoDoLote(pecas) {
  // a baixada sai dos DOIS números: se ficasse no total, o lote nunca fecharia
  const lista = (Array.isArray(pecas) ? pecas : []).filter(naFila)
  const gravadas = lista.filter((p) => p.gravada_em).length
  return { gravadas, total: lista.length, texto: `${gravadas} de ${lista.length}` }
}

// A próxima etiqueta a gravar é a primeira SEM gravação, na ordem da série. O
// banco não devolve ordenado sozinho, então a ordem se garante aqui.
export function proximaPorGravar(pecas) {
  const lista = (Array.isArray(pecas) ? pecas : [])
    .filter((p) => naFila(p) && !p.gravada_em)
    .sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0))
  return lista[0] || null
}

// ── OS MOTIVOS DE BAIXA ────────────────────────────────────────────────────
// Os quatro que o dono escolheu. A chave é o que o banco aceita (há um `check`
// na tabela com exatamente estas quatro); o rótulo é o que a pessoa lê.
export const MOTIVOS_DE_BAIXA = [
  { chave: 'extraviada', rotulo: 'Extraviada' },
  { chave: 'defeito', rotulo: 'Defeito ou refugo' },
  { chave: 'devolvida', rotulo: 'Devolvida' },
  { chave: 'etiqueta_perdida', rotulo: 'Etiqueta perdida ou danificada' },
]

// ── AS FRASES DE RECUSA ────────────────────────────────────────────────────
// Botão desabilitado calado faz a pessoa achar que a ferramenta está quebrada.
// Cada recusa do banco vira uma frase que diz POR QUE e O QUE FAZER.
export function fraseDaRecusa(motivo, dados = {}) {
  const d = dados || {}
  switch (motivo) {
    case 'tem_gravada':
      return `Não dá para excluir: ${d.gravadas} das ${d.total} etiquetas deste lote `
        + 'já foram gravadas e podem estar dentro de bolsas. Você pode dar baixa nas peças, uma a uma.'
    case 'esta_gravada':
      return 'Esta etiqueta já foi gravada e pode estar dentro de uma bolsa. '
        + 'Em vez de excluir, dê baixa nela com o motivo.'
    case 'abaixo_do_gravado':
      return `Não dá para diminuir tanto: ${d.gravadas} peça(s) já foram gravadas. `
        + `O mínimo é ${d.gravadas}.`
    case 'ja_baixada':
      return 'Esta peça já está baixada. Desfaça a baixa antes de baixar de novo.'
    case 'nao_esta_baixada':
      return 'Esta peça não está baixada.'
    case 'sem_permissao':
      return 'Você não tem permissão para isso. Peça a chave "autenticidade" a um administrador.'
    case 'lote_nao_existe':
    case 'peca_nao_existe':
      return 'Não encontrei esse registro. Recarregue a tela e tente de novo.'
    case 'dados_invalidos':
      return 'Confira os campos: o modelo é obrigatório e a quantidade vai de 1 a 500.'
    default:
      return 'Não consegui fazer isso agora. Recarregue a tela e tente de novo.'
  }
}

const COLUNAS = [
  ['codigo', 'codigo'],
  ['nome', 'nome'],
  ['whatsapp', 'whatsapp'],
  ['onde_comprou', 'onde comprou'],
  ['comprado_em', 'comprado em'],
  ['garantia_ate', 'garantia ate'],
]

// Excel em português abre CSV separado por PONTO-E-VÍRGULA. Com vírgula, a
// planilha inteira cai numa coluna só.
function celula(valor) {
  const texto = valor == null ? '' : String(valor)
  if (!/[;"\n]/.test(texto)) return texto
  return `"${texto.replace(/"/g, '""')}"`
}

export function linhasDoCsv(registros) {
  const cabecalho = COLUNAS.map(([, rotulo]) => rotulo).join(';')
  const linhas = (Array.isArray(registros) ? registros : [])
    .map((r) => COLUNAS.map(([campo]) => celula(r[campo])).join(';'))
  return [cabecalho, ...linhas].join('\n')
}

export function resumoDeAlertas(alertas) {
  const repetidas = alertas?.repetidas?.length || 0
  const invalidas = alertas?.invalidas?.length || 0
  return { repetidas, invalidas, limpo: repetidas === 0 && invalidas === 0 }
}
