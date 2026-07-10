// coletor/lib/foto-produto.mjs
// Resolve a foto de um produto -> data URL. 1) cache local coletor/fotos-bling;
// 2) Bling produtos/{id} (imagemURL/midia) com fallback variação->pai (_gcItemImg).
import { blingProxy } from './bling-comercial.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fotos-bling');
const nomeCache = (sku) => String(sku || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);

function itemImg(p) {
  if (!p || typeof p !== 'object') return '';
  if (p.imagemURL && /^https?:/.test(p.imagemURL)) return p.imagemURL;
  const mi = p.midia && p.midia.imagens;
  if (mi) { const e = mi.externas && mi.externas[0] && mi.externas[0].link; const i = mi.internas && mi.internas[0] && mi.internas[0].link; if (e || i) return e || i; }
  try { const m = JSON.stringify(p).match(/https?:\/\/[^"'\\]+\.(?:jpg|jpeg|png|webp)/i); if (m) return m[0]; } catch (e) {}
  return '';
}
const mimeDe = (u) => /\.png(\?|$)/i.test(u) ? 'image/png' : (/\.webp(\?|$)/i.test(u) ? 'image/webp' : 'image/jpeg');

export async function fotoDataUrl(token, sku) {
  // 1) cache local (tenta jpg/png/webp)
  const baseNome = nomeCache(sku);
  for (const ext of ['jpg', 'png', 'webp']) {
    const local = join(CACHE, baseNome + '.' + ext);
    if (existsSync(local)) {
      const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
      return 'data:' + mime + ';base64,' + readFileSync(local).toString('base64');
    }
  }
  // 2) Bling
  try {
    const base = String(sku).split('-')[0].trim();
    const listar = async (params) => { const r = await blingProxy(token, 'produtos', params); return (r && r.data) || []; };
    const detalhe = async (id) => { const r = await blingProxy(token, 'produtos/' + id); return (r && r.data) || null; };
    let list = await listar({ codigo: sku, limite: 3 });
    if (!list.length && base !== sku) list = await listar({ codigo: base, limite: 6 });
    if (!list.length) list = await listar({ pesquisa: sku, limite: 8 });
    if (!list.length && base !== sku) list = await listar({ pesquisa: base, limite: 8 });
    if (!list.length) return null;
    const prod = list.find(p => String(p.codigo || '').toLowerCase().startsWith(base.toLowerCase())) || list[0];
    let full = (await detalhe(prod.id)) || prod;
    if (!itemImg(full) && base !== sku) {
      const pl = await listar({ codigo: base, limite: 6 });
      const pp = pl.find(p => String(p.codigo || '').toLowerCase() === base.toLowerCase()) || pl[0];
      if (pp) { const pd = await detalhe(pp.id); if (pd && itemImg(pd)) full = pd; }
    }
    const url = itemImg(full);
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return 'data:' + mimeDe(url) + ';base64,' + buf.toString('base64');
  } catch (e) {
    return null;
  }
}
