import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FORMATOS,
  LIMITE_IMAGEM,
  LIMITE_VIDEO,
  regrasDoFormato,
  tipoDoMime,
  validarArquivos,
} from './formatos.js'

const imagem = (bytes = 1000, mime = 'image/jpeg') => ({ nome: 'foto.jpg', bytes, mime })
const video = (bytes = 1000, mime = 'video/mp4') => ({ nome: 'clipe.mp4', bytes, mime })

// ── Catálogo ────────────────────────────────────────────────────────────────

test('as chaves batem com o CHECK da tabela conteudo_pecas', () => {
  assert.deepEqual(FORMATOS.map(f => f.chave).sort(), ['carrossel', 'feed', 'reels', 'stories'])
})

test('todo formato tem rotulo em portugues e faixa de arquivos coerente', () => {
  for (const f of FORMATOS) {
    assert.ok(f.rotulo, `faltou rotulo em ${f.chave}`)
    assert.ok(f.minArquivos >= 1, `${f.chave} precisa de pelo menos 1 arquivo`)
    assert.ok(f.maxArquivos >= f.minArquivos, `${f.chave} tem faixa invertida`)
    assert.ok(Array.isArray(f.mimes) && f.mimes.length > 0)
  }
})

test('regrasDoFormato devolve null para formato desconhecido', () => {
  assert.equal(regrasDoFormato('tiktok'), null)
  assert.equal(regrasDoFormato('carrossel').maxArquivos, 20)
})

test('carrossel exige pelo menos 2 arquivos', () => {
  assert.equal(regrasDoFormato('carrossel').minArquivos, 2)
})

test('reels so aceita video', () => {
  assert.deepEqual(regrasDoFormato('reels').mimes.filter(m => m.startsWith('image/')), [])
})

// ── tipoDoMime ──────────────────────────────────────────────────────────────

test('tipoDoMime separa imagem de video, e devolve null no resto', () => {
  assert.equal(tipoDoMime('image/png'), 'imagem')
  assert.equal(tipoDoMime('video/quicktime'), 'video')
  assert.equal(tipoDoMime('application/pdf'), null)
  assert.equal(tipoDoMime(undefined), null)
})

// ── Validação ───────────────────────────────────────────────────────────────

test('formato desconhecido devolve um problema, nao explode', () => {
  const p = validarArquivos('tiktok', [imagem()])
  assert.equal(p.length, 1)
  assert.match(p[0], /formato/i)
})

test('feed com uma imagem nao tem problema nenhum', () => {
  assert.deepEqual(validarArquivos('feed', [imagem()]), [])
})

test('feed sem arquivo avisa que falta arquivo', () => {
  const p = validarArquivos('feed', [])
  assert.equal(p.length, 1)
  assert.match(p[0], /arquivo/i)
})

test('carrossel com 1 arquivo avisa o minimo', () => {
  const p = validarArquivos('carrossel', [imagem()])
  assert.match(p.join(' '), /2/)
})

test('carrossel com 21 arquivos avisa o maximo', () => {
  const p = validarArquivos('carrossel', Array.from({ length: 21 }, () => imagem()))
  assert.match(p.join(' '), /20/)
})

test('carrossel com 2 imagens passa', () => {
  assert.deepEqual(validarArquivos('carrossel', [imagem(), imagem()]), [])
})

test('reels com imagem avisa que so aceita video, citando o nome do arquivo', () => {
  const p = validarArquivos('reels', [imagem()])
  assert.equal(p.length, 1)
  assert.match(p[0], /foto\.jpg/)
})

test('imagem acima do limite avisa, e o texto traz o tamanho em MB', () => {
  const p = validarArquivos('feed', [imagem(LIMITE_IMAGEM + 1)])
  assert.equal(p.length, 1)
  assert.match(p[0], /MB/)
  assert.match(p[0], /foto\.jpg/)
})

test('imagem exatamente no limite passa', () => {
  assert.deepEqual(validarArquivos('feed', [imagem(LIMITE_IMAGEM)]), [])
})

test('video acima do limite avisa', () => {
  const p = validarArquivos('reels', [video(LIMITE_VIDEO + 1)])
  assert.equal(p.length, 1)
  assert.match(p[0], /MB/)
})

test('video usa o limite de video, nao o de imagem', () => {
  assert.deepEqual(validarArquivos('reels', [video(LIMITE_IMAGEM + 1)]), [])
})

test('lista com varios erros devolve todos, nao so o primeiro', () => {
  const p = validarArquivos('reels', [imagem(), imagem()])
  assert.ok(p.length >= 2, `esperava varios problemas, veio ${p.length}`)
})

test('nenhuma mensagem sai com undefined ou NaN', () => {
  const casos = [
    validarArquivos('feed', [{ nome: undefined, bytes: undefined, mime: undefined }]),
    validarArquivos('carrossel', []),
    validarArquivos('reels', [imagem(LIMITE_VIDEO + 1)]),
  ]
  for (const p of casos.flat()) {
    assert.ok(!/undefined|NaN|null/.test(p), `mensagem ruim: ${p}`)
  }
})

test('lista nula e tratada como vazia', () => {
  assert.ok(validarArquivos('feed', null).length >= 1)
})

// ---------- foto de iPhone e mensagens que ensinam ----------
//
// HEIC é o padrão da câmera do iPhone. Recusá-lo fazia o erro mais provável do
// primeiro uso ser "arrastei a foto do meu celular" — e a mensagem antiga
// parava no diagnóstico, sem dizer o que serve.

test('aceita foto de iPhone (HEIC/HEIF)', () => {
  for (const mime of ['image/heic', 'image/heif']) {
    const p = validarArquivos('feed', [{ nome: 'IMG_0421.HEIC', mime, bytes: 3_000_000 }])
    assert.deepEqual(p, [], `recusou ${mime}: ${p.join(' ')}`)
  }
})

test('carrossel tambem aceita HEIC', () => {
  const p = validarArquivos('carrossel', [
    { nome: 'a.heic', mime: 'image/heic', bytes: 1_000_000 },
    { nome: 'b.jpg', mime: 'image/jpeg', bytes: 1_000_000 },
  ])
  assert.deepEqual(p, [])
})

test('toda recusa por tipo diz o que serve', () => {
  const casos = [
    ['feed', { nome: 'planilha.xlsx', mime: 'application/vnd.ms-excel', bytes: 1000 }],
    ['feed', { nome: 'sem-tipo', mime: '', bytes: 1000 }],
    ['carrossel', { nome: 'doc.pdf', mime: 'application/pdf', bytes: 1000 }],
  ]
  for (const [formato, arquivo] of casos) {
    const p = validarArquivos(formato, [arquivo]).join(' ')
    assert.ok(p.length, `${arquivo.nome} deveria ser recusado`)
    assert.match(p, /JPG, PNG, WEBP, HEIC, MP4 ou MOV|MP4 ou MOV/,
      `mensagem nao ensina o que serve: ${p}`)
  }
})

test('reels so aceita video, e diz qual', () => {
  const p = validarArquivos('reels', [{ nome: 'foto.jpg', mime: 'image/jpeg', bytes: 1000 }]).join(' ')
  assert.match(p, /só aceita vídeo/)
  assert.match(p, /MP4 ou MOV/)
})
