-- organizações (camada acima de setores)
create table if not exists public.acessos_organizacoes(
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.acessos_organizacoes enable row level security;
drop policy if exists acessos_organizacoes_rw on public.acessos_organizacoes;
create policy acessos_organizacoes_rw on public.acessos_organizacoes for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
insert into public.acessos_organizacoes(nome,ordem) values
  ('Sede Village',1),('Sede Centro',2),('Fábrica Conchal',3)
on conflict (nome) do nothing;

-- setores passam a pertencer a uma organização
alter table public.acessos_setores add column if not exists organizacao_id uuid references public.acessos_organizacoes(id) on delete set null;
create index if not exists idx_acessos_setores_org on public.acessos_setores(organizacao_id);
-- setores já existentes (sem org) vão para a primeira organização, p/ não ficarem órfãos
update public.acessos_setores set organizacao_id=(select id from public.acessos_organizacoes order by ordem limit 1) where organizacao_id is null;
