-- vínculos de acesso manual (iCloud): pessoa ↔ pasta (acessos_recursos tipo=icloud)
-- estado 'pendente' até o admin compartilhar manualmente na Apple e marcar 'feito'.
create table if not exists public.acessos_vinculos(
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.acessos_recursos(id) on delete cascade,
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  papel text not null default 'leitura' check (papel in ('leitura','edicao')),
  estado text not null default 'pendente' check (estado in ('pendente','feito')),
  observacao text,
  criado_em timestamptz not null default now(),
  feito_em timestamptz
);
alter table public.acessos_vinculos enable row level security;
drop policy if exists acessos_vinculos_rw on public.acessos_vinculos;
create policy acessos_vinculos_rw on public.acessos_vinculos for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
create index if not exists idx_acessos_vinculos_recurso on public.acessos_vinculos(recurso_id);
create index if not exists idx_acessos_vinculos_pessoa on public.acessos_vinculos(pessoa_id);
