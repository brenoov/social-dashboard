#!/usr/bin/env node
/* Importa da aba "Resumo Manutenção": o histórico de troca de óleo e o
 * "onde está" de cada carro.
 *
 * Uso:  node importar-frota-manutencao.mjs <planilha.xlsx> [--gravar]
 *
 * Duas coisas que este importador NÃO faz de olhos fechados:
 *
 * 1. "Onde está" na planilha é uma coluna só, misturando pessoa (Raissa,
 *    Breno) e lugar (Conchal, Barracão). Aqui elas vão para campos separados —
 *    é a decisão D2 do desenho. Nome que não bate com nenhum colaborador
 *    cadastrado é tratado como LUGAR, e a conferência mostra qual foi qual pra
 *    o dono checar.
 *
 * 2. KM de troca MAIOR que o KM atual do carro é impossível: o odômetro não
 *    anda pra trás. A planilha tem um caso assim (Fiat Doblo: atual 136.172,
 *    troca de óleo em 272.257). Importar isso deixaria a revisão "em dia" por
 *    136 mil km. Esses ficam de fora, listados, para o dono corrigir.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const raw of readFileSync(join(__dirname, '.env'), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i === -1) continue;
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const arquivo = process.argv[2];
const gravar = process.argv.includes('--gravar');
if (!arquivo || !existsSync(arquivo)) { console.error('Informe o caminho da planilha.'); process.exit(1); }

const limpo = (v) => (v === undefined || v === null ? null : String(v).trim() || null);
const placaDe = (v) => (limpo(v) || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
const inteiro = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isInteger(n) ? n : null; };
// Excel guarda data como dias desde 1899-12-30 (o "30" já compensa o bug do
// ano 1900 que a planilha carrega desde sempre).
const dataDe = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
};

const wb = XLSX.readFile(arquivo);
const aba = wb.Sheets['Resumo Manutenção'];
if (!aba) { console.error('A planilha não tem a aba "Resumo Manutenção".'); process.exit(1); }
const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, defval: '' });
const cab = linhas[0].map((c) => String(c).trim());
const col = (n) => cab.indexOf(n);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: readFileSync(process.env.PGSSLROOTCERT || join(__dirname, 'supabase-ca.crt'), 'utf8') },
});
await client.connect();

const { rows: veiculos } = await client.query('select id, placa, nome from frota_veiculos');
const { rows: pessoas } = await client.query("select id, nome from acessos_pessoas where status <> 'desligado' or status is null");
const porPlaca = new Map(veiculos.map((v) => [v.placa, v]));
// A planilha chama as pessoas por PRIMEIRO NOME ou por SOBRENOME — "Erick",
// mas também "Siqueira" (que é Thiago Siqueira). Casar só pelo primeiro nome
// deixava o Siqueira de fora e ele virava "lugar".
function acharPessoa(texto) {
  const t = (texto || '').trim().toLowerCase();
  if (!t) return null;
  const casam = pessoas.filter((p) => {
    const partes = (p.nome || '').toLowerCase().split(/\s+/);
    return (p.nome || '').toLowerCase() === t || partes.includes(t);
  });
  return casam.length === 1 ? casam[0] : null;   // dois "Gabriel" → não chuta
}

// Os lugares que a planilha usa. Lista explícita de propósito: sem ela,
// qualquer nome de pessoa que não esteja cadastrada viraria "lugar" em
// silêncio — e foi o que aconteceu com a Raissa, que tem login mas não tem
// cadastro de colaboradora.
const LUGARES = ['conchal', 'barracão', 'barracao', 'escritório', 'escritorio', 'loja', 'oficina'];
const ehLugar = (t) => LUGARES.includes(String(t || '').trim().toLowerCase());

const ondeEsta = [];
const revisoes = [];
const recusadas = [];

for (const l of linhas.slice(1)) {
  const placa = placaDe(l[col('Placa')]);
  const v = placa && porPlaca.get(placa);
  if (!v) continue;

  const onde = limpo(l[col('Onde está')]);
  if (onde) {
    const p = acharPessoa(onde);
    ondeEsta.push({
      veiculo: v, texto: onde, pessoa: p,
      local: p ? null : (ehLugar(onde) ? onde : null),
      // Nem pessoa cadastrada, nem lugar conhecido: não inventa. Vai pra
      // conferência do dono, e o campo fica vazio até ele resolver.
      duvida: !p && !ehLugar(onde),
    });
  }

  const kmAtual = inteiro(l[col('KM Atual')]);
  const kmOleo = inteiro(l[col('KM Última Troca Óleo')]);
  if (kmOleo) {
    if (kmAtual && kmOleo > kmAtual) {
      recusadas.push(`${v.nome} (${placa}): troca de óleo em ${kmOleo.toLocaleString('pt-BR')} km, `
        + `mas o carro está com ${kmAtual.toLocaleString('pt-BR')} km. O odômetro não anda pra trás.`);
    } else {
      revisoes.push({
        veiculo: v, item: 'Troca de óleo', km: kmOleo,
        feita_em: dataDe(l[col('Data Última Troca Óleo')]),
        oficina: limpo(l[col('Última Oficina')]),
      });
    }
  }
}

console.log('\nONDE ESTÁ CADA CARRO (pessoa e lugar em campos separados):\n');
for (const o of ondeEsta) {
  const onde = o.pessoa ? 'pessoa: ' + o.pessoa.nome
    : o.local ? 'lugar:  ' + o.local
      : `⚠ "${o.texto}" — não é lugar conhecido nem colaborador cadastrado; fica em branco`;
  console.log(`  ${o.veiculo.nome.padEnd(24)} ${onde}`);
}
const duvidas = ondeEsta.filter((o) => o.duvida);
if (duvidas.length) {
  console.log('\n  Para o dono resolver: ' + duvidas.map((d) => `"${d.texto}"`).join(', ')
    + ' — cadastrar como colaborador, ou me dizer que é um local.');
}
console.log('\nTROCAS DE ÓLEO A IMPORTAR:\n');
for (const r of revisoes) {
  console.log(`  ${r.veiculo.nome.padEnd(24)} ${String(r.km).padStart(7)} km  ${r.feita_em || 'sem data'}`);
}
if (recusadas.length) {
  console.log('\nRECUSADAS — número impossível, o dono precisa corrigir:\n');
  for (const r of recusadas) console.log('  ⚠ ' + r);
}

if (!gravar) { console.log('\n(nada gravado — rode de novo com --gravar)\n'); await client.end(); process.exit(0); }

await client.query('begin');
try {
  for (const o of ondeEsta) {
    await client.query('update frota_veiculos set pessoa_id=$2, local_texto=$3, atualizado_em=now() where id=$1',
      [o.veiculo.id, o.pessoa ? o.pessoa.id : null, o.local]);
  }
  let n = 0;
  for (const r of revisoes) {
    // Não duplica se já existe a mesma troca no mesmo km.
    const j = await client.query('select 1 from frota_revisoes where veiculo_id=$1 and item=$2 and km=$3',
      [r.veiculo.id, r.item, r.km]);
    if (j.rowCount) continue;
    await client.query('insert into frota_revisoes(veiculo_id,item,km,feita_em,oficina,observacao) values($1,$2,$3,$4,$5,$6)',
      [r.veiculo.id, r.item, r.km, r.feita_em, r.oficina, 'Importado da planilha Controle_Frota_.xlsx']);
    n++;
  }
  await client.query('commit');
  console.log(`\n✓ ${ondeEsta.length} veículos com "onde está" preenchido, ${n} trocas de óleo importadas.\n`);
} catch (e) {
  await client.query('rollback');
  console.error('\n✗ nada foi gravado (desfeito):', e.message, '\n');
  process.exitCode = 1;
}
await client.end();
