import { test } from 'node:test'
import assert from 'node:assert/strict'

// conectar-no-banco-de-dados.js chama window.supabase.createClient() ao carregar
// (no navegador existe, aqui não). Mesmo truque de notificacoes-push.test.mjs.
globalThis.window = { supabase: { createClient: () => ({}) } }
const { classificarFalhaDoBling, textoDoAviso, ErroDoBling, chamarBling, paginasDoBling } = await import('./chamada-do-bling.js')

test('500 com "Token refresh failed" é o Bling recusando o iamundi', () => {
  const corpo = { error: 'Error: Token refresh failed: {"error":{"type":"FORBIDDEN","message":"Usuário não autorizado"}}' }
  assert.equal(classificarFalhaDoBling(500, corpo), 'bling-recusou-token')
})

test('403 insufficient_scope também é o Bling recusando, não a pessoa', () => {
  const corpo = { error: { type: 'insufficient_scope', description: 'higher privileges' } }
  assert.equal(classificarFalhaDoBling(403, corpo), 'bling-recusou-token')
})

test('403 "sem permissao" do nosso proxy é a PESSOA sem acesso a Vendas', () => {
  assert.equal(classificarFalhaDoBling(403, { error: 'sem permissao' }), 'sem-acesso-a-vendas')
})

test('401 do nosso proxy é a pessoa sem sessão válida', () => {
  assert.equal(classificarFalhaDoBling(401, { error: 'nao autenticado' }), 'sem-acesso-a-vendas')
})

test('500 sem pista de token é o Bling fora', () => {
  assert.equal(classificarFalhaDoBling(500, { error: 'Error: boom' }), 'bling-fora')
})

test('sem status é sem resposta', () => {
  assert.equal(classificarFalhaDoBling(null, null), 'sem-resposta')
})

test('corpo em texto puro não quebra a classificação', () => {
  assert.equal(classificarFalhaDoBling(502, 'Bad Gateway'), 'bling-fora')
})

test('admin lê a causa e o que fazer', () => {
  const { titulo, detalhe } = textoDoAviso('bling-recusou-token', { ehAdmin: true, horaDoDado: '08:15', tecnica: 'Token refresh failed: FORBIDDEN' })
  assert.match(titulo, /Bling recusou o acesso do iamundi/)
  assert.match(detalhe, /reautorizar no Bling/)
  assert.match(detalhe, /08:15/)
  assert.match(detalhe, /Token refresh failed/)
})

test('quem não é admin lê só que o número está velho, sem jargão', () => {
  const { titulo, detalhe } = textoDoAviso('bling-recusou-token', { ehAdmin: false, horaDoDado: '08:15', tecnica: 'Token refresh failed' })
  assert.equal(titulo, 'Números de 08:15 — aguardando o Bling.')
  assert.equal(detalhe, '')
  assert.doesNotMatch(titulo, /token|escopo|permiss/i)
})

test('sem número anterior, o aviso não inventa hora', () => {
  const { titulo } = textoDoAviso('bling-fora', { ehAdmin: false, horaDoDado: null })
  assert.equal(titulo, 'Não foi possível buscar as vendas agora.')
  assert.doesNotMatch(titulo, /\d\d:\d\d/)
})

test('sem conexão fala de conexão, não do Bling', () => {
  const { titulo } = textoDoAviso('sem-resposta', { ehAdmin: false, horaDoDado: '08:15' })
  assert.equal(titulo, 'Números de 08:15 — sem conexão.')
})

test('pessoa sem acesso a Vendas não ouve falar do Bling nem de hora', () => {
  const a = textoDoAviso('sem-acesso-a-vendas', { ehAdmin: false, horaDoDado: '08:15' })
  assert.equal(a.titulo, 'Você não tem acesso a Vendas — fale com quem administra.')
  assert.doesNotMatch(a.titulo, /Bling|08:15/)
  const b = textoDoAviso('sem-acesso-a-vendas', { ehAdmin: true, horaDoDado: '08:15' })
  assert.match(b.titulo, /Este login não tem acesso a Vendas/)
})

