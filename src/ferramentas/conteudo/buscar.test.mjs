import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizar, filtrarPecas, filtrarIdeias } from './buscar.js'

const PECAS = [
  { id: '1', titulo: 'Bastidor da vitrine nova', legenda: 'Montamos tudo em três horas.', hashtags: '#loja #vitrine' },
  { id: '2', titulo: 'Promoção de São João', legenda: 'Só até sábado.', observacoes: 'conferir estoque' },
  { id: '3', titulo: 'Reels do produto', legenda: null },
]

const IDEIAS = [
  {
    id: 'a', titulo: 'Quem é o Breno', gancho: 'Deixa eu me apresentar', pilar: 'bastidor',
    roteiro: [{ cena: 1, imagem: 'close no rosto', narracao: 'meu nome é Breno' }],
    cta: 'Me segue',
  },
  { id: 'b', titulo: 'O erro da marca pessoal', gancho: 'falar de tudo', formato: 'reels', roteiro: [] },
  { id: 'c', titulo: 'Antigo', roteiro: [{ cena: 1, fala: 'texto no formato velho' }] },
]

// ---------- normalizar ----------

test('tira acento e caixa', () => {
  assert.equal(normalizar('São João'), 'sao joao')
  assert.equal(normalizar('  PROMOÇÃO  '), 'promocao')
})

test('normalizar aguenta lixo', () => {
  for (const v of [null, undefined, 42, {}, []]) assert.equal(normalizar(v), '')
})

// ---------- busca em pecas ----------

test('acha por titulo', () => {
  assert.deepEqual(filtrarPecas(PECAS, 'vitrine').map(p => p.id), ['1'])
})

test('acha por legenda', () => {
  assert.deepEqual(filtrarPecas(PECAS, 'sabado').map(p => p.id), ['2'])
})

test('acha por hashtag e por observacao', () => {
  assert.deepEqual(filtrarPecas(PECAS, '#loja').map(p => p.id), ['1'])
  assert.deepEqual(filtrarPecas(PECAS, 'estoque').map(p => p.id), ['2'])
})

test('busca sem acento acha texto com acento', () => {
  // O teclado do celular decide sozinho se põe acento — a busca não pode
  // depender disso.
  assert.deepEqual(filtrarPecas(PECAS, 'sao joao').map(p => p.id), ['2'])
  assert.deepEqual(filtrarPecas(PECAS, 'promocao').map(p => p.id), ['2'])
})

test('todas as palavras precisam aparecer, em qualquer ordem', () => {
  assert.deepEqual(filtrarPecas(PECAS, 'vitrine bastidor').map(p => p.id), ['1'])
  assert.deepEqual(filtrarPecas(PECAS, 'bastidor vitrine').map(p => p.id), ['1'])
  assert.deepEqual(filtrarPecas(PECAS, 'vitrine promocao'), [], 'palavras de pecas diferentes nao casam')
})

test('as palavras podem estar em campos diferentes', () => {
  // "vitrine" no titulo e "horas" na legenda, na mesma peca.
  assert.deepEqual(filtrarPecas(PECAS, 'vitrine horas').map(p => p.id), ['1'])
})

test('termo vazio devolve tudo, sem filtrar', () => {
  for (const t of ['', '   ', null, undefined]) {
    assert.equal(filtrarPecas(PECAS, t).length, PECAS.length)
  }
})

test('peca com campos nulos nao quebra a busca', () => {
  assert.doesNotThrow(() => filtrarPecas([{ id: 'x' }, null, {}], 'qualquer'))
  assert.deepEqual(filtrarPecas([{ id: 'x' }, null], 'qualquer'), [])
})

test('lista invalida devolve lista vazia', () => {
  for (const v of [null, undefined, 'texto', 42]) assert.deepEqual(filtrarPecas(v, 'x'), [])
})

// ---------- busca em ideias ----------

test('acha ideia por titulo e por gancho', () => {
  assert.deepEqual(filtrarIdeias(IDEIAS, 'breno').map(i => i.id), ['a'])
  assert.deepEqual(filtrarIdeias(IDEIAS, 'apresentar').map(i => i.id), ['a'])
})

test('acha ideia por texto DENTRO do roteiro', () => {
  // Quem procura pode estar lembrando de uma fala do take 3, nao do titulo.
  assert.deepEqual(filtrarIdeias(IDEIAS, 'close no rosto').map(i => i.id), ['a'])
})

test('acha no roteiro antigo, que usa `fala`', () => {
  assert.deepEqual(filtrarIdeias(IDEIAS, 'formato velho').map(i => i.id), ['c'])
})

test('acha por pilar e por formato', () => {
  assert.deepEqual(filtrarIdeias(IDEIAS, 'bastidor').map(i => i.id), ['a'])
  assert.deepEqual(filtrarIdeias(IDEIAS, 'reels').map(i => i.id), ['b'])
})

test('ideia sem roteiro nao quebra', () => {
  assert.doesNotThrow(() => filtrarIdeias([{ titulo: 'x' }, { roteiro: null }, {}], 'x'))
})
