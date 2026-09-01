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

    // ── A RECUSA QUE NÃO EXISTIA, PORQUE O BANCO MENTIA ───────────────────
    // `vessel_marcar_gravada` respondia `ok: true` sem olhar se mudou alguma
    // linha — código inexistente, peça já gravada e linha barrada davam todas a
    // MESMA resposta do sucesso. A tela dizia "gravada" e seguia. Numa gravação
    // em série isso vira etiqueta dentro de uma bolsa sem registro nenhum, e as
    // duas peças ficam idênticas por fora: ninguém separa qual foi.
    // Consertado na migration `2026-09-01-zzz-marcar-gravada-para-de-mentir`.
    case 'peca_nao_existe':
      return 'Este código não existe no sistema. Confira o que foi lido da etiqueta: '
        + 'ela pode ser de outro lote, ou a peça pode ter sido excluída.'

    // ── AS RECUSAS DE EDITAR ETIQUETA JÁ GRAVADA ──────────────────────────
    // Elas vêm de `vessel_desmarcar_gravada` e `vessel_sobrescrever_etiqueta`
    // (migration 2026-09-01). Cada uma diz O QUE HOUVE e O QUE FAZER: uma
    // recusa que só devolve o código cru faz a pessoa recarregar a tela às
    // cegas, e do outro lado há uma etiqueta costurada dentro de uma bolsa.
    case 'nao_esta_gravada':
      return 'Esta peça não está marcada como gravada — não há gravação para apagar. '
        + 'Recarregue a tela: alguém pode ter apagado antes de você.'
    case 'motivo_obrigatorio':
      return 'Esta peça tem garantia registrada por uma cliente. Escreva o motivo antes de continuar: '
        + 'sem ele, ninguém consegue explicar em três meses por que a peça voltou para a fila.'
    case 'motivo_invalido':
      return 'Esse motivo de baixa não existe mais. Escolha um da lista e tente de novo.'
    case 'destino_invalido':
      return 'Escolha o que fazer com a peça antiga: voltar para a fila de gravação, ou dar baixa nela.'
    case 'mesma_peca':
      return 'A etiqueta já é desta mesma peça — não há nada a sobrescrever. '
        + 'Se ela ainda não está marcada, use “Gravei essa”.'
    case 'antiga_nao_existe':
      return 'A peça que está DENTRO desta etiqueta não existe mais no sistema. '
        + 'Separe a etiqueta e pegue uma em branco: sobrescrever cegamente apagaria uma identidade '
        + 'que ninguém consegue mais reconstruir.'
    case 'nova_nao_existe':
      return 'A peça que você está gravando não existe mais. Recarregue a tela e escolha o lote de novo.'
    case 'antiga_nao_esta_gravada':
      return 'A peça que estava nesta etiqueta já tinha sido devolvida para a fila. '
        + 'Não há sobrescrita a fazer: grave normalmente, com “Gravar nesta etiqueta”.'
    case 'nova_ja_gravada':
      return 'Esta peça já está marcada como gravada, e portanto já tem uma etiqueta por aí. '
        + 'Marcá-la de novo colocaria o mesmo código em DUAS bolsas. '
        + 'Apague a gravação dela primeiro, na aba Etiquetas.'
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

// ── EDITAR ETIQUETA JÁ GRAVADA ─────────────────────────────────────────────
// Consertar o que foi gravado errado. Do outro lado de cada uma destas contas
// há uma etiqueta costurada dentro de uma bolsa de couro, que não se descosê.

// OS CÓDIGOS QUE TÊM GARANTIA DE UMA CLIENTE. Sai de `vessel_registros`, que a
// tela já lê para a aba Registros — não é leitura nova.
//
// A COMPARAÇÃO É EM MAIÚSCULAS dos DOIS lados: o banco guarda o código já em
// maiúsculas (`upper(trim(...))` em toda função), mas quem monta o conjunto aqui
// é a tela, e um código em caixa baixa vindo de um registro antigo faria a peça
// de uma cliente aparecer SEM a marca de garantia — e a tela deixaria apagar a
// gravação dela sem pedir motivo.
export function codigosComGarantia(registros) {
  return new Set((Array.isArray(registros) ? registros : [])
    .map((r) => String(r?.codigo ?? '').trim().toUpperCase())
    .filter(Boolean))
}

