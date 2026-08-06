-- Frota F7a (revisão de código): trg_frota_resposta_imutavel também trava INSERT.
-- Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
--
-- POR QUE ESTA MIGRATION EXISTE: a 032 criou o gatilho como
-- `before update or delete`, esquecendo o insert. Resultado provado pelo
-- revisor: com uma ficha JÁ ASSINADA, um
-- `insert into frota_checklist_respostas (checklist_id, ...) values (<ficha>, ...)`
-- entrava sem erro nenhum — dava pra acrescentar um item novo à ficha sem
-- tocar em nenhuma linha existente, e nenhuma guarda disparava. A função já
-- lidava com os três casos (`coalesce(old.checklist_id, new.checklist_id)` e
-- `return coalesce(new, old)`); só faltava o evento no gatilho. Sem o insert
-- coberto, o comentário da 032 — "adiantaria pouco travar a ficha e deixar
-- mudar o que foi respondido nela" — não valia: dava pra mudar o conteúdo por
-- um caminho que não era update nem delete. A conferência da corrente
-- acusaria depois, porque o hash recalculado incluiria o item extra, mas isso
-- só protege quem audita — a garantia prometida é bloqueio na escrita, não
-- detecção posterior.

drop trigger if exists trg_frota_resposta_imutavel on public.frota_checklist_respostas;
create trigger trg_frota_resposta_imutavel
  before insert or update or delete on public.frota_checklist_respostas
  for each row execute function public.frota_resposta_imutavel();
