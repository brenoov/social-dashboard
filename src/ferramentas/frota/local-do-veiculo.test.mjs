import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dadosDoLocal, insertDaArvore } from './local-do-veiculo.js'

/* Os dados são os reais da base: 5 dos 9 carros têm texto escrito à mão em
 * `local_texto` — "Casa RB" (BMW X1, Porsche Cayenne, Volvo XC90), "Conchal"
 * (Fiat Doblo) e "Barracão" (Honda Fit). Nenhum deles tem `local_id`. */

// ── A regra que manda: o texto antigo não some ──────────────────────────────

test('apontar o local NÃO apaga o texto que estava escrito à mão', () => {
  const d = dadosDoLocal({
    localId: 'uuid-fabrica-conchal-vessel',
    textoAntigo: 'Conchal',
  })
  assert.equal(d.local_id, 'uuid-fabrica-conchal-vessel')
  assert.equal(d.local_texto, 'Conchal', 'a única pista de onde o carro estava sumiria pra sempre')
})

test('o texto antigo continua guardado mesmo com local E ambiente escolhidos', () => {
  const d = dadosDoLocal({
    empresaId: 'uuid-rbv', localId: 'uuid-sede-limeira', comodoId: 'uuid-garagem',
    textoAntigo: 'Casa RB',
  })
  assert.equal(d.local_texto, 'Casa RB')
  assert.equal(d.comodo_id, 'uuid-garagem')
})

test('texto antigo é devolvido sem mexer no conteúdo (nem caixa, nem acento)', () => {
  assert.equal(dadosDoLocal({ textoAntigo: 'Barracão' }).local_texto, 'Barracão')
  assert.equal(dadosDoLocal({ textoAntigo: 'Casa RB' }).local_texto, 'Casa RB')
})

test('sem texto antigo, a coluna vai nula — não vai string vazia', () => {
  assert.equal(dadosDoLocal({ localId: 'uuid-x', textoAntigo: '' }).local_texto, null)
  assert.equal(dadosDoLocal({ localId: 'uuid-x' }).local_texto, null)
})

// ── De quem é ≠ onde fica ───────────────────────────────────────────────────

test('a empresa NÃO é deduzida do local escolhido', () => {
  // O carro é da RBV Company e está guardado num local da Vessel. É o caso que
  // o dono descreveu, e tem de sobreviver ao gravar.
  const d = dadosDoLocal({
    empresaId: 'uuid-rbv-company',
    localId: 'uuid-fabrica-conchal-DA-VESSEL',
  })
  assert.equal(d.empresa_id, 'uuid-rbv-company')
  assert.equal(d.local_id, 'uuid-fabrica-conchal-DA-VESSEL')
})

test('escolher só o local não inventa empresa nenhuma', () => {
  const d = dadosDoLocal({ localId: 'uuid-fabrica-conchal-vessel' })
  assert.equal(d.empresa_id, null)
})

test('dizer a empresa não obriga a dizer o local', () => {
  const d = dadosDoLocal({ empresaId: 'uuid-vessel' })
  assert.equal(d.empresa_id, 'uuid-vessel')
  assert.equal(d.local_id, null)
})

// ── Ambiente sem local é dado quebrado ──────────────────────────────────────

test('ambiente sem local não é gravado', () => {
  const d = dadosDoLocal({ localId: '', comodoId: 'uuid-sala-de-reuniao' })
  assert.equal(d.local_id, null)
  assert.equal(d.comodo_id, null, 'apontaria uma sala sem dizer de qual prédio')
})

test('limpar o local leva o ambiente junto', () => {
  const d = dadosDoLocal({ localId: null, comodoId: 'uuid-garagem', textoAntigo: 'Casa RB' })
  assert.equal(d.comodo_id, null)
  assert.equal(d.local_texto, 'Casa RB', 'limpar o local ainda assim não apaga o texto')
})

test('ficha nunca preenchida vai toda nula, sem string vazia em lugar nenhum', () => {
  const d = dadosDoLocal({ empresaId: '', localId: '', comodoId: '', textoAntigo: '' })
  assert.deepEqual(d, { empresa_id: null, local_id: null, comodo_id: null, local_texto: null })
})

test('devolve sempre as quatro colunas, e só elas', () => {
  const d = dadosDoLocal({ localId: 'uuid-x' })
  assert.deepEqual(Object.keys(d).sort(), ['comodo_id', 'empresa_id', 'local_id', 'local_texto'])
})

// ── O "+" da árvore ─────────────────────────────────────────────────────────

test('marca nova vai pra patrimonio_empresas, sem pai', () => {
  assert.deepEqual(insertDaArvore({ nivel: 'marca', nome: 'Vessel' }), {
    tabela: 'patrimonio_empresas',
    dados: { nome: 'Vessel' },
  })
})

test('local novo nasce ligado à marca', () => {
  assert.deepEqual(insertDaArvore({ nivel: 'local', nome: 'Barracão', empresaId: 'uuid-rbb' }), {
    tabela: 'patrimonio_locais',
    dados: { nome: 'Barracão', empresa_id: 'uuid-rbb' },
  })
})

test('ambiente novo nasce ligado ao local', () => {
  assert.deepEqual(insertDaArvore({ nivel: 'ambiente', nome: 'Garagem', localId: 'uuid-conchal' }), {
    tabela: 'patrimonio_comodos',
    dados: { nome: 'Garagem', local_id: 'uuid-conchal' },
  })
})

test('local sem marca não é criado — nasceria órfão na árvore de todo mundo', () => {
  assert.equal(insertDaArvore({ nivel: 'local', nome: 'Barracão' }), null)
  assert.equal(insertDaArvore({ nivel: 'local', nome: 'Barracão', empresaId: '' }), null)
})

test('ambiente sem local não é criado', () => {
  assert.equal(insertDaArvore({ nivel: 'ambiente', nome: 'Garagem' }), null)
})

test('o pai do local é a marca, e o do ambiente é o local — nunca trocados', () => {
  // Mandar localId num nível 'local' não pode virar pai por engano.
  assert.equal(insertDaArvore({ nivel: 'local', nome: 'X', localId: 'uuid-qualquer' }), null)
  assert.equal(insertDaArvore({ nivel: 'ambiente', nome: 'X', empresaId: 'uuid-qualquer' }), null)
})

test('nome em branco não vira cadastro', () => {
  assert.equal(insertDaArvore({ nivel: 'marca', nome: '   ' }), null)
  assert.equal(insertDaArvore({ nivel: 'marca', nome: '' }), null)
  assert.equal(insertDaArvore({ nivel: 'marca' }), null)
})

test('nome vai aparado, pra não nascer " Vessel " ao lado de "Vessel"', () => {
  assert.equal(insertDaArvore({ nivel: 'marca', nome: '  Vessel  ' }).dados.nome, 'Vessel')
})

test('nível desconhecido não escolhe tabela no chute', () => {
  assert.equal(insertDaArvore({ nivel: 'categoria', nome: 'X' }), null)
  assert.equal(insertDaArvore({ nome: 'X' }), null)
  assert.equal(insertDaArvore(), null)
})
