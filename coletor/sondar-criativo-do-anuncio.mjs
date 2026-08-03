#!/usr/bin/env node
// SONDA: o que dá para MOSTRAR de um anúncio, para a lupa da Fila.
//
// POR QUE ANTES DE CONSTRUIR: o pedido é uma lupa que mostre o criativo que o
// robô apontou como travado — hoje a fila diz "3 criativos sem tração" e a
// pessoa tem de acreditar. Só que "mostrar o anúncio" tem pelo menos três
// caminhos na Meta, e eles não são equivalentes:
//
//   1. `/{ad_id}/previews?ad_format=...` — o anúncio RENDERIZADO, num iframe
//      assinado. É o que o Gerenciador mostra. Some depois de um tempo?
//      Precisa de permissão especial? É isso que a sonda responde.
//   2. `creative{thumbnail_url}` — miniatura pequena, boa para lista.
//   3. `creative{image_url}` / `object_story_spec` — a imagem original.
//
// Escolher pelo que a documentação promete já custou caro neste projeto. Aqui a
// escolha sai do que a conta REALMENTE devolve.
//
// CUSTA R$ 0: nenhuma IA, só GETs. NÃO GRAVA NADA.
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

let TOKEN;
const sbGet = async (p) => { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); };
async function proxy(body) {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}
const erroDe = (d) => (d && d.error) ? `code ${d.error.code}${d.error.error_subcode ? '/' + d.error.error_subcode : ''}: ${(d.error.message || '').slice(0, 140)}` : '';

// Os formatos que interessam a uma lupa. Largo de propósito: se o formato que a
// gente escolheria não existir nesta conta, é melhor descobrir aqui.
const FORMATOS = ['MOBILE_FEED_STANDARD', 'DESKTOP_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'INSTAGRAM_STORY'];

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const marca = ((lojas || [])[0] || {}).marca || marcaAtiva;
  const acct = marca.accountId, adAccount = marca.adAccount;
  console.log(`SONDA do criativo · ${marca.nome} · ${adAccount} · sem IA, custo R$ 0\n`);

  const rads = await proxy({ accountId: acct, path: `/${adAccount}/ads`, method: 'GET', params: { fields: 'id,name,effective_status', limit: 3 } });
  const anuncios = (rads.d && rads.d.data) || [];
  if (!anuncios.length) { console.error('nenhum anúncio na conta — falha de acesso, não resposta'); process.exit(1); }

  for (const ad of anuncios.slice(0, 2)) {
    console.log(`── anúncio ${ad.id} · "${ad.name}" [${ad.effective_status}]`);

    // CAMINHO 2 e 3: campos do criativo, numa chamada só.
    const rc = await proxy({ accountId: acct, path: `/${ad.id}`, method: 'GET',
      params: { fields: 'creative{id,name,thumbnail_url,image_url,object_story_spec,asset_feed_spec}' } });
    const cr = (rc.d && rc.d.creative) || {};
    if (rc.d && rc.d.error) console.log(`   campos do criativo → ⚠ ${erroDe(rc.d)}`);
    else {
      console.log(`   thumbnail_url: ${cr.thumbnail_url ? 'SIM (' + String(cr.thumbnail_url).slice(0, 70) + '…)' : 'não veio'}`);
      console.log(`   image_url:     ${cr.image_url ? 'SIM (' + String(cr.image_url).slice(0, 70) + '…)' : 'não veio'}`);
      const oss = cr.object_story_spec || {};
      console.log(`   object_story_spec: ${Object.keys(oss).join(', ') || 'vazio'}`);
      if (cr.asset_feed_spec) console.log(`   asset_feed_spec: ${Object.keys(cr.asset_feed_spec).join(', ')}`);
    }

    // CAMINHO 1: o anúncio renderizado.
    for (const fmt of FORMATOS) {
      const rp = await proxy({ accountId: acct, path: `/${ad.id}/previews`, method: 'GET', params: { ad_format: fmt } });
      const body = rp.d && rp.d.data && rp.d.data[0] && rp.d.data[0].body;
      if (body) {
        const src = (String(body).match(/src="([^"]+)"/) || [])[1] || '';
        console.log(`   previews ${fmt}: SIM — iframe de ${src.length} chars${src ? ' (' + src.slice(0, 60) + '…)' : ''}`);
      } else {
        console.log(`   previews ${fmt}: não — ${erroDe(rp.d) || 'sem body'}`);
      }
    }
    console.log('');
  }

  console.log('CONCLUSÃO DE DESENHO: a lupa deve usar o caminho que voltou SIM aqui,');
  console.log('e ter plano B para o anúncio em que ele não voltar — anúncio pausado ou');
  console.log('antigo costuma perder a prévia, e é justamente o tipo que a Fila aponta.');
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
