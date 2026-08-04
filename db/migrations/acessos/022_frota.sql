-- Frota: os veículos e o ciclo de uso (retirada e devolução).
-- Desenho em docs/superpowers/specs/2026-08-04-frota-design.md

-- ── Quem pode mexer ────────────────────────────────────────────────────────
-- Mesmo desenho de is_patrimonio_admin(): procura a chave LITERAL dentro de
-- profiles.features. A central tem dois modelos de permissão que precisam
-- andar juntos (permissions{} no front, features[] aqui) — quem mexer num tem
-- de mexer no outro.
create or replace function public.is_frota_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'frota' = any(p.features) or p.is_superadmin
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

-- ── O veículo ──────────────────────────────────────────────────────────────
create table if not exists public.frota_veiculos(
  id uuid primary key default gen_random_uuid(),
  -- Placa é o identificador que todo mundo usa na vida real (a multa chega por
  -- ela, o documento é por ela). Sem espaço nem hífen: 'ERO3G55'.
  placa text not null unique,
  nome text not null,                 -- 'FORD FIESTA SEDAN'
  marca text,
  ano int,
  cor text,
  combustivel text,                   -- 'ALCOOL/GASOLINA', 'GASOLINA/ELETRICO'
  renavam text,
  chassi text,
  tipo_oleo text,                     -- '5W30'
  -- Estes carros são ALUGADOS: contrato e mensalidade são o custo real deles.
  -- O valor FIPE fica junto porque é o que dimensiona o risco, não o que a
  -- empresa possui — ver D1 do desenho.
  contrato text,                      -- 'CTR-007'
  codigo_patrimonial text,            -- 'RBB-007' — numeração de quem aluga
  aluguel_centavos bigint,
  fipe_centavos bigint,
  categoria_comercial text,           -- 'Padrão', 'Premium', 'Utilitário', 'Blindado'
  blindado boolean not null default false,
  situacao text not null default 'ativo'
    check (situacao in ('ativo','em_manutencao','alienado','inativo')),
  -- ONDE ESTÁ, em dois campos separados (D2): com uma pessoa, num lugar, ou os
  -- dois. Uma coluna só obrigaria a escolher e perderia a outra informação.
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  local_texto text,                   -- 'Barracão', 'Conchal'
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_frota_veiculos_situacao on public.frota_veiculos(situacao);
create index if not exists idx_frota_veiculos_pessoa   on public.frota_veiculos(pessoa_id);

-- ── O uso: uma linha por retirada ──────────────────────────────────────────
-- Esta tabela é a que faz o resto do módulo existir. O KM atual do veículo sai
-- DAQUI (da última devolução), nunca de um campo digitado à mão — foi por isso
-- que a aba "Alertas" da planilha nasceu vazia. E é o cruzamento data/hora
-- desta tabela que descobre o condutor de uma multa (F3).
create table if not exists public.frota_uso(
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.frota_veiculos(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  -- O nome vai gravado JUNTO da chave, igual ao histórico de posse do
  -- Patrimônio: histórico que perde o nome quando o colaborador sai da base
  -- deixa de ser histórico.
  pessoa_nome text,
  saida_em timestamptz not null default now(),
  km_saida int,
  volta_em timestamptz,               -- nulo = o carro está na rua agora
  km_volta int,
  destino text,
  finalidade text,
  -- Nível do tanque como a planilha registra: 0 a 4 (0 = reserva, 4 = cheio).
  -- Guardado em quartos porque é o que o ponteiro do carro mostra; pedir
  -- litros seria pedir o que a pessoa não tem como saber.
  tanque_quartos int check (tanque_quartos between 0 and 4),
  observacao text,
  criado_em timestamptz not null default now(),
  -- Não dá pra voltar antes de sair, nem rodar para trás.
  constraint frota_uso_volta_depois check (volta_em is null or volta_em >= saida_em),
  constraint frota_uso_km_cresce     check (km_volta is null or km_saida is null or km_volta >= km_saida)
);
create index if not exists idx_frota_uso_veiculo on public.frota_uso(veiculo_id, saida_em desc);
create index if not exists idx_frota_uso_aberto  on public.frota_uso(veiculo_id) where volta_em is null;
create index if not exists idx_frota_uso_pessoa  on public.frota_uso(pessoa_id);

-- Um veículo não pode estar em duas mãos ao mesmo tempo. O índice parcial faz o
-- banco garantir isso, em vez de confiar na tela.
create unique index if not exists uniq_frota_uso_um_aberto
  on public.frota_uso(veiculo_id) where volta_em is null;

-- ── Plano de revisão (D6): limiares em KM, editáveis ───────────────────────
-- Fica em tabela, não no código, porque o dono muda quando o mecânico mandar.
create table if not exists public.frota_plano_revisao(
  id uuid primary key default gen_random_uuid(),
  item text not null unique,
  a_cada_km int not null check (a_cada_km > 0),
  ordem int not null default 0,
  ativo boolean not null default true
);

insert into public.frota_plano_revisao(item, a_cada_km, ordem) values
  ('Troca de óleo', 7000, 1),
  ('Limpeza de bico', 40000, 2),
  ('Pneus', 40000, 3),
  ('Velas', 50000, 4),
  ('Líquido de arrefecimento', 50000, 5),
  ('Correia dentada', 60000, 6),
  ('Óleo de câmbio', 60000, 7),
  ('Bobina e cabo de vela', 80000, 8)
on conflict (item) do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.frota_veiculos      enable row level security;
alter table public.frota_uso           enable row level security;
alter table public.frota_plano_revisao enable row level security;

-- Ler: quem tem a permissão. Escrever: a mesma permissão — a Frota não separa
-- "olhar" de "mexer" nesta fase; quem entra, registra retirada e devolução.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='frota_veiculos' and policyname='frota_veiculos_ler') then
    create policy frota_veiculos_ler on public.frota_veiculos for select using (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_veiculos' and policyname='frota_veiculos_escrever') then
    create policy frota_veiculos_escrever on public.frota_veiculos for all
      using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_uso' and policyname='frota_uso_ler') then
    create policy frota_uso_ler on public.frota_uso for select using (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_uso' and policyname='frota_uso_escrever') then
    create policy frota_uso_escrever on public.frota_uso for all
      using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_plano_revisao' and policyname='frota_plano_ler') then
    create policy frota_plano_ler on public.frota_plano_revisao for select using (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_plano_revisao' and policyname='frota_plano_escrever') then
    create policy frota_plano_escrever on public.frota_plano_revisao for all
      using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
end $$;
