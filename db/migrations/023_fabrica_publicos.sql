-- SP-4: presets de público (targeting reutilizável). Escrita via Edge fabrica-publicos (service-role).
create table if not exists fabrica_publicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  marca_id uuid references fabrica_marcas(id) on delete set null,
  geo jsonb not null default '{}'::jsonb,           -- { cities:[{key,radius,distance_unit}], excluded:[{key,type}] }
  idade_min int not null default 18,
  idade_max int not null default 65,
  generos int[] not null default '{}',              -- 1=masc, 2=fem; vazio = todos
  interesses jsonb not null default '[]'::jsonb,     -- [{id,name}]
  custom_audiences jsonb not null default '[]'::jsonb, -- [{id,name,subtype}] (Fase B)
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now()
);

alter table fabrica_publicos enable row level security;

drop policy if exists fab_pub_read on fabrica_publicos;
create policy fab_pub_read on fabrica_publicos for select to authenticated using (true);
-- escrita só service_role (sem policy de write p/ authenticated => negado)
