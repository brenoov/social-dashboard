-- Central de Conteúdo — a ideia vira um roteiro que dá para gravar
--
-- O QUE MUDA: antes a ideia era um título, um gancho e uma lista de falas.
-- Isso responde "o que postar" e deixa "como gravar" por conta de quem grava.
-- Agora cada ideia carrega o roteiro inteiro: os 3 primeiros segundos, take a
-- take (o que aparece na tela E o que se fala), o texto que entra na arte, a
-- chamada final e o que precisa estar em mãos antes de começar.
--
-- `roteiro` já é jsonb, então o formato de cada item muda sem migration. O que
-- entra aqui são os campos que não cabiam dentro dele.
--
-- FORMATO DE CADA ITEM DE `roteiro` (a partir de agora):
--   { cena: 1, imagem: "o que aparece na tela", narracao: "o que falar",
--     texto_na_tela: "o que aparece escrito", duracao_s: 4 }
-- Itens antigos usam `fala` em vez de `narracao`. A tela lê os dois — apagar o
-- histórico para padronizar sairia mais caro que uma linha de `||`.

alter table public.conteudo_ideias
  -- A chamada para ação do fim. Separada da legenda porque é a parte que mais
  -- se reescreve e a que decide se o post converte.
  add column if not exists cta text,
  -- O que precisa estar em mãos antes de gravar: lugar, objetos, roupa, pessoa.
  -- É o que transforma "boa ideia" em "dá para fazer hoje".
  add column if not exists producao text,
  -- Por que ESTE formato e não outro. Obriga o modelo a justificar a escolha em
  -- vez de sortear, e ensina quem lê.
  add column if not exists porque_formato text;

comment on column public.conteudo_ideias.roteiro is
  'Passo a passo ordenado. Em reels/stories cada item e um take; em carrossel, um card; em feed, a unica imagem. Item: {cena, imagem, narracao, texto_na_tela, duracao_s}. Itens antigos usam `fala` no lugar de `narracao`.';
