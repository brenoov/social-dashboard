-- Curadoria por loja: o criativo precisa carregar o SKU (a loja é derivada no front
-- por job.params.itens x fabrica_lojas). Arte é 1 por SKU (dedup entre lojas), então
-- só o SKU vira coluna; a loja NÃO. Nullable: rows antigas ficam null (seção "Outros").
alter table fabrica_criativos add column if not exists sku text;
