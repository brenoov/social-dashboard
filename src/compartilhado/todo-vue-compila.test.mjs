import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse, compileTemplate, compileScript } from '@vue/compiler-sfc'

/* TODO ARQUIVO .VUE AINDA COMPILA?
 *
 * A suíte roda em `node --test`, e o Node NÃO entende `.vue`. Nenhum dos quase
 * dois mil testes desta central abre um componente pelo compilador — eles
 * exercitam os `.js` de regra ao lado. O resultado é um buraco de guarda: um
 * `.vue` quebrado deixa a suíte INTEIRA verde e só aparece no `vite build`,
 * quando já se acha que está tudo pronto pra subir.
 *
 * Isto já aconteceu neste projeto. Sobraram duas linhas de andaime de
 * ferramenta — literalmente `</content>` e `</invoke>` — depois do `</style>`
 * de src/ferramentas/frota/editor-de-checklist.vue. O compilador reclama
 * "Invalid end tag", o `npm run build` aborta, e como o build produz UM pacote
 * só, o SITE INTEIRO deixa de subir por causa de uma tela. Os testes tinham
 * passado.
 *
 * Este teste fecha o buraco pela raiz: passa cada `.vue` de src/ pelo mesmo
 * compilador que o build usa e falha com o nome do arquivo e a queixa. É a
 * checagem mais barata que existe contra o defeito mais caro que existe aqui —
 * o que derruba tudo. */

const RAIZ = new URL('../', import.meta.url).pathname

function vues(dir) {
  const saida = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) saida.push(...vues(p))
    else if (e.name.endsWith('.vue')) saida.push(p)
  }
  return saida
}

const texto = (e) => (e && e.message) || String(e)

/**
 * As queixas do compilador sobre um `.vue`. Lista vazia = compila.
 *
 * São três passos porque são três compiladores diferentes, e cada um pega uma
 * classe de erro que os outros deixam passar: a divisão em blocos, o
 * `<template>` e o `<script>`.
 */
export function queixasDoCompilador(fonte, arquivo = 'componente.vue') {
  const { descriptor, errors } = parse(fonte, { filename: arquivo })
  // Erro de divisão em blocos derruba tudo o que vem depois: sem descriptor
  // confiável, compilar template e script só produziria queixas derivadas que
  // confundem em vez de ajudar.
  if (errors.length) return errors.map(texto)

  const queixas = []
  if (descriptor.template) {
    const r = compileTemplate({
      source: descriptor.template.content,
      filename: arquivo,
      id: arquivo,
      // O build compila o template do `<script setup>` junto com o script, e é
      // esse modo que casa com o que o Vite faz — pedir o modo errado inventaria
      // queixa sobre código que funciona.
      compilerOptions: { bindingMetadata: undefined },
    })
    queixas.push(...(r.errors || []).map(texto))
  }
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      compileScript(descriptor, { id: arquivo })
    } catch (e) {
      queixas.push(texto(e))
    }
  }
  return queixas
}

test('todo arquivo .vue de src/ passa pelo compilador do Vue', () => {
  const problemas = []
  for (const arq of vues(RAIZ)) {
    const queixas = queixasDoCompilador(readFileSync(arq, 'utf8'), arq)
    if (queixas.length) problemas.push(`${arq.replace(RAIZ, '')}: ${queixas.join(' | ')}`)
  }
  assert.deepEqual(problemas, [],
    'estes arquivos não compilam — o `npm run build` aborta e o site inteiro deixa de subir. '
    + 'Abra cada um e corrija o que a queixa aponta antes de mesclar')
})

test('a checagem PEGA o defeito — senão não guarda nada', () => {
  // Sem esta prova, o teste acima poderia estar sempre verde por estar quebrado.
  // Reproduz em miniatura o caso real do editor-de-checklist: andaime de
  // ferramenta vazado pra dentro do fonte, depois do `</style>`.
  const bom = `<template>
  <div class="ec">oi</div>
</template>

<script setup>
const a = 1
</script>

<style scoped>
.ec { color: red; }
</style>`
  assert.deepEqual(queixasDoCompilador(bom), [])

  const comAndaime = `${bom}
</content>
</invoke>`
  assert.equal(queixasDoCompilador(comAndaime).length > 0, true)
  assert.match(queixasDoCompilador(comAndaime).join(' '), /Invalid end tag/)
})

test('pega também template mal fechado e script com erro de sintaxe', () => {
  // As outras duas portas de entrada do mesmo estrago: uma tag do template que
  // ninguém fechou, e JavaScript que não é JavaScript.
  const tagAberta = `<template>
  <div><span>oi</div>
</template>`
  assert.equal(queixasDoCompilador(tagAberta).length > 0, true)

  const scriptQuebrado = `<template><div/></template>

<script setup>
const a = (((
</script>`
  assert.equal(queixasDoCompilador(scriptQuebrado).length > 0, true)
})
