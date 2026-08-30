// O TUTORIAL DA GRAVAÇÃO: o passo a passo que fica na tela e o guia que abre na
// primeira vez.
//
// POR QUE EXISTE: o dono abriu a tela pronta e disse "ficou muito mal
// explicado". E estava certo — ela dizia "Crie um lote antes de gravar
// etiquetas", "✓ Gravei essa" e "Gravador de mesa", e mais nada. Quem nunca viu
// não tinha como saber o que é um lote, onde a etiqueta vai na bolsa, nem o que
// vem depois.
//
// Contas puras, sem DOM e sem Vue, porque é assim que dá pra testar de verdade.

// ── O PASSO A PASSO ────────────────────────────────────────────────────────
// Três etapas, e a tela abre a de agora e recolhe as outras. O número é o que
// responde "onde eu parei?" sem ninguém contar etiqueta na mão.
export const PASSOS = [
  {
    n: 1,
    titulo: 'Criar o lote',
    resumo: 'Um lote é uma fornada de bolsas do mesmo modelo. Cada bolsa ganha um código diferente.',
  },
  {
    n: 2,
    titulo: 'Gravar as etiquetas',
    resumo: 'Encoste a etiqueta no celular, uma de cada vez. A tela confere e passa para a próxima.',
  },
  {
    n: 3,
    titulo: 'Conferir',
    resumo: 'As etiquetas deste lote estão prontas. Os registros aparecem quando as clientes ativarem a garantia.',
  },
]

/**
 * Em que passo a pessoa está.
 *   1 — não há lote nenhum, ou nenhum escolhido
 *   2 — há lote escolhido e ainda falta etiqueta
 *   3 — tudo gravado neste lote
 */
export function passoAtual({ temLote = false, pecas = [] } = {}) {
  if (!temLote) return 1
  const lista = Array.isArray(pecas) ? pecas : []
  if (!lista.length) return 1
  return lista.some((p) => !p.gravada_em) ? 2 : 3
}

// ── O GUIA DA PRIMEIRA VEZ ─────────────────────────────────────────────────
// Cinco telas curtas. A ordem não é enfeite: primeiro o PARA QUE serve, depois
// ONDE a etiqueta vai (é o erro que estraga a peça na fábrica), e só então o
// como. As duas últimas existem porque são as coisas que, se ninguém contar,
// viram desconfiança da ferramenta ou etiqueta queimada.
export const TELAS_DO_GUIA = [
  {
    titulo: 'Para que serve',
    texto: 'Cada bolsa ganha uma etiqueta com um endereço só dela. A cliente encosta o celular '
      + 'e abre uma página provando que a bolsa é original, com a garantia dela.',
  },
  {
    titulo: 'Onde a etiqueta vai',
    texto: 'Costurada no forro interno, longe de fecho, rebite e corrente. Etiqueta encostada em '
      + 'metal não é lida pelo celular — e etiqueta que não lê faz a cliente achar que a bolsa é falsa.',
  },
  {
    titulo: 'Como gravar',
    texto: 'Escolha o lote, toque em Gravar e encoste o celular na etiqueta, segurando parado. '
      + 'Quando terminar, a tela já mostra a próxima peça. Uma etiqueta de cada vez.',
  },
  {
    titulo: 'O que a tela faz por você',
    texto: 'Ela lê a etiqueta ANTES, para nunca escrever por cima da peça de outra bolsa. E lê '
      + 'DEPOIS, para só dar a peça por pronta quando a etiqueta devolver o que foi gravado.',
  },
  {
    titulo: 'A trava',
    texto: 'Travar deixa a etiqueta impossível de regravar, para sempre. Ela nasce desligada. '
      + 'Quando for ligar, faça o primeiro teste numa etiqueta descartável.',
  },
]

const CHAVE_DO_GUIA = 'autenticidade-guia-visto'

// O depósito entra por parâmetro para o teste conseguir fingir — e porque
// `localStorage` ESTOURA em janela anônima e com dados de site bloqueados. Por
// isso todo acesso vai dentro de try/catch, como o resto do projeto faz.
export function guiaJaVisto(deposito) {
  try {
    const d = deposito || (typeof localStorage !== 'undefined' ? localStorage : null)
    return d?.getItem(CHAVE_DO_GUIA) === 'sim'
  } catch { return false }
}

export function marcarGuiaVisto(deposito) {
  try {
    const d = deposito || (typeof localStorage !== 'undefined' ? localStorage : null)
    d?.setItem(CHAVE_DO_GUIA, 'sim')
    return true
  } catch { return false }
}

/** Devolve o índice da tela seguinte, ou null quando o guia acabou. */
export function proximaTelaDoGuia(indice) {
  const i = Number(indice)
  if (!Number.isInteger(i) || i < 0) return 0
  return i + 1 < TELAS_DO_GUIA.length ? i + 1 : null
}
