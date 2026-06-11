#!/usr/bin/env node
// Runner de migrations do iamundi.
// Aplica os .sql de docs/migrations/ que ainda não rodaram, em ordem alfabética,
// registrando cada um numa tabela de controle (public.schema_migrations).
// Idempotente: rodar de novo não re-aplica o que já passou.
//
// Uso:
//   node run-migrations.mjs          # aplica as pendentes
//   node run-migrations.mjs --dry    # só lista o que rodaria, sem aplicar
//
// Lê DATABASE_URL de coletor/.env (connection string do Supabase, com senha).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'docs', 'migrations');
const DRY = process.argv.includes('--dry');

// ── carrega coletor/.env (parser simples, sem dependência) ──
function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL não definida. Cole a connection string do Supabase em coletor/.env');
  console.error('  (Supabase → Project Settings → Database → Connection string → URI)');
  process.exit(1);
}

// TLS com verificação de certificado ligada (os certs do Supabase são válidos
// contra CAs públicas). Se precisar de CA própria, aponte PGSSLROOTCERT pro .crt.
const sslRootCert = process.env.PGSSLROOTCERT;
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ...(sslRootCert && existsSync(sslRootCert) ? { ca: readFileSync(sslRootCert, 'utf8') } : {}),
  },
});

async function main() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error('✗ Pasta de migrations não encontrada:', MIGRATIONS_DIR);
    process.exit(1);
  }
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  if (!files.length) { console.log('Nenhuma migration .sql encontrada.'); return; }

  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );`);

  const { rows } = await client.query('SELECT name FROM public.schema_migrations');
  const applied = new Set(rows.map(r => r.name));
  const pending = files.filter(f => !applied.has(f));

  if (!pending.length) { console.log('✓ Tudo em dia. Nenhuma migration pendente. (' + files.length + ' já aplicadas)'); return; }

  console.log((DRY ? 'DRY-RUN · ' : '') + 'Pendentes: ' + pending.join(', '));
  if (DRY) return;

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write('→ ' + file + ' … ');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(name) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log('OK');
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('FALHOU');
      console.error('  ' + err.message);
      process.exit(1);
    }
  }
  console.log('✓ ' + pending.length + ' migration(s) aplicada(s).');
}

main()
  .catch(err => { console.error('Erro:', err.message); process.exit(1); })
  .finally(() => client.end());
