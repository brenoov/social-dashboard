import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Teste de ORDEM DE BOOT. Le o proprio .vue porque o que se quer proteger e uma
// sequencia dentro de codigo DOM-imperativo, que node:test nao consegue montar.
// E fragil a refatoracao de propósito: se alguem mover a chamada, o teste quebra
// e obriga a reler este comentario.
//
// O BUG (2026-07-29, visto pelo dono): a fila era carregada no onMounted, ANTES
// de _initGestaoTrafego preencher _gtAccounts. Ela varre as contas pra achar as
// campanhas, entao varreu uma lista vazia, nao achou nada e anunciou "Nada
// esperando decisao" — com nove itens de verdade esperando.
const fonte = readFileSync(new URL('./tela-de-gestao-trafego.vue', import.meta.url), 'utf8');

test('a fila carrega DEPOIS de _gtAccounts existir', () => {
  const contasProntas = fonte.indexOf('_gtAccounts.push(...accs)');
  const carregaFila = fonte.indexOf('_gtCarregarFila();');
  assert.ok(contasProntas > 0, 'nao achei onde as contas sao preenchidas');
  assert.ok(carregaFila > 0, 'nao achei a chamada da fila');
  assert.ok(carregaFila > contasProntas,
    'a fila esta sendo carregada ANTES das contas — ela varre _gtAccounts e vai achar zero campanha');
});

test('o onMounted NAO chama a fila direto', () => {
  // Ali _gtAccounts ainda esta vazio; quem dispara e _initGestaoTrafego.
  const mount = fonte.slice(fonte.indexOf('onMounted(('));
  const ateOFim = mount.slice(0, mount.indexOf('onUnmounted('));
  assert.ok(!/^\s*_gtCarregarFila\(\)/m.test(ateOFim),
    'onMounted nao pode chamar _gtCarregarFila: as contas ainda nao chegaram');
});

test('_gtCarregarFila tem guarda pra lista de contas vazia', () => {
  // Segunda trava: mesmo chamada cedo, ela nao pode concluir "fila vazia".
  const i = fonte.indexOf('async function _gtCarregarFila()');
  const corpo = fonte.slice(i, i + 1200);
  assert.match(corpo, /_gtAccounts && _gtAccounts\.length/,
    'sem a guarda, uma chamada cedo devolve fila vazia como se fosse verdade');
});
