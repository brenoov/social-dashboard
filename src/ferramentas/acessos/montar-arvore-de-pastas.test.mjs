// Testes da montagem da árvore de pastas a partir do campo `caminho`.
//
// Os caminhos usados aqui seguem o formato REAL do banco, importado do Zoho
// WorkDrive (ex.: "01. RBV and Company/01. Gestão de Serviços").
import test from 'node:test'
import assert from 'node:assert/strict'
import { montarArvoreDePastas, achatarArvoreDePastas } from './montar-arvore-de-pastas.js'

// Atalho pra escrever caso de teste sem repetir campo.
const pasta = (id, nome, caminho) => ({ id, nome, caminho, tipo: 'workdrive', provedor: 'zoho' })

test('lista vazia devolve árvore vazia (e não explode)', () => {
  assert.deepEqual(montarArvoreDePastas([]), [])
  assert.deepEqual(montarArvoreDePastas(null), [])
  assert.deepEqual(montarArvoreDePastas(undefined), [])
})

test('pasta de 1 nível (caminho = nome) é raiz', () => {
  const raizes = montarArvoreDePastas([pasta('a', '01. RBV and Company', '01. RBV and Company')])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].nome, '01. RBV and Company')
  assert.equal(raizes[0].nivel, 0)
  assert.deepEqual(raizes[0].filhas, [])
})

test('2 níveis: a filha pendura na mãe e não aparece no topo', () => {
  const raizes = montarArvoreDePastas([
    pasta('mae', '01. RBV and Company', '01. RBV and Company'),
    pasta('filha', '01. Gestão de Serviços', '01. RBV and Company/01. Gestão de Serviços'),
  ])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].id, 'mae')
  assert.equal(raizes[0].filhas.length, 1)
  assert.equal(raizes[0].filhas[0].id, 'filha')
  assert.equal(raizes[0].filhas[0].nivel, 1)
})

test('3 níveis: a neta fica embaixo da filha, não da avó', () => {
  const raizes = montarArvoreDePastas([
    pasta('neta', 'Contratos', '01. RBV and Company/02. Jurídico/Contratos'),
    pasta('avo', '01. RBV and Company', '01. RBV and Company'),
    pasta('filha', '02. Jurídico', '01. RBV and Company/02. Jurídico'),
  ])
  assert.equal(raizes.length, 1)
  const avo = raizes[0]
  assert.equal(avo.id, 'avo')
  assert.equal(avo.nivel, 0)
  assert.equal(avo.filhas.length, 1)
  const filha = avo.filhas[0]
  assert.equal(filha.id, 'filha')
  assert.equal(filha.nivel, 1)
  assert.equal(filha.filhas.length, 1)
  assert.equal(filha.filhas[0].id, 'neta')
  assert.equal(filha.filhas[0].nivel, 2)
})

test('nome COM barra não é partido no meio: a pasta continua sendo filha da mãe certa', () => {
  // "Contratos 2025/2026" é UM nome só. Cortar no último "/" inventaria uma
  // mãe "01. RBV and Company/Contratos 2025" que não existe.
  const raizes = montarArvoreDePastas([
    pasta('mae', '01. RBV and Company', '01. RBV and Company'),
    pasta('filha', 'Contratos 2025/2026', '01. RBV and Company/Contratos 2025/2026'),
  ])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].id, 'mae')
  assert.equal(raizes[0].filhas.length, 1)
  assert.equal(raizes[0].filhas[0].id, 'filha')
  assert.equal(raizes[0].filhas[0].nome, 'Contratos 2025/2026')
})

test('nome com barra na RAIZ (caminho = nome) continua raiz', () => {
  const raizes = montarArvoreDePastas([pasta('r', 'Fiscal 2025/2026', 'Fiscal 2025/2026')])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].id, 'r')
  assert.equal(raizes[0].nivel, 0)
})

test('pasta órfã (mãe não importada) aparece como raiz em vez de sumir', () => {
  // Regra: pasta que existe no banco NUNCA some da tela — some pasta, some controle.
  const raizes = montarArvoreDePastas([
    pasta('orfa', 'Notas', '99. Marca Que Nao Foi Importada/Notas'),
  ])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].id, 'orfa')
  assert.equal(raizes[0].nivel, 0)
})

test('várias raízes saem ordenadas por número, não por texto ("2." antes de "10.")', () => {
  const raizes = montarArvoreDePastas([
    pasta('c', '10. Dez', '10. Dez'),
    pasta('a', '2. Dois', '2. Dois'),
    pasta('b', '1. Um', '1. Um'),
  ])
  assert.deepEqual(raizes.map((r) => r.id), ['b', 'a', 'c'])
})

