import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  diaDaSemana, ehDiaDoMensal, diasEntre,
  semanalAtrasado, mensalAtrasado, cadenciasDoDia,
  itensDaFicha, hodometroAceito, problemasDaFicha,
  quemFaltaHoje, resumoDaCobranca, precisaDeChecklist,
  problemasDoItemDeChecklist,
} from './checklist.js'

// Padrão do banco: semanal na sexta, mensal na 1ª quarta-feira.
const CONFIG = { dia_semanal: 5, semana_mensal: 1, dia_mensal: 3 }

test('o dia da semana sai da data em UTC, não do fuso da máquina', () => {
  // 2026-08-05 é uma quarta-feira. Contar no fuso local faria a data virar e a
  // conferência de sexta cair no sábado, quando ninguém trabalha.
  assert.equal(diaDaSemana('2026-08-05'), 3)
  assert.equal(diaDaSemana('2026-08-07'), 5)  // sexta
  assert.equal(diaDaSemana('2026-08-08'), 6)  // sábado
  assert.equal(diaDaSemana('2026-08-09'), 7)  // domingo
})

test('a 1ª quarta-feira do mês é reconhecida, e a 2ª não', () => {
  assert.equal(ehDiaDoMensal('2026-08-05', CONFIG), true)   // 1ª quarta de agosto
  assert.equal(ehDiaDoMensal('2026-08-12', CONFIG), false)  // 2ª quarta
  assert.equal(ehDiaDoMensal('2026-08-07', CONFIG), false)  // sexta, não é quarta
})

test('dias entre duas datas', () => {
  assert.equal(diasEntre('2026-08-01', '2026-08-08'), 7)
  assert.equal(diasEntre('2026-08-08', '2026-08-08'), 0)
})

/* ── O que o dia pede ────────────────────────────────────────────────────── */

test('dia de semana comum pede só o diário', () => {
  // Segunda-feira. O semanal NÃO se empilha aqui — decisão do dono: nenhum dia
  // pesado.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-08-07', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario'])
})

test('sexta pede o diário e o semanal', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-07', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('a 1ª quarta pede o diário e o mensal, e nunca o semanal junto', () => {
  // Primeira quarta nunca é sexta, então os dois pesados jamais colidem.
  const c = cadenciasDoDia({ hoje: '2026-08-05', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-07-01' })
  assert.deepEqual(c, ['diario', 'mensal'])
})

test('sábado e domingo não pedem nada', () => {
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-08', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-09', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
})

/* ── O atrasado ──────────────────────────────────────────────────────────── */

test('semanal não feito há mais de 7 dias está atrasado e entra no próximo dia útil', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-29', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('atrasado NÃO acumula: uma semana pulada vira uma conferência, não duas', () => {
  // Vinte dias sem semanal continua devolvendo UM 'semanal'.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-21', ultimaMensal: '2026-08-05' })
  assert.equal(c.filter((x) => x === 'semanal').length, 1)
})

test('nunca feito NÃO conta como atrasado — espera o dia próprio', () => {
  // Se contasse, o primeiro dia da funcionalidade jogaria os 21 itens na cara
  // de todo mundo, que é exatamente o dia pesado que o dono não quis.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null })
  assert.deepEqual(c, ['diario'])
})

test('semanalAtrasado e mensalAtrasado isolados', () => {
  assert.equal(semanalAtrasado('2026-08-10', null), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-07'), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-01'), true)
  assert.equal(mensalAtrasado('2026-08-10', null), false)
  assert.equal(mensalAtrasado('2026-08-10', '2026-07-20'), false)
  assert.equal(mensalAtrasado('2026-09-20', '2026-08-05'), true)
})

/* ── Os itens que entram na ficha ────────────────────────────────────────── */

const ITENS = [
  { id: 'd1', item: 'Painel — luzes de advertência', cadencia: 'diario',  ordem: 1, ativo: true },
  { id: 'd2', item: 'Vazamentos sob o veículo',      cadencia: 'diario',  ordem: 2, ativo: true },
  { id: 'd9', item: 'Item desligado',                cadencia: 'diario',  ordem: 3, ativo: false },
  { id: 's1', item: 'Faróis',                        cadencia: 'semanal', ordem: 10, ativo: true },
  { id: 'm1', item: 'Nível do óleo do motor',        cadencia: 'mensal',  ordem: 30, ativo: true },
]

