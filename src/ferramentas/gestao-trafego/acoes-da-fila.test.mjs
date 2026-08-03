import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opcoesDaLinha, passoDoRobo, frasePasso, PASSO_PADRAO, MINIMO_CENTAVOS } from './acoes-da-fila.js'

// R$ 50/dia, robô mandando subir para R$ 62,50 (+25%).
const ESCALAR = { veredito: 'escalar', budget_atual_centavos: 5000, budget_sugerido_centavos: 6250 }
// R$ 100/dia, robô mandando baixar para R$ 60 (-40%).
const REDUZIR = { veredito: 'reduzir', budget_atual_centavos: 10000, budget_sugerido_centavos: 6000 }

// ── O passo espelhado ───────────────────────────────────────────────────────

test('o passo sai da distancia que o ROBO propos', () => {
  assert.equal(Math.round(passoDoRobo(ESCALAR) * 100), 25)
  assert.equal(Math.round(passoDoRobo(REDUZIR) * 100), 40)
})

test('sem sugestao do robo nao ha o que espelhar', () => {
  assert.equal(passoDoRobo({ budget_atual_centavos: 5000 }), null)
  assert.equal(passoDoRobo({ budget_atual_centavos: 5000, budget_sugerido_centavos: 0 }), null)
  assert.equal(passoDoRobo(null), null)
})

test('sugestao IGUAL ao valor de hoje nao e passo', () => {
  // Seria oferecer "subir para o mesmo valor" — um botão que não faz nada.
  assert.equal(passoDoRobo({ budget_atual_centavos: 5000, budget_sugerido_centavos: 5000 }), null)
})

// ── As três escolhas ────────────────────────────────────────────────────────

test('as tres aparecem sempre, e o lado do robo leva o valor DELE inteiro', () => {
  const o = opcoesDaLinha(ESCALAR)
  // Recalcular pelo percentual arredondado daria um número diferente do que o
  // robô propôs, e a linha mostraria "→ R$ 62,50" com o botão dizendo R$ 62,49.
  assert.equal(o.subir.alvoCentavos, 6250)
  assert.equal(o.baixar.alvoCentavos, 3750, 'espelho: -25% de R$ 50')
  assert.ok(o.manter)
  assert.equal(o.recomendada, 'subir')
})

test('quando o robo manda BAIXAR, o espelho sobe pela mesma distancia', () => {
  const o = opcoesDaLinha(REDUZIR)
  assert.equal(o.baixar.alvoCentavos, 6000, 'o valor do robô, inteiro')
  assert.equal(o.subir.alvoCentavos, 14000, '+40% de R$ 100')
  assert.equal(o.recomendada, 'baixar')
})

test('sem sugestao do robo, cai no passo padrao E AVISA que caiu', () => {
  const o = opcoesDaLinha({ veredito: 'pausar', budget_atual_centavos: 10000 })
  assert.equal(o.passoPadrao, true)
  assert.equal(o.passo, PASSO_PADRAO)
  assert.equal(o.subir.alvoCentavos, 12000)
  assert.equal(o.baixar.alvoCentavos, 8000)
  assert.equal(o.recomendada, null, 'pausar não é nem subir nem baixar')
  assert.match(frasePasso(o), /não sugeriu um valor/)
})

test('campanha sem orcamento conhecido so pode MANTER', () => {
  for (const item of [{ veredito: 'reduzir' }, { budget_atual_centavos: 0 }, null]) {
    const o = opcoesDaLinha(item)
    assert.equal(o.subir, null)
    assert.equal(o.baixar, null)
    assert.ok(o.manter, 'nunca mexer é sempre possível')
  }
})

// ── O piso ──────────────────────────────────────────────────────────────────

test('o piso impede oferecer um valor que a Meta recusaria', () => {
  // R$ 6/dia com passo de 50% ofereceria "baixar para R$ 3", e o dono só
  // descobriria a recusa depois de aprovar.
  const o = opcoesDaLinha({ veredito: 'reduzir', budget_atual_centavos: 600, budget_sugerido_centavos: 300 })
  assert.equal(o.baixar.alvoCentavos, MINIMO_CENTAVOS)
  assert.equal(o.baixar.noPiso, true, 'a tela precisa saber que o piso mordeu')
})

test('acima do piso, nada e marcado', () => {
  assert.equal(opcoesDaLinha(ESCALAR).baixar.noPiso, false)
})

// ── O impacto escrito ───────────────────────────────────────────────────────

