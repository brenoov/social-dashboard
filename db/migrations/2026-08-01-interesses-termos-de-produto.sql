-- Sugestão de interesses — os produtos da marca deixam de depender da memória da IA
--
-- POR QUE ESTA MIGRATION EXISTE: na rodada real de 2026-07-31, `Cinto` ficou em
-- ZERO dos seis objetivos. Cinto é a MAIOR categoria do estoque da La Vessel
-- (398 peças, mais que qualquer tipo de bolsa). A causa não é o catálogo do Meta
-- — `cinto` acha `Cinto` (37,1 mi), medido pela sonda. A causa é que a IA
-- simplesmente não se lembrou de pedir `cinto` naquela rodada. Numa medição
-- anterior ela pediu em 2 dos 6; é sorteio.
--
-- Produto que a loja vende não pode depender de sorteio. Estes termos passam a
-- ser buscados SEMPRE, e a IA fica com o que ela faz bem: o assunto que varia
-- por objetivo.
--
-- POR QUE UMA COLUNA E NÃO DEDUZIR DE `segmento`: deduzir exigiria adivinhar o
-- singular em português, e a primeira palavra que quebra é justamente uma das
-- nossas — "óculos" no singular é "óculos", não "óculo". Regra de plural erra
-- calado; coluna curada não erra.
--
-- CADA TERMO AQUI FOI MEDIDO pela sonda (coletor/sondar-interesses.mjs) em
-- 2026-07-31, e todos acham entrada de verdade no catálogo:
--   bolsa → Bolsas (acessórios) 486 mi · cinto → Cinto 37 mi
--   carteira → Carteira (acessórios) 64 mi · óculos → Óculos de sol 435 mi
--   mochila → Mochila 95 mi · clutch → Clutch 18 mi
--   acessórios → Acessórios de moda 1,15 bi
-- Fora de propósito: `porta-cartões`, medido e VAZIO. Não se gasta busca com o
-- que já se sabe que não existe.
--
-- SUBSTANTIVO PELADO, SEMPRE. Qualificador mata a busca ("bolsa feminina" → nada).
-- Quem for preencher isto para uma marca nova: rode a sonda antes.

alter table public.fabrica_marcas
  add column if not exists termos_produto text[] not null default '{}';

comment on column public.fabrica_marcas.termos_produto is
  'Termos de busca do catálogo do Meta para os produtos que a marca vende. Substantivo PELADO e no singular — qualificador ("bolsa feminina") volta vazio. Buscados SEMPRE, além dos que a IA propõe. Medir com coletor/sondar-interesses.mjs antes de preencher.';

-- Nasce VAZIO para todo mundo: marca nova não herda o catálogo de ninguém, e
-- vazio simplesmente volta ao comportamento de antes (só os termos da IA).
update public.fabrica_marcas
   set termos_produto = array['bolsa','cinto','carteira','óculos','mochila','clutch','acessórios']
 where nome = 'La Vessel';
