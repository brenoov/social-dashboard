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
    selector: '.pat-linha-topo',
    titulo: '1. O que este número está contando',
    texto: 'Aqui em cima ficam quantos itens e quanto vale o que você está vendo AGORA. '
      + 'Repare no final da frase: "no total" é a empresa inteira; "em Vessel" é só '
      + 'aquela marca; "na busca" é só o que o filtro deixou passar. Se o número parecer '
      + 'baixo, leia essa palavrinha antes de se assustar — ela diz de onde ele veio.',
  },
  {
    selector: '.tela-patrimonio .abas',
    titulo: '2. Quatro jeitos de olhar a mesma coisa',
    texto: 'Navegar entra pasta por pasta, como no computador: primeiro a marca, dentro '
      + 'dela o local, dentro dele o ambiente. Planilha mostra tudo de uma vez em tabela, '
      + 'com todas as colunas, e exporta pro Excel. Resumo responde "onde está o dinheiro". '
      + 'Etiquetas diz quais números de patrimônio ainda estão livres.',
  },
  {
    selector: '.pat-busca',
    titulo: '3. Achar um bem em segundos',
    texto: 'Com o aparelho na mão, o jeito mais rápido é digitar o número da etiqueta '
      + 'colada nele. Mas a busca também acha pelo nome do item ("macbook") e pelo nome '
      + 'de quem está com ele ("larissa"). Não precisa acentuar: "televisao" acha '
      + '"Televisão". E buscar vale sobre TUDO, mesmo que você esteja dentro de uma pasta.',
  },
  {
    selector: '.pat-btn-novo',
    titulo: '4. Cadastrar um bem novo',
    texto: 'O + abre uma ficha em branco. Só o nome é obrigatório — o resto você preenche '
      + 'quando souber, e o bem já fica registrado desde agora. Os campos se encadeiam: '
      + 'escolher a marca libera os locais dela, e escolher o local libera os ambientes '
      + 'dele. É isso que impede um bem da Vessel de acabar numa sala da Moto Easy.',
  },
  {
    selector: '.pat-btn-sel',
    titulo: '5. Mexer em vários de uma vez',
    texto: 'Este botão liga o modo de seleção: a partir daí, tocar num bem MARCA ele em '
      + 'vez de abrir a ficha. Marque quantos quiser — dá pra filtrar uma sala, marcar '
      + 'tudo, trocar de sala e marcar mais, que as seleções somam. Aí você muda a '
      + 'situação, o dono ou o lugar dos vinte de uma vez só.',
  },
  {
    selector: '.pat-btn-listas',
    titulo: '6. A estrutura é sua',
    texto: 'Na engrenagem você monta o esqueleto: marcas, os locais de cada marca, os '
      + 'ambientes de cada local, e as categorias. O que você escrever ali é exatamente o '
      + 'que aparece nos campos do bem. Cuidado com o apagar: remover uma marca leva '
      + 'junto os locais e ambientes dela — a tela avisa antes, com os números.',
  },
  {
    selector: '.pat-btn-ajuda',
    titulo: '7. Quando bater dúvida',
    texto: 'Este "?" reabre este passeio quando você quiser. E dentro da ficha do bem há '
      + 'um "?" pequeno em cada campo que costuma gerar dúvida — situação, dono, valor e '
      + 'número da etiqueta — explicando o que aquilo significa na prática. Pode fechar '
      + 'agora: nada aqui se perde, e você já sabe onde procurar.',
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

// A memória é POR PESSOA, não por navegador. Sem o identificador na chave, quem
// entrasse num aparelho onde outra pessoa já tinha fechado o passeio nunca veria
// o tutorial — e é justamente quem chega depois que mais precisa dele.
function chaveDe(usuarioId) {
  return 'pat-tutorial-visto:' + (usuarioId || 'anonimo')
}

// O passeio abre sozinho UMA vez, na primeira visita daquela pessoa. Depois
// disso, só quando ela pedir — tutorial que reaparece vira estorvo, e quem já
// sabe usar passa a fechar no reflexo, sem ler.
export function deveAbrirSozinho(armazem, usuarioId) {
  // Sem lugar pra guardar (modo privado, armazém bloqueado), NÃO abre: abrir
  // sem conseguir lembrar significa abrir toda santa vez.
  if (!armazem || typeof armazem.getItem !== 'function') return false
  try { return !armazem.getItem(chaveDe(usuarioId)) } catch (e) { return false }
}

export function marcarComoVisto(armazem, usuarioId) {
  try { armazem?.setItem(chaveDe(usuarioId), '1') } catch (e) { /* modo privado: só não guarda */ }
}
