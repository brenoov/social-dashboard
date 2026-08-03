import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SITUACOES, rotuloDaSituacao, classeDaSituacao, textoDoDono, precisaDeDono,
} from './rotulos-do-bem.js'

test('SITUACOES cobre exatamente o que o banco aceita', () => {
  assert.deepEqual(SITUACOES.map(s => s.valor), ['em_uso', 'em_estoque', 'em_manutencao', 'baixado'])
})

test('rótulo é português de gente, não o valor do banco', () => {
  assert.equal(rotuloDaSituacao('em_uso'), 'Em uso')
  assert.equal(rotuloDaSituacao('em_estoque'), 'Em estoque')
  assert.equal(rotuloDaSituacao('em_manutencao'), 'Em manutenção')
  assert.equal(rotuloDaSituacao('baixado'), 'Baixado')
})

test('situação desconhecida não quebra a tela: devolve o próprio valor', () => {
  assert.equal(rotuloDaSituacao('coisa_nova'), 'coisa_nova')
  assert.equal(rotuloDaSituacao(null), '—')
})

test('cada situação tem sua classe de pílula', () => {
  assert.equal(classeDaSituacao('em_uso'), 'pat-pill-uso')
  assert.equal(classeDaSituacao('em_estoque'), 'pat-pill-estoque')
  assert.equal(classeDaSituacao('em_manutencao'), 'pat-pill-manutencao')
  assert.equal(classeDaSituacao('baixado'), 'pat-pill-baixado')
  assert.equal(classeDaSituacao('coisa_nova'), 'pat-pill-neutro')
})

test('dono: colaborador cadastrado vence o nome solto', () => {
  const pessoas = { 'p1': { id: 'p1', nome: 'Larissa Sousa' } }
  assert.equal(textoDoDono({ pessoa_id: 'p1', dono_texto: 'Larissa' }, pessoas), 'Larissa Sousa')
})

test('dono: nome solto da planilha aparece marcado como não cadastrado', () => {
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: 'Raíssa' }, {}), 'Raíssa (não cadastrada)')
})

test('dono: sem ninguém diz que não está com ninguém', () => {
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: null }, {}), 'Sem dono')
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: '   ' }, {}), 'Sem dono')
})

test('dono: pessoa_id que não existe mais não vira "undefined"', () => {
  assert.equal(textoDoDono({ pessoa_id: 'sumiu', dono_texto: null }, {}), 'Pessoa removida')
})

test('só "em uso" exige dono', () => {
  assert.equal(precisaDeDono('em_uso'), true)
  assert.equal(precisaDeDono('em_estoque'), false)
  assert.equal(precisaDeDono('em_manutencao'), false)
  assert.equal(precisaDeDono('baixado'), false)
})
