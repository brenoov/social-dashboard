-- db/migrations/2026-07-24-cron-push-vendas.sql
-- Agenda a notificação diária de vendas às 22h BRT (= 01:00 UTC; o Brasil não tem
-- mais horário de verão). Mesmo padrão dos jobs de coletar-dados: o header de
-- Authorization é montado lendo o segredo de segredos_de_cron NA HORA do disparo,
-- então o segredo não aparece no texto de cron.job.command. A edge autentica com
-- exigirSegredoDeCron('enviar-push-vendas') e roda com verify_jwt=false.
select cron.schedule(
  'push-vendas-22h',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/enviar-push-vendas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = 'enviar-push-vendas')
    ),
    body := '{"origem":"cron-22h"}'::jsonb,
    timeout_milliseconds := 180000
  )
  $$
);
