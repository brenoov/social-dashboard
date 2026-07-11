-- 016_fabrica_meta_jobs.sql — F3: rastro do que foi subido no Meta.
CREATE TABLE IF NOT EXISTS public.fabrica_meta_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid,
  ad_account_id text,
  loja text,
  tipo text,
  meta_campaign_id text,
  adset_ids jsonb,
  ad_ids jsonb,
  payload jsonb,
  status text NOT NULL DEFAULT 'criado',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_meta_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_meta_read ON public.fabrica_meta_jobs;
CREATE POLICY fab_meta_read ON public.fabrica_meta_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_meta_srv ON public.fabrica_meta_jobs;
CREATE POLICY fab_meta_srv ON public.fabrica_meta_jobs FOR ALL USING (auth.role() = 'service_role');
