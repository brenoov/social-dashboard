import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* O ESTILO ALCANÇA O QUE O JAVASCRIPT DESENHA?
 *
 * Oito telas desta central montam parte do conteúdo com `innerHTML` — herança
 * do monólito. Elemento criado assim NÃO recebe a marca de escopo que o Vue
 * põe no que vem do `<template>`.
 *
 * A consequência é traiçoeira porque é silenciosa. Numa folha `scoped`:
 *
 *     .tela-x .cartao        vira   .tela-x .cartao[data-v-abc]
 *     .tela-x :deep(.cartao) vira   .tela-x[data-v-abc] .cartao
 *
 * O primeiro exige a marca NO CARTÃO, que o JS não põe — a regra existe, o
 * navegador a aceita, e ela simplesmente nunca casa com nada. Sem erro, sem
 * aviso, sem nada no console.
 *
 * Aconteceu de verdade: as métricas da Visão Geral do Colaboradores ficaram
 * SEM ESTILO NENHUM — sem grade, sem fundo, sem borda. O dono relatou como
 * "visual cru, feio demais", e a causa não era o desenho: era o CSS não
 * chegar. 28 regras.
 *
 * Este teste não olha aparência. Ele pergunta uma coisa só: existe regra
 * mirando uma classe que SÓ existe no JavaScript, sem :deep()? */

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

// As tags de bloco de um .vue ficam SEMPRE na coluna 0 — e a busca se ancora
// nisso de propósito: sem a âncora, um "</template>" escrito dentro de uma
// string do script encerraria o bloco no lugar errado.
function bloco(s, tag) {
  const abre = new RegExp(`^<${tag}[^>]*>`, 'm').exec(s)
  if (!abre) return ''
  const resto = s.slice(abre.index + abre[0].length)
  const fecha = new RegExp(`^</${tag}>`, 'm').exec(resto)
  return fecha ? resto.slice(0, fecha.index) : resto
}

// Classes escritas num atributo `class="..."` literal. Ignora interpolação,
// que não dá pra resolver estaticamente.
function classesDe(txt) {
  const fora = new Set()
  for (const m of txt.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && !/[{}$<>]/.test(c)) fora.add(c)
    }
  }
  return fora
}

function regrasQueNaoAlcancam(fonte) {
  if (!fonte.includes('<style scoped>')) return []
  const tpl = classesDe(bloco(fonte, 'template'))
  const js = classesDe(bloco(fonte, 'script'))
  const soJs = new Set([...js].filter((c) => !tpl.has(c)))
  if (!soJs.size) return []

  const css = bloco(fonte, 'style')
  const quebradas = new Set()
  for (const m of css.matchAll(/^([^\n{]*?)\{/gm)) {
    const sel = m[1]
    if (sel.includes(':deep') || sel.includes('@') || !sel.trim()) continue
    for (const parte of sel.split(',')) {
      const p = parte.trim()
      // Só seletor DESCENDENTE erra: quem mira a própria raiz está certo sem :deep.
      if (!p.includes(' ') && !p.includes('>')) continue
      const alvos = [...p.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((x) => x[1])
      if (alvos.length < 2) continue
      if (soJs.has(alvos[alvos.length - 1])) quebradas.add(alvos[alvos.length - 1])
    }
  }
  return [...quebradas]
}

test('nenhuma regra com escopo mira classe que só o JavaScript cria', () => {
  const problemas = []
  for (const arq of vues(RAIZ)) {
    const cls = regrasQueNaoAlcancam(readFileSync(arq, 'utf8'))
    if (cls.length) problemas.push(`${arq.replace(RAIZ, '')}: ${cls.map((c) => '.' + c).join(', ')}`)
  }
  assert.deepEqual(problemas, [],
    'estas regras nunca casam com nada — o elemento é criado por JS e não tem a marca de escopo. Envolva o seletor em :deep()')
})

test('a checagem PEGA o defeito — senão não guarda nada', () => {
  // Sem esta prova, o teste acima poderia estar sempre verde por estar quebrado.
  // Reproduz o caso real do Colaboradores em miniatura.
  const comDefeito = `<template>
  <div class="tela-x"></div>
</template>

<script setup>
const html = '<div class="cartao">oi</div>'
</script>

<style scoped>
.tela-x .cartao{background:red}
</style>`
  assert.deepEqual(regrasQueNaoAlcancam(comDefeito), ['cartao'])

  const corrigido = comDefeito.replace('.tela-x .cartao{', '.tela-x :deep(.cartao){')
  assert.deepEqual(regrasQueNaoAlcancam(corrigido), [])
})

test('não acusa quem está certo', () => {
  // Classe do próprio template: recebe a marca, não precisa de :deep.
  const noTemplate = `<template>
  <div class="tela-x"><span class="rotulo"></span></div>
</template>

<script setup>
const html = '<div class="cartao"></div>'
</script>

<style scoped>
.tela-x .rotulo{color:red}
.tela-x :deep(.cartao){color:blue}
</style>`
  assert.deepEqual(regrasQueNaoAlcancam(noTemplate), [])

  // Regra que mira a PRÓPRIA raiz não é descendente: está certa sem :deep.
  const raiz = `<template>
  <div class="tela-x"></div>
</template>

<script setup>
const h = '<i class="cartao"></i>'
</script>

<style scoped>
.tela-x{color:red}
</style>`
  assert.deepEqual(regrasQueNaoAlcancam(raiz), [])
})
