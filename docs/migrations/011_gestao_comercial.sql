-- docs/migrations/011_gestao_comercial.sql
-- Agente Gestor Comercial: briefings semanais + log de bordo.

CREATE TABLE IF NOT EXISTS public.gestao_comercial_briefings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada      date NOT NULL DEFAULT current_date,
  periodo     text,
  resumo      text,
  conteudo    text NOT NULL,
  dados_json  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcb_rodada ON public.gestao_comercial_briefings (rodada DESC);
ALTER TABLE public.gestao_comercial_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gcb_select ON public.gestao_comercial_briefings;
CREATE POLICY gcb_select ON public.gestao_comercial_briefings
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gestor_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at      timestamptz NOT NULL DEFAULT now(),
  fase        text,
  erro        text,
  detalhe     text
);
CREATE INDEX IF NOT EXISTS idx_gestor_log_run_at ON public.gestor_log (run_at DESC);
ALTER TABLE public.gestor_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gestor_log_select ON public.gestor_log;
CREATE POLICY gestor_log_select ON public.gestor_log
  FOR SELECT TO authenticated USING (true);
