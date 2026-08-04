-- O PATRIMÔNIO passa a respeitar o time.
--
-- Pedido do dono (04/08/2026): "agora liga o patrimônio com os times".
--
-- ─────────────────────────────────────────────────────────────────────────────
-- COMO UM BEM PERTENCE A UM TIME
--
-- Por DOIS caminhos, e o segundo é o que faz a regra ser justa:
--
--   1. pelo LUGAR — o bem está num local que é de um time meu;
--   2. pela MÃO — o bem está comigo, esteja ele onde estiver.
--
-- O segundo caminho existe porque bem não fica parado. A vendedora leva o
-- notebook para casa, o gerente leva o celular para a feira. Sem essa regra, a
-- pessoa deixaria de ver o que ela mesma assinou — e o primeiro reflexo de quem
-- não vê o próprio equipamento é achar que ele sumiu do sistema.
--
-- É o `acessos_pessoas.profile_id` que torna isso possível: até 04/08/2026 não
-- havia como dizer que aquela pessoa do RH é este login.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE A MEDIÇÃO MOSTROU (04/08/2026)
--
--   349 bens · R$ 2.370.619,13
--   333 têm local · 35 têm pessoa · 11 não têm nem um nem outro
--
--   Fábrica Conchal   148 bens  R$ 831.276  — SEM time
--   Piracicaba         59 bens  R$ 100.264  — SEM time
--   Sede Limeira       50 bens  R$ 208.587  — SEM time
--   Loja Tivoli        26 bens  R$  33.340  → time Tivoli
--   Loja Dom Pedro     18 bens  R$  28.669  → time Dom Pedro
--   Loja Hortolândia   13 bens  R$  18.200  → time Hortolândia
--
-- Só 57 dos 349 bens estão em locais com time. Os outros 292 continuam
-- visíveis para quem hoje já vê tudo (os 17 estão fora do escopo) e ficarão
-- invisíveis para quem entrar sob escopo — o que é o certo, e vira pergunta
-- quando alguém do Financeiro precisar enxergar a Sede Limeira: aí se cria um
-- time do tipo 'setor' para ela, pela tela, sem migration.

create or replace function public.pode_ver_bem(p_local uuid, p_pessoa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
    or coalesce((select not escopo_por_equipe from public.profiles where id = auth.uid()), false)
    or exists (select 1 from public.equipes e
                where e.local_id = p_local
                  and e.id in (select public.minhas_equipes()))
    or exists (select 1 from public.acessos_pessoas ap
                where ap.id = p_pessoa and ap.profile_id = auth.uid());
$$;

-- RESTRICTIVE. A política que já existe é `for all using (is_patrimonio_admin())`,
-- permissiva — uma permissiva nova se somaria com OU e não apertaria nada.
drop policy if exists patrimonio_bens_so_do_meu_time on public.patrimonio_bens;
create policy patrimonio_bens_so_do_meu_time on public.patrimonio_bens
  as restrictive for select to authenticated
  using (public.pode_ver_bem(local_id, pessoa_id));

-- MEXER também é limitado. Sem isto, quem tem a permissão de patrimônio e está
-- sob escopo não VERIA o bem de outra loja, mas poderia apagá-lo às cegas pelo
-- id — e apagar o que não se pode ver é o pior jeito de errar.
drop policy if exists patrimonio_bens_editar_so_do_meu_time on public.patrimonio_bens;
create policy patrimonio_bens_editar_so_do_meu_time on public.patrimonio_bens
  as restrictive for update to authenticated
  using (public.pode_ver_bem(local_id, pessoa_id))
  with check (public.pode_ver_bem(local_id, pessoa_id));

drop policy if exists patrimonio_bens_apagar_so_do_meu_time on public.patrimonio_bens;
create policy patrimonio_bens_apagar_so_do_meu_time on public.patrimonio_bens
  as restrictive for delete to authenticated
  using (public.pode_ver_bem(local_id, pessoa_id));

-- A POSSE segue o bem: quem não vê o bem não lê o histórico de quem o teve.
drop policy if exists patrimonio_posse_segue_o_bem on public.patrimonio_posse;
create policy patrimonio_posse_segue_o_bem on public.patrimonio_posse
  as restrictive for select to authenticated
  using (exists (select 1 from public.patrimonio_bens b
                  where b.id = bem_id and public.pode_ver_bem(b.local_id, b.pessoa_id)));

-- PROVADO antes de aplicar, com usuário descartável dentro de transação com
-- rollback: a vendedora do Tivoli enxerga 26 dos 349 bens — os 26 da Loja
-- Tivoli. Conferido depois em produção: quem já via tudo continua vendo os 349.
