import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ultimaRevisao, estadoDaRevisao, revisoesDoVeiculo, resumoDeRevisoes,
  problemasDoItem, avisoAoDesativar, FATIA_DE_AVISO,
} from './revisoes.js'

const PLANO = [
  { id: 'a', item: 'Troca de óleo', a_cada_km: 7000, ativo: true },
  { id: 'b', item: 'Correia dentada', a_cada_km: 60000, ativo: true },
  { id: 'c', item: 'Item desligado', a_cada_km: 1000, ativo: false },
]
const CARRO = { id: 'v1', nome: 'Fiat Doblo' }

test('a última troca é a de MAIOR quilometragem, não a de data mais nova', () => {
  // Data digitada errada acontece o tempo todo; o odômetro só anda pra frente.
  const revs = [
    { veiculo_id: 'v1', item: 'Troca de óleo', km: 130000, feita_em: '2026-07-01' },
    { veiculo_id: 'v1', item: 'Troca de óleo', km: 120000, feita_em: '2026-12-01' },
  ]
  assert.equal(ultimaRevisao(revs, 'v1', 'Troca de óleo').km, 130000)
})

test('revisão de outro carro ou de outro item não conta', () => {
  const revs = [
    { veiculo_id: 'v2', item: 'Troca de óleo', km: 999999 },
    { veiculo_id: 'v1', item: 'Velas', km: 999999 },
  ]
  assert.equal(ultimaRevisao(revs, 'v1', 'Troca de óleo'), null)
  assert.equal(ultimaRevisao([], 'v1', 'Troca de óleo'), null)
  assert.equal(ultimaRevisao(null, 'v1', 'x'), null)
})

test('revisão sem KM registrado é ignorada — não vira zero', () => {
  // Tratar como zero diria "trocou com 0 km" e deixaria tudo vencido pra sempre.
  const revs = [{ veiculo_id: 'v1', item: 'Troca de óleo', km: null, feita_em: '2026-07-01' }]
  assert.equal(ultimaRevisao(revs, 'v1', 'Troca de óleo'), null)
})

/* ── A conta ─────────────────────────────────────────────────────────────── */

test('em dia: falta bastante', () => {
  const e = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: 100000, kmAtual: 102000 })
  assert.equal(e.situacao, 'em-dia')
  assert.equal(e.alvo, 107000)
  assert.equal(e.faltam, 5000)
  assert.match(e.texto, /Faltam 5\.000 km/)
})

test('o aviso é PROPORCIONAL ao intervalo, não um número fixo', () => {
  // 500 km antes seria tarde pra uma correia e cedo demais pro óleo.
  const oleo = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: 100000, kmAtual: 106400 })
  assert.equal(oleo.situacao, 'perto', 'faltando 600 de 7.000 já avisa')

  const correia = estadoDaRevisao({ item: 'Correia dentada', aCadaKm: 60000, ultimaKm: 100000, kmAtual: 154000 })
  assert.equal(correia.situacao, 'perto', 'faltando 6.000 de 60.000 avisa')

  const correiaLonge = estadoDaRevisao({ item: 'Correia dentada', aCadaKm: 60000, ultimaKm: 100000, kmAtual: 150000 })
  assert.equal(correiaLonge.situacao, 'em-dia', 'faltando 10.000 de 60.000 ainda não')
  assert.equal(FATIA_DE_AVISO, 0.10)
})

test('vencida diz QUANTO passou, não só que passou', () => {
  const e = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: 100000, kmAtual: 108500 })
  assert.equal(e.situacao, 'vencida')
  assert.match(e.texto, /Passou 1\.500 km/)
})

test('bater exatamente no alvo já é vencida', () => {
  const e = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: 100000, kmAtual: 107000 })
  assert.equal(e.situacao, 'vencida')
})

test('sem quilometragem do carro, NÃO inventa alerta', () => {
  // O Fiesta Sedan e o Honda Fit estão assim na planilha. Chutar "vencida"
  // faria a pessoa levar o carro à oficina à toa.
  const e = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: 100000, kmAtual: null })
  assert.equal(e.situacao, 'sem-km')
  assert.equal(e.alvo, null)
  assert.match(e.texto, /primeira devolução/)
})

test('sem histórico da troca, diz isso em vez de fingir que está em dia', () => {
  const e = estadoDaRevisao({ item: 'Troca de óleo', aCadaKm: 7000, ultimaKm: null, kmAtual: 100000 })
  assert.equal(e.situacao, 'sem-registro')
  assert.match(e.texto, /Nunca foi registrada/)
})

/* ── A lista de um carro ─────────────────────────────────────────────────── */

