// coletor/lib/storage-upload.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subirStorageResiliente } from './storage-upload.mjs';

const base = (over = {}) => ({
  url: 'https://x.supabase.co', sk: 'sk', bucket: 'fabrica-criativos',
  path: 'camp/produto/LV1-heroi-1080x1920.png', buf: Buffer.from('png'),
  sleepImpl: async () => {}, // sem espera real nos testes
  ...over,
});

test('sucesso na 1ª tentativa: retorna URL pública e chama fetch 1x', async () => {
  let n = 0;
  const url = await subirStorageResiliente(base({
    fetchImpl: async () => { n++; return { ok: true, status: 200 }; },
  }));
  assert.equal(n, 1);
  assert.equal(url, 'https://x.supabase.co/storage/v1/object/public/fabrica-criativos/camp/produto/LV1-heroi-1080x1920.png');
});

test('400 transitório: retenta e sucede (o bug real — nginx 400 no meio do lote)', async () => {
  let n = 0; let retries = 0;
  const url = await subirStorageResiliente(base({
    fetchImpl: async () => {
      n++;
      if (n < 3) return { ok: false, status: 400, text: async () => '<html>400 Bad Request</html>' };
      return { ok: true, status: 200 };
    },
    onRetry: () => { retries++; },
  }));
  assert.equal(n, 3);        // falhou 2x, subiu na 3ª
  assert.equal(retries, 2);  // onRetry chamado a cada falha antes do sucesso
  assert.ok(url.endsWith('.png'));
});

test('erro de rede (fetch lança): também é retentado', async () => {
  let n = 0;
  const url = await subirStorageResiliente(base({
    fetchImpl: async () => { n++; if (n < 2) throw new Error('ECONNRESET'); return { ok: true, status: 200 }; },
  }));
  assert.equal(n, 2);
  assert.ok(url.endsWith('.png'));
});

test('falha persistente: esgota tentativas e lança o último erro', async () => {
  let n = 0;
  await assert.rejects(
    subirStorageResiliente(base({
      tentativas: 3,
      fetchImpl: async () => { n++; return { ok: false, status: 400, text: async () => 'nope' }; },
    })),
    /upload .* 400 nope/,
  );
  assert.equal(n, 3); // tentou exatamente `tentativas` vezes
});
