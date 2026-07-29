-- Aviso de SALDO das contas de anúncios: 08h BRT (= 11:00 UTC), todo dia.
--
-- Por que 08h: uma conta que fica sem saldo PARA de veicular, e o prejuízo é o
-- dia inteiro sem anúncio no ar. Avisar de manhã dá tempo de recarregar antes
-- que o dia se perca — mais tarde já teria perdido metade.
--
-- A Edge só envia quando há o que avisar (saldo acabou, acaba hoje, ou dura
-- menos de 3 dias). Nada urgente = nenhum push. Conta de cartão nunca entra:
-- ela não fica sem saldo (ver _shared/saldo-de-conta.js).
select cron.schedule(
  'push-saldo-08h',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/enviar-push-saldo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = 'enviar-push-saldo')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  $$
);
