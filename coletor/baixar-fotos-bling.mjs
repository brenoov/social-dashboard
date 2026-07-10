#!/usr/bin/env node
// coletor/baixar-fotos-bling.mjs
// Baixa TODAS as fotos de produto do catálogo Bling para uma pasta local.
// Fonte: bling-proxy produtos/{id} → imagemURL / midia.imagens (URLs S3 públicas).
// Reusa a lógica _gcItemImg da tela de Gestão Comercial. Resumível (pula o que já baixou).
// Base de assets para a F2 (criativos) da Fábrica de Anúncios.
//
// Uso:
//   node baixar-fotos-bling.mjs            # baixa tudo p/ coletor/fotos-bling/
//   node baixar-fotos-bling.mjs --dir X    # destino alternativo
//   node baixar-fotos-bling.mjs --limite 50  # só os N primeiros (teste)

import './lib/carregar-env.mjs';
import { loginServico, blingProxy, blingProdutos } from './lib/bling-comercial.mjs';
import { mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const getArg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DEST = resolve(getArg('--dir') || join(__dirname, 'fotos-bling'));
const LIMITE = getArg('--limite') ? parseInt(getArg('--limite'), 10) : Infinity;

// Extrai a URL da imagem de um produto (porte de _gcItemImg da tela de Gestão Comercial).
function itemImg(p) {
  if (!p || typeof p !== 'object') return '';
  if (p.imagemURL && /^https?:/.test(p.imagemURL)) return p.imagemURL;
  const mi = p.midia && p.midia.imagens;
  if (mi) {
    const e = mi.externas && mi.externas[0] && mi.externas[0].link;
    const i = mi.internas && mi.internas[0] && mi.internas[0].link;
    if (e || i) return e || i;
  }
  try { const m = JSON.stringify(p).match(/https?:\/\/[^"'\\]+\.(?:jpg|jpeg|png|webp)/i); if (m) return m[0]; } catch (e) {}
  return '';
}

// Nome de arquivo seguro a partir do código/SKU.
function nomeArquivo(codigo, url) {
  const ext = (url.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i) || [, 'jpg'])[1].toLowerCase();
  const base = String(codigo || 'sem-codigo').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return base + '.' + ext;
}

async function main() {
  mkdirSync(DEST, { recursive: true });
  const jaBaixados = new Set(readdirSync(DEST).map(f => f.replace(/\.(jpg|jpeg|png|webp)$/i, '')));

  const token = await loginServico();
  console.log('login ok — destino:', DEST);

  const prodMap = await blingProdutos(token); // {id:{nome,codigo,preco}}
  const ids = Object.keys(prodMap);
  console.log('produtos no catálogo:', ids.length, LIMITE < Infinity ? `(limitando a ${LIMITE})` : '');

  let lidos = 0, comImg = 0, baixados = 0, pulados = 0, semImg = 0, erros = 0;
  for (const id of ids.slice(0, LIMITE)) {
    const meta = prodMap[id];
    const codigoBase = (meta.codigo || id).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
    if (jaBaixados.has(codigoBase)) { pulados++; continue; }
    lidos++;
    let full;
    try { const d = await blingProxy(token, 'produtos/' + id); full = d && d.data; }
    catch (e) { erros++; console.warn('  detalhe', id, 'falhou:', e.message); continue; }
    const url = itemImg(full);
    if (!url) { semImg++; continue; }
    comImg++;
    try {
      const r = await fetch(url);
      if (!r.ok) { erros++; console.warn('  download', meta.codigo, '->', r.status); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(join(DEST, nomeArquivo(meta.codigo, url)), buf);
      baixados++;
      if (baixados % 25 === 0) console.log(`  … ${baixados} baixadas (lidos ${lidos}, sem img ${semImg})`);
    } catch (e) { erros++; console.warn('  download', meta.codigo, 'erro:', e.message); }
  }

  console.log('\n== FIM ==');
  console.log(`lidos: ${lidos} | com imagem: ${comImg} | baixados: ${baixados} | já existiam: ${pulados} | sem imagem: ${semImg} | erros: ${erros}`);
  console.log('pasta:', DEST);
}

main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