// AS PEÇAS JÁ GRAVADAS, que são as únicas que a aba Etiquetas pode consertar.
//
// A ORDEM MUDA COM O FILTRO, de propósito:
//  · com um lote escolhido, ordena pela SÉRIE — é assim que se procura a peça
//    nº 7 dentro de um lote de 50;
//  · sem filtro, a mais recente primeiro — quem abre a aba sem filtrar acabou
//    de gravar errado e quer desfazer, e a peça dele é a última da lista.
// A BAIXADA CONTINUA NA LISTA: ela pode ter sido gravada ANTES da baixa, e
// `vessel_desmarcar_gravada` funciona nela. Tirá-la daqui esconderia justamente
// a peça que foi baixada por engano depois de gravada.
export function etiquetasGravadas(pecas, loteId = null) {
  const lista = (Array.isArray(pecas) ? pecas : [])
    .filter((p) => p && p.gravada_em && (!loteId || p.lote_id === loteId))
  if (loteId) return lista.slice().sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0))
  return lista.slice().sort((a, b) => String(b.gravada_em).localeCompare(String(a.gravada_em))
    || (a.numero_na_serie || 0) - (b.numero_na_serie || 0))
}

// QUANDO O MOTIVO ESCRITO É OBRIGATÓRIO.
//
// A TELA PRECISA SABER ANTES DO BANCO. As duas funções novas recusam com
// `motivo_obrigatorio` quando falta motivo numa peça com garantia — mas deixar o
// banco dar a bronca faz a pessoa apertar o botão, esperar a rede e só então
// descobrir que faltava um campo que estava na tela o tempo todo.
//
// SÃO DOIS CASOS, e o segundo não é sobre garantia nenhuma:
//  1. a peça TEM garantia registrada por uma cliente — desmarcar a gravação de
//     uma bolsa que já está com alguém é decisão, e decisão sem motivo escrito
//     vira mistério em três meses;
//  2. o destino da peça antiga é 'baixa' — aí o motivo não é texto de
//     auditoria: ele vai para `vessel_baixas.motivo`, que tem `check`, e sem
//     ele o banco recusa com `motivo_invalido`.
export function motivoObrigatorio({ temGarantia = false, destino = null } = {}) {
  return Boolean(temGarantia) || destino === 'baixa'
}

// QUAL PEÇA ESTÁ NESTA ETIQUETA, em uma linha que se lê em voz alta na bancada.
//
// O CÓDIGO SOZINHO NÃO SERVE. Quem está com a etiqueta na mão e vai decidir se
// sobrescreve precisa saber QUAL BOLSA está prestes a perder a identidade —
// "K7M4X9QP2R" não é bolsa nenhuma; "Mônaco · Quartz · nº 7" é.
// Cada pedaço que faltar simplesmente não entra, em vez de virar "undefined" ou
// um "—" que a pessoa lê como se fosse o nome do modelo.
export function descricaoDaPeca(peca, lote) {
  const p = peca || {}
  const l = lote || {}
  const partes = []
  if (l.modelo) partes.push(String(l.modelo))
  if (l.cor) partes.push(String(l.cor))
  if (p.numero_na_serie != null) partes.push(`nº ${p.numero_na_serie}`)
  const codigo = String(p.codigo ?? '').trim().toUpperCase()
  if (!partes.length) {
    // peça que a tela não conhece: nunca inventar modelo. Dizer só o código, e
    // dizer que não se sabe de qual lote ele é, é a verdade inteira.
    return codigo ? `código ${codigo} (não achei o lote dele nesta tela)` : 'peça desconhecida'
  }
  return codigo ? `${partes.join(' · ')} — ${codigo}` : partes.join(' · ')
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
