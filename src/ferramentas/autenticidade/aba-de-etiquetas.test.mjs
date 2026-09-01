/* A ABA ETIQUETAS — consertar o que foi gravado errado.
 *
 * O pedido do dono: "coloque uma aba de edição de etiquetas onde eu possa
 * apagar gravações e etc...".
 *
 * As contas puras se provam em `lotes.test.mjs` (etiquetasGravadas,
 * codigosComGarantia, motivoObrigatorio, descricaoDaPeca, as frases de recusa).
 * O que se prova AQUI é a LIGAÇÃO com a tela: que a aba entrou sem partir a
 * corrente das outras, que a peça com garantia aparece marcada, que o motivo é
 * cobrado ANTES do banco, e que a senha não sobrevive à ação. É pelo
 * código-fonte porque `node --test` não compila `.vue`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('./tela-de-autenticidade.vue', import.meta.url), 'utf8');
const template = fonte.slice(0, fonte.indexOf('<script setup>'));
const script = fonte.slice(fonte.indexOf('<script setup>'), fonte.indexOf('</script>'));
const estilo = fonte.slice(fonte.indexOf('<style scoped>'));

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

/** O bloco inteiro da aba, do `v-else-if` dela até o da aba seguinte. */
const aba = template.slice(
  template.indexOf(`<template v-else-if="aba === 'etiquetas'">`),
  template.indexOf(`<template v-else-if="aba === 'registros'">`),
);

/* ── A ABA ENTROU SEM PARTIR A CORRENTE ──────────────────────────────────── */

