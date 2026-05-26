-- docs/migrations/005_pedido_qtd_itens.sql
-- Adiciona quantidade de linhas de itens por pedido para cálculo de Média Itens e Vendas +1 Item
-- Colar no Supabase Dashboard → SQL Editor → New query → Run

ALTER TABLE public.bling_pedido_vendedor
  ADD COLUMN IF NOT EXISTS qtd_itens int DEFAULT 1;
