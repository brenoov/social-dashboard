# Patrimônio — Fase 1 (esqueleto) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o módulo Patrimônio como ferramenta própria (arquivo, rota e permissão), alcançado por um menu novo "Gestão Interna", com cadastro de bens celular-primeiro e dono opcional.

**Architecture:** Um menu estático (`tela-de-menu-gestao-interna.vue`, cópia do padrão de `tela-de-menu-vendas.vue`) vira a única porta na Central e leva a `/acessos` e `/patrimonio`. O módulo Patrimônio é **Vue reativo idiomático** (`ref`/`computed`/`v-for`), não o padrão imperativo de `innerHTML` do monólito — decisão consciente: elimina a necessidade de `:deep()`, de expor funções em `window`, e mata o gotcha conhecido de modal anexado em `document.body` perder o CSS escopado (modal vira `v-if` dentro do componente). Toda a lógica que não é DOM mora em módulos `.js` puros com teste em `node --test`.

**Tech Stack:** Vue 3 (`<script setup>`) + Vite + vue-router · Supabase (Postgres + RLS) · `node --test` para os módulos puros.

## Global Constraints

Copiados do spec `docs/superpowers/specs/2026-08-03-patrimonio-modulo-proprio-design.md`. Valem para **todas** as tarefas:

- **Celular-primeiro.** Cartão, nunca linha de tabela, no `≤640px`. Filtros em faixa rolável (`.rolagem-x`), jamais quebrando em linhas. Campos de formulário com `font-size:16px` no `≤640px` (senão o iOS dá zoom no foco) + `touch-action:manipulation`.
- **Largura cheia.** Sem `max-width` centralizado. Regra fixa do dono.
- **Breakpoints:** celular ≤640 · tablet ≤1024 · desktop ≤1919 · TV ≥1920.
- **Dinheiro sempre em centavos** (`bigint` no banco, `Number` inteiro no JS). Nunca float.
- **Dono do bem é OPCIONAL** (`pessoa_id` nullable). 88% dos bens reais não têm dono.
- **Permissão `patrimonio` nasce DESMARCADA para todo mundo.** Nenhuma migration concede acesso a ninguém.
- **Nomes de arquivo e pasta em português literal, kebab-case.**
- **LEIA-ME.txt em toda pasta nova** (regra permanente do repo).
- **Linguagem da interface:** português literal, sem jargão. Texto de tela vazia ensina o que fazer, não só diz "vazio".
- `npm run build` tem que passar **antes de todo commit**. Não commitar build quebrado.
- Comentário em bloco `<style>` **não pode conter `*/`** no meio (fecha o comentário cedo e quebra o build).
- Migrations rodam por `node run-acessos-sql.mjs ../db/migrations/acessos/<arquivo>.sql` de dentro de `coletor/` (o MCP do Supabase derruba o socket em DDL).

## Escopo desta fase

**Entra:** menu Gestão Interna · permissão `patrimonio` · tabelas de cadastro e de bens · lista de bens celular-primeiro com busca e filtros · ficha do bem (ver/criar/editar) · entregar e devolver com histórico de posse · listas editáveis (empresa/local/cômodo/categoria/tipo) · remoção da aba Patrimônio velha da tela de acessos.

**NÃO entra (fases seguintes):** importar os 342 itens (F2) · ficha do colaborador em só leitura e termo no bem (F3) · depreciação, manutenção e seguro (F4) · resumo vivo, exportar planilha e tutorial guiado (F5) · Frota.

**Não mexer nesta fase:** os blocos de Dispositivos/Veículos dentro da ficha do colaborador continuam como estão, lendo `acessos_dispositivos` (tabela vazia). A F3 é que os converte.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/migrations/acessos/018_patrimonio_cadastros.sql` | criar empresas/locais/cômodos/categorias/tipos + `is_patrimonio_admin()` + RLS |
| `db/migrations/acessos/019_patrimonio_bens.sql` | criar `patrimonio_bens`, `patrimonio_posse`, `patrimonio_log` + RLS + índices |
| `src/ferramentas/patrimonio/LEIA-ME.txt` | o que é a pasta |
| `src/ferramentas/patrimonio/patrimonio.js` (movido) | dinheiro em centavos + fechar/abrir histórico de posse |
| `src/ferramentas/patrimonio/patrimonio-lista.js` (movido) | somar, formatar data, texto de linha de histórico |
| `src/ferramentas/patrimonio/rotulos-do-bem.js` | situações válidas, rótulo, classe da pílula, texto de "com quem" |
| `src/ferramentas/patrimonio/filtro-de-bens.js` | busca por texto + filtros + total em centavos |
| `src/ferramentas/patrimonio/tela-de-patrimonio.vue` | lista, ficha do bem, listas editáveis |
| `src/ferramentas/gestao-interna/LEIA-ME.txt` | o que é a pasta |
| `src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue` | a porta: 3 cards, gateados por permissão |
| `src/compartilhado/controle-de-login-e-usuario.js` | + recurso `patrimonio` em `RECURSOS` e `PERMISSION_TREE` |
| `src/mapa-de-enderecos.js` | + rotas `/gestao-interna` e `/patrimonio` |
| `src/ferramentas/inicio/tela-de-inicio.vue` | card de acessos vira card de Gestão Interna |
| `src/ferramentas/acessos/tela-de-acessos.vue` | remover a aba Patrimônio; repontar imports movidos |

---

### Task 1: Migration dos cadastros do Patrimônio

**Files:**
- Create: `db/migrations/acessos/018_patrimonio_cadastros.sql`

**Interfaces:**
- Consumes: `public.profiles` (colunas `id`, `role`, `features`), já existente.
- Produces: tabelas `patrimonio_empresas`, `patrimonio_locais`, `patrimonio_comodos`, `patrimonio_categorias`, `patrimonio_tipos`; função `public.is_patrimonio_admin()` usada por toda RLS do módulo.

**Contexto que o implementador precisa saber:** medido no dado real do dono — **Local NÃO pertence a uma Empresa** (Fábrica Conchal tem bem de 3 empresas diferentes) e **Cômodo se repete entre Locais** ("Sala de Reunião" existe em 5 lugares). Por isso os três são listas independentes, e o vínculo acontece **no bem**, não entre os cadastros. Não "melhorar" isso criando `local.empresa_id` — contraria o dado.

- [ ] **Step 1: Escrever a migration**

```sql
-- db/migrations/acessos/018_patrimonio_cadastros.sql
-- Cadastros do módulo Patrimônio. Empresa, Local e Cômodo são listas
-- INDEPENDENTES de propósito: no dado real do dono um mesmo Local abriga bens de
-- várias Empresas (Fábrica Conchal tem Vessel, RB Builders e RBV) e um mesmo
-- Cômodo se repete em vários Locais ("Sala de Reunião" em 5). Quem amarra os três
-- é o BEM, não os cadastros.

-- helper: o usuário atual é admin ou tem a feature 'patrimonio'?
-- Espelha is_acessos_admin() (db/migrations/acessos/002_rls.sql).
create or replace function public.is_patrimonio_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or 'patrimonio' = any(coalesce(p.features, array[]::text[])))
  );
$$;

revoke execute on function public.is_patrimonio_admin() from public;
revoke execute on function public.is_patrimonio_admin() from anon;
grant  execute on function public.is_patrimonio_admin() to authenticated;

create table if not exists public.patrimonio_empresas(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

create table if not exists public.patrimonio_locais(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

create table if not exists public.patrimonio_comodos(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

-- vida_util_anos alimenta a depreciação (Fase 4). Nasce nulo: sem chute.
create table if not exists public.patrimonio_categorias(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  vida_util_anos int,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (nome)
);

-- Tipo é o nível 2 da classificação (Notebook, Desktop, Mesa), filho da categoria.
create table if not exists public.patrimonio_tipos(
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.patrimonio_categorias(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (categoria_id, nome)
);
create index if not exists idx_patrimonio_tipos_categoria on public.patrimonio_tipos(categoria_id);

do $$
declare t text;
begin
  foreach t in array array[
    'patrimonio_empresas','patrimonio_locais','patrimonio_comodos',
    'patrimonio_categorias','patrimonio_tipos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all to authenticated using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());',
      t, t);
  end loop;
end $$;

-- Seeds vindos do dado REAL da planilha do dono (aba Base). São só o ponto de
-- partida: as cinco listas são editáveis na tela.
insert into public.patrimonio_empresas(nome, ordem) values
  ('Vessel',1),('Moto Easy',2),('RBV Company',3),('RB Builders',4),('Mantova',5)
on conflict (nome) do nothing;

insert into public.patrimonio_locais(nome, ordem) values
  ('Fábrica Conchal',1),('Piracicaba',2),('Sede Limeira',3),('Loja Tivoli',4),
  ('Loja Dom Pedro',5),('Loja Hortolândia',6),('Escritório Centro Limeira',7),
  ('Showroom Limeira',8),('Escritório Desenvolvimento - Itatiba',9)
on conflict (nome) do nothing;

insert into public.patrimonio_comodos(nome, ordem) values
  ('Operação Loja',1),('Produção',2),('Administrativo',3),('Estoque',4),
  ('Sala de Reunião',5),('Diretoria',6),('Cozinha',7),('Sala de Espera',8),
  ('Qualidade',9),('Gerência',10),('Comercial',11),('Financeiro',12),
  ('RH',13),('Marketing',14)
on conflict (nome) do nothing;

-- vida_util_anos: valores usuais da Receita; o dono edita na tela.
insert into public.patrimonio_categorias(nome, vida_util_anos, ordem) values
  ('Computadores e Periféricos',5,1),
  ('Móveis e Utensílios',10,2),
  ('Máquinas e Equipamentos',10,3),
  ('Celulares e tablets',5,4),
  ('Televisões',10,5),
  ('Veículos',5,6),
  ('Linhas telefônicas',null,7)
on conflict (nome) do nothing;
```

- [ ] **Step 2: Rodar a migration**

```bash
cd /Users/erickmartins/iamundi/coletor
node run-acessos-sql.mjs ../db/migrations/acessos/018_patrimonio_cadastros.sql
```

Esperado: `✓ aplicado: ../db/migrations/acessos/018_patrimonio_cadastros.sql`

- [ ] **Step 3: Conferir que criou e que os seeds entraram**

Criar `coletor/zz-check.mjs` com exatamente este conteúdo (é temporário — apagar no fim do passo):

```js
// TEMPORÁRIO — SOMENTE LEITURA. Confere o que a migration criou. Apagar depois.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const raw of readFileSync(join(__dirname, '.env'), 'utf8').split('\n')) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i === -1) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(k in process.env)) process.env[k] = v
}
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: readFileSync(join(__dirname, 'supabase-ca.crt'), 'utf8') },
})
await c.connect()
const q = async (rotulo, sql) => { const r = await c.query(sql); console.log('\n## ' + rotulo); console.table(r.rows) }
await q('contagens dos seeds', `select
  (select count(*) from patrimonio_empresas)   as empresas,
  (select count(*) from patrimonio_locais)     as locais,
  (select count(*) from patrimonio_comodos)    as comodos,
  (select count(*) from patrimonio_categorias) as categorias,
  (select count(*) from patrimonio_tipos)      as tipos`)
await q('a função existe?', `select proname from pg_proc where proname = 'is_patrimonio_admin'`)
await q('RLS ligada?', `select tablename, rowsecurity from pg_tables
  where schemaname='public' and tablename like 'patrimonio_%' order by tablename`)
