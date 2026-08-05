#!/usr/bin/env node
// Roda um SELECT (passado como argv[2]) contra o banco do iamundi e IMPRIME o resultado.
// Irmao do run-acessos-sql.mjs, que aplica DDL mas nao mostra linha nenhuma.
// Uso: node consultar.mjs "select 1"
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const raw of readFileSync(join(__dirname, '.env'), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i === -1) continue;
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}
const caPath = process.env.PGSSLROOTCERT || join(__dirname, 'supabase-ca.crt');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: readFileSync(caPath, 'utf8') },
});
await client.connect();
try {
  const r = await client.query(process.argv[2]);
  console.log(JSON.stringify(r.rows, null, 1));
} catch (e) {
  console.error('✗ FALHOU:', e.message); process.exitCode = 1;
} finally { await client.end(); }
