// Monta a ÁRVORE de pastas a partir do campo `caminho` de acessos_recursos.
//
// Este arquivo é PURO de propósito: não importa nada, não fala com banco, não
// mexe no DOM. É o pedaço que dá pra testar com `node --test` sem subir nada.
//
// O banco guarda a hierarquia achatada, numa coluna de texto só:
//
//   nome    = "01. Gestão de Serviços"
//   caminho = "01. RBV and Company/01. Gestão de Serviços"
//
// Ou seja: o `caminho` é "pasta-mãe/pasta-filha". Quem tem caminho igual ao
// próprio nome está no topo (é raiz). A tela precisa do contrário disso: uma
// árvore de verdade, com as filhas penduradas na mãe, pra conseguir indentar.

// Descobre o caminho da pasta-mãe a partir de uma linha do banco.
//
// ATENÇÃO ao porquê de não usar `caminho.split('/')`: o nome de uma pasta PODE
// ter barra (ex.: uma pasta chamada "Contratos 2025/2026"). Se cortássemos no
// último "/" cegamente, o nome seria partido no meio e inventaríamos uma
// pasta-mãe "Contratos 2025" que não existe — a pasta sumiria da árvore.
// Como o banco já nos dá o `nome` pronto, cortamos pelo tamanho dele: o que
// sobra antes do "/nome" final é, por definição, o caminho da mãe.
function caminhoDaPastaMae(recurso) {
  const caminho = String((recurso && recurso.caminho) || '').trim()
  const nome = String((recurso && recurso.nome) || '').trim()
  if (!caminho) return null

  // Caso normal: o caminho termina com "/" + o nome desta pasta.
  const sufixo = '/' + nome
  if (nome && caminho.length > sufixo.length && caminho.endsWith(sufixo)) {
    return caminho.slice(0, caminho.length - sufixo.length) || null
  }

  // Pasta de 1 nível: o caminho É o próprio nome. Não tem mãe, é raiz.
  if (nome && caminho === nome) return null

  // Rede de segurança pra linha antiga/torta em que o caminho não bate com o
  // nome: aí não dá pra fazer melhor que cortar no último "/".
  const corte = caminho.lastIndexOf('/')
  return corte > 0 ? caminho.slice(0, corte) : null
}

// Ordena por caminho respeitando número ("2." antes de "10."), que é como as
// pastas são nomeadas aqui ("01. RBV and Company"). Ordena as filhas junto.
function ordenarRamo(nos) {
  nos.sort((a, b) => String(a.caminho).localeCompare(String(b.caminho), 'pt-BR', { numeric: true }))
  nos.forEach((n) => ordenarRamo(n.filhas))
}

// Marca em que nível cada pasta está (0 = topo). A tela usa isso pra indentar.
function marcarNiveis(nos, nivel) {
  nos.forEach((n) => {
    n.nivel = nivel
    marcarNiveis(n.filhas, nivel + 1)
  })
}

/**
 * Transforma a lista achatada do banco numa árvore.
 *
 * @param {Array<{id:any, nome:string, caminho:string}>} recursos linhas de acessos_recursos
 * @returns {Array<{id:any, nome:string, caminho:string, nivel:number, recurso:object, filhas:Array}>}
 *          as pastas do topo, cada uma com suas `filhas` aninhadas
 */
export function montarArvoreDePastas(recursos) {
  const nos = (recursos || [])
    .filter((r) => r && r.id != null)
    .map((r) => ({
      id: r.id,
      nome: String(r.nome || '').trim() || '(sem nome)',
      caminho: String(r.caminho || r.nome || '').trim(),
      nivel: 0,
      recurso: r,
      filhas: [],
    }))

  // Índice caminho -> pasta, pra achar a mãe de cada uma em uma passada só.
  // Se duas linhas tiverem o mesmo caminho (não deveria), a primeira ganha.
  const porCaminho = new Map()
  nos.forEach((n) => {
    if (n.caminho && !porCaminho.has(n.caminho)) porCaminho.set(n.caminho, n)
  })

  const raizes = []
  nos.forEach((no) => {
    const caminhoMae = caminhoDaPastaMae(no.recurso)
    const mae = caminhoMae ? porCaminho.get(caminhoMae) : null
    // Se a mãe não foi importada (pasta "órfã"), a filha vira raiz em vez de
    // sumir. Regra: importação incompleta pode desalinhar o desenho, mas nunca
    // pode ESCONDER uma pasta que existe — some pasta, some controle de acesso.
    if (mae && mae !== no) mae.filhas.push(no)
    else raizes.push(no)
  })

  ordenarRamo(raizes)
  marcarNiveis(raizes, 0)
  return raizes
}

/**
 * Achata a árvore de volta numa lista, na ordem em que a tela desenha (mãe,
 * depois as filhas dela, depois a próxima mãe). Serve pra contar e pra render.
 */
export function achatarArvoreDePastas(raizes) {
  const saida = []
  const visitar = (nos) => {
    ;(nos || []).forEach((n) => {
      saida.push(n)
      visitar(n.filhas)
    })
  }
  visitar(raizes)
  return saida
}
