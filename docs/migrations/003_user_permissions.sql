-- docs/migrations/003_user_permissions.sql
-- Colar no Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  granted      boolean NOT NULL DEFAULT false,
  granted_by   uuid REFERENCES public.profiles(id),
  granted_at   timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, resource_key)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User le proprias permissoes" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin gerencia permissoes" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
