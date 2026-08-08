-- Frota F7c: o rabisco que a pessoa desenha com o dedo ao assinar o checklist.
--
-- PEDIDO DO DONO: "tem algo que deixe mais fiel e comprovo? tipo um campo para
-- a pessoa rabiscar e assinar?". Ele escolheu o rabisco entre várias
-- alternativas, ciente de que ele prova MENOS que a senha do ponto de vista
-- técnico (um risco na tela é fácil de imitar) e de que nada disso prova que a
-- pessoa olhou o carro. O que ele acrescenta é o gesto deliberado — a pessoa
-- sabendo que está assinando —, e isso tem peso na hora de cobrar alguém.
--
-- POR QUE `assinatura_versao` VEM JUNTO, E É A PARTE IMPORTANTE DESTA MIGRATION
--
-- A conferência de uma ficha recalcula o texto que ela assinou. Acrescentar o
-- rabisco a esse texto muda o hash de TODAS as fichas já assinadas — e a
-- primeira ficha real do sistema JÁ EXISTE: a BMW X1 que o dono assinou em
-- 07/08/2026 23:16 BRT. Sem versão, `conferirCorrente()` passaria a acusar a
-- ficha dele de adulterada. Acusar inocente é o pior desfecho possível num
-- recurso que existe pra provar quem fez o quê.
--
-- Então cada ficha guarda sob qual regra foi assinada. `null` = versão 1, que
-- é o caso das fichas anteriores a esta coluna — justamente as que não podem
-- mudar de valor. `assinatura-ficha-real.test.mjs` trava o hash da BMW e fica
-- vermelho se alguém encostar no formato V1.

begin;

alter table public.frota_checklist
  -- Os TRAÇOS, não uma imagem. Duas razões concretas: o gerador de PDF deste
  -- módulo é escrito à mão e não desenha imagem (mas desenha linha, que é
  -- nativa do formato), e pontos entram na impressão digital de forma limpa,
  -- sem depender de como um PNG foi comprimido.
  --
  -- Formato: [ [[x,y],[x,y],…], … ] — uma lista por traço (cada vez que o
  -- dedo encosta e levanta), com coordenadas de 0 a 1. RELATIVAS de propósito:
  -- assim o rabisco fica igual em qualquer tamanho de tela, e não depende do
  -- aparelho de quem assinou.
  add column if not exists assinatura_rabisco jsonb,
  -- Sob qual regra o texto desta ficha foi montado. `null` = 1 (ver acima).
  add column if not exists assinatura_versao smallint;

comment on column public.frota_checklist.assinatura_rabisco is
  'Os tracos do rabisco: lista de tracos, cada um lista de pontos [x,y] de 0 a 1. Entra na impressao digital a partir da versao 2 — trocar o desenho depois de assinado quebra a corrente, igual mexer no hodometro.';
comment on column public.frota_checklist.assinatura_versao is
  'Sob qual regra o texto assinado foi montado. NULL = 1 (fichas anteriores a esta coluna, que NAO podem mudar de hash). 2 = com rabisco.';

commit;

-- ── O QUE **NÃO** PRECISA SER FEITO AQUI, e por quê ────────────────────────
--
-- 1) NÃO se preenche `assinatura_versao` das fichas que já existem. Deixá-las
--    em `null` É a resposta certa: `null` significa versão 1 no código, e
--    escrever 1 nelas seria mexer em linha assinada — que os gatilhos das
--    migrations 032/033 barram, com razão.
--
-- 2) NÃO se mexe nos gatilhos de imutabilidade. As colunas novas nascem
--    protegidas por eles automaticamente: o gatilho barra qualquer UPDATE numa
--    ficha que já tem `assinada_em`, seja qual for a coluna. Ou seja, gravar o
--    rabisco JUNTO da assinatura passa (a ficha ainda não estava assinada), e
--    trocar o rabisco DEPOIS é recusado — que é exatamente o comportamento que
--    faz o desenho valer alguma coisa.
