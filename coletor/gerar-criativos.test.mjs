import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, objetivoPermitePromo } from './gerar-criativos.mjs';

test('run() é exportada e aceita opts', () => {
  assert.equal(typeof run, 'function');
});

test('run({dry:true, limite:0}) sem itens/--estrela falha rápido (fabrica_rodadas/candidatos foram dropadas na migration 019)', async () => {
  await assert.rejects(
    () => run({ dry: true, limite: 0 }),
    /forneça itens \(modo Estúdio\) ou --estrela/
  );
});

test('run() aceita objetivo no destructuring (não quebra a assinatura) — mesmo guard de itens/--estrela, agora com objetivo', async () => {
  // itens:[] cai no mesmo guard "forneça itens ou --estrela" de antes (candsDeItens
  // trata array vazio como ausente); o que este teste garante é que adicionar
  // `objetivo` ao destructuring/filtro não muda esse comportamento nem lança um
  // erro diferente (ex.: ReferenceError por causa do novo bloco de filtro).
  await assert.rejects(
    () => run({ dry: true, objetivo: 'branding', itens: [] }),
    /forneça itens \(modo Estúdio\) ou --estrela/
  );
});

test('objetivoPermitePromo: branding não permite promo; engajamento sim; null sim', () => {
  assert.equal(objetivoPermitePromo('branding'), false);
  assert.equal(objetivoPermitePromo('engajamento'), true);
  assert.equal(objetivoPermitePromo('conversao'), true);
  assert.equal(objetivoPermitePromo('trafego'), true);
  assert.equal(objetivoPermitePromo(null), true);
});
