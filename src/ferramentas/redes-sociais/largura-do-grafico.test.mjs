import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  larguraDoGrafico,
  MINIMO_POR_PONTO,
  FAIXA_QUE_AVISA,
  ESPACO_ANTES_DO_GRAFICO,
  ESPACO_DEPOIS_DO_GRAFICO,
  LARGURA_QUANDO_NAO_DA_PRA_MEDIR,
} from './largura-do-grafico.js';

// A MEDIDA QUE ORIGINOU ESTE MÓDULO (375px, período de 30 dias, /redes-sociais):
// o gráfico tinha 319px de largura útil e 30 dias — ~10px por dia. "R$ 17,34" e
// "R$ 11,35" ficavam sobrepostos em −5px. Não é questão de arrumar melhor: não
// existe arrumação que caiba 30 valores em moeda dentro de 319px.

test('o que cabe continua igual: 30px por ponto exatos NÃO rolam', () => {
  // 10 pontos × 30px = 300px. O contêiner tem exatamente 300px: cabe.
  const r = larguraDoGrafico({ pontos: 10, larguraDisponivel: 300 });
  assert.equal(r.rola, false);
  assert.equal(r.largura, 300);
});

test('um ponto a mais que a conta já não cabe e passa a rolar', () => {
  const r = larguraDoGrafico({ pontos: 11, larguraDisponivel: 300 });
  assert.equal(r.rola, true);
  assert.equal(r.largura, 330); // 11 × 30
});

test('um ponto só nunca rola', () => {
  const r = larguraDoGrafico({ pontos: 1, larguraDisponivel: 300 });
  assert.deepEqual(r, { largura: 300, rola: false, larguraDaTrilha: 300, espacoPorPonto: 300 });
});

test('zero ponto: nada a desenhar, o gráfico fica do tamanho do contêiner', () => {
  const r = larguraDoGrafico({ pontos: 0, larguraDisponivel: 319 });
  assert.equal(r.rola, false);
  assert.equal(r.largura, 319);
  assert.equal(r.espacoPorPonto, 0); // sem ponto não há espaço POR ponto: não é 319/0 = Infinity
});

// O ESTRAGO QUE ESTA REGRA EVITA: se a largura fosse só "pontos × 30", uma semana
// no computador viraria um toco de 210px no meio de 1200px de cartão vazio.
test('contêiner maior que o necessário NUNCA encolhe o gráfico', () => {
  const r = larguraDoGrafico({ pontos: 7, larguraDisponivel: 1200 });
  assert.equal(r.largura, 1200);
  assert.equal(r.rola, false);
});

// ATENÇÃO AO 14: 14 × 30 = 420, e 420 não cabe em 319. Quem lê o desenho pode
// esperar que "14 dias no celular fica como está hoje" — pela régua dos 30px por
// dia, NÃO fica: 14 dias no celular passam a rolar também. Quem manda é a régua.
test('celular de 375px (319px úteis): 7 dias cabem, 14 dias já não', () => {
  const sete = larguraDoGrafico({ pontos: 7, larguraDisponivel: 319 });
  assert.equal(sete.rola, false);
  assert.equal(sete.largura, 319);
  const catorze = larguraDoGrafico({ pontos: 14, larguraDisponivel: 319 });
  assert.equal(catorze.rola, true);
  assert.equal(catorze.largura, 420);
});

test('celular de 375px com 30 dias: 900px de gráfico, 30px por dia', () => {
  const r = larguraDoGrafico({ pontos: 30, larguraDisponivel: 319 });
  assert.equal(r.rola, true);
  assert.equal(r.largura, 900);
  assert.equal(r.espacoPorPonto, 30);
});

test('tela larga: 31 dias cabem e NÃO viram rolagem', () => {
  const r = larguraDoGrafico({ pontos: 31, larguraDisponivel: 1830 });
  assert.equal(r.rola, false);
  assert.equal(r.largura, 1830);
  assert.ok(r.espacoPorPonto > MINIMO_POR_PONTO);
});

