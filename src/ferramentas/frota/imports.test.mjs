import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTE ARQUIVO EXISTE (10/08/2026): o mesmo defeito — chamar uma função
// de um vizinho e esquecer de importá-la — já derrubou três telas do projeto:
//
//   29/07  Gestão de Tráfego  `card` e `baldeEfetivo`, duas vezes no mesmo dia
//   05/08  Admin              `vendedoras`, `veOEstoque`, `podeLiberarEstoque`
//   10/08  Patrimônio         `formatarDataBR` — Planilha e Resumo em branco
//
// Nos três o `npm run build` passou: o Vite não resolve identificador livre,
// supõe que é global do navegador, e o erro só nasce quando alguém clica.
//
// A Frota era a maior pasta ainda sem o guarda — e `tela-de-frota.vue` tem mais
// de 4.000 linhas, que é exatamente onde um import esquecido se esconde melhor.

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
// ("revisoes", "plano") acusariam import faltando que não falta — e um teste
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

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  return s
}

// Nome que o próprio arquivo declara não precisa vir de fora. Sem isto, uma
// `function dataBR()` local viraria acusação falsa só porque um vizinho
// exporta o mesmo nome.
function nomesDeclarados(script) {
  const s = new Set()
  for (const m of script.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:function|const|let|var)\s+(\w+)/g)) s.add(m[1])
  return s
}

// Todas as telas da pasta, e não só a principal: o defeito do Patrimônio estava
// num arquivo só, mas nada garante que o próximo esteja.
const TELAS = readdirSync(AQUI).filter((f) => f.endsWith('.vue'))

for (const tela of TELAS) {
  test(`${tela} não usa função de módulo sem importar`, () => {
    const bruto = readFileSync(join(AQUI, tela), 'utf8')
    const script = semComentarios(bruto.slice(bruto.indexOf('<script'), bruto.indexOf('</script>')))
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
    assert.deepEqual(faltando, [], `${tela} usa estes nomes e não os importa — quebra ao clicar, e o build NÃO pega`)
  })
}

test('o guarda olha TODAS as telas da pasta, e não só a principal', () => {
  assert.ok(TELAS.includes('tela-de-frota.vue'))
  assert.ok(TELAS.length >= 3, 'a pasta tem mais de uma tela; o guarda precisa ver todas')
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
  const script = 'import { alfa } from "./x.js"\n const x = AREAS[0]'
  const importados = nomesImportados(script)
  const usado = new RegExp(`(^|[^\\w.$'"\`])AREAS\\s*[([.,);\\]}]`, 'm')
  assert.ok(usado.test(script))
  assert.ok(!importados.has('AREAS'))
})

test('o guarda nao le TEXTO DE TELA como se fosse codigo', () => {
  const comTexto = semComentarios("const aviso = 'confira o precisaAbastecer(agora)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])precisaAbastecer\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})
