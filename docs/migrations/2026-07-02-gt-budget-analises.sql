-- docs/migrations/2026-07-02-gt-budget-analises.sql
-- Sugestões de budget geradas pelo robô semanal (Opus 4.8) por campanha.
-- Leitura liberada pra quem tem a ferramenta Gestão de Tráfego (espelha
-- hasPermission('module:meta:gestor') -> feature 'meta.gestor'; admin sempre).
-- Escrita: NENHUMA policy -> só o service role (que ignora RLS) grava.

create table if not exists public.gt_budget_analises (
  campaign_id            text primary key,
  account_id             text not null,
  objetivo               text,
  effective_status       text,
  budget_atual_centavos  integer,
  budget_sugerido_centavos integer,
  veredito               text,
  justificativa          text,
  impacto_estimado       text,
  modelo                 text not null default 'opus-4-8',
  gerado_em              timestamptz not null default now(),
  valida_ate             timestamptz
);

alter table public.gt_budget_analises enable row level security;

-- leitura só pra quem tem a ferramenta (admin OU feature meta.gestor)
drop policy if exists gt_budget_read on public.gt_budget_analises;
create policy gt_budget_read on public.gt_budget_analises
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  );
-- sem policy de insert/update/delete: a tela nunca escreve; só o service role.
