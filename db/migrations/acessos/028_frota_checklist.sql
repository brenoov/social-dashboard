-- Frota F6: o checklist de primeiro escalão, e a posse contínua.
-- Desenho em docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md
--
-- POR QUE ESTA FASE EXISTE: com a F1 no ar e 7 pessoas já com a permissão
-- liberada, frota_uso tinha ZERO linhas. A viagem é a unidade de medida errada
-- pra quem dirige o mesmo carro todo dia — ninguém "retira" e "devolve" o
-- próprio carro. O checklist diário traz o HODÔMETRO, que é o número do qual o
-- alerta de revisão e o custo por km dependem, e que hoje não existe em carro
-- nenhum.

-- ── frota_uso passa a guardar POSSE, além de viagem (D9) ───────────────────
-- Sem este campo a posse aberta do dono fixo faria o carro aparecer
-- eternamente "na rua": estadoDoVeiculo() chama de na-rua QUALQUER uso aberto.
alter table public.frota_uso add column if not exists tipo text not null default 'viagem';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'frota_uso_tipo_valido') then
    alter table public.frota_uso add constraint frota_uso_tipo_valido
      check (tipo in ('viagem','posse'));
  end if;
end $$;
create index if not exists idx_frota_uso_tipo on public.frota_uso(veiculo_id, tipo, volta_em);

-- ── A lista de itens, que é do GESTOR e não do código (D10) ────────────────
create table if not exists public.frota_checklist_itens(
  id uuid primary key default gen_random_uuid(),
  ordem int not null default 0,
  -- Único: dois itens com o mesmo nome dariam duas perguntas iguais na mesma
  -- ficha. É a mesma trava que problemasDoItem() faz no plano de revisão.
  item text not null unique,
  cadencia text not null check (cadencia in ('diario','semanal','mensal')),
  ativo boolean not null default true,
  observacao text
);

-- ── Em que dia caem o semanal e o mensal (D11) ─────────────────────────────
-- Decisão do dono: NENHUM DIA PESADO. O semanal não se empilha no diário de
-- segunda; ele tem dia próprio (sexta), e o mensal cai na 1ª quarta-feira.
-- Os dois nunca colidem, porque primeira quarta nunca é sexta.
--
-- Linha única: `id boolean primary key check (id)` garante que não existirá uma
-- segunda configuração pra alguém editar por engano e não entender por que a
-- mudança não pegou.
create table if not exists public.frota_checklist_config(
  id boolean primary key default true check (id),
  dia_semanal int not null default 5 check (dia_semanal between 1 and 5),
  semana_mensal int not null default 1 check (semana_mensal between 1 and 4),
  dia_mensal int not null default 3 check (dia_mensal between 1 and 5)
);
insert into public.frota_checklist_config(id) values (true) on conflict (id) do nothing;