test('item desativado sai da conta', () => {
  const itens = revisoesDoVeiculo({ veiculo: CARRO, kmAtual: 100000, plano: PLANO, revisoes: [] })
  assert.ok(!itens.some((i) => i.item === 'Item desligado'))
  assert.equal(itens.length, 2)
})

test('o que dói primeiro aparece primeiro', () => {
  const revisoes = [
    { veiculo_id: 'v1', item: 'Troca de óleo', km: 90000 },      // vencida
    { veiculo_id: 'v1', item: 'Correia dentada', km: 99000 },     // em dia
  ]
  const itens = revisoesDoVeiculo({ veiculo: CARRO, kmAtual: 100000, plano: PLANO, revisoes })
  assert.deepEqual(itens.map((i) => i.situacao), ['vencida', 'em-dia'])
})

test('duas vencidas: a mais atrasada primeiro', () => {
  const plano = [
    { item: 'A', a_cada_km: 7000, ativo: true },
    { item: 'B', a_cada_km: 7000, ativo: true },
  ]
  const revisoes = [
    { veiculo_id: 'v1', item: 'A', km: 90000 },   // passou 3.000
    { veiculo_id: 'v1', item: 'B', km: 85000 },   // passou 8.000
  ]
  const itens = revisoesDoVeiculo({ veiculo: CARRO, kmAtual: 100000, plano, revisoes })
  assert.deepEqual(itens.map((i) => i.item), ['B', 'A'])
})

test('o resumo do cartão: vencida ganha de "chegando"', () => {
  assert.equal(resumoDeRevisoes([{ situacao: 'vencida' }, { situacao: 'perto' }]).nivel, 'vencida')
  assert.equal(resumoDeRevisoes([{ situacao: 'vencida' }, { situacao: 'vencida' }]).texto, '2 revisões vencidas')
  assert.equal(resumoDeRevisoes([{ situacao: 'perto' }, { situacao: 'em-dia' }]).texto, '1 revisão chegando')
  assert.equal(resumoDeRevisoes([{ situacao: 'em-dia' }]).nivel, 'em-dia')
  assert.equal(resumoDeRevisoes([]).nivel, 'em-dia')
})

test('carro sem histórico nenhum não diz "em dia" — seria mentira', () => {
  const r = resumoDeRevisoes([{ situacao: 'sem-registro' }, { situacao: 'sem-registro' }])
  assert.equal(r.nivel, 'sem-registro')
  assert.match(r.texto, /Sem histórico/)
})

/* ── O editor de limiares ─────────────────────────────────────────────────── */

const EXISTENTES = [{ id: 'a', item: 'Troca de óleo' }, { id: 'b', item: 'Correia dentada' }]

test('item novo válido passa limpo', () => {
  assert.deepEqual(problemasDoItem({ item: 'Filtro de ar', aCadaKm: 20000, existentes: EXISTENTES }), [])
})

test('nome repetido é barrado, mesmo com outra caixa', () => {
  // Dois itens com o mesmo nome dariam dois alertas pra mesma troca.
  const p = problemasDoItem({ item: '  troca de ÓLEO ', aCadaKm: 7000, existentes: EXISTENTES })
  assert.equal(p.length, 1)
  assert.match(p[0], /Já existe/)
})

test('editar o próprio item não acusa nome repetido consigo mesmo', () => {
  assert.deepEqual(
    problemasDoItem({ item: 'Troca de óleo', aCadaKm: 7000, existentes: EXISTENTES, idAtual: 'a' }),
    [])
})

test('sem nome e sem intervalo não grava', () => {
  const p = problemasDoItem({ item: '', aCadaKm: null, existentes: [] })
  assert.equal(p.length, 2)
  assert.match(p.join(' '), /nome/i)
  assert.match(p.join(' '), /quilômetros/i)
})

test('intervalo absurdo é dedo errado, e o texto diz isso', () => {
  assert.match(problemasDoItem({ item: 'X', aCadaKm: 70, existentes: [] }).join(' '), /dedo errado/i)
  assert.match(problemasDoItem({ item: 'X', aCadaKm: 9000000, existentes: [] }).join(' '), /nunca/i)
  assert.match(problemasDoItem({ item: 'X', aCadaKm: 0, existentes: [] }).join(' '), /quilômetros/i)
  assert.match(problemasDoItem({ item: 'X', aCadaKm: 7000.5, existentes: [] }).join(' '), /quilômetros/i)
})

test('desativar avisa que o histórico NÃO some', () => {
  const a = avisoAoDesativar('Troca de óleo')
  assert.match(a, /continuam no histórico/)
  assert.match(a, /reativar/)
})
