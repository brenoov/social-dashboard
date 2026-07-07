-- 2026-07-07 — Metas por vendedora (o admin já consultava/gravava bling_vendedor_metas,
-- mas a tabela nunca tinha sido criada → dava 404 e a seção Metas quebrava).
-- Espelha bling_metas (metas por loja): mesma forma + mesmas políticas RLS.
-- Aplicada no projeto Supabase kounqtdoioootxqegkij.
create table if not exists public.bling_vendedor_metas (
  id serial primary key,
  vendor_id bigint not null,
  year integer not null,
  month integer not null,
  meta_valor numeric,
  daily_goals jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vendor_id, year, month)
);

alter table public.bling_vendedor_metas enable row level security;

create policy admin_write_vend_metas on public.bling_vendedor_metas
  for all to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy authenticated_read_vend_metas on public.bling_vendedor_metas
  for select
  using (auth.role() = 'authenticated');

create policy service_role_full_vend_metas on public.bling_vendedor_metas
  for all
  using (auth.role() = 'service_role');
