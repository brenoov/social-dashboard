import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// Cópia do guarda que já existe em `patrimonio`, `admin`, `gestao-trafego` e
// `frota` — mesma dor, quatro vezes: usar uma função da pasta vizinha sem
// importar NÃO quebra o `npm run build`. O Vite supõe que o nome é global do
// navegador e deixa passar; só estoura quando alguém clica, e aí o Vue aborta
// o desenho no meio, deixando a tela em branco.
//
// POR QUE ELE CHEGOU AQUI (11/08/2026): nenhuma ficha de colaborador abria, e
// esta pasta não tinha guarda nenhum. **Ele NÃO era a causa** — passou de
// primeira, e o defeito era outro (duas listas de campos que divergiram, ver
// ficha-do-colaborador.test.mjs). Fica assim mesmo: a pasta é uma das ~15 que
// ainda não tinham a proteção, e agora tem.
//
// Ou seja: guarda verde aqui NÃO significa tela sã. Significa só que este
// defeito específico não está presente.

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
// ("etiqueta", "resumo") acusariam import faltando que não falta — e um teste
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
  const vue = readFileSync(join(AQUI, 'tela-de-acessos.vue'), 'utf8')
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')))
}

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  return s
}

// Nome que a própria tela declara não precisa vir de fora. Sem isto, um
// `function formatarValor()` local viraria acusação falsa só porque um vizinho
// exporta o mesmo nome.
function nomesDeclaradosNaTela(script) {
  const s = new Set()
  for (const m of script.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:function|const|let|var)\s+(\w+)/g)) s.add(m[1])
  return s
}

test('a tela de colaboradores não usa função de módulo sem importar', () => {
  const script = scriptDaTela()
  const importados = nomesImportados(script)
  const declarados = nomesDeclaradosNaTela(script)
  const faltando = []
  for (const [nome, arq] of nomesExportados()) {
    if (importados.has(nome) || declarados.has(nome)) continue
    // Chamada `nome(`, indexação `NOME[`, acesso `NOME.` ou uso solto. Só
    // `nome(` não basta — constante usada como objeto passa batido.
    const usado = new RegExp(`(^|[^\\w.$'"\`])${nome}\\s*[([.,);\\]}]`, 'm')
    if (usado.test(script)) faltando.push(`${nome} (exportado por ${arq})`)
  }
  assert.deepEqual(faltando, [], 'a tela usa estes nomes e não os importa — abre em branco, e o build NÃO pega')
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
  const script = 'import { alfa } from "./x.js"\n const x = SITUACOES[0]'
  const importados = nomesImportados(script)
  const usado = new RegExp(`(^|[^\\w.$'"\`])SITUACOES\\s*[([.,);\\]}]`, 'm')
  assert.ok(usado.test(script))
  assert.ok(!importados.has('SITUACOES'))
})

test('o guarda nao le TEXTO DE TELA como se fosse codigo', () => {
  // `rotulos-do-bem.js` exporta nomes que são palavra comum. Uma frase de tela
  // contendo a palavra não pode virar acusação.
  const comTexto = semComentarios("const aviso = 'confira o textoDoDono(agora)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])textoDoDono\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})

test('nome declarado na propria tela nao vira acusacao falsa', () => {
  const script = 'function formatarValor(c) { return c }\n formatarValor(1)'
  assert.ok(nomesDeclaradosNaTela(script).has('formatarValor'))
})
