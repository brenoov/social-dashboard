import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESCOPOS_DE_PUBLICACAO_LIBERADOS,
  publicacaoAutomaticaLigada,
  publicarPeca,
  legendaFinal,
  arquivosEmOrdem,
  faltaParaPublicar,
  paramsDoContainer,
  paramsDoAlbum,
  precisaEsperar,
  MAXIMO_DO_CARROSSEL,
  TENTATIVAS_DE_VIDEO,
} from './publicar-instagram.js'

const peca = { id: 'p1', titulo: 'Post', formato: 'feed', legenda: 'oi' }
const arquivos = [{ caminho: 'a/b/1.jpg', tipo: 'imagem' }]

// ─────────────────────────────────────────────────────────────────────────────
// O INTERRUPTOR

test('hoje a Meta ainda NAO liberou os escopos de publicacao', () => {
  // Este é o interruptor da fase seguinte. Quando o App Review sair, vira true
  // e o resto do sistema acompanha sem nenhuma outra mudança.
  assert.equal(ESCOPOS_DE_PUBLICACAO_LIBERADOS, false)
})

test('nenhuma conta publica sozinha enquanto o escopo nao existe', () => {
  assert.equal(publicacaoAutomaticaLigada({ publicacao_automatica: true }), false)
  assert.equal(publicacaoAutomaticaLigada({ publicacao_automatica: false }), false)
  assert.equal(publicacaoAutomaticaLigada(null), false)
})

test('publicarPeca devolve modo manual, com motivo legivel', async () => {
  const r = await publicarPeca(peca, arquivos, { publicacao_automatica: true })
  assert.equal(r.modo, 'manual')
  assert.ok(r.motivo && r.motivo.length > 10)
  assert.equal(r.ig_media_id, null)
})

test('publicarPeca NUNCA vai na rede enquanto esta em modo manual', async () => {
  // Se um dia alguém implementar por cima sem trocar o interruptor, este teste
  // quebra antes de a função tentar postar de verdade na conta de um cliente.
  const fetchOriginal = globalThis.fetch
  let chamou = false
  globalThis.fetch = () => { chamou = true; return Promise.reject(new Error('não deveria')) }
  try {
    await publicarPeca(peca, arquivos, { publicacao_automatica: true, access_token: 'x' })
  } finally {
    globalThis.fetch = fetchOriginal
  }
  assert.equal(chamou, false, 'a função tentou falar com a Meta em modo manual')
})

test('sem arquivo nenhum tambem devolve manual, sem explodir', async () => {
  const r = await publicarPeca(peca, [], {})
  assert.equal(r.modo, 'manual')
})

// ─────────────────────────────────────────────────────────────────────────────
// AS REGRAS, sem rede

test('a legenda que vai pro Instagram e legenda + hashtags, na ordem do casamento', () => {
  // TEM que bater com casar-publicacao.js: é por esse texto que a Fase 3
  // reconhece o post publicado como sendo desta peça.
  assert.equal(legendaFinal({ legenda: 'Bolsa nova', hashtags: '#bolsa #couro' }), 'Bolsa nova #bolsa #couro')
  assert.equal(legendaFinal({ legenda: '  Bolsa  ', hashtags: '' }), 'Bolsa')
  assert.equal(legendaFinal({}), '')
})

test('os arquivos saem NA ORDEM da coluna, nao na que o banco devolveu', () => {
  const fora = [
    { caminho: 'c.jpg', tipo: 'imagem', ordem: 3 },
    { caminho: 'a.jpg', tipo: 'imagem', ordem: 1 },
    { caminho: 'b.jpg', tipo: 'imagem', ordem: 2 },
  ]
  assert.deepEqual(arquivosEmOrdem(fora).map((a) => a.caminho), ['a.jpg', 'b.jpg', 'c.jpg'])
})

test('arquivo sem caminho ou de tipo estranho e descartado', () => {
  const lista = arquivosEmOrdem([
    { caminho: '', tipo: 'imagem' }, { caminho: 'x.pdf', tipo: 'documento' }, { caminho: 'ok.jpg', tipo: 'imagem' },
  ])
  assert.deepEqual(lista.map((a) => a.caminho), ['ok.jpg'])
})

test('carrossel cobra o minimo e o maximo do Instagram, em portugues', () => {
  const um = faltaParaPublicar({ formato: 'carrossel' }, [{ caminho: '1.jpg', tipo: 'imagem' }])
  assert.match(um[0], /pelo menos 2/)

  const onze = Array.from({ length: MAXIMO_DO_CARROSSEL + 1 }, (_, i) => ({ caminho: `${i}.jpg`, tipo: 'imagem', ordem: i }))
  const demais = faltaParaPublicar({ formato: 'carrossel' }, onze)
  assert.match(demais[0], /no máximo 10/)

  assert.deepEqual(faltaParaPublicar({ formato: 'carrossel' }, onze.slice(0, 3)), [])
})

test('feed com dois arquivos e recusado — publicaria so um em silencio', () => {
  const f = faltaParaPublicar({ formato: 'feed' }, [
    { caminho: '1.jpg', tipo: 'imagem', ordem: 1 }, { caminho: '2.jpg', tipo: 'imagem', ordem: 2 },
  ])
  assert.match(f[0], /um arquivo só/)
})