test('a aba existe, e na ordem do caminho', () => {
  const lista = script.slice(script.indexOf('const ABAS = ['), script.indexOf(']', script.indexOf('const ABAS = [')));
  const chaves = [...lista.matchAll(/chave: '([\w-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(chaves, ['lotes', 'gravar', 'etiquetas', 'registros', 'alertas'],
    'Etiquetas é o desfazer de Gravar: ela vem logo depois');
});

/* `v-else-if` GRUDA NO `v-if` ANTERIOR. Um `v-if` solto no meio parte a corrente
 * em duas, e o `v-else` do fim — a aba Alertas inteira — passa a ser desenhado
 * embaixo das outras abas. Já aconteceu nesta tela, medido a 375px em 30/08. */
test('a corrente das abas continua inteira, do carregando ao v-else final', () => {
  const corrente = [...template.matchAll(/v-(if="carregando"|else-if="falha"|else-if="aba === '\w+'")/g)]
    .map((m) => m[1]);
  assert.deepEqual(corrente, [
    'if="carregando"',
    'else-if="falha"',
    "else-if=\"aba === 'lotes'\"",
    "else-if=\"aba === 'gravar'\"",
    "else-if=\"aba === 'etiquetas'\"",
    "else-if=\"aba === 'registros'\"",
  ], 'a aba nova tem de ser um `v-else-if` entre Gravar e Registros, na mesma corrente');
  // e a aba Alertas continua sendo o `v-else` que fecha a corrente
  const alertas = template.indexOf('<!-- ── ALERTAS');
  assert.notEqual(alertas, -1, 'o bloco da aba Alertas sumiu');
  assert.match(template.slice(alertas, alertas + 260), /<template v-else>/,
    'a aba Alertas tem de continuar sendo o `v-else` logo depois de Registros');
});

/* ── A LISTA ─────────────────────────────────────────────────────────────── */

test('a lista traz só as JÁ GRAVADAS, e dá para filtrar por lote', () => {
  assert.match(script, /etiquetasGravadas\(pecas\.value, loteDaEtiqueta\.value \|\| null\)/,
    'a lista sai do recorte puro, não de um filtro reescrito na tela');
  assert.match(aba, /v-model="loteDaEtiqueta"/);
  assert.match(aba, /<option value="">Todos os lotes<\/option>/,
    'sem a opção de todos, não dá para achar a peça de quem não lembra o lote');
});

test('cada linha diz QUAL BOLSA é, não só o código', () => {
  // "K7M4X9QP2R" não é bolsa nenhuma; "Mônaco · Quartz · nº 7" é
  assert.match(aba, /descricaoDaPeca\(pc, loteDaPeca\(pc\.lote_id\)\)/);
  assert.match(aba, /Gravada em \{\{ dataCurta\(pc\.gravada_em\) \}\}/, 'tem de dizer QUANDO');
  assert.match(aba, /enderecoDaTag\(pc\.codigo\)/,
    'o endereço é o que está DENTRO da etiqueta: sem ele ninguém confere o que vai apagar');
  assert.match(aba, /estadoDaPeca\(pc\)\.selo/);
});

test('a peça com garantia de cliente aparece MARCADA na lista', () => {
  // sem isto, quem vai apagar a gravação não tem como saber que do outro lado
  // há uma cliente com uma bolsa na mão
  assert.match(aba, /v-if="temGarantia\(pc\.codigo\)"[^]{0,120}Garantia de cliente/);
  assert.match(script, /codigosComGarantia\(registros\.value\)/,
    'a garantia sai de vessel_registros, que a tela já lê — não é leitura nova');
});

test('a lista não desenha 500 linhas de uma vez, e diz quantas faltam', () => {
  assert.match(script, /etiquetasDaAba\.value\.slice\(0, quantasEtiquetas\.value\)/);
  assert.match(aba, /v-for="pc in etiquetasVisiveis"/, 'o v-for roda sobre a fatia');
  assert.match(aba, /faltam \{\{ etiquetasQueFaltamMostrar \}\}/,
    'lista que esconde sem avisar é lista que mente');
});

test('trocar de lote recomeça a lista e fecha a pergunta aberta', () => {
  const trecho = script.slice(script.indexOf('watch(loteDaEtiqueta'));
  const ate = trecho.slice(0, trecho.indexOf('})') + 2).replace(/\s+/g, ' ');
  assert.match(ate, /quantasEtiquetas\.value = DE_CADA_VEZ/,
    'o limite crescido de um lote de 500 faria o lote seguinte desenhar 500 linhas');
  assert.match(ate, /fecharApagar\(\)/,
    'a pergunta diz o código de UMA peça: peça errada na pergunta é pior que pergunta nenhuma');
});

test('quem só pode ver não ganha o botão que apaga', () => {
  assert.match(aba, /v-if="podeEditar && apagando\?\.codigo !== pc\.codigo"/);
});

/* ── DUAS PERGUNTAS, O MOTIVO E A SENHA ──────────────────────────────────── */

test('são duas perguntas, e a segunda não repete a primeira', () => {
  assert.match(aba, /v-if="etapaDeApagar === 1"/);
  assert.match(aba, /<template v-else>/);
  const textos = [...aba.matchAll(/class="au-confirma-texto">([^]*?)<\/p>/g)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim());
  // o primeiro é o aviso da garantia, que fica fora do par de perguntas
  assert.ok(textos.length >= 3, 'faltou uma das perguntas');
  assert.notEqual(textos[1], textos[2], 'a segunda pergunta repete a primeira');
  assert.match(textos[2], /continua costurada dentro de uma bolsa/,
    'a segunda pergunta tem de dizer o que sobra no mundo depois de apagar');
});

test('o botão da primeira etapa avança, e não apaga', () => {
  const primeira = aba.slice(aba.indexOf('etapaDeApagar === 1'), aba.indexOf('<template v-else>'));
  assert.doesNotMatch(primeira, /apagarGravacao/,
    'seriam duas perguntas de mentira: a primeira já apagaria');
  assert.match(primeira, /@click="etapaDeApagar = 2"/);
});

test('a TELA cobra o motivo antes do banco, quando há garantia', () => {
  // o banco recusa com `motivo_obrigatorio` — mas aí a pessoa já apertou o
  // botão, digitou a senha e esperou a rede para descobrir que faltava um campo
  // que estava na tela o tempo todo
  const corpo = corpoDaFuncao('apagarGravacao').replace(/\s+/g, ' ');
  const cobranca = corpo.indexOf('motivoObrigatorio({ temGarantia: alvo.temGarantia }) && !motivo');
  const chamada = corpo.indexOf("rpc('vessel_desmarcar_gravada'");
  assert.notEqual(cobranca, -1, 'a tela parou de cobrar o motivo por conta própria');
  assert.ok(cobranca < chamada, 'cobrar o motivo DEPOIS de chamar o banco não adianta nada');
  assert.match(corpo, /erroDeApagar\.value = fraseDaRecusa\('motivo_obrigatorio'\)/);
  // e a tela diz na hora que aquele campo é obrigatório, sem esperar o erro
  assert.match(aba, /motivoEhObrigatorio \? '' : ' \(opcional\)'/);
  assert.match(aba, /Esta peça tem garantia registrada por uma cliente/);
});

test('a senha é conferida no servidor ANTES de apagar', () => {
  const corpo = corpoDaFuncao('apagarGravacao').replace(/\s+/g, ' ');
  const conferir = corpo.indexOf('await conferirASenha(senha)');
  const apagar = corpo.indexOf("rpc('vessel_desmarcar_gravada'");
  assert.notEqual(conferir, -1, 'a aba parou de conferir a senha');
  assert.ok(conferir < apagar, 'conferir depois de apagar não confere coisa nenhuma');
  assert.match(aba, /v-model="senhaDeApagar" type="password"/);
});

test('a senha desta aba também não sobrevive à ação', () => {
  const corpo = corpoDaFuncao('apagarGravacao');
  assert.match(corpo.slice(corpo.lastIndexOf('} finally {')), /senhaDeApagar\.value = ''/);
  assert.match(corpoDaFuncao('fecharApagar'), /senhaDeApagar\.value = ''/);
  assert.match(corpoDaFuncao('pedirApagarGravacao'), /senhaDeApagar\.value = ''/);
});

test('a peça da pergunta é CONTADA no clique, não relida no fim', () => {
  // com a lista recarregando por baixo, reler a peça lá no fim faria a pergunta
  // falar de uma e apagar outra
  assert.match(corpoDaFuncao('pedirApagarGravacao'), /codigo: pc\.codigo/);
  assert.match(corpoDaFuncao('apagarGravacao'), /const alvo = apagando\.value/);
});

test('o motivo em branco vai NULO, e não string vazia', () => {
  // é o que o banco entende por "não escreveram motivo" (`nullif(trim(...), '')`)
  assert.match(corpoDaFuncao('apagarGravacao').replace(/\s+/g, ' '),
    /p_codigo: alvo\.codigo, p_motivo: motivo \|\| null/);
});

/* ── O AVISO DA GARANTIA ─────────────────────────────────────────────────── */

test('quando o banco diz que tinha garantia, a tela AVISA — e o aviso fica', () => {
  const corpo = corpoDaFuncao('apagarGravacao').replace(/\s+/g, ' ');
  assert.match(corpo, /const eraDeCliente = data\.tinha_garantia/,
    'quem sabe a verdade no instante da escrita é quem escreveu: o aviso sai da RESPOSTA');
  assert.match(corpo, /avisoDaGarantia\.value = /);
  assert.match(corpo, /CONTINUA VALENDO/,
    'a garantia da cliente continua valendo, e é isso que precisa estar escrito');
  assert.match(aba, /v-if="avisoDaGarantia"/, 'o aviso tem de ir para a tela, não só para o recado que some');
  assert.match(aba, /@click="avisoDaGarantia = ''"/, 'e tem de dar para dispensar');
});

test('o aviso só aparece quando há o que dizer', () => {
  // aviso que aparece sempre vira paisagem (PADRAO item 9)
  assert.match(script, /const avisoDaGarantia = ref\(''\)/);
});

test('a recusa do banco fica DENTRO da pergunta, onde a pessoa está olhando', () => {
  const corpo = corpoDaFuncao('apagarGravacao').replace(/\s+/g, ' ');
  assert.match(corpo, /if \(!data\?\.ok\) \{ erroDeApagar\.value = fraseDaRecusa\(data\?\.motivo, data\); return \}/);
});

/* ── O CSS NÃO PODE TER SIDO QUEBRADO ────────────────────────────────────── */

test('o @media do celular continua sendo a ÚLTIMA coisa do CSS', () => {
  // duas regras de mesma especificidade: ganha a última. Uma regra-base escrita
  // DEPOIS do @media apaga o ajuste de celular em silêncio
  const ultimo = estilo.lastIndexOf('@media (max-width:520px)');
  assert.notEqual(ultimo, -1, 'o ajuste de celular sumiu do CSS');
  const depois = estilo.slice(ultimo).replace(/@media \(max-width:520px\)\{[^]*?\n\}/, '');
  assert.equal(depois.replace(/<\/style>/, '').trim(), '',
    'tem regra escrita DEPOIS do @media de celular');
});

test('todo botão desta tela nasce com 40px de alvo', () => {
  // a regra estava repetida em quatro blocos, e cada bloco novo precisava
  // lembrar de repetir. O de agora não lembrou: o "Entendi" do aviso e o
  // "Mostrar mais" da aba nasceram com 37px, medidos a 375px.
  const base = estilo.match(/\n\.au-botao\{([^}]*)\}/);
  assert.ok(base, 'a regra-base do botão sumiu');
  assert.match(base[1], /min-height:40px/);
  assert.match(base[1], /box-sizing:border-box/, 'sem isto o padding soma por fora e a conta muda');
});

