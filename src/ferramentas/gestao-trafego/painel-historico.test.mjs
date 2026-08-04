import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarPainelHistorico, marcarQuemPodeApagar } from './painel-historico.js'
import { montarHistorico } from './rascunhos.js'

// Alvo de mentira: o painel só precisa de innerHTML e querySelectorAll.
const alvoFalso = () => {
  const a = { innerHTML: '', botoes: [] }
  a.querySelectorAll = (sel) => {
    // Só o suficiente para achar os botões pelo atributo, sem DOM de verdade.
    const attr = /data-continuar/.test(sel) ? 'data-continuar' : 'data-apagar'
    const re = new RegExp(attr + '="([^"]*)"', 'g')
    const achados = []
    let m
    while ((m = re.exec(a.innerHTML))) {
      // O valor é COPIADO aqui: `m` é reatribuído a cada volta, e uma seta que
      // lesse `m[1]` devolveria sempre o último id da lista.
      const v = m[1]
      achados.push({ valor: v, getAttribute: () => v })
    }
    a.botoes.push(...achados)
    return achados
  }
  return a
}
const monta = (o) => { const a = alvoFalso(); montarPainelHistorico(a, o); return a }

const AGORA = new Date('2026-08-04T12:00:00-03:00')
const cru = (extra) => ({
  id: 'r1', nome: 'Campanha de agosto', tipo: 'Conversa no WhatsApp',
  status: 'rascunho', passo: 2, updated_at: '2026-08-04T10:00:00-03:00',
  criado_por: 'eu', ...extra,
})

// ── O que a Meta escreveu NÃO pode virar HTML ───────────────────────────────

test('o motivo da recusa vem da META e sai escapado', () => {
  // É o texto mais perigoso desta tela: ninguém revisa a mensagem de erro antes
  // de ela virar innerHTML.
  const linhas = montarHistorico([cru({
    status: 'falhou',
    resultado: { erro: '<img src=x onerror="alert(1)">Invalid parameter' },
  })], AGORA)
  const html = monta({ linhas }).innerHTML
  assert.ok(!html.includes('<img src=x'), 'a tag não pode sair viva')
  assert.ok(html.includes('&lt;img src=x'), 'mas o texto sai — o dono precisa ler o motivo')
})

test('nome digitado por gente tambem e escapado', () => {
  const linhas = montarHistorico([cru({ nome: '"><script>x</script>' })], AGORA)
  const html = monta({ linhas }).innerHTML
  assert.ok(!html.includes('<script>x'))
})

test('o id vai pra dentro de um atributo, e nao pode escapar dele', () => {
  const linhas = marcarQuemPodeApagar(
    montarHistorico([cru({ id: 'a" onclick="alert(1)' })], AGORA),
    [cru({ id: 'a" onclick="alert(1)' })], 'eu',
  )
  const html = monta({ linhas }).innerHTML
  assert.ok(!html.includes('" onclick="alert(1)"'), 'aspas do id não podem fechar o atributo')
})

// ── O que a lista mostra ────────────────────────────────────────────────────

test('rascunho oferece continuar; criada e recusada, nao', () => {
  const linhas = montarHistorico([
    cru({ id: 'a', status: 'rascunho' }),
    cru({ id: 'b', status: 'criada' }),
    cru({ id: 'c', status: 'falhou', resultado: { erro: 'não deu' } }),
  ], AGORA)
  const html = monta({ linhas }).innerHTML
  assert.ok(html.includes('data-continuar="a"'))
  assert.ok(!html.includes('data-continuar="b"'), 'campanha já criada não se continua')
  assert.ok(!html.includes('data-continuar="c"'))
})

test('"parou no passo N" so aparece em rascunho', () => {
  // Numa campanha criada inteira, isso seria mentira.
  const html = monta({ linhas: montarHistorico([cru({ status: 'criada' })], AGORA) }).innerHTML
  assert.ok(!/parou no passo/.test(html))
  const outro = monta({ linhas: montarHistorico([cru({ status: 'rascunho' })], AGORA) }).innerHTML
  assert.ok(/parou no passo 3/.test(outro), 'passo 2 guardado é o 3º pra quem lê')
})

test('o motivo da recusa fica ABERTO, sem precisar clicar', () => {
  const linhas = montarHistorico([cru({ status: 'falhou', resultado: { erro: 'número não ligado à conta' } })], AGORA)
  assert.ok(monta({ linhas }).innerHTML.includes('número não ligado à conta'))
})

test('lista vazia explica, em vez de ficar em branco', () => {
  const html = monta({ linhas: [] }).innerHTML
  assert.match(html, /Nenhuma campanha começada/)
})

test('erro de leitura aparece na tela, e nao no console', () => {
  // A lição do buscador de publicações: `catch` mudo custou meia hora de caça.
  const html = monta({ erro: 'sem permissão' }).innerHTML
  assert.match(html, /Não consegui ler o histórico: sem permissão/)
})

test('enquanto busca, diz que esta buscando', () => {
  assert.match(monta({ carregando: true }).innerHTML, /Buscando/)
})

// ── Apagar só o que é seu ───────────────────────────────────────────────────

test('so o dono da linha ve o botao de apagar', () => {
  // Ler o histórico é do time inteiro (é a memória da conta). Apagar o rascunho
  // de outra pessoa, não — e o RLS recusaria em silêncio, o que é pior.
  const cruas = [cru({ id: 'meu', criado_por: 'eu' }), cru({ id: 'dela', criado_por: 'outra' })]
  const linhas = marcarQuemPodeApagar(montarHistorico(cruas, AGORA), cruas, 'eu')
  const html = monta({ linhas }).innerHTML
  assert.ok(html.includes('data-apagar="meu"'))
  assert.ok(!html.includes('data-apagar="dela"'))
})

test('sem usuario nenhum, ninguem apaga nada', () => {
  const cruas = [cru({ id: 'x', criado_por: 'eu' })]
  const linhas = marcarQuemPodeApagar(montarHistorico(cruas, AGORA), cruas, null)
  assert.ok(!monta({ linhas }).innerHTML.includes('data-apagar'))
})

// ── Os cliques chegam ───────────────────────────────────────────────────────

test('clicar em continuar devolve o id da linha', () => {
  const linhas = montarHistorico([cru({ id: 'r7' })], AGORA)
  let recebido = null
  const a = alvoFalso()
  montarPainelHistorico(a, { linhas, aoContinuar: (id) => { recebido = id } })
  a.botoes.find((b) => b.valor === 'r7').onclick()
  assert.equal(recebido, 'r7')
})

test('sem callback, clicar nao estoura', () => {
  const linhas = marcarQuemPodeApagar(montarHistorico([cru()], AGORA), [cru()], 'eu')
  const a = alvoFalso()
  montarPainelHistorico(a, { linhas })
  for (const b of a.botoes) b.onclick()
})
