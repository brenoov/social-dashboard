-- O bem, o histórico de posse e o log do módulo Patrimônio.

create table if not exists public.patrimonio_bens(
  id uuid primary key default gen_random_uuid(),
  -- número da etiqueta física. Vem da planilha do dono (1..380, sem repetição).
  numero int unique,
  nome text not null,
  valor_centavos bigint,          -- nulo = não informado (≠ zero)
  data_compra date,               -- a planilha não tem: nasce nulo, sem chutar
  empresa_id   uuid references public.patrimonio_empresas(id)   on delete set null,
  local_id     uuid references public.patrimonio_locais(id)     on delete set null,
  comodo_id    uuid references public.patrimonio_comodos(id)    on delete set null,
  categoria_id uuid references public.patrimonio_categorias(id) on delete set null,
  tipo_id      uuid references public.patrimonio_tipos(id)      on delete set null,
  marca text,                     -- nível 3 da classificação (D_01 da planilha)
  -- Dono é OPCIONAL: 88% dos bens reais não estão com ninguém.
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  -- Nome solto de quem está com o bem quando não há colaborador cadastrado.
  -- A F2 usa isto pra não inventar colaborador. Some quando pessoa_id é preenchido.
  dono_texto text,
  etiquetado boolean not null default false,
  situacao text not null default 'em_estoque'
    check (situacao in ('em_uso','em_estoque','em_manutencao','baixado')),
  observacao text,
  detalhes jsonb not null default '{}'::jsonb,  -- campos por categoria (linha telefônica, veículo)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_patrimonio_bens_pessoa    on public.patrimonio_bens(pessoa_id);
create index if not exists idx_patrimonio_bens_empresa   on public.patrimonio_bens(empresa_id);
create index if not exists idx_patrimonio_bens_local     on public.patrimonio_bens(local_id);
create index if not exists idx_patrimonio_bens_categoria on public.patrimonio_bens(categoria_id);
create index if not exists idx_patrimonio_bens_situacao  on public.patrimonio_bens(situacao);

-- Histórico de posse: quem teve o bem, de quando até quando, por quê.
-- pessoa_nome é gravado JUNTO (não só a FK) pra o histórico sobreviver ao
-- colaborador ser apagado — histórico que perde o nome não serve de histórico.
create table if not exists public.patrimonio_posse(
  id uuid primary key default gen_random_uuid(),
  bem_id uuid not null references public.patrimonio_bens(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  de date not null,
  ate date,                       -- nulo = ainda é o dono
  motivo text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_patrimonio_posse_bem on public.patrimonio_posse(bem_id);

create table if not exists public.patrimonio_log(
  id uuid primary key default gen_random_uuid(),
  quem uuid,
  acao text not null,
  alvo text,
  resultado text,
  detalhe text,
  quando timestamptz not null default now()
);
create index if not exists idx_patrimonio_log_quando on public.patrimonio_log(quando desc);

alter table public.patrimonio_bens  enable row level security;
alter table public.patrimonio_posse enable row level security;
alter table public.patrimonio_log   enable row level security;

drop policy if exists patrimonio_bens_rw on public.patrimonio_bens;
create policy patrimonio_bens_rw on public.patrimonio_bens for all to authenticated
  using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());

drop policy if exists patrimonio_posse_rw on public.patrimonio_posse;
create policy patrimonio_posse_rw on public.patrimonio_posse for all to authenticated
  using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());

-- log: lê e insere; sem update/delete (mesmo desenho de acessos_log)
drop policy if exists patrimonio_log_select on public.patrimonio_log;
create policy patrimonio_log_select on public.patrimonio_log for select to authenticated
  using (public.is_patrimonio_admin());
drop policy if exists patrimonio_log_insert on public.patrimonio_log;
create policy patrimonio_log_insert on public.patrimonio_log for insert to authenticated
  with check (public.is_patrimonio_admin());
