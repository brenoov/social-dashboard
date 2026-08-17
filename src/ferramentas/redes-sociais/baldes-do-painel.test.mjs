import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALDES, baldeDaCampanha, rotuloDoBalde, idsDoBalde, idsParaConsulta, conjuntosMaisRecentes } from './baldes-do-painel.js';

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

/* ── O balde + o "⚙ Filtrar campanhas" se somam ── */

const campanhas = [
  { campaign_id: 'a', objective: 'OUTCOME_TRAFFIC', conjuntos: [{ destination_type: 'INSTAGRAM_PROFILE' }] },
  { campaign_id: 'b', objective: 'OUTCOME_ENGAGEMENT', conjuntos: [{ destination_type: 'WHATSAPP' }] },
  { campaign_id: 'c', objective: 'OUTCOME_TRAFFIC', conjuntos: [] },
];

test('o balde recorta o tipo e o filtro manual recorta DENTRO dele', () => {
  assert.deepEqual(idsParaConsulta(campanhas, 'seguidores', null), ['a']);
  assert.deepEqual(idsParaConsulta(campanhas, 'todos', ['a', 'c']), ['a', 'c']);
  assert.deepEqual(idsParaConsulta(campanhas, 'seguidores', ['b', 'c']), []);
  assert.deepEqual(idsParaConsulta(campanhas, 'contatos', ['b', 'c']), ['b']);
});

test('filtro manual vazio (nenhuma marcada) NÃO vira "todas"', () => {
  // [] no banco significa "nenhuma campanha" de propósito; virar "todas" faria a
  // tela mostrar dinheiro que o dono tirou da conta.
  assert.deepEqual(idsParaConsulta(campanhas, 'todos', []), []);
  assert.deepEqual(idsParaConsulta(campanhas, 'seguidores', []), []);
});

test('sem filtro manual (null = todas), o balde manda sozinho', () => {
  assert.deepEqual(idsParaConsulta(campanhas, 'todos', null), ['a', 'b', 'c']);
});

/* ── Só a coleta MAIS RECENTE de conjuntos vota ── */

test('conjunto de uma coleta VELHA não vota mais', () => {
  // campaign_adsets só CRESCE: o conjunto que a Meta apagou continuaria no banco
  // e classificaria a campanha para sempre. Uma campanha que já foi de WhatsApp
  // ficaria em Contatos pela eternidade.
  const linhas = [
    { adset_id: '1', campaign_id: 'x', destination_type: 'WHATSAPP', synced_at: '2026-08-10' },
    { adset_id: '2', campaign_id: 'x', destination_type: 'INSTAGRAM_PROFILE', synced_at: '2026-08-17' },
  ];
  assert.deepEqual(conjuntosMaisRecentes(linhas).map(l => l.adset_id), ['2']);
  // e o veredito muda junto: sem a limpeza, esta campanha ficaria em 'contatos'.
  assert.equal(baldeDaCampanha({ objective: 'OUTCOME_TRAFFIC', conjuntos: conjuntosMaisRecentes(linhas) }), 'seguidores');
});

test('a régua é o MAIOR synced_at do próprio dado, nunca a data de hoje', () => {
  // Se a coleta de conjuntos falhar por três dias, o maior é a última rodada boa
  // e nada se perde — comparar com "hoje" esvaziaria a tela sem motivo.
  const linhas = [
    { adset_id: '1', campaign_id: 'x', synced_at: '2026-01-02' },
    { adset_id: '2', campaign_id: 'y', synced_at: '2026-01-05' },
    { adset_id: '3', campaign_id: 'z', synced_at: '2026-01-05' },
  ];
  assert.deepEqual(conjuntosMaisRecentes(linhas).map(l => l.adset_id), ['2', '3']);
});

test('coleta única (tudo da mesma data) volta inteira', () => {
  const linhas = [
    { adset_id: '1', campaign_id: 'x', synced_at: '2026-08-17' },
    { adset_id: '2', campaign_id: 'y', synced_at: '2026-08-17' },
  ];
  assert.deepEqual(conjuntosMaisRecentes(linhas), linhas);
});

test('sem conjunto nenhum, volta vazio — e nada quebra', () => {
  assert.deepEqual(conjuntosMaisRecentes([]), []);
  assert.deepEqual(conjuntosMaisRecentes(null), []);
  assert.deepEqual(conjuntosMaisRecentes(undefined), []);
});

test('linha sem synced_at é descartada: ela não pode ser a mais recente', () => {
  const linhas = [
    { adset_id: '1', campaign_id: 'x', synced_at: null },
    { adset_id: '2', campaign_id: 'y', synced_at: '2026-08-17' },
  ];
  assert.deepEqual(conjuntosMaisRecentes(linhas).map(l => l.adset_id), ['2']);
  // TODAS sem data = nenhuma vota. A tela cai na regra do objetivo, que é o
  // mesmo caminho de quando campaign_adsets ainda está vazia. Não some ninguém.
  assert.deepEqual(conjuntosMaisRecentes([{ adset_id: '1', synced_at: null }, { adset_id: '2' }]), []);
});
