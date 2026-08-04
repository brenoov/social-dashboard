import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LIMPAR, montarAlteracaoEmMassa, temAlgoParaMudar,
  resumoDaSelecao, alternarTodosVisiveis, estadoDaSelecaoVisivel,
} from './acao-em-massa.js'

test('formulário em branco não muda nada', () => {
  assert.deepEqual(montarAlteracaoEmMassa({}).alteracao, {})
  assert.deepEqual(montarAlteracaoEmMassa(null).alteracao, {})
  assert.equal(temAlgoParaMudar({}), false)
  assert.equal(temAlgoParaMudar({ situacao: '' }), false)
})

test('campo vazio NÃO é apagado — vazio quer dizer "não mexe"', () => {
  // Este é o risco real: marcar 80 itens só pra trocar a situação e apagar o
  // dono, o local e a categoria dos 80.
  const { alteracao } = montarAlteracaoEmMassa({
    situacao: 'em_uso', empresaId: '', localId: null, pessoaId: undefined, categoriaId: '',
  })
  assert.deepEqual(alteracao, { situacao: 'em_uso' })
  assert.equal(temAlgoParaMudar({ situacao: 'em_uso' }), true)
})

test('LIMPAR esvazia o campo de propósito', () => {
  const { alteracao } = montarAlteracaoEmMassa({ pessoaId: LIMPAR })
  assert.deepEqual(alteracao, { pessoa_id: null })
})

test('trocar a marca solta local e cômodo, e avisa', () => {
  const { alteracao, avisos } = montarAlteracaoEmMassa({ empresaId: 'e2' })
  assert.deepEqual(alteracao, { empresa_id: 'e2', local_id: null, comodo_id: null })
  assert.ok(avisos.some((a) => a.includes('Sem local')))
})

test('trocar marca E local junto não solta o local', () => {
  const { alteracao } = montarAlteracaoEmMassa({ empresaId: 'e2', localId: 'l9' })
  assert.equal(alteracao.empresa_id, 'e2')
  assert.equal(alteracao.local_id, 'l9')
  assert.equal(alteracao.comodo_id, null) // o cômodo ainda solta, é filho do local
})

test('trocar a marca, o local E o cômodo junto não solta nada', () => {
  const { alteracao, avisos } = montarAlteracaoEmMassa({ empresaId: 'e2', localId: 'l9', comodoId: 'c9' })
  assert.deepEqual(alteracao, { empresa_id: 'e2', local_id: 'l9', comodo_id: 'c9' })
  assert.deepEqual(avisos, [])
})

test('trocar só o local solta o cômodo', () => {
  const { alteracao, avisos } = montarAlteracaoEmMassa({ localId: 'l9' })
  assert.deepEqual(alteracao, { local_id: 'l9', comodo_id: null })
  assert.ok(avisos.some((a) => a.includes('Sem cômodo')))
})

test('apontar uma pessoa apaga o nome solto da planilha', () => {
  const { alteracao } = montarAlteracaoEmMassa({ pessoaId: 'p1' })
  assert.equal(alteracao.pessoa_id, 'p1')
  assert.equal(alteracao.dono_texto, null)
})

test('tirar o dono NÃO mexe no nome solto', () => {
  const { alteracao } = montarAlteracaoEmMassa({ pessoaId: LIMPAR })
  assert.equal('dono_texto' in alteracao, false)
})

test('avisa quando muitos itens vão para a mesma pessoa', () => {
  const { avisos } = montarAlteracaoEmMassa({ pessoaId: 'p1' }, { quantidade: 37 })
  assert.ok(avisos.some((a) => a.includes('37')))
  assert.deepEqual(montarAlteracaoEmMassa({ pessoaId: 'p1' }, { quantidade: 1 }).avisos, [])
})

const BENS = [
  { id: 'a', valor_centavos: 100000 },
  { id: 'b', valor_centavos: 50000 },
  { id: 'c', valor_centavos: null },
]

test('resumo conta e soma só o que está marcado', () => {
  assert.deepEqual(resumoDaSelecao(BENS, ['a', 'c']), { quantidade: 2, totalCentavos: 100000 })
  assert.deepEqual(resumoDaSelecao(BENS, new Set(['a', 'b'])), { quantidade: 2, totalCentavos: 150000 })
  assert.deepEqual(resumoDaSelecao(BENS, []), { quantidade: 0, totalCentavos: 0 })
  assert.deepEqual(resumoDaSelecao(null, null), { quantidade: 0, totalCentavos: 0 })
})

test('marcar tudo da tela SOMA com o que já estava marcado fora dela', () => {
  // Filtrar por uma sala, marcar tudo, trocar de sala e marcar mais tem que
  // acumular — senão a segunda seleção apaga a primeira sem avisar.
  const antes = new Set(['z'])
  const depois = alternarTodosVisiveis(antes, BENS, true)
  assert.deepEqual([...depois].sort(), ['a', 'b', 'c', 'z'])
  assert.deepEqual([...antes], ['z'], 'não pode mutar a entrada')
})

test('desmarcar tudo da tela não mexe no que está fora dela', () => {
  const depois = alternarTodosVisiveis(new Set(['a', 'b', 'z']), BENS, false)
  assert.deepEqual([...depois], ['z'])
})

test('estado do marcar-tudo: vazio / parcial / cheio', () => {
  assert.equal(estadoDaSelecaoVisivel(new Set(), BENS), 'vazio')
  assert.equal(estadoDaSelecaoVisivel(new Set(['a']), BENS), 'parcial')
  assert.equal(estadoDaSelecaoVisivel(new Set(['a', 'b', 'c']), BENS), 'cheio')
  // marcado fora da tela não conta como se a tela estivesse cheia
  assert.equal(estadoDaSelecaoVisivel(new Set(['z']), BENS), 'vazio')
  assert.equal(estadoDaSelecaoVisivel(new Set(['a']), []), 'vazio')
})
