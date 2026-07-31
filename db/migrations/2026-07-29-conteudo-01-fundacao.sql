-- CENTRAL DE CONTEÚDO — as três tabelas de base.
--
-- O painel media redes sociais muito bem e não OPERA nada: decidir o que postar,
-- aprovar, agendar e conferir acontece fora do sistema. Estas tabelas são o
-- lugar onde esse trabalho passa a morar.
--
-- NOTA SOBRE PUBLICAÇÃO: o app da Meta ainda não tem os escopos
-- `instagram_content_publish` / `pages_manage_posts`, então na hora marcada o
-- sistema NÃO publica — ele avisa no celular com a peça e a legenda prontas.
-- O modelo aqui já é o final: quando a Meta liberar, só muda quem preenche
-- `ig_media_id`, e nada precisa ser migrado.

-- ── PEÇAS ───────────────────────────────────────────────────────────────────
create table if not exists public.conteudo_pecas (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  titulo       text not null,
  formato      text not null check (formato in ('feed', 'reels', 'stories', 'carrossel')),

  -- Uma coluna só para o estado. A tentação é ter `aprovada boolean` + `agendada
  -- boolean` ao lado; isso cria estados impossíveis (aprovada=false e
  -- agendada=true) que ninguém sabe ler depois. As chaves batem com STATUS em
  -- src/ferramentas/conteudo/estados.js — mudar aqui exige mudar lá.
  status       text not null default 'rascunho'
               check (status in ('rascunho', 'em_aprovacao', 'aprovada', 'reprovada',
                                 'agendada', 'publicada', 'arquivada')),

  legenda      text not null default '',
  hashtags     text not null default '',
  observacoes  text,

  -- timestamptz, nunca `date` + `time`: o horário é sempre BRT para quem olha,
  -- mas a comparação do cron é com now(), e o tipo resolve o fuso sozinho.
  publicar_em  timestamptz,
  publicado_em timestamptz,
  -- Marca de "já mandei o aviso da hora H". É o que impede o cron de */5 min
  -- notificar a mesma peça doze vezes por hora. Ver a migration 05.
  avisado_em   timestamptz,

  -- Preenchidos quando a peça é casada com o post real do Instagram (Fase 3).
  ig_media_id  text,
  ig_permalink text,

  criado_por        uuid references auth.users(id),
  aprovado_por      uuid references auth.users(id),
  aprovado_em       timestamptz,
  motivo_reprovacao text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Estado e dados têm que concordar. Sem estas duas, uma peça "agendada" sem
  -- horário fica invisível para o cron e ninguém entende por que não avisou.
  constraint conteudo_agendada_tem_data
    check (status <> 'agendada' or publicar_em is not null),
  constraint conteudo_publicada_tem_data
    check (status <> 'publicada' or publicado_em is not null)
);

comment on table public.conteudo_pecas is
  'Central de Conteudo: uma linha por post planejado. O estado vive em status; '
  'a trilha de quem fez o que fica em conteudo_eventos.';

create index if not exists conteudo_pecas_conta_idx
  on public.conteudo_pecas (account_id, publicar_em);
create index if not exists conteudo_pecas_status_idx
  on public.conteudo_pecas (status, publicar_em);
-- A varredura do cron da hora H, a cada 5 minutos, para sempre. Índice parcial
-- porque ele só olha um punhado de linhas de uma tabela que só cresce.
create index if not exists conteudo_pecas_horah_idx
  on public.conteudo_pecas (publicar_em)
  where status = 'agendada' and avisado_em is null;
-- Um post do Instagram pertence a UMA peça. É o que impede o casamento da
-- Fase 3 de vincular o mesmo post a duas peças parecidas.
create unique index if not exists conteudo_pecas_ig_media_uq
  on public.conteudo_pecas (ig_media_id)
  where ig_media_id is not null;

-- ── ARQUIVOS ────────────────────────────────────────────────────────────────
-- Carrossel = N linhas ordenadas, não um array de caminhos numa coluna: assim a
-- ordem é um dado de verdade (com unique), dá para trocar um slide sem
-- reescrever o resto, e cada arquivo carrega o próprio tipo e tamanho.
create table if not exists public.conteudo_arquivos (
  id        uuid primary key default gen_random_uuid(),
  peca_id   uuid not null references public.conteudo_pecas(id) on delete cascade,
  ordem     int  not null default 1,
  bucket    text not null default 'conteudo',
  -- SÓ o caminho dentro do bucket, nunca a URL pronta: o bucket é privado e a
  -- URL é assinada na hora, com validade curta. URL guardada nasce vencida.
  caminho   text not null,
  tipo      text not null check (tipo in ('imagem', 'video')),
  mime      text,
  bytes     bigint,
  largura   int,
  altura    int,
  duracao_s numeric,
  created_at timestamptz not null default now(),
  unique (peca_id, ordem)
);

comment on table public.conteudo_arquivos is
  'Arquivos de uma peca, em ordem. Guarda o caminho no bucket privado conteudo, nunca a URL.';

create index if not exists conteudo_arquivos_peca_idx
  on public.conteudo_arquivos (peca_id, ordem);

