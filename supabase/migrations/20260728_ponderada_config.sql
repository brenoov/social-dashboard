-- A RÉGUA da métrica ponderada: pesos, metas por objetivo e limiares do semáforo.
-- Linha ÚNICA (id = 1): é uma configuração da casa, não uma por usuário.
create table if not exists public.gt_ponderada_config (
  id          int primary key default 1 check (id = 1),
  pesos       jsonb not null default '{"curtidas":1,"comentarios":10,"salvamentos":30,"compartilhamentos":20}'::jsonb,
  metas       jsonb not null default '{"engajamento":0.20,"trafego":0.20,"reconhecimento":0.20,"mensagens":0.20,"leads":0.20,"vendas":0.20,"padrao":0.20}'::jsonb,
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

-- Leitura: qualquer usuário logado (a tela inteira depende da régua pra calcular).
create policy ponderada_config_leitura on public.gt_ponderada_config
  for select to authenticated using (true);
create policy ponderada_log_leitura on public.gt_ponderada_config_log
  for select to authenticated using (true);

-- Escrita: só admin. Mexer num peso muda a recomendação de todo mundo.
-- Mesmo padrão de gt_config_metricas.
create policy ponderada_config_escrita on public.gt_ponderada_config
  for update to authenticated using (get_my_role() = 'admin') with check (get_my_role() = 'admin');
create policy ponderada_log_escrita on public.gt_ponderada_config_log
  for insert to authenticated with check (get_my_role() = 'admin');
