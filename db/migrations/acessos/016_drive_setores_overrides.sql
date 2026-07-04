-- Fase 2.1 (Drive): setores customizados + overrides de classificação (arrastar pasta -> setor).
create table if not exists public.acessos_drive_setores(
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  label text not null,
  ordem int not null default 100,
  criado_em timestamptz not null default now()
);
-- override manual: pasta (external_id) fixada num setor (built-in ou customizado)
create table if not exists public.acessos_drive_overrides(
  external_id text primary key,
  setor_chave text not null,
  nome text,
  atualizado_em timestamptz not null default now()
);
alter table public.acessos_drive_setores enable row level security;
alter table public.acessos_drive_overrides enable row level security;
drop policy if exists acessos_drive_setores_rw on public.acessos_drive_setores;
create policy acessos_drive_setores_rw on public.acessos_drive_setores for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
drop policy if exists acessos_drive_overrides_rw on public.acessos_drive_overrides;
create policy acessos_drive_overrides_rw on public.acessos_drive_overrides for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
