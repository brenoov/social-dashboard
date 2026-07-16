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
// A chave só é exigida quando o robô roda de verdade (ver a guarda no fim do
// arquivo). Exigi-la no topo impedia importar o módulo pra testar a lógica pura.
const ROBO_RODANDO_DIRETO = import.meta.url === `file://${process.argv[1]}`;
if (ROBO_RODANDO_DIRETO && !SERVICE_KEY) { console.error('✗ falta SUPABASE_SERVICE_KEY'); process.exit(1); }

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

// Só o CABEÇALHO do plano (antes da primeira seção) pode declarar status por texto.
// O corpo, não: ele é cheio de "validar NO AR", de exemplo de código com
// console.log('concluído') e de prosa sobre outros projetos.
function cabecalhoDe(txt) {
  const linhas = txt.split('\n');
  const fim = linhas.findIndex((l, i) => i > 0 && /^##\s/.test(l)); // primeira seção
  return linhas.slice(0, fim > 0 ? fim : 12).join('\n');
}

// Deriva progresso (checkboxes) e situação do conteúdo do plano.
//
// A REGRA: os checkboxes mandam. Eles contam passos de verdade — o texto não conta
// nada.
//
// Antes era o contrário: qualquer "NO AR" ou "CONCLUÍD" em QUALQUER lugar do
// documento marcava o plano como pronto, e a contagem de passos só era consultada
// depois. Medido nos 42 planos reais: **17 deles** (40%) apareciam no quadro como
// "Pronto e no ar" com ZERO passos feitos. O card dizia "no ar" e "0% pronto" ao
// mesmo tempo.
//
// Como enganava:
//   - "validar NO AR", "vs v1 (já NO AR)" no corpo → plano virava concluído
//   - `console.log('gerar concluído:', r)` DENTRO de bloco de código → idem
//   - 'CONCLUÍD' casa dentro de "NÃO CONCLUÍDO"
//
// Agora o texto só é ouvido em dois casos: para marcar "parado" (que os checkboxes
// não sabem expressar) e quando o plano não tem checkbox nenhum (aí não há o que
// contar). Nos dois, só vale o que está no CABEÇALHO, onde alguém declarou de
// propósito — não uma menção solta no meio do documento.
function analisarConteudo(txt) {
  const feitos = (txt.match(/- \[x\]/gi) || []).length;
  const abertos = (txt.match(/- \[ \]/g) || []).length;
  const total = feitos + abertos;
  const progresso = total ? Math.round((feitos / total) * 100) : 0;

  const declarado = statusDeclarado(txt);

  let situacao;
  if (declarado) {
    // Alguém escreveu "**Status:** ..." no cabeçalho. Declaração explícita ganha:
    // é a única coisa aqui que é uma AFIRMAÇÃO, e não um chute.
    //
    // Ela precisa ganhar dos checkboxes por um motivo prático: na vida real
    // ninguém volta pra marcar as caixinhas depois de entregar. Medido nos 42
    // planos deste repo: sem a declaração, TODOS caem em "não começou" — inclusive
    // coisas que estão no ar há semanas.
    situacao = declarado;
  } else if (total > 0) {
    // Sem declaração, os passos decidem. Eles não sabem tudo, mas não mentem.
    if (feitos === total) situacao = 'no-ar';
    else if (feitos > 0) situacao = 'em-andamento';
    else situacao = 'planejado';
  } else {
    // Sem declaração e sem passo: não há evidência de nada. "Não começou" é o
    // default honesto — melhor admitir que não sei do que afirmar que está pronto.
    situacao = 'planejado';
  }
  return { feitos, total, progresso, situacao };
}

// Lê "**Status:** ..." (ou "Status: ...") no CABEÇALHO do plano. É como quem
// escreve o plano declara em que pé ele está — e é a única fonte confiável, porque
// é a única deliberada.
//
// Fora do cabeçalho não vale: o corpo tem "validar NO AR", exemplo de código com
// console.log('concluído') e prosa sobre outros projetos. Era o que fazia 17 dos
// 42 planos aparecerem como "Pronto e no ar" com ZERO passos feitos.
//
// Convenção pra quem escreve plano (linha solta logo abaixo do título):
//   **Status:** no ar          → Pronto e no ar
//   **Status:** em andamento   → Sendo construído
//   **Status:** parado         → Parado (e o motivo, por favor)
//   (sem a linha)              → os checkboxes decidem
function statusDeclarado(txt) {
  const m = cabecalhoDe(txt).match(/^\s*\**\s*status\s*:?\**\s*:?\s*(.+)$/im);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (/\bPAUSAD|BLOQUEAD|TRAVAD|EM ESPERA|PARAD/.test(v)) return 'pausado';
  if (/\bNO AR\b|CONCLUÍD|CONCLUID|PRONT|ENTREGUE|MERGEAD/.test(v)) return 'no-ar';
  if (/EM ANDAMENTO|CONSTRU|FAZENDO|EM CURSO|IMPLEMENTANDO/.test(v)) return 'em-andamento';
  if (/PLANEJAD|NÃO COMEÇOU|NAO COMECOU|BACKLOG|A FAZER/.test(v)) return 'planejado';
  return null; // declarou algo que não reconheço — melhor cair nos checkboxes
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

// Exportado pra ser testável. A regra de qual coluna um plano cai é a parte que
// erra em silêncio (errava em 17 dos 42 planos), então ela precisa de teste.
export { analisarConteudo, statusDeclarado, cabecalhoDe };

// Só roda o robô quando o arquivo é executado direto (`node status-projetos.mjs`).
// Sem esta guarda, qualquer `import` deste módulo dispara a rodada inteira e exige
// SUPABASE_SERVICE_KEY — foi o que impediu de testar até agora. Mesmo padrão dos
// outros robôs do coletor/.
if (ROBO_RODANDO_DIRETO) {
  let registros = main();
  const manuais = await slugsManuais();
  const pulados = registros.filter((p) => manuais.has(p.projeto)).length;
  registros = registros.filter((p) => !manuais.has(p.projeto)); // respeita edições manuais
  console.log(`Projetos derivados: ${registros.length} (pulei ${pulados} editados à mão)`);
  for (const p of registros) console.log(`  · ${p.projeto} [${p.etapa || '—'}] ${p.situacao} ${p.progresso}%`);
  if (registros.length) await upsert(registros);
  console.log('✓ projetos_status atualizado.');
}
