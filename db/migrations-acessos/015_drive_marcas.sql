-- Fase 2 (Drive): marcas-raiz do OneDrive que a aba Drive "explode" (ex.: 21. RBV & Company,
-- Moto Easy Brasil). external_id = item id da pasta-raiz no drive do dono.
create table if not exists public.acessos_drive_marcas(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  external_id text not null unique,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.acessos_drive_marcas enable row level security;
drop policy if exists acessos_drive_marcas_rw on public.acessos_drive_marcas;
create policy acessos_drive_marcas_rw on public.acessos_drive_marcas for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
