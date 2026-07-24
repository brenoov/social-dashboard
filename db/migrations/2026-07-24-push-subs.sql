-- db/migrations/2026-07-24-push-subs.sql
-- Inscrições de Web Push (opt-in aberto): uma linha por navegador/dispositivo inscrito.
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_subs enable row level security;

-- O dono gerencia a própria inscrição. O envio (Edge) usa service role e ignora RLS.
create policy push_subs_dono_select on public.push_subs
  for select using (auth.uid() = user_id);
create policy push_subs_dono_insert on public.push_subs
  for insert with check (auth.uid() = user_id);
create policy push_subs_dono_update on public.push_subs
  for update using (auth.uid() = user_id);
create policy push_subs_dono_delete on public.push_subs
  for delete using (auth.uid() = user_id);
