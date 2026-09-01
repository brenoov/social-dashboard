/* O MODO BANCADA — a prova da conta pura, e a prova de que a tela usa ela.
 *
 * POR QUE ESTE ARQUIVO EXISTE. O dono usou a aba Gravar de pé e disse: "ta muito
 * ruim o layout e visual, n ta funcional, está confuso, texto maiores que
 * outros, espaços vazios, não centralizados, uma criança de 5 anos precisa
 * conseguir fazer o processo, precisa ser didático, fácil, FUNCIONAL". O modo
 * bancada é a resposta: um painel de máquina, com a peça da vez em letra
 * garrafal, o estado, o progresso e UM botão.
 *
 * O QUE SE PROVA AQUI:
 *   1. a conta pura — qual estado sai de qual fase, e a frase de cada estado;
 *   2. a única ação, e o que ela chama;
 *   3. quando o modo pode ser ligado, e quando ele TEM de se desligar sozinho;
 *   4. a ligação com a tela, pelo código-fonte, porque `node --test` não compila
 *      `.vue`;
 *   5. as regras de desenho que o dono pediu com estas palavras — TRÊS tamanhos
 *      de texto e UMA ação principal. Elas são o pedido, então elas têm teste:
 *      sem isto, o quarto tamanho volta na próxima entrega e ninguém vê.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FASES, MODOS, nomeDoModo, estadoDaBancada, acaoDaBancada,
  podeEntrarNaBancada, precisaSairDaBancada, bancadaLembrada, lembrarBancada,
} from './modo-bancada.js';

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

/* ── 1. O ESTADO, E A FRASE DE CADA ESTADO ────────────────────────────────── */

test('cada fase tem um estado, e nenhum estado sai sem título e sem detalhe', () => {
  // "Deu erro" sozinho, de pé na bancada com uma bolsa na mão, não diz o que
  // fazer — e a pessoa ou joga fora uma etiqueta boa ou costura uma muda.
  for (const fase of FASES) {
    for (const modo of MODOS) {
      const e = estadoDaBancada({ fase, modo });
      assert.equal(e.chave, fase, `a fase ${fase} não voltou como chave`);
      assert.ok(e.titulo.trim(), `a fase ${fase} (${modo}) saiu sem título`);
      assert.ok(e.detalhe.trim().length > 20,
        `a fase ${fase} (${modo}) saiu sem dizer o que fazer`);
      assert.ok(['neutro', 'agindo', 'ok', 'erro'].includes(e.tom),
        `a fase ${fase} saiu com um tom que o CSS não pinta: ${e.tom}`);
    }
  }
});

test('a sequência de estados é a que o dono descreveu', () => {
  assert.equal(estadoDaBancada({ fase: 'esperando' }).titulo, 'Encoste a etiqueta');
  assert.equal(estadoDaBancada({ fase: 'gravando' }).titulo, 'Gravando…');
  assert.equal(estadoDaBancada({ fase: 'ok' }).titulo, 'Pronto');
  assert.equal(estadoDaBancada({ fase: 'erro' }).titulo, 'Deu erro');
});

test('o tom de cada estado é o que a cor vai dizer', () => {
  assert.equal(estadoDaBancada({ fase: 'parado' }).tom, 'neutro');
  assert.equal(estadoDaBancada({ fase: 'esperando' }).tom, 'agindo');
  assert.equal(estadoDaBancada({ fase: 'gravando' }).tom, 'agindo');
  assert.equal(estadoDaBancada({ fase: 'ok' }).tom, 'ok');
  assert.equal(estadoDaBancada({ fase: 'fim' }).tom, 'ok');
  assert.equal(estadoDaBancada({ fase: 'erro' }).tom, 'erro');
});

test('o recado da sequência VENCE o texto padrão', () => {
  // é a única frase que sabe a diferença entre "a etiqueta ficou pela metade,
  // separe" e "o leitor está ocupado, a etiqueta está boa". Texto genérico por
  // cima dele é a tela mentindo.
  const dito = 'A gravação parou na metade: SEPARE ESTA ETIQUETA e pegue outra.';
  assert.equal(estadoDaBancada({ fase: 'erro', recado: dito }).detalhe, dito);
  assert.equal(estadoDaBancada({ fase: 'ok', recado: 'Peça 5 gravada.' }).detalhe, 'Peça 5 gravada.');
  // recado em branco não apaga a frase: sobra o texto padrão, nunca o vazio
  assert.ok(estadoDaBancada({ fase: 'erro', recado: '   ' }).detalhe.trim());
});

