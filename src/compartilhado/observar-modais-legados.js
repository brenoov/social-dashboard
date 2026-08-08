/* Travar a rolagem também nos modais das telas herdadas do monólito.
 *
 * `vTravaRolagem` (em travar-rolagem-de-fundo.js) resolve as telas em `v-if`
 * — Frota, Patrimônio, Status do Claude. Mas SEIS telas desta central (o
 * mesmo bloco que `estilo-alcanca-o-runtime.test.mjs` já cataloga: "oito
 * telas montam parte do conteúdo com innerHTML") abrem e fecham modal com
 * JavaScript puro — inseridas via innerHTML/createElement, escondidas via
 * `style.display` ou `classList` — herança do monólito antes do Vue.
 *
 * Nelas o fechamento acontece em DEZENAS de pontos espalhados por arquivos
 * de milhares de linhas: botão "✕", clique fora, "Cancelar", "Aplicar" — e
 * alguns são `onclick="..."` como STRING dentro de um innerHTML, fora do
 * alcance de qualquer `import`. Rastrear e instrumentar cada um à mão é o
 * caminho óbvio e o mais arriscado: BASTA ESQUECER UM fechamento para a tela
 * ficar travada pra sempre depois que aquele modal específico fechar — pior
 * desfecho que o defeito original, e o tipo de erro que só aparece dias
 * depois, longe de quem mexeu no código.
 *
 * Este observador resolve pela raiz: em vez de rastrear COMO cada modal
 * fecha, ele olha o RESULTADO — o elemento está visível na tela ou não — e
 * conta abertura/fechamento a partir disso. Cobre qualquer forma de abrir ou
 * fechar, presente ou futura, sem tocar no código de cada tela (a única
 * exceção é um `id` que faltava num modal sem nome nenhum — ver
 * `tela-de-redes-sociais.vue`, `openFollowersInfo`). */
import { abrirModal, fecharModal } from './travar-rolagem-de-fundo.js'

// Um seletor por modal legado das 6 telas que ainda montam modal via
// JavaScript puro (as outras 3 — Frota, Patrimônio, Status do Claude — usam
// `v-if` + `vTravaRolagem`, e não entram aqui). Cada seletor é uma classe/id
// que a PRÓPRIA tela já usa para achar seu modal — nada inventado.
const SELETORES_DE_MODAL_LEGADO = [
  '.ac-modal-ov',            // Acessos — os ~11 modais da tela compartilham esta classe
  '#perm-modal-overlay',     // Admin — permissões de um usuário
  '#campaign-modal-overlay', // Redes Sociais — filtro de campanhas
  '#rs-followers-info-ov',   // Redes Sociais — "como contamos seguidores" (não tinha id; ver o .vue)
  '#gc-info-modal',          // Gestão Comercial — informação
  '#gc-item-modal',          // Gestão Comercial — ficha do item
  '#gt-confirm-ov',          // Gestão de Tráfego — confirmação genérica (_gtConfirm)
  '#gt-dup-ov',              // Gestão de Tráfego — duplicar
  '#gt-pub-ov',              // Gestão de Tráfego — editor de público
  '#gt-modal-funil',         // Gestão de Tráfego — funil
  '#gt-cfg-overlay',         // Gestão de Tráfego — editor de campanha/conjunto
  '#gt-novo-ov',             // Gestão de Tráfego — assistente de campanha nova
  '#gt-cr-overlay',          // Gestão de Tráfego — ver criativo
  '#ma-custom-modal-bd',     // Análise de Campanhas — período personalizado
  '#ma-filter-bd',           // Análise de Campanhas — filtrar campanhas
  '#np-brandmenu',           // Notícias — menu de marcas em tela cheia (montado por JS)
].join(',')

// O parceiro visual de alguns elementos acima: abre/fecha sempre JUNTO com
// ele no código da tela, mas só o elemento de cima entra no seletor (contar
// os dois separadamente contaria UMA abertura como duas). Só entra aqui quem
// o `fecharTudoAoTrocarDeRota` precisa arrastar junto ao forçar o fechamento.
const PARCEIRO_PARA_FECHAR_JUNTO = { 'ma-filter-bd': 'ma-filter-drawer' }

// Visível de verdade — não só presente no DOM: os modais estáticos (Admin,
// Redes Sociais, Gestão de Tráfego) ficam no DOM o tempo todo, escondidos
// por `display:none` até abrir.
function estaVisivel(el) {
  if (!el || !el.isConnected) return false
  const janela = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
  if (!janela) return false
  const estilo = janela.getComputedStyle(el)
  return estilo.display !== 'none' && estilo.visibility !== 'hidden'
}

// Um por elemento: evita contar abertura/fechamento em dobro se `style` e
// `class` mudarem na MESMA leva de mutações (o observer as entrega juntas).
const estadoConhecido = new WeakMap()

