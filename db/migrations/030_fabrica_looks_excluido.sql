-- "Excluir look" (sumir da galeria de vez), distinto de desativar (fica cinza na galeria).
-- excluido=true: some da galeria E nunca gera. O sync de code-looks preserva o flag (só ADiciona
-- looks novos), então o que você excluiu não volta. Restaurável (excluido=false) via toggle.
alter table fabrica_looks add column if not exists excluido boolean not null default false;
