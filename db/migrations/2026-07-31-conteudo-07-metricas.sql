-- FASE 3: fechar o ciclo. A peça agendada aqui vira o post real lá, e o
-- desempenho dele volta para o cartão.
--
-- Sem isto a ferramenta é uma agenda cega: dá para planejar e publicar, mas
-- não para saber o que funcionou — e "o que funcionou" é justamente o que a
-- Fase 4 (gerador de pauta com IA) vai usar como melhor insumo.

-- ── AS MÉTRICAS ─────────────────────────────────────────────────────────────
-- Chave (peca_id, capturado_em): uma leitura por dia, upsert. Mesmo desenho de
-- engagement_snapshots. Guardar a série e não só o último valor é o que permite
-- responder "quanto isso rendeu nas primeiras 24h?" — que é a pergunta que
-- compara dois posts de forma justa.
create table if not exists public.conteudo_metricas (
  peca_id           uuid not null references public.conteudo_pecas(id) on delete cascade,
  capturado_em      date not null,
  curtidas          int,
  comentarios       int,
  alcance           int,
  salvamentos       int,
  compartilhamentos int,
  visualizacoes     int,
  -- A resposta crua da Meta. As métricas do Instagram mudam de nome de tempos
  -- em tempos (impressions virou views em 2026); guardar o bruto permite
  -- recalcular o passado sem ter que coletar de novo.
  bruto             jsonb,
  primary key (peca_id, capturado_em)
);

comment on table public.conteudo_metricas is
  'Desempenho de cada peca publicada, uma leitura por dia. Upsert por (peca_id, capturado_em).';

-- ── OS CASAMENTOS ───────────────────────────────────────────────────────────
-- Por que uma tabela e não só a coluna ig_media_id na peça: aqui fica também o
-- que NÃO foi confirmado — a sugestão esperando resposta, e a recusa.
--
-- A recusa é o dado mais importante desta tabela: sem guardá-la, o robô
-- sugeriria o mesmo post errado na rodada seguinte, para sempre.
create table if not exists public.conteudo_casamentos (
  id           uuid primary key default gen_random_uuid(),
  peca_id      uuid not null references public.conteudo_pecas(id) on delete cascade,
  ig_media_id  text not null,
  ig_permalink text,
  ig_timestamp timestamptz,
  ig_caption   text,
  ig_thumb     text,
  pontuacao    numeric not null,
  motivo       text,
  situacao     text not null default 'sugerido'
               check (situacao in ('sugerido', 'confirmado', 'recusado', 'automatico')),
  decidido_por uuid,
  decidido_em  timestamptz,
  created_at   timestamptz not null default now(),
  unique (peca_id, ig_media_id)
);

comment on table public.conteudo_casamentos is
  'Ligacao entre a peca planejada e o post real do Instagram. Guarda tambem as '
  'recusas — sem elas o robo sugeriria o mesmo post errado toda rodada.';

create index if not exists conteudo_casamentos_peca_idx
  on public.conteudo_casamentos (peca_id, created_at desc);
-- "Tem alguma pergunta esperando resposta?" — a faixa "É este post?" na tela.
create index if not exists conteudo_casamentos_pendentes_idx
  on public.conteudo_casamentos (situacao) where situacao = 'sugerido';

-- ── DECIDIR SOBRE UMA SUGESTÃO ──────────────────────────────────────────────
-- Confirmar não é só marcar a linha: é gravar o vínculo na peça (que é o que
-- faz as métricas passarem a ser coletadas) e registrar quem decidiu. As três
-- coisas numa transação só.
create or replace function public.conteudo_decidir_casamento(
  p_casamento uuid,
  p_confirma boolean
)
returns public.conteudo_casamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conteudo_casamentos;
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))
  ) then
    raise exception 'Sem permissao na Central de Conteudo.';
  end if;

  update public.conteudo_casamentos
     set situacao = case when p_confirma then 'confirmado' else 'recusado' end,
         decidido_por = auth.uid(),
         decidido_em = now()
   where id = p_casamento
     and situacao = 'sugerido'
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Esta sugestao ja foi decidida.';
  end if;

  if p_confirma then
    update public.conteudo_pecas
       set ig_media_id = v_row.ig_media_id,
           ig_permalink = v_row.ig_permalink,
           status = 'publicada',
           publicado_em = coalesce(publicado_em, v_row.ig_timestamp, now())
     where id = v_row.peca_id;
  end if;

  insert into public.conteudo_eventos (peca_id, acao, detalhe, quem)
  values (
    v_row.peca_id,
    case when p_confirma then 'casou' else 'recusou_casamento' end,
    case when p_confirma
         then 'Confirmou que este e o post no Instagram.'
         else 'Disse que este post nao e desta peca.' end,
    auth.uid()
  );

  return v_row;
end $$;

revoke execute on function public.conteudo_decidir_casamento(uuid, boolean) from public, anon;
grant execute on function public.conteudo_decidir_casamento(uuid, boolean) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.conteudo_metricas   enable row level security;
alter table public.conteudo_casamentos enable row level security;

-- Leitura pelo mesmo gate do módulo. Escrita SÓ do service_role: quem preenche
-- é o robô (a Edge conteudo-espelho). Deixar o cliente escrever aqui permitiria
-- inventar o desempenho de um post, que é o tipo de número que ninguém confere.
create policy conteudo_metricas_leitura on public.conteudo_metricas
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

create policy conteudo_casamentos_leitura on public.conteudo_casamentos
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))));

-- Sem policy de insert/update/delete para `authenticated` de propósito: a
-- decisão sobre uma sugestão passa pela função acima, que valida e registra.
create policy conteudo_metricas_srv on public.conteudo_metricas
  for all using (auth.role() = 'service_role');
create policy conteudo_casamentos_srv on public.conteudo_casamentos
  for all using (auth.role() = 'service_role');
