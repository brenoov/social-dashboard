-- 020_fabrica_criativos_legenda.sql — legenda (message do anúncio) por criativo, gerada por IA no gerar.
ALTER TABLE public.fabrica_criativos ADD COLUMN IF NOT EXISTS legenda text;