-- ── EVENTOS ─────────────────────────────────────────────────────────────────
-- Append-only, mesma escolha de gt_fila_decisoes: é o que responde "quem
-- aprovou esse post e quando?" seis meses depois. Corrigir é registrar outro
-- evento, nunca reescrever o que aconteceu.
create table if not exists public.conteudo_eventos (
  id       bigserial primary key,
  peca_id  uuid not null references public.conteudo_pecas(id) on delete cascade,
  de       text,
  para     text,
  acao     text not null,
  detalhe  text,
  quem     uuid,
  quando   timestamptz not null default now()
);

comment on table public.conteudo_eventos is
  'Trilha da Central de Conteudo. Append-only: nunca dar update, o historico e o produto.';

create index if not exists conteudo_eventos_peca_idx
  on public.conteudo_eventos (peca_id, quando desc);

-- ── A GUARDA DE APROVAÇÃO ───────────────────────────────────────────────────
-- POR QUE ISTO EXISTE: a chave anônima do Supabase está no pacote JavaScript
-- público. Esconder o botão "Aprovar" não protege nada — qualquer pessoa com o
-- console aberto manda um PATCH com status='aprovada'. RLS de UPDATE também não
-- resolve: ela não sabe distinguir "editou a legenda" de "aprovou".
--
-- Uma trigger sabe: ela vê o velho e o novo valor.
create or replace function public.conteudo_guarda_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- Sem usuário logado só chega aqui o service_role (Edge Functions e cron),
  -- porque a RLS barra o resto antes da trigger. É ele quem marca 'publicada'
  -- na hora H, então passa.
  if auth.uid() is null then
    return new;
  end if;

  if new.status in ('aprovada', 'reprovada') and old.status is distinct from new.status then
    if not exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role = 'admin' or p.is_superadmin or 'conteudo.aprovar' = any (p.features))
    ) then
      raise exception 'Sem permissao para aprovar ou reprovar pecas de conteudo.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists conteudo_pecas_guarda on public.conteudo_pecas;
create trigger conteudo_pecas_guarda
  before update on public.conteudo_pecas
  for each row execute function public.conteudo_guarda_aprovacao();

-- ── A VIA OFICIAL DE DECIDIR ────────────────────────────────────────────────
-- A trigger acima é a rede de segurança. Esta função é o caminho normal: valida
-- a transição, carimba quem decidiu e grava o evento — as três coisas juntas,
-- numa transação só, para não existir peça aprovada sem registro de quem aprovou.
create or replace function public.conteudo_decidir(
  p_peca uuid,
  p_decisao text,
  p_motivo text default null
)
returns public.conteudo_pecas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conteudo_pecas;
begin
  if p_decisao not in ('aprovada', 'reprovada') then
    raise exception 'Decisao invalida: %. Use aprovada ou reprovada.', p_decisao;
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'admin' or p.is_superadmin or 'conteudo.aprovar' = any (p.features))
  ) then
    raise exception 'Sem permissao para aprovar ou reprovar pecas de conteudo.';
  end if;

  -- O `and status = 'em_aprovacao'` é o trinco contra dois aprovadores clicando
  -- ao mesmo tempo: o segundo não acha linha e recebe o aviso, em vez de
  -- sobrescrever a decisão do primeiro em silêncio.
  update public.conteudo_pecas
     set status = p_decisao,
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         motivo_reprovacao = case when p_decisao = 'reprovada' then p_motivo else null end
   where id = p_peca
     and status = 'em_aprovacao'
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Esta peca nao esta esperando aprovacao (alguem ja decidiu?).';
  end if;

  insert into public.conteudo_eventos (peca_id, de, para, acao, detalhe, quem)
  values (p_peca, 'em_aprovacao', p_decisao,
          case when p_decisao = 'aprovada' then 'aprovou' else 'reprovou' end,
          p_motivo, auth.uid());

  return v_row;
end $$;

revoke execute on function public.conteudo_decidir(uuid, text, text) from public, anon;
grant execute on function public.conteudo_decidir(uuid, text, text) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Forma copiada de gt_fila_decisoes (EXISTS em `profiles`, checando features),
-- com `is_superadmin` incluído: hasPermission() no front devolve true direto
-- para superadmin, então sem isto ele veria a tela e receberia lista vazia.
alter table public.conteudo_pecas    enable row level security;
alter table public.conteudo_arquivos enable row level security;
alter table public.conteudo_eventos  enable row level security;

create policy conteudo_pecas_leitura on public.conteudo_pecas
  for select to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

-- Escrita no mesmo gate do módulo. A granularidade fina (criar/editar/excluir)
-- fica no front; o que o banco separa é o que importa de verdade — quem ENTRA
-- na ferramenta versus quem APROVA (isso é a trigger, acima).
create policy conteudo_pecas_escrita on public.conteudo_pecas
  for all to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  )
  with check (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

create policy conteudo_arquivos_leitura on public.conteudo_arquivos
  for select to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

create policy conteudo_arquivos_escrita on public.conteudo_arquivos
  for all to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  )
  with check (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

create policy conteudo_eventos_leitura on public.conteudo_eventos
  for select to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

create policy conteudo_eventos_insercao on public.conteudo_eventos
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
    -- Ninguém assina evento no nome de outro.
    and quem = auth.uid()
  );

-- SEM policy de update/delete em conteudo_eventos, de propósito: append-only.
