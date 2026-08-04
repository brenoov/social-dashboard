import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rotuloDoTipo, ehVideo, lerPublicacoes, filtrar, ordenar, tiposPresentes,
  descricaoDaPublicacao, ORDENS, AVISO_STORIES,
} from './conteudo-existente.js'

// Copiado da medição real do perfil @vessel.brasil, 03/08/2026.
const CRU = [
  { id: '1', caption: 'Meses de criação.\nCada detalhe pensado', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', like_count: 12, comments_count: 4, timestamp: '2026-08-04T00:00:01+0000', thumbnail_url: '', media_url: 'https://x/1.jpg' },
  { id: '2', caption: 'Para dias imprevisíveis, materiais inabaláveis.', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 36, comments_count: 4, timestamp: '2026-07-25T21:00:33+0000', thumbnail_url: 'https://x/2.jpg', media_url: 'https://x/2.mp4' },
  { id: '3', caption: 'Alguns sons anunciam grandes mudanças.', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 48, comments_count: 9, timestamp: '2026-07-22T21:01:17+0000', thumbnail_url: 'https://x/3.jpg' },
  { id: '4', caption: 'Toda grande transformação começa com um passo', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 84, comments_count: 16, timestamp: '2026-07-20T21:01:04+0000', thumbnail_url: 'https://x/4.jpg' },
]

test('o tipo sai em portugues, e separa Reels de post de feed', () => {
  assert.equal(rotuloDoTipo({ media_product_type: 'REELS', media_type: 'VIDEO' }), 'Reels')
  assert.equal(rotuloDoTipo({ media_product_type: 'FEED', media_type: 'CAROUSEL_ALBUM' }), 'Carrossel')
  assert.equal(rotuloDoTipo({ media_product_type: 'FEED', media_type: 'IMAGE' }), 'Foto')
  assert.equal(rotuloDoTipo({ media_product_type: 'STORY', media_type: 'IMAGE' }), 'Story')
})

test('a miniatura de VIDEO nao pode ser o arquivo do video', () => {
  // `media_url` de vídeo é o .mp4 — pesado e às vezes bloqueado. Quem serve de
  // capa é o `thumbnail_url`.
  const p = lerPublicacoes(CRU)
  assert.equal(p[1].miniatura, 'https://x/2.jpg')
  // Foto não tem thumbnail: aí o media_url É a imagem.
  assert.equal(p[0].miniatura, 'https://x/1.jpg')
  assert.equal(ehVideo(CRU[1]), true)
  assert.equal(ehVideo(CRU[0]), false)
})

test('a descricao responde "qual delas o publico gostou mais"', () => {
  const p = lerPublicacoes(CRU)
  assert.equal(descricaoDaPublicacao(p[3]), '20/07 · Reels · 84 curtidas, 16 comentários')
  // Singular concorda.
  assert.match(descricaoDaPublicacao({ data: '2026-07-01T15:00:00+0000', tipo: 'Foto', curtidas: 1, comentarios: 1 }), /1 curtida, 1 comentário$/)
  // Sem engajamento nenhum não inventa "0 curtidas".
  assert.equal(descricaoDaPublicacao({ data: '2026-07-01T15:00:00+0000', tipo: 'Foto', curtidas: 0, comentarios: 0 }), '01/07 · Foto')
})

test('a busca ignora acento e caixa', () => {
  // Quem procura "criacao" tem que achar "criação".
  const p = lerPublicacoes(CRU)
  assert.deepEqual(filtrar(p, 'CRIACAO').map((x) => x.id), ['1'])
  assert.deepEqual(filtrar(p, 'transformacao').map((x) => x.id), ['4'])
  assert.equal(filtrar(p, '').length, 4)
})

test('da pra filtrar por tipo — e a busca casa com o tipo tambem', () => {
  const p = lerPublicacoes(CRU)
  assert.equal(filtrar(p, '', 'Reels').length, 3)
  assert.equal(filtrar(p, '', 'Carrossel').length, 1)
  assert.equal(filtrar(p, '', 'todos').length, 4)
  assert.equal(filtrar(p, 'reels').length, 3)
})

test('so oferece filtro dos tipos que a conta REALMENTE tem', () => {
  // Oferecer "Story" numa conta sem stories é um botão que só decepciona.
  assert.deepEqual(tiposPresentes(lerPublicacoes(CRU)), ['Carrossel', 'Reels'])
  assert.deepEqual(tiposPresentes([]), [])
})

test('ordenar por engajamento poe comentario acima de curtida', () => {
  // Comentário custa mais para quem faz — vale mais que curtida, como na régua.
  const p = ordenar(lerPublicacoes(CRU), 'engajadas')
  assert.deepEqual(p.map((x) => x.id), ['4', '3', '2', '1'])
  const r = ordenar(lerPublicacoes(CRU), 'recentes')
  assert.deepEqual(r.map((x) => x.id), ['1', '2', '3', '4'])
  assert.equal(ORDENS.length, 2)
})

test('o aviso dos stories explica a lista vazia ANTES de ela assustar', () => {
  assert.match(AVISO_STORIES, /24 horas/)
  assert.match(AVISO_STORIES, /costuma estar vazia/)
})

test('publicacao sem id some, e a lista nunca estoura', () => {
  assert.deepEqual(lerPublicacoes([null, {}, { id: '9' }]).map((p) => p.id), ['9'])
  assert.deepEqual(lerPublicacoes(null), [])
})

test('a data sai no fuso de quem olha, e nao em UTC', () => {
  // A Meta manda tudo em UTC. Um post das 00:00 UTC saiu às 21:00 do dia
  // ANTERIOR no Brasil — e é esse o dia que a pessoa lembra de ter publicado.
  // Mostrar "01/07" para quem postou dia 30 à noite seria discordar da memória
  // dela. Este teste trava a escolha para ela não ser desfeita sem querer.
  const emUtcMeiaNoite = descricaoDaPublicacao({ data: '2026-07-01T00:00:00+0000', tipo: 'Foto' })
  const esperado = new Date('2026-07-01T00:00:00+0000')
  const dia = String(esperado.getDate()).padStart(2, '0')
  const mes = String(esperado.getMonth() + 1).padStart(2, '0')
  assert.equal(emUtcMeiaNoite, `${dia}/${mes} · Foto`)
})

test('data ruim nao vira "NaN/NaN"', () => {
  assert.equal(descricaoDaPublicacao({ data: 'qualquer coisa', tipo: 'Foto' }), 'Foto')
  assert.equal(descricaoDaPublicacao({}), '')
})
