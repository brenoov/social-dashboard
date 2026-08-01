import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STATUS,
  rotuloDeStatus,
  corDeStatus,
  transicoesPermitidas,
  podeTransicionar,
  destinosEmLote,
} from './estados.js'

// ── O catálogo ──────────────────────────────────────────────────────────────

test('todo status tem chave, rotulo em portugues, cor e ordem', () => {
  for (const s of STATUS) {
    assert.ok(s.chave, 'faltou chave')
    assert.ok(s.rotulo, `faltou rotulo em ${s.chave}`)
    assert.match(s.cor, /^#[0-9a-f]{6}$/i, `cor invalida em ${s.chave}`)
    assert.equal(typeof s.ordem, 'number')
  }
})

test('as chaves batem com o CHECK da tabela conteudo_pecas', () => {
  // Se esta lista mudar, a migration precisa mudar junto — e vice-versa.
  assert.deepEqual(
    STATUS.map(s => s.chave).sort(),
    ['agendada', 'aprovada', 'arquivada', 'em_aprovacao', 'publicada', 'rascunho', 'reprovada'],
  )
})

test('nao ha ordem repetida (o kanban usaria a mesma coluna duas vezes)', () => {
  const ordens = STATUS.map(s => s.ordem)
  assert.equal(new Set(ordens).size, ordens.length)
})

test('rotuloDeStatus devolve texto legivel, e a propria chave se nao conhecer', () => {
  assert.equal(rotuloDeStatus('em_aprovacao'), 'Em aprovação')
  assert.equal(rotuloDeStatus('coisa_estranha'), 'coisa_estranha')
})

test('corDeStatus tem um cinza de reserva para chave desconhecida', () => {
  assert.match(corDeStatus('publicada'), /^#[0-9a-f]{6}$/i)
  assert.match(corDeStatus('coisa_estranha'), /^#[0-9a-f]{6}$/i)
})

// ── O grafo de transições ───────────────────────────────────────────────────

test('rascunho so vai para aprovacao ou arquivo', () => {
  assert.deepEqual(transicoesPermitidas('rascunho').sort(), ['arquivada', 'em_aprovacao'])
})

test('status desconhecido nao permite nada (falha fechada)', () => {
  assert.deepEqual(transicoesPermitidas('coisa_estranha'), [])
})

test('nenhuma transicao declarada aponta para status inexistente', () => {
  const chaves = new Set(STATUS.map(s => s.chave))
  for (const s of STATUS) {
    for (const destino of transicoesPermitidas(s.chave)) {
      assert.ok(chaves.has(destino), `${s.chave} -> ${destino} nao existe`)
    }
  }
})

test('nenhum status transiciona para si mesmo', () => {
  for (const s of STATUS) {
    assert.ok(!transicoesPermitidas(s.chave).includes(s.chave), `${s.chave} aponta para si`)
  }
})

// ── A regra de aprovar ──────────────────────────────────────────────────────

test('sem a permissao de aprovar, nao sai de em_aprovacao', () => {
  const r = podeTransicionar('em_aprovacao', 'aprovada', { podeAprovar: false })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /aprovar/i)
})

test('reprovar tambem exige a permissao de aprovar', () => {
  assert.equal(podeTransicionar('em_aprovacao', 'reprovada', { podeAprovar: false }).ok, false)
  assert.equal(podeTransicionar('em_aprovacao', 'reprovada', { podeAprovar: true }).ok, true)
})

test('com a permissao, aprovar passa', () => {
  assert.equal(podeTransicionar('em_aprovacao', 'aprovada', { podeAprovar: true }).ok, true)
})

test('devolver para rascunho NAO exige permissao de aprovar', () => {
  // Retirar da fila é desistir, não decidir. Quem enviou pode voltar atrás.
  assert.equal(podeTransicionar('em_aprovacao', 'rascunho', { podeAprovar: false }).ok, true)
})

// ── A regra da data ─────────────────────────────────────────────────────────

test('agendar sem data e recusado', () => {
  const r = podeTransicionar('aprovada', 'agendada', { podeAprovar: true, temData: false })
  assert.equal(r.ok, false)
  assert.match(r.motivo, /data|hor/i)
})

test('agendar com data passa', () => {
  assert.equal(podeTransicionar('aprovada', 'agendada', { temData: true }).ok, true)
})

test('so agenda o que ja foi aprovado', () => {
  assert.equal(podeTransicionar('rascunho', 'agendada', { temData: true, podeAprovar: true }).ok, false)
})

// ── Recusas gerais ──────────────────────────────────────────────────────────

test('transicao fora do grafo e recusada com motivo em portugues', () => {
  const r = podeTransicionar('publicada', 'rascunho', { podeAprovar: true })
  assert.equal(r.ok, false)
  assert.ok(r.motivo.length > 10)
  assert.ok(!/undefined|null/.test(r.motivo))
})

test('opcoes ausentes nao quebram: assume o mais restritivo', () => {
  assert.equal(podeTransicionar('em_aprovacao', 'aprovada').ok, false)
  assert.equal(podeTransicionar('aprovada', 'agendada').ok, false)
})

test('publicada so pode ser arquivada', () => {
  assert.deepEqual(transicoesPermitidas('publicada'), ['arquivada'])
})

test('agendada pode voltar para aprovada (desagendar) e ir para publicada', () => {
  const t = transicoesPermitidas('agendada')
  assert.ok(t.includes('publicada'))
  assert.ok(t.includes('aprovada'))
})

// ---------- acoes em lote ----------
//
// A regra e a INTERSECAO: um destino so aparece se TODAS as pecas puderem ir
// para la. Oferecer o que serve para metade produziria meia operacao e um erro
// no meio — pior que nao oferecer.

test('em lote, so aparece o que serve para TODAS', () => {
  const d = destinosEmLote([
    { status: 'rascunho' },
    { status: 'em_aprovacao' },
  ], { podeAprovar: true }).map(x => x.chave)
  // rascunho vai para em_aprovacao/arquivada; em_aprovacao vai para
  // aprovada/reprovada/rascunho. O unico comum e 'arquivada'.
  assert.ok(!d.includes('em_aprovacao'), 'em_aprovacao nao serve para quem ja esta la')
  assert.ok(!d.includes('aprovada'), 'aprovada nao serve para um rascunho')
})

test('pecas no MESMO estado oferecem os destinos daquele estado', () => {
  const d = destinosEmLote([
    { status: 'em_aprovacao' }, { status: 'em_aprovacao' },
  ], { podeAprovar: true }).map(x => x.chave)
  assert.ok(d.includes('aprovada'))
  assert.ok(d.includes('reprovada'))
})

test('sem permissao de aprovar, aprovar NAO aparece no lote', () => {
  const d = destinosEmLote([{ status: 'em_aprovacao' }], { podeAprovar: false }).map(x => x.chave)
  assert.ok(!d.includes('aprovada'))
})

test('agendar em lote exige que TODAS tenham data', () => {
  const comData = { status: 'aprovada', publicar_em: '2026-08-03T12:00:00Z' }
  const semData = { status: 'aprovada', publicar_em: null }
  assert.ok(destinosEmLote([comData], { podeAprovar: true }).some(d => d.chave === 'agendada'))
  assert.ok(
    !destinosEmLote([comData, semData], { podeAprovar: true }).some(d => d.chave === 'agendada'),
    'uma peca sem data tira o destino de todo o lote',
  )
})

test('selecao vazia nao oferece nada', () => {
  for (const v of [[], null, undefined, [null]]) {
    assert.deepEqual(destinosEmLote(v), [])
  }
})

test('peca publicada num lote misto derruba quase tudo', () => {
  // Publicada so vai para arquivada; qualquer lote com ela fica limitado.
  const d = destinosEmLote([
    { status: 'publicada' }, { status: 'rascunho' },
  ], { podeAprovar: true }).map(x => x.chave)
  assert.deepEqual(d, ['arquivada'])
})

test('cada destino vem com rotulo e cor para a tela', () => {
  const d = destinosEmLote([{ status: 'rascunho' }], { podeAprovar: true })
  for (const x of d) {
    assert.ok(x.rotulo && x.rotulo !== x.chave, `sem rotulo legivel: ${JSON.stringify(x)}`)
    assert.match(x.cor, /^#/, `sem cor: ${JSON.stringify(x)}`)
  }
})
