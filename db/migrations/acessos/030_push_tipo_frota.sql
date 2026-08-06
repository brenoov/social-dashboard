-- Frota F6c: solta o CHECK de push_preferencias.tipo pra aceitar 'frota'.
-- Desenho: docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md
--
-- POR QUE ESTA MIGRATION EXISTE: a Tarefa 11 acrescentou o tipo 'frota' ao
-- array TIPOS_DE_NOTIFICACAO em supabase/functions/_shared/notificacoes.js —
-- o que já basta pra "Checklist do carro" aparecer sozinho na tela
-- Administração › Usuários (ela lê o array direto, sem cópia). Mas sem esta
-- migration o CHECK antigo (só 'vendas','saldo','conteudo') barra o INSERT: o
-- dono clica pra ligar o aviso e leva um erro de restrição do Postgres na
-- cara, sem nada na mensagem que aponte pra cá. Já aconteceu antes com
-- 'conteudo' (ver db/migrations/2026-07-30-conteudo-04-hora-h.sql, seção 1) —
-- mesmo defeito, tipo novo diferente.
--
-- Conferido ANTES de escrever esta migration (não suposto): hoje a tabela só
-- tem linhas de 'conteudo' (4), 'saldo' (13) e 'vendas' (13) — nenhuma linha
-- 'frota', então ampliar a lista não pode violar dado nenhum já gravado.
--   node coletor/consultar.mjs "select tipo, count(*) from public.push_preferencias group by tipo order by tipo"

alter table public.push_preferencias drop constraint if exists push_preferencias_tipo_check;
alter table public.push_preferencias add constraint push_preferencias_tipo_check
  check (tipo in ('vendas', 'saldo', 'conteudo', 'frota'));
