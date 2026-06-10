-- docs/migrations/006_accounts_update_policy.sql
-- Permite que admins atualizem contas (accent_color, name, username, etc.)
-- Sem esta policy, sbClient.from('accounts').update() era bloqueado silenciosamente pelo RLS

CREATE POLICY "admin_update_accounts" ON public.accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
