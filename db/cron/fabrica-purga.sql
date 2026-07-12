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
-- Antes de aplicar: trocar <SERVICE_ROLE_KEY> pela service-role key real do projeto (NUNCA
-- commitar a key real neste arquivo — só o placeholder). A Edge Function fabrica-purga exige
-- esse header (Authorization: Bearer <service-role key>) mesmo com verify_jwt=false, então o
-- pg_cron precisa mandar exatamente esse Authorization pra não cair no 401 do guard em código.

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
