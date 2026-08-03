#!/usr/bin/env node
// SONDA DAS DUAS RECUSAS DA META — o (#200) do Duplicar e o bloqueio de público.
//
// POR QUE JUNTAS: são a mesma pergunta — "o que esta conta/token pode fazer?" —
// e as duas travaram por falta de UM dado que nunca foi olhado: a mensagem
// INTEIRA do erro. Os scripts anteriores truncavam em 180 caracteres, e é
// justamente no fim (`error_user_title`, `error_user_msg`) que a Meta explica o
// que falta.
//
// O QUE ELA ISOLA:
//   1. Quais permissões o token tem, e o que este usuário pode fazer na conta.
//   2. `/copies` de conjunto — o erro completo, com fbtrace_id.
//   3. Criar público SEM regra × COM regra. Essa separação é o ponto: se o
//      simples também falhar, o problema é PERMISSÃO; se só o com regra falhar,
//      o problema é a REGRA (ou o transporte dela).
//
// O transporte importa porque o meta-proxy manda todo parâmetro de POST na
// QUERY STRING — o corpo vai vazio. Para `rule`, que é JSON aninhado, isso é
// suspeito, e era a hipótese anotada desde o SP-4.
//
// CUSTA R$ 0 (nenhuma IA). Cria no máximo um público de teste e o apaga.
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL_SB = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL_SB + '/rest/v1';

