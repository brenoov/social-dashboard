-- Sugestões de interesse por marca × objetivo, geradas pelo robô semanal
-- coletor/sugerir-interesses.mjs.
--
-- COMO O DADO CHEGA AQUI: a IA dá ASSUNTOS (termos de busca) e o robô busca
-- cada assunto no catálogo da Meta (/search?type=adinterest), colhendo os
-- interesses que voltam. Por isso `itens` só contém interesse que existe de
-- verdade, com o id que a Meta devolveu — nome escrito pela IA não chega aqui.
--
-- O ESTRUTURAL: nome de interesse nunca vem do modelo. Se viesse, a tela
-- mostraria sugestão bonita que dá erro na hora de usar — pior que não sugerir
-- nada, porque parece funcionar até o momento em que importa.
--
-- (Só o COMENTÁRIO mudou depois de aplicada, não o esquema: a primeira versão
-- pedia o nome exato à IA e validava com type=adinterestvalid. Rendia 15%, e a
-- busca substituiu a validação. As colunas continuam as mesmas.)
--
-- O DONO NÃO EDITA ESTA TABELA pela tela: se a sugestão está ruim, quem muda é
-- o robô (o pedido que ele faz à IA). Por isso a escrita é só service_role.
create table if not exists interesses_sugeridos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references fabrica_marcas(id) on delete cascade,
  objetivo text not null,                    -- chave de ALVOS (src/ferramentas/gestao-trafego/alvos.js)
  itens jsonb not null default '[]'::jsonb,  -- [{id, nome, audience_size}] vindos do catálogo da Meta, no máximo 12, maior público primeiro
  -- Quanto a rodada rendeu: `propostos` são os TERMOS que a IA deu, `validos`
  -- são os interesses que as buscas acharam e ficaram na linha. Mais de um
  -- interesse por termo é normal — não é uma taxa de sobrevivência.
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
