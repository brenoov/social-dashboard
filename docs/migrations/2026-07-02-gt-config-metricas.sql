-- docs/migrations/2026-07-02-gt-config-metricas.sql
-- Tabela de config global do módulo "Gestão de Tráfego": mapeia balde (objetivo)
-- -> lista de métricas a exibir nos cards de KPI. Leitura pública (dado não sensível,
-- usado pra renderizar a tela); escrita restrita a admin.
--
-- Padrão de admin-write seguido (igual docs/migrations/006_accounts_update_policy.sql
-- e a policy existente em platform_settings): RLS por role, checando
-- public.profiles.role = 'admin' para auth.uid(). O client escreve via sbClient
-- (supabase-js autenticado com o JWT do usuário logado), nunca com a service role
-- exposta no front. Não há RPC security-definer com guarda de username sendo usado
-- pra config no projeto — esse é o mecanismo de outra feature (ex.: RPCs anon dos
-- Acólitos), não o daqui.

create table if not exists public.gt_config_metricas (
  balde text primary key,
  metricas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gt_config_metricas enable row level security;

-- leitura liberada (dados não sensíveis, usados pra montar a tela)
create policy gt_cfg_read on public.gt_config_metricas
  for select
  using (true);

-- escrita (insert/update) só para admin, mesmo padrão de accounts/platform_settings
create policy gt_cfg_admin_insert on public.gt_config_metricas
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy gt_cfg_admin_update on public.gt_config_metricas
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
