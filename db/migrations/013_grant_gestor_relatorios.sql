-- db/migrations/013_grant_gestor_relatorios.sql
-- Concede o recurso novo `gestor.relatorios` (ver+exportar) a todos que já têm
-- o recurso `gestor`. Aditivo — ninguém perde acesso; admin/super-admin já veem
-- por bypass. Idempotente (re-rodar só reafirma o mesmo valor).

UPDATE public.profiles
SET permissions = jsonb_set(
      coalesce(permissions, '{}'::jsonb),
      '{gestor.relatorios}',
      '["ver","exportar"]'::jsonb,
      true
    )
WHERE permissions ? 'gestor';
