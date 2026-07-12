-- db/cron/fabrica-purga.sql
--
-- Referência auditável do agendamento pg_cron que dispara a Edge Function fabrica-purga
-- (limpa Storage + fecha rodadas antigas da Fábrica de Anúncios / Estúdio).
--
-- NÃO é rodado pelo runner de migrations (coletor/) — pg_cron.schedule() não é idempotente
-- da mesma forma que uma migration normal (rodar de novo cria um job duplicado com outro
-- jobid), então este statement é aplicado MANUALMENTE, uma única vez, via execute_sql no
-- deploy. Este arquivo existe só para ficar versionado e revisável — não é executado
-- automaticamente por nenhum script.
--
-- Antes de aplicar: trocar <SERVICE_ROLE_KEY> por UMA service-role key válida do projeto (NUNCA
-- commitar a key real neste arquivo — só o placeholder). A Edge fabrica-purga roda com
-- verify_jwt=true: o gateway do Supabase valida a ASSINATURA do JWT e, no código, a função exige
-- que o claim `role` seja 'service_role' (decodifica o payload). Ou seja: qualquer service-role key
-- legítima do projeto passa (não precisa bater byte-a-byte com a SUPABASE_SERVICE_ROLE_KEY injetada);
-- anon e token forjado são barrados. Não usa segredo dedicado.
--
-- STATUS: JÁ APLICADO em 2026-07-11 (job 'fabrica-purga-diaria', jobid 11, active) usando a
-- SUPABASE_SERVICE_KEY do coletor/.env. Testado: service key -> 200; anon/sem auth -> 401.
-- Re-aplicar só se precisar recriar/rotacionar (cron.unschedule antes, pra não duplicar).

select cron.schedule(
  'fabrica-purga-diaria',
  '17 4 * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/fabrica-purga',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 120000
  )
  $$
);
