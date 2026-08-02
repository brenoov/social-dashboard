#!/usr/bin/env node
// VALIDAÇÃO AO VIVO do Duplicar do Gestor — a última das três que nunca tocou a conta.
//
// O QUE ELE PROVA, e por que teste unitário não alcança: o Duplicar depende do
// `/copies` da Meta, cujo comportamento foi levantado da DOCUMENTAÇÃO. Três
// afirmações nunca conferidas ao vivo:
//   1. a cópia nasce PAUSADA (mandamos `status_option: PAUSED` explícito);
//   2. a Meta NÃO devolve `id`, e sim `copied_campaign_id`/`copied_adset_id`/
//      `copied_ad_id` — se isso mudar, a cascata quebra no primeiro passo;
//   3. `deep_copy: false` + cascata rasa realmente leva conjunto e anúncio.
//
// E prova o defeito que a revisão pegou no PLANO, não na execução: a janela
// prometia "12 anúncios" e nascia campanha VAZIA. Aqui a contagem do plano é
// comparada com o que a Meta REALMENTE criou.
//
// COMO: cria campanha + conjunto + 2 anúncios PAUSED (reusando um criativo que
// já existe na conta, para não subir imagem), duplica pelo MESMO
// `planoDeCopia`/`executarPlano` da tela, lê a cópia de volta e apaga as duas.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-duplicar.mjs [--manter]
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { planoDeCopia, executarPlano } from '../src/ferramentas/gestao-trafego/duplicar.js';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const MANTER = process.argv.includes('--manter');

let TOKEN;
const sbGet = async (p) => {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status);
  return r.json();
};
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
  return e ? `code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}: ${(e.message || '').slice(0, 180)}` : JSON.stringify(d).slice(0, 220);
};

