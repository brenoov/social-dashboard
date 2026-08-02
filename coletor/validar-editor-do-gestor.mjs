#!/usr/bin/env node
// VALIDAÇÃO AO VIVO do editor de público do Gestor — a única prova que faltava.
//
// O QUE ELE PROVA, e por que nenhum teste unitário substitui: o editor afirma
// que PRESERVA o que não gerencia. Isso é uma afirmação sobre o que a META faz
// com o payload, não sobre o nosso objeto — e a Meta já desmentiu este projeto
// mais de uma vez (o `locale` que aceita e ignora, o `approximate_count` que
// sumiu, o Advantage+ que rejeita idade manual).
//
// COMO: cria campanha + conjunto PAUSED com um targeting RICO de propósito —
// cidades com raio, idade, gênero, interesse, posicionamento manual,
// `whatsapp_positions` e `device_platforms`. Depois usa as MESMAS funções da
// tela (`lerPublico` → mexe → `montarTargeting`) para editar, grava de verdade,
// e LÊ DE VOLTA para conferir campo a campo.
//
// Apaga tudo no fim. Nada é ativado; campanha pausada não gasta.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-editor-do-gestor.mjs [--manter]
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { lerPublico, montarTargeting } from '../src/ferramentas/gestao-trafego/publico-alvo.js';
import { lerPosicionamentos } from '../src/ferramentas/gestao-trafego/posicionamentos.js';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
// Mesma anon key pública com override por env que os outros scripts do coletor
// usam. Sem o padrão, o workflow (que não a passa) mandaria `apikey: undefined`
// e a falha apareceria como erro do proxy, não como falta de configuração.
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const MANTER = process.argv.includes('--manter');

let TOKEN;
async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status);
  return r.json();
}
async function proxy(body) {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
}
const erro = (d) => {
  const e = d && d.error;
  return e ? `code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}: ${(e.message || e.error_user_msg || '').slice(0, 200)}` : JSON.stringify(d).slice(0, 250);
};

