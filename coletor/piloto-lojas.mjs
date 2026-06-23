// Coleta best-sellers/novidades das lojas oficiais, monta as linhas
// (estratégia + galerias) e grava em noticias_concorrentes via REST.
// Uso: node piloto-lojas.mjs            → todas as marcas de LOJAS
//      node piloto-lojas.mjs Schutz ... → só as marcas passadas
import fs from 'fs';
import { coletarLoja, LOJAS } from './lojas.mjs';

const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const alvo = process.argv.slice(2);
const MARCAS = alvo.length ? alvo : Object.keys(LOJAS);

const dedup = a => { const s = new Set(); return a.filter(p => { const k = (p.nome || '').toLowerCase(); if (!k || s.has(k)) return false; s.add(k); return true; }); };
const fmt = v => 'R$' + Math.round(v).toLocaleString('pt-BR');

// Leituras estratégicas escritas à mão (ancoradas nos dados); demais marcas usam auto.
const ESTRATEGIA = {
  'Santa Lolla': {
    titulo: 'Ticket acessível e sintético: campeãs entre R$150 e R$300',
    resumo: 'No e-commerce oficial, as bolsas mais vendidas da Santa Lolla são shoppers e baguetes em material "floater" e "soft" (sintéticos), de R$149,90 a R$299,90 — ticket de entrada. Dominam alça de ombro e transversal de corrente, em preto, marrom e vanilla, com forte aposta em modelos do dia a dia. Leitura para a Vessel: a Santa Lolla disputa volume no segmento acessível, com pouca presença de couro. Há espaço para a Vessel se diferenciar em material e acabamento sem subir tanto de preço.',
  },
  'Arezzo&Co': {
    titulo: 'Premium em couro: campeãs de R$900 a R$1.300 com ferragem dourada',
    resumo: 'As líderes de venda no site oficial da Arezzo são bolsas de couro — tiracolo croco com corrente, shoulder e hobo média — entre R$899,90 e R$1.299,90. Animal print e ferragem dourada aparecem com força, reforçando um posicionamento premium e atemporal. Leitura para a Vessel: a Arezzo ancora desejo no couro e no detalhe metálico, com ticket 4–5× o da Santa Lolla. O recado é de marca aspiracional — competir aqui é por design e percepção de qualidade, não por preço.',
  },
};

const STYLES = ['Tiracolo', 'Shoulder', 'Hobo', 'Tote', 'Shopper', 'Baguete', 'Clutch', 'Mochila', 'Crossbody', 'Carteira', 'Sacola', 'Necessaire'];
function gerarInsight(marca, best) {
  const precos = best.map(p => Number(p.preco)).filter(v => v > 0);
  const min = precos.length ? Math.min(...precos) : 0, max = precos.length ? Math.max(...precos) : 0;
  const cnt = {}; best.forEach(p => STYLES.forEach(s => { if (new RegExp(s, 'i').test(p.nome)) cnt[s] = (cnt[s] || 0) + 1; }));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0].toLowerCase());
  const couro = best.filter(p => /couro/i.test(p.nome)).length;
  const ticket = min < 200 ? 'acessível' : min < 500 ? 'intermediário' : 'premium';
  let r = `No e-commerce oficial, as bolsas mais vendidas da ${marca} vão de ${fmt(min)} a ${fmt(max)} — posicionamento ${ticket}.`;
  if (top.length) r += ` Predominam modelos ${top.join(', ')}.`;
  if (best.length && couro >= best.length / 2) r += ' Forte presença de couro.';
  else if (couro === 0) r += ' Linha majoritariamente sintética/têxtil.';
  r += ' Leitura para a Vessel: comparar material, faixa de preço e mix de modelos com a própria vitrine.';
  const titulo = `${ticket[0].toUpperCase() + ticket.slice(1)}: campeãs de ${fmt(min)} a ${fmt(max)}` + (top[0] ? ` — destaque em ${top[0]}` : '');
  return { titulo, resumo: r };
}

async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + txt.slice(0, 300));
  return txt ? JSON.parse(txt) : null;
}

const rows = [];
for (const marca of MARCAS) {
  const r = await coletarLoja(marca);
  if (!r) { console.log(`${marca}: SEM adaptador — pulado`); continue; }
  const best = dedup(r.bestsellers);
  if (!best.length) { console.log(`${marca}: best=0 (loja não respondeu) — pulado`); continue; }
  const bestNomes = new Set(best.map(p => p.nome.toLowerCase()));
  const nov = dedup(r.novidades).filter(p => !bestNomes.has(p.nome.toLowerCase()));
  const e = ESTRATEGIA[marca] || gerarInsight(marca, best);
  const capa = best[0].img || null;

  rows.push({ marca, titulo: e.titulo, resumo: e.resumo, categoria: 'Estratégia', url: r.site, fonte: 'Site oficial', data_publicacao: RODADA, rodada: RODADA, destaque: true, imagem_url: capa, produtos: null });
  rows.push({ marca, titulo: 'Mais vendidas — bolsas', resumo: null, categoria: 'Best-seller', url: r.site, fonte: 'Loja oficial', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: capa, produtos: best });
  if (nov.length >= 4) {
    rows.push({ marca, titulo: 'Novidades — chegou agora', resumo: null, categoria: 'Lançamento', url: r.site, fonte: 'Loja oficial', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: nov[0].img, produtos: nov });
  }
  console.log(`${marca}: best=${best.length} nov=${nov.length}`);
}

// Idempotente: limpa as linhas dessa rodada das marcas tratadas e reinsere.
for (const marca of [...new Set(rows.map(x => x.marca))]) {
  await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(marca)}&rodada=eq.${RODADA}`);
}
const ins = await rest('POST', 'noticias_concorrentes', rows);
console.log(`\nInseridas ${ins.length} linhas em ${[...new Set(rows.map(x => x.marca))].length} marcas.`);
