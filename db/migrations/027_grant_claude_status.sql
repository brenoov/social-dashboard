-- db/migrations/027_grant_claude_status.sql
-- Pré-concede o recurso novo `claude.status` (ver) ao(s) super-admin(s). O super-admin
-- já enxerga tudo por bypass em hasPermission — isto é higiene para o editor de
-- permissões do admin refletir a concessão. Idempotente. Segue o estilo da 013.

UPDATE public.profiles
SET permissions = jsonb_set(
      coalesce(permissions, '{}'::jsonb),
      '{claude.status}',
      '["ver"]'::jsonb,
      true
    )
WHERE is_superadmin = true;
