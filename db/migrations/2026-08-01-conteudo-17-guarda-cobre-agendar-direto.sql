-- Central de Conteúdo — o guardião passa a cobrir "agendar sem aprovar"
--
-- O BURACO, que já existia antes de "aprovar e agendar" virar um botão: a
-- trigger `conteudo_guarda_aprovacao` só vigiava a entrada em 'aprovada' e
-- 'reprovada'. Um PATCH direto levando a peça de 'em_aprovacao' para
-- 'agendada' passava batido — e a anon key está no bundle público, então
-- qualquer pessoa com acesso à ferramenta podia pôr conteúdo na fila pulando a
-- aprovação inteira. Sem erro, sem trilha, sem ninguém ler o que ia ao ar.
--
-- Agendar VINDO DE 'aprovada' continua livre: ali a aprovação já aconteceu.
--
-- PROVADO nos dois sentidos, rodando como postgres (que ignora o RLS mas
-- dispara os gatilhos, isolando o guardião):
--   em_aprovacao → agendada, sem permissão .... BARRADO
--   aprovada     → agendada, sem permissão .... LIVRE (como deve ser)

create or replace function public.conteudo_guarda_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- Sem usuário (service_role, cron, robô) a guarda não se aplica: quem chega
  -- por ali já passou por outra porta.
  if auth.uid() is null then
    return new;
  end if;

  if (
    (new.status in ('aprovada', 'reprovada') and old.status is distinct from new.status)
    or (new.status = 'agendada' and old.status = 'em_aprovacao')
  ) then
    if not exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role = 'admin' or p.is_superadmin or 'conteudo.aprovar' = any (p.features))
    ) then
      raise exception 'Sem permissao para aprovar pecas de conteudo.';
    end if;
  end if;

  return new;
end $$;
