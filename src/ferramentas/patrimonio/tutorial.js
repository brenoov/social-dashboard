// O tutorial do Patrimônio: os passos do passeio guiado e as explicações curtas
// de cada bloco. Lógica pura: não toca banco nem DOM.
//
// Por que isto é um arquivo e não texto solto no template: o tutorial é o que
// ensina alguém que nunca viu o módulo. Ele precisa ser revisado como texto —
// lido inteiro, de uma vez — e não caçado no meio de 1.500 linhas de tela.
import { deveAbrirSozinho as devePorPrefixo, marcarComoVisto as marcarPorPrefixo } from '../../compartilhado/tutorial-visto.js'

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
  // Os dois passos abaixo nasceram DEPOIS dos 7 de cima — o resto do passeio
  // não mudou. Os dois apontam pro mesmo "+": é abrindo a ficha de um bem que
  // se chega tanto no "+" dos campos quanto na ligação com a Frota.
  {
    selector: '.pat-btn-novo',
    titulo: '8. Criar uma opção sem sair da ficha',
    texto: 'Dentro da ficha do bem, os campos Empresa, Local, Ambiente, Categoria e Tipo '
      + 'têm um "+" ao lado. Toque nele pra cadastrar uma opção nova ali mesmo, na hora — '
      + 'sem fechar o bem que você está preenchendo pra ir até a engrenagem e voltar.',
  },
  {
    selector: '.pat-btn-novo',
    titulo: '9. Um carro é dois cadastros, ligados',
    texto: 'Bem da categoria Veículos ganhou um bloco "Situação na Frota" dentro da '
      + 'ficha: liga o bem a um carro que já existe na Frota, ou cria o carro lá a partir '
      + 'dos dados que você já digitou aqui. Ligar os dois evita o mesmo carro virar dois '
      + 'cadastros separados, um em cada ferramenta, sem ninguém perceber.',
  },
]

// Os textos fixos dos 3 modais, escritos pelo dono e usados sem alteração —
// mesmo padrão do frota/tutorial.js (leia o comentário lá: ficam num objeto
// pelo mesmo motivo do PASSOS, pra poder ser lido e revisado de uma vez).
export const TEXTOS = {
  massaAberta: 'Você marcou vários bens e vai mudar todos juntos. Só o que você preencher '
    + 'aqui muda — o que deixar em branco fica como estava em cada um. Confira quantos '
    + 'itens estão selecionados antes de confirmar.',
  bemAberto: 'Tudo sobre este bem: o que é, quanto vale, onde está e com quem. O número de '
    + 'patrimônio é o da etiqueta colada nele — é por ele que o bem é achado na busca e '
    + 'pelo leitor de código.',
  listasAbertas: 'Aqui você arruma as listas que aparecem nos formulários: empresas, '
    + 'locais, ambientes, categorias e tipos. Mudar um nome aqui muda em todos os bens '
    + 'que o usam.',
}

/* ── Os 3 modais: passeio pelos campos, disparado pelo "?" ao lado do X ──── */

export const PASSOS_MASSA = [
  {
    selector: '[data-tour="massa-titulo"]',
    titulo: 'Quantos itens',
    texto: 'O número no título é quantos bens vão ser alterados. Se estiver diferente do '
      + 'que você esperava, feche e refaça a seleção.',
  },
  {
    selector: '[data-tour="massa-campo"]',
    titulo: 'Cada campo',
    texto: 'Em branco significa "não mexer". Preenchido significa "igualar todos a este '
      + 'valor".',
  },
  {
    selector: '[data-tour="massa-local"]',
    titulo: 'Local e ambiente',
    texto: 'Escolha a empresa primeiro: o local depende dela, e o ambiente depende do '
      + 'local.',
  },
]

export const PASSOS_BEM = [
  {
    selector: '[data-tour="bem-numero"]',
    titulo: 'Número',
    texto: 'O da etiqueta física. A tela de Etiquetas mostra quais números ainda estão '
      + 'livres.',
  },
  {
    selector: '[data-tour="bem-local"]',
    titulo: 'Empresa, local e ambiente',
    texto: 'Onde o bem está. Um depende do outro: escolha a empresa, depois o local, '
      + 'depois o ambiente.',
  },
  {
    selector: '[data-tour="bem-categoria"]',
    titulo: 'Categoria e tipo',
    texto: 'Categoria é o grupo grande (Veículos, Computadores); tipo é a marca ou o '
      + 'modelo. Se o que você precisa não estiver na lista, o botão + ao lado cria na '
      + 'hora.',
  },
  {
    selector: '[data-tour="bem-responsavel"]',
    titulo: 'Responsável',
    texto: 'Com quem o bem está. É o que aparece no termo de responsabilidade.',
  },
  {
    selector: '[data-tour="bem-situacao"]',
    titulo: 'Situação',
    texto: 'Em uso, em estoque, em manutenção ou baixado. Baixado some dos totais, mas '
      + 'não é apagado.',
  },
]

export const PASSOS_LISTAS = [
  {
    selector: '[data-tour="listas-por-que"]',
    titulo: 'Por que arrumar',
    texto: 'Nomes escritos de formas diferentes viram opções diferentes na lista. '
      + '"Volvo" e "VOLVO" seriam duas marcas para o sistema, e os totais se dividiriam '
      + 'entre as duas.',
  },
  {
    selector: '[data-tour="listas-apagar"]',
    titulo: 'Apagar',
    texto: 'Só dá para apagar o que não está sendo usado por nenhum bem. Se estiver em '
      + 'uso, o sistema avisa em vez de deixar o bem órfão.',
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

// A memória de "já viu" mora em compartilhado/tutorial-visto.js — a Frota usa
// a MESMA lógica, só com prefixo de chave diferente. Ver o comentário lá pra
// entender por que "por pessoa" e por que o prefixo não pode sumir.
const PREFIXO = 'pat-tutorial-visto'
export function deveAbrirSozinho(armazem, usuarioId) { return devePorPrefixo(armazem, usuarioId, PREFIXO) }
export function marcarComoVisto(armazem, usuarioId) { return marcarPorPrefixo(armazem, usuarioId, PREFIXO) }