test('a ficha traz só os itens das cadências do dia, na ordem', () => {
  const f = itensDaFicha(ITENS, ['diario', 'semanal'])
  assert.deepEqual(f.map((i) => i.id), ['d1', 'd2', 's1'])
})

test('item desligado pelo gestor não entra na ficha', () => {
  assert.equal(itensDaFicha(ITENS, ['diario']).some((i) => i.id === 'd9'), false)
})

test('fim de semana: nenhuma cadência, nenhum item', () => {
  assert.deepEqual(itensDaFicha(ITENS, []), [])
})

/* ── O hodômetro ─────────────────────────────────────────────────────────── */

test('hodômetro em branco ou zero não passa', () => {
  // precisaJustificar tem de ser false aqui: não é um número estranho que
  // pode ter explicação, é a ausência do dado — só se corrige digitando.
  const branco = hodometroAceito(null, 100000)
  assert.equal(branco.ok, false)
  assert.equal(branco.precisaJustificar, false)
  const zero = hodometroAceito(0, 100000)
  assert.equal(zero.ok, false)
  assert.equal(zero.precisaJustificar, false)
})

test('primeiro hodômetro do carro passa: não há com o que comparar', () => {
  const r = hodometroAceito(148320, null)
  assert.equal(r.ok, true)
  assert.equal(r.precisaJustificar, false)
})

test('hodômetro que anda para trás não passa, e diz qual era o último', () => {
  // O caso real: a planilha trazia o Doblo com 136.172 atual contra troca de
  // óleo em 272.257, e a importação recusou o dado de propósito.
  const r = hodometroAceito(136172, 272257)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /272\.257/)
})

test('salto grande demais pede confirmação, mas é justificável', () => {
  const r = hodometroAceito(160000, 148000)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /12\.000/)
})

test('avanço normal passa liso', () => {
  assert.deepEqual(hodometroAceito(148500, 148320),
    { ok: true, precisaJustificar: false, motivo: '' })
})

/* ── A ficha inteira ─────────────────────────────────────────────────────── */

const DIARIOS = ITENS.filter((i) => i.cadencia === 'diario' && i.ativo)

test('ficha completa e com hodômetro bom não tem problema nenhum', () => {
  assert.deepEqual(problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok', d2: 'nao_ok' }, itens: DIARIOS,
  }), [])
})

test('item sem resposta é problema, e a mensagem diz qual', () => {
  const p = problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
  assert.match(p[0], /Vazamentos sob o veículo/)
})

test('hodômetro para trás COM justificativa escrita passa', () => {
  // A trava não impede: ela obriga a pessoa a dizer o que aconteceu, pra o
  // número estranho ficar explicado no registro em vez de virar mistério.
  assert.deepEqual(problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257,
    justificativa: 'Painel trocado na oficina semana passada, zerou.',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  }), [])
})

test('hodômetro para trás com justificativa curta demais NÃO passa', () => {
  const p = problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257, justificativa: 'sei la',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
})

test('hodômetro em branco ou zero NÃO passa nem com justificativa longa', () => {
  // O vazamento que isto impede: justificativa nunca perdoa a AUSÊNCIA do
  // número, só perdoa um número estranho. Uma justificativa longa e bem
  // escrita não pode virar atalho pra gravar a ficha sem hodômetro nenhum.
  const semNumero = problemasDaFicha({
    hodometro: null, ultimoKm: 272257,
    justificativa: 'O painel está com defeito, o mostrador não acende de jeito nenhum.',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  })
  assert.equal(semNumero.length, 1)

  const zerado = problemasDaFicha({
    hodometro: 0, ultimoKm: 272257,
    justificativa: 'O painel está com defeito, o mostrador não acende de jeito nenhum.',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  })
  assert.equal(zerado.length, 1)
})

