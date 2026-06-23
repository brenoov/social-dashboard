// Coletor de Instagram oficial dos concorrentes via Instagram Graph "business_discovery"
// (token Meta já existente na tabela accounts). Re-hospeda as imagens no Supabase Storage
// (bucket público ig-cache) e grava como galeria categoria='Instagram' em noticias_concorrentes.
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const G = 'https://graph.facebook.com/v22.0';
const RODADA = '2026-06-23';
const BUCKET = 'ig-cache';
const NPOSTS = 6;

const HANDLES = {
  'Santa Lolla': ['santa_lolla', 'santalolla', 'santalollaoficial'],
  'Arezzo&Co': ['arezzo'],
  'Schutz': ['schutzoficial', 'schutz'],
  'Anacapri': ['anacapri', 'anacaprioficial', 'useanacapri'],
  'Capodarte': ['capodarte'],
  'Luz da Lua': ['luzdalua', 'luzdaluaoficial'],
  'Petite Jolie': ['petitejolie_', 'petitejolie', 'petitejolieoficial'],
  'Jorge Bischoff': ['jorgebischoff', 'jorgebischoffoficial'],
  'Dumond': ['dumondcalcados', 'dumond', 'dumondoficial'],
  'Carmen Steffens': ['carmensteffens'],
};

const sbHeaders = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const clean = s => String(s || '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => Array.from(s).slice(0, n).join('');  // corta por code points (não parte emoji)

const accs = await (await fetch(URL_SB + '/rest/v1/accounts?select=access_token', { headers: sbHeaders })).json();
const tok = (accs.find(a => a.access_token) || {}).access_token;
if (!tok) throw new Error('sem token Meta');
const graph = async (path, params = {}) => {
  const u = new URL(G + path); u.searchParams.set('access_token', tok);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  return (await fetch(u)).json();
};
const pages = await graph('/me/accounts', { fields: 'instagram_business_account{id}' });
const igId = (pages.data || []).map(p => p.instagram_business_account && p.instagram_business_account.id).find(Boolean);
if (!igId) throw new Error('sem IG business account no token');

await fetch(URL_SB + '/storage/v1/bucket', { method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) }).catch(() => {});

async function rehost(srcUrl, path) {
  const r = await fetch(srcUrl, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  const up = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: buf });
  if (!up.ok) { console.log('  upload falhou', up.status, (await up.text()).slice(0, 100)); return null; }
  return `${URL_SB}/storage/v1/object/public/${BUCKET}/${path}`;
}

const MEDIA = 'media.limit(' + (NPOSTS + 4) + '){id,caption,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,timestamp}';
const rows = [];
for (const [marca, handles] of Object.entries(HANDLES)) {
  let bd = null, handle = null, lastErr = '';
  for (const h of handles) {
    const res = await graph('/' + igId, { fields: `business_discovery.username(${h}){username,followers_count,media_count,${MEDIA}}` });
    if (res && res.business_discovery) { bd = res.business_discovery; handle = res.business_discovery.username || h; break; }
    lastErr = res && res.error ? (res.error.message || JSON.stringify(res.error)) : 'sem dados';
  }
  if (!bd) { console.log(`${marca}: handle não encontrado (${handles.join('/')}) — ${lastErr.slice(0, 130)}`); continue; }
  const media = (bd.media && bd.media.data) || [];
  const produtos = [];
  for (const m of media) {
    if (produtos.length >= NPOSTS) break;
    const src = m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url;
    if (!src) continue;
    const pub = await rehost(src, `${handle}/${m.id}.jpg`);
    if (!pub) continue;
    produtos.push({ nome: cut(clean(m.caption), 110), img: pub, url: m.permalink, curtidas: m.like_count ?? null, comentarios: m.comments_count ?? null });
  }
  if (!produtos.length) { console.log(`${marca} (@${handle}): 0 imagens re-hospedadas`); continue; }
  rows.push({
    marca, titulo: 'Instagram oficial — últimos posts', resumo: null, categoria: 'Instagram',
    url: 'https://www.instagram.com/' + handle, fonte: '@' + handle + ' · ' + Number(bd.followers_count).toLocaleString('pt-BR') + ' seguidores',
    data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: produtos[0].img, produtos,
  });
  console.log(`${marca} (@${handle}): ${produtos.length} posts · ${Number(bd.followers_count).toLocaleString('pt-BR')} seg.`);
}

fs.writeFileSync('/tmp/ig_rows.json', JSON.stringify(rows));
for (const marca of [...new Set(rows.map(r => r.marca))]) {
  await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(marca)}&rodada=eq.${RODADA}&categoria=eq.Instagram`);
}
let ok = 0;
try {
  const ins = await rest('POST', 'noticias_concorrentes', rows); ok = ins.length;
} catch (e) {
  console.log('bulk falhou, inserindo 1 a 1:', String(e).slice(0, 120));
  for (const row of rows) {
    try { await rest('POST', 'noticias_concorrentes', [row]); ok++; }
    catch (e2) { console.log('  FALHOU', row.marca, '→', String(e2).slice(0, 140)); }
  }
}
console.log(`\nInseridas ${ok}/${rows.length} galerias de Instagram.`);
