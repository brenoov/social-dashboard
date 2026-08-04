-- Cadastros do módulo Patrimônio. Empresa, Local e Cômodo são listas
-- INDEPENDENTES de propósito: no dado real do dono um mesmo Local abriga bens de
-- várias Empresas (Fábrica Conchal tem Vessel, RB Builders e RBV) e um mesmo
-- Cômodo se repete em vários Locais ("Sala de Reunião" em 5). Quem amarra os três
-- é o BEM, não os cadastros.

-- helper: o usuário atual é admin ou tem a feature 'patrimonio'?
-- Espelha is_acessos_admin() (db/migrations/acessos/002_rls.sql).
create or replace function public.is_patrimonio_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or 'patrimonio' = any(coalesce(p.features, array[]::text[])))
  );
$$;

revoke execute on function public.is_patrimonio_admin() from public;
revoke execute on function public.is_patrimonio_admin() from anon;
grant  execute on function public.is_patrimonio_admin() to authenticated;

create table if not exists public.patrimonio_empresas(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

create table if not exists public.patrimonio_locais(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

create table if not exists public.patrimonio_comodos(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

-- vida_util_anos alimenta a depreciação (Fase 4). Nasce nulo: sem chute.
create table if not exists public.patrimonio_categorias(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  vida_util_anos int,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

-- Tipo é o nível 2 da classificação (Notebook, Desktop, Mesa), filho da categoria.
create table if not exists public.patrimonio_tipos(
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.patrimonio_categorias(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (categoria_id, nome)
);
create index if not exists idx_patrimonio_tipos_categoria on public.patrimonio_tipos(categoria_id);

do $$
declare t text;
begin
  foreach t in array array[
    'patrimonio_empresas','patrimonio_locais','patrimonio_comodos',
    'patrimonio_categorias','patrimonio_tipos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());',
      t, t);
  end loop;
end $$;

-- Seeds vindos do dado REAL da planilha do dono (aba Base). São só o ponto de
-- partida: as cinco listas são editáveis na tela.
insert into public.patrimonio_empresas(nome, ordem) values
  ('Vessel',1),('Moto Easy',2),('RBV Company',3),('RB Builders',4),('Mantova',5)
on conflict (nome) do nothing;

insert into public.patrimonio_locais(nome, ordem) values
  ('Fábrica Conchal',1),('Piracicaba',2),('Sede Limeira',3),('Loja Tivoli',4),
  ('Loja Dom Pedro',5),('Loja Hortolândia',6),('Escritório Centro Limeira',7),
  ('Showroom Limeira',8),('Escritório Desenvolvimento - Itatiba',9)
on conflict (nome) do nothing;

insert into public.patrimonio_comodos(nome, ordem) values
  ('Operação Loja',1),('Produção',2),('Administrativo',3),('Estoque',4),
  ('Sala de Reunião',5),('Diretoria',6),('Cozinha',7),('Sala de Espera',8),
  ('Qualidade',9),('Gerência',10),('Comercial',11),('Financeiro',12),
  ('RH',13),('Marketing',14)
on conflict (nome) do nothing;

-- vida_util_anos: valores usuais da Receita; o dono edita na tela.
insert into public.patrimonio_categorias(nome, vida_util_anos, ordem) values
  ('Computadores e Periféricos',5,1),
  ('Móveis e Utensílios',10,2),
  ('Máquinas e Equipamentos',10,3),
  ('Celulares e tablets',5,4),
  ('Televisões',10,5),
  ('Veículos',5,6),
  ('Linhas telefônicas',null,7)
on conflict (nome) do nothing;
