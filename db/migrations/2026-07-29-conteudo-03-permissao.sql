-- CONCESSÃO DA PERMISSÃO NOVA AO SUPERADMIN.
--
-- POR QUE GRAVAR OS DOIS CAMPOS (e não só `permissions`, como fez a 027):
-- o projeto tem dois modelos de permissão convivendo. O front lê `permissions`
-- (jsonb) por hasPermission(); as Edge Functions e o RLS leem `features` (text[]).
-- A ponte entre eles é derivarFeatures(), que só roda quando um admin SALVA o
-- perfil pela tela de Usuários.
--
-- Ou seja: mexer só em `permissions` faria a tela aparecer e o banco devolver
-- lista vazia — o modo de falha mais confuso possível, porque parece "não tem
-- nada cadastrado" em vez de "sem permissão" (sb() devolve [] nos dois casos).
--
-- Duas chaves, e não uma ação 'aprovar':
--   conteudo          → entra na ferramenta, cria e edita peça
--   conteudo.aprovar  → decide (aprova/reprova) peça dos outros
-- A matriz do admin tem colunas fixas ['ver','criar','editar','excluir','exportar']
-- (ACOES_MATRIZ em agrupar-permissoes.js). Uma coluna 'aprovar' abriria uma
-- célula vazia nas 15 linhas existentes só para servir a uma. Chave separada é
-- o padrão que o repo já usa em social.relatorio e gestor.relatorios.

update public.profiles
   set permissions = jsonb_set(
         jsonb_set(coalesce(permissions, '{}'::jsonb),
                   '{conteudo}', '["ver","criar","editar","excluir"]'::jsonb, true),
         '{conteudo.aprovar}', '["ver"]'::jsonb, true),
       features = (
         select array(
           select distinct unnest(coalesce(features, '{}'::text[]) || array['conteudo', 'conteudo.aprovar'])
            order by 1
         )
       )
 where is_superadmin = true;
