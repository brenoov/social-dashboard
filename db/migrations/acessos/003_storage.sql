-- bucket privado p/ os termos (gerado + assinado)
insert into storage.buckets (id, name, public)
values ('acessos-termos','acessos-termos', false)
on conflict (id) do nothing;

-- acesso aos objetos do bucket só p/ acessos-admin (read+write)
drop policy if exists acessos_termos_rw on storage.objects;
create policy acessos_termos_rw on storage.objects for all to authenticated
using (bucket_id = 'acessos-termos' and public.is_acessos_admin())
with check (bucket_id = 'acessos-termos' and public.is_acessos_admin());
