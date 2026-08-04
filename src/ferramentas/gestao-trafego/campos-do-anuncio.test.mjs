import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  montarSaudacao, lerSaudacao, SAUDACAO_PADRAO, RESPOSTA_PADRAO,
  BOTOES, botoesDe, botaoEscolhido,
  extrasDoCriativo, avisoDeTamanho, LIMITE_TITULO,
} from './campos-do-anuncio.js'

// O JSON exato de um anúncio REAL da conta Vessel (03/08/2026), encurtado só
// nos campos que não lemos. É contra ele que o formato é conferido.
const REAL = JSON.stringify({
  type: 'VISUAL_EDITOR', version: 2, landing_screen_type: 'welcome_message', media_type: 'text',
  text_format: {
    customer_action_type: 'autofill_message',
    message: { autofill_message: { content: 'Olá! Posso ter mais informações sobre isso?' }, text: 'Oi! Como podemos ajudar?' },
  },
  image_format: {
    customer_action_type: 'quick_replies',
    message: {
      attachment: { type: 'template', payload: { template_type: 'generic', elements: [{ title: '', buttons: [], image_hash: '' }] } },
      quick_replies: [{ title: 'Gostaria de obter mais informações', content_type: 'text', response_type: null }],
      text: 'Oi! Como podemos ajudar?',
    },
  },
  template_id: '1802844501145453',
})

// ── A saudação ──────────────────────────────────────────────────────────────

test('a saudacao sai no MESMO formato que a conta ja usa', () => {
  const o = JSON.parse(montarSaudacao({ saudacao: 'Oi! Como podemos ajudar?', resposta: 'Quero saber mais' }))
  const r = JSON.parse(REAL)
  // As chaves de cima têm que bater — é o que a Meta lê.
  assert.equal(o.type, r.type)
  assert.equal(o.version, r.version)
  assert.equal(o.landing_screen_type, r.landing_screen_type)
  assert.equal(o.media_type, r.media_type)
  assert.equal(o.text_format.customer_action_type, r.text_format.customer_action_type)
  assert.equal(o.image_format.customer_action_type, r.image_format.customer_action_type)
})

test('os DOIS textos vao para os lugares certos — trocar um pelo outro e o erro facil', () => {
  const o = JSON.parse(montarSaudacao({ saudacao: 'Bem-vindo à Vessel!', resposta: 'Quero ver as bolsas' }))
  // o que a LOJA diz
  assert.equal(o.text_format.message.text, 'Bem-vindo à Vessel!')
  // o que já vem digitado no WhatsApp do CLIENTE
  assert.equal(o.text_format.message.autofill_message.content, 'Quero ver as bolsas')
  assert.equal(o.image_format.message.quick_replies[0].title, 'Quero ver as bolsas')
})

test('os tres formatos (texto/imagem/video) vem juntos, como no anuncio real', () => {
  const o = JSON.parse(montarSaudacao({ saudacao: 'Oi!' }))
  assert.ok(o.text_format && o.image_format && o.video_format)
  assert.equal(o.video_format.message.attachment.type, 'video')
})

test('sem saudacao escrita nao manda campo nenhum', () => {
  // E isso é resposta boa: a Meta cai na saudação padrão da página, que é o que
  // 431 dos 557 criativos da conta fazem.
  assert.equal(montarSaudacao({ saudacao: '' }), null)
  assert.equal(montarSaudacao({ saudacao: '   ', resposta: 'oi' }), null)
  assert.equal(montarSaudacao(), null)
  assert.equal(montarSaudacao(null), null)
})

test('resposta em branco cai no padrao, e nao em vazio', () => {
  // Resposta vazia deixaria o cliente com a caixa em branco — que é
  // exatamente o atrito que a saudação existe para tirar.
  const o = JSON.parse(montarSaudacao({ saudacao: 'Oi!' }))
  assert.equal(o.text_format.message.autofill_message.content, RESPOSTA_PADRAO)
})

test('le de volta o que a conta ja tem gravado', () => {
  const x = lerSaudacao(REAL)
  assert.equal(x.saudacao, 'Oi! Como podemos ajudar?')
  assert.equal(x.resposta, 'Olá! Posso ter mais informações sobre isso?')
})

test('montar e ler dao a volta completa', () => {
  const dupla = { saudacao: 'Olá! Garanta a condição especial 🔥', resposta: 'Sou lojista, quero saber mais' }
  assert.deepEqual(lerSaudacao(montarSaudacao(dupla)), dupla)
})

