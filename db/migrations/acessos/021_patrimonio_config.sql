-- Configuração do módulo Patrimônio. Hoje guarda só uma coisa: até que número a
-- numeração das etiquetas vai.
--
-- Por que tabela e não localStorage: o teto da numeração é decisão da EMPRESA.
-- Guardado no navegador, cada pessoa veria um limite diferente, e quem entrasse
-- de outro aparelho acharia que a numeração encolheu.

create table if not exists public.patrimonio_config(
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.patrimonio_config enable row level security;
drop policy if exists patrimonio_config_rw on public.patrimonio_config;
create policy patrimonio_config_rw on public.patrimonio_config for all to authenticated
  using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());

-- 400 porque o dono já usa de 1 a 380: é o teto natural de partida, com folga.
insert into public.patrimonio_config(chave, valor) values ('numero_maximo', '400')
on conflict (chave) do nothing;
