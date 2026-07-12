import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOF_SPEC, nomeAd, payloadCriativa, subirCriativos } from './meta-subir.mjs';

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

test('payloadCriativa: branding (sem destination_type) usa link p/ IG + LEARN_MORE, sem asset_feed_spec', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: null, waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.object_story_spec.link_data.link, 'https://www.instagram.com/');
  assert.equal(p.object_story_spec.link_data.call_to_action.type, 'LEARN_MORE');
  assert.equal(p.object_story_spec.instagram_user_id, 'I');
  assert.equal(p.asset_feed_spec, undefined);
  assert.ok(p.degrees_of_freedom_spec);
});

test('payloadCriativa: branding com destination_type="none" (string) idem', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'none', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.object_story_spec.link_data.call_to_action.type, 'LEARN_MORE');
});

test('payloadCriativa: conjunto multi-destino usa asset_feed_spec com 3 CTAs', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.asset_feed_spec.optimization_type, 'DOF_MESSAGING_DESTINATION');
  assert.equal(p.asset_feed_spec.call_to_actions.length, 3);
});

// --- subirCriativos: idempotência, rate limit, IG fallback, skip-item ------------------------
const adset = (over = {}) => ({ id: 'as1', name: 'Conj A', destinationType: 'WHATSAPP', whatsapp: '5519999', ...over });
const item = (chave, getHash) => ({ chave, getHash });
const baseArgs = (over = {}) => ({ act: 'act_1', page: 'P', ig: 'I', prefixo: 'Estudio', mensagem: 'm', ...over });

test('subirCriativos: happy path — cria adcreative+ad e pendentes===0', async () => {
  const chamadas = [];
  const meta = async (path) => { chamadas.push(path); return { status: 200, d: { id: 'x' } }; };
  const ads = [];
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => 'h1')],
    adsets: [adset()],
    jaTem: new Set(),
    onAd: ({ adId }) => ads.push(adId),
  }));
  assert.equal(res.criados, 1);
  assert.equal(res.pendentes, 0);
  assert.deepEqual(ads, ['x']);
  // 1 POST /adcreatives + 1 POST /ads
  assert.equal(chamadas.filter((p) => p.endsWith('/adcreatives')).length, 1);
  assert.equal(chamadas.filter((p) => p.endsWith('/ads')).length, 1);
});

test('subirCriativos: rate limit (code 17) para e devolve pendentes>0', async () => {
  const meta = async () => { throw new Error('adcreative erro code 17: request limit reached'); };
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => 'h1')],
    adsets: [adset()],
    jaTem: new Set(),
  }));
  assert.ok(res.pendentes > 0);
  assert.equal(res.rateLimited, true);
  assert.equal(res.criados, 0);
});

test('subirCriativos: item×adset já em jaTem é pulado (sem chamar meta)', async () => {
  let metaCalls = 0;
  const meta = async () => { metaCalls++; return { status: 200, d: { id: 'x' } }; };
  const a = adset();
  const nome = nomeAd('Estudio', 'c1', a.name);
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => 'h1')],
    adsets: [a],
    jaTem: new Set([`${a.id}::${nome}`]),
  }));
  assert.equal(res.criados, 0);
  assert.equal(metaCalls, 0);
});

test('subirCriativos: pula o ITEM inteiro (sem upload) se todos os adsets já existem', async () => {
  let uploads = 0;
  const meta = async () => { throw new Error('não deveria chamar meta'); };
  const a1 = adset({ id: 'as1', name: 'A' });
  const a2 = adset({ id: 'as2', name: 'B' });
  const jaTem = new Set([
    `${a1.id}::${nomeAd('Estudio', 'c1', a1.name)}`,
    `${a2.id}::${nomeAd('Estudio', 'c1', a2.name)}`,
  ]);
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => { uploads++; return 'h1'; })],
    adsets: [a1, a2],
    jaTem,
  }));
  assert.equal(res.criados, 0);
  assert.equal(uploads, 0); // getHash NÃO chamado — item pulado antes do upload
});

test('subirCriativos: item.mensagem (legenda por produto) vira link_data.message', async () => {
  const posts = [];
  const meta = async (path, params) => {
    if (path.endsWith('/adcreatives')) { posts.push(params); return { status: 200, d: { id: 'cr' } }; }
    return { status: 200, d: { id: 'ad' } };
  };
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [{ chave: 'c1', getHash: async () => 'h1', mensagem: 'LEGENDA POR PRODUTO' }],
    adsets: [adset()],
    jaTem: new Set(),
  }));
  assert.equal(res.criados, 1);
  assert.equal(posts[0].object_story_spec.link_data.message, 'LEGENDA POR PRODUTO');
});

test('subirCriativos: item sem mensagem cai na mensagem global (fallback de marca)', async () => {
  const posts = [];
  const meta = async (path, params) => {
    if (path.endsWith('/adcreatives')) { posts.push(params); return { status: 200, d: { id: 'cr' } }; }
    return { status: 200, d: { id: 'ad' } };
  };
  await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => 'h1')], // sem mensagem
    adsets: [adset()],
    jaTem: new Set(),
    mensagem: 'LEGENDA DE MARCA',
  }));
  assert.equal(posts[0].object_story_spec.link_data.message, 'LEGENDA DE MARCA');
});

test('subirCriativos: fallback de Instagram — refaz adcreative SEM instagram_user_id', async () => {
  const posts = [];
  const meta = async (path, params) => {
    if (path.endsWith('/adcreatives')) {
      posts.push(params);
      // 1ª tentativa (com IG) falha com erro de instagram_user_id; 2ª passa
      if (posts.length === 1) return { status: 400, d: { error: { message: 'instagram_user_id must be a valid Instagram account id' } } };
      return { status: 200, d: { id: 'cr' } };
    }
    return { status: 200, d: { id: 'ad' } };
  };
  const res = await subirCriativos(baseArgs({
    meta,
    itens: [item('c1', async () => 'h1')],
    adsets: [adset()],
    jaTem: new Set(),
  }));
  assert.equal(res.criados, 1);
  assert.equal(posts.length, 2);
  assert.ok(posts[0].object_story_spec.instagram_user_id, 'primeira tentativa manda instagram_user_id');
  assert.equal(posts[1].object_story_spec.instagram_user_id, undefined, 'retry sem instagram_user_id');
});
