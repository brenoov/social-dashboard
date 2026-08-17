import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SITUACOES_DO_HISTORICO, rotuloDaSituacao, diaEmBrasilia,
  acoesDaReserva, porQueNaoDaEmPortugues, provaDaRetirada, copiaNoZoho,
  retiradaDaReserva, linhaDoTempo, filtrar, resumoDoHistorico, FILTROS,
} from './historico-de-reservas.js'

const AGORA = '2026-08-13T15:00:00-03:00'
const daqui = (horas) => new Date(Date.parse(AGORA) + horas * 3600000).toISOString()

// ── As situações ───────────────────────────────────────────────────────────

test('revogada entra na lista de situações sem derrubar as antigas', () => {
  assert.equal(SITUACOES_DO_HISTORICO.revogada.rotulo, 'Revogada')
  assert.equal(SITUACOES_DO_HISTORICO.aprovada.rotulo, 'Aprovada')
  assert.equal(rotuloDaSituacao('cancelada'), 'Cancelada')
})

test('situação desconhecida não vira vazio na tela', () => {
  // Uma palavra nova no banco não pode virar um espaço em branco no card.
  assert.equal(rotuloDaSituacao('coisa-nova'), 'coisa-nova')
  assert.equal(rotuloDaSituacao(null), 'sem situação')
})

// ── O dia em Brasília ──────────────────────────────────────────────────────

test('retirada das 22h continua sendo do dia de hoje, não de amanhã', () => {
  // `toISOString()` puro daria 2026-08-14: às 22h em Brasília já é dia 14 em
  // UTC. A ficha de hoje nunca seria encontrada.
  assert.equal(diaEmBrasilia('2026-08-13T22:30:00-03:00'), '2026-08-13')
  assert.equal(diaEmBrasilia('2026-08-13T09:00:00-03:00'), '2026-08-13')
})

test('instante inválido não vira uma data plausível', () => {
  assert.equal(diaEmBrasilia('sei lá'), null)
  assert.equal(diaEmBrasilia(null), null)
})

// ── O que dá pra fazer ─────────────────────────────────────────────────────

const reserva = (extra = {}) => ({
  id: 'r1', veiculo_id: 'v1', pessoa_id: 'p1', pessoa_nome: 'Felipe',
  situacao: 'aprovada', retirada_prevista: daqui(24), devolucao_prevista: daqui(30),
  ...extra,
})

test('reserva futura se cancela, e não se revoga', () => {
  const a = acoesDaReserva({ requisicao: reserva(), temPermissaoAprovar: true, agoraIso: AGORA })
  assert.equal(a.cancelar.pode, true)
  assert.equal(a.revogar.pode, false)
  assert.equal(a.revogar.motivo, 'ainda-nao-comecou')
  assert.equal(a.editar.pode, true)
})

test('reserva que já começou se revoga, e não se cancela', () => {
  const a = acoesDaReserva({
    requisicao: reserva({ retirada_prevista: daqui(-2) }),
    temPermissaoAprovar: true, agoraIso: AGORA,
  })
  assert.equal(a.revogar.pode, true)
  assert.equal(a.cancelar.pode, false)
  assert.equal(a.cancelar.motivo, 'ja-comecou')
})

test('as duas nunca aparecem juntas', () => {
  // Uma ação principal por bloco: dois botões quase iguais lado a lado fazem a
  // pessoa escolher no chute.
  for (const h of [-48, -1, 0.5, 24, 240]) {
    const a = acoesDaReserva({
      requisicao: reserva({ retirada_prevista: daqui(h) }),
      temPermissaoAprovar: true, agoraIso: AGORA,
    })
    assert.notEqual(a.cancelar.pode, a.revogar.pode, `com retirada em ${h}h as duas coincidiram`)
  }
})

test('reserva que já virou viagem não se edita nem se cancela — só se revoga', () => {
  const a = acoesDaReserva({
    requisicao: reserva({ uso_id: 'u1', retirada_prevista: daqui(24) }),
    temPermissaoAprovar: true, agoraIso: AGORA,
  })
  assert.equal(a.editar.pode, false)
  assert.equal(a.editar.motivo, 'ja-virou-viagem')
  assert.equal(a.cancelar.pode, false)
  assert.equal(a.revogar.pode, true)
})

