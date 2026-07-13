-- SP-5 Fase A: metadata curável dos looks (o render fica em templates.mjs). Escrita via Edge fabrica-looks.
create table if not exists fabrica_looks (
  chave text primary key,
  nome text not null,
  arquetipo text not null,                 -- produto | promo | branding
  objetivos text[] not null default '{}',  -- engajamento|conversao|branding|trafego; vazio = todos
  ativo boolean not null default true,
  ordem int not null default 0,
  preview_url text,
  tipo text not null default 'codigo',      -- codigo | canva
  canva_formato_map jsonb not null default '{}'::jsonb,
  campo_map jsonb not null default '{}'::jsonb,
  criado_por uuid,
  created_at timestamptz not null default now()
);

alter table fabrica_looks enable row level security;
drop policy if exists fab_looks_read on fabrica_looks;
create policy fab_looks_read on fabrica_looks for select to authenticated using (true);

-- seed dos 13 code-looks (chave/nome/arquetipo/objetivos = registry atual). Idempotente: não sobrescreve curadoria.
insert into fabrica_looks (chave, nome, arquetipo, objetivos, ordem) values
  ('promo-number-hero','Promo · Number Hero','promo', array['engajamento','conversao','trafego'], 1),
  ('produto-heroi','Produto · Herói','produto', array['engajamento','conversao','trafego'], 2),
  ('produto-preco-tipo','Produto · Preço Tipográfico','produto', array['engajamento','conversao','trafego'], 3),
  ('produto-sage-circulo','Produto · Sage Círculo','produto', array['engajamento','conversao','trafego'], 4),
  ('promo-sage','Promo · Sage','promo', array['engajamento','conversao','trafego'], 5),
  ('promo-minimal-pearl','Promo · Minimal Pearl','promo', array['engajamento','conversao','trafego'], 6),
  ('promo-burnt-wood','Promo · Burnt Wood','promo', array['engajamento','conversao','trafego'], 7),
  ('editorial-sale','Editorial · Sale','produto', array['engajamento','conversao','trafego'], 8),
  ('editorial-v2','Editorial · V2','produto', array['engajamento','conversao','trafego'], 9),
  ('produto-split','Produto · Split','produto', array['engajamento','conversao','trafego'], 10),
  ('produto-modelo','Produto · Modelo','produto', array['engajamento','conversao','trafego'], 11),
  ('marca-lifestyle','Marca · Lifestyle','produto', array['branding'], 12),
  ('marca-editorial','Marca · Editorial','produto', array['branding'], 13)
on conflict (chave) do nothing;
