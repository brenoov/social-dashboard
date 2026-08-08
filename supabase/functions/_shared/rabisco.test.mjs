import test from 'node:test';
import assert from 'node:assert/strict';
import { CASAS, normalizarRabisco, pontosDoRabisco } from './rabisco.js';
import { textoParaAssinar } from './assinatura.js';

/* ── A forma do que é gravado ─────────────────────────────────────────────── */

test('mantém a forma traço → pontos [x,y]', () => {
  const r = normalizarRabisco([[[0.1, 0.2], [0.3, 0.4]], [[0.5, 0.6]]]);
  assert.deepEqual(r, [[[0.1, 0.2], [0.3, 0.4]], [[0.5, 0.6]]]);
});

test('arredonda em 3 casas, que é o que a assinatura cobre', () => {
  assert.deepEqual(normalizarRabisco([[[0.1234561, 0.9999]]]), [[[0.123, 1]]]);
  assert.equal(CASAS, 3);
});

test('prende as coordenadas entre 0 e 1 — o dedo escapa da área de desenho', () => {
  // Arrastar pra fora da caixa é comum: a pessoa está de pé, com o celular numa
  // mão só. O traço tem de parar na borda, não sair pra coordenada negativa,
  // que na hora de imprimir viraria risco fora do quadro.
  assert.deepEqual(normalizarRabisco([[[-0.4, 1.9], [2, -3]]]), [[[0, 1], [1, 0]]]);
});

test('ponto repetido some — dedo parado gera dezenas da mesma leitura', () => {
  const r = normalizarRabisco([[[0.2, 0.2], [0.2, 0.2], [0.2, 0.2], [0.3, 0.2]]]);
  assert.deepEqual(r, [[[0.2, 0.2], [0.3, 0.2]]]);
});

test('dois pontos que só diferiam na 4ª casa viram um só', () => {
  // Consequência do arredondamento: depois de arredondar eles são o MESMO
  // ponto, e guardar os dois seria gravar uma diferença que a assinatura não vê.
  assert.deepEqual(normalizarRabisco([[[0.20001, 0.5], [0.20002, 0.5]]]), [[[0.2, 0.5]]]);
});

test('traço vazio não é gravado', () => {
  assert.deepEqual(normalizarRabisco([[], [[0.1, 0.1]], []]), [[[0.1, 0.1]]]);
});

test('um toque só (um ponto) continua sendo rabisco', () => {
  // Não é a tela que decide se o gesto foi bonito o bastante. Se a pessoa
  // encostou de propósito, isso é o que ela desenhou.
  assert.deepEqual(normalizarRabisco([[[0.5, 0.5]]]), [[[0.5, 0.5]]]);
});

/* ── Sem desenho é `null`, nunca `[]` ─────────────────────────────────────── */

test('sem desenho nenhum devolve null, não lista vazia', () => {
  // Uma forma só pra "não desenhou": duas formas para o mesmo fato dariam
  // impressões digitais diferentes pra fichas idênticas.
  assert.equal(normalizarRabisco([]), null);
  assert.equal(normalizarRabisco([[], []]), null);
  assert.equal(normalizarRabisco(null), null);
  assert.equal(normalizarRabisco(undefined), null);
  assert.equal(normalizarRabisco('rabisco'), null);
});

test('coordenada que não é número é DESCARTADA, nunca vira zero', () => {
  // Zero é um canto da área de desenho: transformar lixo em zero inventaria um
  // traço até o canto que a pessoa nunca fez.
  assert.deepEqual(normalizarRabisco([[[0.4, 0.4], ['a', 0.5], [null, null], [0.6, 0.6]]]),
    [[[0.4, 0.4], [0.6, 0.6]]]);
  assert.equal(normalizarRabisco([[[NaN, 0.1], [0.2, Infinity]]]), null);
  assert.equal(normalizarRabisco([[[0.3], 0.4, {}]]), null);
});

/* ── A ponte com a assinatura ─────────────────────────────────────────────── */

test('normalizar é ESTÁVEL: normalizar duas vezes dá o mesmo', () => {
  // Se não fosse, o valor lido de volta do banco poderia divergir do assinado.
  const uma = normalizarRabisco([[[0.1234561, 0.2], [0.1234559, 0.2000001]]]);
  assert.deepEqual(normalizarRabisco(uma), uma);
});

test('o que é gravado já é o que a assinatura cobre — nada muda no caminho', () => {
  // A prova de que arredondar aqui e arredondar em assinatura.js dão o MESMO
  // texto: gravar o cru e gravar o normalizado assinam igual, então o banco
  // pode guardar o normalizado (menor e estável) sem mudar a impressão digital.
  const cru = [[[0.5234891, 0.1111119], [0.5234899, 0.7]]];
  const ficha = { veiculo_id: 'v', feita_em: '2026-08-08', assinatura_versao: 2 };
  const comCru = textoParaAssinar({
    ficha: { ...ficha, assinatura_rabisco: cru }, respostas: [], hashAnterior: null,
  });
  const comLimpo = textoParaAssinar({
    ficha: { ...ficha, assinatura_rabisco: normalizarRabisco(cru) }, respostas: [], hashAnterior: null,
  });
  assert.equal(comCru, comLimpo);
});

/* ── A contagem que a tela usa ────────────────────────────────────────────── */

test('pontosDoRabisco conta os pontos de todos os traços', () => {
  assert.equal(pontosDoRabisco([[[0, 0], [1, 1]], [[0.5, 0.5]]]), 3);
  assert.equal(pontosDoRabisco([]), 0);
  assert.equal(pontosDoRabisco(null), 0);
});
