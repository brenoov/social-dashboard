import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticar, passosParaLiberar, navegadorDe } from './permissao-de-camera.js'

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeNoIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
}

test('no iPhone TODO navegador é Safari por baixo', () => {
  // Chrome de iPhone usa o motor do Safari, e o caminho dos ajustes é o do
  // Safari. Mandar a pessoa procurar o cadeado do Chrome ali é mandá-la
  // procurar um botão que não existe.
  assert.equal(navegadorDe(UA.iphone), 'ios')
  assert.equal(navegadorDe(UA.chromeNoIphone), 'ios')
  assert.match(passosParaLiberar(UA.chromeNoIphone).join(' '), /aA/)
})

test('cada navegador ganha o caminho dele', () => {
  assert.match(passosParaLiberar(UA.androidChrome).join(' '), /cadeado/i)
  assert.match(passosParaLiberar(UA.samsung).join(' '), /cadeado/i)
  assert.equal(navegadorDe(UA.firefox), 'firefox')
  assert.equal(navegadorDe(UA.macChrome), 'chrome')
})

test('todo caminho termina mandando tentar de novo', () => {
  // Sem isso a pessoa libera a permissão e fica olhando pra tela travada, sem
  // saber que precisa pedir de novo.
  for (const ua of Object.values(UA)) {
    const p = passosParaLiberar(ua)
    assert.ok(p.length >= 3, `poucos passos para ${ua.slice(0, 30)}`)
    assert.match(p[p.length - 1], /tentar de novo/i)
  }
})

test('sem https vence tudo — é a causa mais funda', () => {
  // Não adianta mandar liberar permissão: em http nem existe permissão pra
  // liberar. Este caso tem que ganhar mesmo com erro de permissão junto.
  const r = diagnosticar({ contextoSeguro: false, temMediaDevices: false, permissao: 'denied', erroNome: 'NotAllowedError' })
  assert.equal(r.estado, 'sem-https')
  assert.equal(r.podeTentar, false, 'tentar de novo não resolve nada aqui')
  assert.match(r.texto, /https/)
})

test('navegador sem o recurso é diferente de permissão negada', () => {
  const r = diagnosticar({ temMediaDevices: false, contextoSeguro: true })
  assert.equal(r.estado, 'sem-suporte')
  assert.equal(r.podeTentar, false)
})

test('permissão negada explica que o aviso NÃO volta sozinho', () => {
  // É o caso que o dono pegou: negou uma vez e o navegador passou a recusar
  // calado. Se a tela não contar isso, a pessoa fica tocando no botão à toa.
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, permissao: 'denied', ua: UA.androidChrome })
  assert.equal(r.estado, 'negada')
  assert.match(r.texto, /sem perguntar/i)
  assert.ok(r.passos.length >= 3, 'tem que dizer ONDE liberar, não só que está bloqueada')
  assert.equal(r.podeTentar, true)
})

test('o erro de permissão também é reconhecido sem a API de permissões', () => {
  // Safari não responde a consulta de permissão de câmera: lá o único sinal é
  // o erro que getUserMedia devolve.
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, erroNome: 'NotAllowedError', ua: UA.iphone })
  assert.equal(r.estado, 'negada')
  assert.match(r.passos.join(' '), /aA/)
})

test('câmera ocupada por outro app não é permissão negada', () => {
  // Acontece muito no Android: a câmera do sistema ficou aberta atrás.
  // Mandar a pessoa mexer em permissão aqui é mandá-la pro lugar errado.
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, erroNome: 'NotReadableError' })
  assert.equal(r.estado, 'ocupada')
  assert.match(r.texto, /outro aplicativo/i)
  assert.equal(r.passos.length, 0)
})

test('aparelho sem câmera nenhuma', () => {
  assert.equal(diagnosticar({ temMediaDevices: true, contextoSeguro: true, erroNome: 'NotFoundError' }).estado, 'sem-camera')
  assert.equal(diagnosticar({ temMediaDevices: true, contextoSeguro: true, erroNome: 'OverconstrainedError' }).estado, 'sem-camera')
})

test('antes de tentar: avisa que o pedido vem, e por quê', () => {
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, permissao: 'prompt' })
  assert.equal(r.estado, 'vai-perguntar')
  assert.match(r.texto, /Permitir/)
  assert.match(r.texto, /não sai do seu aparelho/i, 'dizer que a imagem não sai daqui é o que faz a pessoa aceitar')
})

test('já liberada não fica pedindo permissão de novo', () => {
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, permissao: 'granted' })
  assert.equal(r.estado, 'liberada')
  assert.equal(r.passos.length, 0)
})

test('erro desconhecido não deixa a pessoa sem saída', () => {
  const r = diagnosticar({ temMediaDevices: true, contextoSeguro: true, erroNome: 'CoisaEstranhaError' })
  assert.equal(r.estado, 'erro')
  assert.match(r.texto, /impresso embaixo/, 'sempre lembrar que dá pra digitar o número')
  assert.equal(r.podeTentar, true)
})

test('sem informação nenhuma não quebra', () => {
  const r = diagnosticar()
  assert.ok(r.titulo && r.texto)
  assert.equal(r.podeTentar, true)
})

test('nenhuma mensagem usa jargão de programador', () => {
  const casos = [
    { contextoSeguro: false }, { temMediaDevices: false, contextoSeguro: true },
    { temMediaDevices: true, contextoSeguro: true, permissao: 'denied', ua: UA.androidChrome },
    { temMediaDevices: true, contextoSeguro: true, erroNome: 'NotReadableError' },
    { temMediaDevices: true, contextoSeguro: true, erroNome: 'NotFoundError' },
    { temMediaDevices: true, contextoSeguro: true, permissao: 'prompt' },
  ]
  const proibidas = ['getusermedia', 'mediadevices', 'notallowed', 'api', 'null', 'undefined', 'exception']
  for (const c of casos) {
    const r = diagnosticar(c)
    const tudo = (r.titulo + ' ' + r.texto + ' ' + r.passos.join(' ')).toLowerCase()
    for (const j of proibidas) {
      assert.ok(!tudo.includes(j), `"${j}" apareceu no estado ${r.estado}`)
    }
  }
})
