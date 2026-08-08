-- Frota F7b: a FILA que leva o PDF da ficha assinada pro Zoho WorkDrive.
-- Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md (D23)
--
-- A REGRA QUE DEFINE ESTA MIGRATION: **a assinatura NUNCA espera o Zoho.**
-- Assinou, gravou, acabou. O envio do papel é outro assunto, que acontece
-- depois, e que pode falhar e tentar de novo sem que ninguém no volante fique
-- sabendo. Se o Zoho estiver fora, a ficha continua assinada e válida.
--
-- POR QUE A ENTRADA NA FILA É UM GATILHO, E NÃO UMA LINHA NA TELA
--
-- O padrão "duas gravações e só a primeira conferida" apareceu QUATRO vezes
-- neste módulo, sempre com a tela dizendo que deu certo. Uma segunda gravação
-- feita pela tela (grava a assinatura, depois grava na fila) seria a quinta —
-- e a pior delas, porque a falha não apareceria em lugar nenhum: a ficha ficaria
-- assinada, correta, e sem papel nenhum pra sempre, sem uma linha de erro.
--
-- Com o gatilho, entrar na fila acontece DENTRO da mesma transação da
-- assinatura: ou as duas coisas acontecem, ou nenhuma. Não existe estado
-- intermediário pra alguém esquecer de conferir. E vale pra qualquer caminho de
-- escrita, não só pra tela.
--
-- E o gatilho NÃO PODE derrubar a assinatura (por isso o `exception when others`
-- lá embaixo): a fila é conveniência de arquivo; a assinatura é a prova. Se
-- algum dia a fila estiver quebrada, o certo é a ficha ser assinada assim mesmo
-- e o papel entrar depois — e é pra isso que serve o conserto automático dentro
-- de `frota_pdf_pegar_da_fila`.

begin;

create table if not exists public.frota_checklist_pdf(
  id uuid primary key default gen_random_uuid(),
  -- `on delete cascade`: hoje ficha assinada não se apaga (gatilho da 032), mas
  -- ficha NÃO assinada se apaga, e linha de fila apontando pro nada só serviria
  -- pra o robô falhar pra sempre tentando montar um papel que não existe.
  checklist_id uuid not null references public.frota_checklist(id) on delete cascade,
  situacao text not null default 'na_fila'
    check (situacao in ('na_fila','enviando','enviado','falhou')),
  tentativas int not null default 0,
  -- O texto que quem administra vai ler quando o papel não chegar. Escrito em
  -- português, dizendo o que FAZER — nunca o erro cru da API.
  ultimo_erro text,
  -- Quando marcou 'enviando'. É o que destrava uma tentativa que morreu no meio
  -- (a Edge estourou o tempo, a nuvem reiniciou): sem isto a linha ficaria
  -- 'enviando' pra sempre e o papel nunca chegaria, calado.
  tentado_em timestamptz,
  zoho_file_id text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  -- UMA FICHA, UM PAPEL. Sem isto, uma segunda entrada na fila (gatilho que
  -- dispara duas vezes, conserto automático rodando junto) mandaria o mesmo
  -- documento duas vezes pro Zoho — e duas cópias do mesmo checklist na pasta
  -- fazem quem procura duvidar de qual é a boa.
  unique (checklist_id)
);

-- O índice que o robô usa: pegar o que está na fila, mais antigo primeiro.
create index if not exists idx_frota_pdf_fila
  on public.frota_checklist_pdf(situacao, criado_em)
  where situacao in ('na_fila','enviando');

-- ── Quem pode ler e escrever ───────────────────────────────────────────────
-- Mesmo desenho das migrations 022–035: is_frota_admin() é a porta. Quem
-- administra a Frota precisa PODER VER a fila — uma fila que ninguém enxerga é
-- exatamente como um papel some sem ninguém notar.
--
-- O robô não depende disto: ele roda com a chave de serviço, que passa por cima
-- da RLS. As políticas aqui são pra tela.
alter table public.frota_checklist_pdf enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
                  where tablename = 'frota_checklist_pdf' and policyname = 'frota_checklist_pdf_ler') then
    create policy frota_checklist_pdf_ler on public.frota_checklist_pdf
      for select using (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'frota_checklist_pdf' and policyname = 'frota_checklist_pdf_escrever') then
    create policy frota_checklist_pdf_escrever on public.frota_checklist_pdf
      for all using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
end $$;

-- ── Assinou → entra na fila ────────────────────────────────────────────────
-- SECURITY DEFINER de propósito: quem assina é o motorista, e o direito de
-- entrar na fila não pode depender da política de escrita desta tabela. Se um
-- dia a política mudar, a fila não pode parar calada por causa disso.
create or replace function public.frota_checklist_enfileirar_pdf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só quando a ficha PASSA a ter assinatura. `is distinct from` cobre o INSERT
  -- (onde `old` não existe) sem precisar de dois gatilhos com regras diferentes.
  if new.assinada_em is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.assinada_em is not null then
    return null;
  end if;

  begin
    insert into public.frota_checklist_pdf(checklist_id) values (new.id)
    on conflict (checklist_id) do nothing;
  exception when others then
    -- A ASSINATURA NUNCA CAI POR CAUSA DA FILA. Se a inserção falhar (tabela em
    -- manutenção, coisa que ninguém previu), o aviso vai pro log do banco e a
    -- assinatura segue — e `frota_pdf_pegar_da_fila` conserta sozinha na próxima
    -- rodada, porque ela procura ficha assinada SEM linha de fila.
    raise warning 'Frota: não consegui pôr a ficha % na fila do PDF (%). '
      'A assinatura foi gravada assim mesmo; o conserto automático da fila pega isto.',
      new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_frota_checklist_enfileirar_pdf on public.frota_checklist;
