-- A árvore Empresa › Local › Cômodo vira universal: a Frota passa a usar a
-- MESMA lista do Patrimônio em vez de campo de digitar livre.
--
-- O PEDIDO, com as palavras do dono: "campos que puxam marca, local, ambiente
-- precisam ser universais também, mostrar lista em árvores... fui editar a
-- ficha de carro BMW, aí tem lá campo local, eu digito ao invés de já mostrar
-- tudo o que já temos em banco".
--
-- O QUE ISSO CONSERTA, medido no banco antes de escrever esta migration:
--   patrimonio_locais tem 18 linhas e patrimonio_comodos 55, com 342 dos 350
--   bens já usando. A Frota ignorava tudo: `local_texto` é texto livre, e o
--   que digitaram foi "Casa RB" (acertou), "Conchal" (o local real chama
--   "Fábrica Conchal") e "Barracão" (não existe local nenhum com esse nome).
--
-- O QUE **NÃO** É DUPLICATA — e é a razão de a árvore ter TRÊS níveis:
--   Fábrica Conchal (Vessel)      15 cômodos, 148 bens
--   Fábrica Conchal (RB Builders)  0 cômodos,   2 bens
--   Sede Limeira    (RBV Company) 13 cômodos,  40 bens
--   Sede Limeira    (Vessel)       5 cômodos,  10 bens
--   Mesmo endereço, EMPRESAS DIFERENTES. Juntar embolaria o patrimônio de duas
--   empresas do grupo. O defeito real é a tela mostrar "Fábrica Conchal" duas
--   vezes sem dizer de quem é — quem escolhe não tem como acertar. Por isso a
--   empresa faz parte da árvore, e nada aqui mescla nada.

begin;

-- ── 1. O veículo aponta pra árvore ───────────────────────────────────────────
-- `empresa_id` é campo PRÓPRIO, e não deduzido do local: decisão do dono. Um
-- carro da RBV Company pode passar a semana estacionado na Fábrica Conchal da
-- Vessel sem por isso virar patrimônio da Vessel. De quem o carro É e onde ele
-- ESTÁ são perguntas diferentes, e amarrar as duas daria a resposta errada
-- justamente nos casos que motivaram o campo.
alter table public.frota_veiculos
  add column if not exists empresa_id uuid references public.patrimonio_empresas(id) on delete set null,
  add column if not exists local_id   uuid references public.patrimonio_locais(id)   on delete set null,
  add column if not exists comodo_id  uuid references public.patrimonio_comodos(id)  on delete set null;

-- ON DELETE SET NULL, nunca CASCADE: apagar um local do Patrimônio não pode
-- levar junto a ficha de um carro. O carro perde o endereço, não a existência.

create index if not exists frota_veiculos_empresa_idx on public.frota_veiculos(empresa_id);
create index if not exists frota_veiculos_local_idx   on public.frota_veiculos(local_id);
create index if not exists frota_veiculos_comodo_idx  on public.frota_veiculos(comodo_id);

comment on column public.frota_veiculos.empresa_id is
  'De qual empresa do grupo é o carro. Independente de local_id de propósito: o carro pode estar guardado em local de outra empresa.';
comment on column public.frota_veiculos.local_id is
  'Onde o carro fica, apontando pra árvore do Patrimônio. Substitui local_texto, que fica preservado até alguém apontar.';
comment on column public.frota_veiculos.local_texto is
  'O endereço ANTIGO, digitado à mão antes da árvore existir ("Conchal", "Barracão"). NÃO APAGAR: é a única pista de onde o carro estava, e "Conchal" NÃO é evidência de "Fábrica Conchal" — existe Fábrica Conchal de duas empresas, então adivinhar erraria metade das vezes no melhor caso. A tela mostra o texto com aviso e deixa a pessoa apontar.';

-- ── 2. Quem usa a Frota precisa ENXERGAR a árvore ────────────────────────────
-- Sem isto o seletor abriria VAZIO e o defeito seria pior que o original: hoje
-- as três tabelas só têm a política `..._rw` com `is_patrimonio_admin()`, e a
-- maioria dos motoristas não é admin do Patrimônio. Falha silenciosa clássica
-- — RLS não dá erro, só devolve zero linha.
-- `drop ... if exists` antes de cada `create`: o Postgres não aceita
-- `create policy if not exists`, e sem isto rodar a migration duas vezes
-- quebraria no meio — deixando as colunas criadas e as políticas pela metade.
drop policy if exists patrimonio_empresas_leitura_frota on public.patrimonio_empresas;
create policy patrimonio_empresas_leitura_frota on public.patrimonio_empresas
  for select using (public.is_frota_admin());
drop policy if exists patrimonio_locais_leitura_frota on public.patrimonio_locais;
create policy patrimonio_locais_leitura_frota on public.patrimonio_locais
  for select using (public.is_frota_admin());
drop policy if exists patrimonio_comodos_leitura_frota on public.patrimonio_comodos;
create policy patrimonio_comodos_leitura_frota on public.patrimonio_comodos
  for select using (public.is_frota_admin());

-- ── 3. E precisa poder ACRESCENTAR quando faltar a opção ─────────────────────
-- A regra vale pra central inteira: "se ainda n tiver a opção pretendida, já
-- ter um botãozinho + pra adicionar" — sem isso a pessoa TRAVA no meio do
-- cadastro. Só INSERT: criar um local a mais não estraga nada de ninguém.
-- UPDATE e DELETE continuam exclusivos do Patrimônio (a política `..._rw`),
-- porque RENOMEAR ou APAGAR um local muda o endereço de até 148 bens que não
-- são da Frota — é aí que mora o estrago, e é o Patrimônio que manda no que a
-- coisa É.
drop policy if exists patrimonio_empresas_criar_frota on public.patrimonio_empresas;
create policy patrimonio_empresas_criar_frota on public.patrimonio_empresas
  for insert with check (public.is_frota_admin());
drop policy if exists patrimonio_locais_criar_frota on public.patrimonio_locais;
create policy patrimonio_locais_criar_frota on public.patrimonio_locais
  for insert with check (public.is_frota_admin());
drop policy if exists patrimonio_comodos_criar_frota on public.patrimonio_comodos;
create policy patrimonio_comodos_criar_frota on public.patrimonio_comodos
  for insert with check (public.is_frota_admin());

commit;
