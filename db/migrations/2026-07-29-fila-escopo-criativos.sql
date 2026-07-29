-- A fila passa a tratar DUAS perguntas sobre a mesma campanha
--
-- Até aqui a fila só perguntava sobre orçamento. Agora o robô também diz quais
-- CRIATIVOS não estão tendo tração (gt_ad_analises, veredito 'pausar'), e essa
-- lista aparece agrupada dentro da linha da campanha — 25 anúncios em 6
-- campanhas quando isto foi escrito, sendo 16 numa só.
--
-- POR QUE A COLUNA: pausar os criativos NÃO responde se o orçamento deve subir.
-- São decisões independentes na mesma campanha. Sem separar, gravar uma faria a
-- outra sumir da fila (`jaRespondida` em fila.js casa por campaign_id), e o dono
-- perderia a pergunta que ainda não respondeu.

alter table public.gt_fila_decisoes
  add column if not exists escopo text not null default 'orcamento'
  check (escopo in ('orcamento', 'criativos'));

comment on column public.gt_fila_decisoes.escopo is
  'SOBRE O QUE foi a decisao. "orcamento" responde a sugestao de verba da campanha; "criativos" responde aos anuncios fracos dela.';

create index if not exists gt_fila_decisoes_escopo_idx
  on public.gt_fila_decisoes (campaign_id, escopo, decidido_em desc);