/* ── A cobrança ──────────────────────────────────────────────────────────── */

const VEICULOS = [
  { id: 'v1', nome: 'VOLVO XC60',  pessoa_id: 'p1', situacao: 'ativo' },
  { id: 'v2', nome: 'FIAT PUNTO',  pessoa_id: 'p2', situacao: 'ativo' },
  { id: 'v3', nome: 'HONDA FIT',   pessoa_id: null, situacao: 'ativo' },
  { id: 'v4', nome: 'FIAT BRAVO',  pessoa_id: 'p3', situacao: 'em_manutencao' },
]
const PESSOAS = [
  { id: 'p1', nome: 'Humberto Mendonça' },
  { id: 'p2', nome: 'Marcus Vinicius' },
  { id: 'p3', nome: 'Erick Martins' },
]

test('carro sem dono fixo não entra na cobrança', () => {
  // O Honda Fit fica no Barracão, não com alguém. Cobrar dele acusaria todo
  // dia um carro que ninguém usou, e o quadro viraria ruído.
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: PESSOAS })
  assert.equal(l.some((x) => x.veiculo.id === 'v3'), false)
})

test('carro na oficina não entra na cobrança', () => {
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: PESSOAS })
  assert.equal(l.some((x) => x.veiculo.id === 'v4'), false)
})

test('quem não fez aparece primeiro, com o nome do dono', () => {
  const l = quemFaltaHoje({
    veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }],
  })
  assert.equal(l.length, 2)
  assert.equal(l[0].veiculo.id, 'v2')
  assert.equal(l[0].fez, false)
  assert.equal(l[0].dono, 'Marcus Vinicius')
  assert.equal(l[1].fez, true)
})

test('dono que saiu do cadastro não quebra a linha — o carro continua cobrado', () => {
  const l = quemFaltaHoje({
    veiculos: [{ id: 'v9', nome: 'X', pessoa_id: 'sumiu', situacao: 'ativo' }],
    fichasDeHoje: [], pessoas: PESSOAS,
  })
  assert.equal(l[0].dono, null)
  assert.equal(l[0].fez, false)
  // donoId guarda o id original mesmo sem o nome: é ele, não o nome, que
  // outra tela usaria pra ir atrás de quem é o dono.
  assert.equal(l[0].donoId, 'sumiu')
})

/* ── D9b: com `usos`, quem cobra é quem está com o carro, não o dono no papel ── */

test('sem `usos`, o comportamento é idêntico ao de antes — o dono fixo sempre', () => {
  // Chamada como sempre foi chamada, sem o parâmetro novo — é o contrato que
  // o parâmetro opcional promete às chamadas existentes.
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: PESSOAS })
  const v1 = l.find((x) => x.veiculo.id === 'v1')
  assert.equal(v1.donoId, 'p1')
  assert.equal(v1.dono, 'Humberto Mendonça')
})

test('com `usos`, o carro emprestado cobra de quem está com ele — não do dono fixo', () => {
  // Marcus emprestou o Volvo (v1, dono Humberto) para a Barbara. Enquanto
  // durar, é a Barbara quem tem que preencher o checklist de hoje, não o
  // Humberto — que nem está com o carro pra conferir o que quer que seja.
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p4', pessoa_nome: 'Barbara Souza',
    volta_em: null, saida_em: '2026-08-01T00:00:00Z' }]
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: [...PESSOAS, { id: 'p4', nome: 'Barbara Souza' }], usos })
  const v1 = l.find((x) => x.veiculo.id === 'v1')
  assert.equal(v1.donoId, 'p4')
  assert.equal(v1.dono, 'Barbara Souza')
  // O carro sem posse (v2, Marcus) continua cobrando do dono fixo dele.
  const v2 = l.find((x) => x.veiculo.id === 'v2')
  assert.equal(v2.donoId, 'p2')
})

