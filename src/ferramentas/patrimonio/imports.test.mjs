import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// TODO NOME DE MÓDULO USADO NA TELA PRECISA ESTAR IMPORTADO.
//
// POR QUE ESTE ARQUIVO EXISTE (10/08/2026): as abas Planilha e Resumo abriam em
// BRANCO. O dono clicava, a aba marcava, e embaixo não vinha nada.
//
// A causa: `linhasAchatadas` chamava `formatarDataBR` para montar a coluna
// "data de compra", e essa função — que existe e é exportada por
// `patrimonio-lista.js` — nunca foi importada na tela. A linha 862 trazia
// daquele arquivo só `textoLinhaHistorico`.
//
// Nome livre não quebra o `npm run build`: o Vite supõe que é global do
// navegador e deixa passar. Só estoura quando alguém abre a aba, e aí o Vue
// aborta o desenho no meio — a barra de abas já tinha sido atualizada (por isso
// a aba MARCA), o corpo não (por isso fica em BRANCO).
//
// E quebrava só essas duas abas porque `linhasAchatadas` só é usada por elas:
// Navegar e Etiquetas não passam por ali e seguiam funcionando, o que fazia o
// defeito parecer coisa de layout.
//
// Este guarda é o mesmo do Admin (05/08/2026) e da Gestão de Tráfego
// (29/07/2026), pela mesma dor, pela terceira vez. O que faltava era ele valer
// também aqui.

const AQUI = dirname(fileURLToPath(import.meta.url))
// O miolo compartilhado entra junto (13/08/2026): o `nova-opcao.js` nasceu nesta
// pasta e MUDOU para lá quando virou peça de três telas. Com o guarda olhando só
// os vizinhos daqui, o `resolverNovaOpcao` que a tela usa — e que estava coberto
// — passou a não ser mais. Arquivo que muda de pasta não pode levar embora a
// guarda que já existia sobre quem ficou.
const COMPARTILHADO = join(AQUI, '..', '..', 'compartilhado')

function nomesExportados() {
  const mapa = new Map()
  for (const pasta of [COMPARTILHADO, AQUI]) {
    for (const arq of readdirSync(pasta).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
      const src = readFileSync(join(pasta, arq), 'utf8')
      // A pasta desta ferramenta vem por último de propósito: nome repetido nos
      // dois lados é o daqui que a tela usa sem caminho, e é ele que o recado
      // precisa citar.
      for (const m of src.matchAll(/export (?:function|const|let) (\w+)/g)) mapa.set(m[1], arq)
    }
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
  const vue = readFileSync(join(AQUI, 'tela-de-patrimonio.vue'), 'utf8')
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

test('a tela de patrimônio não usa função de módulo sem importar', () => {
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

test('o guarda enxerga tambem o miolo compartilhado', () => {
  // Sem isto, mover um arquivo de novo desligaria a cobertura em silêncio.
  const mapa = nomesExportados()
  assert.equal(mapa.get('resolverNovaOpcao'), 'nova-opcao.js')
  assert.ok(mapa.has('mesclarPessoas'), 'pessoas-para-escolher.js precisa entrar na conta')
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
