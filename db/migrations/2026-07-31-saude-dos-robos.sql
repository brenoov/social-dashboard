-- SAÚDE DOS ROBÔS: tornar visível quando um robô falha.
--
-- O PROBLEMA (achado em 2026-07-31): a rodada das 12h do `coletar-dados` falhou
-- com 546 WORKER_RESOURCE_LIMIT, e o painel do cron marcou como **succeeded**.
--
-- Não é bug do pg_cron: `cron.job_run_details` registra se o SQL rodou, e o SQL
-- foi só "enfileire esta chamada" — o que de fato deu certo. O que a função
-- respondeu vai parar em `net._http_response`, que o pg_net PODA em poucas horas.
-- Ou seja: existe uma janela curta em que dá para saber, e depois some.
--
-- POR QUE ISSO IMPORTA MAIS DO QUE PARECE: a coleta em si se cura sozinha (roda
-- 4x/dia e a tabela é upsert por dia, então uma rodada perdida é regravada pela
-- seguinte — conferido: 10 dias sem um buraco). O risco real é outro: o token da
-- Meta só é renovado DENTRO do coletar-dados, e dura 60 dias. Se ele falhar por
-- semanas sem ninguém saber, o token vence e para tudo — painel, Fábrica e a
-- Central de Conteúdo.
--
-- POR QUE NÃO DEU PARA SÓ OBSERVAR, sem tocar nos crons: `net._http_response`
-- não guarda a URL, e `net.http_request_queue` (que guarda) é drenada assim que
-- a chamada termina — conferido, o join devolve zero. A única forma de saber de
-- quem é cada resposta é capturar o id do pedido NA HORA do disparo.

-- ── O REGISTRO ──────────────────────────────────────────────────────────────
create table if not exists public.robos_execucoes (
  id           bigserial primary key,
  robo         text not null,
  request_id   bigint,
  disparado_em timestamptz not null default now(),
  status_code  int,
  ok           boolean,
  resposta     text,
  conferido_em timestamptz
);

comment on table public.robos_execucoes is
  'Uma linha por disparo de robô, com o que a funcao respondeu. Existe porque '
  'cron.job_run_details diz "succeeded" mesmo quando a Edge devolve erro.';

create index if not exists robos_execucoes_robo_idx
  on public.robos_execucoes (robo, disparado_em desc);
-- A varredura da conferência: só o que ainda não foi conferido.
create index if not exists robos_execucoes_pendentes_idx
  on public.robos_execucoes (disparado_em) where conferido_em is null;

-- ── O DISPARO ───────────────────────────────────────────────────────────────
-- Faz exatamente o que os crons já faziam, e ainda guarda o id do pedido.
-- Mesma montagem de cabeçalho de antes: o segredo continua sendo lido da tabela
-- na hora, então ele NÃO aparece no texto de cron.job.command.
create or replace function public.disparar_robo(
  p_robo    text,                          -- nome no registro (ex.: 'coletar-dados-12h')
  p_funcao  text,                          -- slug da Edge (ex.: 'coletar-dados')
  p_segredo text,                          -- nome em segredos_de_cron
  p_body    jsonb default '{}'::jsonb,
  p_timeout int default 120000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req bigint;
begin
  select net.http_post(
    url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/' || p_funcao,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = p_segredo)
    ),
    body := p_body,
    timeout_milliseconds := p_timeout
  ) into v_req;

  insert into public.robos_execucoes (robo, request_id) values (p_robo, v_req);
  return v_req;
end $$;

-- `anon` PRECISA estar aqui, e não é excesso de zelo: o Supabase concede
-- EXECUTE em função nova do schema public para anon/authenticated/service_role
-- por default privileges, e `revoke ... from public` NÃO tira uma concessão
-- explícita ao papel anon. Como a chave anon está no bundle público do site,
-- esquecer esta linha deixa a função aberta para qualquer visitante.
--
-- Aqui era grave: disparar_robo LÊ o segredo sozinha, então servia de procurador
-- confuso para disparar QUALQUER Edge Function — mandar push para todo mundo,
-- queimar a cota da Graph API. Confirmado em teste antes da correção.
revoke execute on function public.disparar_robo(text, text, text, jsonb, int) from public, anon, authenticated;
grant  execute on function public.disparar_robo(text, text, text, jsonb, int) to service_role;

