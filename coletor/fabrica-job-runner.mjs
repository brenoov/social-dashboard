#!/usr/bin/env node
// coletor/fabrica-job-runner.mjs — wrapper de status da Fábrica de Anúncios (UI Estúdio).
// Lê 1 linha de fabrica_jobs (fila criada pela Edge fabrica-trigger), marca 'rodando', chama o
// run() certo (gerar-criativos.mjs ou subir-estudio.mjs) conforme job.tipo, e grava o estado
// terminal. A rodada (fabrica_campanhas) só fecha (fechada_em) quando o 'subir' termina 100%
// (pendentes===0) — em rate limit (pendentes>0) o job vira 'erro' pra UI oferecer re-disparar,
// sem fechar a rodada (idempotente: subir-estudio.mjs pula os ads já criados).
//
// Uso (mesmo padrão do GitHub Actions runner, Task 6):
//   FABRICA_JOB_ID=<uuid> node --import ./lib/curl-fetch.mjs fabrica-job-runner.mjs
//   node fabrica-job-runner.mjs --job <uuid>
import './lib/carregar-env.mjs';
import { run as gerarRun } from './gerar-criativos.mjs';
import { run as subirRun } from './subir-estudio.mjs';
import { run as ativarRun } from './ativar-estudio.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

// --- Supabase REST (service key) — mesmo padrão de sbGet/sbPost dos outros .mjs do coletor
// (subir-estudio.mjs, gerar-criativos.mjs); sbPatch é o análogo de sbPost trocando o método. ---
async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbPatch(p, body) {
  const r = await fetch(REST + p, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('PATCH ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

// --- estadoTerminalSubir(): função pura — mapeia o resultado de subir-estudio.mjs.run() pro
// estado terminal do job. Só fecha a rodada (fecha:true) quando NADA ficou pendente (100% subiu);
// rate limit (pendentes>0) vira 'erro' pra UI oferecer "re-disparar" (subir-estudio é idempotente,
// então re-rodar só completa o que falta, sem duplicar). ---
export function estadoTerminalSubir(res) {
  if (res.pendentes > 0) return { status: 'erro', fecha: false, erro: 'rate limit — re-disparar pra continuar' };
  return { status: 'concluido', fecha: true };
}

async function main() {
  const jobId = process.env.FABRICA_JOB_ID || (process.argv.includes('--job') ? process.argv[process.argv.indexOf('--job') + 1] : null);
  if (!jobId) throw new Error('FABRICA_JOB_ID ausente (env FABRICA_JOB_ID ou --job <uuid>)');

  const job = (await sbGet(`/fabrica_jobs?select=*&id=eq.${jobId}`))[0];
  if (!job) throw new Error('job não encontrado: ' + jobId);

  await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, {
    status: 'rodando',
    github_run_id: process.env.GITHUB_RUN_ID || null,
    updated_at: new Date().toISOString(),
  });

  try {
    if (job.tipo === 'gerar') {
      const r = await gerarRun(job.params || {});
      await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'concluido', resultado: r, updated_at: new Date().toISOString() });
    } else if (job.tipo === 'subir') {
      const r = await subirRun(job.params || {});
      const t = estadoTerminalSubir(r);
      await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: t.status, resultado: r, erro: t.erro || null, updated_at: new Date().toISOString() });
      if (t.fecha && job.params?.campanhaId) {
        await sbPatch(`/fabrica_campanhas?id=eq.${job.params.campanhaId}`, { fechada_em: new Date().toISOString() });
      }
    } else if (job.tipo === 'ativar') {
      const r = await ativarRun(job.params || {});
      await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'concluido', resultado: r, updated_at: new Date().toISOString() });
    } else {
      throw new Error('tipo inválido: ' + job.tipo);
    }
  } catch (e) {
    await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'erro', erro: String(e.message).slice(0, 500), updated_at: new Date().toISOString() });
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
}
