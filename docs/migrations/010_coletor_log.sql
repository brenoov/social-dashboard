-- docs/migrations/010_coletor_log.sql
-- Diário de bordo do coletor de notícias na nuvem: o agente grava aqui o
-- início e o fim de cada rodada (e erros), pra dar observabilidade remota
-- sem depender do painel do claude.ai.

CREATE TABLE IF NOT EXISTS public.coletor_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at      timestamptz NOT NULL DEFAULT now(),
  fase        text,        -- 'inicio' | 'fim'
  encontradas int,         -- quantas notícias o agente achou
  inseridas   int,         -- quantas gravou (após dedup)
  erro        text,        -- mensagem de erro, se houve
  detalhe     text         -- texto livre (rodada, resumo por marca, etc.)
);

CREATE INDEX IF NOT EXISTS idx_coletor_log_run_at ON public.coletor_log (run_at DESC);

ALTER TABLE public.coletor_log ENABLE ROW LEVEL SECURITY;
-- service_role (o agente) ignora RLS e grava; authenticated pode ler.
DROP POLICY IF EXISTS coletor_log_select ON public.coletor_log;
CREATE POLICY coletor_log_select ON public.coletor_log
  FOR SELECT TO authenticated USING (true);
