-- helper: o usuário atual é admin ou tem a feature 'acessos'?
create or replace function public.is_acessos_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or 'acessos' = any(coalesce(p.features, array[]::text[])))
  );
$$;

alter table public.acessos_pessoas      enable row level security;
alter table public.acessos_dispositivos enable row level security;
alter table public.acessos_termos       enable row level security;
alter table public.acessos_config       enable row level security;
alter table public.acessos_log          enable row level security;

-- pessoas / dispositivos / termos / config: leitura e escrita só p/ acessos-admin
do $$
declare t text;
begin
  foreach t in array array['acessos_pessoas','acessos_dispositivos','acessos_termos','acessos_config'] loop
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format('create policy %I_rw on public.%I for all to authenticated using (public.is_acessos_admin()) with check (public.is_acessos_admin());', t, t);
  end loop;
end $$;

-- log: acessos-admin lê tudo e insere; sem update/delete
drop policy if exists acessos_log_select on public.acessos_log;
create policy acessos_log_select on public.acessos_log for select to authenticated using (public.is_acessos_admin());
drop policy if exists acessos_log_insert on public.acessos_log;
create policy acessos_log_insert on public.acessos_log for insert to authenticated with check (public.is_acessos_admin());

-- restringe a execução da helper só a usuários autenticados (fecha o endpoint RPC p/ anon)
-- Supabase concede explicitamente a anon além de PUBLIC, então revogar ambos
revoke execute on function public.is_acessos_admin() from public;
revoke execute on function public.is_acessos_admin() from anon;
grant execute on function public.is_acessos_admin() to authenticated;