await c.end()
```

Rodar e apagar:

```bash
cd /Users/erickmartins/iamundi/coletor
node zz-check.mjs
rm zz-check.mjs
```

Esperado: empresas 5 · locais 9 · comodos 14 · categorias 7 · tipos 0; `is_patrimonio_admin` na lista; `rowsecurity = true` nas cinco tabelas. **O `rm` não é opcional** — script temporário não pode ir pro repositório.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/acessos/018_patrimonio_cadastros.sql
git commit -m "patrimonio: cadastros (empresa/local/cômodo/categoria/tipo) + RLS"
```

---

### Task 2: Migration dos bens, da posse e do log

**Files:**
- Create: `db/migrations/acessos/019_patrimonio_bens.sql`

**Interfaces:**
- Consumes: `public.is_patrimonio_admin()` (Task 1); `patrimonio_empresas/locais/comodos/categorias/tipos` (Task 1); `public.acessos_pessoas` (já existe).
- Produces: `patrimonio_bens` (colunas usadas pelo front: `id, numero, nome, valor_centavos, data_compra, empresa_id, local_id, comodo_id, categoria_id, tipo_id, marca, pessoa_id, dono_texto, etiquetado, situacao, observacao, detalhes, criado_em, atualizado_em`), `patrimonio_posse`, `patrimonio_log`.

**Contexto:** `pessoa_id` é **nullable** e existe `dono_texto` ao lado — é o par que a importação da F2 vai usar pra guardar "Raíssa" sem inventar um colaborador. `on delete set null` na pessoa: apagar um colaborador não pode apagar o patrimônio da empresa.

- [ ] **Step 1: Escrever a migration**

```sql
-- db/migrations/acessos/019_patrimonio_bens.sql
-- O bem, o histórico de posse e o log do módulo Patrimônio.

create table if not exists public.patrimonio_bens(
  id uuid primary key default gen_random_uuid(),
  -- número da etiqueta física. Vem da planilha do dono (1..380, sem repetição).
  numero int unique,
  nome text not null,
  valor_centavos bigint,          -- nulo = não informado (≠ zero)
  data_compra date,               -- a planilha não tem: nasce nulo, sem chutar
  empresa_id   uuid references public.patrimonio_empresas(id)   on delete set null,
  local_id     uuid references public.patrimonio_locais(id)     on delete set null,
  comodo_id    uuid references public.patrimonio_comodos(id)    on delete set null,
  categoria_id uuid references public.patrimonio_categorias(id) on delete set null,
  tipo_id      uuid references public.patrimonio_tipos(id)      on delete set null,
  marca text,                     -- nível 3 da classificação (D_01 da planilha)
  -- Dono é OPCIONAL: 88% dos bens reais não estão com ninguém.
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  -- Nome solto de quem está com o bem quando não há colaborador cadastrado.
  -- A F2 usa isto pra não inventar colaborador. Some quando pessoa_id é preenchido.
  dono_texto text,
  etiquetado boolean not null default false,
  situacao text not null default 'em_estoque'
    check (situacao in ('em_uso','em_estoque','em_manutencao','baixado')),
  observacao text,
  detalhes jsonb not null default '{}'::jsonb,  -- campos por categoria (linha telefônica, veículo)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_patrimonio_bens_pessoa    on public.patrimonio_bens(pessoa_id);
create index if not exists idx_patrimonio_bens_empresa   on public.patrimonio_bens(empresa_id);
create index if not exists idx_patrimonio_bens_local     on public.patrimonio_bens(local_id);
create index if not exists idx_patrimonio_bens_categoria on public.patrimonio_bens(categoria_id);
create index if not exists idx_patrimonio_bens_situacao  on public.patrimonio_bens(situacao);

-- Histórico de posse: quem teve o bem, de quando até quando, por quê.
-- pessoa_nome é gravado JUNTO (não só a FK) pra o histórico sobreviver ao
-- colaborador ser apagado — histórico que perde o nome não serve de histórico.
create table if not exists public.patrimonio_posse(
  id uuid primary key default gen_random_uuid(),
  bem_id uuid not null references public.patrimonio_bens(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  de date not null,
  ate date,                       -- nulo = ainda é o dono
  motivo text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_patrimonio_posse_bem on public.patrimonio_posse(bem_id);

create table if not exists public.patrimonio_log(
  id uuid primary key default gen_random_uuid(),
  quem uuid,
  acao text not null,
  alvo text,
  resultado text,
  detalhe text,
  quando timestamptz not null default now()
);
create index if not exists idx_patrimonio_log_quando on public.patrimonio_log(quando desc);

alter table public.patrimonio_bens  enable row level security;
alter table public.patrimonio_posse enable row level security;
alter table public.patrimonio_log   enable row level security;

drop policy if exists patrimonio_bens_rw on public.patrimonio_bens;
create policy patrimonio_bens_rw on public.patrimonio_bens for all to authenticated
  using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());

drop policy if exists patrimonio_posse_rw on public.patrimonio_posse;
create policy patrimonio_posse_rw on public.patrimonio_posse for all to authenticated
  using (public.is_patrimonio_admin()) with check (public.is_patrimonio_admin());

-- log: lê e insere; sem update/delete (mesmo desenho de acessos_log)
drop policy if exists patrimonio_log_select on public.patrimonio_log;
create policy patrimonio_log_select on public.patrimonio_log for select to authenticated
  using (public.is_patrimonio_admin());
drop policy if exists patrimonio_log_insert on public.patrimonio_log;
create policy patrimonio_log_insert on public.patrimonio_log for insert to authenticated
  with check (public.is_patrimonio_admin());
```

- [ ] **Step 2: Rodar a migration**

```bash
cd /Users/erickmartins/iamundi/coletor
node run-acessos-sql.mjs ../db/migrations/acessos/019_patrimonio_bens.sql
```

Esperado: `✓ aplicado: ../db/migrations/acessos/019_patrimonio_bens.sql`

- [ ] **Step 3: Conferir estrutura e RLS**

Com o mesmo `zz-check.mjs` temporário:

```sql
select column_name, data_type, is_nullable
  from information_schema.columns where table_name='patrimonio_bens' order by ordinal_position;
select tablename, rowsecurity from pg_tables
  where tablename in ('patrimonio_bens','patrimonio_posse','patrimonio_log');
```

Esperado: `pessoa_id` com `is_nullable = YES`; `valor_centavos` bigint nullable; `rowsecurity = true` nas três. **Apagar `zz-check.mjs`.**

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/acessos/019_patrimonio_bens.sql
git commit -m "patrimonio: bens com dono opcional, histórico de posse e log"
```

---

### Task 3: Criar a pasta do módulo e mover os módulos puros que já existem

**Files:**
- Create: `src/ferramentas/patrimonio/LEIA-ME.txt`
- Move: `src/ferramentas/acessos/patrimonio.js` → `src/ferramentas/patrimonio/patrimonio.js`
- Move: `src/ferramentas/acessos/patrimonio.test.mjs` → `src/ferramentas/patrimonio/patrimonio.test.mjs`
- Move: `src/ferramentas/acessos/patrimonio-lista.js` → `src/ferramentas/patrimonio/patrimonio-lista.js`
- Move: `src/ferramentas/acessos/patrimonio-lista.test.mjs` → `src/ferramentas/patrimonio/patrimonio-lista.test.mjs`
- Modify: `src/ferramentas/acessos/tela-de-acessos.vue:111-113` (as três linhas de import)

**Interfaces:**
- Produces (do novo caminho `../patrimonio/patrimonio.js`): `formatarValor(centavos) -> string`, `parsearValor(texto) -> number|null`, `CATEGORIAS_PATRIMONIO: string[]`, `fecharEAbrirHistorico({historicoAtual, novoDonoId, novoDonoNome, hoje}) -> {aFechar, aAbrir}`.
- Produces (de `../patrimonio/patrimonio-lista.js`): `somarCentavos(itens) -> number`, `filtrarItens(itens, filtro) -> itens[]`, `formatarDataBR(iso) -> string`, `textoLinhaHistorico(reg) -> string`, `donoAtualNome(item, pessoasById) -> string`.

**Por que mover e não copiar:** essas funções são a fonte de verdade do dinheiro em centavos e do histórico de posse. Duas cópias divergem. A tela de acessos continua usando as mesmas funções, só que pelo caminho novo — a ficha do colaborador não muda de comportamento nesta fase.

- [ ] **Step 1: Criar a pasta com o LEIA-ME**

```
src/ferramentas/patrimonio/LEIA-ME.txt
```

```
Módulo Patrimônio: o inventário de bens da empresa (o que a empresa tem, onde
está, quanto vale e com quem está).

É um dos submódulos de "Gestão Interna" — a porta que fica na Central. Os outros
são Colaboradores e Acessos (src/ferramentas/acessos) e, no futuro, Frota.

O que tem aqui:
  tela-de-patrimonio.vue  a tela (lista de bens, ficha do bem, listas editáveis)
  patrimonio.js           dinheiro em centavos e histórico de posse
  patrimonio-lista.js     somar, formatar data, texto de linha do histórico
  rotulos-do-bem.js       situações do bem e como cada uma aparece na tela
  filtro-de-bens.js       busca por texto, filtros e total

Os arquivos .js são LÓGICA PURA: não tocam banco nem tela, e cada um tem seu
.test.mjs ao lado. Rode com "npm test".

Regra desta tela: ela é usada principalmente NO CELULAR. Cartão, nunca tabela
larga, no telefone. Filtro em faixa que rola, nunca quebrando em várias linhas.

O bem pode estar SEM ninguém (em estoque, em manutenção) — dono é opcional, de
propósito: no inventário real, 88% dos bens não estão com uma pessoa.

