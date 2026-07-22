// coletor/lib/zoho-workdrive.mjs
// Sobe os criativos FINAIS pro Zoho WorkDrive (NUVEM), organizados por loja -> data. Roda no CI (a
// fábrica é nuvem), então independe de máquina/TrueSync. OAuth via refresh token (secrets ZOHO_*).
// Sem os secrets -> zohoAtivo() é false e o chamador pula (no-op), sem quebrar nada.
import { randomUUID } from 'node:crypto';

const DC = () => process.env.ZOHO_DC || 'com';
export function zohoAtivo() {
  return !!(process.env.ZOHO_REFRESH_TOKEN && process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);
}

let _at = null, _atExp = 0;
async function accessToken() {
  if (_at && Date.now() < _atExp) return _at;
  const body = new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET,
  }).toString();
  const r = await fetch(`https://accounts.zoho.${DC()}/oauth/v2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('zoho token -> ' + (j.error || r.status));
  _at = j.access_token; _atExp = Date.now() + 50 * 60 * 1000; // renova antes de 1h
  return _at;
}
const API = () => `https://www.zohoapis.${DC()}/workdrive/api/v1`;
async function authH() { return { Authorization: 'Zoho-oauthtoken ' + (await accessToken()) }; }

export async function listarPasta(parentId) {
  const r = await fetch(`${API()}/files/${parentId}/files`, { headers: { ...(await authH()), Accept: 'application/vnd.api+json' } });
  const j = await r.json();
  return (Array.isArray(j.data) ? j.data : []).map((d) => ({ id: d.id, name: (d.attributes?.name || '').trim(), folder: d.attributes?.is_folder }));
}

// acha (por nome) ou cria uma subpasta dentro de parentId; devolve o id. Cacheado em memória por run.
const _cachePasta = new Map();
export async function acharOuCriarPasta(parentId, nome) {
  const chave = parentId + '/' + nome;
  if (_cachePasta.has(chave)) return _cachePasta.get(chave);
  const itens = await listarPasta(parentId);
  let id = itens.find((x) => x.folder && x.name === nome)?.id;
  if (!id) {
    const r = await fetch(`${API()}/files`, {
      method: 'POST', headers: { ...(await authH()), 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
      body: JSON.stringify({ data: { attributes: { name: nome, parent_id: parentId }, type: 'files' } }),
    });
    const j = await r.json();
    id = Array.isArray(j.data) ? j.data[0]?.id : j.data?.id;
    if (!id) throw new Error('zoho criar pasta "' + nome + '" -> ' + JSON.stringify(j.errors || j).slice(0, 150));
  }
  _cachePasta.set(chave, id);
  return id;
}

// multipart/form-data como Buffer (o shim curl-fetch do CI não serializa FormData nativo)
function multipart(parts) {
  const boundary = '----wd' + randomUUID().replace(/-/g, '');
  const chunks = [];
  const txt = (s) => chunks.push(Buffer.from(s, 'utf8'));
  for (const p of parts) {
    txt(`--${boundary}\r\n`);
    if (p.buf != null) { txt(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: ${p.mime}\r\n\r\n`); chunks.push(p.buf); txt('\r\n'); }
    else txt(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`);
  }
  txt(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function uploadArquivo(parentId, filename, buf, mime = 'application/octet-stream') {
  const { body, contentType } = multipart([
    { name: 'content', filename, mime, buf },
    { name: 'parent_id', value: parentId },
    { name: 'filename', value: filename },
    { name: 'override-name-exist', value: 'true' },
  ]);
  const r = await fetch(`${API()}/upload`, {
    method: 'POST', headers: { ...(await authH()), 'Content-Type': contentType }, body, curlMaxTime: 120,
  });
  if (!r.ok) throw new Error('zoho upload "' + filename + '" -> ' + r.status + ' ' + (await r.text()).slice(0, 150));
  return true;
}