-- ── A CONFERÊNCIA ───────────────────────────────────────────────────────────
-- Corre atrás da resposta antes de o pg_net podar. Roda de 5 em 5 minutos.
--
-- Isto é o que pega a falha que a própria função NÃO consegue reportar: quando
-- ela morre por falta de recurso (546), não sobra ninguém lá dentro para
-- registrar nada. Só de fora dá para ver.
create or replace function public.conferir_robos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conferidos int;
begin
  update public.robos_execucoes e
     set status_code  = r.status_code,
         ok           = (r.status_code between 200 and 299),
         resposta     = left(r.content, 500),
         conferido_em = now()
    from net._http_response r
   where r.id = e.request_id
     and e.conferido_em is null;
  get diagnostics v_conferidos = row_count;

  -- Passou de 6h sem resposta = o pg_net já podou e não dá mais para saber.
  -- Fecha como desconhecido (ok = null) em vez de deixar pendurado para sempre,
  -- senão a fila de pendentes só cresce e a saúde nunca fica limpa.
  update public.robos_execucoes
     set conferido_em = now(),
         resposta = 'a resposta foi apagada pelo pg_net antes da conferência'
   where conferido_em is null
     and disparado_em < now() - interval '6 hours';

  -- Não guardar para sempre: 60 dias respondem qualquer investigação.
  delete from public.robos_execucoes where disparado_em < now() - interval '60 days';

  return v_conferidos;
end $$;

revoke execute on function public.conferir_robos() from public, anon, authenticated;
grant  execute on function public.conferir_robos() to service_role;

-- ── O QUE SE ESPERA DE CADA ROBÔ ────────────────────────────────────────────
create table if not exists public.robos_esperados (
  robo   text primary key,
  -- Quantas horas sem UM sucesso já é motivo de preocupação. Folgado de
  -- propósito: alarme que dispara à toa vira alarme ignorado.
  horas_sem_sucesso_ate int not null,
  critico boolean not null default false,
  porque  text
);

insert into public.robos_esperados (robo, horas_sem_sucesso_ate, critico, porque) values
  ('coletar-dados', 30, true,
   'Alimenta o painel inteiro E e o UNICO lugar que renova o token da Meta (dura 60 dias). '
   'Se parar por semanas, o token vence e para tudo.'),
  ('conteudo-hora-h', 2, false,
   'Avisa quando chega a hora de publicar. Roda de 5 em 5 min; 2h parado ja e muita peca perdida.'),
  ('conteudo-espelho', 6, false,
   'Casa a peca com o post real e traz as metricas. Atraso aqui so adia numero.'),
  ('enviar-push-vendas', 30, false, 'Push de vendas, 2x por dia.'),
  ('enviar-push-saldo', 30, false, 'Aviso de saldo das contas de anuncio, 1x por dia.'),
  ('auditar-dados', 30, false, 'Auditoria de integridade, 1x por dia.')
on conflict (robo) do update
  set horas_sem_sucesso_ate = excluded.horas_sem_sucesso_ate,
      critico = excluded.critico,
      porque = excluded.porque;

-- ── A SAÚDE ─────────────────────────────────────────────────────────────────
-- Uma linha por robô, em português, pronta para virar tela.
create or replace view public.robos_saude as
with ultimas as (
  select e.robo,
         max(e.disparado_em) filter (where e.ok) as ultimo_sucesso,
         max(e.disparado_em) as ultimo_disparo,
         count(*) filter (where e.ok is false and e.disparado_em > now() - interval '24 hours') as falhas_24h,
         count(*) filter (where e.disparado_em > now() - interval '24 hours') as disparos_24h
    from public.robos_execucoes e
   group by e.robo
)
select
  x.robo,
  x.critico,
  u.ultimo_sucesso,
  u.ultimo_disparo,
  coalesce(u.falhas_24h, 0)   as falhas_24h,
  coalesce(u.disparos_24h, 0) as disparos_24h,
  x.horas_sem_sucesso_ate,
  case
    when u.ultimo_sucesso is null and u.ultimo_disparo is null then 'sem registro ainda'
    when u.ultimo_sucesso is null then 'nunca deu certo'
    when u.ultimo_sucesso < now() - make_interval(hours => x.horas_sem_sucesso_ate) then 'ATRASADO'
    else 'ok'
  end as situacao,
  x.porque
from public.robos_esperados x
left join ultimas u on u.robo like x.robo || '%'   -- 'coletar-dados' cobre as 4 rodadas
order by x.critico desc, x.robo;

comment on view public.robos_saude is
  'Situacao de cada robo. ATRASADO = passou do tempo maximo sem UM sucesso.';

-- OBRIGATÓRIO. Sem isto a view roda com a permissão do DONO (postgres) e passa
-- por cima do RLS das tabelas de baixo — não é detalhe teórico: medido, um
-- usuário 'viewer' comum lia 6 linhas pela view e 0 pela tabela.
--
-- Toda view nova sobre tabela com RLS neste projeto precisa desta linha.
alter view public.robos_saude set (security_invoker = true);

alter table public.robos_execucoes enable row level security;
alter table public.robos_esperados enable row level security;

-- Quem vê é quem já tem a tela: o painel /claude-status é liberado pela
-- permissão 'claude.status', não por ser admin. Com regra só-admin, quem tem
-- acesso ao painel veria a seção de saúde vazia, sem entender por quê.
create policy robos_execucoes_leitura on public.robos_execucoes
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin
                       or 'claude.status' = any (p.features))));
