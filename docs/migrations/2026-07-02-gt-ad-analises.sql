-- docs/migrations/2026-07-02-gt-ad-analises.sql
-- Análise por anúncio gerada pelo robô semanal (Opus). Espelha o RLS de gt_budget_analises:
-- leitura só admin/meta.gestor; escrita só service role (sem policy de write).
create table if not exists public.gt_ad_analises (
  ad_id         text primary key,
  campaign_id   text,
  account_id    text,
  veredito      text,
  justificativa text,
  modelo        text not null default 'opus-4-8',
  gerado_em     timestamptz not null default now(),
  valida_ate    timestamptz
);
alter table public.gt_ad_analises enable row level security;
drop policy if exists gt_ad_read on public.gt_ad_analises;
create policy gt_ad_read on public.gt_ad_analises
  for select using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and (p.role='admin' or 'meta.gestor' = any(p.features)))
  );
