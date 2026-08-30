import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSOS, TELAS_DO_GUIA, passoAtual, guiaJaVisto, marcarGuiaVisto, proximaTelaDoGuia,
} from './tutorial.js'

// ── o passo a passo ────────────────────────────────────────────────────────

test('passoAtual: sem lote nenhum, esta no passo 1', () => {
  assert.equal(passoAtual({ temLote: false, pecas: [] }), 1)
  assert.equal(passoAtual(), 1)
})

test('passoAtual: lote escolhido mas ainda sem peca carregada, continua no 1', () => {
  // a tela pede as pecas depois de escolher o lote; nesse intervalo nao da pra
  // dizer "esta gravando" — seria mentira
  assert.equal(passoAtual({ temLote: true, pecas: [] }), 1)
})

test('passoAtual: falta etiqueta, esta gravando', () => {
  const pecas = [{ gravada_em: '2026-08-30T10:00:00Z' }, { gravada_em: null }]
  assert.equal(passoAtual({ temLote: true, pecas }), 2)
})

test('passoAtual: lote inteiro gravado, esta no fim', () => {
  const pecas = [{ gravada_em: '2026-08-30T10:00:00Z' }, { gravada_em: '2026-08-30T10:01:00Z' }]
  assert.equal(passoAtual({ temLote: true, pecas }), 3)
})

test('passoAtual: uma peca so, ainda por gravar', () => {
  assert.equal(passoAtual({ temLote: true, pecas: [{ gravada_em: null }] }), 2)
})

test('PASSOS: sao tres, numerados de 1 a 3, cada um com titulo e resumo', () => {
  assert.equal(PASSOS.length, 3)
  PASSOS.forEach((p, i) => {
    assert.equal(p.n, i + 1)
    assert.ok(p.titulo.length > 3, 'o passo precisa ter titulo')
    assert.ok(p.resumo.length > 20, 'o resumo tem de explicar, nao rotular')
  })
})

// ── o guia da primeira vez ─────────────────────────────────────────────────

test('TELAS_DO_GUIA: cinco telas, todas com texto que explica', () => {
  assert.equal(TELAS_DO_GUIA.length, 5)
  TELAS_DO_GUIA.forEach((t) => {
    assert.ok(t.titulo.length > 3)
    assert.ok(t.texto.length > 60, 'texto curto demais nao ensina nada')
  })
})

test('TELAS_DO_GUIA: a de ONDE A ETIQUETA VAI avisa do metal', () => {
  // e o erro que estraga a peca na fabrica: NFC nao atravessa metal, e o dono
  // decidiu que a etiqueta vai costurada no forro
  const tela = TELAS_DO_GUIA.find((t) => /onde a etiqueta vai/i.test(t.titulo))
  assert.ok(tela, 'a tela do lugar da etiqueta tem de existir')
  assert.match(tela.texto, /metal/i)
  assert.match(tela.texto, /forro/i)
})

test('TELAS_DO_GUIA: a da TRAVA diz que nao tem volta', () => {
  const tela = TELAS_DO_GUIA.find((t) => /trava/i.test(t.titulo))
  assert.ok(tela, 'a tela da trava tem de existir')
  assert.match(tela.texto, /sempre|volta|descartavel|descartável/i)
})

// ── o "ja vi o guia", guardado no aparelho ─────────────────────────────────

function depositoDeMentira() {
  const caixa = new Map()
  return {
    getItem: (k) => (caixa.has(k) ? caixa.get(k) : null),
    setItem: (k, v) => caixa.set(k, String(v)),
  }
}

test('guiaJaVisto: da falso antes de qualquer coisa, verdadeiro depois de marcar', () => {
  const d = depositoDeMentira()
  assert.equal(guiaJaVisto(d), false)
  assert.equal(marcarGuiaVisto(d), true)
  assert.equal(guiaJaVisto(d), true)
})

test('guiaJaVisto: deposito que ESTOURA nao derruba a tela', () => {
  // janela anonima e "bloquear dados de sites" fazem localStorage lancar erro.
  // Sem o try/catch, a tela inteira ficaria em branco por causa de um tutorial.
  const explosivo = {
    getItem() { throw new Error('acesso negado') },
    setItem() { throw new Error('acesso negado') },
  }
  assert.equal(guiaJaVisto(explosivo), false)
  assert.equal(marcarGuiaVisto(explosivo), false)
})

test('proximaTelaDoGuia: anda ate o fim e ai devolve nulo', () => {
  assert.equal(proximaTelaDoGuia(0), 1)
  assert.equal(proximaTelaDoGuia(3), 4)
  assert.equal(proximaTelaDoGuia(4), null, 'a ultima tela fecha o guia')
})

test('proximaTelaDoGuia: entrada estranha volta para o comeco em vez de quebrar', () => {
  assert.equal(proximaTelaDoGuia(undefined), 0)
  assert.equal(proximaTelaDoGuia(-1), 0)
  assert.equal(proximaTelaDoGuia('abc'), 0)
})
