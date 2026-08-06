#!/usr/bin/env node
/* Abre a posse que falta em cada carro com dono, na virada de chave (F6b).
 *
 * Uso:  node abrir-posses-frota.mjs [--gravar]
 *
 * A tabela frota_uso só guardava VIAGEM, e quem tem carro fixo nunca "retira"
 * e "devolve" o próprio carro — por isso ela ficou vazia mesmo com 7 pessoas
 * já tendo acesso. Este script roda UMA VEZ (por carro que ainda não tem
 * posse aberta) pra abrir a linha do tempo sem buraco que posse.js espera
 * encontrar dali pra frente. Sem a bandeira --gravar só MOSTRA o que faria —
 * é o padrão seguro, porque estas linhas ficam no banco de produção. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { abrirPossesQueFaltam } from '../supabase/functions/_shared/posse.js';

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
  const { rows: veiculos } = await client.query(
    'select id, pessoa_id, situacao from public.frota_veiculos');
  const { rows: usos } = await client.query(
    'select id, veiculo_id, tipo, volta_em, saida_em from public.frota_uso');
  const novas = abrirPossesQueFaltam(veiculos, usos, new Date().toISOString());
  console.log(`${novas.length} posses a abrir`);
  for (const n of novas) console.log(`  veiculo ${n.veiculo_id} -> pessoa ${n.pessoa_id}`);
  if (process.argv.includes('--gravar')) {
    for (const n of novas) {
      await client.query(
        'insert into public.frota_uso(veiculo_id, tipo, pessoa_id, saida_em) values ($1,$2,$3,$4)',
        [n.veiculo_id, n.tipo, n.pessoa_id, n.saida_em]);
    }
    console.log(`${novas.length} posses gravadas`);
  }
} catch (e) {
  console.error('✗ FALHOU:', e.message); process.exitCode = 1;
} finally { await client.end(); }
