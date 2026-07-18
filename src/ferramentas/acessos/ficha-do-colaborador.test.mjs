// Testes da lógica PURA da Ficha do Colaborador (Tarefa 4). Focam a parte que
// tem risco de mentir número: contar as pastas do OneDrive de uma pessoa e
// dizer, honestamente, quando o número está incompleto ou indisponível.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarEmail,
  limparNomePasta,
  contarAcessosOneDrive,
  resumoAcessosOneDrive,
  statusWorkdrive,
  campoPreenchido,
  resumoDaFicha,
} from './ficha-do-colaborador.js'

// --- normalizarEmail ---
test('normalizarEmail baixa caixa e apara espaços; nulo vira vazio', () => {
  assert.equal(normalizarEmail('  Ana@Hotmail.com '), 'ana@hotmail.com')
  assert.equal(normalizarEmail(null), '')
  assert.equal(normalizarEmail(undefined), '')
  assert.equal(normalizarEmail(''), '')
})

// --- limparNomePasta ---
test('limparNomePasta tira a numeração de ordenação só pra exibir', () => {
  assert.equal(limparNomePasta('01. Financeiro'), 'Financeiro')
  assert.equal(limparNomePasta('03.1. Mídia Organizada'), 'Mídia Organizada')
  assert.equal(limparNomePasta('Anexos'), 'Anexos')
})
test('limparNomePasta nunca some com a pasta se sobrar vazio', () => {
  assert.equal(limparNomePasta('12.'), '12.')
  assert.equal(limparNomePasta(''), '')
  assert.equal(limparNomePasta(null), '')
})

const AMOSTRA = {
  items: [
    { email: 'ana@outlook.com', pasta: '01. Financeiro' },
    { email: 'Ana@Outlook.com', pasta: '02. RH-DP' },
    { email: 'ana@outlook.com', pasta: 'Anexos' },
    { email: 'outro@outlook.com', pasta: '05. Mantova' },
    { email: '', pasta: 'link publico' },
  ],
  falhas: [],
}

// --- contarAcessosOneDrive ---
test('conta as pastas da pessoa cruzando email_outlook (case-insensitive)', () => {
  const r = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, AMOSTRA)
  assert.equal(r.total, 3)
  assert.deepEqual(r.pastas, ['01. Financeiro', '02. RH-DP', 'Anexos'])
  assert.equal(r.indisponivel, false)
  assert.equal(r.parcial, false)
  assert.equal(r.semEmail, false)
})

test('proxy falhou (resp nulo/sem items) => indisponivel, NUNCA 0 como fato', () => {
  const r1 = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, null)
  assert.equal(r1.indisponivel, true)
  assert.equal(r1.total, 0)
  const r2 = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, { falhas: [] })
  assert.equal(r2.indisponivel, true)
})

test('leitura parcial (falhas não-vazio) marca parcial=true; total é um piso', () => {
  const r = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, { ...AMOSTRA, falhas: [{ pasta: 'X' }] })
  assert.equal(r.parcial, true)
  assert.equal(r.total, 3)
  assert.equal(r.indisponivel, false)
})

test('pessoa sem email_outlook => semEmail=true e total 0 (0 é fato aqui)', () => {
  const r = contarAcessosOneDrive({ email_outlook: null }, AMOSTRA)
  assert.equal(r.semEmail, true)
  assert.equal(r.total, 0)
  assert.equal(r.indisponivel, false)
})

// --- resumoAcessosOneDrive ---
test('resumo lista as primeiras pastas + "e mais X" com nomes limpos', () => {
  const r = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, {
    items: Array.from({ length: 5 }, (_, i) => ({ email: 'ana@outlook.com', pasta: '0' + (i + 1) + '. Pasta ' + (i + 1) })),
    falhas: [],
  })
  const s = resumoAcessosOneDrive(r, 3)
  assert.equal(s.valor, '5')
  assert.equal(s.incerto, false)
  assert.match(s.detalhe, /Pasta 1, Pasta 2, Pasta 3… e mais 2/)
})

test('resumo indisponível diz que não deu pra consultar (valor "?", incerto)', () => {
  const s = resumoAcessosOneDrive(contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, null))
  assert.equal(s.valor, '?')
  assert.equal(s.incerto, true)
  assert.match(s.detalhe, /não foi possível/)
})

test('resumo parcial marca valor com ≥ e avisa leitura parcial', () => {
  const r = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, { ...AMOSTRA, falhas: [{ pasta: 'X' }] })
  const s = resumoAcessosOneDrive(r)
  assert.equal(s.valor, '≥3')
  assert.equal(s.incerto, true)
  assert.match(s.detalhe, /leitura parcial/)
})

test('resumo sem e-mail Outlook explica por que é 0', () => {
  const s = resumoAcessosOneDrive(contarAcessosOneDrive({ email_outlook: '' }, AMOSTRA))
  assert.equal(s.valor, '0')
  assert.equal(s.incerto, false)
  assert.match(s.detalhe, /sem e-mail Outlook/)
})

// --- statusWorkdrive ---
test('statusWorkdrive: com e-mail corporativo => via time; sem => não migrada', () => {
  assert.equal(statusWorkdrive({ email_corporativo: 'x@rbvcompany.com' }).migrada, true)
  assert.match(statusWorkdrive({ email_corporativo: 'x@rbvcompany.com' }).texto, /via time/)
  assert.equal(statusWorkdrive({ email_corporativo: null }).migrada, false)
  assert.match(statusWorkdrive({ email_corporativo: null }).texto, /ainda não migrada/)
})

// --- campoPreenchido ---
test('campoPreenchido: só string com conteúdo real conta', () => {
  assert.equal(campoPreenchido('ana@x.com'), true)
  assert.equal(campoPreenchido('   '), false)
  assert.equal(campoPreenchido(''), false)
  assert.equal(campoPreenchido(null), false)
  assert.equal(campoPreenchido(undefined), false)
})

// --- resumoDaFicha ---
test('resumoDaFicha: pastas viram null quando indisponível (mostra "?", não 0)', () => {
  const acessos = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, null)
  const r = resumoDaFicha(acessos, [], [])
  assert.equal(r.pastas, null)
  assert.equal(r.equipamentos, 0)
  assert.equal(r.termos, 0)
})

test('resumoDaFicha conta arrays ou números de equipamentos/termos', () => {
  const acessos = contarAcessosOneDrive({ email_outlook: 'ana@outlook.com' }, AMOSTRA)
  const r = resumoDaFicha(acessos, [{}, {}], 1)
  assert.equal(r.pastas, 3)
  assert.equal(r.equipamentos, 2)
  assert.equal(r.termos, 1)
})
