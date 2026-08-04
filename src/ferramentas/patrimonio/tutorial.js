// O tutorial do Patrimônio: os passos do passeio guiado e as explicações curtas
// de cada bloco. Lógica pura: não toca banco nem DOM.
//
// Por que isto é um arquivo e não texto solto no template: o tutorial é o que
// ensina alguém que nunca viu o módulo. Ele precisa ser revisado como texto —
// lido inteiro, de uma vez — e não caçado no meio de 1.500 linhas de tela.

// Cada passo aponta pra um seletor REAL da tela. Seletor que não existe faz o
// passeio mostrar o balão no centro, sem realce — o texto aparece de qualquer
// forma, e nunca trava.
export const PASSOS = [
  {
    selector: '.pat-visoes',
    titulo: 'Três jeitos de olhar',
    texto: 'Navegar entra pasta por pasta: marca, depois local, depois ambiente. '
      + 'Planilha mostra tudo de uma vez, detalhado. Resumo diz onde está o dinheiro.',
  },
  {
    selector: '.pat-busca',
    titulo: 'Ache pelo número da etiqueta',
    texto: 'Com o bem na mão, o mais rápido é digitar o número colado nele. '
      + 'A busca também acha pelo nome do item ou pelo nome de quem está com ele.',
  },
  {
    selector: '.pat-btn-novo',
    titulo: 'Cadastrar um bem',
    texto: 'O + abre a ficha em branco. Só o nome é obrigatório: o resto você '
      + 'preenche quando souber, e o bem já fica registrado.',
  },
  {
    selector: '.pat-btn-sel',
    titulo: 'Mexer em vários de uma vez',
    texto: 'Liga o modo de seleção. Tocar num bem passa a marcar em vez de abrir. '
      + 'Dá pra mudar situação, dono ou lugar de dezenas de itens num golpe só.',
  },
  {
    selector: '.pat-btn-listas',
    titulo: 'A estrutura é sua',
    texto: 'Na engrenagem você cria e renomeia marcas, locais, ambientes e categorias. '
      + 'O que você escrever ali é o que aparece nos campos do bem.',
  },
]

// As explicações do "?". Cada uma responde a pergunta que a pessoa faz olhando
// aquele bloco — em português direto, sem jargão.
export const AJUDAS = {
  situacao:
    'Em uso é o que está servindo alguém ou algum lugar — inclusive mesa e máquina, '
    + 'que não são de ninguém em particular. Em estoque é o que está guardado, sem uso. '
    + 'Em manutenção saiu pra conserto. Baixado saiu do patrimônio.',
  dono:
    'Só faz sentido para o que é de UMA pessoa: computador, celular, carro. '
    + 'Mesa, máquina e televisão servem o lugar, e ficam sem dono mesmo.',
  valor:
    'Quanto o bem custou quando foi comprado. Deixe em branco se não souber — '
    + 'em branco quer dizer "não informado", que é diferente de custar zero.',
  etiqueta:
    'O número da etiqueta colada no bem. É por ele que você acha o item mais rápido '
    + 'na busca, com o aparelho na mão.',
  arvore:
    'Marca é a empresa dona (Vessel, Moto Easy…). Local é onde ela fica (Fábrica '
    + 'Conchal, Loja Tivoli…). Ambiente é a sala dentro do local (Produção, Estoque…).',
  massa:
    'O que você deixar em branco NÃO é alterado. Assim dá pra mudar só a situação '
    + 'de 80 itens sem mexer no dono, no lugar ou na categoria deles.',
}

const CHAVE = 'pat-tutorial-visto'

// O passeio abre sozinho UMA vez, na primeira visita. Depois disso, só quando a
// pessoa pedir — tutorial que reaparece vira estorvo, e quem já sabe usar passa
// a fechar no reflexo, sem ler.
export function deveAbrirSozinho(armazem) {
  // Sem lugar pra guardar (modo privado, armazém bloqueado), NÃO abre: abrir
  // sem conseguir lembrar significa abrir toda santa vez, e aí o tutorial vira
  // estorvo — a pessoa aprende a fechar no reflexo, sem ler.
  if (!armazem || typeof armazem.getItem !== 'function') return false
  try { return !armazem.getItem(CHAVE) } catch (e) { return false }
}

export function marcarComoVisto(armazem) {
  try { armazem?.setItem(CHAVE, '1') } catch (e) { /* modo privado: só não guarda */ }
}
