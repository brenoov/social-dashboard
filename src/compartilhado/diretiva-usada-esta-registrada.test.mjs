/* Toda diretiva escrita num template PRECISA estar registrada em algum lugar.
 *
 * O estrago que originou este teste: `v-trava-rolagem` estava escrita em 8
 * modais — moldura do app, Patrimônio, Frota, Status do Claude, leitor de
 * etiqueta, passeio guiado — e NENHUM deles travava a rolagem do fundo. O
 * módulo existia, os testes dele passavam, a diretiva estava exportada. Só
 * que ninguém a REGISTROU no app, e em `<script setup>` uma diretiva só vale
 * se for importada no próprio componente ou registrada no `createApp`.
 *
 * O Vue não quebra nesse caso: escreve "Failed to resolve directive" no
 * console e segue em frente. Ou seja, o defeito ficava calado — a tela abria,
 * o modal aparecia, e só o comportamento sumia. Foi preciso abrir o navegador
 * e LER o console pra descobrir, o que ninguém faz toda vez.
 *
 * Este teste faz essa leitura sozinho, a cada rodada.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/** As que o próprio Vue já traz — não precisam de registro. */
const DO_VUE = new Set([
  'if', 'else', 'else-if', 'for', 'on', 'bind', 'model', 'slot', 'pre',
  'cloak', 'once', 'memo', 'html', 'text', 'show',
]);

function arquivos(pasta, ext, achados = []) {
  for (const nome of readdirSync(pasta)) {
    if (nome === 'node_modules' || nome === 'dist') continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, achados);
    else if (nome.endsWith(ext)) achados.push(caminho);
  }
  return achados;
}

/** `v-nome` no template, ignorando as do Vue e os modificadores (`v-on:click`). */
export function diretivasUsadas(fonte) {
  const template = fonte.split('</template>')[0];
  const achadas = new Set();
  for (const m of template.matchAll(/\sv-([a-z][\w-]*)/g)) {
    const nome = m[1];
    if (!DO_VUE.has(nome)) achadas.add(nome);
  }
  return [...achadas];
}

/** Registrada no app (`app.directive('nome')`) ou importada no componente (`vNomeAssim`). */
export function estaRegistrada(nome, fonteDoComponente, fonteDoPontoDePartida) {
  if (fonteDoPontoDePartida.includes(`directive('${nome}'`)) return true;
  if (fonteDoPontoDePartida.includes(`directive("${nome}"`)) return true;
  const camel = 'v' + nome.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return new RegExp(`\\b${camel}\\b`).test(fonteDoComponente.split('<template')[0] + fonteDoComponente.split('</template>').slice(1).join(''));
}

test('toda diretiva usada num template está registrada', () => {
  const partida = readFileSync(join(RAIZ, 'ponto-de-partida.js'), 'utf8');
  const semRegistro = [];
  for (const caminho of arquivos(RAIZ, '.vue')) {
    const fonte = readFileSync(caminho, 'utf8');
    for (const nome of diretivasUsadas(fonte)) {
      if (!estaRegistrada(nome, fonte, partida)) {
        semRegistro.push(`${caminho.replace(RAIZ + '/', '')}: v-${nome}`);
      }
    }
  }
  assert.deepStrictEqual(
    semRegistro,
    [],
    'diretiva usada sem registro — o Vue só avisa no console e segue, ' +
      'então o comportamento some sem ninguém perceber:\n' + semRegistro.join('\n'),
  );
});

test('a checagem PEGA o defeito — senão não guarda nada', () => {
  const componente = '<template>\n  <div v-trava-rolagem></div>\n</template>\n<script setup></script>';
  assert.deepStrictEqual(diretivasUsadas(componente), ['trava-rolagem']);
  assert.strictEqual(estaRegistrada('trava-rolagem', componente, 'createApp(X).mount()'), false);
  assert.strictEqual(estaRegistrada('trava-rolagem', componente, "app.directive('trava-rolagem', vTravaRolagem)"), true);
});

test('diretiva importada no próprio componente também conta', () => {
  const componente =
    '<template>\n  <div v-foco></div>\n</template>\n<script setup>\nimport { vFoco } from "./foco.js"\n</script>';
  assert.strictEqual(estaRegistrada('foco', componente, 'createApp(X).mount()'), true);
});

test('as diretivas do próprio Vue não exigem registro', () => {
  const componente = '<template>\n  <div v-if="a" v-for="b in c" v-show="d" v-html="e"></div>\n</template>';
  assert.deepStrictEqual(diretivasUsadas(componente), []);
});