test('reserva encerrada não aceita nenhuma das três', () => {
  for (const s of ['recusada', 'cancelada', 'revogada', 'usada']) {
    const a = acoesDaReserva({
      requisicao: reserva({ situacao: s }), temPermissaoAprovar: true, agoraIso: AGORA,
    })
    for (const acao of ['editar', 'cancelar', 'revogar']) {
      assert.equal(a[acao].pode, false, `${acao} continuou liberada com situação ${s}`)
      assert.equal(a[acao].motivo, 'ja-encerrada')
    }
  }
})

test('sem a permissão de aprovar, nenhuma das três aparece', () => {
  const a = acoesDaReserva({ requisicao: reserva(), temPermissaoAprovar: false, agoraIso: AGORA })
  for (const acao of ['editar', 'cancelar', 'revogar']) {
    assert.equal(a[acao].pode, false)
    assert.equal(a[acao].motivo, 'sem-permissao')
  }
})

test('reserva sem hora de retirada cai no lado reversível', () => {
  // Na dúvida a tela oferece a ação menos grave. Revogar libera o carro na
  // hora; cancelar só desmarca o que ainda não começou.
  const a = acoesDaReserva({
    requisicao: reserva({ retirada_prevista: null }), temPermissaoAprovar: true, agoraIso: AGORA,
  })
  assert.equal(a.cancelar.pode, true)
  assert.equal(a.revogar.pode, false)
})

test('todo motivo tem frase escrita — nenhum botão some calado', () => {
  for (const m of ['sem-permissao', 'ja-encerrada', 'ja-virou-viagem', 'ja-comecou', 'ainda-nao-comecou']) {
    const frase = porQueNaoDaEmPortugues(m, 'cancelada')
    assert.ok(frase.length > 20, `o motivo ${m} saiu sem frase`)
  }
})

// ── A prova ────────────────────────────────────────────────────────────────

const uso = (extra = {}) => ({
  id: 'u1', veiculo_id: 'v1', pessoa_id: 'p1', pessoa_nome: 'Breno',
  saida_em: '2026-08-07T17:49:00-03:00', ...extra,
})
const ficha = (extra = {}) => ({
  id: 'f1', veiculo_id: 'v1', feita_em: '2026-08-07',
  pessoa_id: 'p9', pessoa_nome: 'Erick Martins', assinada_em: '2026-08-07T07:30:00-03:00', ...extra,
})

test('O CASO REAL DE 07/08: assinou Erick, pegou Breno — a tela não pode dizer "assinado"', () => {
  // Este é o achado que motivou a entrega inteira. Um "✔ assinado" aqui seria
  // uma mentira: a assinatura existe, mas não é de quem pegou o carro.
  const p = provaDaRetirada({ uso: uso(), fichas: [ficha()] })
  assert.equal(p.estado, 'assinada-por-outra')
  assert.match(p.frase, /Erick Martins/)
  assert.match(p.frase, /Breno/)
  assert.match(p.frase, /Não ficou assinatura de quem pegou/i)
})

test('mesma pessoa conferindo e pegando: uma assinatura basta', () => {
  const p = provaDaRetirada({ uso: uso({ pessoa_id: 'p9' }), fichas: [ficha()] })
  assert.equal(p.estado, 'assinada-por-quem-pegou')
})

test('sem id nos dois lados, o nome decide', () => {
  const p = provaDaRetirada({
    uso: uso({ pessoa_id: null, pessoa_nome: 'erick martins' }),
    fichas: [ficha({ pessoa_id: null })],
  })
  assert.equal(p.estado, 'assinada-por-quem-pegou')
})

test('nome vazio dos dois lados NÃO faz duas pessoas virarem a mesma', () => {
  const p = provaDaRetirada({
    uso: uso({ pessoa_id: null, pessoa_nome: '' }),
    fichas: [ficha({ pessoa_id: null, pessoa_nome: '  ' })],
  })
  assert.equal(p.estado, 'assinada-por-outra')
})

test('o aceite de retirada vence tudo: é a assinatura de quem pegou', () => {
  const p = provaDaRetirada({
    uso: uso({ aceite_em: '2026-08-07T17:49:30-03:00', aceite_nome: 'Breno' }),
    fichas: [ficha()],
  })
  assert.equal(p.estado, 'aceite')
  assert.match(p.frase, /Breno assinou o aceite/)
})

test('dia sem checklist nenhum: a tela diz que não ficou prova', () => {
  const p = provaDaRetirada({ uso: uso(), fichas: [] })
  assert.equal(p.estado, 'sem-ficha')
  assert.match(p.frase, /prova nenhuma/)
})