test('reels sem video e recusado antes de a Meta recusar', () => {
  const f = faltaParaPublicar({ formato: 'reels' }, [{ caminho: '1.jpg', tipo: 'imagem' }])
  assert.ok(f.some((x) => /Reels precisa ser vídeo/.test(x)))
})

test('feed de foto: image_url e caption, e NENHUM media_type', () => {
  // Foto no feed é o caso mais comum e o único sem media_type na documentação.
  const p = paramsDoContainer({ peca: { formato: 'feed', legenda: 'oi', hashtags: '#a' }, arquivo: { tipo: 'imagem' }, url: 'https://x/1.jpg' })
  assert.deepEqual(p, { image_url: 'https://x/1.jpg', caption: 'oi #a' })
})

test('reels manda REELS e video_url', () => {
  const p = paramsDoContainer({ peca: { formato: 'reels', legenda: 'oi' }, arquivo: { tipo: 'video' }, url: 'https://x/1.mp4' })
  assert.equal(p.media_type, 'REELS')
  assert.equal(p.video_url, 'https://x/1.mp4')
  assert.equal(p.image_url, undefined)
})

test('stories NAO leva legenda — no Instagram ela nao existe', () => {
  const p = paramsDoContainer({ peca: { formato: 'stories', legenda: 'oi', hashtags: '#a' }, arquivo: { tipo: 'imagem' }, url: 'https://x/1.jpg' })
  assert.equal(p.media_type, 'STORIES')
  assert.equal(p.caption, undefined, 'legenda em stories é texto que ninguém vê')
})

test('filho de carrossel leva is_carousel_item e NAO leva legenda', () => {
  // Legenda no filho não dá erro — ela simplesmente não aparece. É por isso
  // que engana, e é por isso que tem teste.
  const p = paramsDoContainer({ peca: { formato: 'carrossel', legenda: 'oi' }, arquivo: { tipo: 'imagem' }, url: 'https://x/1.jpg', ehFilho: true })
  assert.equal(p.is_carousel_item, 'true')
  assert.equal(p.caption, undefined)
  assert.equal(p.media_type, undefined)
})

test('o album leva CAROUSEL, os filhos por virgula, e a legenda', () => {
  const p = paramsDoAlbum({ formato: 'carrossel', legenda: 'oi', hashtags: '#a' }, ['1', '2', '3'])
  assert.deepEqual(p, { media_type: 'CAROUSEL', children: '1,2,3', caption: 'oi #a' })
})

test('so video espera processamento', () => {
  assert.equal(precisaEsperar({ tipo: 'video' }), true)
  assert.equal(precisaEsperar({ tipo: 'imagem' }), false)
})

// ─────────────────────────────────────────────────────────────────────────────
// A SEQUÊNCIA INTEIRA, com uma Meta de mentira.
//
// É o único jeito de provar isto antes do App Review: a conta de verdade recusa
// tudo hoje. `deps` existe para isto — sem ele, esta parte só seria conferida no
// dia em que postasse pela primeira vez, na conta do dono.

// Liga o interruptor SÓ para este teste, sem tocar no arquivo: importa uma cópia
// do módulo com o valor trocado. Assim o `false` do arquivo continua sendo a
// verdade que o resto do sistema lê.
async function moduloLigado() {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('./publicar-instagram.js', import.meta.url), 'utf8')
    .replace('export const ESCOPOS_DE_PUBLICACAO_LIBERADOS = false;',
      'export const ESCOPOS_DE_PUBLICACAO_LIBERADOS = true;')
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
}

const contaOk = { publicacao_automatica: true, instagram_id: '17841462952561833', access_token: 'TOKEN' }

// Uma Meta de mentira que guarda o que recebeu. `respostas` decide o que ela
// devolve em cada chamada, na ordem.
function metaFalsa(respostas) {
  const chamadas = []
  let i = 0
  const fetch = async (url, opcoes) => {
    const corpo = opcoes?.body ? Object.fromEntries(new URLSearchParams(opcoes.body)) : null
    chamadas.push({ url: String(url), corpo })
    const r = respostas[Math.min(i++, respostas.length - 1)]
    return { json: async () => (typeof r === 'function' ? r(chamadas.length) : r) }
  }
  return { chamadas, deps: { fetch, esperar: async () => {}, urlAssinada: async (c) => `https://assinada/${c}` } }
}

test('foto no feed: cria o conteiner e publica, nessa ordem', async () => {
  const m = await moduloLigado()
  const { chamadas, deps } = metaFalsa([{ id: 'CONTAINER' }, { id: 'MEDIA' }])
  const r = await m.publicarPeca({ formato: 'feed', legenda: 'oi' }, [{ caminho: 'x/1.jpg', tipo: 'imagem', ordem: 1 }], contaOk, deps)

  assert.equal(r.modo, 'automatico')
  assert.equal(r.ig_media_id, 'MEDIA')
  assert.equal(chamadas.length, 2)
  assert.match(chamadas[0].url, /\/17841462952561833\/media$/)
  assert.equal(chamadas[0].corpo.image_url, 'https://assinada/x/1.jpg')
  assert.match(chamadas[1].url, /\/media_publish$/)
  assert.equal(chamadas[1].corpo.creation_id, 'CONTAINER', 'publicou um contêiner que não é o que criou')
})

