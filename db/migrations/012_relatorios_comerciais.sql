-- db/migrations/012_relatorios_comerciais.sql
-- Módulo Relatórios Comerciais (Gestor): vendas por item/mês/canal + estoque por depósito.
-- Pré-agregado pelo job coletor/relatorios-comerciais.mjs (upsert idempotente).
-- Leitura autenticada; escrita via service_role (padrão das tabelas do coletor).

CREATE TABLE IF NOT EXISTS public.gc_vendas_item (
  mes            date    NOT NULL,             -- 1º dia do mês (ex.: 2026-06-01)
  canal_loja_id  bigint  NOT NULL,             -- loja.id do Bling
  sku            text    NOT NULL,
  produto        text,
  categoria      text,                         -- via classificarItem(nome)
  unidades       int     NOT NULL DEFAULT 0,
  faturamento    numeric NOT NULL DEFAULT 0,
  atualizado_em  timestamptz DEFAULT now(),
  PRIMARY KEY (mes, canal_loja_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_gc_vi_mes ON public.gc_vendas_item (mes DESC);
ALTER TABLE public.gc_vendas_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_vi_read ON public.gc_vendas_item;
CREATE POLICY gc_vi_read ON public.gc_vendas_item
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gc_estoque_item (
  deposito_id    bigint  NOT NULL,
  sku            text    NOT NULL,
  produto        text,
  categoria      text,
  saldo          int     NOT NULL DEFAULT 0,
  atualizado_em  timestamptz DEFAULT now(),
  PRIMARY KEY (deposito_id, sku)
);
ALTER TABLE public.gc_estoque_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_ei_read ON public.gc_estoque_item;
CREATE POLICY gc_ei_read ON public.gc_estoque_item
  FOR SELECT TO authenticated USING (true);
