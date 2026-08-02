-- Central de Conteúdo — quem publica, e aprovar já agendando
--
-- ═══ 1. RESPONSÁVEL PELA PEÇA ═══════════════════════════════════════════════
--
-- O aviso da hora H ia para TODO MUNDO: `aviso-de-conteudo.js` cruza apenas
-- preferência de notificação × permissão `conteudo`, porque a peça não tinha
-- dono. Cinco pessoas com a ferramenta receberiam "Hora de publicar" de todas
-- as marcas, inclusive das que não cuidam — e o aviso que chega para todos é o
-- aviso que ninguém trata como seu.
--
-- Nulo continua valendo: sem responsável, avisa quem tiver a notificação ligada
-- (o comportamento de hoje). Isso mantém a peça antiga funcionando e não obriga
-- ninguém a preencher mais um campo para usar a ferramenta.

alter table public.conteudo_pecas
  add column if not exists responsavel uuid references public.profiles(id) on delete set null;

comment on column public.conteudo_pecas.responsavel is
  'Quem vai publicar esta peca. O aviso da hora H vai so para essa pessoa. Nulo = avisa todo mundo que tem a notificacao ligada.';

-- O cron da hora H busca por (status, avisado_em, publicar_em); o responsável
-- entra junto para não obrigar uma segunda leitura por peça.
create index if not exists conteudo_pecas_responsavel_idx
  on public.conteudo_pecas (responsavel) where responsavel is not null;

-- ═══ 2. APROVAR JÁ AGENDANDO ════════════════════════════════════════════════
--
-- Aprovar e agendar eram dois cliques mesmo com a data já preenchida, e o
-- estado do meio ('aprovada') não acrescenta decisão nenhuma quando a data
-- existe — é burocracia.
--
-- POR QUE ISTO PRECISA SER FUNÇÃO DO BANCO, e não uma transição a mais no
-- `estados.js`: quem aprova passa por `conteudo_decidir`, que confere a
-- permissão `conteudo.aprovar`. Uma transição em_aprovacao → agendada feita
-- pelo caminho comum seria um UPDATE simples — e a trigger
-- `conteudo_guarda_aprovacao` só vigia a entrada em 'aprovada'/'reprovada'.
-- Ou seja: agendar direto pularia o guardião da aprovação, e qualquer pessoa
-- com acesso à ferramenta poria conteúdo na fila sem ninguém aprovar.

create or replace function public.conteudo_aprovar_e_agendar(p_peca uuid)
returns public.conteudo_pecas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conteudo_pecas;
begin
  -- A MESMA checagem de `conteudo_decidir`. Repetida de propósito: esta função
  -- é outra porta para o mesmo quarto, e porta sem fechadura própria é porta
  -- aberta.
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'admin' or p.is_superadmin or 'conteudo.aprovar' = any (p.features))
  ) then
    raise exception 'Sem permissao para aprovar pecas de conteudo.';
  end if;

  -- Agendar exige data. O CHECK da tabela já barraria, mas com uma mensagem
  -- que ninguem entende.
  if not exists (
    select 1 from public.conteudo_pecas
     where id = p_peca and publicar_em is not null
  ) then
    raise exception 'Esta peca nao tem data marcada. Escolha quando publicar antes de agendar.';
  end if;

  -- `and status = 'em_aprovacao'` é o mesmo trinco contra dois aprovadores ao
  -- mesmo tempo: o segundo nao acha linha e recebe o aviso.
  --
  -- `avisado_em = null` porque a peca esta ENTRANDO em agendada: se ela ja
  -- tinha sido avisada numa rodada anterior, o robo da hora H (que so olha quem
  -- tem o campo nulo) nunca mais tocaria nela.
  update public.conteudo_pecas
     set status = 'agendada',
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         motivo_reprovacao = null,
         avisado_em = null
   where id = p_peca
     and status = 'em_aprovacao'
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Esta peca nao esta esperando aprovacao (alguem ja decidiu?).';
  end if;

  -- DOIS eventos, não um: a trilha precisa mostrar que houve aprovação E
  -- agendamento. Um evento só faria parecer que a peça pulou a aprovação.
  insert into public.conteudo_eventos (peca_id, de, para, acao, detalhe, quem)
  values
    (p_peca, 'em_aprovacao', 'aprovada', 'aprovou', 'Aprovada já agendando.', auth.uid()),
    (p_peca, 'aprovada', 'agendada', 'mudou_status', null, auth.uid());

  return v_row;
end $$;

-- O anon herda EXECUTE por padrao no Supabase, e `revoke from public` NAO tira
-- a concessao explicita dele.
revoke all on function public.conteudo_aprovar_e_agendar(uuid) from public, anon;
grant execute on function public.conteudo_aprovar_e_agendar(uuid) to authenticated;
