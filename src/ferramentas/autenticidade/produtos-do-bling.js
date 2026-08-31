// OS PRODUTOS DA VESSEL, vindos do Bling, para escolher no formulário de lote.
//
// POR QUE EXISTE: o lote era criado DIGITANDO modelo, cor e SKU à mão. O que a
// pessoa digitasse ali é o que a cliente lê na página do selo — então um erro de
// digitação vira uma bolsa original mostrando o nome errado, e ninguém descobre
// até alguém encostar o celular.
//
// Contas puras: sem rede, sem DOM. Quem fala com o Bling é
// `src/compartilhado/chamada-do-bling.js`, e só ele.

// ── O QUE É "VESSEL" ──────────────────────────────────────────────────────
// Decisão do dono: só o SKU do formato NOVO. Medido em 31/08/2026: de 400
// produtos ativos, 33 são do formato novo e 312 do antigo (LV). A linha antiga
// não recebe etiqueta.
export function ehProdutoVessel(codigo) {
  return /^SS/i.test(String(codigo ?? '').trim())
}

const semAcento = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// ── A COR, quando dá para ter certeza ─────────────────────────────────────
// O SKU carrega pedaços separados por hífen, e um deles COSTUMA ser a cor:
//   SS1088-Mostarda              → "Bolsa De Mão Média Bath Mostarda"
//   SS1234-Caramelo-Fly Amendoa  → "Bolsa de Mão Angers Caramelo"
// Mas nem sempre: `SS-00002-1.01.03.01.01` não tem cor nenhuma no código.
//
// A REGRA É CONSERVADORA DE PROPÓSITO, e o motivo é uma cicatriz: no catálogo
// eu escrevi um separador de nomes esperto, e ele leu "Bolsa Tote Grande
// Florença Caramelo" como modelo "Caramelo". Aqui um pedaço só vira cor quando
// ele TERMINA o nome do produto — as duas fontes concordando. Quando não
// concordam, a cor volta vazia e quem cria o lote preenche. Campo vazio a
// pessoa vê; campo errado ela não.
export function corDoProduto(codigo, nome) {
  const n = semAcento(nome)
  const pedacos = String(codigo ?? '').split('-').slice(1).map((p) => p.trim()).filter(Boolean)
  for (const p of pedacos) {
    const alvo = semAcento(p)
    if (alvo && n.endsWith(alvo)) return p
  }
  return ''
}

// ── O MODELO ──────────────────────────────────────────────────────────────
// O nome do Bling sem o "Bolsa " da frente e sem a cor do fim. O que sobra é o
// que a cliente lê como modelo. Continua editável na tela: o Bling preenche,
// a pessoa confere.
export function modeloDoProduto(nome, cor) {
  let texto = String(nome ?? '').trim().replace(/^bolsa\s+/i, '').trim()
  if (cor) {
    const semCor = texto.slice(0, texto.length - String(cor).length).trim()
    if (semAcento(texto).endsWith(semAcento(cor)) && semCor) texto = semCor
  }
  return texto
}

// ── A LISTA para a tela ───────────────────────────────────────────────────
export function produtosParaEscolher(itens) {
  return (Array.isArray(itens) ? itens : [])
    .filter((x) => ehProdutoVessel(x?.codigo))
    .map((x) => {
      const codigo = String(x.codigo).trim()
      const nome = String(x.nome ?? '').trim()
      const cor = corDoProduto(codigo, nome)
      return { codigo, nome, cor, modelo: modeloDoProduto(nome, cor) }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ── A BUSCA ───────────────────────────────────────────────────────────────
// Sem acento e sem caixa, porque ninguém digita "Mônaco" com o chapéu quando
// está com pressa. Busca no nome E no código: quem tem o SKU na mão procura
// por ele.
export function procurarProduto(lista, termo) {
  const t = semAcento(termo)
  if (!t) return Array.isArray(lista) ? lista : []
  return (Array.isArray(lista) ? lista : []).filter((p) =>
    semAcento(p.nome).includes(t) || semAcento(p.codigo).includes(t))
}
