#!/usr/bin/env node
// Roda um arquivo .sql arbitrário (passado como argv[2]) contra o banco do iamundi,
// usando DATABASE_URL de coletor/.env + a CA do Supabase. Útil quando o MCP está
// derrubando o socket em DDL. Uso: node run-acessos-sql.mjs ../db/migrations-acessos/006_zoho.sql
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
const file = resolve(process.cwd(), process.argv[2]);
const sql = readFileSync(file, 'utf8');
await client.connect();
try { await client.query(sql); console.log('✓ aplicado:', process.argv[2]); }
catch (e) { console.error('✗ FALHOU:', e.message); process.exitCode = 1; }
finally { await client.end(); }
