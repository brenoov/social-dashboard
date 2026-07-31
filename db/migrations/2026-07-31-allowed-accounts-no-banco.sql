-- `allowed_accounts` passa a valer no BANCO, não só na tela.
--
-- O PROBLEMA: o sistema restringe quem vê qual marca em `profiles.allowed_accounts`,
-- e essa restrição era aplicada SÓ no front (o seletor de perfis some). Nenhuma
-- das 19 tabelas com `account_id` a checava no RLS — verificado em pg_policies.
-- Um usuário limitado a uma marca via só ela no seletor, mas alcançava as outras
-- por consulta direta. É o mesmo padrão de "esconder o botão não protege": a
-- chave anon está no bundle público.
--
-- POR QUE É SEGURO FAZER AGORA: hoje ninguém tem restrição (15 de 15 perfis com
-- allowed_accounts nulo), então a mudança é NEUTRA no comportamento — nada muda
-- para ninguém. Ela protege o dia em que a primeira restrição for criada, que é
-- justamente quando ninguém lembraria de conferir o banco.
--
-- COMO, SEM REESCREVER POLÍTICA ALHEIA: uma política RESTRICTIVE é combinada com
-- E às permissivas que já existem. Isso permite acrescentar a regra em 19 tabelas
-- sem ler, entender ou arriscar quebrar a lógica de cada uma — que é de onde
-- viriam os erros num sweep desse tamanho.

-- ── A REGRA, num lugar só ───────────────────────────────────────────────────
-- Repetir este `exists` em 19 políticas seria garantir que uma delas ficasse
-- diferente das outras com o tempo.
create or replace function public.pode_ver_conta(p_conta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (
         p.role = 'admin'
         or p.is_superadmin
         -- Sem lista = sem restrição. É o padrão de todo mundo hoje, e o que
         -- mantém esta migration neutra.
         or p.allowed_accounts is null
         -- Linha sem dono (account_id nulo) é dado geral, não de uma marca.
         or p_conta is null
         or p_conta = any (p.allowed_accounts::text[])
       )
  );
$$;

comment on function public.pode_ver_conta(text) is
  'Se o usuario logado pode ver dados desta conta, conforme profiles.allowed_accounts. '
  'Usada pelas politicas RESTRICTIVE de todas as tabelas com account_id.';

revoke execute on function public.pode_ver_conta(text) from public, anon;
grant  execute on function public.pode_ver_conta(text) to authenticated;

-- ── APLICAR ─────────────────────────────────────────────────────────────────
-- `to authenticated` de propósito: o service_role (Edges, cron, robôs) não pode
-- ser afetado — ele não tem auth.uid() e precisa enxergar tudo para coletar.
do $$
declare
  t text;
  -- As 19 tabelas com account_id e RLS ligada, em 31/07/2026. Lista explícita e
  -- não um laço sobre o catálogo: tabela nova deve entrar aqui de propósito,
  -- por alguém que pensou no assunto, e não ser pega por acidente.
  tabelas text[] := array[
    'account_insights','ads_snapshots','campaign_filters','campaign_insights',
    'campaigns','content_snapshots','daily_snapshots','data_integrity_checks',
    'engagement_snapshots','followers_leituras',
    'fabrica_marcas','gt_ad_analises','gt_budget_analises','gt_fila_decisoes','social_metas',
    'conteudo_pecas','conteudo_ideias','conteudo_blocos','conteudo_jobs'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists so_contas_permitidas on public.%I', t);
    -- O ::text cobre as duas formas: account_id é uuid em 14 tabelas e text em 5.
    execute format(
      'create policy so_contas_permitidas on public.%I as restrictive for select '
      'to authenticated using (public.pode_ver_conta(account_id::text))', t);
  end loop;
end $$;
