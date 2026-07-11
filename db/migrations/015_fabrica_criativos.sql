-- 015_fabrica_criativos.sql — F2a: campanhas de desconto + criativos gerados.
CREATE TABLE IF NOT EXISTS public.fabrica_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  desconto_tipo text NOT NULL DEFAULT 'fixo',
  desconto_pct numeric,
  parcelas int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fabrica_criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.fabrica_campanhas (id) ON DELETE CASCADE,
  candidato_id uuid REFERENCES public.fabrica_candidatos (id) ON DELETE CASCADE,
  arquetipo text NOT NULL,
  template text NOT NULL,
  formato text NOT NULL,
  variante text,
  preco_de numeric,
  preco_por numeric,
  storage_path text,
  url text,
  escolhido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fab_criativos_campanha ON public.fabrica_criativos (campanha_id);
CREATE INDEX IF NOT EXISTS idx_fab_criativos_candidato ON public.fabrica_criativos (candidato_id);

ALTER TABLE public.fabrica_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_criativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fab_camp_read ON public.fabrica_campanhas;
CREATE POLICY fab_camp_read ON public.fabrica_campanhas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_criativos_read ON public.fabrica_criativos;
CREATE POLICY fab_criativos_read ON public.fabrica_criativos FOR SELECT TO authenticated USING (true);

-- escrita: admin OU permissão meta.fabrica (mesmo gate da F1)
DROP POLICY IF EXISTS fab_camp_write ON public.fabrica_campanhas;
CREATE POLICY fab_camp_write ON public.fabrica_campanhas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')));
DROP POLICY IF EXISTS fab_criativos_write ON public.fabrica_criativos;
CREATE POLICY fab_criativos_write ON public.fabrica_criativos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role='admin' OR p.is_superadmin=true OR p.permissions ? 'meta.fabrica')));

DROP POLICY IF EXISTS fab_camp_srv ON public.fabrica_campanhas;
CREATE POLICY fab_camp_srv ON public.fabrica_campanhas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_criativos_srv ON public.fabrica_criativos;
CREATE POLICY fab_criativos_srv ON public.fabrica_criativos FOR ALL USING (auth.role() = 'service_role');
