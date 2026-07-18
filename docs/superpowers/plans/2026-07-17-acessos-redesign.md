# Redesign de Colaboradores & Acessos — Plano de Implementação

> **Para quem executa:** usar superpowers:subagent-driven-development, uma tarefa por vez.
> Spec: `docs/superpowers/specs/2026-07-17-acessos-redesign-design.md`.
> Mockup aprovado: `docs/superpowers/specs/2026-07-17-acessos-redesign-mockup.html`.

**Meta:** reconstruir `src/ferramentas/acessos/tela-de-acessos.vue` (6 abas) no
acabamento do mockup, integrar leitura do WorkDrive e patrimônio completo, sem quebrar
os fluxos que já funcionam.

## Restrições globais (toda tarefa herda — copiar da spec)

- Repo PÚBLICO: sem segredo em commit/log.
- Usar tokens de `src/estilos/estilos-globais.css` (NÃO cor cravada — tema claro E escuro).
- CSS de DOM injetado por innerHTML exige `.tela-acessos :deep(...)`.
- PT literal sem jargão; responsivo full-bleed; celular em coluna única.
- `npm test` verde é gate (288 passando hoje). Lógica pura em `.js` + `.test.mjs`.
- A tela NÃO abre em localhost (CORS). Validação visual só em produção.
- Não quebrar: iCloud, OneDrive (370 acessos ao vivo), Auditoria (falhas), WorkDrive.
- NÃO deployar/push sem ordem. Commit local por tarefa.

## Ordem e natureza das tarefas

Tarefa 1 é fundação testável (schema + lógica pura). Tarefas 2+ mexem no MESMO arquivo
Vue — são SEQUENCIAIS (não paralelas, senão conflito) e validadas visualmente em
produção, não por teste unitário. Cada uma termina com commit e entra no ledger.

---

## Tarefa 1: Fundação do patrimônio (schema + lógica pura)

**Arquivos:**
- Criar: `db/migrations/2026-07-17-patrimonio-completo.sql`
- Criar: `src/ferramentas/acessos/patrimonio.js`
- Criar: `src/ferramentas/acessos/patrimonio.test.mjs`

**Interfaces (produz, usado pelas tarefas de UI):**
- `formatarValor(centavos)` → string tipo "R$ 1.234,56"; null/undefined → "—".
- `parsearValor(texto)` → centavos inteiros a partir de "1.234,56" ou "1234.56" ou
  "R$ 1.234,56"; entrada inválida → null.
- `CATEGORIAS_PATRIMONIO` → array `['TI','Móveis','Veículos','Telefonia','Outro']`.
- `fecharEAbrirHistorico({historicoAtual, novoDonoId, novoDonoNome, hoje})` → objeto
  `{ aFechar: {id, ate} | null, aAbrir: {pessoa_id, pessoa_nome, de, ate:null} }`.
  Regra: se há registro aberto (ate=null) para outro dono, marca `ate = hoje`; abre um
  novo para o novo dono com `de = hoje`. Se o dono não mudou, `aFechar=null` e
  `aAbrir=null` (idempotente).

**Migration (conteúdo exato):**
```sql
-- Patrimonio completo: valor do bem + historico de posse.
alter table public.acessos_dispositivos
  add column if not exists valor_centavos bigint;

comment on column public.acessos_dispositivos.valor_centavos is
  'Valor do bem em centavos (inteiro, nunca float pra dinheiro). NULL = nao informado.';

create table if not exists public.acessos_patrimonio_historico (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.acessos_dispositivos(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,            -- nome congelado: sobrevive a exclusao da pessoa
  de date not null,
  ate date,                    -- null = posse atual
  motivo text,
  criado_em timestamptz not null default now()
);

comment on table public.acessos_patrimonio_historico is
  'Quem teve cada item de patrimonio e quando. ate=null e a posse atual.';

create index if not exists acessos_patrimonio_hist_dispositivo
  on public.acessos_patrimonio_historico (dispositivo_id, de desc);

alter table public.acessos_patrimonio_historico enable row level security;
```
(Replicar as policies de `acessos_dispositivos` — ler as policies reais dessa tabela
antes e espelhar exatamente; NÃO inventar policy nova.)

