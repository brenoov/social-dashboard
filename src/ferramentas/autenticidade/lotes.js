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
//
// EXPORTADA de propósito: `nfc-fila.js` precisa exatamente desta regra para a
// lista do gravador de mesa, e tinha uma CÓPIA à mão (`!p.gravada_em &&
// !p.baixada`). Duas cópias da mesma regra divergem no dia em que a regra muda
// — e a que ficar para trás manda gravar a etiqueta de uma peça baixada.
export const naFila = (p) => !p.baixada

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
// A chave é o que o banco aceita; o rótulo é o que a pessoa lê.
//
// ⚠️ ESTA LISTA MORA EM TRÊS LUGARES, e os três precisam concordar. Quem
// acrescentar um motivo aqui e esquecer dos outros dois vê a tela oferecer uma
// opção que o banco recusa com `motivo_invalido` — e a pessoa fica achando que
// a ferramenta quebrou:
//
//   1. o `check (motivo in (...))` da coluna `vessel_baixas.motivo`;
//   2. o `if ... not in (...)` de DENTRO de `vessel_baixar_peca` — e o de
//      `vessel_sobrescrever_etiqueta`, que confere o motivo da baixa antes de
//      escrever (a trava mais fechada é a que manda, e é a de dentro da função);
//   3. esta lista, que é o que a tela oferece.
//
// Os 1 e 2 foram acertados em `db/migrations/2026-09-01-vessel-editar-etiquetas.sql`.
// Este arquivo é o 3.
export const MOTIVOS_DE_BAIXA = [
  { chave: 'extraviada', rotulo: 'Extraviada' },
  { chave: 'defeito', rotulo: 'Defeito ou refugo' },
  { chave: 'devolvida', rotulo: 'Devolvida' },
  { chave: 'etiqueta_perdida', rotulo: 'Etiqueta perdida ou danificada' },
  // A peça que foi usada para testar a gravação. Ela nunca vira bolsa, e sem
  // este motivo ela era baixada como 'defeito' — que faria a contagem de
  // refugo da produção mentir.
  { chave: 'teste', rotulo: 'Usada em teste' },
]

// O RÓTULO QUE A PESSOA LÊ, a partir da chave que o banco aceita. Ele MORA AQUI,
// junto da lista, e não na tela: a lista completa do lote (`linhasDaListaDoLote`,
// mais abaixo) escreve o mesmo motivo que a tela mostra, e rótulo escrito em
// dois lugares é rótulo que diverge no dia em que um deles muda.
export function rotuloDoMotivo(chave) {
  return (MOTIVOS_DE_BAIXA.find((m) => m.chave === chave) || {}).rotulo || chave || '—'
}

