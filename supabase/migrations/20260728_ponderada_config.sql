-- A RÉGUA da métrica ponderada: pesos, metas por objetivo e limiares do semáforo.
-- Linha ÚNICA (id = 1): é uma configuração da casa, não uma por usuário.
-- IMPORTANTE sobre `metas`: os pontos (curtida/comentário/salvamento/compartilhamento)
-- só existem porque a pessoa ENGAJOU com o post. Isso é um sinal legítimo para
-- campanhas de engajamento e reconhecimento de marca — mas não diz NADA sobre venda,
-- lead ou mensagem gerada. Uma campanha de vendas com zero vendas e curtidas baratas
-- não deveria acender um "escalar" verde só porque o custo por ponto está bom.
-- Por isso a régua só nasce com meta pros dois baldes onde a métrica ponderada É a
-- métrica certa: engajamento e reconhecimento. Os demais baldes (trafego, mensagens,
-- leads, vendas) e o "padrao" ficam DE PROPÓSITO sem meta: sem meta, metaDoBalde()
-- (regua.js) devolve 0, calcularPonderada() devolve faixa 'sem-dados', e o veredito
-- (veredito.js) cai pra leitura de saúde específica do objetivo daquela campanha —
-- que é o comportamento correto para quem não vive de curtida.
-- NÃO reintroduza "padrao" nem os outros baldes aqui "pra completar a tabela": isso
-- faria a ponderada voltar a decidir vereditos de campanhas de venda/lead/mensagem
-- pelo preço da curtida, que foi exatamente o bug corrigido nesta migration.
-- O custo por ponto continua aparecendo no cartão de TODAS as campanhas, sempre —
-- isso não muda; só o VEREDITO deixa de ser guiado por ele fora de engajamento/
-- reconhecimento.
create table if not exists public.gt_ponderada_config (
  id          int primary key default 1 check (id = 1),
  pesos       jsonb not null default '{"curtidas":1,"comentarios":10,"salvamentos":30,"compartilhamentos":20}'::jsonb,
  -- 0.15 pra ambos: medido em cima de 23 campanhas reais de 90 dias (mediana das
  -- campanhas de engajamento genuíno ≈ R$ 0,16 por ponto). Não é um número sagrado —
  -- é só o ponto de partida; o dono ajusta na aba "A régua" sempre que achar que
  -- o custo real mudou.
  metas       jsonb not null default '{"engajamento":0.15,"reconhecimento":0.15}'::jsonb,
  limiares    jsonb not null default '{"escalarForte":0.8,"dentroMeta":1.0,"manter":1.3}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.gt_ponderada_config (id) values (1) on conflict (id) do nothing;

-- HISTÓRICO: sem ele, a recomendação mudar de comportamento de uma semana pra
-- outra vira mistério. Guarda o antes e o depois inteiros.
create table if not exists public.gt_ponderada_config_log (
  id          bigserial primary key,
  mudou_em    timestamptz not null default now(),
  mudou_quem  uuid,
  antes       jsonb,
  depois      jsonb
);

alter table public.gt_ponderada_config enable row level security;
alter table public.gt_ponderada_config_log enable row level security;

-- Os `drop policy if exists` existem porque o Postgres NÃO tem
-- "create policy if not exists": sem eles, rodar este arquivo uma segunda vez
-- quebraria com "policy já existe". E neste projeto migration é reaplicada à mão
-- com frequência (o schema versionado está incompleto), então replay tem que ser
-- seguro.

-- Leitura: qualquer usuário logado (a tela inteira depende da régua pra calcular).
drop policy if exists ponderada_config_leitura on public.gt_ponderada_config;
create policy ponderada_config_leitura on public.gt_ponderada_config
  for select to authenticated using (true);
drop policy if exists ponderada_log_leitura on public.gt_ponderada_config_log;
create policy ponderada_log_leitura on public.gt_ponderada_config_log
  for select to authenticated using (true);

-- Escrita: quem tem ACESSO À FERRAMENTA de Gestão de Tráfego, não só admin
-- (decisão do dono, 2026-07-28: editar a régua é uma ação da ferramenta, igual
-- a editar o catálogo de métricas). Espelha EXATAMENTE a regra que
-- gt_config_metricas já usa (ver db/migrations/2026-07-02-gt-config-metricas-
-- acesso-ferramenta.sql): admin OU quem tem a feature 'meta.gestor'.
drop policy if exists ponderada_config_escrita on public.gt_ponderada_config;
create policy ponderada_config_escrita on public.gt_ponderada_config
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  );
drop policy if exists ponderada_log_escrita on public.gt_ponderada_config_log;
create policy ponderada_log_escrita on public.gt_ponderada_config_log
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  );

-- NOTA de desenho: a config NÃO tem policy de INSERT nem DELETE, e o log não tem
-- UPDATE nem DELETE. Isso é intencional: com RLS ligada, comando sem policy é
-- negado. Resultado — ninguém cria uma segunda linha de régua nem apaga a que
-- existe, e o histórico só aceita acréscimo, nunca reescrita.
