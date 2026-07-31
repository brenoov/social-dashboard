-- Central de Conteúdo — concorrentes por marca
--
-- POR QUE ESTA MIGRATION EXISTE: o robô de pauta puxava `noticias_concorrentes`
-- sem filtro nenhum. Aquela tabela é do Portal de Notícias e é 100% moda e
-- calçado (Schutz, Anacapri, Petite Jolie, Arezzo...). Resultado: a primeira
-- pauta real do Breno Vale citou "@Isla, @Santa Lolla e @Arezzo&Co" como
-- concorrentes DELE — marcas de sapato para uma marca pessoal.
--
-- Concorrente é coisa de marca, não do sistema. Cada conta passa a ter a sua
-- lista, e só quem é do nicho do Portal continua bebendo dele.

create table if not exists public.conteudo_concorrentes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  -- O @ do perfil, sem o arroba. É o que identifica de verdade.
  handle      text not null,
  -- Nome como as pessoas falam ("Lasaro Carvalho"). Vazio = usa o handle.
  nome        text,
  -- Por que ele é concorrente / o que observar nele. Vai inteiro para o
  -- briefing: é aqui que mora o contexto que a IA não tem como adivinhar.
  observacao  text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  -- Mesmo @ duas vezes na mesma marca é engano de digitação, não um caso de uso.
  unique (account_id, handle)
);

create index if not exists conteudo_concorrentes_da_conta
  on public.conteudo_concorrentes (account_id) where ativo;

-- Só as marcas do nicho de moda/calçado devem receber o Portal de Notícias.
-- Nasce FALSO: uma marca nova não herda o nicho de ninguém.
alter table public.accounts
  add column if not exists conteudo_usa_portal boolean not null default false;

comment on column public.accounts.conteudo_usa_portal is
  'Se o robô de pauta deve incluir noticias_concorrentes (Portal de Notícias) no briefing desta marca. O Portal cobre moda e calçado — só serve para marcas desse nicho.';

alter table public.conteudo_concorrentes enable row level security;

create policy conteudo_concorrentes_leitura on public.conteudo_concorrentes
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

create policy conteudo_concorrentes_escrita on public.conteudo_concorrentes
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

create policy conteudo_concorrentes_srv on public.conteudo_concorrentes
  for all using (auth.role() = 'service_role');

-- As funções deste projeto são SECURITY DEFINER e o anon herda EXECUTE por
-- padrão do Supabase; aqui não há função nova, mas a tabela não pode ficar
-- legível para quem não passou pelo login.
revoke all on public.conteudo_concorrentes from anon;
