#!/usr/bin/env node
// VALIDA O CAMINHO DA IMAGEM ENVIADA: arquivo → Storage → Meta → image_hash.
//
// POR QUE ANTES DA TELA: o assistente de criar campanha vai deixar enviar uma
// imagem nova, e esse é o único pedaço do C3 que ainda não tem prova. O
// `meta-proxy` NÃO aceita qualquer URL: ele só busca imagem do host do Storage
// deste projeto (`HOSTS_DE_IMAGEM_PERMITIDOS`), e isso é uma trava contra SSRF
// posta de propósito — quem chamasse escolheria o que o servidor vai buscar.
//
// Então o caminho obrigatório é: sobe no Storage primeiro, manda a URL do
// Storage depois. Este script prova os três passos e limpa os dois lados.
//
// Cria uma imagem na biblioteca da conta (não é anúncio, não gasta) e apaga o
// arquivo do Storage no fim.
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import zlib from 'node:zlib';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL_SB = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'fabrica-criativos';
const CAMINHO = 'gestor-envios/validacao.png';

const provas = [];
const conferir = (nome, ok, det) => { provas.push({ nome, ok: !!ok }); console.log(`  ${ok ? '✓' : '✗'} ${nome}${det ? ' — ' + det : ''}`); };
const sbGet = async (p) => { const r = await fetch(URL_SB + '/rest/v1' + p, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } }); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); };

// UM PNG DE VERDADE, gerado aqui com o zlib do Node. Sem baixar nada de fora: a
// validação não pode depender de um host que pode cair, e imagem de terceiro num
// teste é dependência silenciosa que quebra meses depois.
//
// 600×600 porque a Meta RECUSA imagem pequena — o primeiro teste usou 8×8 (95
// bytes) e voltou 100/2446496 "Formato de imagem", com o `file_size` no corpo do
// erro. O tamanho mínimo é regra da plataforma, não capricho.
function pngDeTeste(lado = 600) {
  const linhas = [];
  for (let y = 0; y < lado; y++) {
    const linha = Buffer.alloc(lado * 3 + 1);
    linha[0] = 0; // filtro "none"
    for (let x = 0; x < lado; x++) {
      // Um degradê simples: dá bytes variados, então o PNG não comprime a quase
      // nada como faria uma cor chapada.
      linha[1 + x * 3] = (x * 255 / lado) | 0;
      linha[2 + x * 3] = (y * 255 / lado) | 0;
      linha[3 + x * 3] = 128;
    }
    linhas.push(linha);
  }
  const bloco = (tipo, dados) => {
    const b = Buffer.alloc(8 + dados.length + 4);
    b.writeUInt32BE(dados.length, 0);
    b.write(tipo, 4);
    dados.copy(b, 8);
    b.writeInt32BE(crc32(Buffer.concat([Buffer.from(tipo), dados])) | 0, 8 + dados.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', ihdr),
    bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// CRC-32 do PNG. Vinte linhas para não trazer uma dependência inteira só por isto.
const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function main() {
  const TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const marca = ((lojas || [])[0] || {}).marca || marcaAtiva;
  console.log(`\n=== ENVIO DE IMAGEM · ${marca.nome} · ${marca.adAccount} ===\n`);

  // 1. SOBE NO STORAGE
  const bytes = pngDeTeste();
  const up = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${CAMINHO}`, {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: bytes,
  });
  conferir('subiu para o Storage', up.ok, up.ok ? `${bytes.length} bytes` : await up.text());
  const publica = `${URL_SB}/storage/v1/object/public/${BUCKET}/${CAMINHO}`;

  // 2. A URL PÚBLICA ABRE — o proxy vai buscar por aqui, e um bucket privado
  //    faria o passo 3 falhar com uma mensagem que não fala de permissão.
  const chk = await fetch(publica);
  conferir('a URL pública abre', chk.ok, chk.status + ' ' + (chk.headers.get('content-type') || ''));

  // 3. O PROXY BUSCA E MANDA PRA META (multipart, sem estourar a query string)
  const r = await fetch(URL_SB + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: marca.accountId, path: `/${marca.adAccount}/adimages`, method: 'POST',
      params: {}, imageFromUrl: publica, imageField: 'validacao',
    }),
  });
  const d = await r.json().catch(() => ({}));
  const imgs = d && d.images;
  const primeira = imgs && Object.values(imgs)[0];
  conferir('a Meta devolveu image_hash', !!(primeira && primeira.hash),
    primeira?.hash ? String(primeira.hash).slice(0, 22) + '…' : JSON.stringify(d).slice(0, 220));

  // 4. UMA URL DE FORA TEM DE SER RECUSADA. É a trava contra SSRF, e teste de
  //    segurança que ninguém executa é decoração.
  const fora = await fetch(URL_SB + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: marca.accountId, path: `/${marca.adAccount}/adimages`, method: 'POST', params: {}, imageFromUrl: 'https://example.com/x.png' }),
  });
  const df = await fora.json().catch(() => ({}));
  conferir('URL de fora do Storage é RECUSADA (trava anti-SSRF)', fora.status === 400 && /nao permitida|não permitida/i.test(JSON.stringify(df)), JSON.stringify(df).slice(0, 90));

  // Limpa o arquivo de teste. A imagem fica na biblioteca da conta — é só uma
  // entrada de biblioteca, não um anúncio, e não gasta.
  const del = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${CAMINHO}`, { method: 'DELETE', headers: { apikey: SK, Authorization: 'Bearer ' + SK } });
  console.log(`  🗑 arquivo de teste ${del.ok ? 'apagado do Storage' : 'NÃO apagado'}`);

  const falhas = provas.filter((p) => !p.ok);
  console.log(`\n=== ${provas.length - falhas.length}/${provas.length} conferências passaram ===`);
  if (falhas.length) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
