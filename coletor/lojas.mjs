// coletor/lojas.mjs
// Adaptadores das LOJAS OFICIAIS dos concorrentes (foco: bolsas).
// Cada loja expõe best-sellers e novidades como [{nome, preco, img, url}].
// Reaproveitado pelo piloto manual e pelo agente automático (agente-noticias.mjs).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const TIMEOUT = 20000;

// ── VTEX (catálogo legado público) ──
// order: OrderByTopSaleDESC (mais vendidos) | OrderByReleaseDateDESC (novidades)
async function vtex(base, cat, order, n = 12) {
  const u = `${base}/api/catalog_system/pub/products/search/${cat}?O=${order}&_from=0&_to=${n - 1}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) return [];
  const a = await r.json();
  return a.map(p => {
    const it = (p.items && p.items[0]) || {};
    const img = (it.images && it.images[0] && it.images[0].imageUrl) || '';
    const off = (it.sellers && it.sellers[0] && it.sellers[0].commertialOffer) || {};
    return { nome: p.productName, preco: off.Price || null, url: p.link || (base + '/' + (p.linkText || '') + '/p'), img };
  }).filter(p => p.img && p.nome);
}

// ── SAP Commerce OCC (Arezzo&Co / Azzas) ──
// sort: best-selling-desc (mais vendidos) | creation-time (novidades)
async function occArezzo(category, sort, n = 12) {
  const base = 'https://www.arezzo.com.br';
  const u = `${base}/arezzocoocc/v2/arezzo/products/search?category=${category}&currentPage=0&pageSize=${n}&fields=FULL&storeFinder=false&sort=${sort}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.products || []).map(p => {
    const im = (p.images && (p.images.find(i => i.format === 'product') || p.images.find(i => i.imageType === 'PRIMARY') || p.images[0])) || {};
    let img = im.url || '';
    if (img && img.startsWith('/')) img = base + img;
    return { nome: p.name, preco: (p.price && p.price.value) || null, url: p.url ? base + p.url : '', img };
  }).filter(p => p.img && p.nome);
}

export const LOJAS = {
  'Santa Lolla': {
    site: 'https://www.santalolla.com.br/bolsas',
    bestsellers: () => vtex('https://www.santalolla.com.br', 'bolsas', 'OrderByTopSaleDESC'),
    novidades: () => vtex('https://www.santalolla.com.br', 'bolsas', 'OrderByReleaseDateDESC'),
  },
  'Arezzo&Co': {
    site: 'https://www.arezzo.com.br/c/bolsas',
    bestsellers: () => occArezzo('BOLSAS', 'best-selling-desc'),
    novidades: () => occArezzo('BOLSAS', 'creation-time'),
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