// Um defeito NOSSO não pode ser escrito como "o Bling não respondeu": em
// 13/08/2026 a Análise de Vendas quebrou por erro de tela e o texto teria
// culpado o Bling — mandando investigar o fornecedor por defeito nosso, que foi
// exatamente o desperdício da manhã daquele dia.
test('erro da tela não culpa o Bling', () => {
  const admin = textoDoAviso('erro-na-tela', { ehAdmin: true, horaDoDado: '08:15', tecnica: "Cannot read properties of undefined (reading 'map')" })
  assert.doesNotMatch(admin.titulo, /Bling/)
  assert.match(admin.titulo, /tela|Central/i)
  assert.match(admin.detalhe, /map/)   // o detalhe técnico chega a quem conserta

  const outros = textoDoAviso('erro-na-tela', { ehAdmin: false, horaDoDado: '08:15' })
  assert.doesNotMatch(outros.titulo, /Bling/)
})

test('ErroDoBling carrega causa e detalhe técnico', () => {
  const e = new ErroDoBling('bling-fora', 'boom')
  assert.equal(e.causa, 'bling-fora')
  assert.equal(e.tecnica, 'boom')
  assert.ok(e instanceof Error)
})

// ── chamarBling / paginasDoBling ──────────────────────────────────────────
// Um sbClient de mentira (só precisa devolver uma sessão) e um fetch de mentira.
const sbFalso = { auth: { getSession: async () => ({ data: { session: { access_token: 'tk' } } }) } }
const comFetch = async (respostas, fn) => {
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = async () => {
    const r = respostas[Math.min(i++, respostas.length - 1)]
    if (r instanceof Error) throw r
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.corpo }
  }
  try { return await fn() } finally { globalThis.fetch = original }
}

test('chamarBling devolve o corpo quando dá certo', async () => {
  const r = await comFetch([{ status: 200, corpo: { data: [{ id: 1 }] } }],
    () => chamarBling(sbFalso, 'pedidos/vendas', {}))
  assert.deepEqual(r.data, [{ id: 1 }])
})

test('chamarBling LANÇA em 500, em vez de devolver corpo sem data', async () => {
  await assert.rejects(
    () => comFetch([{ status: 500, corpo: { error: 'Error: Token refresh failed: x' } }],
      () => chamarBling(sbFalso, 'pedidos/vendas', {})),
    (e) => e instanceof ErroDoBling && e.causa === 'bling-recusou-token')
})

test('chamarBling classifica como sem-resposta quando o fetch nem volta', async () => {
  await assert.rejects(
    () => comFetch([new TypeError('Failed to fetch')],
      () => chamarBling(sbFalso, 'pedidos/vendas', {})),
    (e) => e instanceof ErroDoBling && e.causa === 'sem-resposta')
})

test('sem sessão no navegador, é sem-acesso-a-vendas e nem chama o Bling', async () => {
  const semSessao = { auth: { getSession: async () => ({ data: { session: null } }) } }
  await assert.rejects(
    () => chamarBling(semSessao, 'pedidos/vendas', {}),
    (e) => e instanceof ErroDoBling && e.causa === 'sem-acesso-a-vendas')
})

test('paginasDoBling junta as páginas e para na página curta', async () => {
  const cheia = { status: 200, corpo: { data: Array.from({ length: 100 }, (_, k) => ({ id: k })) } }
  const curta = { status: 200, corpo: { data: [{ id: 999 }] } }
  const todos = await comFetch([cheia, curta], () => paginasDoBling(sbFalso, 'pedidos/vendas', {}))
  assert.equal(todos.length, 101)
})

test('lista vazia NÃO é falha — é fim de lista', async () => {
  const todos = await comFetch([{ status: 200, corpo: { data: [] } }],
    () => paginasDoBling(sbFalso, 'pedidos/vendas', {}))
  assert.deepEqual(todos, [])
})

test('paginasDoBling propaga a falha em vez de devolver lista vazia', async () => {
  await assert.rejects(
    () => comFetch([{ status: 500, corpo: { error: 'boom' } }],
      () => paginasDoBling(sbFalso, 'pedidos/vendas', {})),
    (e) => e instanceof ErroDoBling && e.causa === 'bling-fora')
})
