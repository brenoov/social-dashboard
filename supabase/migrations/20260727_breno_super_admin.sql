-- Coloca o Breno (dono do negocio) como super-admin.
-- Pedido dele em 2026-07-27; aplicado em producao no mesmo dia.
--
-- CONTEXTO DO ACHADO: ate hoje o dono do negocio era admin COMUM. Os unicos
-- super-admins eram erick@ e gabriel.gertrudes@. Isso apareceu quando travamos
-- a autopromocao (ver 20260727_impedir_autopromocao_de_admin.sql): com aquele
-- gatilho no ar, ele nao conseguiria mais se promover sozinho.
--
-- SER SUPER-ADMIN AQUI DEPENDE DE DUAS COISAS, e as duas precisam ser mexidas:
--   1) a coluna `profiles.is_superadmin` -> e o que o FRONT le (ve tudo,
--      gerencia permissoes no painel Admin > Usuarios);
--   2) a funcao SQL `public.is_superadmin()` -> lista fixa de e-mails, e o que
--      as EDGE FUNCTIONS leem (ex.: invite-user, que troca a senha de outros).
-- A funcao NAO le a coluna: sao dois caminhos separados. Mexer so num deixa o
-- acesso pela metade -- o app mostra a tela e a Edge nega a acao.
--
-- VALIDADO ao vivo simulando o JWT do proprio breno@: funcao = SIM, coluna = SIM.

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select email from public.profiles where id = auth.uid())
      in ('erick@rbvcompany.com','gabriel.gertrudes@rbvcompany.com','breno@rbvcompany.com'),
    false);
$$;

update public.profiles set is_superadmin = true where email = 'breno@rbvcompany.com';
