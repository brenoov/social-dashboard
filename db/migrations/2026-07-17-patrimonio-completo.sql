-- Patrimonio completo: valor do bem + historico de posse.
--
-- Contexto: a ferramenta de Acessos vai virar controle de patrimonio de verdade
-- (categoria + valor + quem teve o item antes). A coluna "categoria" e o jsonb
-- "detalhes" ja existiam; faltava o valor e o historico de posse.

alter table public.acessos_dispositivos
  add column if not exists valor_centavos bigint;

comment on column public.acessos_dispositivos.valor_centavos is
  'Valor do bem em centavos (inteiro, nunca float pra dinheiro). NULL = nao informado.';

-- Quem teve cada item e quando. "ate" nulo = posse atual.
create table if not exists public.acessos_patrimonio_historico (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.acessos_dispositivos(id) on delete cascade,
  -- pessoa_id vira NULL se a pessoa for apagada, mas pessoa_nome fica congelado:
  -- o historico nao pode perder "quem teve" so porque a pessoa saiu da base.
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  de date not null,
  ate date,
  motivo text,
  criado_em timestamptz not null default now()
);

comment on table public.acessos_patrimonio_historico is
  'Quem teve cada item de patrimonio e quando. ate=null e a posse atual.';

create index if not exists acessos_patrimonio_hist_dispositivo
  on public.acessos_patrimonio_historico (dispositivo_id, de desc);

alter table public.acessos_patrimonio_historico enable row level security;

-- Policy ESPELHADA da tabela irma acessos_dispositivos (acessos_dispositivos_rw):
-- ALL para authenticated, gated por is_acessos_admin(). Mesmo guarda, mesma regra.
drop policy if exists acessos_patrimonio_historico_rw on public.acessos_patrimonio_historico;
create policy acessos_patrimonio_historico_rw
  on public.acessos_patrimonio_historico
  as permissive for all to authenticated
  using (is_acessos_admin())
  with check (is_acessos_admin());
