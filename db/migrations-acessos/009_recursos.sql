-- pastas/recursos sob controle (OneDrive agora; iCloud depois). Só as que o admin adicionar.
create table if not exists public.acessos_recursos(
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'onedrive' check (tipo in ('onedrive','icloud')),
  provedor text default 'microsoft',
  nome text not null,
  external_id text,   -- id do item (pasta) no OneDrive
  drive_id text,      -- id do drive (OneDrive pessoal: normalmente /me/drive)
  caminho text,       -- caminho amigável p/ exibir
  criado_em timestamptz not null default now()
);
alter table public.acessos_recursos enable row level security;
drop policy if exists acessos_recursos_rw on public.acessos_recursos;
create policy acessos_recursos_rw on public.acessos_recursos for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
create index if not exists idx_acessos_recursos_tipo on public.acessos_recursos(tipo);
