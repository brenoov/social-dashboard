-- Cadastros do Patrimônio viram uma ÁRVORE de verdade: Marca → Local → Cômodo.
--
-- Motivo (pedido do dono): a tela de Listas despejava 4 listas planas de uma vez
-- e "embaralhava a cabeça" na hora de editar. Com o aninhamento, você edita os
-- locais DENTRO da marca e os cômodos DENTRO do local.
--
-- O que isso custa, e é consciente: um nome de cômodo que se repete em locais
-- diferentes passa a ser um cadastro por local ("Sala de Reunião" aparece em 5
-- lugares = 5 linhas). É o preço de o cadastro espelhar a navegação. Como não há
-- NENHUM bem cadastrado ainda (conferido: 0 bens, 0 posse, 0 log), dá pra
-- reescrever os cadastros sem migrar dado nem perder referência.
--
-- A hierarquia semeada abaixo NÃO foi inventada: saiu da planilha real do dono
-- (Zoho WorkDrive → Controle Patrimonio.xlsx, aba Base), cruzando Unidade com
-- Empresa (marca dominante de cada local) e Unidade com Setor (cômodos reais de
-- cada local).

-- ── 1. Colunas de parentesco ─────────────────────────────────────────────────
alter table public.patrimonio_locais  add column if not exists empresa_id uuid;
alter table public.patrimonio_comodos add column if not exists local_id   uuid;

-- ── 2. Derruba a unicidade ANTIGA antes de inserir ───────────────────────────
-- Precisa vir aqui, não no fim: o modelo velho tinha unique(nome) global, e é
-- exatamente ele que impediria "Operação Loja" de existir em três lojas.
alter table public.patrimonio_locais  drop constraint if exists patrimonio_locais_nome_key;
alter table public.patrimonio_comodos drop constraint if exists patrimonio_comodos_nome_key;

-- ── 3. Zera os cadastros planos (não há bem apontando pra eles) ──────────────
delete from public.patrimonio_comodos;
delete from public.patrimonio_locais;

-- ── 4. Marcas: as 5 da planilha, mais nada ───────────────────────────────────
insert into public.patrimonio_empresas(nome, ordem) values
  ('Vessel',1),('Moto Easy',2),('RBV Company',3),('RB Builders',4),('Mantova',5)
on conflict (nome) do nothing;

-- ── 5. Locais, cada um dentro da sua marca ───────────────────────────────────
insert into public.patrimonio_locais(nome, ordem, empresa_id)
select v.nome, v.ordem, e.id
from (values
  ('Fábrica Conchal',1,'Vessel'),
  ('Loja Tivoli',2,'Vessel'),
  ('Loja Dom Pedro',3,'Vessel'),
  ('Loja Hortolândia',4,'Vessel'),
  ('Operação Lojas',5,'Vessel'),
  ('Escritório Desenvolvimento - Itatiba',6,'Vessel'),
  ('Casa Humberto',7,'Vessel'),
  ('Piracicaba',1,'Moto Easy'),
  ('Sede Limeira',1,'RBV Company'),
  ('Escritório Centro Limeira',2,'RBV Company'),
  ('Escritório Casa Breno',3,'RBV Company'),
  ('Showroom Limeira',1,'Mantova')
) as v(nome, ordem, marca)
join public.patrimonio_empresas e on e.nome = v.marca;

