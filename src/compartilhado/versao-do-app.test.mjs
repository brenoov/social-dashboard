import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pacoteDoHtml, pacoteEmUso, precisaAtualizar, enderecoDaChecagem, INTERVALO_DE_CHECAGEM } from './versao-do-app.js'

// O index.html que o Vite gera, no formato real.
const HTML = `<!doctype html><html><head>
<link rel="manifest" href="/manifest.webmanifest">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script type="module" crossorigin src="/assets/index-Cg7ER1SX.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-D7m-FPBg.css">
</head><body><div id="app"></div></body></html>`

test('acha o pacote no HTML de verdade', () => {
  assert.equal(pacoteDoHtml(HTML), 'index-Cg7ER1SX.js')
})

test('não confunde com o CSS nem com script de fora', () => {
  // O CSS tem o MESMO padrão de nome (`/assets/index-XXXX.css`), e há três
  // scripts de CDN antes do pacote. Pegar o errado faria a comparação sempre
  // bater e o aviso nunca aparecer.
  const p = pacoteDoHtml(HTML)
  assert.ok(p.endsWith('.js'))
  assert.ok(!p.includes('supabase'))
  assert.notEqual(p, 'index-D7m-FPBg.css')
})

test('HTML sem pacote devolve nulo, não quebra', () => {
  assert.equal(pacoteDoHtml('<html><body>oi</body></html>'), null)
  assert.equal(pacoteDoHtml(''), null)
  assert.equal(pacoteDoHtml(null), null)
  assert.equal(pacoteDoHtml(undefined), null)
})

test('uma página de erro do servidor não vira "versão nova"', () => {
  // Se a Vercel devolver 404/500 com HTML de erro, não há pacote — e o app
  // tem que ficar quieto, não pedir pra recarregar numa hora em que
  // recarregar levaria a mesma página de erro.
  assert.equal(precisaAtualizar('index-AAA.js', pacoteDoHtml('<h1>404</h1>')), false)
})

test('avisa só quando os dois lados são conhecidos E diferentes', () => {
  assert.equal(precisaAtualizar('index-AAA.js', 'index-BBB.js'), true)
  assert.equal(precisaAtualizar('index-AAA.js', 'index-AAA.js'), false)
})

test('na dúvida NÃO avisa', () => {
  // Rede caiu, HTML estranho, build mudou de formato. Avisar errado é pior que
  // não avisar: a pessoa recarrega no meio de um cadastro, perde o que digitou,
  // e da segunda vez ignora o aviso.
  assert.equal(precisaAtualizar(null, 'index-BBB.js'), false)
  assert.equal(precisaAtualizar('index-AAA.js', null), false)
  assert.equal(precisaAtualizar(null, null), false)
  assert.equal(precisaAtualizar('', ''), false)
})

test('a checagem fura o cache do navegador', () => {
  // Sem isso a checagem perguntaria pro cache e receberia sempre a mesma
  // resposta — que é exatamente o problema que ela existe pra resolver.
  const a = enderecoDaChecagem(1000)
  const b = enderecoDaChecagem(2000)
  assert.notEqual(a, b)
  assert.match(a, /^\/index\.html\?v=/)
})

test('o intervalo é minutos, não segundos', () => {
  // Conferir de segundo em segundo bateria no servidor à toa e gastaria
  // bateria de celular pra descobrir algo que muda uma vez por dia.
  assert.ok(INTERVALO_DE_CHECAGEM >= 60_000, 'intervalo curto demais')
  assert.ok(INTERVALO_DE_CHECAGEM <= 30 * 60_000, 'intervalo longo demais para uma correção urgente chegar')
})

/* ── Ler o pacote que está rodando ────────────────────────────────────────── */

const documentoFalso = (srcs) => ({
  querySelectorAll: () => srcs.map((s) => ({ getAttribute: () => s })),
})

test('lê o pacote em uso das tags da página', () => {
  assert.equal(pacoteEmUso(documentoFalso(['/assets/index-Cg7ER1SX.js'])), 'index-Cg7ER1SX.js')
})

test('sem DOM não explode', () => {
  // Roda em teste e em qualquer contexto sem documento.
  assert.equal(pacoteEmUso({ querySelectorAll: () => { throw new Error('sem DOM') } }), null)
  assert.equal(pacoteEmUso(documentoFalso([])), null)
})
