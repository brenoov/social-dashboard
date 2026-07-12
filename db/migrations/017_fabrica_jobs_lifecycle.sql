-- 017_fabrica_jobs_lifecycle.sql — F2a.3 (fila de jobs da UI Estúdio) + lifecycle/purga do Storage.
-- fabrica_jobs: status voltado pra UI (enfileirado→rodando→concluido/erro).
CREATE TABLE IF NOT EXISTS public.fabrica_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                       -- 'gerar' | 'subir'
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'enfileirado',-- 'enfileirado'|'rodando'|'concluido'|'erro'
  github_run_id text,
  resultado jsonb,
  erro text,
  criado_por uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_jobs_read ON public.fabrica_jobs;
CREATE POLICY fab_jobs_read ON public.fabrica_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_jobs_srv ON public.fabrica_jobs;
CREATE POLICY fab_jobs_srv ON public.fabrica_jobs FOR ALL USING (auth.role() = 'service_role');

-- lifecycle: rodada (fabrica_campanhas) fecha quando o subir conclui 100%; purga marca purgado_em.
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS fechada_em timestamptz;
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS purgado_em timestamptz;
ALTER TABLE public.fabrica_criativos ADD COLUMN IF NOT EXISTS purgado_em timestamptz;
