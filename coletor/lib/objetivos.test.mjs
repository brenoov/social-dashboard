import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapaObjetivo, montaPromotedObject, looksDoObjetivo } from './objetivos.mjs';

const ROWS = [
  { chave: 'engajamento', looks: ['engajamento'], destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' },
  { chave: 'branding', looks: ['branding'], destination_type: null, promoted_object_tipo: 'none' },
];
const porChave = new Map(ROWS.map((r) => [r.chave, r]));

test('mapaObjetivo devolve a linha e faz fallback p/ engajamento', () => {
  assert.equal(mapaObjetivo(porChave, 'branding').chave, 'branding');
  assert.equal(mapaObjetivo(porChave, 'inexistente').chave, 'engajamento');
});

test('mapaObjetivo lança se nem engajamento existe', () => {
  assert.throws(() => mapaObjetivo(new Map(), 'x'), /objetivo/);
});

test('montaPromotedObject por tipo', () => {
  const marca = { pageId: 'P', igId: 'IG' };
  const loja = { whatsapp: '55349...' };
  assert.deepEqual(montaPromotedObject('whatsapp', marca, loja), { page_id: 'P', whatsapp_phone_number: '55349...' });
  assert.deepEqual(montaPromotedObject('page', marca, loja), { page_id: 'P' });
  assert.deepEqual(montaPromotedObject('ig', marca, loja), { instagram_user_id: 'IG' });
  assert.equal(montaPromotedObject('none', marca, loja), undefined);
});

test('looksDoObjetivo faz interseção; looks vazio = todos', () => {
  const disp = ['produto-heroi', 'branding', 'preco-tipo'];
  assert.deepEqual(looksDoObjetivo({ looks: ['branding'] }, disp), ['branding']);
  assert.deepEqual(looksDoObjetivo({ looks: [] }, disp), disp);
});