Desenho: docs/superpowers/specs/2026-08-03-patrimonio-modulo-proprio-design.md
```

- [ ] **Step 2: Mover os quatro arquivos preservando o histórico**

```bash
cd /Users/erickmartins/iamundi
git mv src/ferramentas/acessos/patrimonio.js            src/ferramentas/patrimonio/patrimonio.js
git mv src/ferramentas/acessos/patrimonio.test.mjs      src/ferramentas/patrimonio/patrimonio.test.mjs
git mv src/ferramentas/acessos/patrimonio-lista.js      src/ferramentas/patrimonio/patrimonio-lista.js
git mv src/ferramentas/acessos/patrimonio-lista.test.mjs src/ferramentas/patrimonio/patrimonio-lista.test.mjs
```

- [ ] **Step 3: Corrigir os imports dentro dos testes movidos**

Os dois `.test.mjs` importam `'./patrimonio.js'` e `'./patrimonio-lista.js'` — caminhos relativos que continuam corretos após o move (o teste anda junto do módulo). Conferir com:

```bash
grep -n "^import" src/ferramentas/patrimonio/*.test.mjs
```

Esperado: só `from './patrimonio.js'` e `from './patrimonio-lista.js'`. Se algum apontar para outra pasta, corrigir para o caminho relativo local.

- [ ] **Step 4: Repontar os imports da tela de acessos**

Em `src/ferramentas/acessos/tela-de-acessos.vue`, trocar as duas linhas de import:

```js
// ANTES
import { formatarValor, parsearValor, CATEGORIAS_PATRIMONIO, fecharEAbrirHistorico } from './patrimonio.js'
import { somarCentavos, filtrarItens, formatarDataBR, textoLinhaHistorico, donoAtualNome } from './patrimonio-lista.js'
```

```js
// DEPOIS
import { formatarValor, parsearValor, CATEGORIAS_PATRIMONIO, fecharEAbrirHistorico } from '../patrimonio/patrimonio.js'
import { somarCentavos, filtrarItens, formatarDataBR, textoLinhaHistorico, donoAtualNome } from '../patrimonio/patrimonio-lista.js'
```

- [ ] **Step 5: Rodar os testes e o build**

```bash
cd /Users/erickmartins/iamundi
npm test 2>&1 | tail -20
npm run build 2>&1 | tail -10
```

Esperado: todos os testes passando (os dois movidos inclusive) e build sem erro. Se o build reclamar de módulo não encontrado, o import da Step 4 está errado.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "patrimonio: pasta do módulo e mudança dos módulos puros pra ela"
```

---

### Task 4: `rotulos-do-bem.js` — as situações do bem

**Files:**
- Create: `src/ferramentas/patrimonio/rotulos-do-bem.js`
- Test: `src/ferramentas/patrimonio/rotulos-do-bem.test.mjs`

**Interfaces:**
- Produces: `SITUACOES: Array<{valor, rotulo, classe}>`, `rotuloDaSituacao(valor) -> string`, `classeDaSituacao(valor) -> string`, `textoDoDono(bem, pessoasById) -> string`, `precisaDeDono(situacao) -> boolean`.
- Consumed by: Task 6 (`filtro-de-bens.js` não usa, mas a tela da Task 8/9 usa).

**Contexto:** `textoDoDono` é onde mora a regra dos três casos que o dado real exige — colaborador cadastrado, nome solto vindo da planilha (`dono_texto`), e ninguém. `precisaDeDono` responde a "posso salvar um bem 'em uso' sem dono?" — não pode; é a única combinação incoerente.

- [ ] **Step 1: Escrever o teste que falha**

```js
// src/ferramentas/patrimonio/rotulos-do-bem.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SITUACOES, rotuloDaSituacao, classeDaSituacao, textoDoDono, precisaDeDono,
} from './rotulos-do-bem.js'

test('SITUACOES cobre exatamente o que o banco aceita', () => {
  assert.deepEqual(SITUACOES.map(s => s.valor), ['em_uso', 'em_estoque', 'em_manutencao', 'baixado'])
})

test('rótulo é português de gente, não o valor do banco', () => {
  assert.equal(rotuloDaSituacao('em_uso'), 'Em uso')
  assert.equal(rotuloDaSituacao('em_estoque'), 'Em estoque')
  assert.equal(rotuloDaSituacao('em_manutencao'), 'Em manutenção')
  assert.equal(rotuloDaSituacao('baixado'), 'Baixado')
})

test('situação desconhecida não quebra a tela: devolve o próprio valor', () => {
  assert.equal(rotuloDaSituacao('coisa_nova'), 'coisa_nova')
  assert.equal(rotuloDaSituacao(null), '—')
})

test('cada situação tem sua classe de pílula', () => {
  assert.equal(classeDaSituacao('em_uso'), 'pat-pill-uso')
  assert.equal(classeDaSituacao('em_estoque'), 'pat-pill-estoque')
  assert.equal(classeDaSituacao('em_manutencao'), 'pat-pill-manutencao')
  assert.equal(classeDaSituacao('baixado'), 'pat-pill-baixado')
  assert.equal(classeDaSituacao('coisa_nova'), 'pat-pill-neutro')
})

test('dono: colaborador cadastrado vence o nome solto', () => {
  const pessoas = { 'p1': { id: 'p1', nome: 'Larissa Sousa' } }
  assert.equal(textoDoDono({ pessoa_id: 'p1', dono_texto: 'Larissa' }, pessoas), 'Larissa Sousa')
})

test('dono: nome solto da planilha aparece marcado como não cadastrado', () => {
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: 'Raíssa' }, {}), 'Raíssa (não cadastrada)')
})

test('dono: sem ninguém diz que não está com ninguém', () => {
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: null }, {}), 'Sem dono')
  assert.equal(textoDoDono({ pessoa_id: null, dono_texto: '   ' }, {}), 'Sem dono')
})

test('dono: pessoa_id que não existe mais não vira "undefined"', () => {
  assert.equal(textoDoDono({ pessoa_id: 'sumiu', dono_texto: null }, {}), 'Pessoa removida')
})

test('só "em uso" exige dono', () => {
  assert.equal(precisaDeDono('em_uso'), true)
  assert.equal(precisaDeDono('em_estoque'), false)
  assert.equal(precisaDeDono('em_manutencao'), false)
  assert.equal(precisaDeDono('baixado'), false)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd /Users/erickmartins/iamundi
node --test src/ferramentas/patrimonio/rotulos-do-bem.test.mjs
```

Esperado: FALHA com `Cannot find module ... rotulos-do-bem.js`.

- [ ] **Step 3: Escrever a implementação mínima**

```js
// src/ferramentas/patrimonio/rotulos-do-bem.js
// Como cada situação do bem aparece na tela, e quem está com ele.
// Lógica pura: não toca banco nem DOM.

// Os quatro valores são os mesmos do CHECK de patrimonio_bens.situacao
// (db/migrations/acessos/019_patrimonio_bens.sql). Mudar aqui exige mudar lá.
export const SITUACOES = [
  { valor: 'em_uso',         rotulo: 'Em uso',         classe: 'pat-pill-uso' },
  { valor: 'em_estoque',     rotulo: 'Em estoque',     classe: 'pat-pill-estoque' },
  { valor: 'em_manutencao',  rotulo: 'Em manutenção',  classe: 'pat-pill-manutencao' },
  { valor: 'baixado',        rotulo: 'Baixado',        classe: 'pat-pill-baixado' },
]

// Situação que não conhecemos devolve o próprio valor em vez de sumir: se um dia
// alguém inserir um valor novo direto no banco, a tela mostra o que é, não um vazio.
export function rotuloDaSituacao(valor) {
  if (!valor) return '—'
  const achou = SITUACOES.find((s) => s.valor === valor)
  return achou ? achou.rotulo : String(valor)
}

export function classeDaSituacao(valor) {
  const achou = SITUACOES.find((s) => s.valor === valor)
  return achou ? achou.classe : 'pat-pill-neutro'
}

// Quem está com o bem, nos três casos que o dado real produz:
//  1. colaborador cadastrado  -> o nome do cadastro (fonte de verdade)
//  2. só um nome solto        -> o nome, marcado como não cadastrado (vem da
//     importação da planilha, onde 10 nomes não existem no cadastro)
//  3. ninguém                 -> "Sem dono" (o caso mais comum: 88% dos bens)
export function textoDoDono(bem, pessoasById) {
  const b = bem || {}
  const mapa = pessoasById || {}
  if (b.pessoa_id) {
    const p = mapa[b.pessoa_id]
    return (p && p.nome) || 'Pessoa removida'
  }
  const solto = (b.dono_texto || '').trim()
  if (solto) return `${solto} (não cadastrada)`
  return 'Sem dono'
}

// Um bem "em uso" sem ninguém é incoerente — é a única combinação que a tela
// impede. As outras três situações existem justamente para bem sem dono.
export function precisaDeDono(situacao) {
  return situacao === 'em_uso'
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node --test src/ferramentas/patrimonio/rotulos-do-bem.test.mjs
```

Esperado: `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/patrimonio/rotulos-do-bem.js src/ferramentas/patrimonio/rotulos-do-bem.test.mjs
git commit -m "patrimonio: situações do bem e texto de quem está com ele"
```

---

### Task 5: `filtro-de-bens.js` — busca, filtros e total

**Files:**
- Create: `src/ferramentas/patrimonio/filtro-de-bens.js`
- Test: `src/ferramentas/patrimonio/filtro-de-bens.test.mjs`

**Interfaces:**
- Consumes: `somarCentavos` de `./patrimonio-lista.js` (Task 3).
- Produces: `FILTRO_VAZIO: object`, `filtrarBens(bens, filtro) -> bens[]`, `resumoDaLista(bens) -> {quantidade, totalCentavos}`, `normalizar(texto) -> string`.

**Contexto:** a busca precisa achar "Macbook" digitando "macbook", "MACBOOK" ou "mac" — e achar pelo número da etiqueta, que é como a pessoa procura no chão de fábrica com o bem na mão. `normalizar` tira acento porque ninguém digita "Televisão" com til no celular correndo.

- [ ] **Step 1: Escrever o teste que falha**

```js
// src/ferramentas/patrimonio/filtro-de-bens.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FILTRO_VAZIO, filtrarBens, resumoDaLista, normalizar } from './filtro-de-bens.js'

const BENS = [
  { id: 'a', numero: 3,  nome: 'Macbook Air M4', valor_centavos: 800000, empresa_id: 'e1', local_id: 'l1', categoria_id: 'c1', situacao: 'em_uso',     pessoa_id: 'p1', marca: 'Macbook' },
  { id: 'b', numero: 47, nome: 'Xiaomi Redmi',   valor_centavos: 120000, empresa_id: 'e2', local_id: 'l2', categoria_id: 'c2', situacao: 'em_estoque', pessoa_id: null, marca: 'Xiaomi' },
  { id: 'c', numero: 99, nome: 'Cadeira Presidente', valor_centavos: null, empresa_id: 'e1', local_id: 'l1', categoria_id: 'c3', situacao: 'em_uso',  pessoa_id: null, dono_texto: 'Raíssa' },
]

test('filtro vazio devolve tudo', () => {
  assert.equal(filtrarBens(BENS, FILTRO_VAZIO).length, 3)
  assert.equal(filtrarBens(BENS, {}).length, 3)
  assert.equal(filtrarBens(BENS, null).length, 3)
})

test('busca por parte do nome, sem ligar pra maiúscula', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'macbook' }).map(b => b.id), ['a'])
  assert.deepEqual(filtrarBens(BENS, { busca: 'MAC' }).map(b => b.id), ['a'])
})

test('busca ignora acento nos dois lados', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'cadeira' }).map(b => b.id), ['c'])
  assert.deepEqual(filtrarBens([{ id: 'x', nome: 'Televisão LG' }], { busca: 'televisao' }).map(b => b.id), ['x'])
})

test('busca pelo número da etiqueta (é assim que se procura com o bem na mão)', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: '47' }).map(b => b.id), ['b'])
})

test('busca acha pelo nome solto de quem está com o bem', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'raissa' }).map(b => b.id), ['c'])
})

test('filtros de lista casam exato e se somam', () => {
  assert.deepEqual(filtrarBens(BENS, { empresaId: 'e1' }).map(b => b.id), ['a', 'c'])
  assert.deepEqual(filtrarBens(BENS, { situacao: 'em_uso' }).map(b => b.id), ['a', 'c'])
  assert.deepEqual(filtrarBens(BENS, { empresaId: 'e1', categoriaId: 'c3' }).map(b => b.id), ['c'])
  assert.deepEqual(filtrarBens(BENS, { localId: 'l2' }).map(b => b.id), ['b'])
})

test('filtro "sem dono" pega quem não tem colaborador ligado', () => {
  assert.deepEqual(filtrarBens(BENS, { semDono: true }).map(b => b.id), ['b', 'c'])
})

test('filtro por pessoa pega só o dela', () => {
  assert.deepEqual(filtrarBens(BENS, { pessoaId: 'p1' }).map(b => b.id), ['a'])
})

test('nada casa devolve lista vazia, não erro', () => {
  assert.deepEqual(filtrarBens(BENS, { busca: 'jacaré' }), [])
})

test('resumo conta os itens e soma só quem tem valor', () => {
  assert.deepEqual(resumoDaLista(BENS), { quantidade: 3, totalCentavos: 920000 })
  assert.deepEqual(resumoDaLista([]), { quantidade: 0, totalCentavos: 0 })
  assert.deepEqual(resumoDaLista(null), { quantidade: 0, totalCentavos: 0 })
})

test('normalizar tira acento e caixa', () => {
  assert.equal(normalizar('Televisão LG'), 'televisao lg')
  assert.equal(normalizar(null), '')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
node --test src/ferramentas/patrimonio/filtro-de-bens.test.mjs
```

Esperado: FALHA com `Cannot find module ... filtro-de-bens.js`.

- [ ] **Step 3: Escrever a implementação mínima**

```js
// src/ferramentas/patrimonio/filtro-de-bens.js
// Busca e filtros da lista de bens. Lógica pura: não toca banco nem DOM.
import { somarCentavos } from './patrimonio-lista.js'

// O estado inicial dos filtros da tela. Tudo vazio = "mostra tudo".
export const FILTRO_VAZIO = {
  busca: '',
  empresaId: '',
  localId: '',
  categoriaId: '',
  situacao: '',
  pessoaId: '',
  semDono: false,
}

// Tira acento e caixa dos dois lados da comparação. Sem isso, quem digita
// "televisao" no celular (sem til) não acha "Televisão".
// A faixa ̀-ͯ é a dos acentos que o normalize('NFD') separa da letra.
// Escrever a faixa com \u...: os caracteres crus são invisíveis no editor e
// somem em copy-paste — já quebrou busca por acento em outros projetos.
export function normalizar(texto) {
  if (texto === null || texto === undefined) return ''
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// A busca livre varre nome, número da etiqueta, marca e o nome solto do dono.
// O número entra porque é assim que se procura um bem com ele na mão: lendo a
// etiqueta colada nele.
function casaBusca(bem, termo) {
  const alvo = normalizar(
    [bem.nome, bem.numero, bem.marca, bem.dono_texto].filter((v) => v !== null && v !== undefined).join(' '),
  )
  return alvo.includes(termo)
}

export function filtrarBens(bens, filtro) {
  const lista = Array.isArray(bens) ? bens : []
  const f = filtro || {}
  const termo = normalizar(f.busca)
  return lista.filter((bem) => {
    if (!bem) return false
    if (termo && !casaBusca(bem, termo)) return false
    if (f.empresaId && bem.empresa_id !== f.empresaId) return false
    if (f.localId && bem.local_id !== f.localId) return false
    if (f.categoriaId && bem.categoria_id !== f.categoriaId) return false
    if (f.situacao && bem.situacao !== f.situacao) return false
    if (f.pessoaId && bem.pessoa_id !== f.pessoaId) return false
    if (f.semDono && bem.pessoa_id) return false
    return true
  })
}

// Quantidade e total do que está na tela AGORA (já filtrado). Bem sem valor não
// entra na soma — "não informado" não é zero.
export function resumoDaLista(bens) {
  const lista = Array.isArray(bens) ? bens : []
  return { quantidade: lista.length, totalCentavos: somarCentavos(lista) }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node --test src/ferramentas/patrimonio/filtro-de-bens.test.mjs
```

Esperado: `pass 11`, `fail 0`.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm test 2>&1 | tail -10
```

Esperado: nenhuma falha (garante que mover os arquivos na Task 3 não quebrou nada).

- [ ] **Step 6: Commit**

```bash
git add src/ferramentas/patrimonio/filtro-de-bens.js src/ferramentas/patrimonio/filtro-de-bens.test.mjs
git commit -m "patrimonio: busca por nome/etiqueta/dono, filtros e total da lista"
```

---

### Task 6: Permissão `patrimonio`

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js` (array `RECURSOS` ~L89 e array `PERMISSION_TREE` ~L140)
- Test: `src/compartilhado/derivar-features.test.mjs` (arquivo já existe — acrescentar um teste)

**Interfaces:**
- Produces: a chave `'patrimonio'` reconhecida por `hasPermission('patrimonio', 'ver'|'criar'|'editar'|'excluir')` e derivada para `features[]` por `derivarFeatures`.

**Contexto crítico:** o app tem **dois** modelos de permissão que precisam andar juntos — `permissions{}` (lido pelo front) e `features[]` (lido pelas Edge Functions e pela RLS). `derivarFeatures()` já é genérica: basta a chave existir em `RECURSOS` que o painel de admin passa a gravar `patrimonio` em `features[]`, que é exatamente o que `is_patrimonio_admin()` procura. **Não escrever migration concedendo a permissão a ninguém** — ela nasce desmarcada, e o dono concede no painel de admin.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/compartilhado/derivar-features.test.mjs`:

```js
test('patrimônio deriva a feature que a RLS do módulo procura', () => {
  assert.deepEqual(
    derivarFeatures({ patrimonio: ['ver', 'criar', 'editar'] }),
    ['patrimonio'],
  )
})

test('patrimônio sem "ver" não entra em features', () => {
  assert.deepEqual(derivarFeatures({ patrimonio: ['editar'] }), [])
})
```

- [ ] **Step 2: Rodar o teste**

```bash
node --test src/compartilhado/derivar-features.test.mjs
```

Esperado: **PASSA** já de primeira — `derivarFeatures` é genérica, não tem lista de chaves conhecidas. Isso é o resultado desejado: prova que não é preciso mexer em `derivar-features.js`. Se falhar, existe uma lista fechada em algum lugar e ela precisa da chave nova.

- [ ] **Step 3: Registrar o recurso em `RECURSOS`**

Em `src/compartilhado/controle-de-login-e-usuario.js`, logo depois da linha do recurso `acessos`:

```js
  { key: 'acessos', label: 'Colaboradores e Acessos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'patrimonio', label: 'Patrimônio', acoes: ['ver', 'criar', 'editar', 'excluir'] },
```

- [ ] **Step 4: Registrar na árvore do painel de admin**

No mesmo arquivo, no array `PERMISSION_TREE`, logo depois da linha de `acessos`:

```js
  { key: 'acessos', label: 'Colaboradores e Acessos', children: [] },
  { key: 'patrimonio', label: 'Patrimônio', children: [] },
```

- [ ] **Step 5: Conferir que a chave aparece no painel e que ninguém ganhou acesso**

```bash
npm run build 2>&1 | tail -5
```

Esperado: build OK. A verificação de que ninguém ganhou acesso é por construção: nenhuma migration foi escrita nesta task. Confirmar com:

```bash
git diff --stat HEAD -- db/
```

Esperado: **saída vazia** (nenhuma migration tocada).

- [ ] **Step 6: Commit**

```bash
git add src/compartilhado/controle-de-login-e-usuario.js src/compartilhado/derivar-features.test.mjs
git commit -m "patrimonio: permissão própria, nascendo desmarcada pra todo mundo"
```

---

### Task 7: Menu "Gestão Interna" + rota + card na Central

**Files:**
- Create: `src/ferramentas/gestao-interna/LEIA-ME.txt`
- Create: `src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue`
- Modify: `src/mapa-de-enderecos.js` (acrescentar duas rotas)
- Modify: `src/ferramentas/inicio/tela-de-inicio.vue` (card de acessos vira card de Gestão Interna)

**Interfaces:**
- Consumes: `hasPermission` e `adminToast` dos módulos compartilhados; as rotas nomeadas `acessos` (já existe) e `patrimonio` (criada aqui, tela vem na Task 8).
- Produces: rota nomeada `gestao-interna` e rota nomeada `patrimonio`.

**Contexto:** o menu **não tem permissão própria** — aparece na Central se a pessoa tiver `acessos.ver` **ou** `patrimonio.ver`, e lista só o que ela pode. Assim não existe permissão a mais pra conceder, nem porta que abre pra sala vazia.

- [ ] **Step 1: Criar o LEIA-ME da pasta**

```
src/ferramentas/gestao-interna/LEIA-ME.txt
```

```
Gestão Interna: a PORTA (menu) que fica na Central e leva aos módulos internos
da empresa. Não é uma ferramenta — não tem dado próprio, não tem tabela, não tem
permissão própria.

Os submódulos, cada um com seu arquivo, sua rota e sua permissão:
  Colaboradores e Acessos  src/ferramentas/acessos      (permissão: acessos)
  Patrimônio               src/ferramentas/patrimonio   (permissão: patrimonio)
  Frota                    ainda não existe             (fase futura)

Regra: o menu aparece na Central pra quem tem QUALQUER um dos submódulos, e
mostra só os que a pessoa pode ver. Quem só tem Patrimônio abre e vê um item.

Mesmo padrão de tela-de-menu-vendas.vue e tela-de-menu-meta-ads.vue.

Desenho: docs/superpowers/specs/2026-08-03-patrimonio-modulo-proprio-design.md
```

- [ ] **Step 2: Escrever o menu**

```
src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue
```

```vue
<template>
  <!-- Porta da família "Gestão Interna". Tela pequena e estática: bindings @click
       do Vue, sem innerHTML e sem expor nada em window. Mesmo padrão de
       tela-de-menu-vendas.vue. -->
  <div class="tela-menu-gestao-interna">
    <div class="gimenu-topbar">
      <button class="gimenu-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central
      </button>
      <span class="gimenu-title">Gestão Interna</span>
      <span class="gimenu-espaco"></span>
    </div>

    <div class="gimenu-body">
      <div class="gimenu-headline">
        <h2>Escolha o módulo</h2>
        <p>Pessoas, bens e veículos da empresa</p>
      </div>

      <div class="gimenu-cards">
        <div class="gimenu-card" v-if="podeAcessos" @click="ir('acessos')">
          <div class="gimenu-card-icon" style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="gimenu-card-title">Colaboradores e Acessos</div>
          <div class="gimenu-card-desc">Quem é quem na empresa e quem tem acesso a quais pastas e contas.</div>
          <span class="gimenu-card-enter">→</span>
        </div>

        <div class="gimenu-card" v-if="podePatrimonio" @click="ir('patrimonio')">
          <div class="gimenu-card-icon" style="background:linear-gradient(135deg,#b45309 0%,#d97706 100%)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <div class="gimenu-card-title">Patrimônio</div>
          <div class="gimenu-card-desc">Tudo que a empresa tem: onde está, quanto vale e com quem está.</div>
          <span class="gimenu-card-enter">→</span>
        </div>

        <!-- Frota ainda não existe (fase futura). Aparece apagado, sem clique, pra
             o dono saber que está no mapa — e não como promessa clicável quebrada. -->
        <div class="gimenu-card gimenu-card-embreve">
          <div class="gimenu-card-icon" style="background:linear-gradient(135deg,#475569 0%,#64748b 100%)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M3 17V9l3-4h9l4 5v7"/></svg>
          </div>
          <div class="gimenu-card-title">Frota</div>
          <div class="gimenu-card-desc">Licenciamento, IPVA, quilometragem e revisão dos veículos.</div>
          <span class="gimenu-card-embreve-selo">Em breve</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'

const router = useRouter()

const podeAcessos = computed(() => hasPermission('acessos', 'ver'))
const podePatrimonio = computed(() => hasPermission('patrimonio', 'ver'))

function voltar() {
  router.push({ name: 'inicio' })
}

function ir(nome) {
  router.push({ name: nome })
}

// O menu não tem permissão própria: quem não tem NENHUM submódulo não tem o que
// fazer aqui e volta pra Central com aviso, em vez de encarar um menu vazio.
onMounted(() => {
  if (!podeAcessos.value && !podePatrimonio.value) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
  }
})
</script>

<style scoped>
.tela-menu-gestao-interna{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;}
.tela-menu-gestao-interna .gimenu-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);gap:16px;position:sticky;top:0;z-index:10;}
.tela-menu-gestao-interna .gimenu-back{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:5px 10px;display:flex;align-items:center;gap:5px;transition:background .15s;white-space:nowrap;}
.tela-menu-gestao-interna .gimenu-back:hover{background:var(--accent-light);}
.tela-menu-gestao-interna .gimenu-title{font-family:var(--fonte-principal);font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.tela-menu-gestao-interna .gimenu-espaco{width:70px;}
.tela-menu-gestao-interna .gimenu-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:40px;}
.tela-menu-gestao-interna .gimenu-headline{text-align:center;}
.tela-menu-gestao-interna .gimenu-headline h2{font-family:var(--fonte-principal);font-size:26px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:var(--text);margin-bottom:6px;}
.tela-menu-gestao-interna .gimenu-headline p{font-family:var(--fonte-principal);font-size:12px;color:var(--muted);}
.tela-menu-gestao-interna .gimenu-cards{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;}
.tela-menu-gestao-interna .gimenu-card{position:relative;width:270px;min-height:210px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:30px 24px 48px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:14px;overflow:hidden;}
.tela-menu-gestao-interna .gimenu-card:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,.1);}
.tela-menu-gestao-interna .gimenu-card-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;}
.tela-menu-gestao-interna .gimenu-card-title{font-family:var(--fonte-principal);font-size:18px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);line-height:1.2;}
.tela-menu-gestao-interna .gimenu-card-desc{font-family:var(--fonte-principal);font-size:11px;color:var(--muted);line-height:1.7;}
.tela-menu-gestao-interna .gimenu-card-enter{position:absolute;bottom:16px;right:18px;font-size:18px;color:var(--muted);transition:all .2s;}
.tela-menu-gestao-interna .gimenu-card:hover .gimenu-card-enter{transform:translateX(4px);color:var(--accent);}
.tela-menu-gestao-interna .gimenu-card-embreve{cursor:default;opacity:.55;}
.tela-menu-gestao-interna .gimenu-card-embreve:hover{border-color:var(--border);transform:none;box-shadow:none;}
.tela-menu-gestao-interna .gimenu-card-embreve-selo{position:absolute;bottom:16px;right:18px;font-family:var(--fonte-principal);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:3px 7px;}
@media(max-width:640px){
  .tela-menu-gestao-interna .gimenu-topbar{padding:8px 14px;}
  .tela-menu-gestao-interna .gimenu-body{padding:28px 14px;gap:26px;}
  .tela-menu-gestao-interna .gimenu-cards{width:100%;gap:12px;}
  .tela-menu-gestao-interna .gimenu-card{width:100%;min-height:auto;padding:18px 16px 40px;}
}
</style>
```

- [ ] **Step 3: Registrar as rotas**

Em `src/mapa-de-enderecos.js`, logo depois da linha da rota `/acessos`:

```js
  { path: '/acessos', name: 'acessos', component: () => import('./ferramentas/acessos/tela-de-acessos.vue') },
  { path: '/gestao-interna', name: 'gestao-interna', component: () => import('./ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue') },
  { path: '/patrimonio', name: 'patrimonio', component: () => import('./ferramentas/patrimonio/tela-de-patrimonio.vue'), meta: { recurso: 'patrimonio' } },
```

**Atenção:** a rota `/patrimonio` aponta pra um arquivo que só existe na Task 8. Pra o build **não quebrar entre as tarefas** (regra global: nunca commitar build quebrado), criar agora o arquivo provisório, que a Task 8 substitui inteiro:

```
src/ferramentas/patrimonio/tela-de-patrimonio.vue
```

```vue
<template>
  <!-- Provisório: a tela de verdade vem na Task 8. Existe só para a rota
       /patrimonio resolver e o build passar entre uma tarefa e outra. -->
  <div class="tela-patrimonio">Carregando o Patrimônio…</div>
</template>

<script setup></script>
```

- [ ] **Step 4: Trocar o card da Central**

Em `src/ferramentas/inicio/tela-de-inicio.vue`, substituir o bloco do card de acessos (por volta da L128-138):

```vue
        <!-- Porta da família Gestão Interna: leva ao menu com Colaboradores e
             Acessos, Patrimônio e (futuramente) Frota. Aparece pra quem tem
             qualquer um dos submódulos. -->
        <div class="home-card" id="home-card-gestao-interna" v-show="podeGestaoInterna" @click="ir('gestao-interna')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Gestão<br>Interna</h3>
            <p>Colaboradores, acessos, patrimônio e frota</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
```

E no `<script setup>` do mesmo arquivo, trocar a linha do `podeAcessos` (~L188) por:

```js
const podeAcessos = computed(() => hasPermission('acessos', 'ver'))
const podePatrimonio = computed(() => hasPermission('patrimonio', 'ver'))
// A porta aparece pra quem tem QUALQUER submódulo da família.
const podeGestaoInterna = computed(() => podeAcessos.value || podePatrimonio.value)
```

- [ ] **Step 5: Corrigir a guarda de "nenhuma ferramenta liberada"**

No mesmo arquivo, o `computed` `semNenhumaFerramenta` (~L195) lista as ferramentas uma a uma. Trocar a referência a `podeAcessos.value` por `podeGestaoInterna.value` — senão quem só tem `patrimonio` cai na tela de "nenhuma ferramenta liberada" mesmo tendo uma. Conferir o corpo inteiro do computed e garantir que `podeGestaoInterna` está lá.

- [ ] **Step 6: Commit**

```bash
git add src/ferramentas/gestao-interna/ src/mapa-de-enderecos.js src/ferramentas/inicio/tela-de-inicio.vue
git commit -m "gestao-interna: porta na Central com Colaboradores, Patrimônio e Frota"
```

---

### Task 8: Tela do Patrimônio — lista celular-primeiro

**Files:**
- Create: `src/ferramentas/patrimonio/tela-de-patrimonio.vue`

**Interfaces:**
- Consumes: `sbClient` (`../../compartilhado/conectar-no-banco-de-dados.js`), `adminToast` (`../../compartilhado/avisos.js`), `hasPermission`/`estado` (`../../compartilhado/controle-de-login-e-usuario.js`), `formatarValor`/`parsearValor` (`./patrimonio.js`), `formatarDataBR` (`./patrimonio-lista.js`), `SITUACOES`/`rotuloDaSituacao`/`classeDaSituacao`/`textoDoDono` (`./rotulos-do-bem.js`), `FILTRO_VAZIO`/`filtrarBens`/`resumoDaLista` (`./filtro-de-bens.js`).
- Produces: a tela da rota `patrimonio`. A ficha do bem e as listas editáveis entram nas Tasks 9 e 10, no mesmo arquivo.

**Contexto:** esta é a tela que o dono vai usar **em pé, no celular, com uma mão**. Nada de tabela larga no telefone: a tabela existe só a partir de `1025px`. Os filtros ficam numa faixa que **rola na horizontal** e nunca quebra em várias linhas.

- [ ] **Step 1: Escrever a tela (lista + carga + filtros)**

```vue
<template>
  <div class="tela-patrimonio">
    <div class="pat-topbar">
      <button class="pat-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Gestão Interna
      </button>
      <span class="pat-title">Patrimônio</span>
      <button class="pat-btn-novo" @click="abrirNovo" v-if="podeCriar" title="Cadastrar bem">+</button>
    </div>

    <div class="pat-resumo">
      <span class="pat-resumo-qtd">{{ resumo.quantidade }}</span>
      <span class="pat-resumo-lab">{{ resumo.quantidade === 1 ? 'item' : 'itens' }}</span>
      <span class="pat-resumo-sep">·</span>
      <span class="pat-resumo-total">{{ formatarValor(resumo.totalCentavos) }}</span>
    </div>

    <div class="pat-busca-wrap">
      <input
        class="pat-busca"
        v-model="filtro.busca"
        type="search"
        inputmode="search"
        placeholder="Buscar por nome, número da etiqueta ou pessoa…"
        aria-label="Buscar bem">
    </div>

    <!-- Faixa de filtros: ROLA na horizontal, nunca quebra em linhas. -->
    <div class="pat-filtros rolagem-x">
      <select class="pat-select" v-model="filtro.empresaId" aria-label="Empresa">
        <option value="">Todas as empresas</option>
        <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.localId" aria-label="Local">
        <option value="">Todos os locais</option>
        <option v-for="l in locais" :key="l.id" :value="l.id">{{ l.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.categoriaId" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.situacao" aria-label="Situação">
        <option value="">Todas as situações</option>
        <option v-for="s in SITUACOES" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
      </select>
      <button class="pat-chip" :class="{ ativo: filtro.semDono }" @click="filtro.semDono = !filtro.semDono">Sem dono</button>
      <button class="pat-chip" v-if="temFiltro" @click="limparFiltros">Limpar</button>
    </div>

    <div class="pat-body">
      <div class="pat-aviso" v-if="carregando">Carregando os bens…</div>

      <div class="pat-aviso pat-aviso-erro" v-else-if="erro">
        Não consegui carregar o patrimônio: {{ erro }}
      </div>

      <!-- Tela vazia que ENSINA: diz o que fazer e por quê, não só "vazio". -->
      <div class="pat-vazio" v-else-if="!bens.length">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <h3>Nenhum bem cadastrado ainda</h3>
        <p>
          Aqui fica tudo que a empresa tem: computador, celular, mesa, máquina, carro.
          Cada bem guarda onde está, quanto custou e com quem está — e quando alguém
          é desligado, você sabe na hora o que precisa voltar.
        </p>
        <button class="pat-btn primario" @click="abrirNovo" v-if="podeCriar">Cadastrar o primeiro bem</button>
      </div>

      <div class="pat-vazio" v-else-if="!bensFiltrados.length">
        <h3>Nenhum bem para esses filtros</h3>
        <p>Tente limpar a busca ou escolher outra empresa, local ou situação.</p>
        <button class="pat-btn" @click="limparFiltros">Limpar filtros</button>
      </div>

      <template v-else>
        <!-- CELULAR e TABLET: cartões. É a única forma que funciona com uma mão. -->
        <div class="pat-cards">
          <button class="pat-card" v-for="bem in bensFiltrados" :key="bem.id" @click="abrirBem(bem)">
            <div class="pat-card-topo">
              <span class="pat-card-nome">{{ bem.nome }}</span>
              <span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span>
            </div>
            <div class="pat-card-meta">
              <span v-if="bem.numero">Nº {{ bem.numero }}</span>
              <span v-if="bem.numero" class="pat-card-sep">·</span>
              <span>{{ formatarValor(bem.valor_centavos) }}</span>
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ nomeDoLocal(bem) }}
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {{ textoDoDono(bem, pessoasById) }}
            </div>
          </button>
        </div>

        <!-- DESKTOP (≥1025px): a tabela larga, que só faz sentido com mouse e tela grande. -->
        <div class="pat-tabela-wrap rolagem-x">
          <table class="pat-tabela">
            <thead>
              <tr>
                <th>Nº</th><th>Item</th><th>Categoria</th><th>Empresa</th>
                <th>Local</th><th>Com quem</th><th>Situação</th><th class="pat-dir">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bem in bensFiltrados" :key="bem.id" @click="abrirBem(bem)">
                <td>{{ bem.numero ?? '—' }}</td>
                <td>{{ bem.nome }}</td>
                <td>{{ nomeDe(categorias, bem.categoria_id) }}</td>
                <td>{{ nomeDe(empresas, bem.empresa_id) }}</td>
                <td>{{ nomeDoLocal(bem) }}</td>
                <td>{{ textoDoDono(bem, pessoasById) }}</td>
                <td><span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span></td>
                <td class="pat-dir">{{ formatarValor(bem.valor_centavos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { formatarValor } from './patrimonio.js'
import { SITUACOES, rotuloDaSituacao, classeDaSituacao, textoDoDono } from './rotulos-do-bem.js'
import { FILTRO_VAZIO, filtrarBens, resumoDaLista } from './filtro-de-bens.js'

const router = useRouter()

const carregando = ref(true)
const erro = ref('')
const bens = ref([])
const empresas = ref([])
const locais = ref([])
const comodos = ref([])
const categorias = ref([])
const pessoas = ref([])

const filtro = reactive({ ...FILTRO_VAZIO })

const podeCriar = computed(() => hasPermission('patrimonio', 'criar'))

const pessoasById = computed(() => {
  const mapa = {}
  pessoas.value.forEach((p) => { mapa[p.id] = p })
  return mapa
})

const bensFiltrados = computed(() => filtrarBens(bens.value, filtro))
const resumo = computed(() => resumoDaLista(bensFiltrados.value))

const temFiltro = computed(() =>
  !!filtro.busca || !!filtro.empresaId || !!filtro.localId ||
  !!filtro.categoriaId || !!filtro.situacao || !!filtro.pessoaId || filtro.semDono)

function limparFiltros() {
  Object.assign(filtro, FILTRO_VAZIO)
}

function nomeDe(lista, id) {
  if (!id) return '—'
  const achou = lista.find((x) => x.id === id)
  return achou ? achou.nome : '—'
}

// Local e cômodo juntos numa linha só: no cartão do celular não cabe uma linha
// pra cada, e "Sede Limeira · RH" é como a pessoa fala.
function nomeDoLocal(bem) {
  const local = nomeDe(locais.value, bem.local_id)
  const comodo = nomeDe(comodos.value, bem.comodo_id)
  if (local === '—' && comodo === '—') return 'Local não informado'
  if (comodo === '—') return local
  if (local === '—') return comodo
  return `${local} · ${comodo}`
}

function voltar() {
  router.push({ name: 'gestao-interna' })
}

// Qual bem está aberto na ficha (null = ficha fechada). Declarado ANTES das
// funções que mexem nele — `const` não sobe (hoisting), e usá-lo antes daria
// ReferenceError em runtime, não erro de build.
const bemAberto = ref(null)

// A ficha em si é implementada na Task 9. Aqui ficam só os ganchos.
function abrirBem(bem) {
  bemAberto.value = bem
}
function abrirNovo() {
  bemAberto.value = { novo: true }
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  const [rBens, rEmp, rLoc, rCom, rCat, rPes] = await Promise.all([
    sbClient.from('patrimonio_bens').select('*').order('numero', { ascending: true, nullsFirst: false }),
    sbClient.from('patrimonio_empresas').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_locais').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_comodos').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_categorias').select('id,nome,vida_util_anos').order('ordem').order('nome'),
    sbClient.from('acessos_pessoas').select('id,nome,status').order('nome'),
  ])
  if (rBens.error) {
    erro.value = rBens.error.message
    carregando.value = false
    return
  }
  bens.value = rBens.data || []
  empresas.value = rEmp.data || []
  locais.value = rLoc.data || []
  comodos.value = rCom.data || []
  categorias.value = rCat.data || []
  // Colaboradores vêm do módulo vizinho: é o ÚNICO ponto em que Patrimônio
  // depende de Colaboradores e Acessos. Se a pessoa não tiver acesso àquele
  // módulo, a RLS devolve lista vazia — e a tela segue funcionando, mostrando
  // o nome solto (dono_texto) quando houver.
  pessoas.value = rPes.data || []
  carregando.value = false
}

onMounted(() => {
  if (!hasPermission('patrimonio', 'ver')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  carregar()
})
</script>

<style scoped>
/* Celular-primeiro: o que está fora de media query É o celular.
   A tabela larga só aparece a partir de 1025px. */
