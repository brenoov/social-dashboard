-- db/cron/fabrica-purga.sql
--
-- Referência auditável do agendamento pg_cron que dispara a Edge Function fabrica-purga
-- (limpa Storage + fecha rodadas antigas da Fábrica de Anúncios / Estúdio).
--
-- NÃO é rodado pelo runner de migrations (coletor/) — pg_cron.schedule() não é idempotente
-- (rodar de novo cria job duplicado com outro jobid). Aplicado MANUALMENTE via SQL no deploy.
-- Este arquivo existe só para ficar versionado e revisável.
--
-- AUTENTICAÇÃO (importante): a Edge fabrica-purga deleta Storage, então roda com verify_jwt=FALSE
-- e faz a auth SELF-CONTAINED no código: exige o header Authorization = 'Bearer <FABRICA_PURGA_SECRET>'
-- comparado em TEMPO CONSTANTE. `FABRICA_PURGA_SECRET` é um segredo dedicado (openssl rand -hex 32),
-- setado como secret da Edge Function (Supabase → Edge Functions → Secrets). NÃO depende do toggle
-- verify_jwt do gateway, e NÃO reusa a service-role key. Fail-closed: se o secret não estiver setado,
-- toda chamada é 401. Trocar <FABRICA_PURGA_SECRET> abaixo pelo MESMO valor setado na Edge (NUNCA
-- commitar o valor real — só o placeholder).
--
-- STATUS: agendado em 2026-07-11 (job 'fabrica-purga-diaria', schedule 17 4 * * *, active). Positivo
-- passa a funcionar quando o secret FABRICA_PURGA_SECRET for setado na Edge; até lá o cron dá 401
-- (inofensivo — nada é purgado, tenta de novo no dia seguinte).
-- Re-aplicar só se precisar recriar/rotacionar (cron.unschedule antes, pra não duplicar).

select cron.schedule(
  'fabrica-purga-diaria',
  '17 4 * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/fabrica-purga',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <FABRICA_PURGA_SECRET>',
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 120000
  )
  $$
);
