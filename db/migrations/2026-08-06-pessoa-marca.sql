-- A pessoa passa a ter MARCA.
--
-- POR QUE: o dono pediu para separar os usuários por marca, local e setor.
-- Local já existia com outro nome (`organizacao_id` → `acessos_organizacoes`,
-- cujo conteúdo é lugar: Sede Centro, Sede Village, Fábrica Conchal) e setor
-- também (`setor_id`). Marca não existia em lugar nenhum.
--
-- Aponta para `patrimonio_empresas` porque é a lista de marcas que já existe e
-- já é usada pelo Patrimônio (5 linhas). Criar uma segunda lista de marcas seria
-- repetir a doença dos cinco nomes da mesma loja.
--
-- NASCE VAZIA DE PROPÓSITO: esta migration não preenche ninguém e não concede
-- acesso a nada. Quem preenche é o dono, pela tela.
alter table public.acessos_pessoas
  add column if not exists marca_id uuid references public.patrimonio_empresas(id);

comment on column public.acessos_pessoas.marca_id is
  'Marca da pessoa (Vessel, Moto Easy, RBV Company...). Nulo = ainda não informado.';