// Cada conferência é uma linha do relatório. Falha NÃO interrompe: interessa
// saber TUDO que quebrou numa rodada só, não o primeiro item.
const provas = [];
function conferir(nome, ok, detalhe) {
  provas.push({ nome, ok: !!ok, detalhe: detalhe || '' });
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = (lojas || [])[0];
  const marca = (loja && loja.marca) || marcaAtiva;
  if (!marca || !marca.accountId || !marca.adAccount) throw new Error('sem marca com conta de anúncios');
  const acct = marca.accountId, adAccount = marca.adAccount;

  // Um interesse REAL, porque interesse inventado é rejeitado e a rodada morreria
  // por um motivo que não é o que se está testando.
  const ri = await proxy({ accountId: acct, path: '/search', params: { type: 'adinterest', q: 'bolsa', limit: 1 }, method: 'GET' });
  const interesse = ri.d && ri.d.data && ri.d.data[0];
  const cidades = ((loja && loja.geoCities) || []).slice(0, 2).map(String);
  if (!cidades.length) throw new Error('loja sem cidades cadastradas');

  // O TARGETING RICO. Cada campo aqui existe para ser conferido depois: os três
  // que o editor gerencia, e os dois que ele promete PRESERVAR sem tocar.
  const targetingInicial = {
    geo_locations: { cities: cidades.map((key) => ({ key, radius: 20, distance_unit: 'kilometer' })) },
    age_min: 25, age_max: 45, genders: [2],
    flexible_spec: interesse ? [{ interests: [{ id: interesse.id, name: interesse.name }] }] : undefined,
    publisher_platforms: ['facebook', 'instagram', 'whatsapp'],
    facebook_positions: ['feed', 'story', 'facebook_reels'],
    instagram_positions: ['stream', 'story', 'reels'],
    whatsapp_positions: ['status'],
    device_platforms: ['mobile'],
    targeting_automation: { advantage_audience: 0 },
  };

  console.log(`\n=== VALIDAÇÃO do editor de público · ${marca.nome} · ${adAccount} ===`);
  console.log(`interesse usado: ${interesse ? interesse.name : 'NENHUM'} · cidades: ${cidades.join(', ')}\n`);

  let campaignId = null, adsetId = null;
  try {
    const rc = await proxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'POST', params: {
      name: '[VALIDAÇÃO GESTOR] editor de público — apagar', objective: 'OUTCOME_ENGAGEMENT',
      status: 'PAUSED', special_ad_categories: [],
    } });
    if (rc.status !== 200 || !rc.d?.id) { console.log(`✗ campanha rejeitada — ${erro(rc.d)}`); process.exit(1); }
    campaignId = rc.d.id;

    const ra = await proxy({ accountId: acct, path: `/${adAccount}/adsets`, method: 'POST', params: {
      name: '[VALIDAÇÃO] conjunto', campaign_id: campaignId, status: 'PAUSED',
      daily_budget: 5000, billing_event: 'IMPRESSIONS', optimization_goal: 'POST_ENGAGEMENT',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting: targetingInicial,
    } });
    if (ra.status !== 200 || !ra.d?.id) { console.log(`✗ conjunto rejeitado — ${erro(ra.d)}`); process.exit(1); }
    adsetId = ra.d.id;
    console.log(`campanha ${campaignId} + conjunto ${adsetId} criados (PAUSED)\n`);

    // ── O que a Meta guardou de verdade ─────────────────────────────────────
    // Ler de volta ANTES de editar é o que separa "a Meta aceitou" de "a Meta
    // guardou o que a gente mandou" — são coisas diferentes, e já foram
    // diferentes neste projeto.
    const r1 = await proxy({ accountId: acct, path: `/${adsetId}`, params: { fields: 'targeting' }, method: 'GET' });
    const alvo1 = (r1.d && r1.d.targeting) || {};
    console.log('LEITURA 1 — o que a Meta guardou:');
    conferir('posicionamento manual sobreviveu', iguais(alvo1.publisher_platforms, ['facebook', 'instagram', 'whatsapp']), JSON.stringify(alvo1.publisher_platforms));
    conferir('whatsapp_positions guardado', iguais(alvo1.whatsapp_positions, ['status']), JSON.stringify(alvo1.whatsapp_positions));
    conferir('device_platforms guardado', iguais(alvo1.device_platforms, ['mobile']), JSON.stringify(alvo1.device_platforms));

    // ── A EDIÇÃO, pelas mesmas funções da tela ──────────────────────────────
    const antes = lerPublico(alvo1);
    conferir('lerPublico leu o posicionamento como MANUAL', antes.posicionamentos.automatico === false);
    conferir('lerPublico leu as 3 posições do Instagram', (antes.posicionamentos.posicoes.instagram || []).length === 3);

    // Duas mudanças de uma vez, uma de cada lado do editor: idade (público) e
    // posicionamento (onde aparece). Se só uma fosse mexida, um bug que
    // sobrescreve o outro campo passaria batido.
    const depois = JSON.parse(JSON.stringify(antes));
    depois.idadeMin = 30;
    depois.posicionamentos = {
      automatico: false,
      plataformas: ['facebook', 'instagram', 'whatsapp'],
      posicoes: { facebook: ['feed'], instagram: ['stream', 'story'] },
    };
    const { targeting } = montarTargeting(depois, alvo1);

    const rp = await proxy({ accountId: acct, path: `/${adsetId}`, method: 'POST', params: { targeting } });
    conferir('a Meta ACEITOU o targeting editado', rp.status === 200 && !rp.d?.error, rp.d?.error ? erro(rp.d) : '');

    // ── A prova ─────────────────────────────────────────────────────────────
    const r2 = await proxy({ accountId: acct, path: `/${adsetId}`, params: { fields: 'targeting' }, method: 'GET' });
    const alvo2 = (r2.d && r2.d.targeting) || {};
    console.log('\nLEITURA 2 — depois de editar pela tela:');
    conferir('a idade mudou (o que se pediu)', Number(alvo2.age_min) === 30, 'age_min=' + alvo2.age_min);
    conferir('o posicionamento do Facebook estreitou p/ feed', iguais(alvo2.facebook_positions, ['feed']), JSON.stringify(alvo2.facebook_positions));
    conferir('o do Instagram ficou com stream+story', iguais((alvo2.instagram_positions || []).slice().sort(), ['story', 'stream']), JSON.stringify(alvo2.instagram_positions));

    console.log('\n  — E O QUE O EDITOR NÃO GERENCIA (a promessa que nunca foi provada):');
    conferir('whatsapp_positions PRESERVADO', iguais(alvo2.whatsapp_positions, ['status']), JSON.stringify(alvo2.whatsapp_positions));
    conferir('device_platforms PRESERVADO', iguais(alvo2.device_platforms, ['mobile']), JSON.stringify(alvo2.device_platforms));
    conferir('gênero preservado', iguais(alvo2.genders, [2]), JSON.stringify(alvo2.genders));
    conferir('as cidades continuam lá', ((alvo2.geo_locations || {}).cities || []).length === cidades.length);
    conferir('o interesse continua lá', !interesse || JSON.stringify(alvo2.flexible_spec || '').includes(String(interesse.id)));

    // ── Voltar para automático apaga só o que deve ──────────────────────────
    const auto = JSON.parse(JSON.stringify(lerPublico(alvo2)));
    auto.posicionamentos = { automatico: true, plataformas: [], posicoes: {} };
    const { targeting: tAuto } = montarTargeting(auto, alvo2);
    const rv = await proxy({ accountId: acct, path: `/${adsetId}`, method: 'POST', params: { targeting: tAuto } });
    conferir('a Meta aceitou voltar para automático', rv.status === 200 && !rv.d?.error, rv.d?.error ? erro(rv.d) : '');

    const r3 = await proxy({ accountId: acct, path: `/${adsetId}`, params: { fields: 'targeting' }, method: 'GET' });
    const alvo3 = (r3.d && r3.d.targeting) || {};
    console.log('\nLEITURA 3 — depois de voltar para automático:');
    conferir('publisher_platforms sumiu (= automático)', alvo3.publisher_platforms == null, JSON.stringify(alvo3.publisher_platforms));
    conferir('facebook_positions sumiu junto', alvo3.facebook_positions == null, JSON.stringify(alvo3.facebook_positions));
    conferir('lerPosicionamentos volta a dizer AUTOMÁTICO', lerPosicionamentos(alvo3).automatico === true);
    conferir('whatsapp_positions AINDA preservado', iguais(alvo3.whatsapp_positions, ['status']), JSON.stringify(alvo3.whatsapp_positions));
    conferir('device_platforms AINDA preservado', iguais(alvo3.device_platforms, ['mobile']), JSON.stringify(alvo3.device_platforms));
  } finally {
    if (campaignId && !MANTER) {
      const rd = await proxy({ accountId: acct, path: `/${campaignId}`, method: 'POST', params: { status: 'DELETED' } });
      console.log(`\n🗑 ${rd.status === 200 ? 'campanha de teste apagada' : 'NÃO APAGOU — ' + erro(rd.d) + ' (apagar na mão: ' + campaignId + ')'}`);
    } else if (campaignId) {
      console.log(`\n⚠ mantida a pedido: campanha ${campaignId}`);
    }
  }

  const falhas = provas.filter((p) => !p.ok);
  console.log(`\n=== ${provas.length - falhas.length}/${provas.length} conferências passaram ===`);
  if (falhas.length) {
    for (const f of falhas) console.log(`  ✗ ${f.nome} ${f.detalhe}`);
    // Vermelho de propósito: uma validação que falha e termina verde é pior que
    // não ter validação, porque vira prova de algo que não foi provado.
    process.exit(1);
  }
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
