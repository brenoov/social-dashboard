-- QUAL INTERAÇÃO cada campanha/anúncio de engajamento está comprando.
-- Declaração MANUAL do dono: a Meta não diz isso, e o mesmo formato de anúncio
-- pode ser feito pra colecionar salvamento ou pra puxar comentário.
--
-- Por que precisa existir: medido em 90 dias, curtida custa R$0,12 e salvamento
-- custa R$48 — 400 vezes mais. O ponto ponderado (83% curtida em volume) sempre
-- premia quem compra curtida. Sem declarar o alvo, campanha de salvamento é
-- julgada num mercado que não é o dela.
create table if not exists public.gt_objetivo_interacao (
  alvo_id     text primary key,                 -- id da campanha OU do anúncio na Meta
  nivel       text not null check (nivel in ('campanha','anuncio')),
  interacao   text not null check (interacao in ('curtidas','comentarios','salvamentos','compartilhamentos')),
  conta_id    uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.gt_objetivo_interacao enable row level security;

drop policy if exists objetivo_interacao_leitura on public.gt_objetivo_interacao;
create policy objetivo_interacao_leitura on public.gt_objetivo_interacao
  for select to authenticated using (true);

-- Escrita: mesma regra da régua (quem edita a ferramenta), espelhando gt_config_metricas.
drop policy if exists objetivo_interacao_escrita on public.gt_objetivo_interacao;
create policy objetivo_interacao_escrita on public.gt_objetivo_interacao
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and (p.role = 'admin' or 'meta.gestor' = any(p.features))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and (p.role = 'admin' or 'meta.gestor' = any(p.features))));

-- METAS POR INTERAÇÃO, medidas nas campanhas reais (90 dias):
--   curtida R$0,12 · compartilhamento R$13-21 · salvamento R$48-51 · comentário R$128-172
-- Critério: um pouco abaixo do praticado, pra meta querer dizer "melhor que hoje".
-- O comentário fica com dado FRACO (151 no total) — o dono decidiu manter mesmo
-- assim, ciente disso.
update public.gt_ponderada_config
set metas = metas
  || '{"curtidas":0.10,"compartilhamentos":15.00,"salvamentos":45.00,"comentarios":150.00}'::jsonb,
    updated_at = now()
where id = 1;

select metas from public.gt_ponderada_config where id = 1;
