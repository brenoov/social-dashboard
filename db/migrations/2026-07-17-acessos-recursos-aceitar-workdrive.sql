-- Deixar a tabela de recursos aceitar pasta do Zoho WorkDrive.
--
-- O problema: a coluna "tipo" tinha uma trava (CHECK) que só permitia dois
-- valores, 'onedrive' e 'icloud'. Era assim:
--
--   CHECK (tipo = ANY (ARRAY['onedrive'::text, 'icloud'::text]))
--
-- Ou seja: qualquer tentativa de gravar uma pasta do WorkDrive (tipo='workdrive')
-- seria RECUSADA pelo banco, com erro de violação de restrição. Sem esta migration,
-- a importação do WorkDrive não grava uma linha sequer.
--
-- Descoberto em 2026-07-17 ao ler as restrições reais da tabela antes de escrever
-- o código — não estava no levantamento inicial.
--
-- O que muda: a trava passa a aceitar TAMBÉM 'workdrive'. Os valores antigos
-- continuam valendo, então nada do OneDrive/iCloud que já está gravado quebra.
-- A trava continua existindo (não virou "aceita qualquer coisa"): ela é o que
-- impede um erro de digitação virar um tipo inventado no banco.
alter table public.acessos_recursos
  drop constraint if exists acessos_recursos_tipo_check;

alter table public.acessos_recursos
  add constraint acessos_recursos_tipo_check
  check (tipo = any (array['onedrive'::text, 'icloud'::text, 'workdrive'::text]));

-- Duas pastas do WorkDrive nunca podem virar duas linhas iguais aqui.
--
-- Por que este índice: a importação roda mais de uma vez (é um botão, e o dono vai
-- clicar de novo pra pegar pasta nova). O código já confere antes de inserir, mas
-- "confere antes" não é garantia: dois cliques ao mesmo tempo passariam os dois pela
-- conferência e inseririam a mesma pasta duas vezes. Este índice faz o BANCO recusar
-- a segunda — é a rede de segurança de verdade.
--
-- Só vale pro WorkDrive (cláusula WHERE) de propósito: não sei se o OneDrive/iCloud
-- têm external_id repetido hoje, e criar um índice único global poderia falhar ou
-- travar gravação nos outros provedores. Escopo desta task é o Zoho; não mexo neles.
create unique index if not exists acessos_recursos_workdrive_external_id
  on public.acessos_recursos (external_id)
  where tipo = 'workdrive' and external_id is not null;

comment on index public.acessos_recursos_workdrive_external_id is
  'Uma pasta do WorkDrive = uma linha. Impede duplicata se a importacao rodar duas vezes ao mesmo tempo.';
