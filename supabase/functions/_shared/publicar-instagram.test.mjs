import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESCOPOS_DE_PUBLICACAO_LIBERADOS,
  publicacaoAutomaticaLigada,
  publicarPeca,
} from './publicar-instagram.js'

const peca = { id: 'p1', titulo: 'Post', formato: 'feed', legenda: 'oi' }
const arquivos = [{ caminho: 'a/b/1.jpg', tipo: 'imagem' }]

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
