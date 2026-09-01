/* A GRAVAÇÃO COM VIDA — e a regra que não pode ser quebrada por ela.
 *
 * O botão só trocava de texto para "Encoste a etiqueta…". Quem grava está de pé
 * na bancada, com a bolsa numa mão e o celular na outra, e precisa entender pelo
 * canto do olho.
 *
 * MAS A ANIMAÇÃO NUNCA PODE SER A ÚNICA FORMA DE SABER O QUE ACONTECEU. Quem
 * desliga animação no sistema costuma ter motivo, e nesses casos o estado tem de
 * aparecer sem se mexer — mas aparecer. É isso que estes testes seguram: sem
 * eles, a próxima animação entra sem o `prefers-reduced-motion` e o único aviso
 * de "gravou" some para quem não pode ver movimento.
 *
 * É pelo código-fonte porque `node --test` não compila `.vue` — mesma técnica de
 * `gravar-marca-a-peca-certa.test.mjs`. O que é visual foi MEDIDO no navegador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8');
const template = fonte.slice(0, fonte.indexOf('<script setup>'));
const script = fonte.slice(fonte.indexOf('<script setup>'), fonte.indexOf('</script>'));
const estilo = fonte.slice(fonte.indexOf('<style scoped>'));

/** O corpo de uma função do `<script setup>`, por contagem de chaves. */
function corpoDaFuncao(nome) {
  const abre = script.indexOf(`function ${nome}(`);
  assert.notEqual(abre, -1, `função ${nome} sumiu da tela`);
  let nivel = 0;
  const i = script.indexOf('{', abre);
  for (let j = i; j < script.length; j += 1) {
    if (script[j] === '{') nivel += 1;
    else if (script[j] === '}') { nivel -= 1; if (nivel === 0) return script.slice(i, j + 1); }
  }
  throw new Error(`não achei o fim de ${nome}`);
}

/* ── A REGRA QUE IMPORTA ─────────────────────────────────────────────────── */

test('TODA animação desta tela é desligada por prefers-reduced-motion', () => {
  const reduz = estilo.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.notEqual(reduz, -1, 'nenhuma animação pode entrar sem este bloco');
  const dentro = estilo.slice(reduz, estilo.indexOf('\n}', reduz));

  // toda classe que ANIMA, tirada do próprio CSS: animação nova entra aqui
  // sozinha e reprova se ninguém a desligar
  const animadas = [...estilo.matchAll(/^\.([\w-]+)\{[^}]*\banimation:(?!none)/gm)].map((m) => m[1]);
  assert.ok(animadas.length, 'nenhuma classe animada encontrada — o teste perdeu o alvo');
  const soltas = animadas.filter((cls) => !dentro.includes(`.${cls}`));
  assert.deepEqual(soltas, [], 'anima e não é desligada com movimento reduzido: ' + soltas.join(', '));
});

test('com movimento reduzido o sinal continua VISÍVEL, não some junto', () => {
  const reduz = estilo.indexOf('@media (prefers-reduced-motion: reduce)');
  const dentro = estilo.slice(reduz, estilo.indexOf('\n}', reduz));
  // `animation:none` num keyframes de ENTRADA deixaria o elemento no estado
  // inicial dele — que é `opacity:0`, ou seja, invisível. Desligar o movimento
  // não pode ser desligar a informação.
  assert.match(dentro, /opacity:1/,
    'sem devolver a opacidade, o ✓ fica invisível para quem desligou animação');
  assert.match(dentro, /transform:none/);
});

test('cada estado do sinal também está ESCRITO', () => {
  // a animação é para o canto do olho; quem diz o que aconteceu é o texto
  const corpo = script.slice(script.indexOf('const textoDoSinal = computed('));
  const ate = corpo.slice(0, corpo.indexOf('\n})'));
  for (const estado of ['gravando.value', "'ok'", "'falha'"]) {
    assert.ok(ate.includes(estado), `o estado ${estado} ficou sem frase`);
  }
  assert.match(template, /\{\{ textoDoSinal \}\}/, 'a frase tem de ir para a tela');
  assert.match(template, /class="au-sinal"[^]{0,200}role="status"/,
    'sem role="status" o leitor de tela não anuncia a mudança');
});

/* ── O SINAL DIZ A VERDADE ───────────────────────────────────────────────── */

test('o ✓ só acende quando o BANCO confirmou', () => {
  // ele nasce dentro de `marcarGravada`, o único ponto que sabe a resposta do
  // banco. Acendendo no chamador, o ✓ apareceria para uma peça que não foi
  // marcada — e a tela nunca mente (PADRAO item 9).
  const corpo = corpoDaFuncao('marcarGravada').replace(/\s+/g, ' ');
  assert.match(corpo, /avisarNaTela\('ok'\)/);
  assert.match(corpo, /avisarNaTela\('falha'\).*return false/,
    'o caminho que NÃO marcou tem de acender falha, nunca o ✓');
  const depoisDoOk = corpo.slice(corpo.indexOf("avisarNaTela('ok')"));
  assert.match(depoisDoOk, /^avisarNaTela\('ok'\) return true/,
    'o ✓ e o `return true` andam juntos: separados, um dos dois mente');
});

