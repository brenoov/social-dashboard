import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RELATORIOS_DA_FROTA, acharRelatorioDaFrota } from './relatorios-da-frota.js'

// Dublê do supabase-js: só o encadeamento que este catálogo usa. E ele ANOTA os
// filtros pedidos — sem isso, um relatório que ignora o período passaria no
// teste trazendo linhas, e ninguém veria que trouxe a base inteira.
function banco(linhas, { erro = null, pedidos = null } = {}) {
  const resposta = Promise.resolve({ data: linhas, error: erro })
  const enc = {
    select: () => enc,
    is: () => enc,
    gte: (c, v) => { if (pedidos) pedidos.push(['gte', c, v]); return enc },
    lte: (c, v) => { if (pedidos) pedidos.push(['lte', c, v]); return enc },
    order: () => resposta,
    then: (...a) => resposta.then(...a),
  }
  return { from: () => enc }
}

const VEICULOS = [
  { id: 'v1', placa: 'DCH1J89', nome: 'BMW X1', marca: 'BMW', ano: 2022, cor: 'Preto',
    situacao: 'ativo', contrato: 'CTR-007', codigo_patrimonial: 'RBB-007',
    aluguel_centavos: 350000, fipe_centavos: 18000000, observacao: '',
    pessoa_id: 'p1', empresa_id: 'e1', local_id: 'l1', comodo_id: null },
  { id: 'v2', placa: 'QQT9B68', nome: 'FIAT DOBLO', marca: 'FIAT', ano: 2018, cor: 'Branco',
    situacao: 'em_manutencao', contrato: null, codigo_patrimonial: null,
    aluguel_centavos: null, fipe_centavos: null, observacao: 'porta amassada',
    pessoa_id: null, empresa_id: null, local_id: null, comodo_id: null },
]
const EMPRESAS = [{ id: 'e1', nome: 'Vessel' }]
const LOCAIS = [{ id: 'l1', nome: 'Fábrica Conchal', empresa_id: 'e1' }]
const COMODOS = []
const PESSOAS = [{ id: 'p1', nome: 'Marcus Vinícius' }]
const CTX = { veiculos: VEICULOS, empresas: EMPRESAS, locais: LOCAIS, comodos: COMODOS, pessoas: PESSOAS }

test('todo relatório declara o que a casca precisa, sem faltar campo', () => {
  for (const r of RELATORIOS_DA_FROTA) {
    assert.ok(r.chave, 'relatório sem chave')
    assert.ok(r.titulo, `${r.chave} sem título`)
    assert.ok(r.explicacao, `${r.chave} sem explicação`)
    assert.equal(typeof r.periodo, 'boolean', `${r.chave} não diz se pede período`)
    assert.ok(Array.isArray(r.colunas) && r.colunas.length, `${r.chave} sem colunas`)
    assert.equal(typeof r.pegarIds, 'function', `${r.chave} não sabe achar empresa/local`)
    assert.equal(typeof r.montar, 'function', `${r.chave} não sabe buscar linhas`)
  }
})

test('são os quatro relatórios combinados, com chave única', () => {
  const chaves = RELATORIOS_DA_FROTA.map((r) => r.chave)
  assert.deepEqual(chaves, ['veiculos', 'checklists', 'revisoes', 'quem-dirigiu'])
  assert.equal(new Set(chaves).size, chaves.length)
})

// ───────────────────────────────── Ficha dos veículos ───────────────────────

test('"Ficha dos veículos" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorioDaFrota('veiculos').periodo, false)
})

test('"Ficha" resolve empresa, local e dono para NOME, e não deixa id na tela', async () => {
  const [bmw] = await acharRelatorioDaFrota('veiculos').montar(CTX)
  assert.equal(bmw.empresa, 'Vessel')
  assert.equal(bmw.local, 'Fábrica Conchal')
  assert.equal(bmw.dono, 'Marcus Vinícius')
})

test('"Ficha" traduz a situação para a MESMA palavra do formulário', async () => {
  // O formulário escreve "Em manutenção". Um relatório dizendo "em_manutencao"
  // obrigaria a pessoa a traduzir de cabeça.
  const linhas = await acharRelatorioDaFrota('veiculos').montar(CTX)
  assert.equal(linhas[0].situacao, 'Ativo')
  assert.equal(linhas[1].situacao, 'Em manutenção')
})

test('"Ficha" não inventa nome para carro sem empresa, local ou dono', async () => {
  const linhas = await acharRelatorioDaFrota('veiculos').montar(CTX)
  assert.equal(linhas[1].empresa, '')
  assert.equal(linhas[1].local, '')
  assert.equal(linhas[1].dono, '')
})

test('"Ficha" recorta pelo empresa_id e local_id do próprio veículo', () => {
  const ids = acharRelatorioDaFrota('veiculos').pegarIds({ _veiculo: VEICULOS[0] })
  assert.deepEqual(ids, { empresaId: 'e1', localId: 'l1' })
})

// ───────────────────────────────── Checklists ────────────────────────────────

test('"Checklists" pede período e pergunta ao banco por ele', async () => {
  const pedidos = []
  const sbClient = banco([], { pedidos })
  assert.equal(acharRelatorioDaFrota('checklists').periodo, true)
  await acharRelatorioDaFrota('checklists').montar({ ...CTX, sbClient, de: '2026-07-01', ate: '2026-07-31' })
  assert.deepEqual(pedidos, [['gte', 'feita_em', '2026-07-01'], ['lte', 'feita_em', '2026-07-31']])
})

