import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somaDoDetalhe, leituraParcial, leituraServe, PISO_DE_INTERACOES } from './leitura-de-engajamento.js';

// Os casos abaixo são LINHAS REAIS do banco (engagement_snapshots), medidas em
// 2026-08-05. Não são inventadas: é o estrago que motivou este arquivo.

// A conta Breno Vale, janela de 7 dias, nos dias em que a Meta respondeu pela
// metade: mandou os comentários e zerou curtidas, salvamentos e compartilhamentos.
const brenoQuebrado = { likes: 0, comments: 34, saves: 0, shares: 0, total_interactions: 556, reach: 104274 };
// A MESMA conta, na véspera, respondendo inteiro.
const brenoInteiro  = { likes: 413, comments: 31, saves: 63, shares: 26, total_interactions: 576, reach: 101456 };

test('a leitura pela metade é o caso que passava batido', () => {
  // ESTE É O BUG. A regra antiga só considerava quebrada a leitura em que as
  // QUATRO parcelas eram zero. Com `comments: 34` a soma dá 34, diferente de
  // zero, e o zero das curtidas entrava no banco como se fosse verdade.
  assert.equal(somaDoDetalhe(brenoQuebrado), 34);   // a soma NÃO é zero
  assert.equal(leituraParcial(brenoQuebrado), true); // e ainda assim está quebrada
  assert.equal(leituraServe(brenoQuebrado), false);
});

test('a leitura inteira da mesma conta continua servindo', () => {
  assert.equal(leituraParcial(brenoInteiro), false);
  assert.equal(leituraServe(brenoInteiro), true);
});

test('as quatro parcelas zeradas seguem sendo quebra (o caso que a regra antiga pegava)', () => {
  const tudoZero = { likes: 0, comments: 0, saves: 0, shares: 0, total_interactions: 56, reach: 384 };
  assert.equal(leituraParcial(tudoZero), true);
  assert.equal(leituraServe(tudoZero), false);
});

// ── o outro lado: NÃO acusar conta que só está quieta ──────────────────────
//
// Zero curtidas é um valor legítimo quando quase nada aconteceu. Acusar aí
// faria o coletor sobrescrever um zero VERDADEIRO com o valor de ontem — que é
// o defeito oposto, e mais difícil de perceber.

test('conta parada de verdade não é acusada', () => {
  const quieta = { likes: 0, comments: 0, saves: 0, shares: 0, total_interactions: 0, reach: 120 };
  assert.equal(leituraParcial(quieta), false);
  assert.equal(leituraServe(quieta), true);
});

test('pouquíssima interação com zero curtidas passa — abaixo do piso não dá pra afirmar', () => {
  const pouco = { likes: 0, comments: 3, saves: 0, shares: 0, total_interactions: 5, reach: 200 };
  assert.equal(leituraParcial(pouco), false);
  assert.equal(leituraServe(pouco), true);
});

test('o piso é 50 interações, e a fronteira é medida, não chutada', () => {
  // Medido nas 1.132 linhas saudáveis dos últimos 30 dias: a MENOR participação
  // das curtidas no total foi 0,34%. Em 50 interações isso daria 0,17 curtida —
  // ou seja, abaixo de 50 o zero ainda é explicável. Acima, não é.
  assert.equal(PISO_DE_INTERACOES, 50);
  assert.equal(leituraParcial({ likes: 0, comments: 1, saves: 0, shares: 0, total_interactions: 49, reach: 9 }), false);
  assert.equal(leituraParcial({ likes: 0, comments: 1, saves: 0, shares: 0, total_interactions: 50, reach: 9 }), true);
});

// ── alcance zero: a leitura não serve, mesmo com detalhe bonito ────────────

test('sem alcance a leitura não serve (regra que já existia, preservada)', () => {
  const semAlcance = { likes: 400, comments: 30, saves: 60, shares: 25, total_interactions: 570, reach: 0 };
  assert.equal(leituraServe(semAlcance), false);
});

test('nulo não serve e não estoura', () => {
  assert.equal(leituraServe(null), false);
  assert.equal(leituraParcial(null), false);
  assert.equal(somaDoDetalhe(null), 0);
});

// ── o que fazia o estrago DURAR ────────────────────────────────────────────

test('linha envenenada não pode ser aceita como "último valor bom"', () => {
  // Era isto que fazia o zero grudar por dias: o socorro procurava a última
  // linha não-quebrada, e a linha pela metade passava no teste antigo porque
  // tinha comentários. O conserto ia buscar o zero na própria doença.
  const historico = [brenoQuebrado, brenoInteiro];
  const primeiroQuePresta = historico.find((l) => leituraServe(l));
  assert.equal(primeiroQuePresta, brenoInteiro);
  assert.equal(primeiroQuePresta.likes, 413);
});
