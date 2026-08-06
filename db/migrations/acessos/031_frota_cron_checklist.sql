-- O robô da manhã do checklist da Frota (F6c).
-- Desenho: docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md
--
-- Usa disparar_robo() e NÃO net.http_post direto: é a função que registra a
-- execução em robos_execucoes, e é dela que a tela de Saúde dos Robôs vive.
-- cron.job_run_details MENTE — ele marca "succeeded" quando o POST saiu, mesmo
-- que a Edge tenha estourado do outro lado.
--
-- 07h30 BRT = 10h30 UTC. Segunda a sexta: o checklist diário é de dia útil, e
-- avisar no sábado é o jeito de a pessoa desligar a notificação.
--
-- NÚMERO DESTA MIGRATION: o brief original da tarefa previa 029, mas 029
-- (posse contínua) e 030 (CHECK de push_preferencias) já foram usados por
-- então — 031 é o próximo livre.

-- O segredo próprio desta função. O valor é gerado aqui e nunca aparece no
-- texto de cron.job.command, porque disparar_robo() lê da tabela na hora.
insert into public.segredos_de_cron(nome, segredo)
values ('enviar-push-frota', encode(gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;

select cron.unschedule('enviar-push-frota')
  where exists (select 1 from cron.job where jobname = 'enviar-push-frota');

select cron.schedule(
  'enviar-push-frota',
  '30 10 * * 1-5',
  $$ select public.disparar_robo(
       'enviar-push-frota', 'enviar-push-frota', 'enviar-push-frota',
       '{"origem":"cron-manha"}'::jsonb, 120000) $$
);

-- Entra na tela de Saúde dos Robôs (2026-07-31-saude-dos-robos.sql) do mesmo
-- jeito que enviar-push-vendas e enviar-push-saldo já entram — sem isto o
-- robô roda mas não aparece na lista de "o que se espera de cada robô", e uma
-- falha silenciosa nunca vira alerta visível. Não é crítico: perder um dia de
-- aviso do checklist não trava nada do resto do sistema, ao contrário do
-- coletar-dados.
insert into public.robos_esperados (robo, horas_sem_sucesso_ate, critico, porque) values
  ('enviar-push-frota', 30, false, 'Avisa quem falta conferir o carro, de manhã, dia útil.')
on conflict (robo) do update
  set horas_sem_sucesso_ate = excluded.horas_sem_sucesso_ate,
      critico = excluded.critico,
      porque = excluded.porque;
