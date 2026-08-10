import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matrizParaExcel, nomeDeAbaValido, baixarExcel } from './exportar.js'

const COLUNAS = [
  { chave: 'nome', titulo: 'Item', tipo: 'texto' },
  { chave: 'valor_centavos', titulo: 'Valor', tipo: 'dinheiro' },
]

test('a primeira linha é o cabeçalho, na ordem das colunas', () => {
  assert.deepEqual(matrizParaExcel(COLUNAS, []), [['Item', 'Valor']])
})

test('dinheiro sai NÚMERO em reais, para o Excel somar', () => {
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: 800000 }])
  assert.deepEqual(m[1], ['Mesa', 8000])
})

test('dinheiro sem valor vira null, e não zero', () => {
  // Zero mentiria: "não informado" não é "custou nada", e zero entra na soma.
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: null }])
  assert.deepEqual(m[1], ['Mesa', null])
})

test('texto vazio ou ausente vira string vazia, nunca "undefined"', () => {
  const m = matrizParaExcel(COLUNAS, [{ valor_centavos: 100 }])
  assert.equal(m[1][0], '')
})

test('sem linhas, devolve só o cabeçalho — não estoura', () => {
  assert.equal(matrizParaExcel(COLUNAS, null).length, 1)
})

// ─── nome da aba ─────────────────────────────────────────────────────────────
//
// DEFEITO REAL (10/08/2026): o botão Excel do "Resumo por marca/local" não
// baixava nada. O Excel recusa `: \ / ? * [ ]` em nome de aba, e a BARRA do
// título derrubava a exportação inteira com "Sheet name cannot contain".
// Pior: a exceção subia sem ninguém pegar, então a tela não dizia nada — a
// pessoa clicava e simplesmente não acontecia.

test('barra no título não derruba a exportação — o Excel não aceita', () => {
  assert.equal(nomeDeAbaValido('Resumo por marca/local'), 'Resumo por marca-local')
})

test('todos os caracteres que o Excel recusa saem', () => {
  assert.equal(nomeDeAbaValido('a:b\\c/d?e*f[g]h'), 'a-b-c-d-e-f-g-h')
})

test('nome de aba não passa de 31 caracteres — o Excel recusa o arquivo INTEIRO', () => {
  assert.equal(nomeDeAbaValido('a'.repeat(60)).length, 31)
})

test('título vazio vira um nome válido, e não aba sem nome', () => {
  assert.equal(nomeDeAbaValido(''), 'Relatório')
  assert.equal(nomeDeAbaValido(null), 'Relatório')
})

test('baixarExcel avisa em vez de estourar quando não há exportador', () => {
  const res = baixarExcel({ colunas: COLUNAS, linhas: [], nomeArquivo: 'x.xlsx' })
  assert.equal(res.ok, false)
  assert.match(res.motivo, /Recarregue a página/)
})

test('baixarExcel devolve o erro do XLSX em vez de deixar estourar', () => {
  // Sem isto, qualquer recusa do exportador vira clique que não faz nada.
  const original = globalThis.XLSX
  globalThis.XLSX = {
    utils: {
      aoa_to_sheet: () => ({}),
      book_new: () => ({}),
      book_append_sheet: () => { throw new Error('Sheet name cannot contain : \\ / ? * [ ]') },
    },
    writeFile: () => {},
  }
  try {
    const res = baixarExcel({ colunas: COLUNAS, linhas: [], nomeAba: 'x', nomeArquivo: 'x.xlsx' })
    assert.equal(res.ok, false)
    assert.match(res.motivo, /Sheet name/)
  } finally {
    if (original === undefined) delete globalThis.XLSX
    else globalThis.XLSX = original
  }
})
