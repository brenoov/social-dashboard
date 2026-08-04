-- O RECORTE DE VERDADE: vendas e estoque passam a respeitar o time.
--
-- A fundação (equipes, membros, papéis) subiu antes e não mudava nada. Esta
-- migration é a que MUDA COMPORTAMENTO — e por isso cada cenário foi provado
-- com usuário descartável dentro de transação com rollback, antes de aplicar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUINTO NOME DA MESMA LOJA
--
-- A fundação já amarrava quatro nomes. O estoque trouxe um quinto: ele é
-- dividido por DEPÓSITO, e o `deposito_id` NÃO tem nada a ver com o
-- `loja_id` das vendas — são ids de outra ordem de grandeza. Medido em
-- 04/08/2026:
--
--   vendas   bling_lojas.loja_id      205834140   (Loja Santa Bárbara d'Oeste)
--   estoque  gc_estoque_item.deposito_id  14888726315
--
-- Zero linhas casam entre os dois. O de-para estava em `fabrica_lojas`, que é
-- de outra ferramenta. Sem esta coluna, "estoque do Tivoli" não teria como ser
-- respondido — e o pior: responderia ZERO em silêncio.
alter table public.equipes add column if not exists deposito_id bigint;

comment on column public.equipes.deposito_id is
  'Deposito do estoque no Bling. NAO bate com bling_lojas.loja_id: sao numeracoes diferentes. O de-para veio de fabrica_lojas.';

create unique index if not exists equipes_deposito_unico
  on public.equipes (deposito_id) where deposito_id is not null;

update public.equipes set deposito_id = 14888726315 where nome = 'Tivoli'             and deposito_id is null;
update public.equipes set deposito_id = 14888617206 where nome = 'Dom Pedro'          and deposito_id is null;
update public.equipes set deposito_id = 14888248253 where nome = 'Atacado Nuvem Shop' and deposito_id is null;


-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE A SUPERVISORA LIBERA
--
-- Decisão do dono (04/08/2026): "o estoque vai ser o nível de supervisora que
-- pode ver, e aí a supervisora pode permitir que outras pessoas visualizem".
--
-- Tabela, e não um campo booleano no membro: liberar é um ATO, com autor e
-- data. Um `bool ve_estoque` responderia "pode?" e perderia "quem deixou e
-- quando?" — que é a pergunta que aparece três meses depois.
create table if not exists public.equipes_permissoes (
  id            uuid primary key default gen_random_uuid(),
  equipe_id     uuid not null references public.equipes(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  chave         text not null check (chave in ('estoque')),
  concedido_por uuid references public.profiles(id) default auth.uid(),
  criado_em     timestamptz not null default now()
);

comment on table public.equipes_permissoes is
  'O que a supervisora libera para alguem do time dela. Hoje so estoque.';

create unique index if not exists equipes_permissoes_unica
  on public.equipes_permissoes (equipe_id, profile_id, chave);


-- ─────────────────────────────────────────────────────────────────────────────
-- AS DUAS PERGUNTAS QUE O RLS FAZ

-- Vê a venda deste canal?
create or replace function public.pode_ver_canal(p_canal bigint)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or coalesce((select not escopo_por_equipe from public.profiles where id = auth.uid()), false)
    or exists (select 1 from public.equipes e
                where e.canal_loja_id = p_canal
                  and e.id in (select public.minhas_equipes()));
$$;

-- Vê o estoque deste depósito?
--
-- Aqui a regra é mais apertada que a das vendas, e de propósito: estar no time
-- NÃO basta. Ou a pessoa é supervisora/gestora, ou alguém liberou para ela.
-- Vendedora vê o que ela vende; o estoque é decisão de quem supervisiona.
create or replace function public.pode_ver_estoque(p_deposito bigint)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or coalesce((select not escopo_por_equipe from public.profiles where id = auth.uid()), false)
    or exists (
      select 1 from public.equipes e
       join public.equipes_membros m on m.equipe_id = e.id and m.profile_id = auth.uid()
      where e.deposito_id = p_deposito
        and (m.papel in ('supervisora','gestor')
             or exists (select 1 from public.equipes_permissoes p
                         where p.equipe_id = e.id and p.profile_id = auth.uid() and p.chave = 'estoque'))
    );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- AS TRAVAS
--
-- RESTRICTIVE, e não permissive — esta é a parte que é fácil errar e que não
-- avisa quando erra. Políticas permissivas se somam com OU: `gc_vi_read` já
-- existe com `using (true)`, então uma política permissiva nova deixaria tudo
-- passar do mesmo jeito e pareceria instalada. Restritivas se somam com E; é o
-- único jeito de APERTAR uma tabela que já tem porta aberta.
--
-- O `service_role` (coletor) ignora RLS, então a coleta continua igual.

alter table public.equipes_permissoes enable row level security;

drop policy if exists eqperm_leitura on public.equipes_permissoes;
create policy eqperm_leitura on public.equipes_permissoes
  for select to authenticated using (
    profile_id = auth.uid() or public.pode_ver_equipe(equipe_id)
  );

-- QUEM LIBERA é a supervisora ou o gestor DAQUELE time — nunca de outro.
drop policy if exists eqperm_escrever on public.equipes_permissoes;
create policy eqperm_escrever on public.equipes_permissoes
  for all to authenticated
  using (
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or public.meu_papel_na_equipe(equipe_id) in ('supervisora','gestor')
  )
  with check (
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or public.meu_papel_na_equipe(equipe_id) in ('supervisora','gestor')
  );

drop policy if exists gc_vi_so_do_meu_time on public.gc_vendas_item;
create policy gc_vi_so_do_meu_time on public.gc_vendas_item
  as restrictive for select to authenticated
  using (public.pode_ver_canal(canal_loja_id));

drop policy if exists gc_ei_so_do_meu_time on public.gc_estoque_item;
create policy gc_ei_so_do_meu_time on public.gc_estoque_item
  as restrictive for select to authenticated
  using (public.pode_ver_estoque(deposito_id));


-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE FOI PROVADO ANTES DE APLICAR
--
-- Cada linha abaixo foi medida com um usuário descartável, dentro de uma
-- transação com rollback — nenhuma conta real foi tocada:
--
--   cenário                          vendas          estoque
--   ────────────────────────────────────────────────────────
--   sem time (escopo ligado)         nada            nada
--   vendedora do Tivoli              540 linhas      nada
--                                    R$ 166.167,88
--                                    1 canal de 14
--   supervisora do Tivoli            só Tivoli       vê
--   vendedora com estoque liberado   só Tivoli       só o do time dela
--   viewer comum (os 16 de hoje)     3.212 linhas    1.523 itens
--
-- A última linha é a que importava para não quebrar produção: quem já usava o
-- sistema continua vendo exatamente o que via.
