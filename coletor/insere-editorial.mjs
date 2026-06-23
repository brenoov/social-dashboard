// Insere cards editoriais (manchetes/revista) coletados manualmente (meu plano, sem API paga).
// Lê /tmp/ed/<Marca>.json = [{titulo,resumo,categoria,url,fonte,data}].
// Busca og:image de cada matéria e grava como card secundário (destaque=false, produtos=null).
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const DIR = '/tmp/ed';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const CATFIX = { Estrategia: 'Estratégia', Expansao: 'Expansão', Lancamento: 'Lançamento', Tendencia: 'Tendência' };

async function ogImage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)[^"']*["'][^>]*>/i);
    if (!m) return null;
    const c = m[0].match(/content=["']([^"']+)["']/i);
    let img = c ? c[1] : null;
    if (!img || !/^https?:\/\//.test(img) || /logo|sprite|placeholder/i.test(img)) return null;
    return img.slice(0, 1000);
  } catch (e) { return null; }
}
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + txt.slice(0, 200)); return txt ? JSON.parse(txt) : null;
}

const rows = [];
let comImg = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json'))) {
  const marca = f.replace(/\.json$/, '');
  const items = JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8'));
  for (const it of items) {
    const img = await ogImage(it.url);
    if (img) comImg++;
    rows.push({
      marca, titulo: it.titulo, resumo: it.resumo,
      categoria: CATFIX[it.categoria] || it.categoria,
      url: it.url, fonte: it.fonte || 'Imprensa',
      data_publicacao: /^\d{4}-\d{2}/.test(it.data || '') ? (it.data.length === 7 ? it.data + '-01' : it.data) : RODADA,
      rodada: RODADA, destaque: false, imagem_url: img, produtos: null,
    });
  }
  console.log(`${marca}: ${items.length} itens`);
}
// idempotente: remove cards editoriais anteriores dessa rodada (não-galeria, não-destaque) e reinsere
await rest('DELETE', `noticias_concorrentes?rodada=eq.${RODADA}&produtos=is.null&destaque=eq.false`);
const ins = await rest('POST', 'noticias_concorrentes', rows);
console.log(`\nInseridos ${ins.length} cards editoriais (${comImg} com og:image).`);
