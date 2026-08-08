import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataBR, textoDaConferencia, resumoDaAssinatura, avisoDeTempo } from './conferencia-de-assinaturas.js'
import { tempoDePreenchimento, SEGUNDOS_SUSPEITOS } from '../../../supabase/functions/_shared/assinatura.js'

/* ── A data ───────────────────────────────────────────────────────────────── */

test('a data sai em português, e não passa por Date (o dia não anda pra trás)', () => {
  assert.equal(dataBR('2026-08-07'), '07/08/2026')
  // 1º de janeiro em fuso a oeste voltaria pra 31/12 se passasse por `new Date`.
  assert.equal(dataBR('2026-01-01'), '01/01/2026')
  // O que não é data de calendário passa cru, em vez de virar data inventada.
  assert.equal(dataBR(null), '')
  assert.equal(dataBR('sei lá'), 'sei lá')
})

/* ── Os quatro estados ────────────────────────────────────────────────────── */

test('corrente inteira conferida: verde, e SEM prometer que olharam o carro', () => {
  const r = textoDaConferencia({ ok: true, total: 3, conferidas: 3, naoConferida: null, primeiraQuebra: null })
  assert.equal(r.nivel, 'ok')
  assert.match(r.texto, /As 3 fichas assinadas deste carro conferem/)
  assert.match(r.texto, /nada foi alterado depois de assinado/)
  // D19b: a tela do gestor NÃO pode sugerir que assinada = conferida de verdade.
  assert.match(r.texto, /Não prova que a pessoa olhou o carro/i)
})

test('uma só assinada não vira "As 1 fichas"', () => {
  const r = textoDaConferencia({ ok: true, total: 1, conferidas: 1, naoConferida: null, primeiraQuebra: null })
  assert.equal(r.nivel, 'ok')
  assert.doesNotMatch(r.texto, /As 1 /)
})

test('ficha alterada: vermelho, com a data em português e o que fazer', () => {
  const r = textoDaConferencia({ ok: false, total: 2, conferidas: 1, naoConferida: null,
    primeiraQuebra: { id: 'x', feita_em: '2026-08-06', motivo: 'O conteúdo desta ficha não corresponde ao que foi assinado.' } })
  assert.equal(r.nivel, 'ruim')
  assert.match(r.texto, /A ficha de 06\/08\/2026 não confere/)
  assert.doesNotMatch(r.texto, /2026-08-06/, 'data crua do banco na cara do dono')
  assert.match(r.texto, /avise quem administra/i, 'acusa e não diz o que fazer')
  assert.match(r.texto, /Não apague nem tente corrigir/i)
})

test('O DEFEITO DO BRIEF: lacuna de leitura sem quebra não pode explodir nem acusar', () => {
  // `ok:false` com `primeiraQuebra:null` é exatamente o que conferirCorrente
  // devolve quando as respostas de uma ficha não chegaram. Ler
  // `r.primeiraQuebra.feita_em` aqui derrubaria a tela inteira, e chamar isso
  // de "não confere" acusaria de adulteração uma queda de internet.
  const r = textoDaConferencia({ ok: false, total: 4, conferidas: 3,
    naoConferida: { id: 'y', feita_em: '2026-07-31', motivo: 'as respostas não chegaram' },
    primeiraQuebra: null })
  assert.equal(r.nivel, 'incompleto')
  assert.notEqual(r.nivel, 'ruim', 'falha de leitura não é acusação')
  assert.match(r.texto, /31\/07\/2026/)
  assert.match(r.texto, /NÃO é sinal de que alguém mexeu/i)
  assert.match(r.texto, /Clique de novo/i)
})

test('lacuna de leitura com zero conferidas não mente dizendo que as outras conferem', () => {
  const r = textoDaConferencia({ ok: false, total: 1, conferidas: 0,
    naoConferida: { id: 'y', feita_em: '2026-07-31', motivo: '…' }, primeiraQuebra: null })
  assert.equal(r.nivel, 'incompleto')
  assert.match(r.texto, /Nenhuma outra ficha assinada chegou a ser conferida/i)
  assert.doesNotMatch(r.texto, /outras 0/)
})

test('quebra E lacuna juntas: a acusação vem, e a lacuna não some', () => {
  const r = textoDaConferencia({ ok: false, total: 5, conferidas: 1,
    naoConferida: { id: 'y', feita_em: '2026-07-30', motivo: '…' },
    primeiraQuebra: { id: 'x', feita_em: '2026-08-01', motivo: 'Alguma coisa foi alterada.' } })
  assert.equal(r.nivel, 'ruim')
  assert.match(r.texto, /01\/08\/2026/)
  assert.match(r.texto, /30\/07\/2026/, 'a lacuna sumiu, e a tela ficou parecendo completa')
})

test('carro sem ficha nenhuma: não diz "tudo certo", diz que não há o que conferir', () => {
  const r = textoDaConferencia({ ok: true, total: 0, conferidas: 0, naoConferida: null, primeiraQuebra: null })
  assert.equal(r.nivel, 'nada')
  assert.doesNotMatch(r.texto, /conferem/)
  assert.match(r.texto, /não há o que conferir/i)
})

