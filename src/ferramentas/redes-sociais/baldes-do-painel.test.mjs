import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALDES, baldeDaCampanha, rotuloDoBalde, idsDoBalde } from './baldes-do-painel.js';

// TODAS as campanhas abaixo são REAIS: nome, objetivo e gasto conferidos no banco
// de produção em 17/08/2026. Os conjuntos são o sinal que a Meta afirma.

test('campanha de engajamento com destino WhatsApp é CONTATOS, não seguidores', () => {
  // Vessel: R$ 2.254 em 30 dias. É 87% do dinheiro "de engajamento" dessa conta.
  const c = { objective: 'OUTCOME_ENGAGEMENT', conjuntos: [{ destination_type: 'WHATSAPP', optimization_goal: 'CONVERSATIONS' }] };
  assert.equal(baldeDaCampanha(c), 'contatos');
});

test('campanha de cadastro é CONTATOS mesmo com objetivo de engajamento', () => {
  // Motoeasy: "[LEADS] NEGATIVADO? | P3 | TESTE OBJ ENGAJAMENTO", R$ 98,22.
  const c = { objective: 'OUTCOME_LEADS', conjuntos: [{ destination_type: null, optimization_goal: 'LEAD_GENERATION' }] };
  assert.equal(baldeDaCampanha(c), 'contatos');
});

test('tráfego com destino PERFIL é SEGUIDORES', () => {
  // Breno Vale: "[TRÁFEGO] GESTÃO EMPRESARIAL | PERFIL", R$ 2.584 — 100% da conta.
  const c = { objective: 'OUTCOME_TRAFFIC', conjuntos: [{ destination_type: 'INSTAGRAM_PROFILE', optimization_goal: 'PROFILE_VISIT' }] };
  assert.equal(baldeDaCampanha(c), 'seguidores');
});

test('engajamento na publicação é SEGUIDORES', () => {
  // Raíssa: "[ENGAJAMENTO] FEED | [P3]", R$ 3.710,64.
  const c = { objective: 'OUTCOME_ENGAGEMENT', conjuntos: [{ destination_type: 'ON_POST', optimization_goal: 'POST_ENGAGEMENT' }] };
  assert.equal(baldeDaCampanha(c), 'seguidores');
});

test('visualização de vídeo é SEGUIDORES', () => {
  const c = { objective: 'OUTCOME_ENGAGEMENT', conjuntos: [{ destination_type: 'ON_VIDEO', optimization_goal: 'THRUPLAY' }] };
  assert.equal(baldeDaCampanha(c), 'seguidores');
});

test('tráfego sem destino declarado é SITE E ALCANCE', () => {
  // Raíssa: "[TRÁFEGO] DIA DA BELEZA | [P3]", R$ 484,31 — vai pra fora do Instagram.
  const c = { objective: 'OUTCOME_TRAFFIC', conjuntos: [{ destination_type: null, optimization_goal: 'LINK_CLICKS' }] };
  assert.equal(baldeDaCampanha(c), 'site');
});

test('venda é VENDAS', () => {
  // Vessel: "[ATACADO - SALE] SUA VITRINE | MANUAL [30/07]", R$ 199,24.
  const c = { objective: 'OUTCOME_SALES', conjuntos: [{ destination_type: null, optimization_goal: 'OFFSITE_CONVERSIONS' }] };
  assert.equal(baldeDaCampanha(c), 'vendas');
});

test('conversa VENCE o objetivo declarado: um conjunto de WhatsApp basta', () => {
  // A regra que corrigiu R$ 15.177 na Gestão de Tráfego (PR #51).
  const c = { objective: 'OUTCOME_SALES', conjuntos: [
    { destination_type: null, optimization_goal: 'OFFSITE_CONVERSIONS' },
    { destination_type: 'WHATSAPP', optimization_goal: 'CONVERSATIONS' },
  ] };
  assert.equal(baldeDaCampanha(c), 'contatos');
});

test('campanha sem conjunto coletado cai pelo objetivo, e NUNCA some', () => {
  assert.equal(baldeDaCampanha({ objective: 'OUTCOME_TRAFFIC', conjuntos: [] }), 'site');
  assert.equal(baldeDaCampanha({ objective: 'OUTCOME_ENGAGEMENT', conjuntos: [] }), 'seguidores');
  assert.equal(baldeDaCampanha({ objective: 'OUTCOME_LEADS', conjuntos: null }), 'contatos');
  assert.equal(baldeDaCampanha({ objective: '', conjuntos: [] }), 'site');
  assert.equal(baldeDaCampanha({}), 'site');
  assert.equal(baldeDaCampanha(null), 'site');
});

test('LINK_CLICKS (objetivo antigo) é SITE E ALCANCE', () => {
  assert.equal(baldeDaCampanha({ objective: 'LINK_CLICKS', conjuntos: [] }), 'site');
});

test('reconhecimento cai em SITE E ALCANCE (não tem balde próprio)', () => {
  assert.equal(baldeDaCampanha({ objective: 'OUTCOME_AWARENESS', conjuntos: [] }), 'site');
});

test('a barra tem cinco baldes, nesta ordem', () => {
  assert.deepEqual(BALDES.map(b => b.id), ['todos', 'seguidores', 'contatos', 'site', 'vendas']);
  assert.equal(rotuloDoBalde('site'), 'Site e alcance');
  assert.equal(rotuloDoBalde('todos'), 'Todos');
});

test('NENHUMA campanha desaparece: a soma dos baldes é o total', () => {
  const campanhas = [
    { campaign_id: '1', objective: 'OUTCOME_ENGAGEMENT', conjuntos: [{ destination_type: 'WHATSAPP' }] },
    { campaign_id: '2', objective: 'OUTCOME_TRAFFIC', conjuntos: [{ destination_type: 'INSTAGRAM_PROFILE' }] },
    { campaign_id: '3', objective: 'OUTCOME_TRAFFIC', conjuntos: [] },
    { campaign_id: '4', objective: 'OUTCOME_SALES', conjuntos: [] },
    { campaign_id: '5', objective: 'BUGIGANGA_NOVA_DA_META', conjuntos: [] },
  ];
  const soma = ['seguidores', 'contatos', 'site', 'vendas']
    .reduce((n, b) => n + idsDoBalde(campanhas, b).length, 0);
  assert.equal(soma, campanhas.length);
  assert.equal(idsDoBalde(campanhas, 'todos').length, campanhas.length);
});

test('idsDoBalde devolve id em texto, do jeito que o PostgREST espera', () => {
  // Id que chega como número vira texto. O literal é curto DE PROPÓSITO: um id
  // real da Meta tem 18 dígitos e não cabe num número de JavaScript sem perder
  // precisão (120249301837840342 vira ...340). Quem testa a precisão é o teste
  // abaixo, com o id de verdade, em texto — que é como ele chega na vida real.
  const ids = idsDoBalde([{ campaign_id: 12345, objective: 'OUTCOME_SALES', conjuntos: [] }], 'vendas');
  assert.deepEqual(ids, ['12345']);
});

test('id real de 18 dígitos atravessa sem perder um algarismo', () => {
  // Id real da campanha marcada no filtro da Vessel, conferido no banco em 17/08/2026.
  const ids = idsDoBalde([{ campaign_id: '120249301837840342', objective: 'OUTCOME_SALES', conjuntos: [] }], 'vendas');
  assert.deepEqual(ids, ['120249301837840342']);
});
