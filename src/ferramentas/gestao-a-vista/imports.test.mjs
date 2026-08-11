import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTE ARQUIVO EXISTE: chamar uma função de outro arquivo e esquecer de
// importar NÃO quebra o `npm run build` — o Vite supõe que é global do
// navegador e deixa passar. O erro só nasce quando alguém clica, e a tela abre
// em branco. Já derrubou a Gestão de Tráfego (29/07/2026, duas vezes no mesmo
// dia), o Admin (05/08) e o Patrimônio (10/08).
//
// É a pendência B1 da lista do projeto. Este é o guarda desta pasta.
//
// UMA DIFERENÇA EM RELAÇÃO AOS ANTERIORES: este também olha
// `src/compartilhado/`. O guarda do Patrimônio só varre a própria pasta, e o
// telão importa de lá (`data-da-venda.js`, `estoque-gv.js`, `avisos.js`…) —
// um guarda que não cobre de onde o código realmente vem dá sensação de
// segurança sem dar segurança.

const AQUI = dirname(fileURLToPath(import.meta.url))
const COMPARTILHADO = resolve(AQUI, '..', '..', 'compartilhado')
const TELA = 'tela-de-gestao-a-vista.vue'

function nomesExportados() {
  const mapa = new Map()
  for (const pasta of [AQUI, COMPARTILHADO]) {
    for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
      const src = readFileSync(join(pasta, arq), 'utf8')
      for (const m of src.matchAll(/export (?:function|const|let|async function) (\w+)/g)) {
        if (!mapa.has(m[1])) mapa.set(m[1], arq)
      }
    }
  }
  return mapa
}

// Comentário que MENCIONA um símbolo não é uso dele, e texto de tela também
// não é código. Sem apagar os dois, nomes que são palavra comum do português
// acusariam import faltando que não falta — e um teste que acusa o que não
// existe ensina a ignorá-lo.
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
}

function scriptDaTela() {
  const vue = readFileSync(join(AQUI, TELA), 'utf8')
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')))
}

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  for (const m of script.matchAll(/import (\w+) from/g)) s.add(m[1])
  return s
}

// Nome que a própria tela declara não precisa vir de fora.
function nomesDeclaradosNaTela(script) {
  const s = new Set()
  for (const m of script.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+(\w+)/g)) s.add(m[1])
  return s
}

test('o telão não usa função de módulo sem importar', () => {
  const script = scriptDaTela()
  const importados = nomesImportados(script)
  const declarados = nomesDeclaradosNaTela(script)
  const faltando = []
  for (const [nome, arq] of nomesExportados()) {
    if (importados.has(nome) || declarados.has(nome)) continue
    const usado = new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm')
    if (usado.test(script)) faltando.push(`${nome} (exportado por ${arq})`)
  }
  assert.deepEqual(faltando, [], 'o telão usa estes nomes e não os importa — abre em branco, e o build NÃO pega')
})

test('o guarda cobre a pasta compartilhado, de onde o telão puxa a data da venda', () => {
  const exportados = nomesExportados()
  assert.equal(exportados.has('aplicarDataDaVenda'), true,
    'se este nome sumir do mapa, o guarda deixou de olhar compartilhado/ e não protege mais o ajuste da data')
})

test('o próprio guarda enxerga um import faltando', () => {
  // Sem isto, o teste poderia estar passando sempre por engano — que é
  // exatamente o estado em que o defeito passou.
  const script = 'import { alfa } from "./x.js"\n beta(1)'
  const importados = nomesImportados(script)
  assert.ok(importados.has('alfa'))
  assert.ok(!importados.has('beta'))
})

test('o guarda não lê TEXTO DE TELA como se fosse código', () => {
  const comTexto = semComentarios("const aviso = 'confira o textoDoDono(agora)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])textoDoDono\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})

test('nome declarado na própria tela não vira acusação falsa', () => {
  const script = 'function formatarValor(c) { return c }\n formatarValor(1)'
  assert.ok(nomesDeclaradosNaTela(script).has('formatarValor'))
})
