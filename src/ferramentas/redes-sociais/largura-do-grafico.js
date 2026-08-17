// QUANTO ESPAÇO UM GRÁFICO DE UM PONTO POR DIA PRECISA TER.
//
// O PROBLEMA QUE ISTO EXISTE PARA RESOLVER (medido a 375px, período de 30 dias,
// na tela /redes-sociais):
//
//   Investimento por dia ......... 19 números, 3 pares sobrepostos, −5px de folga
//   Custo por seguidor por dia ... 18 números, 8 pares sobrepostos, −5px de folga
//   Novos seguidores por dia ..... 32 rótulos, 2 pares sobrepostos
//
// Pares reais que se encavalavam: "R$ 17,34"×"R$ 11,35", "R$ 2,88"×"Meta máxima
// R$ 3,00", "15/8"×"16/8", "+22"×"Meta 69/dia".
//
// A CAUSA É FÍSICA, não de arrumação: o gráfico tinha 319px de largura e 30 dias
// para mostrar — ~10px por dia. "R$ 17,34" não cabe em 10px em fonte nenhuma.
// Diminuir a letra já tinha sido tentado (era 9px, o menor que se lê) e continuou
// sobrepondo. Não existe arrumação que caiba 30 valores em moeda em 319px.
//
// A SAÍDA: cada dia recebe no MÍNIMO 30px. Quando os dias cabem nesse mínimo,
// nada muda — o gráfico continua do tamanho do cartão, e 7 e 14 dias no celular
// e o computador inteiro ficam exatamente como estão hoje. Quando não cabem, o
// gráfico fica maior que o cartão e rola PARA O LADO dentro dele.
//
// POR QUE ESTE ARQUIVO É SEPARADO E PURO: a conta é a decisão inteira ("rola ou
// não rola, e com que largura"), e ela vale para os dois gráficos, que são
// desenhados de jeitos diferentes (um SVG esticado com rótulos em HTML, outro
// SVG uniforme com os rótulos dentro). Regra repetida em dois lugares é regra
// que vai divergir. Aqui ela se testa sem navegador, e a tela só obedece.

/** 30px por ponto: o menor espaço em que "R$ 17,34" ao lado de outro igual não
 *  se toca. Medido no aparelho, não estimado. */
export const MINIMO_POR_PONTO = 30;

/** Largura da faixa apagada da direita, que avisa que o gráfico continua para o
 *  lado. Sem esse aviso ninguém descobre que dá para arrastar. O mesmo 28 está
 *  no CSS da tela (`.grafico-que-rola.rolando::after`) — CSS não lê constante de
 *  JavaScript, então os dois andam juntos na mão. */
export const FAIXA_QUE_AVISA = 28;

/** Tira VAZIA na ENTRADA do trilho.
 *
 *  Os rótulos são CENTRADOS no ponto, e o primeiro ponto fica na beirada: metade
 *  do rótulo dele sobra para fora do desenho. Fora do desenho, dentro de uma
 *  caixa que rola, é lugar RECORTADO — medido a 375px, "R$ 17,34" do primeiro
 *  dia aparecia como "$ 17,34" e a primeira data como "/7". */
export const ESPACO_ANTES_DO_GRAFICO = 24;

/** Tira VAZIA na SAÍDA do trilho. Mesmo motivo da tira da entrada, mais um: é
 *  aqui que a faixa apagada vai cair. Por isso ela é maior que a faixa — assim a
 *  faixa nunca apaga o rótulo do último dia, que seria esconder o último dia
 *  para avisar que existem dias escondidos. */
export const ESPACO_DEPOIS_DO_GRAFICO = 48;

/** Largura de projeto dos dois gráficos (o `viewBox` de ambos nasceu com 400).
 *  Serve de rede quando o contêiner ainda não pôde ser medido. */
export const LARGURA_QUANDO_NAO_DA_PRA_MEDIR = 400;

function numeroPositivo(valor, quandoNaoDer) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : quandoNaoDer;
}

/**
 * A conta do tamanho do gráfico.
 *
 * `pontos`            = quantos dias (ou barras) vão ser desenhados.
 * `larguraDisponivel` = o quanto o cartão dá de largura, em pixels de tela.
 * `minimoPorPonto`    = espaço mínimo por dia; 30px por padrão.
 * `podeRolar`         = se existe alguém para arrastar o gráfico. Falso no modo
 *                       televisão (body.dev-tv): lá ninguém encosta na tela, e
 *                       rolagem que ninguém arrasta é dia escondido para sempre.
 *                       Onde não há dedo, apertar é melhor que esconder.
 *
 * Devolve:
 *   largura         → a largura de desenho do gráfico, em pixels.
 *   rola            → se ele ficou maior que o cartão e precisa rolar para o lado.
 *   larguraDaTrilha → a largura TOTAL do trilho: o desenho mais as duas tiras
 *                     vazias, que existem para nenhum rótulo de beirada ser
 *                     recortado nem apagado pela faixa de aviso.
 *   espacoPorPonto  → quanto cada dia ganhou de fato (serve para a tela decidir
 *                     se agora cabe número dentro da barra).
 */
export function larguraDoGrafico({ pontos, larguraDisponivel, minimoPorPonto = MINIMO_POR_PONTO, podeRolar = true } = {}) {
  // Contêiner com largura 0, negativa ou não numérica é contêiner que AINDA NÃO
  // FOI MEDIDO (desenho antes do layout, cartão escondido). Zero lido como "não
  // tem espaço" mandaria todo gráfico rolar — inclusive no computador, onde
  // espaço sobra. Nesses casos vale a largura de projeto.
  const disponivel = Math.ceil(numeroPositivo(larguraDisponivel, LARGURA_QUANDO_NAO_DA_PRA_MEDIR));
  const minimo = numeroPositivo(minimoPorPonto, MINIMO_POR_PONTO);
  const n = Math.floor(numeroPositivo(pontos, 0));

  // Sem ponto nenhum não há o que espremer: o gráfico fica do tamanho do cartão.
  if (n <= 0) return { largura: disponivel, rola: false, larguraDaTrilha: disponivel, espacoPorPonto: 0 };

  // Sem quem role, o gráfico se aperta e mostra tudo. Ver `podeRolar` acima.
  if (!podeRolar) return { largura: disponivel, rola: false, larguraDaTrilha: disponivel, espacoPorPonto: disponivel / n };

  const necessaria = Math.ceil(n * minimo);
  // O máximo (e não o necessário puro) é o que impede uma semana de virar um toco
  // de 210px no meio de um cartão de 1200px.
  const largura = Math.max(disponivel, necessaria);
  const rola = necessaria > disponivel;
  return {
    largura,
    rola,
    larguraDaTrilha: rola ? largura + ESPACO_ANTES_DO_GRAFICO + ESPACO_DEPOIS_DO_GRAFICO : largura,
    espacoPorPonto: largura / n,
  };
}
