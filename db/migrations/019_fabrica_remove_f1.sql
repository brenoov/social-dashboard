-- 019_fabrica_remove_f1.sql — aposenta a F1: candidatos/rodadas não são mais usados (modo lista).
ALTER TABLE public.fabrica_criativos DROP COLUMN IF EXISTS candidato_id;  -- remove a FK -> fabrica_candidatos
DROP TABLE IF EXISTS public.fabrica_candidatos;                            -- CASCADE das policies
DROP TABLE IF EXISTS public.fabrica_rodadas;
