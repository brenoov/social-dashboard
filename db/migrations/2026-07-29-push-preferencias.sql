-- QUEM RECEBE CADA TIPO DE NOTIFICAÇÃO
--
-- Até aqui todo push ia pra TODAS as inscrições. Na prática, três pessoas
-- (Breno, Erick e Humberto) recebiam tudo — o aviso "Vessel está sem saldo"
-- chegou nos três, e saldo de conta de anúncio não é assunto de todo mundo.
--
-- LINHA AUSENTE = o padrão do tipo (ver _shared/notificacoes.js): 'vendas' vem
-- ligado, 'saldo' não. Guardar só o que FOGE do padrão evita ter que criar uma
-- linha por usuário a cada tipo novo, e mantém "desligar" como uma escolha
-- explícita e registrada.

create table if not exists public.push_preferencias (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo    text not null check (tipo in ('vendas', 'saldo')),
  ativo   boolean not null,
  alterado_em  timestamptz not null default now(),
  alterado_por uuid,
  primary key (user_id, tipo)
);

comment on table public.push_preferencias is
  'Quem recebe cada tipo de notificacao push. Linha ausente = padrao do tipo.';

alter table public.push_preferencias enable row level security;

-- Cada um enxerga a própria; admin vê todas (a tela de Usuários precisa listar).
create policy push_pref_leitura on public.push_preferencias
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.is_superadmin))
  );

-- Só admin muda: é ele quem liga e desliga notificação de OUTRA pessoa. Deixar
-- cada um mexer na própria abriria caminho pra desligar um aviso que a empresa
-- quer que chegue.
create policy push_pref_escrita on public.push_preferencias
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.is_superadmin)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.is_superadmin)));

-- ── AJUSTE (mesmo dia): cada um edita as PRÓPRIAS ──────────────────────────
-- A regra acima deixava só admin escrever, e o botão "Minhas notificações" não
-- funcionaria para o resto da equipe. Escolher o que chega no próprio celular é
-- preferência, não privilégio — e quem não quiser receber vai acabar desligando
-- na permissão do aparelho, onde a escolha some sem registro nenhum.
drop policy if exists push_pref_escrita on public.push_preferencias;
create policy push_pref_escrita on public.push_preferencias
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.is_superadmin))
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.is_superadmin))
  );
