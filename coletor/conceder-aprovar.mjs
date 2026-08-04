/* Concede `frota.aprovar`. Sem --gravar, só mostra.
 * Os dois lados juntos: permissions (front) e features (banco, via
 * pode_aprovar_frota()). */
import { readFileSync } from 'node:fs'; import pg from 'pg';
for (const raw of readFileSync('.env','utf8').split('\n')) { const l=raw.trim(); if(!l||l.startsWith('#'))continue; const i=l.indexOf('='); if(i<0)continue; const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim(); if((v[0]==='"'&&v.endsWith('"'))||(v[0]==="'"&&v.endsWith("'")))v=v.slice(1,-1); if(!(k in process.env))process.env[k]=v; }
const APROVADORES = ['cristian.leonel@rbvcompany.com', 'erick@rbvcompany.com'];
const gravar = process.argv.includes('--gravar');
const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{ca:readFileSync(process.env.PGSSLROOTCERT||'supabase-ca.crt','utf8')}});
await c.connect();
for (const e of APROVADORES) {
  const r = await c.query('select email, is_superadmin from profiles where lower(email)=lower($1)', [e]);
  console.log('  ' + e.padEnd(34) + (r.rows.length ? (r.rows[0].is_superadmin ? '(superadmin — já aprovava; marco mesmo assim, pra ficar explícito)' : 'ok') : 'SEM CONTA'));
}
if (!gravar) { console.log('\n(nada gravado — rode com --gravar)\n'); await c.end(); process.exit(0); }
await c.query('begin');
try {
  for (const e of APROVADORES) {
    await c.query(`update profiles set
      permissions = coalesce(permissions,'{}'::jsonb) || jsonb_build_object('frota.aprovar', '["ver"]'::jsonb),
      features = case when 'frota.aprovar' = any(coalesce(features,'{}')) then features
                      else array_append(coalesce(features,'{}'), 'frota.aprovar') end
      where lower(email)=lower($1)`, [e]);
  }
  await c.query('commit');
  const v = await c.query(`select email, permissions->'frota.aprovar' as front, 'frota.aprovar'=any(features) as banco
    from profiles where permissions ? 'frota.aprovar' order by email`);
  console.log('\n✓ quem aprova requisição de veículo:');
  for (const l of v.rows) console.log('  ' + l.email.padEnd(34) + ' front:' + JSON.stringify(l.front) + '  banco:' + (l.banco ? 'sim' : 'NÃO ⚠'));
} catch (err) { await c.query('rollback'); console.error('✗ nada gravado:', err.message); process.exitCode = 1; }
await c.end();
