-- Controle de Acessos — base manual (pessoas, dispositivos, termos, config, log)
create table if not exists public.acessos_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  email_pessoal text,
  apple_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.acessos_dispositivos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  tipo text not null check (tipo in ('celular','macbook','notebook','numero_celular','carro','outro')),
  descricao text not null,
  identificador text,
  status text not null default 'em_uso' check (status in ('em_uso','a_devolver','devolvido','perdido')),
  desde date,
  observacao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_acessos_disp_pessoa on public.acessos_dispositivos(pessoa_id);

create table if not exists public.acessos_termos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  dispositivo_ids uuid[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho','pendente','assinado','encerrado')),
  modelo_versao text,
  pdf_path text,
  assinado_path text,
  gerado_em timestamptz,
  assinado_em timestamptz,
  encerrado_em timestamptz,
  observacao text
);
create index if not exists idx_acessos_termos_pessoa on public.acessos_termos(pessoa_id);

create table if not exists public.acessos_config (
  id int primary key default 1 check (id = 1),
  empresa text,
  modelo_termo text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.acessos_log (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  quem uuid,
  acao text not null,
  provedor text,
  alvo text,
  resultado text not null default 'ok' check (resultado in ('ok','erro')),
  detalhe text
);

-- linha única de config com um modelo de termo padrão
insert into public.acessos_config (id, empresa, modelo_termo)
values (1, 'RBV Company',
'TERMO DE RESPONSABILIDADE DE EQUIPAMENTO

Eu, {{nome}} ({{cargo}}), declaro ter recebido de {{empresa}} os itens abaixo, comprometendo-me a zelar pela sua guarda e conservacao e a devolve-los quando solicitado:

{{itens}}

Data: {{data}}

Assinatura: ____________________________________________')
on conflict (id) do nothing;