test('carrossel: um conteiner por foto, o album, e o publish do album', async () => {
  const m = await moduloLigado()
  const { chamadas, deps } = metaFalsa([{ id: 'F1' }, { id: 'F2' }, { id: 'ALBUM' }, { id: 'MEDIA' }])
  const r = await m.publicarPeca(
    { formato: 'carrossel', legenda: 'oi' },
    [{ caminho: 'b.jpg', tipo: 'imagem', ordem: 2 }, { caminho: 'a.jpg', tipo: 'imagem', ordem: 1 }],
    contaOk, deps,
  )
  assert.equal(r.ig_media_id, 'MEDIA')
  assert.equal(chamadas.length, 4)
  // A ORDEM DAS FOTOS é a da coluna `ordem`, não a que veio na lista.
  assert.equal(chamadas[0].corpo.image_url, 'https://assinada/a.jpg')
  assert.equal(chamadas[1].corpo.image_url, 'https://assinada/b.jpg')
  assert.equal(chamadas[2].corpo.children, 'F1,F2')
  assert.equal(chamadas[2].corpo.media_type, 'CAROUSEL')
  assert.equal(chamadas[3].corpo.creation_id, 'ALBUM')
})

test('video: espera ficar FINISHED antes de publicar', async () => {
  const m = await moduloLigado()
  // 1: cria contêiner · 2: IN_PROGRESS · 3: FINISHED · 4: publish
  const { chamadas, deps } = metaFalsa([
    { id: 'C' }, { status_code: 'IN_PROGRESS' }, { status_code: 'FINISHED' }, { id: 'MEDIA' },
  ])
  const r = await m.publicarPeca({ formato: 'reels', legenda: 'oi' }, [{ caminho: 'v.mp4', tipo: 'video', ordem: 1 }], contaOk, deps)
  assert.equal(r.modo, 'automatico')
  assert.equal(r.ig_media_id, 'MEDIA')
  assert.match(chamadas[3].url, /media_publish/)
})

test('video que nao termina a tempo NAO e publicado — vira aviso', async () => {
  // O caso que precisa estar certo: nada pior que marcar como publicada uma
  // peça que não saiu.
  const m = await moduloLigado()
  const { chamadas, deps } = metaFalsa([{ id: 'C' }, { status_code: 'IN_PROGRESS' }])
  const r = await m.publicarPeca({ formato: 'reels' }, [{ caminho: 'v.mp4', tipo: 'video', ordem: 1 }], contaOk, deps)

  assert.equal(r.modo, 'manual')
  assert.equal(r.ig_media_id, null)
  assert.match(r.motivo, /processando/)
  assert.ok(!chamadas.some((c) => /media_publish/.test(c.url)), 'publicou um vídeo que não estava pronto')
  assert.equal(chamadas.length, 1 + TENTATIVAS_DE_VIDEO, 'não respeitou o limite de tentativas')
})

test('video com ERROR para na hora, sem gastar as tentativas', async () => {
  const m = await moduloLigado()
  const { chamadas, deps } = metaFalsa([{ id: 'C' }, { status_code: 'ERROR', status: 'formato não suportado' }])
  await assert.rejects(
    () => m.publicarPeca({ formato: 'reels' }, [{ caminho: 'v.mp4', tipo: 'video', ordem: 1 }], contaOk, deps),
    /não conseguiu processar/,
  )
  assert.equal(chamadas.length, 2)
})

test('erro da Meta chega INTEIRO, com a explicacao dela', async () => {
  const m = await moduloLigado()
  const { deps } = metaFalsa([{ error: { code: 10, message: 'Requires permission', error_user_msg: 'Peça a permissão no App Review.' } }])
  await assert.rejects(
    () => m.publicarPeca({ formato: 'feed' }, [{ caminho: '1.jpg', tipo: 'imagem', ordem: 1 }], contaOk, deps),
    /App Review/,
  )
})

test('conta sem instagram ou sem token vira manual, e nao vai na rede', async () => {
  const m = await moduloLigado()
  const { chamadas, deps } = metaFalsa([{ id: 'X' }])
  const r = await m.publicarPeca({ formato: 'feed' }, [{ caminho: '1.jpg', tipo: 'imagem', ordem: 1 }],
    { publicacao_automatica: true, instagram_id: '', access_token: 'T' }, deps)
  assert.equal(r.modo, 'manual')
  assert.equal(chamadas.length, 0)
})

test('sem urlAssinada a funcao RECLAMA em vez de publicar sem imagem', async () => {
  const m = await moduloLigado()
  await assert.rejects(
    () => m.publicarPeca({ formato: 'feed' }, [{ caminho: '1.jpg', tipo: 'imagem', ordem: 1 }], contaOk, { fetch: async () => ({ json: async () => ({ id: 'x' }) }) }),
    /urlAssinada/,
  )
})
