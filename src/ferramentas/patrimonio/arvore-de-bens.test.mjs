import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEM_VALOR, agruparBens, bensDoCaminho, rotuloDoCaminho } from './arvore-de-bens.js'

const BENS = [
  { id: 'a', nome: 'Macbook', valor_centavos: 800000, empresa_id: 'e1', local_id: 'l1', comodo_id: 'c1' },
  { id: 'b', nome: 'Xiaomi', valor_centavos: 120000, empresa_id: 'e1', local_id: 'l1', comodo_id: 'c2' },
  { id: 'c', nome: 'Mesa', valor_centavos: 50000, empresa_id: 'e1', local_id: 'l2', comodo_id: 'c1' },
  { id: 'd', nome: 'Furadeira', valor_centavos: 30000, empresa_id: 'e2', local_id: 'l1', comodo_id: null },
  // O caso que a planilha real tem e que não pode sumir: bem sem empresa.
  { id: 'e', nome: 'Órfão', valor_centavos: null, empresa_id: null, local_id: null, comodo_id: null },
]
const LISTAS = {
  empresas: [{ id: 'e1', nome: 'Vessel' }, { id: 'e2', nome: 'Moto Easy' }],
  locais: [{ id: 'l1', nome: 'Fábrica Conchal' }, { id: 'l2', nome: 'Sede Limeira' }],
  comodos: [{ id: 'c1', nome: 'Estoque' }, { id: 'c2', nome: 'Produção' }],
}

test('agrupa por empresa com contagem e total', () => {
  const g = agruparBens(BENS, 'empresa_id', LISTAS.empresas)
  assert.deepEqual(g.map((x) => [x.nome, x.quantidade, x.totalCentavos]), [
    ['Vessel', 3, 970000],
    ['Moto Easy', 1, 30000],
    ['Sem empresa', 1, 0],
  ])
})

test('o grupo "sem" vem SEMPRE por último e usa a sentinela', () => {
  const g = agruparBens(BENS, 'empresa_id', LISTAS.empresas)
  const ultimo = g[g.length - 1]
  assert.equal(ultimo.id, SEM_VALOR)
  assert.equal(ultimo.nome, 'Sem empresa')
})

test('bem sem valor conta na quantidade mas não infla o total', () => {
  const g = agruparBens(BENS, 'empresa_id', LISTAS.empresas)
  const orfaos = g.find((x) => x.id === SEM_VALOR)
  assert.equal(orfaos.quantidade, 1)
  assert.equal(orfaos.totalCentavos, 0)
})

test('grupo vazio não aparece — só entra quem tem bem', () => {
  const so = [{ id: 'a', empresa_id: 'e1', valor_centavos: 100 }]
  const g = agruparBens(so, 'empresa_id', LISTAS.empresas)
  assert.deepEqual(g.map((x) => x.nome), ['Vessel'])
})

test('sem nenhum bem, nenhum grupo (nem o "sem")', () => {
  assert.deepEqual(agruparBens([], 'empresa_id', LISTAS.empresas), [])
  assert.deepEqual(agruparBens(null, 'empresa_id', LISTAS.empresas), [])
})

test('rótulo "sem" muda conforme o campo', () => {
  assert.equal(agruparBens(BENS, 'local_id', LISTAS.locais).find((x) => x.id === SEM_VALOR).nome, 'Sem local')
  assert.equal(agruparBens(BENS, 'comodo_id', LISTAS.comodos).find((x) => x.id === SEM_VALOR).nome, 'Sem cômodo')
})

test('caminho vazio devolve todos os bens', () => {
  assert.equal(bensDoCaminho(BENS, {}).length, 5)
  assert.equal(bensDoCaminho(BENS, null).length, 5)
})

test('caminho filtra por empresa, depois local, depois cômodo', () => {
  assert.deepEqual(bensDoCaminho(BENS, { empresaId: 'e1' }).map((b) => b.id), ['a', 'b', 'c'])
  assert.deepEqual(bensDoCaminho(BENS, { empresaId: 'e1', localId: 'l1' }).map((b) => b.id), ['a', 'b'])
  assert.deepEqual(bensDoCaminho(BENS, { empresaId: 'e1', localId: 'l1', comodoId: 'c2' }).map((b) => b.id), ['b'])
})

test('entrar no grupo "sem empresa" acha o órfão — ele não fica inalcançável', () => {
  assert.deepEqual(bensDoCaminho(BENS, { empresaId: SEM_VALOR }).map((b) => b.id), ['e'])
})

test('entrar em "sem cômodo" dentro de uma empresa também funciona', () => {
  assert.deepEqual(
    bensDoCaminho(BENS, { empresaId: 'e2', comodoId: SEM_VALOR }).map((b) => b.id),
    ['d'],
  )
})

test('rótulo do caminho mostra onde a pessoa está', () => {
  assert.equal(rotuloDoCaminho({}, LISTAS), 'Patrimônio')
  assert.equal(rotuloDoCaminho({ empresaId: 'e1' }, LISTAS), 'Vessel')
  assert.equal(rotuloDoCaminho({ empresaId: 'e1', localId: 'l1' }, LISTAS), 'Fábrica Conchal')
  assert.equal(rotuloDoCaminho({ empresaId: 'e1', localId: 'l1', comodoId: 'c2' }, LISTAS), 'Produção')
  assert.equal(rotuloDoCaminho({ empresaId: SEM_VALOR }, LISTAS), 'Sem empresa')
})

/* ── Um caminho só por item ──────────────────────────────────────────────────
   A tela chegou a mostrar, no mesmo nível, a pasta "Sem local" E uma segunda
   lista com "N itens sem local" — os mesmos itens, duas vezes. O dono viu e
   apontou. O invariante que impede isso de voltar: todo bem de um nível cai em
   EXATAMENTE UM grupo, contando o grupo dos órfãos. Se isso vale, não existe
   item "de fora" que justifique uma lista extra. */

test('todo bem cai em exatamente um grupo — nada sobra pra uma segunda lista', () => {
  const g = agruparBens(BENS, 'local_id', LISTAS.locais)
  const somaDosGrupos = g.reduce((a, x) => a + x.quantidade, 0)
  assert.equal(somaDosGrupos, BENS.length, 'a soma dos grupos tem que dar o total')

  // E cada item é alcançável entrando em um (e só um) desses grupos.
  const vistos = new Set()
  for (const grupo of g) {
    for (const bem of bensDoCaminho(BENS, { localId: grupo.id })) {
      assert.ok(!vistos.has(bem.id), `bem ${bem.id} aparece em mais de um grupo`)
      vistos.add(bem.id)
    }
  }
  assert.equal(vistos.size, BENS.length, 'algum bem ficou inalcançável')
})

test('o mesmo vale no nível de marca, onde há órfão de verdade', () => {
  const g = agruparBens(BENS, 'empresa_id', LISTAS.empresas)
  assert.equal(g.reduce((a, x) => a + x.quantidade, 0), BENS.length)
  const orfaos = g.find((x) => x.id === SEM_VALOR)
  assert.equal(orfaos.quantidade, bensDoCaminho(BENS, { empresaId: SEM_VALOR }).length,
    'a contagem da pasta tem que bater com o que se vê ao entrar nela')
})
