import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTE ARQUIVO EXISTE (05/08/2026): a seção "Puxar as vendedoras das
// vendas" subiu para produção sem os imports de `vendedoras.js`. O botão
// aparecia, o clique não fazia nada, e o `npm run build` passou — o Vite não
// resolve identificadores livres, então o erro só existe quando alguém clica.
//
// No mesmo dia descobri que `veOEstoque` e `podeLiberarEstoque` estavam na
// mesma situação: a caixinha de liberar estoque da tela de times também estava
// morta, e ninguém tinha percebido.
//
// A causa dos dois foi a mesma: eu editei o arquivo por substituição de texto e
// a linha do import não casou com a âncora — silenciosamente, porque aquela
// substituição foi a única que fiz sem conferir. O resto do código entrou; só o
// import ficou de fora.
//
// A Gestão de Tráfego já tinha este guarda desde 2026-07-29, pela mesma dor
// (`card` e `baldeEfetivo` quebraram a aba duas vezes no mesmo dia). O que
// faltava era ele valer também aqui.

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
// ("linha", "normalizar") acusariam import faltando que não falta — e um teste
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

function scriptDaTela() {
  const vue = readFileSync(join(AQUI, 'tela-de-admin.vue'), 'utf8')
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')))
}

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  return s
}

test('a tela de admin não usa função de módulo sem importar', () => {
  const script = scriptDaTela()
  const importados = nomesImportados(script)
  const faltando = []
  for (const [nome, arq] of nomesExportados()) {
    if (importados.has(nome)) continue
    // Chamada `nome(`, indexação `NOME[`, acesso `NOME.` ou uso solto. Só
    // `nome(` não basta — constante usada como objeto passa batido.
    const usado = new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm')
    if (usado.test(script)) faltando.push(`${nome} (exportado por ${arq})`)
  }
  assert.deepEqual(faltando, [], 'a tela usa estes nomes e não os importa — quebra ao clicar, e o build NÃO pega')
})

test('o proprio teste enxerga um import faltando', () => {
  // Sem isto, o teste poderia estar passando sempre por engano — que é
  // exatamente o estado em que o defeito passou.
  const script = 'import { alfa } from "./x.js"\n beta(1)'
  const importados = nomesImportados(script)
  assert.ok(importados.has('alfa'))
  assert.ok(!importados.has('beta'))
})

test('pega CONSTANTE usada como objeto, e nao so chamada de funcao', () => {
  const script = 'import { alfa } from "./x.js"\n const x = PAPEIS[0]'
  const importados = nomesImportados(script)
  const usado = new RegExp(`(^|[^\\w.$'"\`])PAPEIS\\s*[([.,);\\]}]`, 'm')
  assert.ok(usado.test(script))
  assert.ok(!importados.has('PAPEIS'))
})

test('o guarda nao le TEXTO DE TELA como se fosse codigo', () => {
  // `vendedoras.js` exporta `normalizar`, que é palavra comum. Uma frase de
  // tela contendo "normalizar" não pode virar acusação.
  const comTexto = semComentarios("const aviso = 'vamos normalizar(os dados)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])normalizar\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})
