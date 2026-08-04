import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posicaoDoBalao, sobrepoe } from './posicao-do-balao.js'

const TELA = { largura: 1200, altura: 800 }
const BALAO = { largura: 330, altura: 180 }
const caixa = (p) => ({ top: p.top, left: p.left, largura: BALAO.largura, altura: BALAO.altura })

test('com espaço embaixo, o balão fica embaixo do alvo', () => {
  const alvo = { top: 100, left: 200, width: 120, height: 40 }
  const p = posicaoDoBalao({ alvo, tela: TELA, balao: BALAO })
  assert.equal(p.lado, 'abaixo')
  assert.ok(p.top > alvo.top + alvo.height, 'tem que começar depois do alvo')
})

test('sem espaço embaixo, VIRA pra cima em vez de cobrir o alvo', () => {
  // Este é o bug que o dono viu: alvo lá no rodapé, balão "abaixo" dele saindo
  // da tela e sendo empurrado de volta por cima do próprio alvo.
  const alvo = { top: 720, left: 200, width: 120, height: 40 }
  const p = posicaoDoBalao({ alvo, tela: TELA, balao: BALAO })
  assert.equal(p.lado, 'acima')
  assert.ok(p.top + BALAO.altura <= alvo.top, 'tem que terminar antes do alvo começar')
})

test('O INVARIANTE: o balão nunca cobre o alvo — varrendo a tela inteira', () => {
  for (let top = 0; top <= 760; top += 20) {
    for (let left = 0; left <= 1160; left += 40) {
      const alvo = { top, left, width: 120, height: 40 }
      const p = posicaoDoBalao({ alvo, tela: TELA, balao: BALAO })
      assert.equal(sobrepoe(caixa(p), alvo), false,
        `balão cobriu o alvo em top=${top} left=${left} (ficou em ${p.top},${p.left})`)
    }
  }
})

test('o balão não vaza pela direita da tela', () => {
  const alvo = { top: 100, left: 1150, width: 40, height: 40 }
  const p = posicaoDoBalao({ alvo, tela: TELA, balao: BALAO })
  assert.ok(p.left + BALAO.largura <= TELA.largura, 'passou da borda direita')
  assert.ok(p.left >= 0, 'passou da borda esquerda')
})

test('alvo colado na esquerda não empurra o balão pra fora', () => {
  const alvo = { top: 100, left: 0, width: 40, height: 40 }
  const p = posicaoDoBalao({ alvo, tela: TELA, balao: BALAO })
  assert.ok(p.left >= 0)
})

test('passo sem alvo na tela centraliza, em vez de sumir', () => {
  const p = posicaoDoBalao({ alvo: null, tela: TELA, balao: BALAO })
  assert.equal(p.lado, 'centro')
  assert.ok(p.top > 0 && p.left > 0)
})

test('tela apertada não devolve posição negativa', () => {
  const alvo = { top: 10, left: 10, width: 300, height: 300 }
  const p = posicaoDoBalao({ alvo, tela: { largura: 360, altura: 400 }, balao: { largura: 340, altura: 200 } })
  assert.ok(p.top >= 0 && p.left >= 0, `posição negativa: ${JSON.stringify(p)}`)
})

test('sobrepoe() reconhece encostar sem cruzar', () => {
  const alvo = { top: 100, left: 100, width: 50, height: 50 }
  assert.equal(sobrepoe({ top: 150, left: 100, largura: 50, altura: 50 }, alvo), false, 'encostado não é sobreposto')
  assert.equal(sobrepoe({ top: 149, left: 100, largura: 50, altura: 50 }, alvo), true)
  assert.equal(sobrepoe(null, alvo), false)
})