test('ficha preenchida e não assinada não conta como assinada', () => {
  const p = provaDaRetirada({ uso: uso(), fichas: [ficha({ assinada_em: null })] })
  assert.equal(p.estado, 'ficha-sem-assinatura')
})

test('a ficha do OUTRO carro no mesmo dia não serve de prova', () => {
  const p = provaDaRetirada({ uso: uso(), fichas: [ficha({ veiculo_id: 'v2' })] })
  assert.equal(p.estado, 'sem-ficha')
})

test('a ficha do MESMO carro em outro dia não serve de prova', () => {
  const p = provaDaRetirada({ uso: uso(), fichas: [ficha({ feita_em: '2026-08-06' })] })
  assert.equal(p.estado, 'sem-ficha')
})

// ── A cópia no Zoho ────────────────────────────────────────────────────────

test('cópia enviada: a tela diz que chegou', () => {
  const z = copiaNoZoho({ checklistId: 'f1', copias: [{ checklist_id: 'f1', situacao: 'enviado' }] })
  assert.equal(z.estado, 'chegou')
})

test('espera não é problema', () => {
  const z = copiaNoZoho({ checklistId: 'f1', copias: [{ checklist_id: 'f1', situacao: 'na_fila' }] })
  assert.equal(z.estado, 'esperando')
})

test('tropeçou é diferente de desistiu — o robô ainda está tentando', () => {
  const tropecou = copiaNoZoho({
    checklistId: 'f1',
    copias: [{ checklist_id: 'f1', situacao: 'na_fila', ultimo_erro: 'Abra Acessos e reconecte o Zoho.' }],
  })
  assert.equal(tropecou.estado, 'tropecou')
  assert.match(tropecou.frase, /Abra Acessos e reconecte o Zoho\./)

  const desistiu = copiaNoZoho({
    checklistId: 'f1',
    copias: [{ checklist_id: 'f1', situacao: 'falhou', ultimo_erro: 'Abra Acessos e reconecte o Zoho.' }],
  })
  assert.equal(desistiu.estado, 'desistiu')
  // A frase do robô sai como ele escreveu: ela já diz o que fazer.
  assert.match(desistiu.frase, /Abra Acessos e reconecte o Zoho\./)
})

// ── O elo entre reserva e retirada ─────────────────────────────────────────

test('uso_id manda, quando existe', () => {
  const u = uso({ id: 'u7' })
  assert.equal(retiradaDaReserva({ requisicao: reserva({ uso_id: 'u7' }), usos: [u] }), u)
})

test('sem uso_id, casa pela mesma janela que autoriza a retirada', () => {
  const r = reserva({ retirada_prevista: '2026-08-07T17:00:00-03:00', devolucao_prevista: null })
  const u = uso({ pessoa_id: 'p1' })
  assert.equal(retiradaDaReserva({ requisicao: r, usos: [u] }), u)
})

test('NÃO casa a reserva de um com a saída de outro', () => {
  // Casar por engano seria pior que não casar: o histórico afirmaria que
  // alguém pegou o carro com uma autorização que nunca usou.
  const r = reserva({ retirada_prevista: '2026-08-07T17:00:00-03:00' })
  const u = uso({ pessoa_id: 'p2', pessoa_nome: 'Barbara' })
  assert.equal(retiradaDaReserva({ requisicao: r, usos: [u] }), null)
})

test('NÃO casa saída fora da janela', () => {
  const r = reserva({ retirada_prevista: '2026-08-01T09:00:00-03:00', devolucao_prevista: null })
  const u = uso({ pessoa_id: 'p1' })   // saiu em 07/08, seis dias depois
  assert.equal(retiradaDaReserva({ requisicao: r, usos: [u] }), null)
})

test('reserva não aprovada não casa com saída nenhuma', () => {
  const r = reserva({ situacao: 'recusada', retirada_prevista: '2026-08-07T17:00:00-03:00' })
  assert.equal(retiradaDaReserva({ requisicao: r, usos: [uso({ pessoa_id: 'p1' })] }), null)
})

test('duas saídas cabendo na janela: fica a mais perto da hora marcada', () => {
  const r = reserva({ retirada_prevista: '2026-08-07T17:00:00-03:00', devolucao_prevista: null })
  const longe = uso({ id: 'longe', pessoa_id: 'p1', saida_em: '2026-08-07T09:00:00-03:00' })
  const perto = uso({ id: 'perto', pessoa_id: 'p1', saida_em: '2026-08-07T17:49:00-03:00' })
  assert.equal(retiradaDaReserva({ requisicao: r, usos: [longe, perto] }).id, 'perto')
})

