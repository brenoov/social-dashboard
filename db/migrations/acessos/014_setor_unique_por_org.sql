-- bug: setor com nome UNIQUE global impedia "Marketing" em mais de uma organização.
-- correção: unicidade do nome passa a ser POR organização.
alter table public.acessos_setores drop constraint if exists acessos_setores_nome_key;
-- mesma org não pode ter dois setores com o mesmo nome; orgs diferentes podem repetir.
create unique index if not exists acessos_setores_org_nome_uk
  on public.acessos_setores (organizacao_id, nome);