test('nenhuma frase do modo manda trocar a etiqueta', () => {
  // a mesma cicatriz do `InvalidStateError` e das frases do leitor de mesa:
  // quando o problema é do aparelho, a etiqueta está boa — e quem troca etiqueta
  // boa joga bolsa fora, uma atrás da outra.
  for (const fase of FASES) {
    for (const modo of MODOS) {
      const { titulo, detalhe } = estadoDaBancada({ fase, modo });
      assert.doesNotMatch(`${titulo} ${detalhe}`, /troque a etiqueta|jogue (a etiqueta )?fora|separe esta/i,
        `a fase ${fase} (${modo}) manda mexer na etiqueta sem saber se ela está boa`);
    }
  }
});

test('fase e modo desconhecidos caem no caminho seguro, sem estourar', () => {
  const e = estadoDaBancada({ fase: 'inventada', modo: 'inventado' });
  assert.equal(e.chave, 'parado');
  assert.ok(e.detalhe.trim());
  assert.equal(estadoDaBancada().chave, 'parado');
});

test('o modo em uso tem nome escrito, sempre', () => {
  assert.equal(nomeDoModo('mesa'), 'Leitor de mesa');
  assert.equal(nomeDoModo('celular'), 'Celular encostado');
  assert.equal(nomeDoModo('copiar'), 'Pelo aplicativo');
  assert.ok(nomeDoModo('qualquer outra coisa').trim(), 'modo sem nome deixa a tela muda');
});

/* ── 2. A ÚNICA AÇÃO ──────────────────────────────────────────────────────── */

test('há UMA ação por vez, e ela sempre tem rótulo', () => {
  for (const fase of FASES) {
    for (const modo of MODOS) {
      const a = acaoDaBancada({ fase, modo });
      assert.ok(a.rotulo.trim(), `a fase ${fase} (${modo}) deixou o botão sem rótulo`);
      assert.ok(['gravar', 'marcar', 'sair'].includes(a.chave), `chave desconhecida: ${a.chave}`);
      assert.equal(typeof a.ocupado, 'boolean');
    }
  }
});

test('enquanto grava o botão TRAVA, e não some', () => {
  // botão que some no meio faz a pessoa procurar, e procurar com a etiqueta na
  // mão é tirar a etiqueta de cima do leitor
  for (const fase of ['esperando', 'gravando']) {
    const a = acaoDaBancada({ fase, modo: 'mesa' });
    assert.equal(a.ocupado, true);
    assert.ok(a.rotulo.trim());
  }
  assert.equal(acaoDaBancada({ fase: 'parado', modo: 'mesa' }).ocupado, false);
});

test('cada modo chama o caminho dele', () => {
  assert.equal(acaoDaBancada({ fase: 'parado', modo: 'mesa' }).chave, 'gravar');
  assert.equal(acaoDaBancada({ fase: 'parado', modo: 'celular' }).chave, 'gravar');
  // no modo do aplicativo quem grava é o celular da pessoa; aqui só se confirma
  assert.equal(acaoDaBancada({ fase: 'parado', modo: 'copiar' }).chave, 'marcar');
});

test('sem peça por gravar o botão vira a porta de saída', () => {
  const a = acaoDaBancada({ fase: 'fim', modo: 'mesa' });
  assert.equal(a.chave, 'sair');
  assert.equal(a.ocupado, false);
});

/* ── 3. QUANDO O MODO APARECE, E QUANDO ELE SAI ───────────────────────────── */

test('só entra na bancada quem pode gravar, com lote e com peça na fila', () => {
  const cheio = { podeEditar: true, temLote: true, temPecaPorGravar: true };
  assert.equal(podeEntrarNaBancada(cheio), true);
  assert.equal(podeEntrarNaBancada({ ...cheio, podeEditar: false }), false);
  assert.equal(podeEntrarNaBancada({ ...cheio, temLote: false }), false);
  assert.equal(podeEntrarNaBancada({ ...cheio, temPecaPorGravar: false }), false);
  assert.equal(podeEntrarNaBancada(), false);
});

