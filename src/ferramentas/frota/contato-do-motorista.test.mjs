import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomesBatem, contatoParaCobranca, podeCopiarTelefoneDoCarro } from './contato-do-motorista.js'

test('nomesBatem: casos reais que têm de bater', () => {
  assert.equal(nomesBatem('Marcus', 'Marcus Vinicius'), true)
  assert.equal(nomesBatem('Siqueira', 'Thiago Siqueira'), true)
  assert.equal(nomesBatem('Bárbara', 'Barbara Franco'), true) // com e sem acento
  assert.equal(nomesBatem('Erick', 'Erick Martins'), true)
})

test('nomesBatem: par que não bate', () => {
  assert.equal(nomesBatem('Marcus', 'Bárbara Franco'), false)
})

// Achado da revisão: a base real tem sobrenome repetido — 3 "Vieira" (Ana,
// Jeremias, Theo) e 2 "Clara" (Beduschi, Marques). A versão antiga desta
// função batia qualquer par que compartilhasse UMA palavra, então
// "Ana Vieira" e "Theo Vieira" — duas pessoas diferentes — davam `true`. Isso
// importa porque um `true` aqui vira `origem: 'carro_mesma_pessoa'` em
// contatoParaCobranca(), que APAGA o aviso de "pode não ser quem dirige".
// Com nomes de mais de uma palavra dos dois lados, agora exige-se TODAS as
// palavras batendo, não só o sobrenome em comum.
test('nomesBatem: sobrenome repetido NÃO faz pessoas diferentes baterem (3 Vieira, 2 Clara reais)', () => {
  assert.equal(nomesBatem('Ana Vieira', 'Theo Vieira'), false)
  assert.equal(nomesBatem('Ana Vieira', 'Jeremias Vieira'), false)
  assert.equal(nomesBatem('Jeremias Vieira', 'Theo Vieira'), false)
  assert.equal(nomesBatem('Clara Beduschi', 'Clara Marques'), false)
})

test('nomesBatem: nome completo igual, ou com uma palavra a mais, continua batendo', () => {
  assert.equal(nomesBatem('Ana Vieira', 'Ana Vieira'), true)
  assert.equal(nomesBatem('Ana Vieira', 'Ana Vieira Souza'), true) // nome do meio/sobrenome extra
  assert.equal(nomesBatem('Clara Beduschi', 'Clara Beduschi'), true)
})

test('nomesBatem: nome vazio ou ausente nunca bate, mesmo os dois vazios', () => {
  assert.equal(nomesBatem('', ''), false)
  assert.equal(nomesBatem(null, null), false)
  assert.equal(nomesBatem('Marcus', ''), false)
  assert.equal(nomesBatem('', 'Marcus'), false)
  assert.equal(nomesBatem(undefined, 'Marcus'), false)
})

test('nomesBatem: não confunde por causa de palavra curta em comum ("de", "da")', () => {
  assert.equal(nomesBatem('Ana de Souza', 'Rita da Silva'), false)
})

test('contatoParaCobranca: colaborador com telefone no cadastro é o caso comum', () => {
  const pessoa = { nome: 'Erick Martins', numero_corporativo: '19971613011' }
  const veiculo = { contato_nome: 'Erick', contato_telefone: '19971613011' }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: '19971613011', origem: 'colaborador', nomeContato: 'Erick Martins',
  })
})

test('contatoParaCobranca: cadastro vazio, telefone do carro é da mesma pessoa (Marcus)', () => {
  const pessoa = { nome: 'Marcus Vinicius', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Marcus', contato_telefone: '19992575880' }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: '19992575880', origem: 'carro_mesma_pessoa', nomeContato: 'Marcus',
  })
})

test('contatoParaCobranca: cadastro vazio, telefone do carro é do Thiago Siqueira', () => {
  const pessoa = { nome: 'Thiago Siqueira', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Siqueira', contato_telefone: '19982180386' }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: '19982180386', origem: 'carro_mesma_pessoa', nomeContato: 'Siqueira',
  })
})