// MODO TV (body.dev-tv) — E A CONTA QUE DESMENTE O PALPITE.
// "Numa televisão a tela é larguíssima, então cabe e não rola" NÃO se sustenta:
// medido a 1920 com dev-tv, os dois cartões da seção 02 dividem a linha e ficam
// com 836px cada — menos que os 900px que 30 dias pedem. Sem trava, a televisão
// ganharia rolagem, e numa televisão ninguém arrasta nada: os últimos dias
// simplesmente sumiriam para sempre. Onde não há dedo, apertar é melhor que
// esconder.
test('sem quem role, o gráfico se aperta em vez de esconder dia', () => {
  const r = larguraDoGrafico({ pontos: 30, larguraDisponivel: 836, podeRolar: false });
  assert.equal(r.rola, false);
  assert.equal(r.largura, 836); // aperta: 27,9px por dia em vez de esconder 2 dias
  const comDedo = larguraDoGrafico({ pontos: 30, larguraDisponivel: 836 });
  assert.equal(comDedo.rola, true); // no celular/computador, o mesmo caso rola
});

test('quem pode rolar continua rolando: a trava não vaza para o resto', () => {
  const r = larguraDoGrafico({ pontos: 30, larguraDisponivel: 319, podeRolar: true });
  assert.equal(r.rola, true);
  assert.equal(r.largura, 900);
});

test('o mínimo por ponto é ajustável, e 30px é o padrão', () => {
  assert.equal(MINIMO_POR_PONTO, 30);
  const r = larguraDoGrafico({ pontos: 10, larguraDisponivel: 300, minimoPorPonto: 40 });
  assert.equal(r.rola, true);
  assert.equal(r.largura, 400);
});

// SEM ESTA GUARDA O DESKTOP QUEBRA: um cartão ainda não medido (aba escondida,
// primeiro desenho antes do layout) devolve clientWidth 0. Zero lido como "não
// tem espaço" mandaria TODO gráfico rolar, inclusive no computador.
test('contêiner que ainda não foi medido cai na largura de projeto, não em zero', () => {
  for (const ruim of [0, -50, NaN, null, undefined, 'abc', Infinity]) {
    const r = larguraDoGrafico({ pontos: 7, larguraDisponivel: ruim });
    assert.equal(r.largura, LARGURA_QUANDO_NAO_DA_PRA_MEDIR, 'largura para ' + String(ruim));
    assert.equal(r.rola, false, 'rola para ' + String(ruim));
  }
});

test('quantidade de pontos estranha não derruba a conta', () => {
  for (const ruim of [null, undefined, NaN, -3, 'abc']) {
    const r = larguraDoGrafico({ pontos: ruim, larguraDisponivel: 319 });
    assert.equal(r.largura, 319, 'largura para ' + String(ruim));
    assert.equal(r.rola, false, 'rola para ' + String(ruim));
  }
});

test('largura é sempre inteira: meio pixel de SVG vira borda tremida', () => {
  const r = larguraDoGrafico({ pontos: 7, larguraDisponivel: 319.53 });
  assert.equal(Number.isInteger(r.largura), true);
  assert.equal(r.largura, 320);
});

// As DUAS beiradas precisam de tira vazia, porque o rótulo é centrado no ponto e
// o primeiro e o último ficam na borda: metade deles sobra para fora do desenho,
// e fora do desenho, dentro de uma caixa que rola, é lugar recortado. Medido a
// 375px antes das tiras: "R$ 17,34" virava "$ 17,34" e "19/7" virava "/7".
test('as tiras vazias dão espaço para o rótulo que sobra da beirada', () => {
  // ~12px é a metade do rótulo mais largo que costuma abrir o gráfico ("R$ 17,34").
  assert.ok(ESPACO_ANTES_DO_GRAFICO >= 12, 'tira da entrada curta demais');
  // A da saída ainda leva a faixa apagada em cima, e não pode apagar o último dia.
  assert.equal(FAIXA_QUE_AVISA, 28);
  assert.ok(ESPACO_DEPOIS_DO_GRAFICO >= FAIXA_QUE_AVISA + 12, 'tira da saída curta demais');
});

test('as tiras vazias só existem quando o gráfico rola', () => {
  const rolando = larguraDoGrafico({ pontos: 30, larguraDisponivel: 319 });
  assert.equal(rolando.larguraDaTrilha, 900 + ESPACO_ANTES_DO_GRAFICO + ESPACO_DEPOIS_DO_GRAFICO);
  const parado = larguraDoGrafico({ pontos: 7, larguraDisponivel: 319 });
  assert.equal(parado.larguraDaTrilha, 319); // cabendo, nada de tira nem de faixa
});