-- ── 6. Cômodos, cada um dentro do seu local ─────────────────────────────────
-- Vindos do cruzamento Unidade × Setor da planilha. Duas correções de digitação
-- aplicadas: "ADMINISTRATIVO" virou "Administrativo" (mesma coisa em CAIXA ALTA)
-- e "Fabrica Conchal" ficou com o nome acentuado. O resto foi mantido como está
-- na planilha, inclusive nomes específicos como "Sala da Raissa" — corrigir o
-- que é do dono, sem pedir, seria pior do que deixar ele editar na tela.
insert into public.patrimonio_comodos(nome, ordem, local_id)
select v.nome, v.ordem, l.id
from (values
  ('Produção',1,'Fábrica Conchal'),
  ('Administrativo',2,'Fábrica Conchal'),
  ('Cozinha',3,'Fábrica Conchal'),
  ('Estoque',4,'Fábrica Conchal'),
  ('Sala Administrativa',5,'Fábrica Conchal'),
  ('Sala de Reunião',6,'Fábrica Conchal'),
  ('Diretoria',7,'Fábrica Conchal'),
  ('Qualidade',8,'Fábrica Conchal'),
  ('Estoque de Produtos Acabados',9,'Fábrica Conchal'),
  ('Gerência',10,'Fábrica Conchal'),
  ('Corte',11,'Fábrica Conchal'),
  ('Faturamento',12,'Fábrica Conchal'),
  ('Supervisão Fábrica',13,'Fábrica Conchal'),
  ('Escritório',14,'Fábrica Conchal'),
  ('Sala da Raissa',15,'Fábrica Conchal'),

  ('Diretoria',1,'Sede Limeira'),
  ('Sala de Reunião',2,'Sede Limeira'),
  ('RH',3,'Sede Limeira'),
  ('Financeiro',4,'Sede Limeira'),
  ('Atacado',5,'Sede Limeira'),
  ('Administrativo',6,'Sede Limeira'),
  ('Financeiro - Estoque',7,'Sede Limeira'),
  ('Marketing',8,'Sede Limeira'),
  ('Planejamento',9,'Sede Limeira'),
  ('Suprimentos',10,'Sede Limeira'),
  ('Engenharia',11,'Sede Limeira'),
  ('Operação Loja',12,'Sede Limeira'),
  ('TI',13,'Sede Limeira'),

  ('Estoque',1,'Piracicaba'),
  ('Sala de Reunião',2,'Piracicaba'),
  ('Administrativo',3,'Piracicaba'),
  ('Sala de Espera',4,'Piracicaba'),
  ('Comercial',5,'Piracicaba'),
  ('Gerência',6,'Piracicaba'),
  ('Cozinha',7,'Piracicaba'),

  ('Operação Loja',1,'Loja Tivoli'),
  ('Operação Loja',1,'Loja Hortolândia'),
  ('Operação Loja',1,'Loja Dom Pedro'),
  ('Supervisão Lojas',2,'Loja Dom Pedro'),

  ('Financeiro',1,'Escritório Centro Limeira'),
  ('Marketing',2,'Escritório Centro Limeira'),
  ('Diretoria',3,'Escritório Centro Limeira'),
  ('Contabilidade',4,'Escritório Centro Limeira'),

  ('Diretoria',1,'Escritório Casa Breno'),
  ('Gerência',1,'Operação Lojas'),
  ('Sala de Reunião',1,'Escritório Desenvolvimento - Itatiba'),
  ('Sala de Reunião',1,'Showroom Limeira')
) as v(nome, ordem, local)
join public.patrimonio_locais l on l.nome = v.local;

-- ── 7. Agora que todo mundo tem pai, exige o parentesco ─────────────────────
alter table public.patrimonio_locais  alter column empresa_id set not null;
alter table public.patrimonio_comodos alter column local_id   set not null;

alter table public.patrimonio_locais  drop constraint if exists patrimonio_locais_empresa_fk;
alter table public.patrimonio_locais  add  constraint patrimonio_locais_empresa_fk
  foreign key (empresa_id) references public.patrimonio_empresas(id) on delete cascade;

alter table public.patrimonio_comodos drop constraint if exists patrimonio_comodos_local_fk;
alter table public.patrimonio_comodos add  constraint patrimonio_comodos_local_fk
  foreign key (local_id) references public.patrimonio_locais(id) on delete cascade;

-- ── 8. Unicidade passa a valer DENTRO do pai ────────────────────────────────
-- "Sala de Reunião" pode existir em vários locais; o que não pode é existir duas
-- vezes no MESMO local.
create unique index if not exists uq_patrimonio_locais_marca_nome  on public.patrimonio_locais(empresa_id, nome);
create unique index if not exists uq_patrimonio_comodos_local_nome on public.patrimonio_comodos(local_id, nome);

create index if not exists idx_patrimonio_locais_empresa on public.patrimonio_locais(empresa_id);
create index if not exists idx_patrimonio_comodos_local  on public.patrimonio_comodos(local_id);