test('nenhuma saída de gravarNaEtiqueta fica sem sinal', () => {
  const corpo = corpoDaFuncao('gravarNaEtiqueta');
  // os dois caminhos que NÃO passam por marcarGravada: a etiqueta que já tem
  // outra peça, e a leitura de volta que não confere.
  //
  // A PERGUNTA MUDOU DE CASA em 01/09/2026: ela é a MESMA para o celular e para
  // o leitor de mesa, e mora em `abrirPerguntaDeSobrescrita`. O sinal continua
  // sendo aceso pelo RAMO — é ele que sabe que ninguém marcou peça nenhuma.
  const pare = corpo.slice(corpo.indexOf("if (situacao === 'outra-peca')"),
    corpo.indexOf("if (situacao === 'confere')"));
  assert.match(pare, /abrirPerguntaDeSobrescrita\(/, 'o ramo parou de abrir a pergunta');
  assert.match(corpoDaFuncao('abrirPerguntaDeSobrescrita'), /PARE: esta etiqueta/,
    'a pergunta parou de dizer PARE');
  assert.match(pare, /avisarNaTela\('falha'\)/, 'o "PARE" ficou sem sinal');
  const leituraRuim = corpo.slice(corpo.indexOf('não devolveu o endereço certo'));
  assert.match(leituraRuim.slice(0, 260), /avisarNaTela\('falha'\)/,
    'a leitura de volta que não confere ficou sem sinal');
  assert.match(corpo.slice(corpo.indexOf('} catch (erro)')), /avisarNaTela\('falha'\)/,
    'a falha do chip (NFC desligado, etiqueta pequena) ficou sem sinal');
});

test('o sinal some sozinho, e trocar de lote o apaga na hora', () => {
  // ✓ que fica na tela vira paisagem e passa a ser lido como se fosse da
  // PRÓXIMA etiqueta — e aí ele mente
  const corpo = corpoDaFuncao('avisarNaTela').replace(/\s+/g, ' ');
  assert.match(corpo, /clearTimeout\(relogioDoSinal\)/,
    'sem limpar o relógio anterior, o sinal novo some no tempo do antigo');
  assert.match(corpo, /setTimeout\(\(\) => \{ sinalDaGravacao\.value = '' \}/);
  const trocaDeLote = script.slice(script.indexOf('watch(loteEscolhido'));
  assert.match(trocaDeLote.slice(0, trocaDeLote.indexOf('})')), /sinalDaGravacao\.value = ''/,
    'o ✓ do lote anterior sob um lote novo é sinal do lote errado');
});

/* ── PADRAO-DA-CENTRAL, ITEM 8: A BARRA SOMA, NÃO SUBSTITUI ──────────────── */

test('a barra entrou e o texto "N de M" continua na tela', () => {
  assert.match(template, /class="au-barra" role="progressbar"/, 'a barra sumiu');
  assert.match(template, /\{\{ progressoDoLoteAtual\.texto \}\} gravadas neste lote/,
    'barra sozinha não diz quantas faltam nem dá para ler em voz alta na bancada');
  // e o "Peça 7 de 20 · 6 de 20 prontas" do bloco de gravação continua inteiro
  assert.match(template, /progressoDoLote\(pecasDoLote\(loteEscolhido\)\)\.texto \}\} prontas/);
  // a barra tem de dizer os mesmos números para quem usa leitor de tela
  assert.match(template, /:aria-valuenow="progressoDoLoteAtual\.gravadas"/);
  assert.match(template, /:aria-valuemax="progressoDoLoteAtual\.total"/);
});

test('a barra não divide por zero num lote sem peça', () => {
  const corpo = script.slice(script.indexOf('const larguraDoProgresso = computed('));
  assert.match(corpo.slice(0, corpo.indexOf('\n})')), /total \?/,
    'sem a guarda, um lote vazio devolve `NaN%` e a barra some sem explicação');
});

test('o farol fica FORA do bloco que some quando o lote acaba', () => {
  // gravando a última peça, `proxima` vira nulo e `.au-gravacao` inteiro
  // desaparece — junto com o ✓ da etiqueta que a pessoa acabou de encostar
  assert.ok(
    template.indexOf('class="au-farol"') < template.indexOf('v-if="!proxima" class="au-pronto"'),
    'o farol tem de vir ANTES do par v-if/v-else da peça da vez',
  );
});
