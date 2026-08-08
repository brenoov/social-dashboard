import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoDasCopias, fraseDoQuadro, nomeDaLinha } from './copias-no-zoho.js'

const VEICULOS = [
  { id: 'v-fiesta', nome: 'FORD FIESTA SEDAN' },
  { id: 'v-punto', nome: 'FIAT PUNTO ESSENCE 1.6' },
]
const FICHAS = [
  { id: 'c-1', veiculo_id: 'v-fiesta' },
  { id: 'c-2', veiculo_id: 'v-punto' },
]

// A frase real que o robô grava quando o Zoho está desconectado. Ela vai pra
// tela COMO ESTÁ: é ela que diz o que fazer, e o conserto é de trinta segundos.
const ZOHO_FORA = 'A central não está conectada ao Zoho. Abra Acessos → Zoho e clique em '
  + 'conectar; os PDFs que estão esperando sobem sozinhos na rodada seguinte.'

/* ── O estado de hoje: zero ficha assinada, zero linha ─────────────────────── */

test('vazio: nada assinado ainda — explica o que vai acontecer, não parece defeito', () => {
  const r = resumoDasCopias({ linhas: [], entregues: 0, fichas: [], veiculos: [] })
  assert.equal(r.temProblema, false)
  assert.equal(r.esperando, 0)
  assert.equal(r.desistidas, 0)
  assert.deepEqual(r.grupos, [])
  assert.match(r.frase, /Nenhuma ficha foi assinada ainda/)
  // Nada de "erro", "falha" ou "problema" numa tela onde não houve nenhum.
  assert.doesNotMatch(r.frase, /erro|falha|problema/i)
})

test('vazio: tudo já entregue — uma linha só, e nada de vermelho', () => {
  const r = resumoDasCopias({ linhas: [], entregues: 12 })
  assert.equal(r.temProblema, false)
  assert.equal(r.frase, 'As 12 cópias das fichas assinadas já estão na pasta do Zoho.')
})

/* ── Esperar NÃO é problema ────────────────────────────────────────────────── */

