-- docs/migrations/2026-07-02-campaign-insights-actions.sql
-- Contagens de interação por campanha × período (do array Meta `actions`), pro
-- cálculo dos KPIs de custo (custo por interação/curtida/etc.) no dashboard social.
-- Nullable: snapshots antigos ficam sem dado (forward-only). Sem mudança de RLS.

alter table public.campaign_insights add column if not exists post_engagement integer;
alter table public.campaign_insights add column if not exists likes integer;
alter table public.campaign_insights add column if not exists comments integer;
alter table public.campaign_insights add column if not exists shares integer;
alter table public.campaign_insights add column if not exists saves integer;
