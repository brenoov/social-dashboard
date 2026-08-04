#!/usr/bin/env node
/* Lança os veículos da Frota como bens do Patrimônio, e liga os dois.
 *
 * Uso:  node frota-para-patrimonio.mjs [--gravar]
 *
 * MUDANÇA DE DECISÃO DO DONO. O desenho dizia que carro de frota NÃO virava
 * bem, porque os 9 são alugados (contrato CTR-001..010 + mensalidade) e lançar
 * como bem inflaria o patrimônio com coisa que a empresa não possui. O dono
 * decidiu o contrário: "os carros são patrimônio". Faz sentido dentro do grupo
 * — o código RBB-XXX e o contrato mestre moram na pasta da RB Builders, então
 * quem aluga é uma empresa do próprio grupo.
 *
 * Três cuidados:
 *
 * 1. O Fiat Punto JÁ EXISTE no Patrimônio. Ele é LIGADO, não duplicado —
 *    duplicar contaria o mesmo carro duas vezes no total.
 * 2. O valor lançado é o FIPE de 03/2026, que é o que a planilha tem. É valor
 *    de mercado, não de aquisição; quem quiser trocar depois, troca na ficha.
 * 3. Entram como NÃO ETIQUETADOS, com o número de etiqueta vazio. Nem todos os
 *    carros têm a etiqueta colada ainda (observação do dono), e o Patrimônio já
 *    sabe lidar com isso: eles aparecem na lista de quem falta etiquetar, e o
 *    número sai da faixa disponível quando alguém for colar. O código RBB-XXX,
 *    que é a numeração de quem aluga, vai no campo próprio.
 */
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
const gravar = process.argv.includes('--gravar');

// Inferida de dois sinais independentes: o código patrimonial RBB-XXX e a
// pasta onde mora o "Contrato Mestre de Locação de Frota". Se estiver errado,
// é um clique na ficha de cada carro pra trocar.
const EMPRESA = 'RB Builders';

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: readFileSync(process.env.PGSSLROOTCERT || join(__dirname, 'supabase-ca.crt'), 'utf8') },
});
await c.connect();

const um = async (q, p) => (await c.query(q, p)).rows[0] || null;
const empresa = await um('select id,nome from patrimonio_empresas where nome=$1', [EMPRESA]);
const categoria = await um("select id,nome from patrimonio_categorias where nome ilike '%ve%cul%'");
if (!empresa || !categoria) { console.error('Não achei a empresa ou a categoria Veículos.'); process.exit(1); }

const { rows: veiculos } = await c.query(`
  select v.*, p.nome as responsavel
    from frota_veiculos v left join acessos_pessoas p on p.id = v.pessoa_id
   where v.situacao <> 'alienado' order by v.fipe_centavos desc nulls last`);

// Coluna bigint volta do banco como TEXTO. Somar sem converter concatena:
// "51934500" + "19875600" vira "5193450019875600". Passou perto de virar um
// patrimônio de quinhentos sextilhões — só não virou porque a conferência
// roda antes de gravar.
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const reais = (n) => (n == null ? '—' : (num(n) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const plano = [];
for (const v of veiculos) {
  if (v.bem_id) { plano.push({ v, acao: 'já ligado', bem: null }); continue; }
  // Procura um bem que seja claramente este carro, pra LIGAR em vez de criar.
  // Casa por marca+modelo no nome; é o que existe pra casar, já que o bem não
  // guarda placa.
  const modelo = (v.nome || '').replace(/\s+/g, ' ').trim();
  const chaves = modelo.split(' ').filter((p) => p.length > 2).slice(0, 2);
  const achado = chaves.length
    ? await um(`select id, nome, valor_centavos from patrimonio_bens
                 where categoria_id = $1 and ${chaves.map((_, i) => `nome ilike '%'||$${i + 2}||'%'`).join(' and ')}
                 limit 1`, [categoria.id, ...chaves])
    : null;
  plano.push({ v, acao: achado ? 'ligar ao existente' : 'criar', bem: achado });
}

console.log(`\nEmpresa: ${empresa.nome}   ·   Categoria: ${categoria.nome}\n`);
for (const p of plano) {
  console.log(`  ${p.acao.padEnd(20)} ${p.v.nome.padEnd(24)} ${reais(p.v.fipe_centavos).padStart(14)}`
    + `  ${p.v.responsavel ? 'com ' + p.v.responsavel : (p.v.local_texto ? 'em ' + p.v.local_texto : '—')}`
    + (p.bem ? `   → bem "${p.bem.nome}" (${reais(p.bem.valor_centavos)})` : ''));
}
const criar = plano.filter((p) => p.acao === 'criar');
const somaNova = criar.reduce((s, p) => s + num(p.v.fipe_centavos), 0);
const atual = await um('select coalesce(sum(valor_centavos),0) t, count(*) n from patrimonio_bens');
console.log(`\n  Patrimônio hoje:  ${atual.n} bens · ${reais(atual.t)}`);
console.log(`  Entram:           ${criar.length} bens · ${reais(somaNova)}`);
console.log(`  Fica:             ${Number(atual.n) + criar.length} bens · ${reais(num(atual.t) + somaNova)}`);

if (!gravar) { console.log('\n(nada gravado — rode de novo com --gravar)\n'); await c.end(); process.exit(0); }

await c.query('begin');
try {
  let criados = 0, ligados = 0;
  for (const p of plano) {
    if (p.acao === 'já ligado') continue;
    let bemId = p.bem && p.bem.id;
    if (!bemId) {
      // O tipo segue a marca, como o único veículo que já estava lá ("Fiat").
      let tipo = await um('select id from patrimonio_tipos where categoria_id=$1 and nome ilike $2',
        [categoria.id, p.v.marca || '']);
      if (!tipo && p.v.marca) {
        tipo = await um('insert into patrimonio_tipos(nome, categoria_id) values($1,$2) returning id',
          [p.v.marca, categoria.id]);
      }
      const novo = await um(`insert into patrimonio_bens
          (nome, valor_centavos, empresa_id, categoria_id, tipo_id, marca, pessoa_id, situacao, observacao, etiquetado)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9, false) returning id`, [
        `${p.v.nome} ${p.v.ano || ''}`.trim(),
        p.v.fipe_centavos, empresa.id, categoria.id, tipo ? tipo.id : null,
        p.v.marca, p.v.pessoa_id,
        p.v.pessoa_id ? 'em_uso' : 'em_estoque',
        `Veículo da frota · placa ${p.v.placa}${p.v.codigo_patrimonial ? ' · ' + p.v.codigo_patrimonial : ''}`
        + `${p.v.contrato ? ' · contrato ' + p.v.contrato : ''}`,
      ]);
      bemId = novo.id;
      criados++;
    } else ligados++;
    await c.query('update frota_veiculos set bem_id=$2, atualizado_em=now() where id=$1', [p.v.id, bemId]);
  }
  await c.query('commit');
  const fim = await um('select count(*) n, coalesce(sum(valor_centavos),0) t from patrimonio_bens');
  console.log(`\n✓ ${criados} bens criados, ${ligados} ligados a bem que já existia.`);
  console.log(`  Patrimônio agora: ${fim.n} bens · ${reais(fim.t)}\n`);
} catch (e) {
  await c.query('rollback');
  console.error('\n✗ nada foi gravado (desfeito):', e.message, '\n');
  process.exitCode = 1;
}
await c.end();
