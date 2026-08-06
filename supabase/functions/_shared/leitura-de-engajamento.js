// QUANDO UMA LEITURA DE ENGAJAMENTO DA META PODE SER GRAVADA.
//
// O PROBLEMA QUE ISTO EXISTE PARA RESOLVER (medido em 2026-08-05):
// a Meta às vezes responde o detalhamento das interações PELA METADE — manda
// `comments` e devolve `likes`, `saves` e `shares` zerados, com o
// `total_interactions` certo. A linha fica assim:
//
//     curtidas 0 · comentários 34 · salvos 0 · compart. 0 · TOTAL 556
//
// 556 interações com zero curtidas é impossível: a linha se contradiz sozinha.
//
// A regra antiga (`bdBroken`, dentro de coletar-dados/index.ts) só considerava
// a leitura quebrada quando as QUATRO parcelas eram zero. Com os comentários
// preenchidos, a soma dava 34, o guarda aprovava, e o zero das curtidas entrava
// no banco como verdade. Pior: o socorro (`carregarUltimoBom`) procura a última
// linha "não quebrada" para se apoiar — e encontrava justamente essas, que
// passavam no teste antigo. O zero virava a fonte do próprio conserto, e por
// isso grudava por dias e voltava sozinho. Foram 107 linhas em 30 dias, uma
// delas com 12.775 interações e zero curtidas.
//
// POR QUE ESTE ARQUIVO É SEPARADO E PURO: a lógica morava solta dentro da Edge
// Function, onde não dá para testar sem subir Deno e sem falar com a Meta. Aqui
// tudo entra por parâmetro, e os testes ao lado usam linhas REAIS do banco.

// As quatro parcelas que a Meta detalha. `total_interactions` não entra: ele é
// o total que serve de contraprova, não uma parcela.
const PARCELAS = ['likes', 'comments', 'saves', 'shares'];

// O piso a partir do qual "zero curtidas" deixa de ser explicável.
//
// NÃO É CHUTE. Medido nas 1.132 linhas saudáveis dos últimos 30 dias: a MENOR
// participação das curtidas no total de interações foi 0,34%. Em 50 interações
// isso daria 0,17 curtida — abaixo disso, zero ainda cabe no acaso. Acima, não:
// entre as 107 linhas envenenadas, a média era de 1.138 interações.
//
// Errar para o lado de acusar de menos é de propósito. Um falso positivo faria
// o coletor SOBRESCREVER um zero verdadeiro com o valor de ontem, e esse defeito
// é mais difícil de perceber do que o que estamos consertando.
export const PISO_DE_INTERACOES = 50;

const num = (v) => Number(v) || 0;

// Soma das quatro parcelas detalhadas.
export function somaDoDetalhe(leitura) {
  if (!leitura) return 0;
  let soma = 0;
  for (const k of PARCELAS) soma += num(leitura[k]);
  return soma;
}

// A leitura chegou pela metade?
//
// Duas formas da mesma doença, e as duas dependem de haver interação declarada:
//   1. as quatro parcelas zeradas (era o único caso que a regra antiga pegava);
//   2. as curtidas zeradas com interação suficiente para desmentir o zero —
//      o caso que passava batido, porque bastava um comentário para a soma
//      deixar de ser zero.
export function leituraParcial(leitura) {
  if (!leitura) return false;
  const total = num(leitura.total_interactions);
  if (total <= 0) return false;                       // nada declarado: zero é zero
  if (somaDoDetalhe(leitura) === 0) return true;      // (1)
  return num(leitura.likes) === 0 && total >= PISO_DE_INTERACOES; // (2)
}

// A leitura pode ser gravada / servir de "último valor bom"?
//
// Exige alcance — sem alcance a coleta não aconteceu de verdade (regra que já
// existia em `engOk` e continua valendo) — e exige detalhamento inteiro.
export function leituraServe(leitura) {
  if (!leitura) return false;
  if (!(num(leitura.reach) > 0)) return false;
  return !leituraParcial(leitura);
}
