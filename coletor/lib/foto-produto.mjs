// coletor/lib/foto-produto.mjs
// Resolve a foto de um produto -> data URL. 1) cache local coletor/fotos-bling;
// 2) Bling produtos/{id} (imagemURL/midia) com fallback variação->pai (_gcItemImg).
// 3) recorta o fundo (rembg, coletor/lib/cutout.mjs) e devolve o CUTOUT
//    transparente como data URL; se o recorte falhar por qualquer motivo,
//    cai pra foto crua original (nunca quebra o pipeline).
import { blingProxy } from './bling-comercial.mjs';
import { cutout } from './cutout.mjs';
import { avaliarStudioRaw } from './render-criativo.mjs';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fotos-bling');
const BAIXADAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'fotos-baixadas');
const nomeCache = (sku) => String(sku || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);

// veredito "estúdio vs amador" avaliado na foto CRUA (pré-cutout), cacheado por sku. O
// generator consulta via fotoEhStudio(sku) DEPOIS de fotoDataUrl(). Default true (não
// bloqueia por falta de dado). Ver avaliarStudioRaw() em render-criativo.mjs.
const _studioRaw = new Map();
export function fotoEhStudio(sku) { const v = _studioRaw.get(sku); return v === undefined ? true : v; }

// aplica o recorte de fundo a um arquivo local e devolve o data URL do
// resultado; em qualquer falha, devolve o data URL da foto crua (fallback).
// Também avalia a foto CRUA (antes do recorte) e guarda o veredito estúdio/amador.
async function comCutout(localPath, mimeRaw, sku) {
  const raw = 'data:' + mimeRaw + ';base64,' + readFileSync(localPath).toString('base64');
  if (sku != null) { try { const v = await avaliarStudioRaw(raw); _studioRaw.set(sku, !!v.studio); } catch (e) { /* falha na avaliação não bloqueia */ } }
  try {
    const outPath = await cutout(localPath);
    return 'data:image/png;base64,' + readFileSync(outPath).toString('base64');
  } catch (e) {
    console.warn('  cutout falhou, usando foto crua:', localPath, e.message);
    return raw;
  }
}

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
      return comCutout(local, mime, sku);
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
    const mime = mimeDe(url);
    // salva a foto crua baixada num arquivo local pro cutout() poder lê-la
    // (e serve de cache pra não rebaixar em corridas futuras).
    if (!existsSync(BAIXADAS)) mkdirSync(BAIXADAS, { recursive: true });
    const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
    const local = join(BAIXADAS, baseNome + '.' + ext);
    writeFileSync(local, buf);
    return comCutout(local, mime);
  } catch (e) {
    return null;
  }
}