function reconferir(el) {
  const aberto = estaVisivel(el)
  const estavaAberto = estadoConhecido.get(el) || false
  if (aberto === estavaAberto) return
  estadoConhecido.set(el, aberto)
  if (aberto) abrirModal()
  else fecharModal()
}

function reconferirTodos() {
  document.querySelectorAll(SELETORES_DE_MODAL_LEGADO).forEach(reconferir)
}

// O elemento em si, ou qualquer descendente dele, que casa com um dos
// seletores observados. Precisa olhar os DOIS: às vezes o nó inserido/
// removido É o modal (`.ac-modal-ov`); às vezes é um ancestral maior que o
// CONTÉM (o Vue desmontando `#acessos-screen` inteiro, com um modal ainda
// aberto lá dentro) — `querySelectorAll` funciona mesmo num nó já destacado
// do documento, é só uma busca na estrutura da árvore.
function elementosCorrespondentesEm(no) {
  if (!no || no.nodeType !== 1) return []
  const achados = no.matches?.(SELETORES_DE_MODAL_LEGADO) ? [no] : []
  if (no.querySelectorAll) achados.push(...no.querySelectorAll(SELETORES_DE_MODAL_LEGADO))
  return achados
}

/**
 * Processa o que de fato mudou, em vez de reconferir tudo às cegas.
 *
 * O PORQUÊ DE NÃO SER SÓ `reconferirTodos()` NO CALLBACK: um `querySelectorAll`
 * só acha elemento que ESTÁ no documento agora — um modal que acabou de ser
 * REMOVIDO (`.remove()`, o fechamento de Acessos/Análise de Campanhas) nunca
 * apareceria nessa busca, e o fechamento passaria em branco: o contador
 * ficaria travado achando que ele ainda está aberto. As `mutations` que o
 * próprio MutationObserver entrega TÊM a lista de nós removidos — é olhando
 * ela, não o documento, que a remoção é vista.
 */
function processarMutacoes(mutations) {
  for (const m of mutations) {
    if (m.type === 'attributes') {
      if (m.target.matches?.(SELETORES_DE_MODAL_LEGADO)) reconferir(m.target)
    } else if (m.type === 'childList') {
      m.addedNodes.forEach((no) => elementosCorrespondentesEm(no).forEach(reconferir))
      m.removedNodes.forEach((no) => elementosCorrespondentesEm(no).forEach(reconferir))
    }
  }
}

let observador = null

/**
 * Liga o observador. Chamar uma vez só, no boot do app (a moldura chama).
 * Religar não quebra nada — só não faz sentido ter dois olhando a mesma
 * coisa — por isso o segundo chamado não faz nada.
 */
export function observarModaisLegados() {
  if (observador || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
  observador = new MutationObserver(processarMutacoes)
  observador.observe(document.body, {
    // subtree+childList: pega o modal que é CRIADO e DESTRUÍDO por completo
    // (Acessos, Análise de Campanhas, e o "como contamos seguidores" das
    // Redes Sociais) — nasce e morre como nó, não como troca de estilo.
    childList: true,
    subtree: true,
    // attributes, só style/class: pega o modal ESTÁTICO que só troca
    // display ou ganha/perde a classe "open" (Admin, o filtro de campanhas
    // das Redes Sociais, Gestão Comercial, Gestão de Tráfego). Filtrado nos
    // dois atributos exatos que este padrão usa — sem o filtro, qualquer
    // mudança de estilo na tela inteira (inclusive gráfico redesenhando)
    // disparava o callback à toa.
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
  reconferirTodos() // por segurança, se algum já nascer aberto (não deveria)
}

/**
 * Fecha à força qualquer modal legado que ainda esteja aberto. Chamado ao
 * trocar de rota (a moldura chama).
 *
 * Por quê: alguns destes modais são pendurados direto no `document.body`
 * (não dentro da árvore do componente Vue — ver o comentário no topo do
 * arquivo), e sobrevivem a uma troca de tela como órfãos: ninguém mais vai
 * clicar no botão "✕" deles, porque a tela que os abriu já foi embora. Sem
 * isto, a pessoa navega para outra ferramenta com um modal legado aberto e a
 * rolagem fica travada NAQUELA tela nova, sem modal nenhum visível — o
 * "destravar sempre" (item 4 do pedido) para o caminho que `vTravaRolagem`
 * não alcança.
 */
export function fecharTodosOsModaisLegadosAoTrocarDeRota() {
  if (typeof document === 'undefined') return
  document.querySelectorAll(SELETORES_DE_MODAL_LEGADO).forEach((el) => {
    if (!estaVisivel(el)) return
    el.style.display = 'none'
    el.classList.remove('open')
    const idDoParceiro = PARCEIRO_PARA_FECHAR_JUNTO[el.id]
    if (idDoParceiro) {
      const parceiro = document.getElementById(idDoParceiro)
      if (parceiro) { parceiro.style.display = 'none'; parceiro.classList.remove('open') }
    }
    reconferir(el)
  })
}
