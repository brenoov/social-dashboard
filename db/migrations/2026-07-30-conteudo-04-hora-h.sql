-- FASE 2 DA CENTRAL DE CONTEÚDO: o aviso na hora marcada.
--
-- Três coisas aqui, e as três precisam existir juntas ou a Fase 2 quebra:
--   1. soltar o CHECK de push_preferencias.tipo (senão salvar a preferência nova
--      falha com erro de constraint);
--   2. a coluna que liga a publicação automática por marca, quando a Meta liberar;
--   3. a função que reivindica as peças da hora — o coração da idempotência.

-- ── 1. O tipo novo de notificação ───────────────────────────────────────────
-- O CHECK original era check (tipo in ('vendas','saldo')). Um tipo novo em
-- _shared/notificacoes.js sem esta linha faz o botão "Minhas notificações"
-- estourar no salvamento, e o erro que aparece não diz nada sobre CHECK.
alter table public.push_preferencias drop constraint if exists push_preferencias_tipo_check;
alter table public.push_preferencias add constraint push_preferencias_tipo_check
  check (tipo in ('vendas', 'saldo', 'conteudo'));

-- ── 2. O interruptor da publicação automática, por marca ────────────────────
-- Fica desligado em todas. Quando o App Review da Meta sair, liga-se UMA marca
-- primeiro. Sozinha a coluna não faz nada: publicacaoAutomaticaLigada() exige
-- também o ESCOPOS_DE_PUBLICACAO_LIBERADOS do código.
alter table public.accounts
  add column if not exists publicacao_automatica boolean not null default false;

comment on column public.accounts.publicacao_automatica is
  'Se esta marca pode ter post publicado automaticamente. Depende TAMBEM do escopo '
  'instagram_content_publish no app da Meta (ver _shared/publicar-instagram.js).';

-- ── 3. Reivindicar as peças da hora ─────────────────────────────────────────
-- POR QUE UMA FUNÇÃO e não duas chamadas do cliente: o cron roda de 5 em 5
-- minutos e uma execução pode demorar mais que isso. Com "SELECT quem está na
-- hora" seguido de "UPDATE marcando avisado", duas execuções leem a mesma peça
-- e mandam dois pushes.
--
-- Aqui é um UPDATE ... RETURNING só: o banco serializa, e a segunda execução
-- não acha linha nenhuma. `avisado_em` é carimbado ANTES do envio, de propósito
-- — perder um aviso é recuperável (tem o botão "reavisar", que zera a marca);
-- mandar o mesmo aviso doze vezes por hora não é.
create or replace function public.conteudo_reivindicar_hora_h()
returns setof public.conteudo_pecas
language sql
security definer
set search_path = public
as $$
  update public.conteudo_pecas
     set avisado_em = now()
   where status = 'agendada'
     and avisado_em is null
     and publicar_em <= now()
  returning *;
$$;

-- Só o service_role (a Edge do cron) chama. `authenticated` não entra: senão
-- qualquer usuário logado poderia marcar todas as peças como avisadas e
-- silenciar a agenda inteira.
-- `anon` PRECISA constar: o Supabase concede EXECUTE por default privileges e
-- `revoke from public` nao tira concessao explicita ao papel anon. Sem esta
-- linha, um visitante podia marcar toda peca agendada como "ja avisei" e
-- silenciar as notificacoes. Confirmado em teste.
revoke execute on function public.conteudo_reivindicar_hora_h() from public, anon, authenticated;
grant execute on function public.conteudo_reivindicar_hora_h() to service_role;

-- ── 4. Reavisar (desfaz a reivindicação de UMA peça) ────────────────────────
-- O outro lado da moeda: se o push se perdeu, a pessoa precisa de um jeito de
-- pedir de novo sem mexer no banco na mão.
create or replace function public.conteudo_reavisar(p_peca uuid)
returns public.conteudo_pecas
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.conteudo_pecas;
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))
  ) then
    raise exception 'Sem permissao na Central de Conteudo.';
  end if;

  update public.conteudo_pecas
     set avisado_em = null
   where id = p_peca and status = 'agendada'
   returning * into v_row;

  if v_row.id is null then
    raise exception 'So da para reavisar uma peca que esta agendada.';
  end if;

  insert into public.conteudo_eventos (peca_id, acao, detalhe, quem)
  values (p_peca, 'reavisar', 'Pediu o aviso de novo.', auth.uid());

  return v_row;
end $$;

revoke execute on function public.conteudo_reavisar(uuid) from public, anon;
grant execute on function public.conteudo_reavisar(uuid) to authenticated;