- [ ] Passo 1: escrever `patrimonio.test.mjs` com casos: formatarValor(123456)="R$ 1.234,56",
  formatarValor(null)="—", formatarValor(0)="R$ 0,00"; parsearValor("R$ 1.234,56")=123456,
  parsearValor("1234.56")=123456, parsearValor("abc")=null; fecharEAbrirHistorico com
  histórico vazio, com registro aberto de outro dono (fecha+abre), com mesmo dono (no-op).
- [ ] Passo 2: rodar, ver falhar.
- [ ] Passo 3: implementar `patrimonio.js`.
- [ ] Passo 4: rodar, ver passar; `npm test` inteiro verde.
- [ ] Passo 5: aplicar a migration em produção (via MCP apply_migration) e confirmar
  colunas/tabela com execute_sql.
- [ ] Passo 6: commit.

---

## Tarefa 2: Sistema visual da tela (fundação CSS + cabeçalho + KPIs)

**Arquivo:** `src/ferramentas/acessos/tela-de-acessos.vue` (bloco `<style scoped>` + o
cabeçalho comum e a faixa de KPIs no topo, acima das abas).

Portar do mockup, via tokens do app: cabeçalho (marca + título + pills de provedor com
status real de conexão lido de `zoho.status`/`microsoft.status`), faixa de 4 KPIs
(pastas geridas, pessoas, compartilhamentos, provedores) calculados de dados reais.
Classes com prefixo único `ac-` e `:deep()`. Não mexer ainda no conteúdo das abas.
Entregável: topo redesenhado, abas antigas ainda funcionando abaixo.

---

## Tarefa 3: Aba Pastas & Acessos (master-detail)

Rail de provedores (WorkDrive Ativo / OneDrive Legado / iCloud Legado) + lista de pastas
hierárquica (reusar `montar-arvore-de-pastas.js`) + detalhe "quem tem acesso" e "links".
WorkDrive: `zoho.acessoDaPasta`. OneDrive: `microsoft.shares` da pasta. Botões "Dar
acesso"/"Criar link" DESABILITADOS com aviso "reconecte o Zoho para habilitar" (escrita
adiada). Estado honesto: pasta que herda mostra "herda da pasta-mãe", sem forçar lista.

---

## Tarefa 4: Aba Colaboradores + Ficha

Lista de pessoas por setor (cor do setor) com cards (avatar, cargo, status, nº de
acessos). Clique abre a **ficha**: Identidade, Contatos & contas (campos editáveis;
vazio vira "+ adicionar"), Dispositivos & patrimônio (usa Tarefa 1 e 5), Termo, Acessos
da pessoa (soma OneDrive+WorkDrive). Editar campos grava em `acessos_pessoas`.

---

## Tarefa 5: Patrimônio (na ficha + aba consolidada)

Na ficha: lista de itens da pessoa com categoria, valor (formatarValor), desde; adicionar/
editar/trocar dono (grava histórico via lógica da Tarefa 1). Aba consolidada
"Patrimônio": todos os bens, filtro por categoria/pessoa/status, soma de valor. Histórico
de posse visível por item.

---

## Tarefa 6: Aba Auditoria (redesign)

Manter a lógica atual (allShares + vínculos + WorkDrive) e o aviso de `falhas`. Só
redesenhar: cards/tabela legível, chips de papel, destaque de quem tem acesso demais.

---

## Tarefa 7: Aba Termos (redesign)

Lista limpa de termos por pessoa, data de envio, upload/download via iframe (iOS).
Sem mudar a lógica de storage.

---

## Tarefa 8: Aba Config (rótulo + conexões)

Dar **rótulo "Configurações"** ao botão de engrenagem (achado de usabilidade). Conexões
Zoho/Microsoft com status e reconectar. Setores/organizações. Quando a escrita do
WorkDrive for destravar, o botão de reconexão com escopo de sharing entra aqui.

---

## Tarefa 9: Foto automática do colaborador

`avatar_url` atualiza sozinho a partir da conta do provedor (Zoho `zoho.users` traz
avatar; ou Microsoft). Reusar o padrão de re-hospedagem `?v={hash}` do coletor. Lógica
pura de decidir "precisa atualizar?" testável; a busca/gravação no proxy ou num
coletor. Não deixar a foto congelar (queixa real: perfil Vessel).

---

## Revisão final

Ao fim das 9, dispatch de code-review de branch inteira. Depois: decidir deploy do
front (build Vue) com o dono, e a reauth do Zoho para destravar a escrita do WorkDrive.
