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
