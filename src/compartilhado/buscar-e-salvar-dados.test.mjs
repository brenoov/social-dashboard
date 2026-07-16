import { test } from 'node:test'
import assert from 'node:assert/strict'

// Este módulo puxa, na cadeia de imports, o conectar-no-banco-de-dados.js, que
// chama window.supabase.createClient() assim que carrega. No navegador o window
// existe; aqui no node, não. Então fingimos um window mínimo ANTES de importar —
// por isso o import é dinâmico e não estático, senão ele rodaria primeiro.
globalThis.window = { supabase: { createClient: () => ({}) } }
const { comErro } = await import('./buscar-e-salvar-dados.js')

// O sb() em si depende de fetch + estado global do app; o contrato testável e
// importante é o do comErro(): o array tem que continuar sendo um array normal
// para os 53 sitios que nao sabem do .erro.

test('array com erro continua sendo um array de verdade', () => {
  const a = comErro([], { tipo: 'sessao', mensagem: 'x', acao: 'entrar' })
  assert.ok(Array.isArray(a))
  assert.equal(a.length, 0)
  assert.deepEqual(a.map(x => x), [])
  assert.deepEqual([...a], [])
})

test('o .erro fica acessivel para quem quer tratar', () => {
  const a = comErro([], { tipo: 'permissao', mensagem: 'sem permissao', acao: null })
  assert.equal(a.erro.tipo, 'permissao')
  assert.equal(a.erro.mensagem, 'sem permissao')
})

test('o .erro e nao-enumeravel: nao aparece em JSON nem em for-in', () => {
  const a = comErro([], { tipo: 'rede', mensagem: 'x', acao: 'tentar' })
  assert.equal(JSON.stringify(a), '[]')
  assert.deepEqual(Object.keys(a), [])
})

test('array sem erro tem .erro undefined (o caso "vazio de verdade")', () => {
  const vazio = []
  assert.equal(vazio.erro, undefined)
})
