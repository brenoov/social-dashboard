import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/* ⚠️ POR QUE ESTE ARQUIVO EXISTE
 *
 * `vessel_edicoes` guarda a trilha de tudo que muda uma peça, e tem uma LISTA
 * FECHADA de ações permitidas. A lista é boa: impede ação escrita errado de
 * entrar na trilha e virar linha que ninguém sabe ler.
 *
 * Mas em 05/09/2026 uma função nova (`vessel_baixar_garantia`) escreveu na
 * trilha uma ação que NÃO estava na lista. O banco recusava, a transação
 * inteira voltava atrás, e a tela dizia só "Não consegui encerrar agora". A
 * função nunca funcionou uma vez sequer, e nenhum teste viu — porque a função
 * e a lista moram em migrations diferentes e ninguém as leu juntas.
 *
 * Este teste as lê juntas. Se alguém criar a próxima ação e esquecer de somar
 * na lista, ele falha AQUI, e não na mão do dono. */

const PASTA = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const SQLS = readdirSync(PASTA).filter((n) => n.endsWith('.sql')).sort()
const TEXTOS = SQLS.map((n) => ({ nome: n, sql: readFileSync(join(PASTA, n), 'utf8') }))

// A LISTA QUE VALE é a do último arquivo que a redefine — as anteriores foram
// substituídas, e conferir contra uma lista velha daria falso alarme.
function listaPermitida() {
  for (const { sql } of [...TEXTOS].reverse()) {
    const i = sql.lastIndexOf('vessel_edicoes_acao_check')
    if (i === -1) continue
    const check = sql.slice(i)
    if (!/check\s*\(/i.test(check)) continue
    const arr = check.match(/array\s*\[([^\]]+)\]/i)
    if (!arr) continue
    return arr[1].match(/'([a-z_]+)'/g).map((s) => s.replace(/'/g, ''))
  }
  return null
}

// TODA ação que qualquer função do repositório escreve na trilha.
function acoesEscritas() {
  const achadas = new Map()
  for (const { nome, sql } of TEXTOS) {
    const re = /insert\s+into\s+(?:public\.)?vessel_edicoes[\s\S]{0,400}?values\s*\(\s*[^,]+,\s*'([a-z_]+)'/gi
    let m
    while ((m = re.exec(sql)) !== null) {
      if (!achadas.has(m[1])) achadas.set(m[1], nome)
    }
  }
  return achadas
}

test('a lista de acoes permitidas da trilha e encontravel no repositorio', () => {
  const lista = listaPermitida()
  assert.ok(lista && lista.length > 0,
    'nao achei o CHECK de vessel_edicoes_acao_check nas migrations')
})

test('⚠️ TODA acao escrita na trilha esta na lista de acoes permitidas', () => {
  const permitidas = new Set(listaPermitida())
  const escritas = acoesEscritas()
  assert.ok(escritas.size > 0, 'nao achei nenhuma escrita na trilha — regex quebrada?')

  const forasDaLei = [...escritas].filter(([acao]) => !permitidas.has(acao))
  assert.deepEqual(forasDaLei, [],
    'estas acoes sao escritas na trilha mas o banco vai RECUSAR (some com a '
    + 'transacao inteira): ' + forasDaLei.map(([a, f]) => `${a} (em ${f})`).join(', '))
})

test('a acao que causou o defeito real esta coberta', () => {
  // Prova de que o teste acima ve o caso concreto, e nao passa por vacuidade.
  assert.ok(acoesEscritas().has('baixar_garantia'),
    'baixar_garantia deveria ser vista como escrita na trilha')
  assert.ok(new Set(listaPermitida()).has('baixar_garantia'),
    'baixar_garantia deveria estar na lista de permitidas')
})
