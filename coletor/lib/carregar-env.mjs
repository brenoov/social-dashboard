// Carrega coletor/.env em process.env (só ambiente local; no CI as vars já vêm
// do ambiente). DEVE ser importado ANTES de módulos que leem process.env no topo
// (ex.: bling-comercial.mjs), porque imports ESM são avaliados antes do corpo do
// módulo que os importa. Só define chaves ainda ausentes (o ambiente do CI vence).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const p = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');   // coletor/.env
if (existsSync(p)) {
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
