-- FASE 4: de onde vem o que postar.
--
-- As três fases anteriores resolvem o que fazer COM uma ideia (montar, aprovar,
-- agendar, medir). Nenhuma resolve a folha em branco — que é o gargalo real de
-- quem toca social media: às 9h de segunda, o que a gente posta esta semana?
--
-- Aqui ficam as ideias soltas, os blocos de texto que se repetem, e a fila do
-- robô que gera pauta.

-- ── IDEIAS ──────────────────────────────────────────────────────────────────
-- Uma ideia é uma peça que ainda não existe: sem arte, sem data, sem
-- compromisso. O valor está em poder jogar aqui às pressas e decidir depois.
create table if not exists public.conteudo_ideias (
  id         uuid primary key default gen_random_uuid(),
  -- NULL = serve para qualquer marca (ex.: "Dia das Mães"). O robô gera por
  -- marca, mas ideia digitada à mão muitas vezes vale para todas.
  account_id uuid references public.accounts(id) on delete cascade,

  titulo     text not null,
  gancho     text,          -- a primeira frase, que é o que segura o dedo
  formato    text check (formato in ('feed', 'reels', 'stories', 'carrossel')),
  pilar      text,          -- produto | bastidor | prova social | educativo | oferta | tendência

  -- [{ cena, fala, duracao_s }]. Só faz sentido em reels e stories; é o que
  -- transforma "fazer um vídeo do ateliê" em algo gravável hoje.
  roteiro    jsonb not null default '[]'::jsonb,

  legenda_sugerida  text,
  hashtags_sugeridas text,
  -- POR QUE AGORA: o campo que separa ideia de lista de temas. Obriga o robô a
  -- justificar (uma data, um post que foi bem, um concorrente) e dá ao dono o
  -- critério para escolher entre 30 sugestões.
  por_que_agora text,
  referencia    text,

  origem     text not null default 'manual' check (origem in ('manual', 'ia')),
  modelo     text,
  job_id     uuid,

  situacao   text not null default 'nova'
             check (situacao in ('nova', 'favorita', 'usada', 'descartada')),
  -- Preenchido quando a ideia vira peça. Mantém a linhagem: dá para responder
  -- "quanto do que publicamos nasceu do robô, e como foi?".
  peca_id    uuid references public.conteudo_pecas(id) on delete set null,

  criado_por uuid,
  created_at timestamptz not null default now()
);

comment on table public.conteudo_ideias is
  'Pauta ainda sem compromisso. origem=ia quando veio do robo; peca_id liga a ideia ao post que ela virou.';

create index if not exists conteudo_ideias_conta_idx
  on public.conteudo_ideias (account_id, situacao, created_at desc);
create index if not exists conteudo_ideias_novas_idx
  on public.conteudo_ideias (created_at desc) where situacao in ('nova', 'favorita');

-- ── BLOCOS ──────────────────────────────────────────────────────────────────
-- Texto que se repete: assinatura, conjunto de hashtags, chamada padrão. Coisa
-- pequena, usada dez vezes por dia.
create table if not exists public.conteudo_blocos (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  tipo       text not null check (tipo in ('legenda', 'hashtags', 'cta', 'assinatura')),
  nome       text not null,
  texto      text not null,
  usos       int not null default 0,
  ativo      boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now()
);

comment on table public.conteudo_blocos is
  'Blocos de texto reutilizaveis por marca. Alimentam tambem o tom de voz no prompt do robo de ideias.';

create index if not exists conteudo_blocos_conta_idx
  on public.conteudo_blocos (account_id, tipo, ativo);

-- ── FILA DO ROBÔ ────────────────────────────────────────────────────────────
-- Mesmo desenho de fabrica_jobs: a Edge enfileira e dispara o GitHub Actions; o
-- script do coletor executa. Opus com contexto grande estoura o relógio de uma
-- Edge Function, e é por isso que a Fábrica já faz assim.
create table if not exists public.conteudo_jobs (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'ideias',
  account_id    uuid references public.accounts(id) on delete cascade,
  params        jsonb not null default '{}'::jsonb,
  status        text not null default 'enfileirado'
                check (status in ('enfileirado', 'rodando', 'concluido', 'erro')),
  github_run_id text,
  resultado     jsonb,
  erro          text,
  criado_por    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conteudo_jobs_status_idx on public.conteudo_jobs (status, created_at desc);

-- ── A ideia vira peça ───────────────────────────────────────────────────────
-- Numa transação só: cria o rascunho já preenchido, marca a ideia como usada e
-- guarda a ligação entre as duas. Feito no cliente, uma falha no meio deixaria
-- ideia "usada" sem peça, ou peça órfã.
create or replace function public.conteudo_ideia_virar_peca(
  p_ideia uuid,
  p_account uuid,
  p_publicar_em timestamptz default null
)
returns public.conteudo_pecas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ideia public.conteudo_ideias;
  v_peca  public.conteudo_pecas;
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))
  ) then
    raise exception 'Sem permissao na Central de Conteudo.';
  end if;

  select * into v_ideia from public.conteudo_ideias where id = p_ideia;
  if v_ideia.id is null then
    raise exception 'Ideia nao encontrada.';
  end if;
  if v_ideia.situacao = 'usada' then
    raise exception 'Esta ideia ja virou peca.';
  end if;

  insert into public.conteudo_pecas (
    account_id, titulo, formato, status, legenda, hashtags, observacoes, publicar_em, criado_por
  ) values (
    p_account,
    v_ideia.titulo,
    coalesce(v_ideia.formato, 'feed'),
    'rascunho',
    coalesce(v_ideia.legenda_sugerida, ''),
    coalesce(v_ideia.hashtags_sugeridas, ''),
    v_ideia.por_que_agora,
    p_publicar_em,
    auth.uid()
  ) returning * into v_peca;

  update public.conteudo_ideias
     set situacao = 'usada', peca_id = v_peca.id
   where id = p_ideia;

  insert into public.conteudo_eventos (peca_id, para, acao, detalhe, quem)
  values (v_peca.id, 'rascunho', 'criou',
          case when v_ideia.origem = 'ia'
               then 'Nasceu de uma ideia sugerida pela IA.'
               else 'Nasceu de uma ideia do banco de pautas.' end,
          auth.uid());

  return v_peca;
end $$;

revoke execute on function public.conteudo_ideia_virar_peca(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.conteudo_ideia_virar_peca(uuid, uuid, timestamptz) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.conteudo_ideias enable row level security;
alter table public.conteudo_blocos enable row level security;
alter table public.conteudo_jobs   enable row level security;

create policy conteudo_ideias_leitura on public.conteudo_ideias
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));
create policy conteudo_ideias_escrita on public.conteudo_ideias
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

create policy conteudo_blocos_leitura on public.conteudo_blocos
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));
create policy conteudo_blocos_escrita on public.conteudo_blocos
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

-- Job é só leitura pelo cliente (para acompanhar o andamento). Quem cria é a
-- Edge, com service role — senão dava para enfileirar mil rodadas de Opus.
create policy conteudo_jobs_leitura on public.conteudo_jobs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

create policy conteudo_ideias_srv on public.conteudo_ideias for all using (auth.role() = 'service_role');
create policy conteudo_blocos_srv on public.conteudo_blocos for all using (auth.role() = 'service_role');
create policy conteudo_jobs_srv   on public.conteudo_jobs   for all using (auth.role() = 'service_role');