test('a pergunta de sobrescrever TIRA a tela do modo bancada', () => {
  // ela tem dois seletores, o aviso de garantia de cliente e um motivo
  // obrigatório, e apaga a identidade de uma bolsa. Copiá-la para dentro do
  // painel seria a segunda cópia da pergunta mais perigosa da ferramenta.
  assert.equal(precisaSairDaBancada({ sobrescrita: { codigoAntigo: 'ABC' } }), true);
  assert.equal(precisaSairDaBancada({ sobrescrita: null }), false);
  assert.equal(precisaSairDaBancada(), false);
});

test('a escolha do modo fica lembrada, e o depósito quebrado não derruba a tela', () => {
  const guardado = new Map();
  const bom = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v) };
  assert.equal(bancadaLembrada(bom), false);
  assert.equal(lembrarBancada(true, bom), true);
  assert.equal(bancadaLembrada(bom), true);
  lembrarBancada(false, bom);
  assert.equal(bancadaLembrada(bom), false);

  // `localStorage` ESTOURA em janela anônima e com dados de site bloqueados
  const quebrado = {
    getItem() { throw new Error('bloqueado'); },
    setItem() { throw new Error('bloqueado'); },
  };
  assert.equal(bancadaLembrada(quebrado), false);
  assert.equal(lembrarBancada(true, quebrado), false);
});

/* ── 4. A LIGAÇÃO COM A TELA ──────────────────────────────────────────────── */

test('a tela chama a conta pura, e não reescreve nenhuma frase', () => {
  assert.match(script, /from '\.\/modo-bancada\.js'/, 'a tela não importa o módulo');
  for (const nome of ['estadoDaBancada', 'acaoDaBancada', 'podeEntrarNaBancada',
    'precisaSairDaBancada', 'bancadaLembrada', 'lembrarBancada', 'nomeDoModo']) {
    assert.match(script, new RegExp(`\\b${nome}\\b`), `a tela não usa ${nome}`);
  }
  // as frases de estado moram no módulo, que se prova. Uma cópia no `.vue` não
  // teria teste nenhum — `node --test` não compila `.vue`.
  for (const frase of ['Encoste a etiqueta', 'Gravando…', 'Deu erro']) {
    assert.ok(!template.includes(`>${frase}<`),
      `a frase "${frase}" foi escrita à mão no template, fora da conta que se prova`);
  }
});

test('a fase da bancada nasce em UM lugar só para o ✓ e o ✗', () => {
  // escrever a fase em cada caminho de gravação seria a segunda cópia da mesma
  // decisão, e a que ficasse para trás deixaria o painel dizendo "Gravando…"
  // com a etiqueta já fora do leitor
  const corpo = corpoDaFuncao('avisarNaTela');
  assert.match(corpo, /faseDaBancada\.value = /,
    'o único ponto que sabe se a gravação terminou bem parou de dizer a fase');
  const quantas = (script.match(/faseDaBancada\.value = sinal/g) || []).length;
  assert.equal(quantas, 1, 'a tradução de sinal para fase foi copiada para outro lugar');
});

