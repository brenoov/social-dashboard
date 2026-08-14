import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NUM COMPONENTE DAQUI PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTE ARQUIVO EXISTE (13/08/2026): o mesmo defeito — chamar uma função
// de um vizinho e esquecer de importá-la — já derrubou três telas deste
// projeto:
//
//   29/07  Gestão de Tráfego  `card` e `baldeEfetivo`, duas vezes no mesmo dia
//   05/08  Admin              `vendedoras`, `veOEstoque`, `podeLiberarEstoque`
//   10/08  Patrimônio         `formatarDataBR` — Planilha e Resumo em branco
//
// Nos três o `npm run build` passou: o Vite não resolve identificador livre,
// supõe que é global do navegador, e o erro só nasce quando alguém clica — o
// Vue aborta o desenho no meio e o painel fica EM BRANCO. O
// `todo-vue-compila.test.mjs` também não pega: compilar não é resolver nome.
//
// O guarda das ferramentas olha só a pasta dela, e esta pasta não tinha um.
// Duas coisas ficaram descobertas quando o cadastro rápido de pessoa chegou:
// o `escolha-de-pessoa.vue`, que usa `cargosConhecidos`, `dadosDaPessoaRapida`,
// `resolverNovaOpcao` e `normalizarNome` de vizinhos daqui; e o
// `resolverNovaOpcao` dentro do `tela-de-patrimonio.vue`, que era coberto
// enquanto o `nova-opcao.js` morava no Patrimônio e deixou de ser quando o
// arquivo mudou de pasta.
//
// Diferente do guarda das ferramentas, este olha TODOS os `.vue` da pasta: aqui
// não há uma tela principal, há um punhado de peças que todas as ferramentas
// usam — e uma peça compartilhada em branco apaga a tela de quem a usa.

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
// ("avisos", "datas") acusariam import faltando que não falta — e um teste que
// acusa o que não existe ensina a ignorá-lo.
//
// A crase fica de propósito: `${...}` dentro dela é código de verdade.
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
}

function componentesDaPasta() {
  return readdirSync(AQUI).filter((f) => f.endsWith('.vue')).sort()
}

function scriptDoComponente(arq) {
  const vue = readFileSync(join(AQUI, arq), 'utf8')
  return semComentarios(vue.slice(vue.indexOf('<script'), vue.indexOf('</script>')))
}

function nomesImportados(script) {
  const s = new Set()
  for (const m of script.matchAll(/import \{([^}]+)\} from/g)) {
    for (const n of m[1].split(',')) s.add(n.trim().split(/\s+as\s+/).pop())
  }
  return s
}

// Nome que o próprio componente declara não precisa vir de fora. Sem isto, um
// `const cargos = …` local viraria acusação falsa só porque um vizinho exporta
// o mesmo nome.
function nomesDeclarados(script) {
  const s = new Set()
  for (const m of script.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:function|const|let|var)\s+(\w+)/g)) s.add(m[1])
  return s
}

function usosSemImport(script) {
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
  return faltando
}

test('a pasta tem componentes para guardar — o teste não pode passar por estar vazio', () => {
  const arquivos = componentesDaPasta()
  assert.ok(arquivos.length >= 5, `só achei ${arquivos.length} .vue em compartilhado/`)
  assert.ok(arquivos.includes('escolha-de-pessoa.vue'))
  assert.ok(arquivos.includes('escolha-de-local-e-ambiente.vue'))
})

for (const arq of componentesDaPasta()) {
  test(`${arq} não usa função de módulo sem importar`, () => {
    assert.deepEqual(
      usosSemImport(scriptDoComponente(arq)), [],
      `${arq} usa estes nomes e não os importa — abre em branco, e o build NÃO pega`)
  })
}

test('o proprio teste enxerga um import faltando', () => {
  // Sem isto, o teste poderia estar passando sempre por engano — que é
  // exatamente o estado em que o defeito passou nas três vezes.
  const script = 'import { alfa } from "./x.js"\n beta(1)'
  const importados = nomesImportados(script)
  assert.ok(importados.has('alfa'))
  assert.ok(!importados.has('beta'))
})

test('o guarda acusa um nome DESTA pasta usado sem import', () => {
  // `cargosConhecidos` é do pessoas-para-escolher.js, aqui do lado: um
  // componente que o chame sem importar tem de ser pego.
  const script = 'import { normalizarNome } from "./nova-opcao.js"\n const c = cargosConhecidos(lista)'
  assert.deepEqual(usosSemImport(script), ['cargosConhecidos (exportado por pessoas-para-escolher.js)'])
})

test('pega CONSTANTE usada como objeto, e nao so chamada de funcao', () => {
  const script = 'import { alfa } from "./x.js"\n const x = SITUACOES[0]'
  const importados = nomesImportados(script)
  const usado = new RegExp(`(^|[^\\w.$'"\`])SITUACOES\\s*[([.,);\\]}]`, 'm')
  assert.ok(usado.test(script))
  assert.ok(!importados.has('SITUACOES'))
})

test('o guarda nao le TEXTO DE TELA como se fosse codigo', () => {
  // Uma frase de tela que contenha o nome de uma função não pode virar
  // acusação: o componente escreve português para gente.
  const comTexto = semComentarios("const aviso = 'confira o normalizarNome(agora)'")
  const usado = new RegExp(`(^|[^\\w.$'"\`])normalizarNome\\s*[([.,);\\]}]`, 'm')
  assert.ok(!usado.test(comTexto), 'texto de tela virou código')
})

test('nome declarado no proprio componente nao vira acusacao falsa', () => {
  const script = 'function normalizarNome(c) { return c }\n normalizarNome(1)'
  assert.ok(nomesDeclarados(script).has('normalizarNome'))
  assert.deepEqual(usosSemImport(script), [])
})
