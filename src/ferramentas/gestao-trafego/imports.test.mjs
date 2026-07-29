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

function scriptDaTela() {
  const vue = readFileSync(join(AQUI, 'tela-de-gestao-trafego.vue'), 'utf8');
  return vue.slice(vue.indexOf('<script'), vue.indexOf('</script>'));
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
    // `nome(` = chamada. Basta pra pegar o caso que já quebrou duas vezes.
    if (new RegExp(`\\b${nome}\\s*\\(`).test(script)) faltando.push(`${nome} (exportado por ${arq})`);
  }
  assert.deepEqual(faltando, [], 'a tela usa estes nomes mas não os importa — vai quebrar em runtime, e o build NÃO pega');
});

test('o proprio teste enxerga um import faltando', () => {
  // Sem isto o teste poderia estar sempre passando por engano.
  const script = 'import { alfa } from "./x.js"\n beta(1)';
  const importados = nomesImportados(script);
  assert.ok(importados.has('alfa'));
  assert.ok(!importados.has('beta'));
  assert.ok(/\bbeta\s*\(/.test(script), 'e reconhece a chamada de beta');
});
