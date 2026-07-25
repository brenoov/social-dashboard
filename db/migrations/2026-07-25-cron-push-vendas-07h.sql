-- db/migrations/2026-07-25-cron-push-vendas-07h.sql
-- Segundo disparo da notificação de vendas: 07h BRT (= 10:00 UTC), modo 'ontem'
-- (recap da manhã — mostra o fechamento do dia que acabou vs anteontem). A mesma
-- Edge enviar-push-vendas atende os dois horários; o corpo {"modo":"ontem"} faz
-- ela deslocar a janela e o título ("Vendas de ontem"). O de 22h (modo padrão
-- 'hoje') está em 2026-07-24-cron-push-vendas.sql.
select cron.schedule(
  'push-vendas-07h',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/enviar-push-vendas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = 'enviar-push-vendas')
    ),
    body := '{"modo":"ontem"}'::jsonb,
    timeout_milliseconds := 180000
  )
  $$
);
