-- 018_fabrica_marcas_lojas.sql — fundação multi-marca/multi-loja: config que era hardcoded vira dado.
CREATE TABLE IF NOT EXISTS public.fabrica_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  caption_template text NOT NULL DEFAULT '{desconto} em bolsas {marca} · chame a gente 💬',
  ad_account text NOT NULL,
  page_id text NOT NULL,
  ig_id text NOT NULL,
  account_id text NOT NULL,           -- accountId do meta-proxy
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_marcas_read ON public.fabrica_marcas;
CREATE POLICY fab_marcas_read ON public.fabrica_marcas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_marcas_srv ON public.fabrica_marcas;
CREATE POLICY fab_marcas_srv ON public.fabrica_marcas FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS marca_id uuid REFERENCES public.fabrica_marcas(id);
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS geo_cities jsonb;
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS canal_loja_id text;

-- Seed: marca atual (nome usado nas legendas) + IDs reais.
INSERT INTO public.fabrica_marcas (nome, ad_account, page_id, ig_id, account_id)
SELECT 'La Vessel', 'act_1197997517858139', '324679337390168', '17841462952561833', 'b6883e82-07cb-4f21-9fd7-ea7626786174'
WHERE NOT EXISTS (SELECT 1 FROM public.fabrica_marcas);

-- Vincula as lojas existentes à marca + preenche config de loja.
UPDATE public.fabrica_lojas l SET
  marca_id = (SELECT id FROM public.fabrica_marcas ORDER BY created_at LIMIT 1),
  whatsapp = v.whatsapp, geo_cities = v.geo::jsonb, canal_loja_id = v.canal
FROM (VALUES
  ('14888726315', '+5519971690502', '[267873,241913]', '205834140'),
  ('14888617206', '+5519999545112', '[247071]',        '205657609')
) AS v(deposito_id, whatsapp, geo, canal)
WHERE l.deposito_id = v.deposito_id;
