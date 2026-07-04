-- superadmin: incluir gabriel.gertrudes (antes só erick)
create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select email from public.profiles where id = auth.uid())
      in ('erick@rbvcompany.com','gabriel.gertrudes@rbvcompany.com'),
    false);
$$;

-- libera o Portal de Notícias ('noticias') pro gabriel (dedup)
update public.profiles
  set features = (select array(select distinct unnest(coalesce(features,'{}') || array['noticias'])))
  where email = 'gabriel.gertrudes@rbvcompany.com';
