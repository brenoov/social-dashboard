-- escrita de avatar pelo front (admin/feature acessos) no bucket público acessos-avatars
-- (leitura é pública pelo bucket; escrita/edição/remoção só p/ acessos-admin)
drop policy if exists acessos_avatars_write on storage.objects;
create policy acessos_avatars_write on storage.objects for all to authenticated
  using (bucket_id = 'acessos-avatars' and public.is_acessos_admin())
  with check (bucket_id = 'acessos-avatars' and public.is_acessos_admin());
