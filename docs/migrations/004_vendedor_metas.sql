-- docs/migrations/004_vendedor_metas.sql
-- Colar no Supabase Dashboard → SQL Editor → New query → Run
CREATE TABLE IF NOT EXISTS public.bling_vendedor_metas (
  vendor_id   bigint  NOT NULL,
  year        int     NOT NULL,
  month       int     NOT NULL,
  meta_valor  numeric,
  daily_goals jsonb,
  PRIMARY KEY (vendor_id, year, month)
);