test('"Checklists" traduz o resultado, e casa a ficha com o carro', async () => {
  const sbClient = banco([
    { veiculo_id: 'v1', feita_em: '2026-07-05', pessoa_nome: 'Ana', hodometro: 45000,
      resultado: 'com_ressalvas', anomalias: 'pneu careca' },
  ])
  const [l] = await acharRelatorioDaFrota('checklists').montar({ ...CTX, sbClient, de: 'x', ate: 'y' })
  assert.equal(l.placa, 'DCH1J89')
  assert.equal(l.resultado, 'Com ressalvas')
  assert.equal(l.anomalias, 'pneu careca')
})

test('"Checklists" ignora ficha de carro que não existe mais', async () => {
  const sbClient = banco([{ veiculo_id: 'sumiu', feita_em: '2026-07-05', hodometro: 1, resultado: 'liberado' }])
  const linhas = await acharRelatorioDaFrota('checklists').montar({ ...CTX, sbClient, de: 'x', ate: 'y' })
  assert.deepEqual(linhas, [])
})

test('"Checklists" ESTOURA quando o banco recusa, em vez de dizer que não houve ficha', async () => {
  // "Nenhum checklist no período" é uma afirmação grave nesta frota — não pode
  // ser o que a tela mostra quando na verdade a consulta falhou.
  const sbClient = banco(null, { erro: { message: 'permissão negada' } })
  await assert.rejects(
    () => acharRelatorioDaFrota('checklists').montar({ ...CTX, sbClient, de: 'x', ate: 'y' }),
    /permissão negada/,
  )
})

// ───────────────────────────────── Revisões ──────────────────────────────────

const PLANO = [{ item: 'Troca de óleo', a_cada_km: 7000, ativo: true }]

test('"Revisões" é retrato, e NÃO pede período', () => {
  // Filtrando por data, o item nunca trocado — o mais vencido de todos — não
  // teria linha e sumiria justamente do relatório de vencidos.
  assert.equal(acharRelatorioDaFrota('revisoes').periodo, false)
})

test('"Revisões" mostra o item NUNCA trocado, com a situação dizendo isso', async () => {
  const linhas = await acharRelatorioDaFrota('revisoes').montar({
    ...CTX, plano: PLANO, revisoes: [], fichas: [{ veiculo_id: 'v1', hodometro: 50000, feita_em: '2026-08-01' }],
  })
  const doBmw = linhas.filter((l) => l.placa === 'DCH1J89')
  assert.equal(doBmw.length, 1)
  assert.equal(doBmw[0].item, 'Troca de óleo')
  assert.equal(doBmw[0].situacao, 'Sem registro')
  assert.equal(doBmw[0].ultima_troca, '')
})

test('"Revisões" marca como Vencida quando passou do ponto, e traz a oficina da última', async () => {
  const revisoes = [{ veiculo_id: 'v1', item: 'Troca de óleo', km: 40000,
    feita_em: '2026-01-10', oficina: 'Auto Center', custo_centavos: 25000 }]
  const fichas = [{ veiculo_id: 'v1', hodometro: 50000, feita_em: '2026-08-01' }]
  const linhas = await acharRelatorioDaFrota('revisoes').montar({ ...CTX, plano: PLANO, revisoes, fichas })
  const l = linhas.find((x) => x.placa === 'DCH1J89')
  assert.equal(l.situacao, 'Vencida')   // 40000 + 7000 = 47000, e já está em 50000
  assert.equal(l.oficina, 'Auto Center')
  assert.equal(l.custo_centavos, 25000)
})

test('"Revisões" diz que não sabe a quilometragem, em vez de chutar Em dia', async () => {
  const linhas = await acharRelatorioDaFrota('revisoes').montar({
    ...CTX, plano: PLANO, revisoes: [], fichas: [],
  })
  assert.equal(linhas[0].situacao, 'Sem quilometragem')
})

// ───────────────────────────────── Quem dirigiu ──────────────────────────────

test('"Quem esteve com o carro" pede período e pergunta pela SAÍDA', async () => {
  const pedidos = []
  const sbClient = banco([], { pedidos })
  assert.equal(acharRelatorioDaFrota('quem-dirigiu').periodo, true)
  await acharRelatorioDaFrota('quem-dirigiu').montar({ ...CTX, sbClient, de: '2026-07-01', ate: '2026-07-31' })
  assert.deepEqual(pedidos, [['gte', 'saida_em', '2026-07-01'], ['lte', 'saida_em', '2026-07-31']])
})

test('"Quem esteve" calcula os km rodados, e diz "na rua" quando não voltou', async () => {
  const sbClient = banco([
    { veiculo_id: 'v1', pessoa_nome: 'Ana', saida_em: '2026-07-02T08:00:00Z',
      volta_em: '2026-07-02T18:00:00Z', km_saida: 1000, km_volta: 1240, destino: 'Campinas' },
    { veiculo_id: 'v1', pessoa_nome: 'Bia', saida_em: '2026-07-03T08:00:00Z',
      volta_em: null, km_saida: 1240, km_volta: null, destino: 'Limeira' },
  ])
  const linhas = await acharRelatorioDaFrota('quem-dirigiu').montar({ ...CTX, sbClient, de: 'x', ate: 'y' })
  assert.equal(linhas[0].km_rodados, 240)
  assert.equal(linhas[1].volta, 'na rua')
  // Sem volta não há km rodado. Zero mentiria: zero é "andou e não saiu do lugar".
  assert.equal(linhas[1].km_rodados, '')
})
