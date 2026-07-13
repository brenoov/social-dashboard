// coletor/lib/storage-upload.mjs
// Upload resiliente pro Supabase Storage. O proxy/CDN na frente do Storage às
// vezes devolve um nginx "400 Bad Request" (ou 5xx / reset de conexão)
// transitório no meio de um lote grande de uploads — um único blip desses
// derrubava o job de geração inteiro (gerar-criativos), perdendo até os
// criativos que já tinham subido. Retry com backoff, mesmo comportamento que
// já era usado em reparar-looks-quebrados.mjs, agora compartilhado.
//
// Dependências injetáveis (fetchImpl/sleepImpl) pra testar sem rede — mesmo
// padrão de injeção de meta-subir.mjs.
import { setTimeout as sleep } from 'node:timers/promises';

export async function subirStorageResiliente({
  url, sk, bucket, path, buf,
  tentativas = 10,
  fetchImpl = fetch,
  sleepImpl = sleep,
  onRetry,
}) {
  let ultimo;
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetchImpl(`${url}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: { apikey: sk, Authorization: 'Bearer ' + sk, 'Content-Type': 'image/png', 'x-upsert': 'true' },
        body: buf,
      });
      if (r.ok) return `${url}/storage/v1/object/public/${bucket}/${path}`;
      ultimo = new Error('upload ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0, 120));
    } catch (e) { ultimo = e; }
    if (t < tentativas) { onRetry?.(t, ultimo); await sleepImpl(Math.min(1500 * t, 8000)); }
  }
  throw ultimo;
}
