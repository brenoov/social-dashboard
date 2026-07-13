-- db/migrations/025_ia_execucoes.sql
-- Painel de Status do Claude: diário de bordo unificado de toda execução de IA/robô.
-- Uma linha por execução (não por chamada LLM) com custo real, tokens, tempo e volume.
-- Ações "custo zero" (ex.: subir campanha sem Anthropic) entram com usd=0.

CREATE TABLE IF NOT EXISTS public.ia_execucoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        timestamptz NOT NULL DEFAULT now(),
  robo          text NOT NULL,          -- slug: gestor-comercial | budget-ia | coletor-noticias | panorama | fabrica-gerar | fabrica-subir | fabrica-ativar | status-projetos
  acao          text NOT NULL,          -- legível: "briefing semanal", "gerar criativos"
  modelo        text,                   -- claude-opus-4-8 | claude-sonnet-4-6 | null (custo zero)
  input_tokens  bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  chamadas      int NOT NULL DEFAULT 0,
  usd           numeric(10,4) NOT NULL DEFAULT 0,  -- custo real; 0 => "custo zero"
  duracao_ms    bigint,
  itens         int,                    -- volume produzido (criativos, briefings, campanhas, notícias)
  unidade       text,                   -- rótulo do volume
  status        text NOT NULL DEFAULT 'ok',  -- ok | erro | parcial
  detalhe       text,
  github_run_id text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_exec_run_at ON public.ia_execucoes (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_exec_robo   ON public.ia_execucoes (robo, run_at DESC);

ALTER TABLE public.ia_execucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ia_exec_select ON public.ia_execucoes;
CREATE POLICY ia_exec_select ON public.ia_execucoes
  FOR SELECT TO authenticated USING (true);
