-- Meta por OBJETIVO, cada uma na unidade do resultado daquele objetivo.
-- Antes só engajamento tinha meta, e os limiares dos demais objetivos viviam
-- chumbados no código (GT_CRIT) — o dono podia definir o preço da curtida e NÃO o
-- preço da conversa de WhatsApp, que é onde estão R$ 56 mil dos R$ 67 mil gastos.
--
-- ATENÇÃO À UNIDADE: cada chave está numa unidade diferente, definida em
-- src/ferramentas/gestao-trafego/alvos.js. NÃO são comparáveis entre si.
--   engajamento -> R$ por PONTO da métrica ponderada
--   trafego     -> R$ por VISITA
--   mensagens   -> R$ por CONVERSA iniciada
--
-- POR QUE leads, vendas e reconhecimento NÃO entram: foi medido em 90 dias e não
-- existe UM lead registrado, UMA compra registrada, nem UMA campanha de
-- reconhecimento. Meta para resultado que a conta não produz é número inventado:
-- o custo fica indefinido, a meta nunca vale, e sobra confusão na tela. Sem meta,
-- o veredito cai na leitura de saúde daquele objetivo — que é o certo. O dono
-- preenche na aba da régua quando começar a rodar esse tipo.
-- GUARDA CONTRA REPLAY: neste projeto migration é reaplicada à mão sem um
-- controle de versão completo (schema versionado incompleto, ver LEIA-ME das
-- migrations faltando) — então este arquivo PODE rodar de novo depois do dono
-- já ter ajustado a régua na aba "A régua". Sem guarda, um segundo "apply"
-- reverteria silenciosamente a meta que ele tunou de volta pra este valor de
-- partida, sem o dono nem saber que aconteceu (M7 do review final,
-- 2026-07-28). A condição abaixo só deixa a atualização passar quando `metas`
-- ainda está no valor de fábrica criado por 20260728_ponderada_config.sql
-- (ou vazio) — ou seja, só na PRIMEIRA aplicação de verdade. Se o dono já
-- mudou qualquer coisa, este UPDATE não faz nada.
update public.gt_ponderada_config
set metas = jsonb_build_object('engajamento', 0.15, 'trafego', 0.25, 'mensagens', 20.00),
    updated_at = now()
where id = 1
  and (
    metas is null
    or metas = '{}'::jsonb
    or metas = '{"engajamento":0.15,"reconhecimento":0.15}'::jsonb
  );

select metas from public.gt_ponderada_config where id = 1;
