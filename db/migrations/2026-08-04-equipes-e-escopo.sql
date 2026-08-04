-- TIMES DE VENDA: a lista canônica de lojas, canais e setores.
--
-- PEDIDO DO DONO (04/08/2026): "uma vendedora do Tivoli não pode ver nada de
-- outras lojas e outros canais... preciso gerir as equipes de lojas e canais de
-- vendas".
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE ESTA TABELA PRECISA EXISTIR (e não dá para usar o que já há)
--
-- A MESMA LOJA tem QUATRO nomes hoje, um por ferramenta:
--
--   vendas        bling_lojas          "Loja Santa Bárbara d'Oeste"  (id 205834140)
--   patrimônio    patrimonio_locais    "Loja Tivoli"
--   fábrica       fabrica_lojas        "Tivoli (Santa Bárbara)"
--   colaboradores acessos_setores      "Tivoli"
--
-- Sem uma lista canônica, um time chamado "Tivoli" filtrando vendas devolve
-- ZERO — porque a venda está gravada em `canal_loja_id = 205834140`, e ninguém
-- no banco sabe que aquilo é o Tivoli. O dono confirmou a identidade em
-- 04/08/2026; esta tabela é o lugar onde ela passa a estar escrita.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE OS TIMES SÃO DADO, E NÃO CÓDIGO
--
-- "tem dom pedro também, e aí logo terá iguatemi campinas, sorocaba, etc..."
--
-- Loja nova é rotina do negócio, não evento de engenharia. Se cada inauguração
-- exigisse uma migration, a lista envelheceria entre uma e outra — e o pior
-- caso não é a lista faltar, é a vendedora nova ficar sem ver nada e ninguém
-- saber por quê. Por isso: tabela, tela, e nenhuma loja escrita no código.

create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),

  -- O nome que a CASA usa. É este que aparece na tela e no crachá da pessoa —
  -- "Tivoli", e não "Loja Santa Bárbara d'Oeste".
  nome        text not null,

  -- 'loja'  — ponto físico que vende (Tivoli, Dom Pedro, Iguatemi…)
  -- 'canal' — vende sem ponto físico (Atacado Nuvem Shop, Mercado Livre…)
  -- 'setor' — não vende (Marketing, Financeiro). Existe aqui para o mesmo
  --           cadastro servir a quem não é de venda, em vez de nascer um
  --           segundo cadastro de pessoas em paralelo.
  tipo        text not null default 'loja'
              check (tipo in ('loja', 'canal', 'setor')),

  ativo       boolean not null default true,

  -- ── AS QUATRO AMARRAS ─────────────────────────────────────────────────────
  -- Cada uma liga este time ao nome que a ferramenta correspondente usa. Todas
  -- OPCIONAIS de propósito: uma loja que vai abrir tem time e não tem canal no
  -- Bling ainda. Obrigar tudo preenchido impediria de cadastrar o Iguatemi
  -- antes da inauguração — que é exatamente quando se quer cadastrar.

  -- A VENDA. Sem isto o time não mostra faturamento nenhum, e a tela avisa.
  canal_loja_id bigint references public.bling_lojas(loja_id) on delete set null,
  -- O PATRIMÔNIO (qual local físico responde por este time).
  local_id      uuid   references public.patrimonio_locais(id) on delete set null,
  -- OS COLABORADORES (qual setor do cadastro de pessoas).
  setor_id      uuid   references public.acessos_setores(id) on delete set null,
  -- A MARCA / empresa dona.
  empresa_id    uuid   references public.patrimonio_empresas(id) on delete set null,

  ordem       int not null default 100,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.equipes is
  'Times de venda (lojas, canais) e setores: a lista canonica que amarra o nome da casa aos nomes de bling_lojas, patrimonio_locais e acessos_setores.';

-- UM CANAL DO BLING PERTENCE A UM TIME SÓ. Dois times apontando para o mesmo
-- canal fariam a mesma venda ser contada em dois lugares — e a vendedora de um
-- veria o faturamento do outro. Parcial porque canal vazio é caso legítimo
-- (loja que ainda vai abrir), e vários vazios não conflitam entre si.
create unique index if not exists equipes_canal_unico
  on public.equipes (canal_loja_id) where canal_loja_id is not null;

create index if not exists equipes_ativas_idx on public.equipes (ativo, ordem, nome);


-- ─────────────────────────────────────────────────────────────────────────────
-- QUEM É DE QUAL TIME, E COM QUAL PAPEL

