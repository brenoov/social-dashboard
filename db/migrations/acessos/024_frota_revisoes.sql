-- Frota F4: histórico de revisões, para o alerta por quilometragem funcionar.
--
-- O plano (frota_plano_revisao, migration 022) diz DE QUANTO EM QUANTO km cada
-- item se troca. Esta tabela diz QUANDO cada um foi trocado pela última vez em
-- cada carro. Com os dois, mais o KM que já vem sozinho das devoluções, o
-- alerta se calcula — que é exatamente o que a aba "Alertas" da planilha nunca
-- conseguiu, porque dependia de alguém digitar o KM à mão.

create table if not exists public.frota_revisoes(
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.frota_veiculos(id) on delete cascade,
  -- Texto e não chave estrangeira de propósito: o dono pode renomear ou apagar
  -- um item do plano, e o histórico do que já foi feito não pode sumir junto.
  -- Troca de óleo feita em 2026 continua tendo acontecido.
  item text not null,
  km int check (km >= 0),
  feita_em date,
  oficina text,
  custo_centavos bigint,
  observacao text,
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_frota_rev_veiculo on public.frota_revisoes(veiculo_id, item, km desc);

-- O plano ganha o que faltava pra ser editável de verdade pelo dono.
alter table public.frota_plano_revisao add column if not exists observacao text;

alter table public.frota_revisoes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='frota_revisoes' and policyname='frota_rev_ler') then
    create policy frota_rev_ler on public.frota_revisoes for select using (public.is_frota_admin());
  end if;
  -- Registrar revisão é trabalho de quem administra, não de quem dirige.
  if not exists (select 1 from pg_policies where tablename='frota_revisoes' and policyname='frota_rev_escrever') then
    create policy frota_rev_escrever on public.frota_revisoes for all
      using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
end $$;
