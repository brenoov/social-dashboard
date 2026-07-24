// src/compartilhado/notificacoes-push.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Este módulo puxa, na cadeia de imports, o conectar-no-banco-de-dados.js, que
// chama window.supabase.createClient() assim que carrega. No navegador o window
// existe; aqui no node, não. Então fingimos um window mínimo ANTES de importar —
// por isso o import é dinâmico e não estático, senão ele rodaria primeiro.
globalThis.window = { supabase: { createClient: () => ({}) } };
const { urlBase64ToUint8Array } = await import('./notificacoes-push.js');

test('urlBase64ToUint8Array: decodifica VAPID base64url para bytes', () => {
  // "BLc" base64url -> 2 bytes conhecidos
  const out = urlBase64ToUint8Array('BLc');
  assert.ok(out instanceof Uint8Array);
  assert.equal(out.length, 2);       // "BLc" (3 chars b64) = 2 bytes
  assert.equal(out[0], 0x04);
  assert.equal(out[1], 0xb7);
});
