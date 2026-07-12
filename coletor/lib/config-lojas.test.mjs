import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarLegenda, carregarMarcasELojas } from './config-lojas.mjs';

test('montarLegenda substitui placeholders', () => {
  assert.equal(montarLegenda('{desconto} em bolsas {marca} · chame', { desconto: '50% OFF', marca: 'La Vessel' }),
    '50% OFF em bolsas La Vessel · chame');
});

test('carregarMarcasELojas junta loja+marca via sbGet injetado', async () => {
  const fake = async (p) => p.startsWith('/fabrica_marcas')
    ? [{ id: 'm1', nome: 'La Vessel', caption_template: 'x', ad_account: 'act_1', page_id: 'P', ig_id: 'I', account_id: 'A', ativo: true }]
    : [{ deposito_id: 'd1', nome: 'Tivoli', ativo: true, marca_id: 'm1', whatsapp: '+55', geo_cities: [1, 2], canal_loja_id: 'c1' }];
  const r = await carregarMarcasELojas(fake);
  assert.equal(r.lojas[0].marca.adAccount, 'act_1');
  assert.equal(r.lojas[0].whatsapp, '+55');
  assert.equal(r.marcaAtiva.nome, 'La Vessel');
});
