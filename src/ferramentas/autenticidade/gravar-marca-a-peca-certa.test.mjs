/* A PEÇA QUE SE GRAVA E A PEÇA QUE SE MARCA TÊM DE SER A MESMA.
 *
 * `gravarNaEtiqueta` escolhe a peça no começo (`const peca = proxima.value`) e
 * fica até 8 segundos com "Encoste a etiqueta…" na tela. Enquanto `marcarGravada`
 * relia `proxima.value` por conta própria, quem trocasse de lote no meio gravava
 * a etiqueta do lote A e marcava como pronta a peça do lote B — e a bolsa B saía
 * da fábrica marcada como pronta com a etiqueta EM BRANCO costurada dentro. A
 * leitura de volta não protegia nada nesse caminho: conferia A e marcava B.
 *
 * Isto se verifica no código-fonte porque `node --test` não compila `.vue`: teste
 * verde não é tela que abre, mas fonte é o que dá para ler daqui.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TELA = new URL('./tela-de-autenticidade.vue', import.meta.url).pathname;
const fonte = readFileSync(TELA, 'utf8');
const script = fonte.slice(fonte.indexOf('<script setup>'), fonte.indexOf('</script>'));
// até o <script setup>, e NÃO até o primeiro '</template>': a tela tem
// <template v-else-if> aninhados, e o primeiro fechamento é de um deles —
// cortar ali deixava a aba Gravar inteira fora da vistoria.
const template = fonte.slice(0, fonte.indexOf('<script setup>'));

/** O corpo de uma função do `<script setup>`, por contagem de chaves. */
function corpoDaFuncao(nome) {
  const abre = script.indexOf(`function ${nome}(`);
  assert.notEqual(abre, -1, `função ${nome} sumiu da tela`);
  let i = script.indexOf('{', abre);
  let nivel = 0;
  for (let j = i; j < script.length; j += 1) {
    if (script[j] === '{') nivel += 1;
    else if (script[j] === '}') { nivel -= 1; if (nivel === 0) return script.slice(i, j + 1); }
  }
  throw new Error(`não achei o fim de ${nome}`);
}

test('marcarGravada recebe o código da peça, e não relê a escolha da tela', () => {
  assert.match(
    script,
    /async function marcarGravada\(codigo = proxima\.value\?\.codigo\)/,
    'sem o parâmetro, marcarGravada volta a reler proxima.value e pode marcar outra peça',
  );
});

