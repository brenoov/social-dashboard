import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOF_SPEC, nomeAd, payloadCriativa } from './meta-subir.mjs';

test('DOF_SPEC tem features todas OPT_OUT', () => {
  const f = DOF_SPEC.creative_features_spec;
  assert.ok(Object.keys(f).length >= 80);
  assert.ok(Object.values(f).every((v) => v.enroll_status === 'OPT_OUT'));
});

test('nomeAd é determinístico e <=200 chars', () => {
  const a = nomeAd('Estudio · Tivoli', 'ABC.png', '[VENDAS] SALE 50% | TIVOLI [Rmkt]');
  assert.equal(a, nomeAd('Estudio · Tivoli', 'ABC.png', '[VENDAS] SALE 50% | TIVOLI [Rmkt]'));
  assert.ok(a.length <= 200);
});

test('payloadCriativa: conjunto WhatsApp-puro usa link_data+WHATSAPP_MESSAGE, sem asset_feed_spec', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'WHATSAPP', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.object_story_spec.link_data.call_to_action.type, 'WHATSAPP_MESSAGE');
  assert.equal(p.asset_feed_spec, undefined);
  assert.ok(p.degrees_of_freedom_spec);
});

test('payloadCriativa: conjunto multi-destino usa asset_feed_spec com 3 CTAs', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.asset_feed_spec.optimization_type, 'DOF_MESSAGING_DESTINATION');
  assert.equal(p.asset_feed_spec.call_to_actions.length, 3);
});