let TOKEN;
const sbGet = async (p) => { const r = await fetch(REST + p, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } }); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); };
async function proxy(body) {
  const r = await fetch(URL_SB + '/functions/v1/meta-proxy', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}

// O ERRO INTEIRO. Truncar foi o que segurou as duas investigações.
function erroCompleto(d) {
  const e = d && d.error;
  if (!e) return JSON.stringify(d).slice(0, 400);
  const partes = [`code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}`];
  if (e.message) partes.push(`message: ${e.message}`);
  if (e.error_user_title) partes.push(`título: ${e.error_user_title}`);
  if (e.error_user_msg) partes.push(`explicação: ${e.error_user_msg}`);
  if (e.fbtrace_id) partes.push(`fbtrace: ${e.fbtrace_id}`);
  return partes.join('\n      ');
}

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const marca = ((lojas || [])[0] || {}).marca || marcaAtiva;
  const acct = marca.accountId, act = marca.adAccount;
  console.log(`SONDA de permissões · ${marca.nome} · ${act} · sem IA, custo R$ 0\n`);

  // ── 1. O QUE O TOKEN PODE ────────────────────────────────────────────────
  console.log('── 1. Permissões do token');
  const perm = await proxy({ accountId: acct, path: '/me/permissions', method: 'GET' });
  const concedidas = ((perm.d && perm.d.data) || []).filter((p) => p.status === 'granted').map((p) => p.permission);
  const recusadas = ((perm.d && perm.d.data) || []).filter((p) => p.status !== 'granted').map((p) => p.permission);
  console.log(`   concedidas: ${concedidas.join(', ') || '(nenhuma — ' + erroCompleto(perm.d) + ')'}`);
  if (recusadas.length) console.log(`   recusadas:  ${recusadas.join(', ')}`);
  for (const p of ['ads_management', 'ads_read', 'business_management']) {
    console.log(`   ${concedidas.includes(p) ? '✓' : '✗'} ${p}`);
  }

  console.log('\n── 2. O que este usuário pode fazer NA CONTA');
  const conta = await proxy({ accountId: acct, path: `/${act}`, method: 'GET',
    params: { fields: 'name,account_status,disable_reason,user_tasks,capabilities' } });
  if (conta.d && conta.d.error) console.log(`   ⚠ ${erroCompleto(conta.d)}`);
  else {
    console.log(`   conta: ${conta.d.name} · status ${conta.d.account_status}${conta.d.disable_reason ? ' · disable_reason ' + conta.d.disable_reason : ''}`);
    console.log(`   user_tasks: ${(conta.d.user_tasks || []).join(', ') || '(vazio)'}`);
    const caps = conta.d.capabilities || [];
    console.log(`   capabilities com "COPY"/"AUDIENCE": ${caps.filter((c) => /COPY|AUDIENCE/i.test(c)).join(', ') || '(nenhuma)'}`);
  }

  // ── 3. O (#200) DO DUPLICAR, com o erro inteiro ──────────────────────────
  console.log('\n── 3. Copiar conjunto (o (#200) do Duplicar)');
  // VÁRIOS conjuntos, de campanhas e objetivos diferentes. Testar um só não
  // separa "a conta não copia conjunto" de "aquele conjunto tem algo".
  const rs = await proxy({ accountId: acct, path: `/${act}/adsets`, method: 'GET',
    params: { fields: 'id,name,effective_status,optimization_goal,destination_type,promoted_object,campaign{objective,special_ad_categories}', limit: 8 } });
  const conjuntos = (rs.d && rs.d.data) || [];
  if (!conjuntos.length) console.log('   ⚠ nenhum conjunto na conta para testar');
  let algumFuncionou = false;
  for (const cj of conjuntos.slice(0, 5)) {
    const camp = cj.campaign || {};
    const marca = `${(camp.objective || '?')}${cj.promoted_object ? ' +promoted_object' : ''}${(camp.special_ad_categories || []).length ? ' +categoria_especial' : ''}`;
    const c = await proxy({ accountId: acct, path: `/${cj.id}/copies`, method: 'POST', params: { status_option: 'PAUSED', deep_copy: false } });
    if (c.d && c.d.copied_adset_id) {
      algumFuncionou = true;
      console.log(`   ✓ "${(cj.name || '').slice(0, 34)}" [${marca}] COPIOU`);
      await proxy({ accountId: acct, path: `/${c.d.copied_adset_id}`, method: 'POST', params: { status: 'DELETED' } });
    } else {
      // SEM TRUNCAR. Cortar a mensagem foi o que segurou esta investigação três
      // vezes seguidas — a explicação da Meta vive no FIM do texto.
      console.log(`   ✗ "${(cj.name || '').slice(0, 34)}" [${marca}]\n      ${erroCompleto(c.d)}`);
    }
  }
  console.log(algumFuncionou
    ? '   → NÃO é a conta: algum conjunto copia. O que difere entre eles é a pista.'
    : '   → nenhum conjunto copiou: é a CONTA ou o ENDPOINT, não o conjunto.');

  // E a cópia de CAMPANHA, para confirmar que o contraste continua de pé.
  const rc2 = await proxy({ accountId: acct, path: `/${act}/campaigns`, method: 'GET', params: { fields: 'id,name', limit: 1 } });
  const camp1 = rc2.d && rc2.d.data && rc2.d.data[0];
  if (camp1) {
    const cc = await proxy({ accountId: acct, path: `/${camp1.id}/copies`, method: 'POST', params: { status_option: 'PAUSED', deep_copy: false } });
    if (cc.d && cc.d.copied_campaign_id) {
      console.log('   ✓ copiar CAMPANHA funciona (o contraste continua: campanha sim, conjunto não)');
      await proxy({ accountId: acct, path: `/${cc.d.copied_campaign_id}`, method: 'POST', params: { status: 'DELETED' } });
    } else console.log(`   ✗ copiar campanha TAMBÉM falhou agora: ${erroCompleto(cc.d)}`);
  }

  // ── 4. PÚBLICO: sem regra × com regra ────────────────────────────────────
  // A separação é o ponto. Se o SIMPLES falhar, é permissão; se só o com regra
  // falhar, é a regra (ou o transporte dela pela query string).
  console.log('\n── 4. Criar público — SEM regra e COM regra');
  const nome = 'ZZ teste sonda (apagar)';
  const simples = await proxy({ accountId: acct, path: `/${act}/customaudiences`, method: 'POST',
    params: { name: nome, subtype: 'CUSTOM', description: 'sonda', customer_file_source: 'USER_PROVIDED_ONLY' } });
  if (simples.d && simples.d.id) {
    console.log(`   ✓ SEM regra: criou (${simples.d.id}) — então PERMISSÃO existe`);
    const del = await proxy({ accountId: acct, path: `/${simples.d.id}`, method: 'DELETE' });
    console.log(`     ${del.status === 200 ? '🗑 apagado' : '⚠ não apagou: ' + erroCompleto(del.d)}`);
  } else {
    console.log(`   ✗ SEM regra também falha — o problema é PERMISSÃO, não a regra:\n      ${erroCompleto(simples.d)}`);
  }

  const ig = marca.igId || marca.ig_id;
  if (!ig) console.log('   (sem instagram_user_id na marca — pulando o teste com regra)');
  else {
    const regra = { inclusions: { operator: 'or', rules: [{
      event_sources: [{ type: 'ig_business', id: String(ig) }],
      retention_seconds: 365 * 24 * 3600,
      filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'ig_business_profile_all' }] },
    }] } };
    const comRegra = await proxy({ accountId: acct, path: `/${act}/customaudiences`, method: 'POST',
      params: { name: nome + ' 2', subtype: 'ENGAGEMENT', rule: regra } });
    if (comRegra.d && comRegra.d.id) {
      console.log(`   ✓ COM regra: criou (${comRegra.d.id}) — o bloqueio ACABOU`);
      await proxy({ accountId: acct, path: `/${comRegra.d.id}`, method: 'DELETE' });
      console.log('     🗑 apagado');
    } else {
      console.log(`   ✗ COM regra falha:\n      ${erroCompleto(comRegra.d)}`);
    }
  }

  console.log('\nO que separa as duas conclusões: se o público SEM regra criou e o COM regra não,');
  console.log('o problema é a regra (ou o transporte dela pela query string do meta-proxy).');
  console.log('Se nenhum dos dois criou, é permissão — e aí o (#200) do Duplicar é o mesmo assunto.');
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
