// Insere marcas coletadas via DOM (browser) que não têm API fetch-only.
// Lê /tmp/manual.json = { "Marca": { site, best:[{nome,preco,img,url}] } }.
// Reusa a mesma estrutura (hero estratégico + galeria best-seller).
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const db = JSON.parse(fs.readFileSync('/tmp/manual.json', 'utf8'));
const dedup = a => { const s = new Set(); return a.filter(p => { const k = (p.nome || '').toLowerCase(); if (!k || s.has(k)) return false; s.add(k); return true; }); };
const fmt = v => 'R$' + Math.round(v).toLocaleString('pt-BR');
const STYLES = ['Tiracolo', 'Shoulder', 'Hobo', 'Tote', 'Shopper', 'Baguete', 'Clutch', 'Mochila', 'Crossbody', 'Carteira', 'Shopping', 'Matelassê'];

function gerarInsight(marca, best) {
  const precos = best.map(p => Number(p.preco)).filter(v => v > 0);
  const min = precos.length ? Math.min(...precos) : 0, max = precos.length ? Math.max(...precos) : 0;
  const cnt = {}; best.forEach(p => STYLES.forEach(s => { if (new RegExp(s, 'i').test(p.nome)) cnt[s] = (cnt[s] || 0) + 1; }));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0].toLowerCase());
  const couro = best.filter(p => /couro/i.test(p.nome)).length;
  const ticket = min < 200 ? 'acessível' : min < 500 ? 'intermediário' : 'premium';
  let r = `No e-commerce oficial, as bolsas em destaque da ${marca} vão de ${fmt(min)} a ${fmt(max)} — posicionamento ${ticket}.`;
  if (top.length) r += ` Predominam modelos ${top.join(', ')}.`;
  if (best.length && couro >= best.length / 2) r += ' Forte presença de couro.';
  r += ' Leitura para a Vessel: comparar material, faixa de preço e mix de modelos com a própria vitrine.';
  return { titulo: `${ticket[0].toUpperCase() + ticket.slice(1)}: bolsas de ${fmt(min)} a ${fmt(max)}` + (top[0] ? ` — destaque em ${top[0]}` : ''), resumo: r };
}
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + txt.slice(0, 200)); return txt ? JSON.parse(txt) : null;
}

const rows = [];
for (const marca of Object.keys(db)) {
  const best = dedup(db[marca].best).slice(0, 12);
  if (!best.length) continue;
  const e = gerarInsight(marca, best);
  const capa = best[0].img;
  rows.push({ marca, titulo: e.titulo, resumo: e.resumo, categoria: 'Estratégia', url: db[marca].site, fonte: 'Site oficial', data_publicacao: RODADA, rodada: RODADA, destaque: true, imagem_url: capa, produtos: null });
  rows.push({ marca, titulo: 'Mais vendidas — bolsas', resumo: null, categoria: 'Best-seller', url: db[marca].site, fonte: 'Loja oficial', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: capa, produtos: best });
  console.log(`${marca}: ${best.length} bolsas`);
}
for (const marca of [...new Set(rows.map(x => x.marca))]) await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(marca)}&rodada=eq.${RODADA}`);
const ins = await rest('POST', 'noticias_concorrentes', rows);
console.log(`Inseridas ${ins.length} linhas (${[...new Set(rows.map(x => x.marca))].length} marcas).`);
