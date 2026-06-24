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
  'Isla': {
    site: 'https://www.islaoficial.com.br/bolsas',
    bestsellers: () => vtexCat('https://www.islaoficial.com.br', 'bolsas', 'OrderByTopSaleDESC'),
    novidades: () => vtexCat('https://www.islaoficial.com.br', 'bolsas', 'OrderByReleaseDateDESC'),
  },
  // Luiza Barcelos — Oracle Commerce Cloud (Endeca). N=831170983 = categoria Bolsas.
  'Luiza Barcelos': {
    site: 'https://www.luizabarcelos.com.br/categoria/bolsas',
    bestsellers: async () => (await occEndecaLB()).best,
    novidades: async () => (await occEndecaLB()).nov,
  },
  // Victor Hugo — Typesense (backend mkplace). filter category:=Bolsas.
  'Victor Hugo': {
    site: 'https://www.victorhugo.com.br/search?collection=bolsas',
    bestsellers: async () => (await typesenseVHAll()).best,
    novidades: async () => (await typesenseVHAll()).nov,
  },
};

const dedupP = arr => { const s = new Set(); return arr.filter(p => { if (!p || !p.img || !p.nome) return false; const k = p.nome + '|' + p.img; if (s.has(k)) return false; s.add(k); return true; }); };

// ── Luiza Barcelos (Oracle Commerce / Endeca) ── memoiza a PROMISE (Promise.all chama best+nov juntos)
let _lbP = null;
function occEndecaLB() {
  if (_lbP) return _lbP;
  _lbP = (async () => {
    const u = 'https://www.luizabarcelos.com.br/ccstoreui/v1/search?N=831170983&searchType=simple&No=0&Nrpp=60&language=pt_BR';
    const j = await getJson(u);
    const recs = (j && j.resultsList && j.resultsList.records) || [];
    const flat = [];
    for (const g of recs) for (const lf of (g.records || [g])) {
      const a = lf.attributes || {}; const get = k => Array.isArray(a[k]) ? a[k][0] : a[k];
      let img = get('product.primaryLargeImageURL') || get('product.primaryMediumImageURL') || get('product.primaryFullImageURL');
      if (img && img.startsWith('/')) img = 'https://www.luizabarcelos.com.br' + img;
      if (img && get('product.displayName')) flat.push({ nome: get('product.displayName'), preco: Number(get('sku.activePrice') || get('product.listPrice') || 0) || null, url: 'https://www.luizabarcelos.com.br' + (get('product.route') || ''), img, _cri: Number(get('product.creationDate') || 0) });
    }
    const uniq = dedupP(flat);
    const best = uniq.slice(0, 12);
    const bestK = new Set(best.map(p => p.nome));
    let nov = [...uniq].sort((a, b) => b._cri - a._cri).filter(p => !bestK.has(p.nome)).slice(0, 12);
    if (!nov.length) nov = uniq.slice(12, 24);
    const strip = a => a.map(({ _cri, ...p }) => p);
    return { best: strip(best), nov: strip(nov) };
  })();
  return _lbP;
}

// ── Victor Hugo (Typesense / mkplace) ── 1 fetch memoizado; best=ordem default, nov=createdAt desc (client-side)
let _vhP = null;
function typesenseVHAll() {
  if (_vhP) return _vhP;
  _vhP = (async () => {
    const u = 'https://search.main.mkplace.com.br/multi_search?use_cache=true&x-typesense-api-key=9sUhPk3OEt7l3KJghC2YlaYF3zXw5kUD';
    const body = { searches: [{ collection: 'col-tvdxhJKtc5-tvdxhJKtc5-search', q: '*', query_by: 'name', filter_by: 'category:=[`Bolsas`]', group_by: 'deduplicator', group_limit: 1, per_page: 50, page: 1, sort_by: '_text_match:desc' }] };
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return { best: [], nov: [] };
    const j = await r.json(); const res = (j.results && j.results[0]) || {};
    const docs = (res.grouped_hits || []).map(g => g.hits[0].document).filter(d => !(d.offer && d.offer.isAvailable === false));
    const map = d => ({ nome: d.name, preco: (d.offer && (d.offer.price || d.offer.originalPrice)) || null, url: 'https://www.victorhugo.com.br/' + d.slug, img: (d.images && d.images[0]) || d.thumbnail || '', _cri: Number(d.createdAt || d._createdAt || 0) });
    const uniq = dedupP(docs.map(map));
    const best = uniq.slice(0, 12);
    const bestK = new Set(best.map(p => p.nome));
    let nov = [...uniq].sort((a, b) => b._cri - a._cri).filter(p => !bestK.has(p.nome)).slice(0, 12);
    if (!nov.length) nov = uniq.slice(12, 24);
    const strip = a => a.map(({ _cri, ...p }) => p);
    return { best: strip(best), nov: strip(nov) };
  })();
  return _vhP;
}

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
