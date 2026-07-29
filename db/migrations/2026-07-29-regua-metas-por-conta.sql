-- A RÉGUA PASSA A TER UMA META POR CONTA DE ANÚNCIOS
--
-- POR QUÊ: até aqui a régua tinha UMA meta valendo para as cinco contas. Medindo
-- 90 dias reais (28/07/2026), o custo do ponto de engajamento saiu assim:
--
--     Vessel      R$ 0,013      <- 28x mais barato
--     Raíssa      R$ 0,079
--     Breno Vale  R$ 0,372      <- 28x mais caro
--
-- Contra a meta única de R$ 0,15, o veredito parava de responder "esta campanha
-- vai bem?" e passava a responder "de quem é esta conta?": a Vessel ficava verde
-- mesmo piorando e a Breno Vale vermelha mesmo melhorando. A régua carimbava em
-- vez de julgar. Agora cada conta é comparada com o que ELA pratica.
--
-- Pesos e limiares continuam GERAIS de propósito: peso é quanto uma interação
-- VALE (um salvamento vale 30 curtidas), não quanto ela custa — isso não muda de
-- cliente para cliente. O que muda de cliente para cliente é o preço.

alter table public.gt_ponderada_config
  add column if not exists metas_por_conta jsonb not null default '{}'::jsonb;

comment on column public.gt_ponderada_config.metas_por_conta is
  'Mapa id-da-conta (accounts.id) -> metas daquela conta, em R$ por resultado. '
  'Conta ausente = SEM meta, de propósito: o cálculo devolve "sem-dados" em vez '
  'de herdar o preço praticado por outro cliente.';

comment on column public.gt_ponderada_config.metas is
  'LEGADO: a meta única que valia para as cinco contas até 29/07/2026. Mantida '
  'para o histórico; não governa mais nenhum veredito. Quem governa é '
  'metas_por_conta.';

-- Valores medidos nos últimos 90 dias de cada conta, com ambição de 10%
-- (meta = média praticada x 0,9, escolha do dono) e PISO DE AMOSTRA: só virou
-- meta o que tinha ao menos 50 resultados e R$ 200 gastos. O piso importa —
-- sem ele a Vessel ganharia meta de R$ 26 por visita, calculada em cima de 15
-- visitas, e qualquer campanha dela ficaria verde pagando R$ 3. Ficaram de fora
-- por amostra fina: comentários e salvamentos da Vessel (19 e 29), visitas da
-- Vessel (15) e comentários da Breno Vale (41).
--
-- A Mantova não aparece: zero campanhas em 90 dias, então nasce em branco.
update public.gt_ponderada_config
   set metas_por_conta = jsonb_build_object(
         -- Motoeasy: só roda WhatsApp (2.265 conversas)
         '0cc4f2b4-4d21-41e9-9b39-fb1d4043aa9b', jsonb_build_object(
           'mensagens', 9.8),
         -- Vessel: engajamento muito barato (25.740 curtidas) + WhatsApp
         'b6883e82-07cb-4f21-9fd7-ea7626786174', jsonb_build_object(
           'engajamento', 0.012, 'curtidas', 0.015,
           'compartilhamentos', 1.7, 'mensagens', 7.7),
         -- Breno Vale: a conta mais cara em engajamento; forte em tráfego
         '9233a796-6e6c-47b7-ad43-b0735f51515b', jsonb_build_object(
           'engajamento', 0.33, 'curtidas', 0.97, 'salvamentos', 35,
           'compartilhamentos', 19, 'mensagens', 24, 'trafego', 0.33),
         -- Raíssa: maior volume das cinco (352.883 curtidas, 211.470 visitas)
         'f5b09795-bc20-43af-868c-21e445aec0ae', jsonb_build_object(
           'engajamento', 0.071, 'curtidas', 0.086, 'comentarios', 170,
           'salvamentos', 46, 'compartilhamentos', 12, 'trafego', 0.17)
       ),
       updated_at = now()
 where id = 1;