// ── AS FRASES DE RECUSA ────────────────────────────────────────────────────
// Botão desabilitado calado faz a pessoa achar que a ferramenta está quebrada.
// Cada recusa do banco vira uma frase que diz POR QUE e O QUE FAZER.
export function fraseDaRecusa(motivo, dados = {}) {
  const d = dados || {}
  switch (motivo) {
    case 'tem_gravada':
      return `Não dá para excluir: ${d.gravadas} das ${d.total} etiquetas deste lote `
        + 'já foram gravadas e podem estar dentro de bolsas. Você pode dar baixa nas peças, uma a uma.'
    case 'tem_garantia': {
      // `gravada_em` não era a única prova de que a peça está no mundo: a
      // cliente registra a garantia pelo CÓDIGO, sem a peça precisar estar
      // gravada, e `vessel_registros` cai por `on delete cascade` junto com a
      // peça. Aqui não há conselho a dar — diferente de `esta_gravada`, não há
      // "dê baixa em vez disso": há uma garantia de uma pessoa de verdade
      // pendurada no código, e ninguém do lado de cá pode tirá-la.
      const n = d.garantias ?? 1
      // A mesma recusa serve ao lote (o banco manda `total` junto) e à peça
      // sozinha (manda só `garantias`). Dizer "deste lote" ao excluir UMA peça
      // seria uma mentira pequena, e a tela não mente.
      const onde = d.total == null ? '' : ' deste lote'
      return `Não dá para excluir: ${n} peça(s)${onde} já têm garantia registrada `
        + 'por uma cliente. Apagar tiraria a garantia dela.'
    }
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

// ── A SENHA PEDIDA ANTES DE APAGAR ─────────────────────────────────────────
//
// ⚠️ O QUE ESTA SENHA É, PARA NINGUÉM SE ENGANAR DEPOIS: ela é FRICÇÃO contra
// quem senta num computador destravado e sai clicando — e contra o próprio dono
// apertando "excluir" sem pensar. **Ela NÃO é cofre.** Quem quiser mesmo chamar
// `vessel_excluir_lote` sem passar por aqui abre o console e chama, e é por isso
// que quem manda de verdade é o PORTÃO DO BANCO: `is_vessel_admin()` por dentro
// da função, mais o `revoke`/`grant` de quem pode executá-la. A tela é a porta
// da frente; a tranca é lá dentro.
//
// AS FRASES SÃO PRÓPRIAS, e não as de `frota/assinar-checklist.js`, que responde
// aos MESMOS códigos da edge `conferir-senha`: as de lá terminam em "o checklist
// ainda não foi gravado, você vai precisar preencher outra vez", que numa tela de
// etiqueta é conselho sobre uma coisa que não existe.
export function fraseDaSenha(codigo) {
  switch (codigo) {
    case 'senha_incorreta':
      return 'Senha incorreta. Nada foi apagado. É a mesma senha com que você entra no aplicativo.'
    case 'bloqueado':
      return 'Muitas tentativas com senha errada. Espere dez minutos e tente de novo. Nada foi apagado.'
    case 'sem_senha':
      return 'Digite sua senha para confirmar. É a mesma senha com que você entra no aplicativo.'
    case 'sem_sessao':
      return 'Seu acesso expirou. Saia e entre de novo no aplicativo. Nada foi apagado.'
    default:
      // 'falha_interna', erro de rede, resposta que não deu para ler: todos têm
      // a mesma orientação honesta — não sabemos, e nada foi apagado.
      return 'Não consegui conferir sua senha agora. Confira a conexão e tente de novo. Nada foi apagado.'
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

// ── A LISTA INTEIRA DO LOTE ────────────────────────────────────────────────
// Depois de gravar e costurar, ninguém consegue responder "qual link ficou na
// bolsa nº 7". Estas três contas são o que responde.

// AS PEÇAS EM ORDEM DE SÉRIE. O banco não devolve ordenado, e a lista é lida
// procurando um número: fora de ordem, ninguém acha.
// O `slice()` antes do `sort` não é enfeite: `sort` ordena NO LUGAR, e ordenar
// o array que veio da tela mexeria na lista que o Vue está desenhando.
export function pecasEmOrdem(pecas) {
  return (Array.isArray(pecas) ? pecas : []).slice()
    .sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0))
}

// O ESTADO DE UMA PEÇA, numa palavra só. A ORDEM DAS PERGUNTAS IMPORTA: peça
// baixada pode ter sido gravada ANTES da baixa, e mostrá-la como "gravada" faria
// alguém procurar dentro de uma bolsa que foi dada como refugo. A baixa é a
// última coisa que aconteceu com a peça, então é ela que a tela diz.
// O selo sai das classes prontas do PADRAO-DA-CENTRAL, nunca de cor à mão.
export function estadoDaPeca(peca) {
  const p = peca || {}
  if (p.baixada) return { chave: 'baixada', rotulo: 'Baixada', selo: 'selo-atencao' }
  if (p.gravada_em) return { chave: 'gravada', rotulo: 'Gravada', selo: 'selo-ok' }
  return { chave: 'pendente', rotulo: 'Pendente', selo: 'selo-neutro' }
}

const COLUNAS_DO_LOTE = ['numero', 'codigo', 'endereco', 'estado', 'gravada em', 'motivo da baixa']

// A LISTA PARA ARQUIVAR JUNTO DA ORDEM DE PRODUÇÃO.
//
// ELA NÃO É `listaParaGravadorDeMesa` (nfc-fila.js), e as duas existem de
// propósito: aquela é a FILA DO QUE FALTA — alimenta a máquina, e por isso tira
// as gravadas e as baixadas. Esta CONTA A HISTÓRIA — sai com todas as peças, na
// ordem da série, com endereço e estado, porque quem arquiva precisa saber o que
// aconteceu com cada número. Juntar as duas numa só faria a máquina regravar
// etiqueta já gravada.
//
// A DATA ENTRA POR PARÂMETRO: formatar data é conta de fuso, e o fuso da Central
// mora na tela (`dataCurta`, em America/Sao_Paulo). Escrevendo uma segunda aqui,
// o arquivo sairia com a data de um dia e a tela com a de outro.
export function linhasDaListaDoLote(pecas, { formatarData = (v) => (v == null ? '' : String(v)) } = {}) {
  const linhas = pecasEmOrdem(pecas).map((p) => {
    const estado = estadoDaPeca(p)
    return [
      p.numero_na_serie ?? '',
      p.codigo ?? '',
      enderecoDaTag(p.codigo),
      estado.rotulo,
      p.gravada_em ? formatarData(p.gravada_em) : '',
      p.baixada ? rotuloDoMotivo(p.baixa_motivo) : '',
    ].map(celula).join(';')
  })
  return [COLUNAS_DO_LOTE.join(';'), ...linhas].join('\n')
}

export function resumoDeAlertas(alertas) {
  const repetidas = alertas?.repetidas?.length || 0
  const invalidas = alertas?.invalidas?.length || 0
  // A PEÇA BAIXADA QUE FOI LIDA É O ALERTA MAIS IMPORTANTE DESTE PROJETO: a
  // bolsa foi dada como extraviada e alguém encostou o celular nela depois
  // disso. Sem contar aqui, a aba dizia "nada suspeito" com uma bolsa
  // extraviada reaparecendo no mundo — e a tela nunca mente.
  const baixadasLidas = alertas?.baixadas_lidas?.length || 0
  return {
    repetidas,
    invalidas,
    baixadasLidas,
    limpo: repetidas === 0 && invalidas === 0 && baixadasLidas === 0,
  }
}
