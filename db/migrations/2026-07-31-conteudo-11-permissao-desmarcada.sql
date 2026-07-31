-- FERRAMENTA NOVA NASCE COM A PERMISSÃO DESMARCADA.
--
-- Regra do dono (2026-07-31): nenhuma ferramenta nova chega concedida a
-- ninguém. Quem precisa recebe em Administração › Usuários, de propósito.
--
-- A migration 03 fazia o contrário: concedia `conteudo` e `conteudo.aprovar` a
-- todos os superadmins. Isto desfaz aquilo.
--
-- POR QUE NÃO TRANCA NINGUÉM DE FORA: superadmin não depende desta concessão.
-- Ele passa por `is_superadmin` em todos os caminhos —
--   front:  hasPermission() devolve true de saída para superadmin
--   RLS:    toda policy tem `or p.is_superadmin`
--   Edge:   conteudo-trigger checa role/is_superadmin antes de permissions
-- A concessão explícita era redundante para eles e indevida para o resto.
--
-- O efeito prático: a Central de Conteúdo sobe invisível para todo mundo que
-- não é superadmin, até alguém marcar a permissão na tela de Usuários.

update public.profiles
   set permissions = (coalesce(permissions, '{}'::jsonb) - 'conteudo' - 'conteudo.aprovar'),
       features = (
         select array(
           select f from unnest(coalesce(features, '{}'::text[])) as f
            where f not in ('conteudo', 'conteudo.aprovar')
            order by 1
         )
       )
 where permissions ? 'conteudo'
    or permissions ? 'conteudo.aprovar'
    or 'conteudo' = any (coalesce(features, '{}'::text[]))
    or 'conteudo.aprovar' = any (coalesce(features, '{}'::text[]));
