-- contas externas do colaborador: e-mail Outlook (OneDrive) e conta Apple (MacBooks/iCloud)
alter table public.acessos_pessoas add column if not exists email_outlook text;
alter table public.acessos_pessoas add column if not exists conta_apple text;
