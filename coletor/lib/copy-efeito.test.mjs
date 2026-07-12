// Testa gerarCopysProduto: parse do JSON (copy/nome/legenda) + fallback robusto.
// O motor usa a `fetch` global (dentro de anthropic()), então injetamos a resposta
// stubando global.fetch. A chave da API é lida no topo do módulo, por isso o env é
// setado ANTES do import dinâmico (imports estáticos são avaliados cedo demais).
process.env.ANTHROPIC_API_KEY_FABRICA = process.env.ANTHROPIC_API_KEY_FABRICA || 'test-key';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { gerarCopysProduto } = await import('./copy-efeito.mjs');

const fetchOriginal = global.fetch;
function stubFetch(fn) { global.fetch = fn; }
function restoreFetch() { global.fetch = fetchOriginal; }

// resposta OK da Anthropic com um bloco ```json contendo copy/nome/legenda por sku
function respostaOk(texto) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ content: [{ type: 'text', text: texto }] }) };
}

test('gerarCopysProduto: parseia copy + nome + legenda por SKU', async () => {
  const json = '```json\n' + JSON.stringify({
    ABC: { copy: 'Elegância que dura', nome: 'Bolsa Viena', legenda: 'A Bolsa Viena chegou com 50% OFF ✨ Peça única — chame no WhatsApp!' },
  }) + '\n```';
  stubFetch(async () => respostaOk(json));
  try {
    const map = await gerarCopysProduto([{ sku: 'ABC', nome: 'Bolsa De Ombro Viena Marinho' }], { desconto_pct: 50, marca: 'La Vessel' });
    const item = map.get('ABC');
    assert.equal(item.copy, 'Elegância que dura');
    assert.equal(item.nome, 'Bolsa Viena');
    assert.equal(item.legenda, 'A Bolsa Viena chegou com 50% OFF ✨ Peça única — chame no WhatsApp!');
  } finally { restoreFetch(); }
});

test('gerarCopysproduto: legenda ausente no JSON vira null (fallback pra legenda de marca no subir)', async () => {
  const json = '```json\n' + JSON.stringify({ ABC: { copy: 'Só hoje', nome: 'Bolsa Madrid' } }) + '\n```';
  stubFetch(async () => respostaOk(json));
  try {
    const map = await gerarCopysProduto([{ sku: 'ABC', nome: 'Bolsa Madrid Preto' }], { desconto_pct: 40, marca: 'La Vessel' });
    const item = map.get('ABC');
    assert.equal(item.copy, 'Só hoje');
    assert.equal(item.nome, 'Bolsa Madrid');
    assert.equal(item.legenda, null);
  } finally { restoreFetch(); }
});

test('gerarCopysProduto: JSON inválido cai no fallback SEM lançar (copy fallback, legenda null)', async () => {
  stubFetch(async () => respostaOk('isto não é json'));
  try {
    const map = await gerarCopysProduto([{ sku: 'ABC', nome: 'Bolsa De Ombro Viena Marinho' }], { desconto_pct: 50 });
    const item = map.get('ABC');
    assert.ok(typeof item.copy === 'string' && item.copy.length > 0);
    assert.ok(typeof item.nome === 'string' && item.nome.length > 0);
    assert.equal(item.legenda, null);
  } finally { restoreFetch(); }
});

test('gerarCopysProduto: lista vazia devolve Map vazio (sem chamar fetch)', async () => {
  let chamou = false;
  stubFetch(async () => { chamou = true; return respostaOk('{}'); });
  try {
    const map = await gerarCopysProduto([], { desconto_pct: 50 });
    assert.equal(map.size, 0);
    assert.equal(chamou, false);
  } finally { restoreFetch(); }
});
