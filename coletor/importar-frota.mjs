#!/usr/bin/env node
/* Importa os veículos da planilha Controle_Frota_.xlsx para frota_veiculos.
 *
 * Uso:  node importar-frota.mjs <caminho-da-planilha.xlsx> [--gravar]
 *
 * Sem --gravar ele só MOSTRA o que faria. Foi assim na importação do
 * Patrimônio e valeu a pena: dá pra conferir os 9 registros antes de encostar
 * no banco.
 *
 * O Ford Fiesta Hatch fica de fora por decisão do dono — está alienado e não é
 * mais da frota. Ele aparece na conferência como "pulado", nunca em silêncio:
 * item que some sem explicação é o que faz alguém achar que a importação
 * comeu dado.
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
if (!arquivo || !existsSync(arquivo)) {
  console.error('Informe o caminho da planilha. Ex.: node importar-frota.mjs ~/frota.xlsx');
  process.exit(1);
}

// Fora da frota por decisão do dono (alienado).
const FORA = ['DHL7J76'];

const SITUACAO = { 'Ativo': 'ativo', 'Em manutenção': 'em_manutencao', 'Alienado': 'alienado' };

const limpo = (v) => (v === undefined || v === null ? null : String(v).trim() || null);
const placa = (v) => (limpo(v) || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
const centavos = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const inteiro = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isInteger(n) ? n : null; };

const wb = XLSX.readFile(arquivo);
const aba = wb.Sheets['Carros'];
if (!aba) { console.error('A planilha não tem a aba "Carros".'); process.exit(1); }
// A aba tem duas linhas de totais antes do cabeçalho.
const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, defval: '' });
const iCab = linhas.findIndex((l) => l.some((c) => String(c).trim() === 'CTR Vinculado'));
if (iCab < 0) { console.error('Não achei o cabeçalho na aba "Carros".'); process.exit(1); }
const cab = linhas[iCab].map((c) => String(c).trim());
const col = (nome) => cab.indexOf(nome);

const entrar = [];
const pulados = [];
for (const l of linhas.slice(iCab + 1)) {
  const p = placa(l[col('Placa')]);
  const nome = limpo(l[col('Carro')]);
  if (!p || !nome) continue;
  if (FORA.includes(p)) { pulados.push(`${nome} (${p}) — fora da frota por decisão do dono`); continue; }
  const obs = limpo(l[col('Obs')]);
  entrar.push({
    placa: p,
    nome,
    marca: limpo(l[col('Marca')]),
    ano: inteiro(l[col('Ano')]),
    cor: limpo(l[col('Cor')]),
    combustivel: limpo(l[col('Gasolina/Flex')]),
    renavam: limpo(l[col('Renavam')]),
    chassi: limpo(l[col('Chassi')]),
    tipo_oleo: limpo(l[col('Tipo de óleo')]),
    contrato: limpo(l[col('CTR Vinculado')]),
    codigo_patrimonial: limpo(l[col('Código Patrimonial')]),
    aluguel_centavos: centavos(l[col('Valor de Aluguel')]),
    fipe_centavos: centavos(l[col('FIPE 03-2026')]),
    categoria_comercial: limpo(l[col('Categoria Comercial')]),
    blindado: /blindad/i.test(obs || ''),
    situacao: SITUACAO[limpo(l[col('Status')])] || 'ativo',
    observacao: obs,
  });
}

const reais = (c) => (c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
console.log(`\n${entrar.length} veículos para importar:\n`);
for (const v of entrar) {
  console.log(`  ${v.placa}  ${(v.nome || '').padEnd(24)} ${String(v.ano || '').padEnd(5)} `
    + `${v.situacao.padEnd(14)} aluguel ${reais(v.aluguel_centavos).padStart(12)}  FIPE ${reais(v.fipe_centavos).padStart(14)}`
    + `${v.blindado ? '  [blindado]' : ''}`);
}
if (pulados.length) {
  console.log('\nPulados de propósito:');
  for (const p of pulados) console.log('  · ' + p);
}
const somaAluguel = entrar.reduce((s, v) => s + (v.aluguel_centavos || 0), 0);
const somaFipe = entrar.reduce((s, v) => s + (v.fipe_centavos || 0), 0);
console.log(`\n  Aluguel somado: ${reais(somaAluguel)}/mês`);
console.log(`  FIPE somado:    ${reais(somaFipe)}`);

if (!gravar) {
  console.log('\n(nada foi gravado — rode de novo com --gravar)\n');
  process.exit(0);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: readFileSync(process.env.PGSSLROOTCERT || join(__dirname, 'supabase-ca.crt'), 'utf8') },
});
await client.connect();
// Tudo ou nada: importação pela metade é pior que importação nenhuma, porque
// ninguém sabe onde parou. (Foi o que salvou a importação do Patrimônio.)
await client.query('begin');
try {
  let novos = 0, atualizados = 0;
  for (const v of entrar) {
    const campos = Object.keys(v);
    const r = await client.query(
      `insert into frota_veiculos (${campos.join(',')})
       values (${campos.map((_, i) => '$' + (i + 1)).join(',')})
       on conflict (placa) do update set
         ${campos.filter((c) => c !== 'placa').map((c) => `${c}=excluded.${c}`).join(', ')},
         atualizado_em = now()
       returning (xmax = 0) as inserido`,
      campos.map((c) => v[c]));
    if (r.rows[0].inserido) novos++; else atualizados++;
  }
  await client.query('commit');
  console.log(`\n✓ ${novos} cadastrados, ${atualizados} atualizados.\n`);
} catch (e) {
  await client.query('rollback');
  console.error('\n✗ nada foi gravado (desfeito):', e.message, '\n');
  process.exitCode = 1;
}
await client.end();