create table if not exists public.equipes_membros (
  id         uuid primary key default gen_random_uuid(),
  equipe_id  uuid not null references public.equipes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,

  -- 'vendedora'   — vê o que o time abre; não gere ninguém.
  -- 'supervisora' — vê tudo do time e LIBERA itens do time para quem ela
  --                 escolher (decisão do dono: "o estoque vai ser o nível de
  --                 supervisora que pode ver, e aí a supervisora pode permitir
  --                 que outras pessoas visualizem").
  -- 'gestor'      — administra o time: entra, sai, promove.
  papel      text not null default 'vendedora'
             check (papel in ('vendedora', 'supervisora', 'gestor')),

  criado_em  timestamptz not null default now(),
  criado_por uuid references public.profiles(id) default auth.uid()
);

comment on table public.equipes_membros is
  'Pessoa x time x papel. Uma pessoa pode estar em mais de um time (supervisora de duas lojas, por exemplo).';

-- UMA LINHA POR PESSOA POR TIME. Duas linhas com papéis diferentes deixariam
-- "qual vale?" sem resposta — e a resposta errada aqui é acesso a mais.
create unique index if not exists equipes_membros_unico
  on public.equipes_membros (equipe_id, profile_id);

create index if not exists equipes_membros_por_pessoa
  on public.equipes_membros (profile_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- A CHAVE DA VIRADA SEM SUSTO
--
-- Decisão do dono: "ninguém perde acesso; só o novo nasce fechado".
--
-- `false` = como sempre foi (vê o que a permissão deixa, sem recorte de time).
-- `true`  = só enxerga dado dos times a que pertence.
--
-- O default é `true` para que TODO usuário criado a partir de agora nasça
-- fechado — inclusive os criados por tela, sem ninguém precisar lembrar. Logo
-- abaixo, os que JÁ existem são marcados `false` de uma vez: eles continuam
-- exatamente como estavam hoje.
--
-- (Repare que é o oposto de `allowed_accounts`, onde "vazio" quer dizer "vê
-- tudo". Aquele padrão é de quando o sistema era só para a diretoria; para
-- vendedora ele é perigoso ao contrário.)
alter table public.profiles
  add column if not exists escopo_por_equipe boolean not null default true;

comment on column public.profiles.escopo_por_equipe is
  'true = so enxerga dado dos times a que pertence. Novos usuarios nascem true; os 17 que existiam em 04/08/2026 foram marcados false para nao perderem acesso.';

-- A VIRADA. Sem `where` de propósito: esta migration roda UMA vez, e neste
-- instante só existem os 17 usuários de hoje. Todos eles ficam de fora do
-- escopo; qualquer linha criada depois já nasce com o default `true`.
--
-- (Um `where criado_em < now()` diria a mesma coisa com cara de precisão que
-- não existe — a data de corte é "o momento em que isto rodou", e é o que a
-- ausência de filtro diz.)
update public.profiles set escopo_por_equipe = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- AS FUNÇÕES QUE O RLS VAI USAR
--
-- SECURITY DEFINER porque precisam ler `profiles` e `equipes_membros` de quem
-- está perguntando — e a política que as chama pode estar justamente sobre uma
-- dessas tabelas. Sem isso, a política se consultaria em círculo.

-- Os times da pessoa logada.
create or replace function public.minhas_equipes()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select equipe_id from public.equipes_membros where profile_id = auth.uid();
$$;

-- Pode ver o dado deste time?
--
-- A ORDEM DAS CONDIÇÕES É A REGRA DE NEGÓCIO:
--  1. dono vê tudo;
--  2. quem NÃO está sob escopo por equipe continua como sempre foi;
--  3. o resto vê só os times em que está.
--
-- Repare no que NÃO está aqui: `role = 'admin'`. Hoje `pode_ver_conta` deixa
-- admin furar o escopo inteiro, e são 8 admins em 17 pessoas. Repetir isso aqui
-- faria uma vendedora promovida por engano enxergar todas as lojas. Quem
-- administra tudo deve estar em todos os times, explicitamente — dá o mesmo
-- resultado e fica auditável.
create or replace function public.pode_ver_equipe(p_equipe uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or coalesce((select not escopo_por_equipe from public.profiles where id = auth.uid()), false)
    or (p_equipe is not null and p_equipe in (select public.minhas_equipes()));
$$;

-- Papel da pessoa neste time (null se não é do time).
create or replace function public.meu_papel_na_equipe(p_equipe uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select papel from public.equipes_membros
   where equipe_id = p_equipe and profile_id = auth.uid();
$$;

-- Quem pode ADMINISTRAR este time (mexer em membros).
create or replace function public.sou_gestor_da_equipe(p_equipe uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
      or public.meu_papel_na_equipe(p_equipe) = 'gestor';
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS

alter table public.equipes enable row level security;
alter table public.equipes_membros enable row level security;

-- LER A LISTA DE TIMES é para todo mundo logado, e de propósito: o nome do time
-- não é segredo (ele aparece no crachá da pessoa, no cabeçalho da tela), e sem
-- isso a própria vendedora não conseguiria ler o nome do time DELA.
create policy equipes_leitura on public.equipes
  for select to authenticated using (true);

-- ESCREVER é do dono ou de quem gere aquele time. Criar time novo é do dono e
-- de quem já é gestor de algum: quem não administra nada não inaugura loja.
create policy equipes_criar on public.equipes
  for insert to authenticated with check (
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or exists (select 1 from public.equipes_membros m
                where m.profile_id = auth.uid() and m.papel = 'gestor')
  );

create policy equipes_editar on public.equipes
  for update to authenticated
  using (public.sou_gestor_da_equipe(id))
  with check (public.sou_gestor_da_equipe(id));

-- APAGAR é só do dono. Time apagado leva os membros junto (cascade), e o
-- estrago é silencioso: as pessoas simplesmente param de ver os dados delas.
create policy equipes_apagar on public.equipes
  for delete to authenticated using (
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
  );

-- MEMBROS: cada um enxerga a si mesmo e aos colegas dos times em que está.
create policy membros_leitura on public.equipes_membros
  for select to authenticated using (
    profile_id = auth.uid() or public.pode_ver_equipe(equipe_id)
  );

create policy membros_escrever on public.equipes_membros
  for all to authenticated
  using (public.sou_gestor_da_equipe(equipe_id))
  with check (public.sou_gestor_da_equipe(equipe_id));

-- `atualizado_em` é o que conta a história da lista; deixar a cargo de quem
-- escreve é deixar a cargo de esquecer.
create or replace function public.equipes_toca_atualizado()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists equipes_atualizado on public.equipes;
create trigger equipes_atualizado before update on public.equipes
  for each row execute function public.equipes_toca_atualizado();