.tela-patrimonio{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);width:100%;}

.tela-patrimonio .pat-topbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-patrimonio .pat-back{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:6px 10px;display:flex;align-items:center;gap:5px;white-space:nowrap;touch-action:manipulation;}
.tela-patrimonio .pat-title{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text);flex:1;min-width:0;}
.tela-patrimonio .pat-btn-novo{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:22px;line-height:1;cursor:pointer;touch-action:manipulation;}

.tela-patrimonio .pat-resumo{display:flex;align-items:baseline;gap:6px;padding:12px 14px 4px;font-family:var(--fonte-principal);}
.tela-patrimonio .pat-resumo-qtd{font-size:22px;font-weight:700;color:var(--text);}
.tela-patrimonio .pat-resumo-lab,.tela-patrimonio .pat-resumo-sep{font-size:12px;color:var(--muted);}
.tela-patrimonio .pat-resumo-total{font-size:15px;font-weight:600;color:var(--accent);}

.tela-patrimonio .pat-busca-wrap{padding:8px 14px;}
/* 16px obrigatório: abaixo disso o iOS dá zoom sozinho ao focar o campo. */
.tela-patrimonio .pat-busca{width:100%;font-size:16px;font-family:var(--fonte-principal);padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);}

.tela-patrimonio .pat-filtros{display:flex;gap:8px;padding:4px 14px 12px;white-space:nowrap;}
.tela-patrimonio .pat-select{font-size:16px;font-family:var(--fonte-principal);padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);flex-shrink:0;max-width:190px;}
.tela-patrimonio .pat-chip{font-size:12px;font-family:var(--fonte-principal);font-weight:600;padding:9px 14px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;flex-shrink:0;touch-action:manipulation;}
.tela-patrimonio .pat-chip.ativo{background:var(--accent);border-color:var(--accent);color:#fff;}

.tela-patrimonio .pat-body{flex:1;padding:0 14px 40px;}
.tela-patrimonio .pat-aviso{padding:26px 4px;color:var(--muted);font-family:var(--fonte-principal);font-size:13px;}
.tela-patrimonio .pat-aviso-erro{color:#dc2626;}

.tela-patrimonio .pat-vazio{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:48px 18px;color:var(--muted);}
.tela-patrimonio .pat-vazio h3{font-family:var(--fonte-principal);font-size:16px;font-weight:600;color:var(--text);}
.tela-patrimonio .pat-vazio p{font-family:var(--fonte-principal);font-size:13px;line-height:1.7;max-width:420px;}

.tela-patrimonio .pat-btn{font-family:var(--fonte-principal);font-size:13px;font-weight:600;padding:11px 18px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-btn.primario{background:var(--accent);border-color:var(--accent);color:#fff;}

.tela-patrimonio .pat-cards{display:flex;flex-direction:column;gap:10px;}
.tela-patrimonio .pat-card{display:flex;flex-direction:column;gap:6px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;font-family:var(--fonte-principal);color:var(--text);touch-action:manipulation;}
.tela-patrimonio .pat-card:active{border-color:var(--accent);}
.tela-patrimonio .pat-card-topo{display:flex;align-items:center;gap:8px;}
.tela-patrimonio .pat-card-nome{font-size:15px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-patrimonio .pat-card-meta{font-size:12px;color:var(--muted);display:flex;gap:5px;}
.tela-patrimonio .pat-card-linha{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);}

.tela-patrimonio .pat-pill{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:4px 9px;border-radius:999px;flex-shrink:0;}
.tela-patrimonio .pat-pill-uso{background:#dcfce7;color:#166534;}
.tela-patrimonio .pat-pill-estoque{background:#e0e7ff;color:#3730a3;}
.tela-patrimonio .pat-pill-manutencao{background:#fef3c7;color:#92400e;}
.tela-patrimonio .pat-pill-baixado{background:#f1f5f9;color:#475569;}
.tela-patrimonio .pat-pill-neutro{background:#f1f5f9;color:#475569;}

/* A tabela NÃO existe no celular. */
.tela-patrimonio .pat-tabela-wrap{display:none;}

@media(min-width:1025px){
  .tela-patrimonio .pat-topbar{padding:13px 24px;}
  .tela-patrimonio .pat-resumo,.tela-patrimonio .pat-busca-wrap,.tela-patrimonio .pat-filtros{padding-left:24px;padding-right:24px;}
  .tela-patrimonio .pat-body{padding:0 24px 48px;}
  .tela-patrimonio .pat-cards{display:none;}
  .tela-patrimonio .pat-tabela-wrap{display:block;}
  .tela-patrimonio .pat-tabela{width:100%;border-collapse:collapse;font-family:var(--fonte-principal);font-size:13px;}
  .tela-patrimonio .pat-tabela th{text-align:left;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;}
  .tela-patrimonio .pat-tabela td{padding:11px 12px;border-bottom:1px solid var(--border);color:var(--text);}
  .tela-patrimonio .pat-tabela tbody tr{cursor:pointer;}
  .tela-patrimonio .pat-tabela tbody tr:hover{background:var(--surface2);}
  .tela-patrimonio .pat-dir{text-align:right;}
}
</style>
```

- [ ] **Step 2: Rodar o build**

```bash
cd /Users/erickmartins/iamundi
npm run build 2>&1 | tail -10
```

Esperado: build sem erro. Este arquivo substitui por inteiro o provisório criado na Task 7.

- [ ] **Step 3: Conferir no navegador, no tamanho de celular**

```bash
npm run dev -- --port 5199 --strictPort
```

Abrir `http://localhost:5199/patrimonio` com o dispositivo em **375px** de largura e conferir, um a um:
1. Não existe rolagem horizontal na página (só dentro da faixa de filtros).
2. A faixa de filtros rola de lado e **não quebra** em duas linhas.
3. A tabela **não aparece**.
4. A tela vazia mostra o texto que ensina, e não "Nenhum item".
5. Focar o campo de busca **não** dá zoom (é o teste do `font-size:16px`).

Depois repetir em **1440px**: a tabela aparece e os cartões somem.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/patrimonio/tela-de-patrimonio.vue
git commit -m "patrimonio: lista de bens celular-primeiro, com busca e filtros"
```

---

### Task 9: Ficha do bem — criar, editar, entregar e devolver

**Files:**
- Modify: `src/ferramentas/patrimonio/tela-de-patrimonio.vue` (acrescentar o painel da ficha)

**Interfaces:**
- Consumes: `parsearValor`/`formatarValor`/`fecharEAbrirHistorico` (`./patrimonio.js`), `formatarDataBR`/`textoLinhaHistorico` (`./patrimonio-lista.js`), `precisaDeDono`/`SITUACOES` (`./rotulos-do-bem.js`), `hojeLocal` (`../../compartilhado/datas.js`).
- Produces: nada para outras tarefas — é folha.

**Contexto:** o painel é um `v-if` **dentro do componente**, não um elemento anexado em `document.body`. Isso é deliberado: no módulo de acessos, modal anexado no body ficava fora do CSS escopado e renderizava quebrado. Aqui o problema não existe por construção.

- [ ] **Step 1: Acrescentar o painel da ficha ao `<template>`**

Logo antes do `</div>` que fecha `.tela-patrimonio`:

```vue
    <!-- Ficha do bem. É um painel DENTRO do componente (v-if), não um elemento
         anexado em document.body: assim o CSS escopado alcança sempre. -->
    <div class="pat-ficha-fundo" v-if="bemAberto" @click.self="fecharFicha">
      <div class="pat-ficha">
        <div class="pat-ficha-topo">
          <button class="pat-ficha-fechar" @click="fecharFicha" aria-label="Fechar">✕</button>
          <span class="pat-ficha-titulo">{{ bemAberto.novo ? 'Novo bem' : 'Editar bem' }}</span>
        </div>

        <div class="pat-ficha-corpo">
          <label class="pat-campo">
            <span>Nome do bem</span>
            <input v-model="form.nome" type="text" placeholder="Ex.: Macbook Air M4">
          </label>

          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Nº da etiqueta</span>
              <input v-model="form.numero" type="text" inputmode="numeric" placeholder="Ex.: 47">
            </label>
            <label class="pat-campo">
              <span>Valor de compra</span>
              <input v-model="form.valor" type="text" inputmode="decimal" placeholder="R$ 0,00">
            </label>
          </div>

          <label class="pat-campo">
            <span>Data da compra <em>(opcional)</em></span>
            <input v-model="form.data_compra" type="date">
          </label>

          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Empresa</span>
              <select v-model="form.empresa_id">
                <option value="">—</option>
                <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nome }}</option>
              </select>
            </label>
            <label class="pat-campo">
              <span>Categoria</span>
              <select v-model="form.categoria_id">
                <option value="">—</option>
                <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </label>
          </div>

          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Local</span>
              <select v-model="form.local_id">
                <option value="">—</option>
                <option v-for="l in locais" :key="l.id" :value="l.id">{{ l.nome }}</option>
              </select>
            </label>
            <label class="pat-campo">
              <span>Cômodo</span>
              <select v-model="form.comodo_id">
                <option value="">—</option>
                <option v-for="c in comodos" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </label>
          </div>

          <label class="pat-campo">
            <span>Situação</span>
            <select v-model="form.situacao">
              <option v-for="s in SITUACOES" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
            </select>
          </label>

          <label class="pat-campo">
            <span>Com quem está <em>(só quando está em uso)</em></span>
            <select v-model="form.pessoa_id" :disabled="form.situacao !== 'em_uso'">
              <option value="">Ninguém</option>
              <option v-for="p in pessoasAtivas" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>

          <div class="pat-nota" v-if="form.situacao === 'em_uso' && !form.pessoa_id">
            Um bem <strong>em uso</strong> precisa estar com alguém. Se ele está guardado,
            escolha <strong>Em estoque</strong>.
          </div>

          <div class="pat-nota" v-if="!bemAberto.novo && bemAberto.dono_texto && !bemAberto.pessoa_id">
            Na planilha este bem estava com <strong>{{ bemAberto.dono_texto }}</strong>, que não
            é um colaborador cadastrado. Escolha a pessoa acima para ligar de vez.
          </div>

          <label class="pat-campo">
            <span>Observação</span>
            <textarea v-model="form.observacao" rows="2" placeholder="Qualquer detalhe que ajude a identificar o bem"></textarea>
          </label>

          <label class="pat-check">
            <input type="checkbox" v-model="form.etiquetado">
            <span>Já está etiquetado</span>
          </label>

          <!-- Histórico de posse: só faz sentido em bem que já existe. -->
          <div class="pat-hist" v-if="!bemAberto.novo">
            <h4>Histórico de posse</h4>
            <div class="pat-hist-vazio" v-if="!historico.length">
              Ninguém pegou este bem ainda. Quando você colocar uma pessoa em "com quem está",
              a troca fica registrada aqui com a data.
            </div>
            <div class="pat-hist-linha" v-for="h in historico" :key="h.id">{{ textoLinhaHistorico(h) }}</div>
          </div>
        </div>

        <div class="pat-ficha-pe">
          <button class="pat-btn" @click="fecharFicha">Cancelar</button>
          <button class="pat-btn perigo" v-if="!bemAberto.novo && podeExcluir" @click="excluirBem">Excluir</button>
          <button class="pat-btn primario" :disabled="salvando" @click="salvarBem">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Acrescentar a lógica ao `<script setup>`**

Acrescentar aos imports existentes:

```js
import { parsearValor, fecharEAbrirHistorico } from './patrimonio.js'
import { textoLinhaHistorico } from './patrimonio-lista.js'
import { precisaDeDono } from './rotulos-do-bem.js'
import { hojeLocal } from '../../compartilhado/datas.js'
import { watch } from 'vue'
```

E o bloco da ficha:

```js
const salvando = ref(false)
const historico = ref([])
const podeExcluir = computed(() => hasPermission('patrimonio', 'excluir'))
const pessoasAtivas = computed(() => pessoas.value.filter((p) => p.status === 'ativo'))

const FORM_VAZIO = {
  nome: '', numero: '', valor: '', data_compra: '',
  empresa_id: '', local_id: '', comodo_id: '', categoria_id: '',
  pessoa_id: '', situacao: 'em_estoque', observacao: '', etiquetado: false,
}
const form = reactive({ ...FORM_VAZIO })

// Sai de "em uso": o dono some junto. Deixar uma pessoa presa num bem que foi
// pro estoque é como a base fica mentindo sobre quem tem o quê.
watch(() => form.situacao, (nova) => {
  if (!precisaDeDono(nova)) form.pessoa_id = ''
})

function fecharFicha() {
  bemAberto.value = null
  historico.value = []
}

async function carregarHistorico(bemId) {
  const { data } = await sbClient
    .from('patrimonio_posse').select('*').eq('bem_id', bemId).order('de', { ascending: false })
  historico.value = data || []
}

// Preenche o formulário quando a ficha abre (bem existente ou novo).
watch(bemAberto, async (bem) => {
  if (!bem) return
  if (bem.novo) {
    Object.assign(form, FORM_VAZIO)
    historico.value = []
    return
  }
  Object.assign(form, {
    nome: bem.nome || '',
    numero: bem.numero === null || bem.numero === undefined ? '' : String(bem.numero),
    valor: bem.valor_centavos === null || bem.valor_centavos === undefined ? '' : formatarValor(bem.valor_centavos),
    data_compra: bem.data_compra ? String(bem.data_compra).slice(0, 10) : '',
    empresa_id: bem.empresa_id || '',
    local_id: bem.local_id || '',
    comodo_id: bem.comodo_id || '',
    categoria_id: bem.categoria_id || '',
    pessoa_id: bem.pessoa_id || '',
    situacao: bem.situacao || 'em_estoque',
    observacao: bem.observacao || '',
    etiquetado: !!bem.etiquetado,
  })
  await carregarHistorico(bem.id)
})

async function registrarLog(acao, alvo, detalhe) {
  await sbClient.from('patrimonio_log').insert({ acao, alvo, resultado: 'ok', detalhe: detalhe || null })
}

// Toda troca de dono passa por aqui: fecha o registro do dono anterior e abre o
// do novo. A decisão do que gravar é da função pura fecharEAbrirHistorico, que
// já tem teste — aqui só se executa o plano que ela devolve.
async function sincronizarPosse(bemId, novoDonoId) {
  const { data: atual } = await sbClient.from('patrimonio_posse').select('*').eq('bem_id', bemId)
  const pessoa = pessoas.value.find((p) => p.id === novoDonoId)
  const plano = fecharEAbrirHistorico({
    historicoAtual: atual || [],
    novoDonoId: novoDonoId || null,
    novoDonoNome: pessoa ? pessoa.nome : null,
    hoje: hojeLocal(),
  })
  if (plano.aFechar) {
    await sbClient.from('patrimonio_posse').update({ ate: plano.aFechar.ate }).eq('id', plano.aFechar.id)
  }
  // Sem dono novo: só fecha o anterior, não abre registro de "ninguém".
  if (plano.aAbrir && novoDonoId) {
    await sbClient.from('patrimonio_posse').insert({
      bem_id: bemId,
      pessoa_id: plano.aAbrir.pessoa_id,
      pessoa_nome: plano.aAbrir.pessoa_nome,
      de: plano.aAbrir.de,
      ate: null,
    })
  }
}

async function salvarBem() {
  const nome = (form.nome || '').trim()
  if (!nome) { adminToast('Dê um nome ao bem', false); return }
  if (precisaDeDono(form.situacao) && !form.pessoa_id) {
    adminToast('Bem em uso precisa estar com alguém', false); return
  }
  const numeroTexto = (form.numero || '').trim()
  if (numeroTexto && !/^\d+$/.test(numeroTexto)) {
    adminToast('O nº da etiqueta é só número', false); return
  }
  const valorTexto = (form.valor || '').trim()
  const valorCentavos = valorTexto ? parsearValor(valorTexto) : null
  if (valorTexto && valorCentavos === null) {
    adminToast('Não entendi o valor. Use algo como 1.234,56', false); return
  }

  salvando.value = true
  const linha = {
    nome,
    numero: numeroTexto ? parseInt(numeroTexto, 10) : null,
    valor_centavos: valorCentavos,
    data_compra: form.data_compra || null,
    empresa_id: form.empresa_id || null,
    local_id: form.local_id || null,
    comodo_id: form.comodo_id || null,
    categoria_id: form.categoria_id || null,
    pessoa_id: form.pessoa_id || null,
    // Ligou numa pessoa de verdade: o nome solto da planilha perde a razão de existir.
    dono_texto: form.pessoa_id ? null : (bemAberto.value.dono_texto || null),
    situacao: form.situacao,
    observacao: (form.observacao || '').trim() || null,
    etiquetado: !!form.etiquetado,
    atualizado_em: new Date().toISOString(),
  }

  let bemId = bemAberto.value.novo ? null : bemAberto.value.id
  if (bemId) {
    const { error } = await sbClient.from('patrimonio_bens').update(linha).eq('id', bemId)
    if (error) { adminToast('Erro ao salvar: ' + error.message, false); salvando.value = false; return }
    await registrarLog('bem.editar', 'bem:' + bemId, nome)
  } else {
    const { data, error } = await sbClient.from('patrimonio_bens').insert(linha).select('id').single()
    if (error) { adminToast('Erro ao criar: ' + error.message, false); salvando.value = false; return }
    bemId = data.id
    await registrarLog('bem.criar', 'bem:' + bemId, nome)
  }

  await sincronizarPosse(bemId, form.pessoa_id || null)
  salvando.value = false
  fecharFicha()
  adminToast('Bem salvo')
  await carregar()
}

async function excluirBem() {
  const id = bemAberto.value.id
  const { error } = await sbClient.from('patrimonio_bens').delete().eq('id', id)
  if (error) { adminToast('Erro ao excluir: ' + error.message, false); return }
  await registrarLog('bem.excluir', 'bem:' + id, form.nome)
  fecharFicha()
  adminToast('Bem excluído')
  await carregar()
}
```

- [ ] **Step 3: Acrescentar o CSS da ficha ao `<style scoped>`**

```css
.tela-patrimonio .pat-ficha-fundo{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:flex-end;justify-content:center;}
.tela-patrimonio .pat-ficha{background:var(--surface);width:100%;max-height:92vh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;}
.tela-patrimonio .pat-ficha-topo{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid var(--border);}
.tela-patrimonio .pat-ficha-fechar{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font-size:15px;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-ficha-titulo{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);}
.tela-patrimonio .pat-ficha-corpo{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;}
.tela-patrimonio .pat-ficha-pe{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid var(--border);background:var(--surface);}

.tela-patrimonio .pat-campo{display:flex;flex-direction:column;gap:5px;font-family:var(--fonte-principal);}
.tela-patrimonio .pat-campo > span{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-campo em{font-style:normal;text-transform:none;letter-spacing:0;font-weight:400;}
.tela-patrimonio .pat-campo input,.tela-patrimonio .pat-campo select,.tela-patrimonio .pat-campo textarea{font-size:16px;font-family:var(--fonte-principal);padding:11px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);width:100%;}
.tela-patrimonio .pat-campo select:disabled{opacity:.5;}
.tela-patrimonio .pat-campo-par{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.tela-patrimonio .pat-check{display:flex;align-items:center;gap:9px;font-family:var(--fonte-principal);font-size:13px;color:var(--text);}
.tela-patrimonio .pat-check input{width:19px;height:19px;}
.tela-patrimonio .pat-nota{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:#92400e;background:#fef3c7;border-radius:8px;padding:10px 12px;}
.tela-patrimonio .pat-btn.perigo{border-color:#dc2626;color:#dc2626;}

.tela-patrimonio .pat-hist{border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:7px;}
.tela-patrimonio .pat-hist h4{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-hist-vazio{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:var(--muted);}
.tela-patrimonio .pat-hist-linha{font-family:var(--fonte-principal);font-size:12px;color:var(--text);padding:7px 10px;background:var(--surface2);border-radius:7px;}

@media(min-width:1025px){
  .tela-patrimonio .pat-ficha-fundo{align-items:center;}
  .tela-patrimonio .pat-ficha{max-width:560px;border-radius:14px;}
}
```

- [ ] **Step 4: Rodar build e testes**

```bash
npm run build 2>&1 | tail -10
npm test 2>&1 | tail -10
```

Esperado: os dois sem erro.

- [ ] **Step 5: Provar o ciclo completo no navegador**

Com `npm run dev -- --port 5199 --strictPort`, em 375px de largura:
1. Tocar `+` → cadastrar um bem de teste chamado `ZZ TESTE` com valor `1.234,56`, situação **Em estoque**. Salvar.
2. O cartão aparece na lista com `R$ 1.234,56` e a pílula azul "Em estoque".
3. Abrir o bem → mudar para **Em uso** sem escolher pessoa → tentar salvar. **Esperado: recusa** com "Bem em uso precisa estar com alguém".
4. Escolher uma pessoa → salvar → reabrir. **Esperado:** o histórico mostra uma linha `<Nome> · desde <hoje> · atual`.
5. Trocar para outra pessoa → salvar → reabrir. **Esperado:** duas linhas, a primeira fechada com a data de hoje.
6. Mudar para **Em estoque** → o campo de pessoa desabilita e esvazia sozinho → salvar → reabrir: o histórico anterior continua lá, fechado.
7. Excluir o bem `ZZ TESTE`.

**Importante:** usar sempre um bem de teste com nome `ZZ TESTE` e apagá-lo no fim. Não criar, editar nem apagar dado real do dono.

- [ ] **Step 6: Commit**

```bash
git add src/ferramentas/patrimonio/tela-de-patrimonio.vue
git commit -m "patrimonio: ficha do bem com entrega, devolução e histórico de posse"
```

---

### Task 10: Listas editáveis + remover a aba Patrimônio velha

**Files:**
- Modify: `src/ferramentas/patrimonio/tela-de-patrimonio.vue` (painel de listas)
- Modify: `src/ferramentas/acessos/tela-de-acessos.vue` (remover a aba Patrimônio)

**Interfaces:**
- Consumes: `sbClient`, `adminToast`, `hasPermission`.
- Produces: nada para outras tarefas — fecha a fase.

**Contexto:** o dono pediu explicitamente que **tudo seja editável** — empresa, local, cômodo, categoria, tipo. Sem isso ele fica preso nos seeds. E a aba Patrimônio velha da tela de acessos precisa sair na mesma leva: manter duas telas de patrimônio, uma lendo `acessos_dispositivos` (vazia) e outra lendo `patrimonio_bens`, confunde e é justamente o que esta fase desmonta.

- [ ] **Step 1: Acrescentar o botão de listas na topbar**

Em `tela-de-patrimonio.vue`, dentro de `.pat-topbar`, antes do botão `+`:

```vue
      <button class="pat-btn-listas" @click="listasAbertas = true" v-if="podeEditar" title="Listas">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
```

- [ ] **Step 2: Acrescentar o painel de listas ao `<template>`**

Depois do painel da ficha:

```vue
    <div class="pat-ficha-fundo" v-if="listasAbertas" @click.self="listasAbertas = false">
      <div class="pat-ficha">
        <div class="pat-ficha-topo">
          <button class="pat-ficha-fechar" @click="listasAbertas = false" aria-label="Fechar">✕</button>
          <span class="pat-ficha-titulo">Listas</span>
        </div>
        <div class="pat-ficha-corpo">
          <p class="pat-listas-ajuda">
            Estas são as opções que aparecem nos campos do bem. Pode criar, renomear
            e apagar à vontade — o que você escrever aqui é o que aparece lá.
          </p>
          <div class="pat-lista-bloco" v-for="def in DEFS_LISTAS" :key="def.tabela">
            <h4>{{ def.titulo }}</h4>
            <div class="pat-lista-item" v-for="item in def.ref.value" :key="item.id">
              <input
                class="pat-lista-nome"
                :value="item.nome"
                @change="renomearItem(def, item, $event.target.value)">
              <button class="pat-lista-del" @click="apagarItem(def, item)" aria-label="Apagar">✕</button>
            </div>
            <div class="pat-lista-novo">
              <input
                class="pat-lista-nome"
                v-model="novos[def.tabela]"
                :placeholder="'Nova opção em ' + def.titulo.toLowerCase()"
                @keyup.enter="criarItem(def)">
              <button class="pat-btn" @click="criarItem(def)">Adicionar</button>
            </div>
          </div>
        </div>
        <div class="pat-ficha-pe">
          <button class="pat-btn primario" @click="listasAbertas = false">Pronto</button>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Acrescentar a lógica das listas ao `<script setup>`**

```js
const listasAbertas = ref(false)
const podeEditar = computed(() => hasPermission('patrimonio', 'editar'))
const novos = reactive({
  patrimonio_empresas: '', patrimonio_locais: '',
  patrimonio_comodos: '', patrimonio_categorias: '',
})

// As quatro listas simples (nome + ordem). Tipo fica de fora por enquanto: ele
// depende de categoria, e um seletor encadeado no celular pede desenho próprio
// — entra numa fase seguinte, junto com a classificação de 3 níveis.
const DEFS_LISTAS = [
  { tabela: 'patrimonio_empresas',   titulo: 'Empresas',   ref: empresas },
  { tabela: 'patrimonio_locais',     titulo: 'Locais',     ref: locais },
  { tabela: 'patrimonio_comodos',    titulo: 'Cômodos',    ref: comodos },
  { tabela: 'patrimonio_categorias', titulo: 'Categorias', ref: categorias },
]

async function criarItem(def) {
  const nome = (novos[def.tabela] || '').trim()
  if (!nome) return
  const { error } = await sbClient.from(def.tabela).insert({ nome, ordem: def.ref.value.length + 1 })
  if (error) {
    // unique(nome) violado = a opção já existe. Dizer isso, não vomitar o erro do banco.
    const jaExiste = /duplicate key|unique/i.test(error.message)
    adminToast(jaExiste ? `"${nome}" já está na lista` : 'Erro: ' + error.message, false)
    return
  }
  novos[def.tabela] = ''
  await carregar()
}

async function renomearItem(def, item, novoNome) {
  const nome = (novoNome || '').trim()
  if (!nome || nome === item.nome) return
  const { error } = await sbClient.from(def.tabela).update({ nome }).eq('id', item.id)
  if (error) { adminToast('Erro ao renomear: ' + error.message, false); await carregar(); return }
  await carregar()
}

// Apagar uma opção NÃO apaga bem nenhum: as FKs são "on delete set null", então
// o bem fica sem aquele campo e continua lá. Avisar isso é honestidade, não enfeite.
async function apagarItem(def, item) {
  const usados = bens.value.filter((b) =>
    b.empresa_id === item.id || b.local_id === item.id ||
    b.comodo_id === item.id || b.categoria_id === item.id).length
  if (usados > 0) {
    adminToast(`"${item.nome}" está em ${usados} bem(ns). Eles ficam sem esse campo.`, false)
  }
  const { error } = await sbClient.from(def.tabela).delete().eq('id', item.id)
  if (error) { adminToast('Erro ao apagar: ' + error.message, false); return }
  await carregar()
}
```

- [ ] **Step 4: Acrescentar o CSS das listas**

```css
.tela-patrimonio .pat-btn-listas{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-listas-ajuda{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:var(--muted);}
.tela-patrimonio .pat-lista-bloco{display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--border);padding-top:12px;}
.tela-patrimonio .pat-lista-bloco h4{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-lista-item,.tela-patrimonio .pat-lista-novo{display:flex;gap:7px;align-items:center;}
.tela-patrimonio .pat-lista-nome{flex:1;min-width:0;font-size:16px;font-family:var(--fonte-principal);padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);}
.tela-patrimonio .pat-lista-del{width:36px;height:36px;flex-shrink:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:#dc2626;cursor:pointer;touch-action:manipulation;}
```

- [ ] **Step 5: Remover a aba Patrimônio da tela de acessos**

Em `src/ferramentas/acessos/tela-de-acessos.vue`:

1. Apagar o botão da aba no `<template>` (L88):
   `<button class="ac-tab" data-tab="patrimonio" onclick="_acSetTab('patrimonio')">Patrimônio</button>`
2. Apagar a linha de despacho em `_acRender` (L1394): `if(_acTab==='patrimonio')return _acRenderPatrimonio();`
3. Apagar as funções que só a aba usava: `_acRenderPatrimonio`, `_acPatPaint`, `_acPatSetFiltro`, e o estado `_acPatFiltro`/`_acPatCache` (bloco L2349-2391).
4. Apagar as duas chamadas `if(_acTab==='patrimonio')_acRenderPatrimonio();` (L2316 e L2346).
5. Remover de `Object.assign(window, {...})` as chaves que sumiram (`_acRenderPatrimonio`, `_acPatSetFiltro`) — deixar referência a função inexistente vira erro em runtime.

**Não apagar** `_acFormItem`, `_acSaveItem`, `_acSetItemStatus`, `_acDelItem`, `_acPatHistorico`, `_acPatDel`, `_acRenderPatItens` nem `_acItemTipoLabel`: eles ainda servem os blocos de Dispositivos/Veículos da FICHA do colaborador, que só saem na Fase 3.

Conferir que não sobrou referência órfã:

```bash
grep -n "_acRenderPatrimonio\|_acPatPaint\|_acPatSetFiltro\|_acPatCache\|_acPatFiltro\|data-tab=\"patrimonio\"" src/ferramentas/acessos/tela-de-acessos.vue
```

Esperado: **saída vazia**.

- [ ] **Step 6: Verificação final da fase**

```bash
cd /Users/erickmartins/iamundi
npm test 2>&1 | tail -10
npm run build 2>&1 | tail -10
```

Esperado: testes todos passando, build sem erro.

Com `npm run dev -- --port 5199 --strictPort`, conferir em **375px** e depois em **1440px**:
1. Central mostra **um** card "Gestão Interna" (o de "Colaboradores e Acessos" sumiu).
2. O card abre o menu com Colaboradores e Acessos, Patrimônio e Frota (apagado, "Em breve").
3. `/patrimonio` abre, o botão de listas cria/renomeia/apaga uma opção `ZZ TESTE` e ela aparece no seletor da ficha. **Apagar a opção de teste no fim.**
4. `/acessos` abre normal e **não tem mais a aba Patrimônio**; a ficha do colaborador continua funcionando.
5. Em 375px, nenhuma tela tem rolagem horizontal na página.

- [ ] **Step 7: Commit**

```bash
git add src/ferramentas/patrimonio/tela-de-patrimonio.vue src/ferramentas/acessos/tela-de-acessos.vue
git commit -m "patrimonio: listas editáveis e saída da aba velha da tela de acessos"
```

---

## Conferência antes de subir

A Fase 1 **não sobe sozinha**: `git push origin main` dispara build e deploy na Vercel. Antes de pedir o push ao dono:

1. `npm test` e `npm run build` verdes.
2. Conferido em celular de verdade, não só em render de 375px (regra do dono).
3. A permissão `patrimonio` está **desmarcada pra todo mundo** — conferir no painel de admin que nenhum usuário ganhou acesso sozinho. O dono concede a quem quiser depois de ver a tela.
4. Nenhum dado real do dono foi criado, editado ou apagado durante os testes (os bens de teste `ZZ TESTE` foram removidos).
5. `git status` limpo, sem script `zz-*.mjs` esquecido em `coletor/`.
