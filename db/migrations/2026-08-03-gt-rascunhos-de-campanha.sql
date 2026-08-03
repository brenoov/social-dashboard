-- RASCUNHO E HISTÓRICO DO ASSISTENTE DE CRIAR CAMPANHA.
--
-- PEDIDO DO DONO (2026-08-03): "quero que tenha um salvamento das edições
-- também, às vezes a pessoa fecha a aba sem querer, precisa ter um histórico do
-- que está em rascunho e enviado".
--
-- POR QUE NO BANCO, e não no navegador: o pedido tem DUAS partes, e a segunda
-- decide. Guardar no navegador resolve "fechei a aba sem querer" — mas não
-- resolve "histórico", que precisa sobreviver a trocar de computador, limpar o
-- navegador ou abrir no celular. Uma coisa só, no lugar que atende as duas.
--
-- UMA LINHA POR TENTATIVA, e não uma por conta: o histórico é a lista dessas
-- linhas. Rascunho abandonado continua sendo informação ("comecei uma campanha
-- de vídeo semana passada e não terminei").

create table if not exists public.gt_campanhas_rascunho (
  id          uuid primary key default gen_random_uuid(),

  -- A conta de anúncios (accounts.id). Texto e não uuid: é assim que o resto da
  -- Gestão de Tráfego guarda, e `pode_ver_conta` recebe text.
  account_id  text not null,

  criado_por  uuid not null references auth.users(id) default auth.uid(),

  -- O estado do assistente, inteiro, como ele está na tela. jsonb porque os
  -- campos mudam a cada passo que se acrescenta ao assistente — e uma coluna
  -- por campo viraria uma migration por ideia.
  estado      jsonb not null default '{}'::jsonb,
  passo       int not null default 0,

  -- Denormalizados SÓ para a lista do histórico não precisar abrir cada estado
  -- para saber o que é. Quem manda continua sendo `estado`.
  nome        text not null default '',
  tipo        text not null default '',

  -- 'rascunho'  — começou e não terminou
  -- 'criada'    — a Meta aceitou (os ids ficam em `resultado`)
  -- 'falhou'    — a Meta recusou (o motivo fica em `resultado`)
  status      text not null default 'rascunho'
              check (status in ('rascunho', 'criada', 'falhou')),

  -- O que aconteceu no fim: ids criados, ou o erro inteiro da Meta. É o que
  -- permite voltar meses depois e saber por que aquela tentativa não virou
  -- campanha.
  resultado   jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.gt_campanhas_rascunho is
  'Assistente de criar campanha: rascunho que sobrevive a fechar a aba, e o historico do que foi criado ou recusado.';

-- A lista do histórico é sempre "desta conta, mais recente primeiro".
create index if not exists gt_rascunho_conta_idx
  on public.gt_campanhas_rascunho (account_id, updated_at desc);

-- "Tem rascunho meu para continuar?" é a pergunta da abertura do assistente, e
-- ela roda toda vez que o botão é clicado. Índice parcial porque só rascunho
-- interessa aqui, e eles são a minoria que some com o tempo.
create index if not exists gt_rascunho_meus_idx
  on public.gt_campanhas_rascunho (criado_por, account_id, updated_at desc)
  where status = 'rascunho';

alter table public.gt_campanhas_rascunho enable row level security;

-- QUEM PODE: o mesmo gate do resto da Gestão de Tráfego — admin OU 'meta.gestor'
-- em profiles.features. Copiado de gt_fila_decisoes sem afrouxar: um gate novo
-- mais largo que o da ferramenta seria uma porta lateral.
create policy gt_rascunho_leitura
  on public.gt_campanhas_rascunho for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  );

-- ESCRITA SÓ NO PRÓPRIO RASCUNHO. Ler o histórico do time faz sentido (é a
-- memória da conta); escrever por cima do rascunho de outra pessoa, não.
create policy gt_rascunho_inserir
  on public.gt_campanhas_rascunho for insert to authenticated
  with check (
    criado_por = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  );

create policy gt_rascunho_atualizar
  on public.gt_campanhas_rascunho for update to authenticated
  using (criado_por = auth.uid())
  with check (criado_por = auth.uid());

create policy gt_rascunho_apagar
  on public.gt_campanhas_rascunho for delete to authenticated
  using (criado_por = auth.uid());

-- A MESMA TRAVA DE CONTA do resto do sistema, e ela é RESTRICTIVE de propósito:
-- políticas permissivas se somam com OU (bastaria uma passar), restritivas se
-- somam com E. Sem `as restrictive`, o gate de conta não valeria nada.
create policy so_contas_permitidas
  on public.gt_campanhas_rascunho as restrictive for all to authenticated
  using (pode_ver_conta(account_id))
  with check (pode_ver_conta(account_id));

-- `updated_at` é o que ordena o histórico e o que decide qual rascunho é "o
-- último". Deixar a cargo de quem escreve é deixar a cargo de esquecer.
create or replace function public.gt_rascunho_toca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists gt_rascunho_updated_at on public.gt_campanhas_rascunho;
create trigger gt_rascunho_updated_at
  before update on public.gt_campanhas_rascunho
  for each row execute function public.gt_rascunho_toca_updated_at();