test('carro com fichas e nenhuma assinada: NÃO trata sem assinatura como suspeito (D22)', () => {
  // Barbara, Marcus e Thiago não têm login. Se esta frase soasse a acusação,
  // a tela estaria cobrando três pessoas por uma falta que é do cadastro.
  const r = textoDaConferencia({ ok: true, total: 9, conferidas: 0, naoConferida: null, primeiraQuebra: null })
  assert.equal(r.nivel, 'nada')
  assert.notEqual(r.nivel, 'ruim')
  assert.match(r.texto, /9 fichas de checklist/)
  assert.match(r.texto, /não é sinal de problema/i)
  assert.match(r.texto, /login próprio/i)
})

test('uma ficha só, não assinada, sai no singular', () => {
  const r = textoDaConferencia({ ok: true, total: 1, conferidas: 0, naoConferida: null, primeiraQuebra: null })
  assert.match(r.texto, /1 ficha de checklist/)
  assert.match(r.texto, /ela não foi assinada/)
})

test('sem resultado nenhum (falha de leitura do histórico) não é acusação', () => {
  const r = textoDaConferencia(null)
  assert.equal(r.nivel, 'incompleto')
  assert.doesNotMatch(r.texto, /confere/)
})

test('nenhum estado usa palavra de informática', () => {
  const casos = [
    { ok: true, total: 2, conferidas: 2 },
    { ok: true, total: 0, conferidas: 0 },
    { ok: true, total: 3, conferidas: 0 },
    { ok: false, total: 2, conferidas: 1, primeiraQuebra: { feita_em: '2026-08-01', motivo: 'Alguma coisa foi alterada.' } },
    { ok: false, total: 2, conferidas: 1, naoConferida: { feita_em: '2026-08-01', motivo: '…' } },
    null,
  ]
  for (const c of casos) {
    const t = textoDaConferencia(c).texto
    assert.doesNotMatch(t, /hash|checksum|corrente criptográfica|criptograf|SHA|payload|null|undefined/i,
      `jargão na frase: ${t}`)
  }
})

/* ── A assinatura de uma ficha ────────────────────────────────────────────── */

test('ficha assinada não vira atestado de que o carro foi olhado', () => {
  const r = resumoDaAssinatura({ assinada_em: '2026-08-07T12:00:00+00:00' })
  assert.equal(r.assinada, true)
  assert.equal(r.texto, 'Assinada')
  assert.match(r.ajuda, /não prova que o carro foi olhado/i)
})

test('sem login e sem assinatura são coisas diferentes, e a tela separa as duas', () => {
  const semLogin = resumoDaAssinatura({ sem_assinatura_motivo: 'sem_login' })
  const semNada = resumoDaAssinatura({})
  assert.equal(semLogin.assinada, false)
  assert.equal(semNada.assinada, false)
  assert.notEqual(semLogin.ajuda, semNada.ajuda, 'os dois casos com a mesma explicação')
  assert.match(semLogin.ajuda, /não tem login próprio/i)
  assert.match(semLogin.ajuda, /vale do mesmo jeito/i, 'a ficha sem assinatura continua valendo')
})

test('ficha nula não derruba a tela', () => {
  assert.equal(resumoDaAssinatura(null).assinada, false)
})

/* ── O tempo (D20), e só o caso curto ─────────────────────────────────────── */

test('preenchimento rápido demais é sinalizado, com o número de segundos', () => {
  const t = tempoDePreenchimento('2026-08-07T12:00:00Z', '2026-08-07T12:00:05Z')
  const aviso = avisoDeTempo(t)
  assert.ok(aviso, 'cinco segundos passaram sem sinal nenhum')
  assert.match(aviso, /5 segundos/)
  assert.match(aviso, /vale conversar/i)
})

test('NÃO existe selo de bem-feito: demorado não ganha elogio nenhum', () => {
  // A assimetria de D20 é o desenho inteiro: curto PROVA desatenção, longo NÃO
  // PROVA zelo. Uma frase elogiosa aqui viraria atestado que o número não dá.
  for (const seg of [SEGUNDOS_SUSPEITOS, 60, 600, 36000]) {
    const t = tempoDePreenchimento('2026-08-07T12:00:00Z', new Date(Date.parse('2026-08-07T12:00:00Z') + seg * 1000).toISOString())
    assert.equal(avisoDeTempo(t), null, `${seg}s virou mensagem na tela`)
  }
})

test('ficha sem os dois instantes (quem não tem login) não recebe aviso nenhum', () => {
  // `aberta_em` é nulo pra quem não assina. Inventar "0 segundos" aqui seria
  // acusar de desatenção justamente quem já não pôde assinar.
  assert.equal(avisoDeTempo(tempoDePreenchimento(null, '2026-08-07T12:00:05Z')), null)
  assert.equal(avisoDeTempo(tempoDePreenchimento('2026-08-07T12:00:00Z', null)), null)
  assert.equal(avisoDeTempo(null), null)
})
