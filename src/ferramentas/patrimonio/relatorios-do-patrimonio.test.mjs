import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RELATORIOS_DO_PATRIMONIO, acharRelatorio } from './relatorios-do-patrimonio.js'
import { COLUNAS_PLANILHA } from './planilha-e-resumo.js'

test('todo relatório declara o que a casca precisa, sem faltar campo', () => {
  for (const r of RELATORIOS_DO_PATRIMONIO) {
    assert.ok(r.chave, 'relatório sem chave')
    assert.ok(r.titulo, `${r.chave} sem título`)
    assert.ok(r.explicacao, `${r.chave} sem explicação`)
    assert.equal(typeof r.periodo, 'boolean', `${r.chave} não diz se pede período`)
    assert.ok(Array.isArray(r.colunas) && r.colunas.length, `${r.chave} sem colunas`)
    assert.equal(typeof r.pegarIds, 'function', `${r.chave} não sabe achar marca/local`)
    assert.equal(typeof r.montar, 'function', `${r.chave} não sabe buscar linhas`)
  }
})

test('as chaves não se repetem — chave repetida some com um relatório da tela', () => {
  const chaves = RELATORIOS_DO_PATRIMONIO.map((r) => r.chave)
  assert.equal(new Set(chaves).size, chaves.length)
})

test('"Bens" usa as MESMAS colunas da Planilha, sem uma segunda lista', () => {
  const bens = acharRelatorio('bens')
  assert.equal(bens.colunas, COLUNAS_PLANILHA)
})

test('"Bens" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorio('bens').periodo, false)
})

test('"Bens" monta a partir do que a tela já carregou, sem ir ao banco de novo', async () => {
  const linhasAchatadas = [{ id: 'a', nome: 'Mesa', _bem: { empresa_id: 'e1', local_id: 'l1' } }]
  const linhas = await acharRelatorio('bens').montar({ linhasAchatadas })
  assert.deepEqual(linhas, linhasAchatadas)
})

test('"Bens" acha marca e local no bem cru, e não na linha achatada', () => {
  // A linha achatada guarda o NOME ("Vessel"), não o id. Recortar por nome
  // quebraria justamente nas duas "Fábrica Conchal".
  const linha = { empresa: 'Vessel', local: 'Fábrica Conchal', _bem: { empresa_id: 'e1', local_id: 'l1' } }
  assert.deepEqual(acharRelatorio('bens').pegarIds(linha), { empresaId: 'e1', localId: 'l1' })
})

test('acharRelatorio devolve null para chave que não existe', () => {
  assert.equal(acharRelatorio('nao-existe'), null)
})