test('gravarNaEtiqueta marca SEMPRE a peça que ela mesma escolheu', () => {
  const corpo = corpoDaFuncao('gravarNaEtiqueta');
  const chamadas = [...corpo.matchAll(/marcarGravada\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.equal(chamadas.length, 2, 'gravarNaEtiqueta marca em dois pontos: já conferia, e depois de gravar');
  assert.deepEqual(
    chamadas, ['peca.codigo', 'peca.codigo'],
    'marcarGravada() sem argumento aqui relê proxima.value e marca a peça errada',
  );
});

/* O TESTE QUE IMPORTA: nenhum caminho chama `vessel_marcar_gravada` sem uma
 * leitura de volta que confere. É a regra inteira num teste só — e ela não
 * existia. O revisor apagou o bloco do LER DEPOIS de `gravarNaEtiqueta` inteiro
 * e os 3756 testes seguiram verdes: peça marcada como pronta com a etiqueta em
 * branco costurada dentro da bolsa, e a suíte sem piscar.
 *
 * Provado ao contrário antes de entrar: apagando o bloco do LER DEPOIS, este
 * teste fica vermelho. */
test('LER DEPOIS: entre gravar e marcar tem de haver leitura de volta que confere', () => {
  const corpo = corpoDaFuncao('gravarNaEtiqueta');
  const daGravacao = corpo.slice(corpo.indexOf('await gravador.gravar('));
  assert.notEqual(daGravacao, '', 'gravarNaEtiqueta parou de gravar a etiqueta');

  const ateMarcar = daGravacao.slice(0, daGravacao.indexOf('marcarGravada('));
  assert.notEqual(ateMarcar.length, 0, 'depois de gravar, nada marca a peça — a fila não anda');

  const leitura = ateMarcar.match(/const (\w+) = await gravador\.lerUmaVez\(/);
  assert.ok(
    leitura,
    'entre gravar e marcar não há segunda leitura da etiqueta: marcar porque o '
    + 'write não deu erro é marcar no escuro',
  );

  const semEspaco = ateMarcar.replace(/\s+/g, ' ');
  assert.match(
    semEspaco,
    new RegExp(`if \\(conferirLeitura\\(${leitura[1]}, peca\\.codigo\\) !== 'confere'\\) \\{[^}]*\\breturn\\b`),
    'a leitura de volta tem de ser COMPARADA com a peça e SAIR da função quando '
    + 'não confere; ler e seguir em frente não protege nada',
  );
});

/* A trava do NFC é PERMANENTE: etiqueta travada nunca mais se regrava. Trocar
 * este `false` por `true` queimaria etiqueta atrás de etiqueta, para sempre, e a
 * suíte inteira seguiria verde. Por isso o valor de nascimento é teste. */
test('a trava permanente da etiqueta nasce DESLIGADA', () => {
  assert.match(
    script,
    /const travarDepois = ref\(false\)/,
    'travarDepois = ref(true) trava toda etiqueta gravada, e trava não tem volta',
  );
});

/* Trocar de lote troca a peça da vez. O recado antigo — inclusive o "PARE: esta
 * etiqueta já tem OUTRA peça" — passaria a ser lido como se fosse do lote novo,
 * e a pergunta do gravador de mesa já carrega a lista de códigos contada do lote
 * anterior. */
test('trocar de lote apaga o recado e a pergunta do lote anterior', () => {
  const trecho = script.slice(script.indexOf('watch(loteEscolhido'));
  assert.notEqual(trecho, '', 'sem watch em loteEscolhido, o aviso do lote A fica sob o lote B');
  const ate = trecho.slice(0, trecho.indexOf('})') + 2).replace(/\s+/g, ' ');
  assert.match(ate, /recadoNfc\.value = ''/, 'o recado do lote anterior tem de sumir');
  assert.match(ate, /confirmacaoDoGravador\.value = null/, 'a pergunta contada no lote anterior tem de sumir');
});

test('o recado grande só diz "pronta" quando o banco confirmou', () => {
  const corpo = corpoDaFuncao('gravarNaEtiqueta');
  const semEspaco = corpo.replace(/\s+/g, ' ');
  assert.equal(
    (semEspaco.match(/recadoNfc\.value = await marcarGravada\(peca\.codigo\) \?/g) || []).length, 2,
    'os dois pontos que marcam têm de escolher o recado pelo resultado da marcação',
  );
  assert.doesNotMatch(
    semEspaco, /await marcarGravada\([^)]*\) recadoNfc\.value =/,
    'marcar e depois anunciar sem olhar o resultado é prometer o que não aconteceu',
  );
});

test('marcarGravada devolve sim ou não em todos os caminhos', () => {
  const corpo = corpoDaFuncao('marcarGravada');
  const retornos = [...corpo.matchAll(/\breturn\b([^\n]*)/g)].map((m) => m[1].trim().replace(/[;}].*$/, '').trim());
  assert.ok(retornos.length >= 4, `esperava ao menos 4 saídas, achei ${retornos.length}`);
  for (const r of retornos) {
    assert.ok(['true', 'false'].includes(r), `saída "${r || '(vazia)'}" não diz se marcou`);
  }
});

test('no template, marcarGravada vai com parênteses', () => {
  // sem os parênteses o @click passa o MouseEvent no lugar do código da peça
  assert.doesNotMatch(
    template, /@click="marcarGravada"/,
    '@click="marcarGravada" entrega o evento do clique como código da peça',
  );
  assert.match(template, /@click="marcarGravada\(\)"/);
});

test('o seletor de lote trava enquanto grava', () => {
  assert.match(
    template, /<select v-model="loteEscolhido" :disabled="gravando">/,
    'sem travar, trocar de lote no meio da gravação escolhe outra peça',
  );
});

test('trocar para o modo do aplicativo trava enquanto grava', () => {
  // o recado (inclusive o "PARE: esta etiqueta já tem OUTRA peça") só é
  // desenhado dentro do v-if="gravaPorNfc": sair do modo no meio o apaga
  const bloco = template.slice(template.indexOf('Gravar pelo aplicativo') - 400,
    template.indexOf('Gravar pelo aplicativo'));
  assert.match(bloco, /:disabled="gravando"/);
});

test('o gravador de mesa não marca sem uma pergunta que diz o número', () => {
  assert.doesNotMatch(
    template, /@click="marcarPeloGravador"[^]{0,80}Marcar as gravadas/,
    'o botão tem de abrir a pergunta, nunca marcar direto',
  );
  assert.match(template, /@click="pedirParaMarcarPeloGravador"/);
  assert.match(
    template,
    /Marcar \{\{ confirmacaoDoGravador\.reconhecidos\.length \}\} peça\(s\) como gravadas\?/,
    'a pergunta precisa dizer QUANTAS peças serão marcadas',
  );
  assert.match(
    template, /Isso não confere etiqueta nenhuma/,
    'este é o único caminho que marca sem conferir etiqueta, e tem de dizer isso',
  );
  // e o marcar de verdade só roda a partir da resposta
  assert.match(corpoDaFuncao('marcarPeloGravador'), /const pedido = confirmacaoDoGravador\.value\s*\n\s*if \(!pedido\) return/);
});

test('nada de confirm() nativo — uiConfirm não existe neste projeto', () => {
  assert.doesNotMatch(fonte, /\bwindow\.confirm\(|[^.\w]confirm\(/);
});

/* UM `v-if` NO MEIO DE UM `v-if`/`v-else-if` PARTE A CORRENTE EM DUAS, e o Vue
 * não reclama de nada. O guia da primeira visita estava plantado entre a aba
 * Gravar e a aba Registros: a segunda metade recomeçava do zero e o `v-else`
 * dela — a aba ALERTAS inteira — era desenhada embaixo das abas Lotes e Gravar,
 * e embaixo do "Carregando…" também. Medido no navegador a 375px em 30/08, com
 * a aba Lotes escolhida e os três títulos de Alertas na tela ao mesmo tempo.
 *
 * Provado ao contrário: devolvendo o guia para o meio, os dois testes abaixo
 * ficam vermelhos. */
test('a corrente das abas não tem nada plantado no meio', () => {
  const inicio = template.indexOf("aba === 'lotes'");
  const fim = template.indexOf('── ALERTAS ──');
  assert.ok(inicio !== -1 && fim > inicio, 'a corrente das abas mudou de forma');
  const intrusos = template.slice(inicio, fim).split('\n')
    .filter((l) => /^ {4}<\w[^>]*\sv-if=/.test(l))
    .map((l) => l.trim());
  assert.deepEqual(intrusos, [], 'isto parte a corrente e desenha a aba errada junto');
});

test('o guia da primeira visita vem DEPOIS da corrente inteira', () => {
  const guia = template.indexOf('v-if="guiaAberto"');
  assert.notEqual(guia, -1, 'o guia da primeira visita sumiu da tela');
  for (const marca of ["aba === 'lotes'", "aba === 'gravar'", "aba === 'registros'", '── ALERTAS ──']) {
    assert.ok(template.indexOf(marca) < guia,
      `o bloco "${marca}" precisa vir antes do guia, senão a corrente das abas parte ali`);
  }
});
