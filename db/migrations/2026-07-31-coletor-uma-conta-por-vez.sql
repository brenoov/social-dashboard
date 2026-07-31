-- O COLETOR PASSA A RODAR UMA CONTA POR CHAMADA.
--
-- O DIAGNÓSTICO, medido e não suposto (a instrumentação de robos_execucoes
-- entrou no ar hoje e pegou duas falhas no mesmo dia):
--   12h → 546 WORKER_RESOURCE_LIMIT
--   18h → 504 {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit (150s) reached"}
--
-- A causa tem nome: uma chamada varria as 7 contas em sequência, e cada conta faz
-- dezenas de chamadas à Graph API (seguidores, foto, follows de 14 dias,
-- engajamento × 5 períodos, stories, mídias × 5, campanhas, ads × 5 + 7 dias de
-- re-coleta). Isso passa dos 150 segundos que a plataforma permite.
--
-- O `timeout_milliseconds := 180000` do cron NUNCA teve efeito: 180s é maior que
-- o teto real da Supabase, então quem cortava era sempre a plataforma. Aumentar
-- timeout não resolveria nada — o limite não é nosso.
--
-- A SAÍDA é a chamada fazer menos: sete execuções curtas em vez de uma longa.
-- Mesmo desenho que a Fábrica de Anúncios já usa.
--
-- POR QUE ISSO É SEGURO: cada conta já era processada de forma independente
-- dentro do laço (`processarConta`), e o `try/catch` por conta mostra que uma
-- falha nunca derrubou as outras. Separar em chamadas só torna explícito o que
-- já era o desenho.
--
-- EFEITO COLATERAL ACEITO: `avisarSuperAdmin` passa a registrar um alerta por
-- conta em vez de um alerta com a lista toda. Mais linhas, mesma informação — e
-- agora dá para saber qual conta degradou sem ler o texto.

create or replace function public.disparar_coletor(p_rodada text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n int := 0;
begin
  -- Ordem por nome só para o registro ficar previsível de ler.
  for c in
    select id, name from public.accounts
     where instagram_id is not null and access_token is not null
     order by name
  loop
    -- O nome da conta entra no rótulo: quando uma falhar, dá para ver QUAL sem
    -- abrir a resposta. A view robos_saude casa por prefixo 'coletar-dados%',
    -- então continua agrupando tudo sob o mesmo robô.
    perform public.disparar_robo(
      'coletar-dados-' || p_rodada || ' · ' || c.name,
      'coletar-dados',
      'coletar-dados',
      jsonb_build_object('origem', 'cron-' || p_rodada, 'account_id', c.id),
      -- 140s: abaixo do teto de 150s da plataforma, para o pg_net desistir ANTES
      -- e o registro dizer "timed_out" em vez de esconder o 504 num corpo de erro.
      140000
    );
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.disparar_coletor(text) from public, anon, authenticated;
grant  execute on function public.disparar_coletor(text) to service_role;

-- ── OS QUATRO CRONS ─────────────────────────────────────────────────────────
-- Mesmos horários de sempre. A única diferença é que cada um agora abre uma
-- chamada por conta em vez de uma chamada para todas.
--
-- PARA REVERTER: trocar por
--   select public.disparar_robo('coletar-dados-07h','coletar-dados','coletar-dados',
--          '{"origem":"cron-07h"}'::jsonb, 180000)
-- que volta ao comportamento de uma chamada para todas as contas (a Edge continua
-- aceitando chamada sem account_id).
select cron.schedule('coletar-dados-07h',  '0 10 * * *', $$ select public.disparar_coletor('07h')  $$);
select cron.schedule('coletar-dados-12h',  '0 15 * * *', $$ select public.disparar_coletor('12h')  $$);
select cron.schedule('coletar-dados-18h',  '0 21 * * *', $$ select public.disparar_coletor('18h')  $$);
select cron.schedule('coletar-dados-2359', '59 2 * * *', $$ select public.disparar_coletor('2359') $$);
