#!/usr/bin/env node
// coletor/spike-meta.mjs — valida viabilidade do Graph antes de construir o motor F3.
// Tudo via meta-proxy. Cria e DELETA uma campanha de teste PAUSED. Não deixa nada ativo.
import './lib/carregar-env.mjs';
import { loginServico } from './lib/bling-comercial.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY;
const ACCOUNT_ID = 'b6883e82-07cb-4f21-9fd7-ea7626786174'; // Vessel
const ACT = 'act_1197997517858139';
const PAGE = '324679337390168';

let TOKEN;
async function meta(path, params = {}, method = 'GET') {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, path, params, method }),
  });
  const d = await r.json();
  return { status: r.status, d };
}

async function main() {
  TOKEN = await loginServico();
  console.log('== (a) escopos do token ==');
  console.log(JSON.stringify((await meta('/me/permissions')).d).slice(0, 600));

  console.log('\n== (b) geo das cidades ==');
  for (const q of ['Santa Barbara Doeste', 'Americana', 'Campinas']) {
    const r = await meta('/search', { type: 'adgeolocation', location_types: ['city'], q, country_code: 'BR', limit: 3 });
    console.log(q, '->', JSON.stringify((r.d.data || []).map(c => ({ key: c.key, name: c.name, region: c.region }))));
  }

  console.log('\n== (c) números de WhatsApp da BM ==');
  const biz = await meta('/me/businesses', { fields: 'id,name' });
  console.log('businesses:', JSON.stringify(biz.d.data || biz.d).slice(0, 400));
  for (const b of (biz.d.data || [])) {
    const waba = await meta('/' + b.id + '/owned_whatsapp_business_accounts', { fields: 'id,name' });
    for (const w of (waba.d.data || [])) {
      const nums = await meta('/' + w.id + '/phone_numbers', { fields: 'id,display_phone_number,verified_name' });
      console.log('WABA', w.id, '->', JSON.stringify(nums.d.data || nums.d));
    }
  }
  // fallback: número conectado à Página
  const pageWa = await meta('/' + PAGE, { fields: 'name,whatsapp_number,connected_whatsapp' });
  console.log('page whatsapp:', JSON.stringify(pageWa.d).slice(0, 300));

  console.log('\n== (d) /adimages a partir de URL do Storage ==');
  const rr = await fetch(URL + '/rest/v1/fabrica_criativos?select=url&arquetipo=eq.promo&limit=1', { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY } });
  const one = (await rr.json())[0];
  if (one) {
    const img = await meta('/' + ACT + '/adimages', { url: one.url }, 'POST');
    console.log('adimages(url) status', img.status, '->', JSON.stringify(img.d).slice(0, 400));
  } else console.log('(sem criativo promo pra testar)');

  console.log('\n== (e) criar + deletar campanha PAUSED de teste ==');
  const camp = await meta('/' + ACT + '/campaigns', { name: 'ZZ-SPIKE-DELETAR', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [] }, 'POST');
  console.log('create status', camp.status, '->', JSON.stringify(camp.d).slice(0, 300));
  if (camp.d && camp.d.id) {
    const del = await meta('/' + camp.d.id, {}, 'DELETE');
    console.log('delete status', del.status, '->', JSON.stringify(del.d).slice(0, 200));
  }
}
main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
