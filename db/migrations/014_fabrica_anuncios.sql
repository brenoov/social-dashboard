-- 014_fabrica_anuncios.sql
-- Fábrica de Anúncios — F1: tabelas de candidatos extraídos do briefing do Gestor.
-- Idempotente. RLS: authenticated lê; escreve quem for admin OU tiver meta.fabrica; service_role total.

-- ── Lojas (lookup por depósito Bling; extensível) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_lojas (
  deposito_id text PRIMARY KEY,
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  ordem       int NOT NULL DEFAULT 0
);

INSERT INTO public.fabrica_lojas (deposito_id, nome, ativo, ordem) VALUES
  ('14888726315', 'Tivoli (Santa Bárbara)', true,  1),
  ('14888617206', 'Shopping Dom Pedro',     true,  2),
  ('14888248253', 'Atacado Nuvem Shop',     false, 3)
ON CONFLICT (deposito_id) DO UPDATE SET nome = EXCLUDED.nome, ativo = EXCLUDED.ativo, ordem = EXCLUDED.ordem;

-- ── Rodadas (uma por briefing processado) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_rodadas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada      date NOT NULL,
  periodo     text,
  briefing_id uuid,
  status      text NOT NULL DEFAULT 'rascunho',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fab_rodadas_rodada ON public.fabrica_rodadas (rodada DESC);

-- ── Candidatos (produto × loja) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_candidatos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada_id    uuid NOT NULL REFERENCES public.fabrica_rodadas (id) ON DELETE CASCADE,
  sku          text,
  nome         text NOT NULL,
  categoria    text,
  fonte        text NOT NULL,
  angulo       text,
  preco        numeric,
  deposito_id  text NOT NULL REFERENCES public.fabrica_lojas (deposito_id),
  loja_nome    text NOT NULL,
  estoque      int NOT NULL DEFAULT 0,
  selecionado  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodada_id, sku, deposito_id)
);
CREATE INDEX IF NOT EXISTS idx_fab_cand_rodada ON public.fabrica_candidatos (rodada_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.fabrica_lojas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_rodadas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_candidatos ENABLE ROW LEVEL SECURITY;

-- helper de gate de escrita: admin OU permissão meta.fabrica
-- (profiles.permissions é jsonb objeto recurso->ações; '? chave' = a chave existe)
DROP POLICY IF EXISTS fab_lojas_read ON public.fabrica_lojas;
CREATE POLICY fab_lojas_read ON public.fabrica_lojas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_rodadas_read ON public.fabrica_rodadas;
CREATE POLICY fab_rodadas_read ON public.fabrica_rodadas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_cand_read ON public.fabrica_candidatos;
CREATE POLICY fab_cand_read ON public.fabrica_candidatos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_cand_update ON public.fabrica_candidatos;
CREATE POLICY fab_cand_update ON public.fabrica_candidatos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND (p.role = 'admin' OR p.is_superadmin = true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND (p.role = 'admin' OR p.is_superadmin = true OR p.permissions ? 'meta.fabrica')));

-- service_role total (o job do coletor grava com service key)
DROP POLICY IF EXISTS fab_lojas_srv ON public.fabrica_lojas;
CREATE POLICY fab_lojas_srv ON public.fabrica_lojas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_rodadas_srv ON public.fabrica_rodadas;
CREATE POLICY fab_rodadas_srv ON public.fabrica_rodadas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_cand_srv ON public.fabrica_candidatos;
CREATE POLICY fab_cand_srv ON public.fabrica_candidatos FOR ALL USING (auth.role() = 'service_role');

-- ── Pré-concessão da permissão nova aos admins (chave nova = pré-conceder) ──
UPDATE public.profiles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{meta.fabrica}', '["ver","editar"]'::jsonb, true)
WHERE role = 'admin';
