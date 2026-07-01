// Preenche imagem dos cards editoriais sem capa: tenta og:image da matéria; senão, usa um post do IG da marca.
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const sbH = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { ...sbH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
async function ogImage(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    const h = await r.text();
    const m = h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const u = m && m[1]; return (u && /^https?:\/\//.test(u) && !/logo|sprite|favicon|placeholder/i.test(u)) ? u : null;
  } catch (e) { return null; }
}

const RODADA = (await rest('GET', 'noticias_concorrentes?select=rodada&order=rodada.desc&limit=1'))[0].rodada;
// cards sem imagem
const cards = await rest('GET', `noticias_concorrentes?rodada=eq.${RODADA}&produtos=is.null&imagem_url=is.null&categoria=not.ilike.resumo*&select=id,marca,categoria,titulo,url`);
// fallback: imagens do Top Viral por marca (lista, p/ diversificar entre vários cards da mesma marca)
const viral = await rest('GET', `noticias_concorrentes?rodada=eq.${RODADA}&categoria=eq.Top Viral&select=marca,produtos`);
const fbk = {}; for (const v of viral) { const imgs = (v.produtos || []).map(p => p && p.img).filter(Boolean); if (imgs.length) fbk[v.marca] = imgs; }
const used = {};

let og = 0, fb = 0, none = 0;
for (const c of cards) {
  let img = await ogImage(c.url);
  if (img) og++; else if (fbk[c.marca]) { const i = used[c.marca] = (used[c.marca] ?? -1) + 1; img = fbk[c.marca][i % fbk[c.marca].length]; fb++; } else { none++; }
  if (img) await rest('PATCH', `noticias_concorrentes?id=eq.${c.id}`, { imagem_url: img });
  console.log((img ? '✓' : '✗') + ' [' + c.marca + '/' + c.categoria + '] ' + c.titulo.slice(0, 42));
}
console.log(`\n${cards.length} cards · og:image ${og} · fallback IG ${fb} · sem imagem ${none}`);
