-- db/migrations/026_projetos_status.sql
-- Painel de Status do Claude: status de desenvolvimento dos projetos, derivado
-- automaticamente dos planos markdown em docs/superpowers/plans/ (parser status-projetos.mjs).

CREATE TABLE IF NOT EXISTS public.projetos_status (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto           text NOT NULL UNIQUE,   -- slug (chave do UPSERT)
  titulo            text NOT NULL,
  etapa             text,                   -- ex.: F2a, SP6
  descricao         text,                   -- resumo "em que pé está"
  situacao          text NOT NULL DEFAULT 'planejado',  -- planejado | em-andamento | no-ar | pausado
  progresso         int NOT NULL DEFAULT 0, -- 0..100 (% de checkboxes marcados)
  checkboxes_feitos int,
  checkboxes_total  int,
  plano_arquivo     text,                   -- caminho do .md mais recente
  ordem             int NOT NULL DEFAULT 0,
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projstatus_ordem ON public.projetos_status (ordem, atualizado_em DESC);

ALTER TABLE public.projetos_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projetos_status_select ON public.projetos_status;
CREATE POLICY projetos_status_select ON public.projetos_status
  FOR SELECT TO authenticated USING (true);