create trigger trg_frota_checklist_enfileirar_pdf
  after insert or update of assinada_em on public.frota_checklist
  for each row execute function public.frota_checklist_enfileirar_pdf();

-- ── O robô pega o próximo lote ─────────────────────────────────────────────
-- Faz DUAS coisas, nesta ordem:
--
-- 1) CONSERTA: toda ficha assinada que não tem linha de fila ganha uma. É a
--    rede embaixo do `exception` do gatilho, e é o que faz as fichas já
--    assinadas antes desta migration entrarem também.
-- 2) PEGA: marca 'enviando' um punhado delas e devolve.
--
-- `for update skip locked` é o que impede DOIS envios do mesmo papel quando
-- duas rodadas do robô se cruzam. Sem ele, as duas leriam a mesma linha e o
-- Zoho receberia o mesmo checklist duas vezes.
-- OS NOMES DAS COLUNAS DEVOLVIDAS NÃO SÃO `id`/`checklist_id`/`tentativas` DE
-- PROPÓSITO: em plpgsql, o nome de uma coluna de saída SOMBREIA a coluna de
-- mesmo nome dentro do corpo, e o Postgres recusa a função com "column
-- reference is ambiguous". Medido, não deduzido — a primeira versão desta
-- função quebrou exatamente assim.
create or replace function public.frota_pdf_pegar_da_fila(p_limite int default 20)
returns table (id_da_fila uuid, id_da_ficha uuid, tentativas_ate_agora int)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.frota_checklist_pdf(checklist_id)
  select c.id from public.frota_checklist c
   where c.assinada_em is not null
     and not exists (select 1 from public.frota_checklist_pdf p where p.checklist_id = c.id)
  on conflict (checklist_id) do nothing;

  return query
  update public.frota_checklist_pdf f
     set situacao = 'enviando', tentativas = f.tentativas + 1, tentado_em = now()
   where f.id in (
     select p.id from public.frota_checklist_pdf p
      where p.situacao = 'na_fila'
         -- Tentativa que morreu no meio volta pra fila depois de 15 minutos. O
         -- robô roda de poucos em poucos minutos, então 15 é folga larga o
         -- bastante pra não atropelar uma rodada lenta que ainda está subindo.
         or (p.situacao = 'enviando' and p.tentado_em < now() - interval '15 minutes')
      order by p.criado_em
      limit greatest(1, coalesce(p_limite, 20))
      for update skip locked
   )
  returning f.id, f.checklist_id, f.tentativas;
end $$;

-- Só a chave de serviço (o robô) chama isto. Deixar aberto pra `authenticated`
-- daria a qualquer pessoa logada o poder de marcar a fila inteira como
-- 'enviando' e travar o envio de todo mundo por 15 minutos.
revoke all on function public.frota_pdf_pegar_da_fila(int) from public, anon, authenticated;

commit;

-- ── O QUE FALTA, E É NA MÃO (não está aqui de propósito) ───────────────────
--
-- 1) O SEGREDO do robô e o agendamento. Não entram nesta migration porque o
--    robô ainda NÃO foi publicado — agendar um disparo pra uma função que não
--    existe encheria a tela de Saúde dos Robôs de erro vermelho legítimo.
--    Depois de publicar `enviar-pdf-checklist`, rodar:
--
--      insert into public.segredos_de_cron(nome, segredo)
--      values ('enviar-pdf-checklist', encode(gen_random_bytes(32),'hex'))
--      on conflict (nome) do nothing;
--
--      select cron.schedule('enviar-pdf-checklist', '*/10 * * * *',
--        $c$ select public.disparar_robo('enviar-pdf-checklist','enviar-pdf-checklist',
--              'enviar-pdf-checklist', '{"origem":"cron"}'::jsonb, 120000) $c$);
--
--      insert into public.robos_esperados (robo, horas_sem_sucesso_ate, critico, porque)
--      values ('enviar-pdf-checklist', 6, false,
--              'Leva o PDF da ficha assinada pra pasta do Zoho.')
--      on conflict (robo) do update set horas_sem_sucesso_ate = excluded.horas_sem_sucesso_ate,
--        critico = excluded.critico, porque = excluded.porque;
--
--    De 10 em 10 minutos dá ~4.300 disparos por mês pra ~150 papéis. É de
--    graça (a rodada sem fila termina em um SELECT) e mantém o papel chegando
--    no Zoho no mesmo turno de trabalho em que foi assinado.
--
-- 2) NÃO É CRÍTICO (`critico = false`), e a razão é a mesma do D23: o papel
--    atrasado não invalida nada. A prova mora no banco, e continua lá.
