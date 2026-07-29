-- FILA DE APROVAÇÃO: o registro de quem decidiu o que, e quando.
--
-- POR QUE UMA TABELA SEPARADA de gt_budget_analises: o robô faz UPSERT por
-- campanha toda madrugada. Guardar a decisão na mesma linha faria a rodada
-- seguinte apagar a resposta do dono — inclusive o silêncio de uma recusa, que
-- passaria a durar algumas horas em vez de sete dias.
--
-- Aqui cada decisão é uma LINHA NOVA, nunca um update. O histórico é o ponto:
-- é o que responde "quem mandou subir o orçamento dessa campanha em julho?".

create table if not exists public.gt_fila_decisoes (
  id             bigserial primary key,
  campaign_id    text not null,
  account_id     text,
  -- Que sugestão estava na mesa quando ele decidiu. Guardado por valor (e não
  -- por referência a gt_budget_analises) justamente porque aquela linha some no
  -- upsert de amanhã — sem isto o histórico viraria um ponteiro quebrado.
  veredito       text not null,
  budget_atual_centavos    integer,
  budget_sugerido_centavos integer,
  analise_gerada_em        timestamptz,

  decisao        text not null check (decisao in ('aprovada', 'recusada')),
  decidido_em    timestamptz not null default now(),
  decidido_por   uuid,
  -- Recusa cala a campanha até esta data (7 dias, ver DIAS_DE_SILENCIO em
  -- fila.js). Nulo em aprovação.
  silenciar_ate  timestamptz,
  -- O que foi REALMENTE aplicado na Meta. Em campanha ABO uma aprovação vira
  -- várias escritas, uma por conjunto — este campo guarda a quebra que saiu,
  -- não a que foi calculada, pra auditoria bater com a Meta.
  aplicado       jsonb not null default '[]'::jsonb,
  erro           text
);

-- A leitura da fila cruza análise × última decisão por campanha.
create index if not exists gt_fila_decisoes_campanha_idx
  on public.gt_fila_decisoes (campaign_id, decidido_em desc);
-- "O que está silenciado agora?" — só as recusas têm data de silêncio.
create index if not exists gt_fila_decisoes_silencio_idx
  on public.gt_fila_decisoes (silenciar_ate)
  where silenciar_ate is not null;

comment on table public.gt_fila_decisoes is
  'Fila de aprovação da Gestão de Tráfego: cada linha é uma decisão do dono '
  'sobre uma sugestão do robô. Append-only — nunca dar update, o histórico é o produto.';

alter table public.gt_fila_decisoes enable row level security;

-- Mesmo critério de gt_ponderada_config e gt_config_metricas: mexer em verba é
-- ação de quem tem permissão de EDITAR nesta ferramenta, não privilégio de admin.
-- Forma copiada de gt_ponderada_config/gt_config_metricas: EXISTS em `profiles`
-- (não `users`), com role='admin' OU 'meta.gestor' nas features. Inventar outro
-- critério aqui deixaria a fila visível pra quem não pode agir nela — ou o
-- contrário.
create policy gt_fila_decisoes_leitura on public.gt_fila_decisoes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  );

create policy gt_fila_decisoes_insercao on public.gt_fila_decisoes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
    -- Ninguém assina decisão no nome de outro.
    and decidido_por = auth.uid()
  );

-- SEM policy de update/delete de propósito: a tabela é append-only. Corrigir uma
-- decisão é tomar outra, não reescrever a que já foi tomada.
