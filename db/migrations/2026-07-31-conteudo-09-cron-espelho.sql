-- LIGAR O ESPELHO: cron de 30 em 30 minutos.
--
-- Exige a migration 08 (o segredo) aplicada antes.
--
-- POR QUE 30 MINUTOS: o casamento só tem o que fazer depois que a pessoa
-- publicou, e ninguém está esperando o número aparecer no mesmo minuto. De meia
-- em meia hora o post recém-publicado é encontrado dentro da mesma sessão de
-- trabalho, e a cota da Graph fica longe do limite.
--
-- CUSTO DE COTA, para não ser surpresa: por rodada são ~1 chamada por conta com
-- peça pendente (passo A) + 2 por peça que precisa de medida (passo B). A
-- cadência de medição (todo dia na 1ª semana, semanal até 30 dias, nunca depois)
-- é o que impede isso de crescer sem parar — ver _shared/cadencia-de-medicao.js.
--
-- Diferente da hora H, esta função NÃO manda notificação: ligar aqui não
-- incomoda ninguém, só lê a Meta e grava número.
select cron.schedule(
  'conteudo-espelho',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/conteudo-espelho',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = 'conteudo-espelho')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  $$
);

-- Para desligar sem apagar nada:  select cron.unschedule('conteudo-espelho');