const provas = [];
function conferir(nome, ok, detalhe) {
  provas.push({ nome, ok: !!ok, detalhe: detalhe || '' });
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = (lojas || [])[0];
  const marca = (loja && loja.marca) || marcaAtiva;
  const acct = marca.accountId, adAccount = marca.adAccount;
  const cidades = ((loja && loja.geoCities) || []).slice(0, 1).map(String);

  console.log(`\n=== VALIDAÇÃO do Duplicar · ${marca.nome} · ${adAccount} ===\n`);

  // FAXINA DE ÓRFÃS antes de começar. Uma rodada anterior deixou campanha para
  // trás quando um `process.exit()` dentro do `try` pulou o `finally` — o
  // defeito está corrigido, mas quem valida money-path tem de saber limpar o
  // que uma versão anterior de si mesmo sujou.
  const rorf = await proxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'GET',
    params: { fields: 'id,name,status', limit: 100, filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: '[VALIDAÇÃO' }]) } });
  for (const c of ((rorf.d && rorf.d.data) || [])) {
    if (String(c.status).toUpperCase() === 'DELETED') continue;
    const rd = await proxy({ accountId: acct, path: `/${c.id}`, method: 'POST', params: { status: 'DELETED' } });
    console.log(`🧹 sobra de rodada anterior apagada: ${c.name} (${c.id})${rd.status === 200 ? '' : ' — FALHOU'}`);
  }

  // UM CRIATIVO QUE JÁ EXISTE. Subir imagem só para testar cópia seria pagar
  // upload e sujar a conta com um criativo órfão — e o que se está testando é o
  // `/copies`, não a criação de criativo.
  const rcr = await proxy({ accountId: acct, path: `/${adAccount}/adcreatives`, params: { fields: 'id,name', limit: 1 }, method: 'GET' });
  const criativo = rcr.d && rcr.d.data && rcr.d.data[0];
  if (!criativo) { console.log('✗ a conta não tem nenhum criativo para reusar — sem isso não dá pra criar anúncio'); process.exit(1); }
  console.log(`criativo reusado: ${criativo.id}\n`);

  let campanhaId = null, copiaId = null;
  try {
    const rc = await proxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'POST', params: {
      name: '[VALIDAÇÃO DUPLICAR] original — apagar', objective: 'OUTCOME_ENGAGEMENT',
      status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false,
    } });
    if (rc.status !== 200 || !rc.d?.id) throw new Error('campanha rejeitada — ' + erro(rc.d));
    campanhaId = rc.d.id;

    const ra = await proxy({ accountId: acct, path: `/${adAccount}/adsets`, method: 'POST', params: {
      name: '[VALIDAÇÃO] conjunto', campaign_id: campanhaId, status: 'PAUSED',
      daily_budget: 5000, billing_event: 'IMPRESSIONS', optimization_goal: 'POST_ENGAGEMENT',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      // `advantage_audience: 0` é OBRIGATÓRIO junto com idade manual: a Meta liga
      // o Advantage+ por padrão e recusa a combinação com code 100/1870227 —
      // medido aqui na primeira tentativa, e já anotado desde o SP-4.
      targeting: {
        geo_locations: { cities: cidades.map((key) => ({ key, radius: 20, distance_unit: 'kilometer' })) },
        age_min: 25, age_max: 45,
        targeting_automation: { advantage_audience: 0 },
      },
    } });
    if (ra.status !== 200 || !ra.d?.id) throw new Error('conjunto rejeitado — ' + erro(ra.d));
    const conjuntoId = ra.d.id;

    const anuncios = [];
    for (const n of [1, 2]) {
      const rad = await proxy({ accountId: acct, path: `/${adAccount}/ads`, method: 'POST', params: {
        name: `[VALIDAÇÃO] anúncio ${n}`, adset_id: conjuntoId, creative: { creative_id: criativo.id }, status: 'PAUSED',
      } });
      if (rad.status !== 200 || !rad.d?.id) throw new Error(`anúncio ${n} rejeitado — ` + erro(rad.d));
      anuncios.push({ id: rad.d.id, name: `[VALIDAÇÃO] anúncio ${n}`, adset_id: conjuntoId });
    }
    console.log(`original criado: campanha ${campanhaId} · 1 conjunto · ${anuncios.length} anúncios (tudo PAUSED)\n`);

    // ── O PLANO, pelo mesmo motor da tela ───────────────────────────────────
    const alvo = {
      nivel: 'campanha',
      campanha: { id: campanhaId, name: '[VALIDAÇÃO DUPLICAR] original — apagar' },
      conjuntos: [{ id: conjuntoId, name: '[VALIDAÇÃO] conjunto' }],
      anuncios,
    };
    const plano = planoDeCopia(alvo);
    console.log(`PLANO: ${plano.length} passos (1 campanha + 1 conjunto + ${anuncios.length} anúncios)`);
    conferir('o plano tem um passo por objeto', plano.length === 1 + 1 + anuncios.length, `${plano.length} passos`);
    conferir('todo passo pede PAUSED explicitamente', plano.every((p) => p.params.status_option === 'PAUSED'));
    conferir('campanha e conjunto pedem deep_copy: false', plano.filter((p) => p.nivel !== 'anuncio').every((p) => p.params.deep_copy === false));

    // ── A EXECUÇÃO ──────────────────────────────────────────────────────────
    const enviar = async (caminho, params) => {
      const r = await proxy({ accountId: acct, path: caminho, method: 'POST', params });
      if (r.status !== 200 || r.d?.error) throw new Error(erro(r.d));
      return r.d;
    };
    const rel = await executarPlano(plano, { enviar });
    conferir('nenhum passo falhou', !rel.falhou, rel.falhou ? `${rel.falhou.passo.nivel}: ${rel.falhou.motivo}` : '');
    conferir('todos os passos concluíram', rel.concluidos.length === plano.length, `${rel.concluidos.length}/${plano.length}`);
    copiaId = rel.criados['c1:camp'] || null;
    conferir('a Meta devolveu o número da campanha copiada', !!copiaId, String(copiaId));
    if (!copiaId) return;

    // ── A PROVA: o que a Meta REALMENTE criou ───────────────────────────────
    // É aqui que o defeito do plano teria aparecido: a janela prometia 12
    // anúncios e nascia campanha VAZIA, com "Pronto, 1 item copiado".
    const rcp = await proxy({ accountId: acct, path: `/${copiaId}`, params: { fields: 'name,status,effective_status' }, method: 'GET' });
    console.log('\nA CÓPIA, lida de volta da Meta:');
    conferir('a cópia nasceu PAUSADA', String(rcp.d?.status || '').toUpperCase() === 'PAUSED', rcp.d?.status);
    conferir('o nome levou o sufixo de cópia', String(rcp.d?.name || '').includes('cópia'), rcp.d?.name);

    const rcs = await proxy({ accountId: acct, path: `/${copiaId}/adsets`, params: { fields: 'id,name,status', limit: 50 }, method: 'GET' });
    const conjuntosCopia = (rcs.d && rcs.d.data) || [];
    conferir('a cascata levou o conjunto junto', conjuntosCopia.length === 1, `${conjuntosCopia.length} conjunto(s)`);
    conferir('o conjunto copiado está PAUSED', conjuntosCopia.every((c) => String(c.status).toUpperCase() === 'PAUSED'));

    const rads = await proxy({ accountId: acct, path: `/${copiaId}/ads`, params: { fields: 'id,name,status,adset_id', limit: 50 }, method: 'GET' });
    const adsCopia = (rads.d && rads.d.data) || [];
    // A CONTAGEM É A PROVA CENTRAL: promessa da janela × realidade da conta.
    conferir('a contagem de anúncios bate com o plano', adsCopia.length === anuncios.length, `plano prometia ${anuncios.length}, a Meta criou ${adsCopia.length}`);
    conferir('os anúncios copiados estão PAUSED', adsCopia.length > 0 && adsCopia.every((a) => String(a.status).toUpperCase() === 'PAUSED'));
    conferir('os anúncios entraram no conjunto COPIADO, não no original',
      adsCopia.every((a) => conjuntosCopia.some((c) => String(c.id) === String(a.adset_id))),
      adsCopia.map((a) => a.adset_id).join(','));
  } finally {
    for (const [rot, id] of [['original', campanhaId], ['cópia', copiaId]]) {
      if (!id || MANTER) continue;
      const rd = await proxy({ accountId: acct, path: `/${id}`, method: 'POST', params: { status: 'DELETED' } });
      console.log(`🗑 ${rd.status === 200 ? `${rot} apagada` : `NÃO APAGOU a ${rot} (${id}) — ${erro(rd.d)}`}`);
    }
    if (MANTER) console.log(`\n⚠ mantidas a pedido: original ${campanhaId} · cópia ${copiaId}`);
  }

  const falhas = provas.filter((p) => !p.ok);
  console.log(`\n=== ${provas.length - falhas.length}/${provas.length} conferências passaram ===`);
  if (falhas.length) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
