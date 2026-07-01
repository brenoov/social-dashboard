// Galerias de loja de Luiza Barcelos (Oracle Commerce/OCC) e Victor Hugo (Typesense/mkplace),
// descobertas via browser (Playwright) e replicadas por fetch headless. Imagens = CDN estável (sem rehospedar).
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const sbH = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { ...sbH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const dedup = arr => { const s = new Set(), o = []; for (const p of arr) { const k = (p.nome || '') + '|' + (p.img || ''); if (p.img && p.nome && !s.has(k)) { s.add(k); o.push(p); } } return o; };

// ── Luiza Barcelos (OCC Endeca) ──
async function luizaBarcelos() {
  const u = 'https://www.luizabarcelos.com.br/ccstoreui/v1/search?N=831170983&searchType=simple&No=0&Nrpp=60&language=pt_BR';
  const j = await (await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })).json();
  const recs = (j.resultsList && j.resultsList.records) || [];
  const flat = [];
  for (const g of recs) for (const lf of (g.records || [g])) {
    const a = lf.attributes || {}; const get = k => Array.isArray(a[k]) ? a[k][0] : a[k];
    let img = get('product.primaryLargeImageURL') || get('product.primaryMediumImageURL') || get('product.primaryFullImageURL');
    if (img && img.startsWith('/')) img = 'https://www.luizabarcelos.com.br' + img;
    flat.push({ nome: get('product.displayName'), preco: Number(get('sku.activePrice') || get('product.listPrice') || 0) || null, img, url: 'https://www.luizabarcelos.com.br' + (get('product.route') || ''), cri: Number(get('product.creationDate') || 0) });
  }
  const all = dedup(flat);
  const best = all.slice(0, 12);
  const bestKeys = new Set(best.map(p => p.nome));
  const nov = [...all].sort((a, b) => b.cri - a.cri).filter(p => !bestKeys.has(p.nome)).slice(0, 12);
  return { best: best.map(({ cri, ...p }) => p), nov: nov.map(({ cri, ...p }) => p) };
}

// ── Victor Hugo (Typesense / mkplace) ──
async function victorHugo() {
  const u = 'https://search.main.mkplace.com.br/multi_search?use_cache=true&x-typesense-api-key=9sUhPk3OEt7l3KJghC2YlaYF3zXw5kUD';
  const q = (sort) => ({ collection: 'col-tvdxhJKtc5-tvdxhJKtc5-search', q: '*', query_by: 'name', filter_by: 'category:=[`Bolsas`]', group_by: 'deduplicator', group_limit: 1, per_page: 40, page: 1, sort_by: sort });
  async function run(sort) {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ searches: [q(sort)] }) });
    const j = await r.json(); const res = (j.results && j.results[0]) || {};
    const docs = (res.grouped_hits || []).map(g => g.hits[0].document);
    return docs.map(d => ({ nome: d.name, preco: (d.offer && (d.offer.price || d.offer.originalPrice)) || null, img: (d.images && d.images[0]) || d.thumbnail || '', url: 'https://www.victorhugo.com.br/' + d.slug, avail: !!(d.offer && d.offer.isAvailable) }));
  }
  let best = dedup(await run('_text_match:desc'));
  let nov = dedup(await run('createdAt:desc').catch(() => []));
  if (!nov.length) nov = best.slice(12, 24); // fallback se createdAt não for sortable
  best = best.filter(p => p.avail !== false).slice(0, 12).map(({ avail, ...p }) => p);
  const bestKeys = new Set(best.map(p => p.nome));
  nov = nov.filter(p => !bestKeys.has(p.nome)).slice(0, 12).map(({ avail, ...p }) => p);
  return { best, nov };
}

const base = { url: null, fonte: null, data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: null, produtos: null, resumo: null };
const rows = [];
const lb = await luizaBarcelos();
const vh = await victorHugo();
console.log(`Luiza Barcelos: ${lb.best.length} best + ${lb.nov.length} nov`);
console.log(`Victor Hugo: ${vh.best.length} best + ${vh.nov.length} nov`);

function push(marca, fonte, g) {
  if (g.best.length) rows.push({ ...base, marca, categoria: 'Best-seller', titulo: 'Mais vendidas — bolsas', fonte, imagem_url: g.best[0].img, produtos: g.best });
  if (g.nov.length) rows.push({ ...base, marca, categoria: 'Lançamento', titulo: 'Novidades — chegou agora', fonte, imagem_url: g.nov[0].img, produtos: g.nov });
}
push('Luiza Barcelos', 'Loja oficial · luizabarcelos.com.br', lb);
push('Victor Hugo', 'Loja oficial · victorhugo.com.br', vh);

for (const m of ['Luiza Barcelos', 'Victor Hugo']) for (const c of ['Best-seller', 'Lançamento'])
  await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(m)}&rodada=eq.${RODADA}&categoria=eq.${encodeURIComponent(c)}`);
let ok = 0;
for (const row of rows) { try { await rest('POST', 'noticias_concorrentes', [row]); ok++; } catch (e) { console.log('FALHOU', row.marca, row.categoria, String(e).slice(0, 140)); } }
console.log(`Inseridas ${ok}/${rows.length} galerias de loja (LB + VH).`);