test('contatoParaCobranca: carro de rodízio — contato é outra pessoa (Bárbara no Honda Fit)', () => {
  // Não há dono fixo (rodízio): a tela não sabe QUEM cobrar, mas se soubesse
  // (ex.: quem pegou o carro hoje) o contato do carro não seria essa pessoa.
  const pessoa = { nome: 'Qualquer Motorista', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Bárbara', contato_telefone: '19998086930' }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: '19998086930', origem: 'carro_outra_pessoa', nomeContato: 'Bárbara',
  })
})

test('contatoParaCobranca: sem pessoa (dono saiu do cadastro), carro com contato vira "outra pessoa"', () => {
  const veiculo = { contato_nome: 'Bárbara', contato_telefone: '19998086930' }
  assert.deepEqual(contatoParaCobranca({ pessoa: null, veiculo }), {
    telefone: '19998086930', origem: 'carro_outra_pessoa', nomeContato: 'Bárbara',
  })
})

test('contatoParaCobranca: contato do carro é o nome completo de OUTRO Vieira — mostra o aviso, não apaga', () => {
  // O caso que a revisão pegou: se a ficha do carro guardar o nome completo
  // de uma pessoa ("Ana Vieira") e o motorista registrado for outra pessoa
  // com o mesmo sobrenome ("Theo Vieira"), o sistema NUNCA pode tratar como
  // se fosse a mesma pessoa — errar aqui pro lado do aviso é o seguro.
  const pessoa = { nome: 'Theo Vieira', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Ana Vieira', contato_telefone: '19999998877' }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: '19999998877', origem: 'carro_outra_pessoa', nomeContato: 'Ana Vieira',
  })
})

test('contatoParaCobranca: nem cadastro nem carro têm telefone', () => {
  const pessoa = { nome: 'Barbara Franco', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: null, contato_telefone: null }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo }), {
    telefone: null, origem: 'nenhum', nomeContato: null,
  })
})

test('contatoParaCobranca: veículo sem os campos de contato não quebra', () => {
  const pessoa = { nome: 'Barbara Franco', numero_corporativo: null, numero_pessoal: null }
  assert.deepEqual(contatoParaCobranca({ pessoa, veiculo: {} }), {
    telefone: null, origem: 'nenhum', nomeContato: null,
  })
})

test('podeCopiarTelefoneDoCarro: sim quando o nome bate e o colaborador está sem telefone', () => {
  const pessoa = { nome: 'Marcus Vinicius', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Marcus', contato_telefone: '19992575880' }
  assert.equal(podeCopiarTelefoneDoCarro({ pessoa, veiculo }), true)
})

test('podeCopiarTelefoneDoCarro: não quando o contato é de outra pessoa (Honda Fit/Bárbara)', () => {
  const pessoa = { nome: 'Qualquer Motorista', numero_corporativo: null, numero_pessoal: null }
  const veiculo = { contato_nome: 'Bárbara', contato_telefone: '19998086930' }
  assert.equal(podeCopiarTelefoneDoCarro({ pessoa, veiculo }), false)
})

test('podeCopiarTelefoneDoCarro: não quando o colaborador já tem telefone (não sobrescreve)', () => {
  const pessoa = { nome: 'Marcus Vinicius', numero_corporativo: '19999999999', numero_pessoal: null }
  const veiculo = { contato_nome: 'Marcus', contato_telefone: '19992575880' }
  assert.equal(podeCopiarTelefoneDoCarro({ pessoa, veiculo }), false)
})

test('podeCopiarTelefoneDoCarro: não quando não há pessoa (dono saiu do cadastro)', () => {
  const veiculo = { contato_nome: 'Marcus', contato_telefone: '19992575880' }
  assert.equal(podeCopiarTelefoneDoCarro({ pessoa: null, veiculo }), false)
})

test('podeCopiarTelefoneDoCarro: não quando o carro não tem telefone', () => {
  const pessoa = { nome: 'Marcus Vinicius', numero_corporativo: null, numero_pessoal: null }
  assert.equal(podeCopiarTelefoneDoCarro({ pessoa, veiculo: { contato_nome: 'Marcus', contato_telefone: null } }), false)
})
