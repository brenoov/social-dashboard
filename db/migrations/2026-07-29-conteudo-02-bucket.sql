-- BUCKET DA CENTRAL DE CONTEÚDO — privado, ao contrário dos outros.
--
-- `ig-cache` e `fabrica-criativos` são públicos porque guardam coisa que já
-- está no ar (post de concorrente, criativo de anúncio). Aqui é o oposto: a
-- arte de uma campanha que ainda não saiu é justamente o que não pode vazar
-- antes da hora. Bucket público = URL adivinhável = campanha na rua.
--
-- Consequência prática: o front não monta URL na mão, usa
-- `storage.from('conteudo').createSignedUrl(caminho, 3600)` — mesmo padrão que
-- tela-de-acessos.vue já usa para os termos assinados.
--
-- Caminho: {account_id}/{peca_id}/{ordem}-{nome}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conteudo',
  'conteudo',
  false,
  314572800,  -- 300 MB, o teto do vídeo. Imagem é barrada em 15 MB no front.
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Mesmo gate das tabelas: quem tem o módulo mexe nos arquivos do módulo.
drop policy if exists conteudo_obj_ler on storage.objects;
create policy conteudo_obj_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'conteudo'
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

drop policy if exists conteudo_obj_escrever on storage.objects;
create policy conteudo_obj_escrever on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'conteudo'
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

drop policy if exists conteudo_obj_atualizar on storage.objects;
create policy conteudo_obj_atualizar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'conteudo'
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );

drop policy if exists conteudo_obj_apagar on storage.objects;
create policy conteudo_obj_apagar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'conteudo'
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid()
                   and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features)))
  );