/* ── A COLISÃO COM O `.abas` GLOBAL ──────────────────────────────────────────
 * `.abas` é uma classe GENÉRICA e existe em `estilos-globais.css` — e o global
 * vaza para o scoped em toda propriedade que o scoped não declarar. Estas três
 * foram MEDIDAS no navegador com o CSS do build, não deduzidas. */

test('a fileira das abas desliga o `justify-content:center` do global', () => {
  // numa fileira que transborda, o conteúdo centralizado sai para os DOIS
  // lados, e o que sai pela ESQUERDA não se alcança rolando: `scrollLeft` já
  // está em 0. Medido a 375px: a aba "Lotes" nascia em -67px, fora da tela.
  const regra = estilo.match(/\n\.abas\{([^}]*)\}/);
  assert.ok(regra, 'a regra da fileira sumiu');
  assert.match(regra[1], /justify-content:flex-start/);
  assert.match(regra[1], /overflow-x:auto/, 'sem isto quem rola é a PÁGINA');
  assert.match(regra[1], /flex-wrap:nowrap/);
  assert.match(regra[1], /border-bottom:0/,
    'no elemento que rola, a linha teria a largura do CONTEÚDO: quem a desenha é a .abas-barra');
});

test('a barra desenha a linha, e ela ocupa a largura da tela', () => {
  assert.match(estilo, /\.abas-barra\{[^}]*border-bottom:1px solid var\(--border\)/);
});

