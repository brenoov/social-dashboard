-- Frota F2: requisição de uso do veículo, com aprovação.
-- Desenho em docs/superpowers/specs/2026-08-04-frota-design.md

-- Quem aprova. Chave própria, no mesmo desenho de 'conteudo.aprovar': ter
-- acesso à Frota não é a mesma coisa que poder liberar uma viagem.
create or replace function public.pode_aprovar_frota()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'frota.aprovar' = any(p.features) or p.is_superadmin
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

create table if not exists public.frota_requisicoes(
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.frota_veiculos(id) on delete cascade,
  -- Quem vai DIRIGIR. Pode não ser quem pediu.
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  departamento text,
  destino text,
  finalidade text,
  retirada_prevista timestamptz not null,
  devolucao_prevista timestamptz,
  situacao text not null default 'pendente'
    check (situacao in ('pendente','aprovada','recusada','cancelada','usada')),
  -- Quem pediu (conta de login), pra impedir que a pessoa aprove a própria.
  criada_por uuid references auth.users(id) on delete set null,
  criada_em timestamptz not null default now(),
  decidida_por uuid references auth.users(id) on delete set null,
  decidida_em timestamptz,
  motivo_decisao text,
  -- Quando vira retirada de verdade, a requisição aponta pro uso.
  uso_id uuid references public.frota_uso(id) on delete set null,
  observacao text,
  constraint frota_req_volta_depois
    check (devolucao_prevista is null or devolucao_prevista > retirada_prevista)
);
create index if not exists idx_frota_req_veiculo on public.frota_requisicoes(veiculo_id, retirada_prevista);
create index if not exists idx_frota_req_situacao on public.frota_requisicoes(situacao);
create index if not exists idx_frota_req_pessoa on public.frota_requisicoes(pessoa_id);

-- ── O PORTÃO DA APROVAÇÃO FICA AQUI, NÃO NA TELA ───────────────────────────
-- Gatilho, e não política de RLS. Já aprendemos isso nesta base: RLS WITH CHECK
-- não serve para barrar autopromoção, porque a linha É do próprio usuário e a
-- política a enxerga como legítima. O gatilho vê a MUDANÇA — quem estava
-- decidindo o quê — e é a única camada que consegue negar.
--
-- Duas regras, nesta ordem:
--   1. Só quem tem 'frota.aprovar' muda a situação para aprovada/recusada.
--   2. Ninguém decide a própria requisição, nem a que ele mesmo criou.
--      É o sentido da aprovação: um segundo par de olhos. Existem dois
--      aprovadores justamente para que sempre haja alguém disponível.
--      Superadmin NÃO é exceção aqui — dono aprovando a própria viagem é
--      exatamente o que o formulário de papel já não permitia.
create or replace function public.frota_checar_decisao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  minha_pessoa uuid;
begin
  if new.situacao is distinct from old.situacao
     and new.situacao in ('aprovada','recusada') then

    if not public.pode_aprovar_frota() then
      raise exception 'Você não tem permissão para aprovar requisições de veículo.'
        using errcode = 'check_violation';
    end if;

    select p.id into minha_pessoa
      from public.acessos_pessoas p
      join public.profiles pr on lower(pr.email) = lower(p.email_corporativo)
     where pr.id = auth.uid()
     limit 1;

    if old.criada_por = auth.uid()
       or (minha_pessoa is not null and old.pessoa_id = minha_pessoa) then
      raise exception 'Esta requisição é sua. Quem aprova é a outra pessoa — é para isso que existem dois aprovadores.'
        using errcode = 'check_violation';
    end if;

    new.decidida_por := auth.uid();
    new.decidida_em := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_frota_checar_decisao on public.frota_requisicoes;
create trigger trg_frota_checar_decisao
  before update on public.frota_requisicoes
  for each row execute function public.frota_checar_decisao();

alter table public.frota_requisicoes enable row level security;

do $$ begin
  -- Ler: quem tem a Frota vê a agenda inteira. Saber que o carro está
  -- reservado é o que evita o conflito de viagens; esconder isso de quem
  -- dirige recriaria no app o problema que o papel tem.
  if not exists (select 1 from pg_policies where tablename='frota_requisicoes' and policyname='frota_req_ler') then
    create policy frota_req_ler on public.frota_requisicoes for select using (public.is_frota_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='frota_requisicoes' and policyname='frota_req_criar') then
    create policy frota_req_criar on public.frota_requisicoes for insert
      with check (public.is_frota_admin() and criada_por = auth.uid());
  end if;
  -- Atualizar passa pelo gatilho acima, que é quem decide o que pode mudar.
  if not exists (select 1 from pg_policies where tablename='frota_requisicoes' and policyname='frota_req_atualizar') then
    create policy frota_req_atualizar on public.frota_requisicoes for update
      using (public.is_frota_admin()) with check (public.is_frota_admin());
  end if;
end $$;