test('dois carros sem checklist saem em ordem alfabética pelo nome, não pela ordem de entrada', () => {
  // Nomes de propósito ao contrário da ordem em que entram no array: se
  // alguém tirar o localeCompare do sort, este é o único teste que denuncia —
  // com só um carro no grupo "não fez" (como nos outros testes daqui), o
  // desempate nunca entra em jogo e a regressão passaria batido.
  const l = quemFaltaHoje({
    veiculos: [
      { id: 'z', nome: 'ZEBRA', pessoa_id: 'p1', situacao: 'ativo' },
      { id: 'a', nome: 'ALFA', pessoa_id: 'p2', situacao: 'ativo' },
    ],
    fichasDeHoje: [], pessoas: PESSOAS,
  })
  assert.equal(l.length, 2)
  assert.equal(l[0].veiculo.id, 'a')
  assert.equal(l[1].veiculo.id, 'z')
})

test('o resumo conta quem falta, e comemora quando não falta ninguém', () => {
  const todos = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }, { veiculo_id: 'v2' }] })
  assert.equal(resumoDaCobranca(todos), 'Todos os carros com dono já foram conferidos hoje.')
  const um = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }] })
  assert.equal(resumoDaCobranca(um), '1 carro ainda sem checklist hoje.')
  const nenhum = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS, fichasDeHoje: [] })
  assert.equal(resumoDaCobranca(nenhum), '2 carros ainda sem checklist hoje.')
})

test('sem carro com dono nenhum, o resumo não mente dizendo que está tudo certo', () => {
  assert.equal(resumoDaCobranca([]), 'Nenhum carro com dono fixo cadastrado.')
})

/* ── Quem precisa preencher, e quando ────────────────────────────────────── */

test('carro sem ficha hoje precisa de checklist ao ser pego', () => {
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas: [], hoje: '2026-08-05' }), true)
})

test('carro que já foi conferido hoje não pede de novo', () => {
  // D12: um carro, um dia, uma ficha. Quem pega depois herda a conferência de
  // quem pegou primeiro.
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-05' }]
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas, hoje: '2026-08-05' }), false)
})

test('ficha de ontem não vale para hoje', () => {
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-04' }]
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas, hoje: '2026-08-05' }), true)
})

test('no fim de semana o rodízio ainda confere o carro antes de sair', () => {
  // O diário é seg-sex, mas quem pega um carro no sábado está prestes a
  // dirigir. O papel manda conferir ANTES DA UTILIZAÇÃO, e isso não tem dia.
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas: [], hoje: '2026-08-08' }), true)
})

/* ── O editor da lista ───────────────────────────────────────────────────── */

const EXISTENTES = [
  { id: 'a', item: 'Faróis', cadencia: 'semanal' },
  { id: 'b', item: 'Buzina', cadencia: 'semanal' },
]

test('item bom não tem problema', () => {
  assert.deepEqual(problemasDoItemDeChecklist({
    item: 'Filtro de ar', cadencia: 'mensal', existentes: EXISTENTES, idAtual: null }), [])
})

test('nome vazio ou curto demais não passa', () => {
  assert.equal(problemasDoItemDeChecklist({
    item: '  ', cadencia: 'diario', existentes: [], idAtual: null }).length, 1)
  assert.equal(problemasDoItemDeChecklist({
    item: 'ab', cadencia: 'diario', existentes: [], idAtual: null }).length, 1)
})

test('cadência inventada não passa', () => {
  const p = problemasDoItemDeChecklist({
    item: 'Filtro de ar', cadencia: 'anual', existentes: [], idAtual: null })
  assert.equal(p.length, 1)
})

test('nome repetido não passa, e a mensagem diz por quê', () => {
  // Dois itens com o mesmo nome dariam duas perguntas iguais na mesma ficha.
  const p = problemasDoItemDeChecklist({
    item: 'faróis', cadencia: 'semanal', existentes: EXISTENTES, idAtual: null })
  assert.equal(p.length, 1)
  assert.match(p[0], /já existe/i)
})

test('editar o próprio item sem trocar o nome passa', () => {
  assert.deepEqual(problemasDoItemDeChecklist({
    item: 'Faróis', cadencia: 'diario', existentes: EXISTENTES, idAtual: 'a' }), [])
})
