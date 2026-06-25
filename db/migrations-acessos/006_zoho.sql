-- conexões OAuth dos provedores (SÓ service_role lê — RLS habilitado SEM policies)
create table if not exists public.acessos_conexoes(
  provedor text primary key,
  client_id text,
  client_secret text,
  refresh_token text,
  org_id text,
  data_center text default '.com',
  escopos text,
  conectado_por uuid,
  conectado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.acessos_conexoes enable row level security;
-- intencionalmente SEM policies: nenhuma role anon/authenticated acessa; só service_role (bypassa RLS)

-- colaboradores: avatar + vínculo zoho
alter table public.acessos_pessoas add column if not exists avatar_url text;
alter table public.acessos_pessoas add column if not exists zoho_account_id text;
create index if not exists idx_acessos_pessoas_zoho on public.acessos_pessoas(zoho_account_id);

-- bucket público para avatares dos colaboradores
insert into storage.buckets (id, name, public) values ('acessos-avatars','acessos-avatars', true)
on conflict (id) do nothing;