-- ── A ficha preenchida ─────────────────────────────────────────────────────
create table if not exists public.frota_checklist(
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.frota_veiculos(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  feita_em date not null,
  cadencias text[] not null default '{diario}',
  -- OBRIGATÓRIO (D15). É o único campo sem "não se aplica": sem ele a ficha
  -- vira papel digitalizado, que é justamente o que já não funcionava.
  hodometro int not null check (hodometro > 0),
  -- Preenchida só quando o número contraria o último conhecido. O caso real:
  -- a planilha trazia o Doblo com 136.172 atual contra troca de óleo em
  -- 272.257, e a importação recusou o dado (importar-frota-manutencao.mjs:16).
  hodometro_justificativa text,
  resultado text not null default 'liberado'
    check (resultado in ('liberado','com_ressalvas','nao_liberado')),
  anomalias text,
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users(id) on delete set null,
  -- UM CARRO, UM DIA, UMA FICHA (D12). Inspecionar o mesmo pneu duas vezes no
  -- mesmo dia não descobre nada, e pedir isso é o caminho mais curto pra
  -- pessoa parar de olhar.
  unique (veiculo_id, feita_em)
);
create index if not exists idx_frota_checklist_data
  on public.frota_checklist(feita_em desc, veiculo_id);

create table if not exists public.frota_checklist_respostas(
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.frota_checklist(id) on delete cascade,
  item_id uuid references public.frota_checklist_itens(id) on delete set null,
  -- CONGELADOS (D13): ficha preenchida é documento. Se o gestor renomear o item
  -- daqui a três meses, a ficha de hoje tem de continuar dizendo o que foi
  -- realmente perguntado hoje — senão o registro passa a mentir sobre o passado
  -- toda vez que a lista muda.
  item_texto text not null,
  cadencia text not null,
  estado text not null check (estado in ('ok','nao_ok','na')),
  observacao text
);
create index if not exists idx_frota_resp_ficha
  on public.frota_checklist_respostas(checklist_id);

-- ── Os 21 itens do PDF, na repartição proposta (D10) ───────────────────────
-- Fonte: checklist_manutencao_primeiro_escalao.pdf.
-- O critério da repartição é ESFORÇO: o diário é o que a pessoa percebe sem
-- esforço nenhum dando a volta no carro. Pedir 21 itens toda manhã produz, em
-- duas semanas, alguém marcando tudo OK sem olhar — e checklist que mente é
-- pior do que checklist nenhum.
insert into public.frota_checklist_itens(ordem, item, cadencia) values
  (1,  'Painel — luzes de advertência',          'diario'),
  (2,  'Vazamentos sob o veículo',               'diario'),
  (3,  'Estado geral dos pneus',                 'diario'),
  (4,  'Limpeza e condições gerais do veículo',  'diario'),
  (10, 'Faróis',                                 'semanal'),
  (11, 'Lanternas',                              'semanal'),
  (12, 'Luzes de freio',                         'semanal'),
  (13, 'Setas / indicadores de direção',         'semanal'),
  (14, 'Buzina',                                 'semanal'),
  (15, 'Limpadores e lavador do para-brisa',     'semanal'),
  (16, 'Retrovisores',                           'semanal'),
  (17, 'Freio de estacionamento',                'semanal'),
  (18, 'Cintos de segurança',                    'semanal'),
  (19, 'Calibragem dos pneus',                   'semanal'),
  (20, 'Nível da água do limpador',              'semanal'),
  (30, 'Nível do óleo do motor',                 'mensal'),
  (31, 'Nível do líquido de arrefecimento',      'mensal'),
  (32, 'Nível do fluido de freio',               'mensal'),
  (33, 'Condição do estepe',                     'mensal'),
  (34, 'Macaco, chave de roda e triângulo',      'mensal'),
  (35, 'Extintor, quando aplicável',             'mensal')
on conflict (item) do nothing;

-- ── Quem pode ler e escrever ───────────────────────────────────────────────
-- Mesmo desenho das migrations 022–027: is_frota_admin() é a porta.
--
-- LIMITAÇÃO CONHECIDA, dita por extenso: is_frota_admin() é verdadeiro pra
-- QUALQUER pessoa com a chave 'frota', sem distinguir ação. A separação entre
-- "quem dirige" e "quem administra" vive no front (areasVisiveis), não aqui —
-- é assim no módulo inteiro desde a 022. Na prática: alguém com acesso à Frota
-- consegue, pela API, editar a lista de itens. Não é regressão, é o estado
-- atual do módulo, e está anotado pra não parecer garantia que não existe.
alter table public.frota_checklist_itens     enable row level security;
alter table public.frota_checklist_config    enable row level security;
alter table public.frota_checklist           enable row level security;
alter table public.frota_checklist_respostas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['frota_checklist_itens','frota_checklist_config',
                           'frota_checklist','frota_checklist_respostas'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_ler') then
      execute format('create policy %I on public.%I for select using (public.is_frota_admin())',
                     t || '_ler', t);
    end if;
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_escrever') then
      execute format('create policy %I on public.%I for all using (public.is_frota_admin()) '
                     || 'with check (public.is_frota_admin())', t || '_escrever', t);
    end if;
  end loop;
end $$;
