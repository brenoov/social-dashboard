import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numeroParaWhatsapp, linkDoWhatsapp, telefoneLegivel, porQueNaoDaLink } from './whatsapp.js'

test('celular com DDD, do jeito que a pessoa digita', () => {
  // Todos estes são o MESMO número, escritos como aparecem na vida real.
  for (const forma of ['(19) 99164-9471', '19 99164 9471', '19991649471', '19.99164.9471']) {
    assert.equal(numeroParaWhatsapp(forma), '5519991649471', `falhou em "${forma}"`)
  }
})

test('fixo com DDD também vira link', () => {
  // O da oficina que está na planilha da frota: JHM Auto center, 19 3033-9837.
  assert.equal(numeroParaWhatsapp('(19) 3033-9837'), '551930339837')
})

test('número que JÁ vem internacional é respeitado', () => {
  assert.equal(numeroParaWhatsapp('+55 19 99164-9471'), '5519991649471')
  assert.equal(numeroParaWhatsapp('5519991649471'), '5519991649471')
})

test('o "0" de operadora é descartado', () => {
  assert.equal(numeroParaWhatsapp('0 19 99164-9471'), '5519991649471')
  assert.equal(numeroParaWhatsapp('01999164 9471'), '5519991649471')
})

test('SEM DDD devolve nulo — adivinhar abriria conversa com estranho', () => {
  // É o caso perigoso: "3033-9837" existe em dezenas de cidades. Chutar o DDD
  // do escritório mandaria mensagem pra outra pessoa, e a tela não daria erro
  // nenhum: abriria o WhatsApp normalmente, com o número errado.
  assert.equal(numeroParaWhatsapp('3033-9837'), null)
  assert.equal(numeroParaWhatsapp('99164-9471'), null)
  assert.match(porQueNaoDaLink('3033-9837'), /DDD/)
})

test('0800 não é WhatsApp', () => {
  assert.equal(numeroParaWhatsapp('0800 123 4567'), null)
  assert.match(porQueNaoDaLink('0800 123 4567'), /0800/)
})

test('lixo não vira link', () => {
  for (const x of ['', '   ', null, undefined, 'não tem', 'ver com o Erick', '123', '1']) {
    assert.equal(numeroParaWhatsapp(x), null, `deixou passar "${x}"`)
  }
})

test('DDD com zero é recusado — nenhum existe', () => {
  // Não há DDD com 0 em nenhuma das duas casas: eles vão de 11 a 99 sem zeros.
  assert.equal(numeroParaWhatsapp('10 99164-9471'), null)
  assert.equal(numeroParaWhatsapp('90 99164-9471'), null)
  assert.equal(numeroParaWhatsapp('20 3033-9837'), null)
})

test('o zero da frente é prefixo de operadora, não parte do DDD', () => {
  // "0 19 99164-9471" é como se disca interurbano. O zero sai e sobra o DDD 19.
  // (Eu tinha escrito um teste esperando null aqui — o teste é que estava
  // errado, e o código documentava o certo.)
  assert.equal(numeroParaWhatsapp('0 19 99164-9471'), '5519991649471')
})

test('o link é o que o WhatsApp entende', () => {
  assert.equal(linkDoWhatsapp('(19) 99164-9471'), 'https://wa.me/5519991649471')
  assert.equal(linkDoWhatsapp('sem número'), null)
})

test('mensagem pronta vai codificada', () => {
  const l = linkDoWhatsapp('19991649471', 'Oi! É sobre o Fiat Doblo (QQT9B68).')
  assert.match(l, /^https:\/\/wa\.me\/5519991649471\?text=/)
  assert.ok(!l.includes(' '), 'espaço cru no link quebraria em alguns apps')
  assert.ok(l.includes('QQT9B68'))
})

test('o número aparece legível, não colado', () => {
  assert.equal(telefoneLegivel('19991649471'), '(19) 99164-9471')
  assert.equal(telefoneLegivel('1930339837'), '(19) 3033-9837')
})

test('número que não dá link ainda é MOSTRADO como veio', () => {
  // Não some da tela: quem cadastrou escreveu alguma coisa, e apagar da vista
  // faria parecer que o campo está vazio.
  assert.equal(telefoneLegivel('3033-9837'), '3033-9837')
  assert.equal(telefoneLegivel('falar com a Raissa'), 'falar com a Raissa')
  assert.equal(telefoneLegivel(''), '—')
})

test('toda recusa tem explicação, nenhuma sai muda', () => {
  for (const x of ['', '3033-9837', '0800 123 4567', 'abc']) {
    assert.ok(porQueNaoDaLink(x).length > 12, `sem explicação para "${x}"`)
  }
})