test('ler nao estoura com lixo', () => {
  assert.equal(lerSaudacao('{isso nao e json'), null)
  assert.equal(lerSaudacao(''), null)
  assert.equal(lerSaudacao(null), null)
  assert.equal(lerSaudacao(42), null)
  assert.equal(lerSaudacao('{}'), null)
})

test('le tambem quando a resposta so existe em quick_replies', () => {
  // Anúncio antigo pode não ter `autofill_message`. Ler só um dos dois lugares
  // deixaria a metade dos casos em branco na tela.
  const so = JSON.stringify({
    text_format: { message: { text: 'Oi!' } },
    image_format: { message: { quick_replies: [{ title: 'Quero comprar' }] } },
  })
  assert.deepEqual(lerSaudacao(so), { saudacao: 'Oi!', resposta: 'Quero comprar' })
})

test('a saudacao PADRAO e um texto de verdade, nao vazio', () => {
  assert.ok(SAUDACAO_PADRAO.length > 5)
})

// ── O botão ─────────────────────────────────────────────────────────────────

test('WhatsApp so oferece o botao de WhatsApp', () => {
  const l = botoesDe({ destination_type: 'WHATSAPP' })
  assert.deepEqual(l.map((b) => b.id), ['WHATSAPP_MESSAGE'])
})

test('campanha de perfil nao oferece botao de WhatsApp — a Meta recusaria', () => {
  const l = botoesDe({ destination_type: 'INSTAGRAM_PROFILE' })
  assert.ok(!l.some((b) => b.id === 'WHATSAPP_MESSAGE'))
  assert.deepEqual(l.map((b) => b.id), ['VIEW_INSTAGRAM_PROFILE'])
})

test('campanha de site oferece os botoes de site, e mais de um', () => {
  const l = botoesDe({ destination_type: 'UNDEFINED' })
  assert.ok(l.length >= 3)
  assert.ok(l.some((b) => b.id === 'LEARN_MORE'))
  assert.ok(l.some((b) => b.id === 'SHOP_NOW'))
})

test('escolha que nao cabe no destino cai no primeiro, nunca em vazio', () => {
  // Trocar o objetivo depois de escolher o botão é o caminho comum para isso.
  assert.equal(botaoEscolhido({ destination_type: 'WHATSAPP' }, 'SHOP_NOW'), 'WHATSAPP_MESSAGE')
  assert.equal(botaoEscolhido({ destination_type: 'UNDEFINED' }, undefined), 'LEARN_MORE')
  // Sem objetivo nenhum cai no botão neutro de link — e não no de WhatsApp,
  // que prometeria uma conversa que a campanha não sabe abrir.
  assert.equal(botaoEscolhido(null, null), 'LEARN_MORE')
})

test('todo botao tem rotulo em portugues, sem sigla da Meta', () => {
  for (const b of BOTOES) {
    assert.ok(b.rotulo.length > 4, `${b.id} sem rótulo`)
    assert.ok(!/_/.test(b.rotulo), `${b.id}: sigla da Meta aparecendo`)
  }
})

// ── Título e descrição ──────────────────────────────────────────────────────

test('titulo vai em `name` na imagem e em `title` no video', () => {
  // Medido nos dois formatos. Trocar um pelo outro faz o título sumir SEM erro,
  // que é o pior jeito de errar.
  assert.deepEqual(extrasDoCriativo({ titulo: 'Bolsas novas' }), { name: 'Bolsas novas' })
  assert.deepEqual(extrasDoCriativo({ titulo: 'Bolsas novas', video: true }), { title: 'Bolsas novas' })
})

test('campo em branco nao entra no criativo', () => {
  assert.deepEqual(extrasDoCriativo({ titulo: '', descricao: '  ' }), {})
  assert.deepEqual(extrasDoCriativo(), {})
})

test('o aviso de tamanho avisa, e nao trava', () => {
  assert.equal(avisoDeTamanho('titulo', 'Curto'), '')
  const longo = 'x'.repeat(LIMITE_TITULO + 5)
  assert.match(avisoDeTamanho('titulo', longo), /cortar/)
  assert.match(avisoDeTamanho('descricao', 'x'.repeat(40)), /cortar/)
})

test('campo sem limite nao recebe aviso de tamanho emprestado', () => {
  // Visto ao vivo: a saudação do WhatsApp herdava o limite da descrição e dizia
  // "o Facebook corta depois de 30" numa mensagem que não tem esse corte.
  assert.equal(avisoDeTamanho(undefined, 'x'.repeat(200)), '')
  assert.equal(avisoDeTamanho('', 'x'.repeat(200)), '')
})