test('o botão da aba desliga o `margin-bottom:-1px` do global', () => {
  // lá ele existe para a aba encostar na linha do próprio `.abas`; aqui ele
  // sobreporia o sublinhado da barra
  const regra = estilo.match(/\.abas button\{([^}]*)\}/);
  assert.ok(regra, 'a regra do botão da aba sumiu');
  assert.match(regra[1], /margin-bottom:0/);
  assert.match(regra[1], /min-height:40px/);
  assert.match(regra[1], /white-space:nowrap/, 'nome de aba não corta: a barra rola');
});

test('a aba ativa usa o par de cor que o PADRAO manda, e já vem medido', () => {
  // o accent puro sobre o próprio tom aguado dá 4,42 no tema escuro e reprova
  // por pouco. Medido com o CSS do build: 7,49 no claro e 6,44 no escuro.
  assert.match(estilo, /\.abas button\.on\{[^}]*color:var\(--accent-forte\)[^}]*background:var\(--accent-light\)/);
});

test('o botão secundário das perguntas não reprova no tema escuro', () => {
  // com `--accent` puro sobre o fundo da caixa de aviso ele mede 4,46 no
  // escuro — reprova por pouco, e "por pouco" continua sendo reprovado.
  // Medido com o CSS do build: 4,46 → 6,02 no escuro e 5,87 → 7,91 no claro.
  assert.match(estilo, /\.au-confirma \.au-botao\.secundario\{color:var\(--accent-forte\)\}/);
});
