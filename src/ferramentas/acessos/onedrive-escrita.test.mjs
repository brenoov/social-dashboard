// Testes da lógica pura da escrita no OneDrive: normalização/dedup de e-mails e
// montagem da lista de destinatários (seleção do seletor + avulso + "liberar setor").
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarEmailsParaCompartilhar,
  montarEmailsDeSelecao,
  emailsDoSetor,
} from './onedrive-escrita.js'

// --- normalizarEmailsParaCompartilhar ---
test('normaliza: apara espaços e deixa minúsculo', () => {
  assert.deepEqual(
    normalizarEmailsParaCompartilhar(['  Ana@RBV.com ', 'BRENO@rbv.com']),
    ['ana@rbv.com', 'breno@rbv.com'],
  )
})

test('normaliza: remove duplicados (inclusive só diferentes por caixa/espaço)', () => {
  assert.deepEqual(
    normalizarEmailsParaCompartilhar(['ana@rbv.com', 'Ana@rbv.com', ' ana@rbv.com ']),
    ['ana@rbv.com'],
  )
})

test('normaliza: descarta entradas que não parecem e-mail', () => {
  assert.deepEqual(
    normalizarEmailsParaCompartilhar(['', '   ', 'semarroba', '@semlocal.com', 'semdominio@', null, undefined, 'ok@rbv.com']),
    ['ok@rbv.com'],
  )
})

test('normaliza: entrada não-array vira lista vazia', () => {
  assert.deepEqual(normalizarEmailsParaCompartilhar(null), [])
  assert.deepEqual(normalizarEmailsParaCompartilhar(undefined), [])
  assert.deepEqual(normalizarEmailsParaCompartilhar('ana@rbv.com'), [])
})

// --- montarEmailsDeSelecao ---
test('monta: junta seleção com e-mail avulso e normaliza/dedup', () => {
  assert.deepEqual(
    montarEmailsDeSelecao(['Ana@rbv.com', 'breno@rbv.com'], ' Carla@rbv.com '),
    ['ana@rbv.com', 'breno@rbv.com', 'carla@rbv.com'],
  )
})

test('monta: e-mail avulso vazio é ignorado', () => {
  assert.deepEqual(montarEmailsDeSelecao(['ana@rbv.com'], '   '), ['ana@rbv.com'])
  assert.deepEqual(montarEmailsDeSelecao(['ana@rbv.com'], null), ['ana@rbv.com'])
})

test('monta: avulso duplicado da seleção não entra duas vezes', () => {
  assert.deepEqual(montarEmailsDeSelecao(['ana@rbv.com'], 'ANA@rbv.com'), ['ana@rbv.com'])
})

// --- emailsDoSetor ---
const PESSOAS = [
  { nome: 'Ana', status: 'ativo', email_outlook: 'ana@out.com', setor_id: 's1' },
  { nome: 'Breno', status: 'ativo', email_outlook: 'BRENO@out.com', setor_id: 's1' },
  { nome: 'Inativo', status: 'inativo', email_outlook: 'x@out.com', setor_id: 's1' },
  { nome: 'SemOutlook', status: 'ativo', email_outlook: null, setor_id: 's1' },
  { nome: 'OutroSetor', status: 'ativo', email_outlook: 'z@out.com', setor_id: 's2' },
]

test('emailsDoSetor: só ativos, com Outlook, do setor pedido — normalizado', () => {
  assert.deepEqual(emailsDoSetor(PESSOAS, 's1'), ['ana@out.com', 'breno@out.com'])
})

test('emailsDoSetor: setor sem ninguém elegível devolve vazio', () => {
  assert.deepEqual(emailsDoSetor(PESSOAS, 's3'), [])
  assert.deepEqual(emailsDoSetor(null, 's1'), [])
})
