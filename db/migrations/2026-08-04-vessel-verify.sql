-- A pagina publica do certificado (vesselbrasil.com.br/verify/<codigo>).
--
-- POR QUE FUNCAO E NAO TABELA: a pagina e publica e carrega a chave anonima no
-- proprio HTML. Se o anon pudesse dar SELECT em vessel_pecas, qualquer um
-- baixaria a lista inteira de codigos e gravaria mil tags clonadas. Entao as
-- tabelas ficam com RLS ligada e ZERO politica, e todo acesso passa por duas
-- funcoes security definer que devolvem so o necessario.
--
-- A GARANTIA E DE 2 ANOS PARA TODO MUNDO. O registro nao estende nada: ele
-- guarda a garantia em nome da cliente, substituindo o certificado de papel que
-- hoje depende de a loja preencher a mao ("ASSEGURE-SE DO CORRETO PREENCHIMENTO
-- DO SEU CERTIFICADO PELA LOJA" — texto do proprio certificado impresso).
--
-- A tag NFC sozinha nao impede copia: ela guarda um link, e link se copia. O que
-- protege e o codigo ser unico por peca + o registro. Por isso TODA leitura fica
-- guardada, inclusive a de codigo que nao existe: tentativa de adivinhar codigo
-- e o primeiro sinal de falsificacao.

create table if not exists public.vessel_lotes (
  id            uuid primary key default gen_random_uuid(),
  modelo        text not null,
  cor           text,
  sku           text,
  quantidade    int  not null,
  fabricado_em  date not null default current_date,
  criado_por    uuid,
  criado_em     timestamptz not null default now()
);

create table if not exists public.vessel_pecas (
  codigo           text primary key,
  lote_id          uuid references public.vessel_lotes(id) on delete cascade,
  numero_na_serie  int  not null,
  gravada_em       timestamptz,
  criado_em        timestamptz not null default now()
);

comment on column public.vessel_pecas.gravada_em is
  'Quando a tag NFC desta peca foi efetivamente gravada. Nulo = codigo criado mas tag ainda em branco.';

-- O codigo como chave primaria e o que impede DUAS donas para a mesma peca.
-- Regra de negocio no banco, nao na tela.
create table if not exists public.vessel_registros (
  codigo         text primary key references public.vessel_pecas(codigo) on delete cascade,
  nome           text not null,
  whatsapp       text not null,
  onde_comprou   text,
  comprado_em    date,
  garantia_ate   date not null,
  registrado_em  timestamptz not null default now()
);

create table if not exists public.vessel_leituras (
  id        bigserial primary key,
  codigo    text not null,
  achou     boolean not null,
  agente    text,
  ip_hash   text,
  lido_em   timestamptz not null default now()
);

create index if not exists vessel_leituras_codigo_idx on public.vessel_leituras (codigo, lido_em desc);

alter table public.vessel_lotes     enable row level security;
alter table public.vessel_pecas     enable row level security;
alter table public.vessel_registros enable row level security;
alter table public.vessel_leituras  enable row level security;

-- Sem policy nenhuma, de proposito: nem anon nem authenticated leem direto. O
-- painel da fase 2 vai ler por funcoes proprias, gateadas por permissao.

-- Consulta publica. Grava a leitura ACHANDO OU NAO.
-- OBS: pgcrypto mora no schema `extensions` neste projeto, entao digest() e
-- chamado qualificado — sem isso a funcao quebra em producao, ja que o
-- search_path e fixado em public.
create or replace function public.vessel_verificar(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[\s.\-_]', '', 'g'));
  v_peca   record;
  v_reg    record;
  v_cab    json := nullif(current_setting('request.headers', true), '')::json;
begin
  select p.codigo, p.numero_na_serie, l.modelo, l.cor, l.quantidade, l.fabricado_em
    into v_peca
    from public.vessel_pecas p
    join public.vessel_lotes l on l.id = p.lote_id
   where p.codigo = v_codigo;

  insert into public.vessel_leituras (codigo, achou, agente, ip_hash)
  values (
    left(v_codigo, 32),
    v_peca.codigo is not null,
    left(coalesce(v_cab ->> 'user-agent', ''), 300),
    encode(extensions.digest(coalesce(v_cab ->> 'x-forwarded-for', 'sem-ip'), 'sha256'), 'hex')
  );

  if v_peca.codigo is null then
    return json_build_object('ok', false);
  end if;

  select * into v_reg from public.vessel_registros where codigo = v_codigo;

  return json_build_object(
    'ok', true,
    'modelo', v_peca.modelo,
    'cor', v_peca.cor,
    'numero', v_peca.numero_na_serie,
    'total', v_peca.quantidade,
    'fabricado_em', v_peca.fabricado_em,
    'registrada', v_reg.codigo is not null,
    -- so o primeiro nome + ***: quem tem a bolsa se reconhece, e quem esta
    -- lendo tag alheia nao colhe nome de cliente.
    'nome_mascarado', case when v_reg.codigo is null then null
                           else split_part(v_reg.nome, ' ', 1) || '***' end,
    'registrada_em', v_reg.registrado_em,
    'garantia_ate', v_reg.garantia_ate
  );
end;
$$;

-- Registro da garantia. Recusa peca inexistente e peca ja registrada.
create or replace function public.vessel_registrar(
  p_codigo text, p_nome text, p_whatsapp text, p_onde text, p_comprado_em date
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[\s.\-_]', '', 'g'));
  v_zap    text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_ate    date;
  v_reg    record;
begin
  if not exists (select 1 from public.vessel_pecas where codigo = v_codigo) then
    return json_build_object('ok', false, 'motivo', 'nao_existe');
  end if;

  select * into v_reg from public.vessel_registros where codigo = v_codigo;
  if v_reg.codigo is not null then
    return json_build_object('ok', false, 'motivo', 'ja_registrada',
                             'registrada_em', v_reg.registrado_em);
  end if;

  if coalesce(trim(p_nome), '') = '' or length(v_zap) not in (10, 11) then
    return json_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  -- 2 anos contados da COMPRA. Sem data da compra, conta de hoje.
  v_ate := (coalesce(p_comprado_em, current_date) + interval '2 years')::date;

  insert into public.vessel_registros (codigo, nome, whatsapp, onde_comprou, comprado_em, garantia_ate)
  values (v_codigo, left(trim(p_nome), 120), v_zap, left(nullif(trim(coalesce(p_onde, '')), ''), 120), p_comprado_em, v_ate);

  return json_build_object('ok', true, 'garantia_ate', v_ate);
end;
$$;

revoke all on function public.vessel_verificar(text) from public;
revoke all on function public.vessel_registrar(text, text, text, text, date) from public;
grant execute on function public.vessel_verificar(text) to anon, authenticated;
grant execute on function public.vessel_registrar(text, text, text, text, date) to anon, authenticated;

-- LOTE DE DEMONSTRACAO: 5 codigos fixos (escolhidos a mao, nao sorteados) pra
-- gravar numa tag e provar a coisa funcionando no celular antes de existir
-- painel. Modelo real da linha, pra demonstracao nao parecer maquete.
insert into public.vessel_lotes (id, modelo, cor, sku, quantidade, fabricado_em)
values ('00000000-0000-4000-8000-000000000001', 'Altiva', 'Preto Espresso', 'DEMO-ALTIVA', 20, '2026-03-01')
on conflict (id) do nothing;

insert into public.vessel_pecas (codigo, lote_id, numero_na_serie)
values
  ('K7M4X9QP2R', '00000000-0000-4000-8000-000000000001', 7),
  ('T3H8ZC5WVN', '00000000-0000-4000-8000-000000000001', 8),
  ('B6RJ2YKD9F', '00000000-0000-4000-8000-000000000001', 9),
  ('X4NQ7PLM3S', '00000000-0000-4000-8000-000000000001', 10),
  ('G9WD5TBK6H', '00000000-0000-4000-8000-000000000001', 11)
on conflict (codigo) do nothing;