test('filhas da mesma mãe também saem ordenadas', () => {
  const raizes = montarArvoreDePastas([
    pasta('mae', 'RBV', 'RBV'),
    pasta('f2', '02. Beta', 'RBV/02. Beta'),
    pasta('f1', '01. Alfa', 'RBV/01. Alfa'),
  ])
  assert.deepEqual(raizes[0].filhas.map((f) => f.id), ['f1', 'f2'])
})

test('linha sem id é ignorada (não vira pasta fantasma)', () => {
  const raizes = montarArvoreDePastas([
    pasta('ok', 'Boa', 'Boa'),
    { nome: 'Sem id', caminho: 'Sem id' },
    null,
  ])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].id, 'ok')
})

test('linha sem caminho cai de volta no nome e continua visível', () => {
  const raizes = montarArvoreDePastas([{ id: 'x', nome: 'Solta', caminho: null }])
  assert.equal(raizes.length, 1)
  assert.equal(raizes[0].caminho, 'Solta')
})

test('achatar devolve a ordem de desenho: mãe, filhas dela, próxima mãe', () => {
  const raizes = montarArvoreDePastas([
    pasta('m1', '01. Um', '01. Um'),
    pasta('m2', '02. Dois', '02. Dois'),
    pasta('f1', 'Alfa', '01. Um/Alfa'),
    pasta('n1', 'Fundo', '01. Um/Alfa/Fundo'),
  ])
  assert.deepEqual(achatarArvoreDePastas(raizes).map((n) => n.id), ['m1', 'f1', 'n1', 'm2'])
})

test('achatar de árvore vazia devolve lista vazia', () => {
  assert.deepEqual(achatarArvoreDePastas([]), [])
  assert.deepEqual(achatarArvoreDePastas(null), [])
})

test('as 16 pastas reais do WorkDrive viram 1 raiz com 15 filhas, sem perder nenhuma', () => {
  // Nomes/caminhos REAIS, lidos do banco em 2026-07-17 com
  //   select nome, caminho from acessos_recursos where tipo='workdrive'
  // Só os ids foram trocados por n1..n16 (o uuid não muda o resultado).
  const reais = [
    ['n1', '01. RBV and Company', '01. RBV and Company'],
    ['n2', '01. Gestão de Serviços', '01. RBV and Company/01. Gestão de Serviços'],
    ['n3', '02. Herculano', '01. RBV and Company/02. Herculano'],
    ['n4', '03. Moto Easy', '01. RBV and Company/03. Moto Easy'],
    ['n5', '04. Vessel Brasil', '01. RBV and Company/04. Vessel Brasil'],
    ['n6', '05. Mantova', '01. RBV and Company/05. Mantova'],
    ['n7', '06. Breno Vale @obrenovale', '01. RBV and Company/06. Breno Vale @obrenovale'],
    ['n8', '07. Raissa Herculano @raissaherculano', '01. RBV and Company/07. Raissa Herculano @raissaherculano'],
    ['n9', '08. RB Builders', '01. RBV and Company/08. RB Builders'],
    ['n10', '09. RAH', '01. RBV and Company/09. RAH'],
    ['n11', '10. RBV & Co', '01. RBV and Company/10. RBV & Co'],
    ['n12', '11. HLM Assessoria', '01. RBV and Company/11. HLM Assessoria'],
    ['n13', 'Apresentacoes Palestras', '01. RBV and Company/Apresentacoes Palestras'],
    ['n14', 'Crachas', '01. RBV and Company/Crachas'],
    ['n15', 'Diagnósticos', '01. RBV and Company/Diagnósticos'],
    ['n16', 'MySQL', '01. RBV and Company/MySQL'],
  ].map(([id, nome, caminho]) => pasta(id, nome, caminho))

  const raizes = montarArvoreDePastas(reais)
  assert.equal(raizes.length, 1, 'só a pasta de equipe fica no topo')
  assert.equal(raizes[0].id, 'n1')
  assert.equal(raizes[0].nome, '01. RBV and Company')
  assert.equal(raizes[0].filhas.length, 15)
  // Toda filha está no nível 1 (a estrutura real de hoje tem 2 níveis).
  assert.ok(raizes[0].filhas.every((f) => f.nivel === 1))
  // Nenhuma pasta pode sumir no caminho.
  assert.equal(achatarArvoreDePastas(raizes).length, 16)
  // As numeradas vêm antes das sem número, na ordem do Zoho.
  assert.deepEqual(raizes[0].filhas.slice(0, 3).map((f) => f.nome), [
    '01. Gestão de Serviços',
    '02. Herculano',
    '03. Moto Easy',
  ])
})
