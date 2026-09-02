/* A FILA AO REDOR DA PEÇA DA VEZ.
 *
 * A aba Gravar mostrava SÓ a peça da vez. Quem grava 50 seguidas se perde, e o
 * único jeito de saber onde parou era contar etiqueta na mão.
 *
 * A conta é pura de propósito — a ordem, o recorte e a peça baixada que sai da
 * fila se provam aqui sem abrir navegador. A ligação com a tela vai pelo
 * código-fonte, porque `node --test` não compila `.vue`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pecasEmOrdem, naFila, proximaPorGravar } from './lotes.js';

const fonte = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8');
const template = fonte.slice(0, fonte.indexOf('<script setup>'));
const script = fonte.slice(fonte.indexOf('<script setup>'), fonte.indexOf('</script>'));

/* A MESMA CONTA QUE A TELA FAZ, escrita aqui do jeito que ela está lá. Não é
 * cópia da regra: é o recorte, e o recorte é a única coisa que este arquivo
 * prova. Se a tela mudar de forma, o teste de ligação lá embaixo reprova. */
const QUANTAS_ADIANTE = 4;
function filaAoRedor(pecas) {
  const atual = proximaPorGravar(pecas);
  if (!atual) return [];
  const lista = pecasEmOrdem(pecas).filter(naFila);
  const i = lista.findIndex((p) => p.codigo === atual.codigo);
  if (i === -1) return [];
  return lista.slice(Math.max(0, i - 1), i + 1 + QUANTAS_ADIANTE);
}

const lote = (n) => Array.from({ length: n }, (_, i) => ({
  codigo: `C${String(i + 1).padStart(3, '0')}`, numero_na_serie: i + 1,
}));

test('a fila mostra a que acabou de sair e as próximas', () => {
  const pecas = lote(20);
  for (const p of pecas.slice(0, 6)) p.gravada_em = '2026-08-05T10:00:00Z';
  const fila = filaAoRedor(pecas);
  assert.deepEqual(fila.map((p) => p.numero_na_serie), [6, 7, 8, 9, 10, 11]);
});

test('na PRIMEIRA peça não há "a que acabou de sair", e a fila não estoura', () => {
  const fila = filaAoRedor(lote(20));
  assert.deepEqual(fila.map((p) => p.numero_na_serie), [1, 2, 3, 4, 5]);
});

test('na ÚLTIMA peça a fila para na última, sem inventar peça nenhuma', () => {
  const pecas = lote(3);
  pecas[0].gravada_em = 'x'; pecas[1].gravada_em = 'x';
  assert.deepEqual(filaAoRedor(pecas).map((p) => p.numero_na_serie), [2, 3]);
});

test('lote inteiro gravado não tem fila', () => {
  const pecas = lote(3).map((p) => ({ ...p, gravada_em: 'x' }));
  assert.deepEqual(filaAoRedor(pecas), []);
});

test('a peça BAIXADA não aparece na fila', () => {
  // ela não vai virar bolsa. Mostrá-la como "a próxima" mandaria alguém gravar
  // a etiqueta de uma peça dada como refugo — a mesma razão de `naFila`.
  const pecas = lote(6);
  pecas[0].gravada_em = 'x';
  pecas[2].baixada = true;           // a nº 3
  const fila = filaAoRedor(pecas);
  assert.deepEqual(fila.map((p) => p.numero_na_serie), [1, 2, 4, 5, 6]);
  assert.ok(!fila.some((p) => p.baixada), 'peça baixada entrou na fila de gravação');
});

test('o banco não devolve ordenado: a fila ordena pela série', () => {
  const pecas = [
    { codigo: 'C', numero_na_serie: 3 },
    { codigo: 'A', numero_na_serie: 1, gravada_em: 'x' },
    { codigo: 'B', numero_na_serie: 2 },
  ];
  assert.deepEqual(filaAoRedor(pecas).map((p) => p.codigo), ['A', 'B', 'C']);
});

/* ── A LIGAÇÃO COM A TELA ────────────────────────────────────────────────── */

test('a tela desenha a fila, e marca qual é a atual', () => {
  assert.match(template, /v-for="pf in filaAoRedor"/, 'a fila sumiu da aba Gravar');
  assert.match(template, /\{ atual: pf\.codigo === proxima\.codigo \}/,
    'sem marcar a atual, a fila é só uma lista e a pessoa continua perdida');
  // e a atual não se distingue SÓ pela cor: o selo dela é escrito
  assert.match(template, /pf\.codigo === proxima\.codigo \? 'Agora' :/,
    'cor sozinha some para quem não a enxerga — a atual tem de estar escrita');
  assert.match(template, /\{\{ pf\.numero_na_serie \}\}/);
  assert.match(template, /\{\{ pf\.codigo \}\}/);
});

test('a fila da tela usa a MESMA regra que tira a baixada da gravação', () => {
  const corpo = script.slice(script.indexOf('const filaAoRedor = computed('));
  const ate = corpo.slice(0, corpo.indexOf('\n})')).replace(/\s+/g, ' ');
  assert.match(ate, /\.filter\(naFila\)/,
    'a regra vem de lotes.js e NÃO é reescrita aqui: cópia é o que fica para trás');
  assert.match(ate, /pecasEmOrdem\(pecasDoLote\(loteEscolhido\.value\)\)/);
  assert.match(ate, /if \(!atual\) return \[\]/, 'lote todo gravado não pode estourar');
});

test('a fila com UMA peça só não aparece', () => {
  // ela mostraria apenas a peça que já está na tela logo acima: aviso que
  // aparece sempre vira paisagem (PADRAO item 9).
  //
  // A CLASSE MUDOU DE `au-fila` PARA `au-bancada-lado` em 01/09/2026, e o motivo
  // é que a fila deixou de ser escrita DUAS vezes neste arquivo. Havia uma lista
  // para o "modo bancada" e outra para fora dele — duas cópias da mesma coisa,
  // e a que ficasse para trás mostraria a fila errada. Com a aba virando a
  // bancada, sobrou UMA, e ela é o trilho lateral do painel: por isso carrega o
  // nome da coluna em que mora.
  assert.match(template, /v-if="filaAoRedor\.length > 1" class="au-bancada-lado"/);
  assert.equal((template.match(/v-for="pf in filaAoRedor"/g) || []).length, 1,
    'a fila voltou a ser desenhada em dois lugares — a que ficar para trás mente');
});