test('o painel NÃO depende do sinal que some sozinho', () => {
  // `sinalDaGravacao` some em 2,6s porque é desenho de canto de olho. A frase
  // grande do painel é o que se lê com a bolsa na mão: erro que some em dois
  // segundos é a tela escondendo o que a pessoa precisa.
  assert.match(script, /const estadoDaBancadaAgora = computed\(\(\) => estadoDaBancada\(\{/);
  const bloco = script.slice(
    script.indexOf('const estadoDaBancadaAgora'),
    script.indexOf('const acaoDaBancadaAgora'),
  );
  assert.doesNotMatch(bloco, /sinalDaGravacao/,
    'o estado do painel voltou a sair do sinal que se apaga em 2,6 segundos');
});

test('a fase vem pelo segundo argumento do `aoContar`, não de ler a frase', () => {
  // adivinhar o estado pelo texto faria alguém melhorar uma palavra na sequência
  // e o painel parar de mudar de estado, em silêncio
  const sequencia = readFileSync(
    new URL('./gravador-de-mesa/gravar-pelo-leitor-de-mesa.js', import.meta.url), 'utf8');
  assert.match(sequencia, /aoContar\([^)]*, 'esperando'\)/);
  assert.match(sequencia, /aoContar\([^)]*, 'gravando'\)/);
  assert.match(script, /aoContar: \(frase, fase\) =>/);
});

test('a pergunta de sobrescrever tira a tela do modo, no lugar em que ela nasce', () => {
  assert.match(corpoDaFuncao('abrirPerguntaDeSobrescrita'),
    /precisaSairDaBancada\(\{ sobrescrita: sobrescrita\.value \}\)/);
});

test('nada do que sai do modo bancada fica inalcançável (PADRAO item 8)', () => {
  // cada coisa que some do painel continua existindo FORA dele, e a porta de
  // volta é uma só e está sempre à vista
  assert.match(template, /@click="sairDaBancada"/, 'sumiu a porta de saída');
  assert.match(template, /@click="entrarNaBancada"/, 'sumiu a porta de entrada');
  assert.match(template, /@click="abrirGuia"/, 'o guia ficou sem chamador');
  // o que some do painel é desenhado no `v-else` — a tela de hoje, inteira
  for (const marca of [
    'Dar baixa nesta peça', 'Excluir esta peça', 'Gravador de mesa',
    'Gravar pelo aplicativo', 'Gravar pelo leitor de mesa', 'Gravar encostando o celular',
    'Travar a etiqueta depois de gravar',
  ]) {
    assert.ok(template.includes(marca), `"${marca}" sumiu da ferramenta inteira`);
  }
  // e a barra de abas volta com ela
  assert.match(template, /<div v-if="!naBancada" class="abas"/);
});

/* ── 5. AS REGRAS DE DESENHO QUE O DONO PEDIU ─────────────────────────────── */

/** O CSS do modo bancada: da abertura do bloco até o fim do arquivo. */
const cssDaBancada = estilo.slice(estilo.indexOf('.au-bancada{'));

test('TRÊS tamanhos de texto no modo bancada, e três só', () => {
  // "texto maiores que outros" foi a queixa. Os três degraus moram em três
  // variáveis, e nenhuma regra do modo escreve `font-size` de outro jeito: é
  // por isso que dá para contar lendo o CSS.
  const declaracoes = [...cssDaBancada.matchAll(/\.au-(bancada|entrada-bancada)[^{}]*\{[^}]*\}/g)]
    .flatMap((m) => [...m[0].matchAll(/font-size:\s*([^;}]+)/g)].map((f) => f[1].trim()));
  const semVariavel = declaracoes.filter((d) => !d.startsWith('var(--bancada-'));
  assert.deepEqual(semVariavel.map((d) => d.replace(/\s+/g, ' ')), [
    // a porta de ENTRADA vive fora do painel, onde as três variáveis não valem:
    // ela usa o mesmo 13px do "resto"
    'max(9px, calc(13px * var(--escala-texto, 1)))',
  ], 'apareceu um tamanho de texto fora dos três degraus do modo bancada');

  const degraus = [...cssDaBancada.matchAll(/--bancada-(peca|estado|resto):\s*([^;]+);/g)]
    .map((m) => m[2].replace(/\s+/g, ' '));
  // três degraus, mais o degrau de celular do número da peça (o mesmo papel,
  // noutra largura — é o que o `.mc-val` da casa já faz)
  assert.deepEqual(degraus, [
    'max(16px, calc(44px * var(--escala-texto, 1)))',
    'max(16px, calc(24px * var(--escala-texto, 1)))',
    'max(9px, calc(13px * var(--escala-texto, 1)))',
    'max(16px, calc(32px * var(--escala-texto, 1)))',
  ]);
});

test('a cor de estado do painel sai de token, nunca de hex', () => {
  const tons = [...cssDaBancada.matchAll(/\.au-bancada-(neutro|agindo|ok|erro)\{--bancada-cor:([^}]+)\}/g)];
  assert.equal(tons.length, 4, 'faltou um tom de estado');
  for (const [, nome, valor] of tons) {
    assert.match(valor, /^var\(--[\w-]+\)$/, `o tom ${nome} não sai de token: ${valor}`);
  }
});