test('assinada há dois minutos: esperando é o relógio, não defeito', () => {
  const r = resumoDasCopias({
    linhas: [{ checklist_id: 'c-1', situacao: 'na_fila', ultimo_erro: null }],
    entregues: 3, fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.esperando, 1)
  assert.equal(r.desistidas, 0)
  assert.equal(r.tropecos, 0)
  // O ponto inteiro do teste: quadro sem grupo nenhum = quadro que não cresce.
  assert.equal(r.temProblema, false)
  assert.deepEqual(r.grupos, [])
  assert.match(r.frase, /esperando a vez/)
})

test('`enviando` limpo conta como esperando, igual a `na_fila`', () => {
  const r = resumoDasCopias({
    linhas: [{ checklist_id: 'c-1', situacao: 'enviando', ultimo_erro: '  ' }],
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.esperando, 1)
  assert.equal(r.temProblema, false)
})

/* ── Tropeçou: aparece, mas o robô ainda está cuidando ─────────────────────── */

test('erro escrito e ainda na fila: mostra a frase do robô, sem chamar de desistência', () => {
  const r = resumoDasCopias({
    linhas: [{ checklist_id: 'c-1', situacao: 'na_fila', ultimo_erro: ZOHO_FORA }],
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.tropecos, 1)
  assert.equal(r.desistidas, 0)
  assert.equal(r.esperando, 0)
  assert.equal(r.grupos.length, 1)
  assert.equal(r.grupos[0].gravidade, 'tentando')
  // O texto do banco chega inteiro na tela — sem resumo, sem "erro ao enviar".
  assert.equal(r.grupos[0].mensagem, ZOHO_FORA)
  assert.deepEqual(r.grupos[0].veiculos, ['FORD FIESTA SEDAN'])
  assert.match(r.grupos[0].titulo, /continua tentando sozinho/)
})

/* ── Desistiu: aí sim precisa de gente ─────────────────────────────────────── */

test('desistida vem antes da que ainda está tentando', () => {
  const r = resumoDasCopias({
    linhas: [
      { checklist_id: 'c-1', situacao: 'na_fila', ultimo_erro: 'Tropeço qualquer.' },
      { checklist_id: 'c-2', situacao: 'falhou', ultimo_erro: ZOHO_FORA },
    ],
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.grupos.length, 2)
  assert.equal(r.grupos[0].gravidade, 'desistiu')
  assert.equal(r.grupos[1].gravidade, 'tentando')
  assert.equal(r.desistidas, 1)
  assert.equal(r.tropecos, 1)
})

test('mesma causa em vários carros vira UM grupo com a frase uma vez só', () => {
  const r = resumoDasCopias({
    linhas: [
      { checklist_id: 'c-1', situacao: 'falhou', ultimo_erro: ZOHO_FORA },
      { checklist_id: 'c-2', situacao: 'falhou', ultimo_erro: ZOHO_FORA },
    ],
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.grupos.length, 1)
  assert.equal(r.grupos[0].quantos, 2)
  assert.deepEqual(r.grupos[0].veiculos, ['FORD FIESTA SEDAN', 'FIAT PUNTO ESSENCE 1.6'])
  assert.match(r.grupos[0].titulo, /^2 cópias que o robô tentou várias vezes e parou:$/)
})

test('sem motivo escrito não vira grupo mudo', () => {
  const r = resumoDasCopias({
    linhas: [{ checklist_id: 'c-1', situacao: 'falhou', ultimo_erro: null }],
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(r.grupos.length, 1)
  assert.match(r.grupos[0].mensagem, /não escreveu o motivo/)
})

/* ── Nome da linha: nunca inventa, nunca some ──────────────────────────────── */

test('ficha fora da janela de 120 dias mostra a data, não um traço', () => {
  const nome = nomeDaLinha({
    linha: { checklist_id: 'sumida', criado_em: '2026-03-12T14:00:00Z' },
    fichas: FICHAS, veiculos: VEICULOS,
  })
  assert.equal(nome, 'Ficha assinada em 12/03/2026')
})

test('sem carro e sem data ainda diz alguma coisa', () => {
  assert.equal(nomeDaLinha({ linha: { checklist_id: 'x' }, fichas: [], veiculos: [] }), 'Ficha antiga')
})

/* ── Leitura falhou é diferente de "não tem nada" ──────────────────────────── */

test('falha de leitura não vira "está tudo em dia"', () => {
  const r = resumoDasCopias({ falhaLeitura: true, entregues: 0 })
  assert.equal(r.falhaLeitura, true)
  assert.equal(r.temProblema, false)
  assert.equal(r.frase, '')
})

/* ── Singular e plural ─────────────────────────────────────────────────────── */

test('fraseDoQuadro: singular em todos os caminhos', () => {
  assert.equal(fraseDoQuadro({ esperando: 1 }), 'Uma cópia esperando a vez. O robô sobe de 10 em 10 minutos.')
  assert.equal(fraseDoQuadro({ entregues: 1 }), 'A cópia da ficha assinada já está na pasta do Zoho.')
  assert.equal(fraseDoQuadro({ pendentesComErro: 1 }), 'Uma cópia ainda não chegou na pasta do Zoho.')
})

// A manchete conta SÓ o que deu problema: somar as que esperam daria um número
// maior do que os cartões mostrados embaixo, e ainda contaria como falha uma
// ficha que está apenas na vez dela.
test('fraseDoQuadro: quem só espera não engorda a conta do que falhou', () => {
  assert.equal(fraseDoQuadro({ esperando: 2, pendentesComErro: 1 }),
    'Uma cópia ainda não chegou na pasta do Zoho. Outras 2 estão só esperando a vez.')
  assert.equal(fraseDoQuadro({ esperando: 1, pendentesComErro: 3 }),
    '3 cópias ainda não chegaram na pasta do Zoho. Outra está só esperando a vez.')
  assert.equal(fraseDoQuadro({ esperando: 0, pendentesComErro: 3 }),
    '3 cópias ainda não chegaram na pasta do Zoho.')
})

// Nenhuma frase deste quadro pode dar a entender que a ficha vale menos: o PDF
// é CÓPIA, e a prova está gravada no banco desde o segundo da assinatura.
test('nenhuma frase põe a ficha assinada em dúvida', () => {
  const frases = [
    fraseDoQuadro({}), fraseDoQuadro({ esperando: 4 }), fraseDoQuadro({ entregues: 9 }),
    fraseDoQuadro({ pendentesComErro: 2 }),
    ...resumoDasCopias({
      linhas: [{ checklist_id: 'c-1', situacao: 'falhou', ultimo_erro: 'x' }],
      fichas: FICHAS, veiculos: VEICULOS,
    }).grupos.map((g) => g.titulo),
  ]
  for (const f of frases) {
    assert.doesNotMatch(f, /inválid|não vale|sem valor|pendente de validação/i, f)
  }
})
