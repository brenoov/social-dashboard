-- organização direta no colaborador (antes vinha só via setor)
alter table public.acessos_pessoas add column if not exists organizacao_id uuid references public.acessos_organizacoes(id) on delete set null;
create index if not exists idx_acessos_pessoas_org on public.acessos_pessoas(organizacao_id);
-- backfill: deriva a org dos colaboradores a partir do setor atual
update public.acessos_pessoas p
  set organizacao_id = s.organizacao_id
  from public.acessos_setores s
  where p.setor_id = s.id and p.organizacao_id is null and s.organizacao_id is not null;
