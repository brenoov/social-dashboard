-- Impede que um admin se promova sozinho a super-admin.
-- Aplicado em producao em 2026-07-27 (projeto kounqtdoioootxqegkij).
--
-- O BURACO (achado na auditoria de 2026-07-16, confirmado de novo em 27/07):
-- a policy `admin_update_profiles` da tabela `profiles` pergunta so uma coisa,
-- "quem esta mexendo e admin?". Como qualquer admin pode dar PATCH em qualquer
-- perfil, ele podia dar PATCH no PROPRIO perfil marcando `is_superadmin = true`
-- (ou trocando o proprio `role`) e virar super-admin sem ninguem autorizar.
--
-- POR QUE NAO DEU PRA RESOLVER SO COM RLS:
-- o `WITH CHECK` de uma policy so enxerga a linha NOVA. Pra saber que alguem
-- MUDOU o proprio nivel de acesso e preciso comparar a linha nova com a antiga,
-- e isso a policy nao ve. Por isso a trava e um gatilho BEFORE UPDATE, que
-- recebe as duas versoes da linha (old e new).
--
-- A REGRA:
--   - Ninguem muda o PROPRIO nivel de acesso (is_superadmin ou role).
--   - Mexer no nivel dos OUTROS continua liberado pro admin: e o trabalho
--     normal do painel Admin > Usuarios, nao foi mexido.
--   - Super-admin de verdade (funcao is_superadmin(), lista fixa de e-mails)
--     passa livre.
--   - O service_role tambem passa: nele `auth.uid()` e nulo, entao a condicao
--     "a linha e a minha" nunca da verdadeira.
--
-- VALIDADO AO VIVO na aplicacao (nao so no papel), com o usuario real
-- claudecode@rbvcompany.com (admin comum), simulando o JWT dele:
--   - tentar se promover  -> BLOQUEADO (erro 42501, mensagem em portugues);
--   - promover outra pessoa -> PASSOU (1 linha alterada), painel admin intacto.
-- Os dois testes rodaram dentro de transacao desfeita: nada ficou gravado.

create or replace function public.impedir_autopromocao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.id = auth.uid()
     and (new.is_superadmin is distinct from old.is_superadmin
          or new.role is distinct from old.role)
     and not public.is_superadmin()
  then
    raise exception 'Voce nao pode alterar o seu proprio nivel de acesso (super-admin ou papel). Peca a um super-admin.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_impedir_autopromocao on public.profiles;
create trigger trg_impedir_autopromocao
  before update on public.profiles
  for each row execute function public.impedir_autopromocao();
