-- O que a marca VENDE, em uma frase, para quem precisa desse contexto.
--
-- POR QUE EXISTE: o robô sugerir-interesses pedia interesses de segmentação
-- passando à IA apenas o NOME da marca ("La Vessel"). Ela deduzia "loja de moda
-- feminina" e devolvia termos genéricos — "looks do dia", "influencer moda",
-- "estilo pessoal". Medido em rodada real: os seis objetivos traziam quase a
-- mesma lista, e o interesse "Bolsas" (2,3 mi de pessoas) aparecia por acaso e
-- sumia na rodada seguinte.
--
-- O projeto SABIA o que a marca vende — está no estoque (gc_estoque_item) e até
-- no nome que a Fábrica dá às campanhas ("Bolsas · loja · objetivo"). A IA é que
-- nunca recebeu essa informação.
--
-- Escreva em português corrente, do jeito que você explicaria a loja para uma
-- pessoa: os TIPOS DE PRODUTO na frente, porque é isso que vira termo de busca
-- na Meta. Sem jargão de marketing, sem adjetivo de propaganda.
alter table fabrica_marcas
  add column if not exists segmento text;

comment on column fabrica_marcas.segmento is
  'O que a marca vende, em uma frase e em português corrente (ex.: "bolsas femininas, cintos, carteiras e óculos de sol"). Alimenta o pedido do robô sugerir-interesses. Vazio = a IA volta a adivinhar pelo nome, que foi o problema que esta coluna resolve.';