create policy robos_esperados_leitura on public.robos_esperados
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.is_superadmin
                       or 'claude.status' = any (p.features))));
create policy robos_execucoes_srv on public.robos_execucoes for all using (auth.role() = 'service_role');
create policy robos_esperados_srv on public.robos_esperados for all using (auth.role() = 'service_role');

-- ── LIGAR A CONFERÊNCIA ─────────────────────────────────────────────────────
-- :02, :07, :12… e NÃO */5. Os robôs disparam nos múltiplos de 5; rodando no
-- mesmo minuto, o conferente chega antes de a resposta HTTP voltar e a
-- conferência atrasa um ciclo inteiro (medido: o disparo das 16:40 ficou sem
-- status até as 16:45). Dois minutos de folga cobrem a Edge mais lenta.
select cron.schedule('conferir-robos', '2-59/5 * * * *', $$ select public.conferir_robos() $$);

-- ── MIGRAR OS CRONS ─────────────────────────────────────────────────────────
-- Mesmos horários, mesmos corpos, mesmos timeouts do que já existia. A ÚNICA
-- diferença é passar por disparar_robo(), que guarda o id do pedido.
--
-- O nome do robô carrega a rodada ('coletar-dados-12h') para dar para saber
-- QUAL das quatro falhou; a view agrupa pelo prefixo.
--
-- PARA REVERTER qualquer um deles, o comando original era exatamente:
--   select net.http_post(
--     url := 'https://kounqtdoioootxqegkij.supabase.co/functions/v1/<slug>',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization', 'Bearer ' || (select segredo from public.segredos_de_cron where nome = '<slug>')),
--     body := '<corpo>'::jsonb, timeout_milliseconds := <timeout>)
select cron.schedule('coletar-dados-07h',  '0 10 * * *',   $$ select public.disparar_robo('coletar-dados-07h',  'coletar-dados', 'coletar-dados', '{"origem":"cron-07h"}'::jsonb,  180000) $$);
select cron.schedule('coletar-dados-12h',  '0 15 * * *',   $$ select public.disparar_robo('coletar-dados-12h',  'coletar-dados', 'coletar-dados', '{"origem":"cron-12h"}'::jsonb,  180000) $$);
select cron.schedule('coletar-dados-18h',  '0 21 * * *',   $$ select public.disparar_robo('coletar-dados-18h',  'coletar-dados', 'coletar-dados', '{"origem":"cron-18h"}'::jsonb,  180000) $$);
select cron.schedule('coletar-dados-2359', '59 2 * * *',   $$ select public.disparar_robo('coletar-dados-2359', 'coletar-dados', 'coletar-dados', '{"origem":"cron-2359"}'::jsonb, 180000) $$);
select cron.schedule('conteudo-hora-h',    '*/5 * * * *',  $$ select public.disparar_robo('conteudo-hora-h',    'conteudo-hora-h',  'conteudo-hora-h',  '{}'::jsonb, 120000) $$);
select cron.schedule('conteudo-espelho',   '*/30 * * * *', $$ select public.disparar_robo('conteudo-espelho',   'conteudo-espelho', 'conteudo-espelho', '{}'::jsonb, 180000) $$);
select cron.schedule('push-vendas-22h',    '0 1 * * *',    $$ select public.disparar_robo('enviar-push-vendas-22h', 'enviar-push-vendas', 'enviar-push-vendas', '{"origem":"cron-22h"}'::jsonb, 180000) $$);
select cron.schedule('push-vendas-07h',    '0 10 * * *',   $$ select public.disparar_robo('enviar-push-vendas-07h', 'enviar-push-vendas', 'enviar-push-vendas', '{"modo":"ontem"}'::jsonb,      180000) $$);
select cron.schedule('push-saldo-08h',     '0 11 * * *',   $$ select public.disparar_robo('enviar-push-saldo-08h',  'enviar-push-saldo',  'enviar-push-saldo',  '{}'::jsonb, 180000) $$);
select cron.schedule('integridade-diaria', '30 2 * * *',   $$ select public.disparar_robo('auditar-dados',          'auditar-dados',      'auditar-dados',      '{"origem":"cron"}'::jsonb, 120000) $$);

-- `fabrica-purga-diaria` ficou DE FORA de propósito. Ele é o único que não usa a
-- tabela de segredos: tem o token escrito em texto puro dentro de
-- cron.job.command — que é exatamente o que segredos_de_cron existe para evitar
-- (ver o cabeçalho de _shared/segredo-de-cron.ts). Instrumentar aqui exigiria
-- mexer nesse segredo, e misturar as duas coisas numa migration só é receita
-- para não conseguir reverter uma sem a outra. Fica anotado como pendência.
