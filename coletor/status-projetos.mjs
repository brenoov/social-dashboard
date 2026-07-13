#!/usr/bin/env node
// coletor/status-projetos.mjs — parser dos planos markdown → tabela projetos_status.
// Lê docs/superpowers/plans/*.md, agrupa por "família" de projeto (derivada do nome
// do arquivo), pega o plano mais recente de cada, deriva etapa/progresso/situação de
// forma DETERMINÍSTICA (sem LLM) e faz UPSERT em projetos_status. Alimenta a seção
// "projetos em desenvolvimento" do Painel de Status do Claude.
//
// Roda no workflow status-projetos.yml (push aos planos) ou local:
//   SUPABASE_SERVICE_KEY=... node coletor/status-projetos.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLANS_DIR = join(__dirname, '..', 'docs', 'superpowers', 'plans');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('✗ falta SUPABASE_SERVICE_KEY'); process.exit(1); }

const FASE_RE = /-(f\d+[a-z]?|sp\d+[a-z]?)(?:-|$)/i;

// Humaniza um slug kebab-case em título ("gestor-comercial" -> "Gestor Comercial").
function humanizar(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// Extrai família + etapa + resto do nome do arquivo (sem data nem .md).
function parsearNome(arquivo) {
  const semExt = arquivo.replace(/\.md$/i, '');
  const semData = semExt.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const dataM = semExt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dataInt = dataM ? Number(dataM[1] + dataM[2] + dataM[3]) : 0;
  const faseM = semData.match(FASE_RE);
  if (faseM) {
    const familia = semData.slice(0, faseM.index);
    const etapa = faseM[1].toUpperCase();
    const resto = semData.slice(faseM.index + faseM[0].length);
    return { familia, etapa, resto, dataInt };
  }
  return { familia: semData, etapa: null, resto: '', dataInt };
}

// Deriva progresso (checkboxes) e situação do conteúdo do plano.
function analisarConteudo(txt) {
  const feitos = (txt.match(/- \[x\]/gi) || []).length;
  const abertos = (txt.match(/- \[ \]/g) || []).length;
  const total = feitos + abertos;
  const progresso = total ? Math.round((feitos / total) * 100) : 0;
  const up = txt.toUpperCase();
  let situacao;
  if (/\bNO AR\b/.test(up) || up.includes('CONCLUÍD') || up.includes('CONCLUID') || (total > 0 && feitos === total)) {
    situacao = 'no-ar';
  } else if (/\bPAUSAD/i.test(txt) || /\bBLOQUEAD/i.test(txt) || /\bTRAVAD/i.test(txt) || /\bEM ESPERA\b/i.test(txt)) {
    situacao = 'pausado';
  } else if (feitos > 0) {
    situacao = 'em-andamento';
  } else {
    situacao = 'planejado';
  }
  return { feitos, total, progresso, situacao };
}

function main() {
  let arquivos;
  try {
    arquivos = readdirSync(PLANS_DIR).filter((f) => f.toLowerCase().endsWith('.md') && f !== 'LEIA-ME.txt');
  } catch (e) {
    console.error('✗ não consegui ler', PLANS_DIR, '-', e.message);
    process.exit(1);
  }

  // Agrupa por família; guarda o plano mais recente (maior dataInt) de cada.
  const porFamilia = {};
  for (const arq of arquivos) {
    const info = parsearNome(arq);
    const g = porFamilia[info.familia];
    if (!g || info.dataInt > g.dataInt) porFamilia[info.familia] = { ...info, arquivo: arq };
  }

  const registros = [];
  for (const familia of Object.keys(porFamilia)) {
    const rep = porFamilia[familia];
    let txt = '';
    try { txt = readFileSync(join(PLANS_DIR, rep.arquivo), 'utf8'); } catch (_) {}
    const c = analisarConteudo(txt);
    registros.push({
      projeto: familia,
      titulo: humanizar(familia),
      etapa: rep.etapa,
      // descrição NÃO é gerenciada pelo parser (fica curada à mão, em português simples);
      // por isso não entra no upsert — assim o robô nunca apaga o texto escrito por gente.
      situacao: c.situacao,
      progresso: c.progresso,
      checkboxes_feitos: c.feitos,
      checkboxes_total: c.total,
      plano_arquivo: 'docs/superpowers/plans/' + rep.arquivo,
      ordem: rep.dataInt,               // YYYYMMDD → tela ordena por ordem.desc (mais recente primeiro)
      atualizado_em: new Date().toISOString(),
    });
  }

  return registros;
}

// Slugs que o usuário mexeu à mão (manual=true) — o parser NÃO toca neles.
async function slugsManuais() {
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/projetos_status?select=projeto&manual=is.true', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    })
    if (!r.ok) return new Set()
    const arr = await r.json()
    return new Set((arr || []).map((x) => x.projeto))
  } catch (_) { return new Set() }
}

async function upsert(registros) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/projetos_status?on_conflict=projeto', {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(registros),
  });
  if (!r.ok && ![200, 201, 204].includes(r.status)) {
    throw new Error('UPSERT projetos_status -> ' + r.status + ' ' + (await r.text()).slice(0, 300));
  }
}

let registros = main();
const manuais = await slugsManuais();
const pulados = registros.filter((p) => manuais.has(p.projeto)).length;
registros = registros.filter((p) => !manuais.has(p.projeto)); // respeita edições manuais
console.log(`Projetos derivados: ${registros.length} (pulei ${pulados} editados à mão)`);
for (const p of registros) console.log(`  · ${p.projeto} [${p.etapa || '—'}] ${p.situacao} ${p.progresso}%`);
if (registros.length) await upsert(registros);
console.log('✓ projetos_status atualizado.');
