// Mescla as análises por post (geradas pelos subagentes em /tmp/an2/out) nos produtos das galerias de IG.
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

// carrega todos os out files → mapa url -> análise
const ana = {};
let loaded = 0;
for (const f of fs.readdirSync('/tmp/an2/out')) {
  if (!f.endsWith('.json')) continue;
  try {
    const o = JSON.parse(fs.readFileSync('/tmp/an2/out/' + f, 'utf8'));
    let n = 0; for (const [url, a] of Object.entries(o)) { if (url && a) { ana[url] = String(a); n++; } }
    loaded += n; console.log(`  ${f}: ${n}`);
  } catch (e) { console.log('  ERRO parse', f, String(e).slice(0, 80)); }
}
console.log('análises carregadas:', loaded);

const RODADA = (await rest('GET', 'noticias_concorrentes?select=rodada&order=rodada.desc&limit=1'))[0].rodada;
const rows = await rest('GET', `noticias_concorrentes?rodada=eq.${RODADA}&categoria=in.(Top Viral,${encodeURIComponent('Últimos Posts')},Reels)&select=id,marca,categoria,produtos`);
let patched = 0, items = 0, matched = 0;
for (const r of rows) {
  let chg = false;
  const prods = (r.produtos || []).map(p => {
    items++;
    if (p.url && ana[p.url]) { matched++; chg = true; return { ...p, analise: ana[p.url] }; }
    return p;
  });
  if (chg) { await rest('PATCH', `noticias_concorrentes?id=eq.${r.id}`, { produtos: prods }); patched++; }
}
console.log(`Galerias: ${rows.length} · itens: ${items} · com análise: ${matched} · linhas atualizadas: ${patched}`);
