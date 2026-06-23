// Piloto manual (sem API paga): coleta best-sellers/novidades das lojas oficiais,
// monta as linhas (estratégia + galerias) e grava em noticias_concorrentes via REST.
import fs from 'fs';
import { coletarLoja } from './lojas.mjs';

// .env manual
const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const dedup = a => { const s = new Set(); return a.filter(p => { const k = (p.nome || '').toLowerCase(); if (!k || s.has(k)) return false; s.add(k); return true; }); };

// Leituras estratégicas (escritas à mão, ancoradas nos dados reais coletados)
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
for (const marca of ['Santa Lolla', 'Arezzo&Co']) {
  const r = await coletarLoja(marca);
  const best = dedup(r.bestsellers);
  const novNomes = new Set(best.map(p => p.nome.toLowerCase()));
  const nov = dedup(r.novidades).filter(p => !novNomes.has(p.nome.toLowerCase()));
  const e = ESTRATEGIA[marca];
  const capa = best[0] && best[0].img || null;

  // 1) Hero estratégico (foco no oficial, capa = bolsa campeã)
  rows.push({ marca, titulo: e.titulo, resumo: e.resumo, categoria: 'Estratégia', url: r.site, fonte: 'Site oficial', data_publicacao: RODADA, rodada: RODADA, destaque: true, imagem_url: capa, produtos: null });

  // 2) Galeria de best-sellers (TODAS)
  rows.push({ marca, titulo: 'Mais vendidas — bolsas', resumo: null, categoria: 'Best-seller', url: r.site, fonte: 'Loja oficial', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: capa, produtos: best });

  // 3) Galeria de novidades (só se distinta)
  if (nov.length >= 4) {
    rows.push({ marca, titulo: 'Novidades — chegou agora', resumo: null, categoria: 'Lançamento', url: r.site, fonte: 'Loja oficial', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: nov[0].img, produtos: nov });
  }
  console.log(`${marca}: best=${best.length} nov=${nov.length}`);
}

// Limpa o piloto anterior dessas marcas nessa rodada e insere o novo
for (const marca of ['Santa Lolla', 'Arezzo&Co']) {
  await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(marca)}&rodada=eq.${RODADA}`);
}
const ins = await rest('POST', 'noticias_concorrentes', rows);
console.log('\nInseridas', ins.length, 'linhas:');
ins.forEach(x => console.log('  •', x.marca, '|', x.categoria, '|', x.titulo, '| produtos:', (x.produtos || []).length, '| img:', x.imagem_url ? 'sim' : 'não'));
