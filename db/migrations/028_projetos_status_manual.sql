-- db/migrations/028_projetos_status_manual.sql
-- Torna o kanban de projetos híbrido: leitura automática dos planos + edição manual
-- (criar/editar/arrastar/excluir na própria tela). `manual`=true marca uma linha que o
-- usuário mexeu → o parser status-projetos.mjs para de sobrescrevê-la. `arquivado`=true é
-- exclusão suave (some da tela). Escrita liberada para usuários autenticados (tela gateada
-- pela permissão claude.status).

ALTER TABLE public.projetos_status ADD COLUMN IF NOT EXISTS manual     boolean NOT NULL DEFAULT false;
ALTER TABLE public.projetos_status ADD COLUMN IF NOT EXISTS arquivado  boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS projetos_status_ins ON public.projetos_status;
CREATE POLICY projetos_status_ins ON public.projetos_status FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS projetos_status_upd ON public.projetos_status;
CREATE POLICY projetos_status_upd ON public.projetos_status FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS projetos_status_del ON public.projetos_status;
CREATE POLICY projetos_status_del ON public.projetos_status FOR DELETE TO authenticated USING (true);
