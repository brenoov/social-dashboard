// coletor/lib/cutout.mjs
// Recorta o fundo de uma foto de produto via rembg (Python, recortar.py) e
// cacheia o PNG transparente resultante em coletor/fotos-cutout/. Resumível:
// se o cache já existe, não roda o Python de novo.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'fotos-cutout');
const SCRIPT = join(ROOT, 'recortar.py');

function nomeSaida(inputPath) {
  const base = basename(inputPath, extname(inputPath));
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) + '.png';
}

// cutout(inputPath) -> caminho do PNG transparente (cacheado). Lança em erro
// (chamador decide se cai pro raw).
export async function cutout(inputPath) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, nomeSaida(inputPath));
  if (existsSync(outPath)) return outPath;

  await new Promise((resolve, reject) => {
    const p = spawn('python3', [SCRIPT, inputPath, outPath]);
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0 && existsSync(outPath)) resolve();
      else reject(new Error('recortar.py falhou (' + code + '): ' + stderr.slice(0, 300)));
    });
  });
  return outPath;
}
