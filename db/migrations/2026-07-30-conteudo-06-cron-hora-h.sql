-- LIGAR O AVISO DA HORA H: cron de 5 em 5 minutos.
--
-- APLICAR SÓ QUANDO QUISER O PUSH VALENDO. A partir daqui, toda peça agendada
-- que chegar na hora manda notificação para os celulares de quem tem a
-- ferramenta e não desligou o tipo 'conteudo'.
--
-- Exige a migration 05 (o segredo) aplicada antes.
--
-- POR QUE 5 MINUTOS e não 1: a tela promete "o aviso chega em até 5 minutos
-- depois do horário escolhido". Prometer o minuto exato seria mentira de
-- qualquer jeito (a entrega do push não é instantânea), e rodar 1440 vezes por
-- dia para ganhar 4 minutos não paga o custo.
--
-- FUSO: não tem. `publicar_em` é timestamptz e a comparação é `<= now()`. O cron
-- rodar em UTC não importa — ele não pergunta "que horas são no Brasil?",
-- pergunta "já passou?". A conversão para Brasília acontece só na tela.
select cron.schedule(
  'conteudo-hora-h',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/conteudo-hora-h',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = 'conteudo-hora-h')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $$
);

-- Para desligar sem apagar nada:  select cron.unschedule('conteudo-hora-h');
