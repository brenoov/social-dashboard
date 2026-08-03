import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// Duas vezes no mesmo dia (2026-07-29) a aba Campanhas quebrou inteira porque eu
// usei uma função de módulo sem importá-la: primeiro `card` (variável apagada
// junto com o selo), depois `baldeEfetivo`. As duas vezes `npm run build` passou
// — o Vite não resolve identificadores livres, o erro só existe em runtime — e o
// dono descobriu abrindo a tela.
//
// Este teste varre o que os módulos da pasta EXPORTAM e confere que, se a tela
// chama algum deles, existe o import correspondente. É análise de texto, não de
// escopo: pega o caso comum (chamar função de módulo esquecendo o import) e não
// pega variável local apagada — para essa existe render-anuncios.test.mjs, que
// executa a função de verdade.

const AQUI = dirname(fileURLToPath(import.meta.url));

function nomesExportados() {
  const mapa = new Map();
  for (const arq of readdirSync(AQUI).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
    const src = readFileSync(join(AQUI, arq), 'utf8');
    for (const m of src.matchAll(/export (?:function|const|let) (\w+)/g)) mapa.set(m[1], arq);
  }
  return mapa;
}

// Comentário que MENCIONA um símbolo não é uso dele. Sem tirar, "ver
// GT_OBJETIVO_BALDE" e "(ALVOS.trafego)" viravam import faltando — e um teste
// que acusa o que não existe é pior que teste nenhum: ensina a ignorá-lo.
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // bloco
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');  // linha (o [^:] evita cortar "https://")
}

function scriptDaTela() {
  const vue = readFileSync(join(AQUI, 'tela-de-gestao-trafego.vue'), 'utf8');
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')));
}

function nomesImportados(script) {
  const s = new Set();
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop());
  }
  return s;
}

test('a tela não chama função de módulo sem importar', () => {
  const script = scriptDaTela();
  const importados = nomesImportados(script);
  const faltando = [];
  for (const [nome, arq] of nomesExportados()) {
    if (importados.has(nome)) continue;
    // Chamada de função `nome(`, acesso a objeto `NOME[` ou `NOME.`, ou uso
    // solto do identificador. Só `nome(` não bastava: `ALVOS[o]` passou batido e
    // quebrou a aba pela terceira vez (2026-07-29).
    const usado = new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm');
    if (usado.test(script)) faltando.push(`${nome} (exportado por ${arq})`);
  }
  assert.deepEqual(faltando, [], 'a tela usa estes nomes mas não os importa — vai quebrar em runtime, e o build NÃO pega');
});

test('o proprio teste enxerga um import faltando', () => {
  // Sem isto o teste poderia estar sempre passando por engano.
  const script = 'import { alfa } from "./x.js"\n beta(1)';
  const importados = nomesImportados(script);
  assert.ok(importados.has('alfa'));
  assert.ok(!importados.has('beta'));
});

test('pega CONSTANTE usada como objeto, nao so chamada de funcao', () => {
  // `ALVOS[o]` passou batido na primeira versao do teste e quebrou a aba pela
  // TERCEIRA vez no mesmo dia. Chamada, indexacao e acesso a campo contam.
  const usado = (nome, script) => new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm').test(script);
  assert.ok(usado('ALVOS', 'const x = ALVOS[o]'), 'indexacao');
  assert.ok(usado('ALVOS', 'const x = ALVOS.trafego'), 'acesso a campo');
  assert.ok(usado('lerSaldo', 'lerSaldo(conta, 10)'), 'chamada');
  // e NAO confunde com propriedade de outro objeto nem com texto solto
  assert.ok(!usado('ALVOS', 'const x = config.ALVOS.trafego'), 'propriedade de outro objeto');
  // Comentario e tratado antes, por semComentarios — aqui so o codigo importa.
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NÃO PODE MORAR DENTRO DE UMA ABA.
//
// O defeito real (2026-08-03): o modal de criativo/gastos nasceu dentro de
// `#gt-painel-campanhas` e funcionava, porque só era aberto pela lista de
// anúncios — que vive nessa aba. Quando a Fila passou a abri-lo (a lupa do
// criativo e o botão de gastos), ele parou de aparecer: a troca de aba põe o
// painel em `display:none`, e ancestral escondido esconde o filho por mais que
// se mande `display:flex` nele.
//
// O clique rodava. A função rodava. Nada acontecia, e NENHUM erro aparecia no
// console — o pior formato de falha que existe. Nem o build nem os testes de
// unidade pegam isso, porque é uma relação entre dois pedaços de HTML.
test('o modal de criativo/gastos NÃO está dentro do painel de campanhas', () => {
  const vue = readFileSync(new URL('./tela-de-gestao-trafego.vue', import.meta.url), 'utf8');
  const abre = vue.indexOf('<div id="gt-painel-campanhas">');
  assert.ok(abre > -1, 'o painel de campanhas sumiu — atualize este teste');

  // Onde o painel FECHA: conta as <div> abertas e fechadas a partir dele.
  let i = abre, nivel = 0, fecha = -1;
  const tags = /<div\b[^>]*>|<\/div>/g;
  tags.lastIndex = abre;
  let m;
  while ((m = tags.exec(vue))) {
    nivel += m[0] === '</div>' ? -1 : 1;
    if (nivel === 0) { fecha = m.index; break; }
    i = m.index;
  }
  assert.ok(fecha > abre, 'não consegui achar o fim do painel de campanhas');

  const dentro = vue.slice(abre, fecha);
  for (const id of ['gt-cr-overlay', 'gt-cr-modal']) {
    assert.ok(!dentro.includes(`id="${id}"`),
      `${id} está DENTRO de #gt-painel-campanhas — some quando outra aba está ativa`);
  }
});