// ── A linha do tempo ───────────────────────────────────────────────────────

const cenarioReal = () => ({
  veiculos: [{ id: 'v1', nome: 'BMW X1', placa: 'ABC-1234' }],
  requisicoes: [reserva({ id: 'r1', situacao: 'aprovada', retirada_prevista: '2026-08-11T17:09:00-03:00' })],
  usos: [uso({ id: 'u1', saida_em: '2026-08-07T17:49:00-03:00' })],
  fichas: [ficha()],
  copias: [{ checklist_id: 'f1', situacao: 'enviado' }],
  temPermissaoAprovar: true,
  agoraIso: AGORA,
})

test('a retirada sem reserva aparece — senão a tela mostraria menos do que aconteceu', () => {
  const linhas = linhaDoTempo(cenarioReal())
  assert.equal(linhas.length, 2)
  const avulsa = linhas.find((l) => l.tipo === 'retirada')
  assert.ok(avulsa, 'a retirada sem reserva sumiu da lista')
  assert.equal(avulsa.situacao, 'sem-reserva')
  assert.equal(avulsa.veiculoNome, 'BMW X1')
})

test('a retirada que JÁ está numa reserva não aparece duas vezes', () => {
  const c = cenarioReal()
  c.requisicoes = [reserva({ uso_id: 'u1' })]
  const linhas = linhaDoTempo(c)
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].tipo, 'reserva')
  assert.equal(linhas[0].uso.id, 'u1')
})

test('carro apagado do cadastro não deixa a linha sem nome', () => {
  const c = cenarioReal()
  c.veiculos = []
  assert.match(linhaDoTempo(c)[0].veiculoNome, /saiu do cadastro/)
})

test('a linha traz a prova e o estado da cópia no Zoho juntos', () => {
  const c = cenarioReal()
  c.requisicoes = [reserva({ uso_id: 'u1' })]
  const l = linhaDoTempo(c)[0]
  assert.equal(l.prova.estado, 'assinada-por-outra')
  assert.equal(l.zoho.estado, 'chegou')
})

test('mais novo primeiro', () => {
  const c = cenarioReal()
  c.usos = [
    uso({ id: 'velho', saida_em: '2026-08-01T10:00:00-03:00' }),
    uso({ id: 'novo', saida_em: '2026-08-12T10:00:00-03:00' }),
  ]
  c.requisicoes = []
  assert.deepEqual(linhaDoTempo(c).map((l) => l.uso.id), ['novo', 'velho'])
})

// ── O filtro e o resumo ────────────────────────────────────────────────────

test('o filtro "sem assinatura" é o que responde a pergunta do dono', () => {
  const linhas = linhaDoTempo(cenarioReal())
  const semAssinatura = filtrar(linhas, 'sem-assinatura')
  // As duas: a reserva não casou com retirada nenhuma (então não tem prova) e
  // a retirada avulsa foi assinada por outra pessoa.
  assert.equal(semAssinatura.length, 1)
  assert.equal(semAssinatura[0].prova.estado, 'assinada-por-outra')
})

test('todo filtro da barra devolve uma lista, nunca undefined', () => {
  const linhas = linhaDoTempo(cenarioReal())
  for (const f of FILTROS) {
    assert.ok(Array.isArray(filtrar(linhas, f.chave)), `o filtro ${f.chave} não devolveu lista`)
  }
  assert.ok(Array.isArray(filtrar(linhas, 'palavra-que-nao-existe')))
})

test('o filtro não muda a lista original', () => {
  const linhas = linhaDoTempo(cenarioReal())
  filtrar(linhas, 'tudo').pop()
  assert.equal(linhas.length, 2)
})

test('o resumo conta o que importa: retirada sem assinatura de quem pegou', () => {
  const linhas = linhaDoTempo(cenarioReal())
  assert.match(resumoDoHistorico(linhas), /1 retirada ficou sem assinatura/)
})

test('lista vazia não vira número nem frase de erro', () => {
  assert.match(resumoDoHistorico([]), /Nenhuma reserva e nenhuma retirada/)
})

test('tudo assinado por quem pegou: o resumo diz isso, e não fica calado', () => {
  const c = cenarioReal()
  c.requisicoes = []
  c.usos = [uso({ aceite_em: '2026-08-07T17:49:30-03:00', aceite_nome: 'Breno' })]
  assert.match(resumoDoHistorico(linhaDoTempo(c)), /Todas as retiradas têm assinatura/)
})
