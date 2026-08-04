/* Concede a permissão `frota` a quem precisa. Sem --gravar, só mostra.
 *
 * A permissão vive em DOIS lugares nesta base e os dois precisam andar juntos:
 * `permissions` (jsonb, lido pelo front) e `features` (text[], lido pelo RLS
 * via is_frota_admin()). Conceder só num deixa a tela abrir e o banco negar.
 *
 * Superadmin não entra na lista: hasPermission() e is_frota_admin() já
 * devolvem verdadeiro pra ele.
 */
import { readFileSync } from 'node:fs'; import pg from 'pg';
for (const raw of readFileSync('.env','utf8').split('\n')) { const l=raw.trim(); if(!l||l.startsWith('#'))continue; const i=l.indexOf('='); if(i<0)continue; const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim(); if((v[0]==='"'&&v.endsWith('"'))||(v[0]==="'"&&v.endsWith("'")))v=v.slice(1,-1); if(!(k in process.env))process.env[k]=v; }

// Quem administra a frota: cadastra veículo, corrige registro. O Cristian é o
// aprovador ao lado do Erick, e já é quem administra o Patrimônio hoje.
const ADMIN = ['cristian.leonel@rbvcompany.com'];
// Quem DIRIGE: precisa registrar retirada e devolução, e mais nada. Lista
// tirada de quem aparece dirigindo na planilha E tem conta no app.
const MOTORISTA = [
  'raissaherculano@rbvcompany.com',
  'humberto@rbvcompany.com',
  'larissa.sousa@rbvcompany.com',
  'jeremias.vieira@rbvcompany.com',
  'guilherme.cardoso@rbvcompany.com',
  'gabriel.alves@rbvcompany.com',
];
const ACOES = { admin: ['ver','criar','editar','excluir'], motorista: ['ver','editar'] };

const gravar = process.argv.includes('--gravar');
const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{ca:readFileSync(process.env.PGSSLROOTCERT||'supabase-ca.crt','utf8')}});
await c.connect();

const alvos = [...ADMIN.map(e=>({email:e,papel:'admin'})), ...MOTORISTA.map(e=>({email:e,papel:'motorista'}))];
console.log('\nA conceder:\n');
const faltando = [];
for (const a of alvos) {
  const r = await c.query('select email, is_superadmin, permissions->\'frota\' as atual from profiles where lower(email)=lower($1)', [a.email]);
  if (!r.rows.length) { faltando.push(a.email); continue; }
  const p = r.rows[0];
  console.log(`  ${a.email.padEnd(34)} ${a.papel.padEnd(10)} → ${ACOES[a.papel].join(', ')}`
    + (p.atual ? `   (já tinha: ${JSON.stringify(p.atual)})` : '')
    + (p.is_superadmin ? '   [superadmin — já entra de qualquer jeito]' : ''));
}
if (faltando.length) { console.log('\n  SEM CONTA no app (não dá pra conceder):'); for(const e of faltando) console.log('   · '+e); }

if (!gravar) { console.log('\n(nada foi gravado — rode de novo com --gravar)\n'); await c.end(); process.exit(0); }

await c.query('begin');
try {
  let n = 0;
  for (const a of alvos) {
    const r = await c.query(
      `update profiles set
         permissions = coalesce(permissions,'{}'::jsonb) || jsonb_build_object('frota', $2::jsonb),
         features = case when 'frota' = any(coalesce(features,'{}')) then features
                         else array_append(coalesce(features,'{}'), 'frota') end
       where lower(email)=lower($1) returning email`,
      [a.email, JSON.stringify(ACOES[a.papel])]);
    n += r.rowCount;
  }
  await c.query('commit');
  console.log(`\n✓ ${n} contas liberadas.\n`);
} catch (e) { await c.query('rollback'); console.error('\n✗ nada foi gravado:', e.message, '\n'); process.exitCode = 1; }
await c.end();
