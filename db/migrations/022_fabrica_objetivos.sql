-- SP-3: objetivo da campanha. Coluna na rodada + tabela de config (mapa objetivo -> Meta).
alter table fabrica_campanhas add column if not exists objetivo text not null default 'engajamento';

create table if not exists fabrica_objetivos (
  chave text primary key,
  rotulo text not null,
  descricao text not null default '',
  meta_objective text not null,
  optimization_goal text not null,
  billing_event text not null default 'IMPRESSIONS',
  destination_type text,                 -- null = sem messaging (branding)
  promoted_object_tipo text not null default 'none',  -- whatsapp|page|ig|none
  cta_type text not null default 'LEARN_MORE',
  looks text[] not null default '{}',    -- etiquetas de look que servem
  pede_desconto boolean not null default true,
  ativo boolean not null default true,
  ordem int not null default 0
);

alter table fabrica_objetivos enable row level security;

drop policy if exists fab_obj_read on fabrica_objetivos;
create policy fab_obj_read on fabrica_objetivos for select to authenticated using (true);
-- escrita só service_role (as políticas de write ficam ausentes p/ authenticated => negado)

insert into fabrica_objetivos (chave, rotulo, descricao, meta_objective, optimization_goal, billing_event, destination_type, promoted_object_tipo, cta_type, looks, pede_desconto, ativo, ordem) values
  ('engajamento','Engajamento (WhatsApp)','Conversas no WhatsApp da loja','OUTCOME_ENGAGEMENT','CONVERSATIONS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['engajamento'], true, true, 1),
  ('conversao','Conversão / Vendas','Foco em quem tem intenção de compra','OUTCOME_SALES','CONVERSATIONS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['conversao'], true, true, 2),
  ('branding','Reconhecimento','Alcance de marca, leva ao Instagram','OUTCOME_AWARENESS','REACH','IMPRESSIONS', null,'none','LEARN_MORE', array['branding'], false, true, 3),
  ('trafego','Tráfego','Manda o máximo de gente pro destino','OUTCOME_TRAFFIC','LINK_CLICKS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['trafego'], true, true, 4)
on conflict (chave) do nothing;
