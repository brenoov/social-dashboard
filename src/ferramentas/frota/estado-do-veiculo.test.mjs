import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  estadoDoVeiculo, resumoDoEstado, ordenarEstados, usoAberto, ultimoUsoFechado,
  rotuloDoTanque, precisaAbastecer, problemasDaDevolucao,
} from './estado-do-veiculo.js'

const carro = (extra = {}) => ({ id: 'v1', nome: 'FORD FIESTA SEDAN', placa: 'ERO3G55', situacao: 'ativo', ...extra })

test('carro parado, sem uso nenhum, não inventa número', () => {
  const e = estadoDoVeiculo(carro(), [])
  assert.equal(e.naRua, false)
  assert.equal(e.km, null, 'KM desconhecido é nulo, nunca zero — zero é um odômetro')
  assert.equal(e.tanque, null)
  assert.equal(e.disponivel, true)
})

test('o KM sai da última DEVOLUÇÃO, não de campo digitado', () => {
  // É a razão de ser deste módulo: na planilha "KM Atual" é preenchido à mão e
  // por isso a aba Alertas nasceu vazia.
  const usos = [
    { veiculo_id: 'v1', saida_em: '2026-07-01T08:00Z', volta_em: '2026-07-01T18:00Z', km_saida: 145000, km_volta: 145300 },
    { veiculo_id: 'v1', saida_em: '2026-07-10T08:00Z', volta_em: '2026-07-10T18:00Z', km_saida: 145300, km_volta: 145928 },
  ]
  assert.equal(estadoDoVeiculo(carro(), usos).km, 145928)
})

test('quem devolveu por último manda, mesmo tendo saído antes', () => {
  // Dois carros na rua ao mesmo tempo não acontece (o banco impede), mas
  // registros lançados fora de ordem acontecem. Ordenar pela SAÍDA daria o
  // odômetro errado.
  const usos = [
    { veiculo_id: 'v1', saida_em: '2026-07-01T08:00Z', volta_em: '2026-07-20T18:00Z', km_volta: 146500 },
    { veiculo_id: 'v1', saida_em: '2026-07-10T08:00Z', volta_em: '2026-07-11T18:00Z', km_volta: 145928 },
  ]
  assert.equal(ultimoUsoFechado(usos, 'v1').km_volta, 146500)
})

test('carro na rua: mostra COM QUEM, e não o local', () => {
  const usos = [{ veiculo_id: 'v1', pessoa_nome: 'Siqueira', saida_em: '2026-08-04T07:00Z', km_saida: 145928, tanque_quartos: 1 }]
  const e = estadoDoVeiculo(carro({ local_texto: 'Barracão' }), usos)
  assert.equal(e.naRua, true)
  assert.equal(e.comQuem, 'Siqueira')
  assert.equal(e.ondeEsta, null, 'na rua, o local guardado não vale mais')
  assert.equal(e.disponivel, false)
  assert.equal(resumoDoEstado(e), 'Na rua com Siqueira')
})

test('carro parado: pessoa e local são coisas SEPARADAS', () => {
  // Decisão do dono. A planilha junta os dois numa coluna só ("Raissa",
  // "Barracão") e perde uma das informações.
  const soLocal = estadoDoVeiculo(carro({ local_texto: 'Barracão' }), [])
  assert.equal(resumoDoEstado(soLocal), 'Livre, em Barracão')

  const soPessoa = estadoDoVeiculo(carro({ pessoa_id: 'p-raissa', pessoa_nome: 'Raissa' }), [])
  assert.equal(resumoDoEstado(soPessoa), 'Com Raissa')

  const ambos = estadoDoVeiculo(carro({ pessoa_nome: 'Raissa', local_texto: 'Conchal' }), [])
  assert.equal(ambos.comQuem, 'Raissa')
  assert.equal(ambos.ondeEsta, 'Conchal', 'os dois sobrevivem — nenhum apaga o outro')
})

test('carro com RESPONSÁVEL FIXO não é carro livre', () => {
  // Correção do dono: "os carros que têm nome atrelado não estão livres". O
  // Volvo do Humberto não está esperando alguém pegar — ele é o carro do
  // Humberto. Oferecê-lo como disponível convidava a pegar o carro alheio.
  const e = estadoDoVeiculo(carro({ pessoa_id: 'p-humberto', pessoa_nome: 'Humberto' }), [])
  assert.equal(e.naRua, false, 'não está na rua: está parado, mas é dele')
  assert.equal(e.disponivel, false)
  // O TEXTO tem que concordar com a regra. "Livre, com Humberto" se contradiz
  // na mesma frase — e foi o que o dono viu na tela.
  assert.equal(resumoDoEstado(e), 'Com Humberto')
  assert.ok(!/livre/i.test(resumoDoEstado(e)), 'carro com responsável nunca diz "livre"')
})

