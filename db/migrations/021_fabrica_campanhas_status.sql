-- 021_fabrica_campanhas_status.sql — SP-2: rodada vira "coisa" com status (criada no disparo).
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'gerando';
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users (id);
-- Rodadas antigas já terminaram de gerar há tempos: marca 'pronta' (as publicadas têm fechada_em e
-- ficam fora de "em criação" de qualquer forma). Novas nascem 'gerando' (default, setado no trigger).
UPDATE public.fabrica_campanhas SET status = 'pronta' WHERE status = 'gerando';
