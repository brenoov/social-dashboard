-- Sugestões de interesse por marca × objetivo, geradas pelo robô semanal
-- coletor/sugerir-interesses.mjs.
--
-- COMO O DADO CHEGA AQUI: a IA propõe nomes de interesse, e a PRÓPRIA META
-- valida cada um (/search?type=adinterestvalid). O que ela não reconhece é
-- descartado antes de virar linha nesta tabela. Por isso `itens` só contém
-- interesse que existe de verdade, com o id que a Meta devolveu.
--
-- Sem essa etapa a tela mostraria sugestões bonitas que dariam erro na hora de
-- usar — pior que não sugerir nada, porque parece funcionar até o momento em
-- que importa.
--
-- O DONO NÃO EDITA ESTA TABELA pela tela: se a sugestão está ruim, quem muda é
-- o robô (o pedido que ele faz à IA). Por isso a escrita é só service_role.
create table if not exists interesses_sugeridos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references fabrica_marcas(id) on delete cascade,
  objetivo text not null,                    -- chave de ALVOS (src/ferramentas/gestao-trafego/alvos.js)
  itens jsonb not null default '[]'::jsonb,  -- [{id, nome, audience_size}] JÁ validados na Meta
  -- Propostos x válidos medem o aproveitamento da validação. Se a taxa vier
  -- baixa, o pedido feito à IA precisa de ajuste — e dá pra ver isso sem abrir
  -- o log do robô.
  propostos int not null default 0,
  validos int not null default 0,
  modelo text,
  gerado_em timestamptz not null default now(),
  -- Uma linha por marca × objetivo: o robô sobrescreve a cada rodada em vez de
  -- acumular histórico. Sugestão velha não tem valor — o que vale é a última.
  unique (marca_id, objetivo)
);

alter table interesses_sugeridos enable row level security;

drop policy if exists int_sug_read on interesses_sugeridos;
create policy int_sug_read on interesses_sugeridos for select to authenticated using (true);
-- escrita só service_role (sem policy de write p/ authenticated => negado),
-- mesmo padrão de fabrica_publicos.
