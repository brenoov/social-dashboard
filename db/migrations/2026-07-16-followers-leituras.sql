-- Histórico da contagem de seguidores DENTRO do dia.
--
-- Por que existe: `daily_snapshots` guarda UMA linha por dia (unique account_id +
-- captured_at) e o coletor sobrescreve a cada rodada. Ou seja, das 4 leituras
-- diárias sobra só a última — o movimento dentro do dia é jogado fora.
--
-- Consequência real (2026-07-16): a contagem do Breno chegou a 24.351 às 18h e
-- estava 24.349 às 22h. Ninguém conseguia ver isso; o painel só sabia dizer
-- "líquido = 0". Aqui cada leitura fica com a sua hora.
--
-- ATENÇÃO ao que isto NÃO é: não substitui o bruto (seguiram/saíram) da Meta, que
-- ela só publica no dia seguinte. Contagem revela LÍQUIDO. Quem entra e sai entre
-- duas leituras se cancela e some — somar as variações daqui daria um número
-- preciso e ERRADO. Serve pra mostrar que houve movimento, não pra contar quantos.
--
-- Volume: 7 contas x 4 rodadas/dia ≈ 28 linhas/dia ≈ 10 mil/ano. Irrelevante.
create table if not exists public.followers_leituras (
  id              bigserial primary key,
  account_id      uuid        not null references public.accounts(id) on delete cascade,
  followers_count integer     not null,
  lido_em         timestamptz not null default now()
);

create index if not exists followers_leituras_conta_tempo
  on public.followers_leituras (account_id, lido_em desc);

alter table public.followers_leituras enable row level security;

-- Leitura: mesma regra do daily_snapshots (o painel de redes precisa ler).
-- A escrita fica só com o service_role (o coletor) — sem policy de INSERT.
drop policy if exists auth_read_followers_leituras on public.followers_leituras;
create policy auth_read_followers_leituras
  on public.followers_leituras for select
  to authenticated
  using (true);

comment on table public.followers_leituras is
  'Cada leitura da contagem de seguidores, com hora. O daily_snapshots so guarda a ULTIMA do dia; aqui fica o movimento intradiario. Nao substitui o bruto seguiram/saiu da Meta: contagem so revela liquido.';