test('sem responsável e sem uso aberto, aí sim está livre', () => {
  assert.equal(estadoDoVeiculo(carro(), []).disponivel, true)
})

test('carro na oficina não é carro livre', () => {
  const e = estadoDoVeiculo(carro({ situacao: 'em_manutencao' }), [])
  assert.equal(e.disponivel, false)
  assert.equal(resumoDoEstado(e), 'Na oficina')
})

test('carro alienado sai do caminho', () => {
  // O Ford Fiesta Hatch: o dono disse que não é mais da frota.
  const e = estadoDoVeiculo(carro({ situacao: 'alienado' }), [])
  assert.equal(e.disponivel, false)
  assert.equal(resumoDoEstado(e), 'Fora da frota')
})

test('a lista põe na frente o que dá pra usar agora', () => {
  const ests = [
    estadoDoVeiculo(carro({ id: 'a', nome: 'Alienado', situacao: 'alienado' }), []),
    estadoDoVeiculo(carro({ id: 'b', nome: 'Na rua' }), [{ veiculo_id: 'b', saida_em: 'x' }]),
    estadoDoVeiculo(carro({ id: 'c', nome: 'Oficina', situacao: 'em_manutencao' }), []),
    estadoDoVeiculo(carro({ id: 'd', nome: 'Livre' }), []),
  ]
  assert.deepEqual(ordenarEstados(ests).map((e) => e.veiculo.nome),
    ['Livre', 'Na rua', 'Oficina', 'Alienado'])
})

test('o tanque é lido como o ponteiro do painel', () => {
  assert.equal(rotuloDoTanque(0), 'Reserva')
  assert.equal(rotuloDoTanque(1), '1/4')
  assert.equal(rotuloDoTanque(4), 'Cheio')
  assert.equal(rotuloDoTanque(null), '—')
  assert.equal(rotuloDoTanque(9), '—')
})

test('1/4 ou menos avisa pra abastecer antes de sair', () => {
  assert.equal(precisaAbastecer(0), true)
  assert.equal(precisaAbastecer(1), true)
  assert.equal(precisaAbastecer(2), false)
  assert.equal(precisaAbastecer(null), false, 'sem informação não é motivo de alarme')
})

test('usoAberto acha só o que não voltou, e só daquele carro', () => {
  const usos = [
    { veiculo_id: 'v1', volta_em: '2026-07-01T18:00Z' },
    { veiculo_id: 'v2', volta_em: null },
    { veiculo_id: 'v1', volta_em: null },
  ]
  assert.equal(usoAberto(usos, 'v1').veiculo_id, 'v1')
  assert.equal(usoAberto(usos, 'v3'), null)
  assert.equal(usoAberto(null, 'v1'), null)
})

/* ── Devolução: o odômetro errado é o que estraga tudo depois ─────────────── */

test('devolução sem KM não passa', () => {
  const p = problemasDaDevolucao({ kmSaida: 145928, kmVolta: null })
  assert.equal(p.length, 1)
  assert.match(p[0], /painel/i)
})

test('KM de volta menor que o de saída é dedo errado', () => {
  const p = problemasDaDevolucao({ kmSaida: 145928, kmVolta: 145000 })
  assert.equal(p.length, 1)
  assert.match(p[0], /menor que o da sa[ií]da/i)
  assert.match(p[0], /145\.928/, 'mostrar os dois números é o que faz a pessoa achar o erro')
})

test('salto absurdo AVISA, mas não proíbe — viagem longa existe', () => {
  const p = problemasDaDevolucao({ kmSaida: 145928, kmVolta: 152000 })
  assert.equal(p.length, 1)
  assert.match(p[0], /Confirme/i)
  assert.ok(!/menor/i.test(p[0]))
})

test('devolução normal passa limpa', () => {
  assert.deepEqual(problemasDaDevolucao({ kmSaida: 145928, kmVolta: 146080 }), [])
})

test('sem KM de saída registrado, ainda dá pra devolver', () => {
  // A planilha tem "KM Inicial" em branco em quase todo registro. O módulo não
  // pode travar a devolução por causa de um dado que ninguém preencheu antes.
  assert.deepEqual(problemasDaDevolucao({ kmSaida: null, kmVolta: 146080 }), [])
})
