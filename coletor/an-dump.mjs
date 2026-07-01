// Dump dos posts de IG (Top Viral/Últimos Posts/Reels) por marca, p/ subagentes escreverem a análise por post.
import fs from 'fs';
const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const sbH = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const get = async p => { const r = await fetch(URL_SB + '/rest/v1/' + p, { headers: sbH }); return r.json(); };

fs.mkdirSync('/tmp/an2/in', { recursive: true });
fs.mkdirSync('/tmp/an2/out', { recursive: true });

const RODADA = (await get('noticias_concorrentes?select=rodada&order=rodada.desc&limit=1'))[0].rodada;
const rows = await get(`noticias_concorrentes?rodada=eq.${RODADA}&categoria=in.(Top Viral,${encodeURIComponent('Últimos Posts')},Reels)&select=marca,categoria,produtos`);
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const byMarca = {};
for (const r of rows) {
  const mk = (byMarca[r.marca] = byMarca[r.marca] || {});
  for (const p of (r.produtos || [])) {
    if (!p.url || mk[p.url]) continue;
    mk[p.url] = { url: p.url, tipo: p.tipo || 'imagem', curtidas: p.curtidas ?? null, comentarios: p.comentarios ?? null, legenda: String(p.nome || '').slice(0, 320) };
  }
}
const manifest = [];
for (const [marca, posts] of Object.entries(byMarca)) {
  const sl = slug(marca);
  const arr = Object.values(posts);
  fs.writeFileSync(`/tmp/an2/in/${sl}.json`, JSON.stringify({ marca, posts: arr }, null, 1));
  manifest.push({ marca, slug: sl, in: `/tmp/an2/in/${sl}.json`, out: `/tmp/an2/out/${sl}.json`, n: arr.length });
}
fs.writeFileSync('/tmp/an2/manifest.json', JSON.stringify(manifest, null, 1));
console.log('marcas:', manifest.length, '| posts/ marca:', manifest.map(m => m.marca + ':' + m.n).join(' '));
