-- Arquivar recurso de acesso: some da tela, fica no banco.
--
-- Por que a coluna e nao um DELETE: o dono quer tirar o OneDrive e o iCloud da
-- frente pra focar no Zoho WorkDrive. "Arquivar" aqui é ESCONDER, não apagar — o
-- histórico de quem teve acesso a quê é o tipo de coisa que só se percebe que fazia
-- falta depois que sumiu. É reversível com um UPDATE.
--
-- Medido antes de mexer (2026-07-16): 32 recursos do OneDrive com ZERO pessoas
-- vinculadas, e 1 recurso do iCloud com 1 vínculo. Ou seja, arquivar aqui NÃO tira
-- acesso de ninguém no provedor — só limpa a tela. Quem tinha acesso à pasta no
-- OneDrive continua tendo; isso se resolve lá, não aqui.
alter table public.acessos_recursos
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_motivo text;

create index if not exists acessos_recursos_ativos
  on public.acessos_recursos (provedor) where arquivado_em is null;

comment on column public.acessos_recursos.arquivado_em is
  'Quando foi arquivado (some da tela). NULL = ativo. Nao apaga nada: o historico de vinculos continua. Reversivel.';

-- NÃO ARQUIVE AINDA. Este UPDATE está aqui documentado, comentado de propósito.
--
-- Motivo: hoje o OneDrive e o iCloud são os ÚNICOS provedores cadastrados. Rodar
-- isto antes de a integração do Zoho existir deixa a ferramenta de Acessos
-- COMPLETAMENTE VAZIA — troca "catálogo que não controla nada" por "nada".
-- Conferido em 2026-07-16: 0 recursos sobrariam na tela.
--
-- Rode DEPOIS que o Zoho estiver populado:
--
-- update public.acessos_recursos
--    set arquivado_em = now(),
--        arquivado_motivo = 'Foco no Zoho WorkDrive (decisao do dono, 2026-07-16)'
--  where provedor in ('microsoft','apple') and arquivado_em is null;
--
-- Pra desfazer:
-- update public.acessos_recursos set arquivado_em = null, arquivado_motivo = null
--  where arquivado_motivo like 'Foco no Zoho%';
