// coletor/lib/curl-fetch.mjs
// F3 task 9: contorna bloqueio de rede — o `fetch` nativo do Node dá ECONNRESET
// em TODO host atrás de Cloudflare (Supabase, meta-proxy, Anthropic) neste
// ambiente porque o fingerprint TLS do Node está sendo bloqueado. `curl`
// funciona normalmente nos mesmos hosts. Este módulo, ao ser importado,
// SUBSTITUI globalThis.fetch por uma implementação que chama `curl` via
// child_process — suficiente pro jeito que o coletor usa fetch (GET/POST/
// PUT/DELETE, headers simples, body texto/JSON ou binário, leitura de
// texto/JSON/arrayBuffer na resposta).
//
// Uso — carregar ANTES de qualquer outro import que chame fetch:
//   node --import ./lib/curl-fetch.mjs gerar-criativos.mjs ...
// (Node 20.6+; ver LEIA-ME em coletor/lib/LEIA-ME.txt)
//
// Não é um polyfill completo de fetch: sem streaming, sem AbortSignal, sem
// redirect customizado além do -L padrão do curl. Cobre o que o coletor usa.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Guarda o fetch nativo (não usado por padrão, mas fica disponível caso algum
// dia precisemos comparar/depurar ou voltar atrás).
export const nativeFetch = globalThis.fetch;

function toBuffer(body) {
  if (body == null) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return Buffer.from(body.toString(), 'utf8');
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  // fallback razoável — não esperado no coletor, mas evita quebrar silenciosamente.
  return Buffer.from(String(body), 'utf8');
}

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => reject(new Error(`curl-fetch: falha ao executar curl (${err.message})`)));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

// Faz o parse do arquivo de headers gerado por `curl -D`. Com -L (segue
// redirect), o arquivo pode ter mais de um bloco de headers (um por hop, mais
// possíveis "100 Continue"); o bloco que importa é sempre o ÚLTIMO —
// corresponde à resposta final que o curl também gravou em -o.
function parseHeaderFile(raw) {
  const blocks = raw.split(/\r?\n\r?\n/).map((b) => b.trim()).filter(Boolean);
  const last = blocks[blocks.length - 1] || '';
  const lines = last.split(/\r?\n/);
  const statusLine = lines[0] || '';
  const m = statusLine.match(/^HTTP\/\S+\s+(\d+)\s*(.*)$/);
  const status = m ? parseInt(m[1], 10) : 0;
  const statusText = m ? (m[2] || '').trim() : '';
  const map = new Map();
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    map.set(k, v); // último valor vence; suficiente pro uso do coletor
  }
  return { status, statusText, headerMap: map };
}

function makeResponse(status, statusText, headerMap, bodyBuf) {
  const headers = {
    get(name) { return headerMap.has(String(name).toLowerCase()) ? headerMap.get(String(name).toLowerCase()) : null; },
    has(name) { return headerMap.has(String(name).toLowerCase()); },
    forEach(fn) { headerMap.forEach((v, k) => fn(v, k)); },
    entries() { return headerMap.entries(); },
  };
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    headers,
    async text() { return bodyBuf.toString('utf8'); },
    async json() { return JSON.parse(bodyBuf.toString('utf8')); },
    async arrayBuffer() { return bodyBuf.buffer.slice(bodyBuf.byteOffset, bodyBuf.byteOffset + bodyBuf.byteLength); },
  };
}

function normalizeUrl(url) {
  // O parser de URL nativo (WHATWG) percent-encoda automaticamente
  // caracteres inválidos (ex.: espaço) na hora de montar a request — é por
  // isso que `fetch('...nome com espaço...')` funciona no Node mas o mesmo
  // texto cru quebra o curl ("URL rejected: Malformed input"). Normaliza
  // aqui pra manter esse mesmo comportamento leniente.
  try { return new URL(url).href; } catch { return url; }
}

async function curlFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = opts.headers || {};
  const bodyBuf = toBuffer(opts.body);
  url = normalizeUrl(url);

  const dir = await mkdtemp(join(tmpdir(), 'curl-fetch-'));
  const headerFile = join(dir, 'h');
  const outFile = join(dir, 'b');
  const reqBodyFile = bodyBuf ? join(dir, 'req') : null;

  try {
    if (reqBodyFile) await writeFile(reqBodyFile, bodyBuf);

    // timeout padrão 120s; caller pode pedir mais via opts.curlMaxTime (ex.: gpt-image-2 leva 2-4min)
    const maxTime = String(opts.curlMaxTime || 120);
    const args = ['-sS', '-L', '--max-time', maxTime, '-D', headerFile, '-o', outFile, '-X', method];
    for (const [k, v] of Object.entries(headers)) {
      if (v === undefined || v === null) continue;
      args.push('-H', `${k}: ${v}`);
    }
    if (reqBodyFile) args.push('--data-binary', '@' + reqBodyFile);
    args.push(url);

    const { code, stderr } = await runCurl(args);
    if (code !== 0) {
      throw new Error(`curl-fetch: curl saiu com código ${code} em ${method} ${url}: ${stderr.trim() || '(sem stderr)'}`);
    }

    const [headerRaw, respBody] = await Promise.all([
      readFile(headerFile, 'utf8').catch(() => ''),
      readFile(outFile).catch(() => Buffer.alloc(0)),
    ]);
    const { status, statusText, headerMap } = parseHeaderFile(headerRaw);
    return makeResponse(status, statusText, headerMap, respBody);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

globalThis.fetch = curlFetch;

export { curlFetch };
export default curlFetch;