test('a cor NUNCA é o único aviso', () => {
  // o título diz o estado por escrito, e ele é irmão da moldura colorida
  assert.match(template, /<p class="au-bancada-titulo">\{\{ estadoDaBancadaAgora\.titulo \}\}<\/p>/);
  assert.match(template, /<p class="au-bancada-detalhe">\{\{ estadoDaBancadaAgora\.detalhe \}\}<\/p>/);
  // e a peça da vez na fila não se distingue só pelo fundo: a palavra "agora"
  assert.match(template, /'agora' : estadoDaPeca\(pf\)\.rotulo/);
});

test('UMA ação principal no painel, e um botão só a carrega', () => {
  const painel = template.slice(
    template.indexOf('<section v-if="naBancada"'),
    template.indexOf('</section>'),
  );
  const principais = (painel.match(/class="au-botao/g) || []).length;
  assert.equal(principais, 1,
    'o painel voltou a ter mais de uma ação principal — duas competindo é o mesmo que nenhuma');
  assert.match(painel, /@click="tocarNaBancada"/);
});

test('o endereço deixa de ser o maior elemento nos modos automáticos', () => {
  // ali ele é CONFERÊNCIA, não leitura: quem lê é a máquina. Só no modo de
  // copiar ele volta a ser grande e selecionável.
  assert.match(cssDaBancada,
    /\.au-bancada-endereco\{[^}]*font-size:var\(--bancada-resto\)/);
  assert.match(cssDaBancada,
    /\.au-bancada \.au-endereco\{font-size:var\(--bancada-estado\)/);
  assert.match(template, /modoDaBancada === 'copiar'/);
});

test('o painel do computador é UM bloco centrado, e não uma faixa num canto', () => {
  // "espaços vazios" e "não centralizados" foram as queixas, nestas palavras.
  // A primeira e a terceira coluna são `1fr` IGUAIS: é isso, e só isso, que põe
  // o bloco no centro da tela em vez de na coluna da esquerda. E o
  // `align-self:center` é o que junta o que estava espalhado na vertical.
  const grande = estilo.slice(
    estilo.indexOf('@media (min-width:900px){'),
    estilo.lastIndexOf('@media (max-width:520px){'),
  );
  assert.match(grande, /\.au-bancada\{\s*display:grid;/);
  assert.match(grande, /grid-template-columns:minmax\(0,1fr\) minmax\(0,660px\) minmax\(0,1fr\);/,
    'as colunas de fora têm de ser iguais, senão o bloco sai do centro');
  assert.match(grande, /\.au-bancada-obra\{grid-column:2; grid-row:2; align-self:center;/);
  assert.match(grande, /\.au-bancada-lado\{grid-column:3; grid-row:2; align-self:center;/);
});

test('o estado e a ação são VIZINHOS na ordem da tela', () => {
  // quem lê "ponha a etiqueta" precisa ter o botão no campo de visão, sem
  // procurar. Numa versão anterior o botão morava no pé da tela e o olho fazia
  // mil pixels entre o que está acontecendo e o que se aperta.
  const bloco = template.slice(
    template.indexOf('<div class="au-bancada-obra">'),
    template.indexOf('<div v-if="filaAoRedor.length > 1"'),
  );
  const ordem = ['au-bancada-peca', 'au-bancada-estado', 'au-bancada-acao', 'au-bancada-progresso']
    .map((c) => bloco.indexOf(`class="${c}"`));
  assert.ok(ordem.every((i) => i > 0), 'sumiu um dos quatro blocos do painel');
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem,
    'a ordem do painel mudou: peça → estado → ação → progresso');
});

test('o ajuste de celular do painel mora no `@media` do FIM do arquivo', () => {
  // as regras-base do `.au-bancada` são escritas DEPOIS do bloco da tela
  // grande: com a mesma especificidade, quem vem por último ganha, e lá em cima
  // estes ajustes seriam ignorados em silêncio
  const celular = estilo.slice(estilo.lastIndexOf('@media (max-width:520px){'));
  assert.match(celular, /\.au-bancada\{padding-left:16px/);
  assert.ok(estilo.lastIndexOf('@media (max-width:520px){') > estilo.indexOf('.au-bancada{'),
    'o bloco do celular foi escrito ANTES das regras-base do painel');
});
