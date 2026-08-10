import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTA PASTA JÁ NASCE COM O GUARDA (10/08/2026): o mesmo defeito —
// chamar uma função de um vizinho e esquecer de importá-la — já derrubou três
// telas deste projeto:
//
//   29/07  Gestão de Tráfego  `card` e `baldeEfetivo`, duas vezes no mesmo dia
//   05/08  Admin              `vendedoras`, `veOEstoque`, `podeLiberarEstoque`
//   10/08  Patrimônio         `formatarDataBR` — Planilha e Resumo em branco
//
// Nos três casos o `npm run build` passou: o Vite não resolve identificador
// livre, supõe que é global do navegador, e o erro só nasce quando alguém
// clica. Nos três, o guarda foi escrito DEPOIS do estrago.
//
// Aqui ele vem antes.

const AQUI = dirname(fileURLToPath(import.meta.url))

function nomesExportados() {
  const mapa = new Map()
  for (const arq of readdirSync(AQUI).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
    const src = readFileSync(join(AQUI, arq), 'utf8')
    for (const m of src.matchAll(/export (?:function|const|let) (\w+)/g)) mapa.set(m[1], arq)
  }
  return mapa
}

// Comentário que MENCIONA um símbolo não é uso dele, e texto de tela também
// não é código. Sem apagar os dois, nomes que são palavra comum do português
// ("recorte", "linhas") acusariam import faltando que não falta — e um teste
// que acusa o que não existe ensina a ignorá-lo.
//
// A crase fica de propósito: `${...}` dentro dela é código de verdade.
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
}

function scriptDaCasca() {
  const vue = readFileSync(join(AQUI, 'aba-de-relatorios.vue'), 'utf8')
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')))
}

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  return s
}

// Nome que a própria casca declara não precisa vir de fora. Sem isto, uma
// `function celula()` local viraria acusação falsa só porque um vizinho
// exporta o mesmo nome.
function nomesDeclarados(script) {
  const s = new Set()
  for (const m of script.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:function|const|let|var)\s+(\w+)/g)) s.add(m[1])
  return s
}

test('a casca dos relatórios não usa função de módulo sem importar', () => {
  const script = scriptDaCasca()
  const importados = nomesImportados(script)
  const declarados = nomesDeclarados(script)
  const faltando = []
  for (const [nome, arq] of nomesExportados()) {
    if (importados.has(nome) || declarados.has(nome)) continue
    // Chamada `nome(`, indexação `NOME[`, acesso `NOME.` ou uso solto. Só
    // `nome(` não basta — constante usada como objeto passa batido.
    const usado = new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm')
    if (usado.test(script)) faltando.push(`${nome} (exportado por ${arq})`)
  }
  assert.deepEqual(faltando, [], 'a casca usa estes nomes e não os importa — abre em branco, e o build NÃO pega')
})

test('o proprio teste enxerga um import faltando', () => {
  // Sem isto, o teste poderia estar passando sempre por engano — que é
  // exatamente o estado em que o defeito passou nas três vezes.
  const script = 'import { alfa } from "./x.js"\n beta(1)'
  const importados = nomesImportados(script)
  assert.ok(importados.has('alfa'))
  assert.ok(!importados.has('beta'))
})

test('pega CONSTANTE usada como objeto, e nao so chamada de funcao', () => {
  const script = 'import { alfa } from "./x.js"\n const x = RECORTE_VAZIO.modo'
  const importados = nomesImportados(script)
  const usado = new RegExp(`(^|[^\\w.$'"\`])RECORTE_VAZIO\\s*[([.,);\\]}]`, 'm')
  assert.ok(usado.test(script))
  assert.ok(!importados.has('RECORTE_VAZIO'))
})

test('o guarda nao le TEXTO DE TELA como se fosse codigo', () => {
  const comTexto = semComentarios("const aviso = 'confira o filtrarPorRecorte(agora)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])filtrarPorRecorte\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})

test('nome declarado na propria casca nao vira acusacao falsa', () => {
  const script = 'function matrizParaExcel(c) { return c }\n matrizParaExcel(1)'
  assert.ok(nomesDeclarados(script).has('matrizParaExcel'))
})
