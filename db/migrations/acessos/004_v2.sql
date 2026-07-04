-- setores
create table if not exists public.acessos_setores(
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.acessos_setores enable row level security;
drop policy if exists acessos_setores_rw on public.acessos_setores;
create policy acessos_setores_rw on public.acessos_setores for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
insert into public.acessos_setores(nome,ordem) values
  ('Diretoria',1),('Administrativo',2),('RH',3),('Marketing',4),('Comercial',5),('TI / Operações',6)
on conflict (nome) do nothing;

-- colaboradores (acessos_pessoas)
alter table public.acessos_pessoas drop column if exists email_pessoal;
alter table public.acessos_pessoas drop column if exists apple_id;
alter table public.acessos_pessoas add column if not exists setor_id uuid references public.acessos_setores(id) on delete set null;
alter table public.acessos_pessoas add column if not exists email_corporativo text;
alter table public.acessos_pessoas add column if not exists numero_pessoal text;
alter table public.acessos_pessoas add column if not exists numero_corporativo text;
alter table public.acessos_pessoas add column if not exists data_inicio_contrato date;
alter table public.acessos_pessoas add column if not exists data_fim_contrato date;
alter table public.acessos_pessoas add column if not exists motivo_saida text;
alter table public.acessos_pessoas drop constraint if exists acessos_pessoas_status_check;
update public.acessos_pessoas set status='desligado' where status='inativo';
alter table public.acessos_pessoas add constraint acessos_pessoas_status_check check (status in ('ativo','desligado'));
create index if not exists idx_acessos_pessoas_setor on public.acessos_pessoas(setor_id);

-- dispositivos: categoria + detalhes + tipo livre
alter table public.acessos_dispositivos add column if not exists categoria text not null default 'dispositivo';
alter table public.acessos_dispositivos drop constraint if exists acessos_dispositivos_categoria_check;
alter table public.acessos_dispositivos add constraint acessos_dispositivos_categoria_check check (categoria in ('dispositivo','veiculo'));
alter table public.acessos_dispositivos add column if not exists detalhes jsonb not null default '{}'::jsonb;
alter table public.acessos_dispositivos drop constraint if exists acessos_dispositivos_tipo_check;

-- termos: recriar como documentos enviados
drop table if exists public.acessos_termos cascade;
create table public.acessos_termos(
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  titulo text,
  arquivo_path text not null,
  enviado_em timestamptz not null default now(),
  observacao text
);
alter table public.acessos_termos enable row level security;
drop policy if exists acessos_termos_rw on public.acessos_termos;
create policy acessos_termos_rw on public.acessos_termos for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
create index if not exists idx_acessos_termos_pessoa on public.acessos_termos(pessoa_id);