test('o impacto fala em DIA e em MES — o mensal e o que a pessoa sente', () => {
  const o = opcoesDaLinha(ESCALAR)
  assert.match(o.subir.impacto, /De R\$\s?50,00 para R\$\s?62,50 por dia \(\+25%\)/)
  assert.match(o.subir.impacto, /No mês, cerca de R\$\s?375,00 a mais/)
  assert.match(o.baixar.impacto, /R\$\s?375,00 a menos/)
})

test('manter diz as DUAS consequencias: nada muda, e a sugestao volta', () => {
  // Sem a segunda, "manter" parece desligar o aviso para sempre.
  const m = opcoesDaLinha(ESCALAR).manter
  assert.match(m.impacto, /Nada muda no orçamento/)
  assert.match(m.impacto, /volta a aparecer daqui a 7 dias/)
})

test('o rotulo do botao ja diz o valor — ler o botao basta', () => {
  const o = opcoesDaLinha(ESCALAR)
  assert.match(o.subir.rotulo, /^Subir para R\$\s?62,50$/)
  assert.match(o.baixar.rotulo, /^Baixar para R\$\s?37,50$/)
  assert.equal(o.manter.rotulo, 'Manter como está')
})

test('a frase do passo aparece uma vez, e conta a verdade sobre a origem', () => {
  assert.match(frasePasso(opcoesDaLinha(ESCALAR)), /25%, o mesmo tamanho de passo que o robô propôs/)
  assert.equal(frasePasso(opcoesDaLinha({ veredito: 'reduzir' })), '', 'sem botões, sem frase')
})

test('valor torto nao vira NaN na tela', () => {
  const o = opcoesDaLinha({ veredito: 'escalar', budget_atual_centavos: 'x', budget_sugerido_centavos: 'y' })
  assert.equal(o.subir, null)
  assert.ok(!/NaN/.test(JSON.stringify(o)))
})

// ── O IMPACTO ESCRITO PELA IA ───────────────────────────────────────────────
//
// O pedido do dono: "não é pra falar só de orçamento, quero um detalhamento de
// impacto real, o que acontecerá com as métricas... senão conta de porcentagem
// eu mesmo fazia". A conta continua existindo — mas como apoio, e dizendo que é.

const COM_IA = {
  ...ESCALAR,
  impactos: {
    subir: 'Com o custo por conversa 32% abaixo da meta, o volume deve subir junto sem piorar o custo; a frequência está em 1,8× e ainda há espaço de audiência.',
    baixar: 'Cortar aqui devolve alcance que está barato e o custo por conversa tende a piorar, porque a campanha sai da faixa de entrega estável.',
    manter: 'A campanha segue entregando abaixo da meta, mas sem aproveitar o espaço — o resultado fica parado no volume de hoje.',
  },
};

test('o texto da IA MANDA sobre a conta', () => {
  const o = opcoesDaLinha(COM_IA)
  assert.match(o.subir.impacto, /frequência está em 1,8×/)
  assert.equal(o.subir.daIA, true)
  assert.match(o.baixar.impacto, /custo por conversa tende a piorar/)
  assert.match(o.manter.impacto, /sem aproveitar o espaço/)
})

test('a conta NAO some — vira a linha de apoio', () => {
  // O valor mensal é o que a pessoa sente; ele só deixa de ser a manchete.
  const o = opcoesDaLinha(COM_IA)
  assert.match(o.subir.conta, /No mês, cerca de R\$\s?375,00 a mais/)
  assert.notEqual(o.subir.conta, o.subir.impacto)
})

test('sem texto da IA, cai na conta E MARCA que caiu', () => {
  // `daIA: false` é o que deixa a tela avisar "isto é só a conta". Vender
  // multiplicação como análise seria pior que não ter o bloco.
  const o = opcoesDaLinha(ESCALAR)
  assert.equal(o.subir.daIA, false)
  assert.equal(o.manter.daIA, false)
  assert.equal(o.subir.impacto, o.subir.conta)
})

test('texto vazio ou torto conta como AUSENTE, nao como impacto', () => {
  const o = opcoesDaLinha({ ...ESCALAR, impactos: { subir: '   ', baixar: 42, manter: null } })
  assert.equal(o.subir.daIA, false)
  assert.equal(o.baixar.daIA, false)
})

test('a IA pode escrever so um dos tres — os outros caem na conta', () => {
  const o = opcoesDaLinha({ ...ESCALAR, impactos: { baixar: 'Perde alcance barato.' } })
  assert.equal(o.baixar.daIA, true)
  assert.equal(o.subir.daIA, false)
})
