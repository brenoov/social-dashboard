// coletor/lojas.mjs
// Adaptadores das LOJAS OFICIAIS dos concorrentes (foco: bolsas).
// Cada loja expõe best-sellers e novidades como [{nome, preco, img, url}].
// Reaproveitado pelo piloto manual e pelo agente automático (agente-noticias.mjs).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const TIMEOUT = 22000;

async function getJson(u, json = true) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) return null;
  return r.json();
}

// ── VTEX (catálogo legado público) ──
function mapVtex(base) {
  return p => {
    const it = (p.items && p.items[0]) || {};
    const img = (it.images && it.images[0] && it.images[0].imageUrl) || '';
    const off = (it.sellers && it.sellers[0] && it.sellers[0].commertialOffer) || {};
    return { nome: p.productName, preco: off.Price || null, url: p.link || (base + '/' + (p.linkText || '') + '/p'), img };
  };
}
// Busca por categoria (ex.: Santa Lolla /bolsas). order: OrderByTopSaleDESC | OrderByReleaseDateDESC
async function vtexCat(base, cat, order, n = 12) {
  const a = await getJson(`${base}/api/catalog_system/pub/products/search/${cat}?O=${order}&_from=0&_to=${n - 1}`);
  return Array.isArray(a) ? a.map(mapVtex(base)).filter(p => p.img && p.nome) : [];
}
// Busca full-text "bolsa" (lojas VTEX sem categoria conhecida). Filtra p/ nome de bolsa.
const BAG_RE = /bolsa|bag|mochila|clutch|carteira|necessaire|tiracolo|shoulder|hobo|tote|shopper|baguete|crossbody/i;
async function vtexFt(base, order, n = 14) {
  const a = await getJson(`${base}/api/catalog_system/pub/products/search?ft=bolsa&O=${order}&_from=0&_to=${n - 1}`);
  if (!Array.isArray(a)) return [];
  return a.map(mapVtex(base)).filter(p => p.img && p.nome && BAG_RE.test(p.nome)).slice(0, 12);
}

// ── SAP Commerce OCC (grupo Azzas: Arezzo, Schutz, Anacapri) ──
// Backend compartilhado em /arezzocoocc/v2/<store>/. sort: best-selling-desc | creation-time
async function occ(domain, store, sort, n = 12) {
  const base = `https://${domain}`;
  const j = await getJson(`${base}/arezzocoocc/v2/${store}/products/search?category=BOLSAS&currentPage=0&pageSize=${n}&fields=FULL&storeFinder=false&sort=${sort}`);
  return ((j && j.products) || []).map(p => {
    const im = (p.images && (p.images.find(i => i.format === 'product') || p.images.find(i => i.imageType === 'PRIMARY') || p.images[0])) || {};
    let img = im.url || '';
    if (img && img.startsWith('/')) img = base + img;
    return { nome: p.name, preco: (p.price && p.price.value) || null, url: p.url ? base + p.url : '', img };
  }).filter(p => p.img && p.nome);
}

export const LOJAS = {
  'Santa Lolla': {
    site: 'https://www.santalolla.com.br/bolsas',
    bestsellers: () => vtexCat('https://www.santalolla.com.br', 'bolsas', 'OrderByTopSaleDESC'),
    novidades: () => vtexCat('https://www.santalolla.com.br', 'bolsas', 'OrderByReleaseDateDESC'),
  },
  'Arezzo&Co': {
    site: 'https://www.arezzo.com.br/c/bolsas',
    bestsellers: () => occ('www.arezzo.com.br', 'arezzo', 'best-selling-desc'),
    novidades: () => occ('www.arezzo.com.br', 'arezzo', 'creation-time'),
  },
  'Schutz': {
    site: 'https://www.schutz.com.br/c/bolsas',
    bestsellers: () => occ('www.schutz.com.br', 'schutz', 'best-selling-desc'),
    novidades: () => occ('www.schutz.com.br', 'schutz', 'creation-time'),
  },
  'Anacapri': {
    site: 'https://www.anacapri.com.br/c/bolsas',
    bestsellers: () => occ('www.anacapri.com.br', 'anacapri', 'best-selling-desc'),
    novidades: () => occ('www.anacapri.com.br', 'anacapri', 'creation-time'),
  },
  'Capodarte': {
    site: 'https://www.capodarte.com.br/bolsas',
    bestsellers: () => vtexFt('https://www.capodarte.com.br', 'OrderByTopSaleDESC'),
    novidades: () => vtexFt('https://www.capodarte.com.br', 'OrderByReleaseDateDESC'),
  },
  'Luz da Lua': {
    site: 'https://www.luzdalua.com.br/bolsas',
    bestsellers: () => vtexFt('https://www.luzdalua.com.br', 'OrderByTopSaleDESC'),
    novidades: () => vtexFt('https://www.luzdalua.com.br', 'OrderByReleaseDateDESC'),
  },
  'Petite Jolie': {
    site: 'https://www.petitejolie.com.br/bolsas',
    bestsellers: () => vtexFt('https://www.petitejolie.com.br', 'OrderByTopSaleDESC'),
    novidades: () => vtexFt('https://www.petitejolie.com.br', 'OrderByReleaseDateDESC'),
  },
  'Jorge Bischoff': {
    site: 'https://www.jorgebischoff.com.br/bolsas',
    bestsellers: () => vtexFt('https://www.jorgebischoff.com.br', 'OrderByTopSaleDESC'),
    novidades: () => vtexFt('https://www.jorgebischoff.com.br', 'OrderByReleaseDateDESC'),
  },
};

// Coleta best-sellers + novidades de uma marca; tolera falha de um lado.
export async function coletarLoja(marca) {
  const loja = LOJAS[marca];
  if (!loja) return null;
  const [bestsellers, novidades] = await Promise.all([
    loja.bestsellers().catch(() => []),
    loja.novidades().catch(() => []),
  ]);
  return { marca, site: loja.site, bestsellers, novidades };
}
