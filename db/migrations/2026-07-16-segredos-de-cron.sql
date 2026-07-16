-- Segredos das funções chamadas por pg_cron.
--
-- Por que existe: o toggle verify_jwt do gateway NÃO protege função de cron — a
-- chave anon é um JWT válido do projeto e está publicada no bundle do site (o
-- repositório é público). Não era teoria: o cron do coletar-dados mandava
-- exatamente a anon key, e o do auditar-dados não mandava autorização nenhuma
-- (com verify_jwt=false) — era um endpoint aberto na internet.
--
-- Por que numa tabela e não no texto do cron: assim o segredo não aparece em
-- cron.job.command. O pg_cron monta o cabeçalho lendo daqui na hora de disparar.
--
-- Quem lê: só service_role. RLS ligada com ZERO policies = ninguém mais entra
-- (nem authenticated, nem anon). As Edge Functions leem com o service role delas.
create table if not exists public.segredos_de_cron (
  nome        text primary key,
  segredo     text not null,
  criado_em   timestamptz not null default now(),
  observacao  text
);

alter table public.segredos_de_cron enable row level security;

revoke all on public.segredos_de_cron from anon, authenticated;

-- Os valores são gerados aqui, nunca commitados.
insert into public.segredos_de_cron (nome, segredo, observacao) values
  ('auditar-dados', encode(gen_random_bytes(32), 'hex'),
   'Antes: verify_jwt=false e ZERO auth no codigo = endpoint aberto na internet.'),
  ('coletar-dados', encode(gen_random_bytes(32), 'hex'),
   'Antes: verify_jwt=true, mas o cron mandava a anon key (publica).')
on conflict (nome) do nothing;

-- Os jobs 1-4 (coletar-dados) e 6 (auditar-dados) foram alterados via
-- cron.alter_job para montar o header lendo desta tabela. Ver o ledger da Onda 1.
