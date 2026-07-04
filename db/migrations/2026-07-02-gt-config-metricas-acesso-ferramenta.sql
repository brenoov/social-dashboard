-- Ajuste: escrita da config da Gestão de Tráfego liberada para quem tem ACESSO À
-- FERRAMENTA (não só admin). Espelha o gate do cliente hasPermission('module:meta:gestor'),
-- que mapeia para a feature 'meta.gestor' (e admin sempre tem acesso).
-- Substitui as policies admin-only criadas em 2026-07-02-gt-config-metricas.sql.

drop policy if exists gt_cfg_admin_insert on public.gt_config_metricas;
drop policy if exists gt_cfg_admin_update on public.gt_config_metricas;

create policy gt_cfg_ferramenta_insert on public.gt_config_metricas
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  );

create policy gt_cfg_ferramenta_update on public.gt_config_metricas
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any(p.features))
    )
  );
