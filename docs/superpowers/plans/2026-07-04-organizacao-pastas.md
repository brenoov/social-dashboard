# Organização das pastas do repositório — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Goal:** consolidar migrations (1 lugar) e mídia (1 lugar), e ter `LEIA-ME.txt` atualizado em TODA pasta versionada significativa, sem quebrar robôs nem a produção.

**Architecture:** `git mv` das migrations/mídia para os locais consolidados + atualização dos caminhos nos scripts que as leem + criação/revisão dos LEIA-MEs. Nada muda no que o app serve (`public/midia/` intacto, `dist/` igual). Branch a partir do `main`, verificar (build + grep + auditoria de LEIA-ME), merge+push.

**Tech Stack:** git, Node (coletor `.mjs`), Vite (build de sanidade).

## Global Constraints

- **Branch:** `chore/organizar-pastas` (a partir do `main`; nunca direto no main). `git config user.email = breno@rbvcompany.com` (vazio TRAVA o build Vercel), `user.name = brenoov`.
- **Manter `coletor`** (não renomear). **NÃO renomear** pastas fixas: `src/`, `public/`, `supabase/`, `.github/`, `dist/`, `node_modules/`, arquivos-raiz.
- **NÃO criar LEIA-ME** em gitignored: `.claude/ .vercel/ .superpowers/ .serena/ **/node_modules/ **/logs/ **/.temp/ coletor/supabase/`.
- **NÃO mexer** na estrutura de `projetos/central-inteligencia/` (Escritório 3D — mini-app à parte); só remover a cópia morta de mídia lá + adicionar LEIA-MEs.
- **Usar `git mv`** (preserva histórico). **`npm run build` deve continuar OK.**
- **LEIA-ME:** PT, linguagem de iniciante, 2-6 linhas; revisar e corrigir os existentes que estiverem desatualizados pós-migração. NÃO `git push` sem validar; o merge pro main é o passo final.

---

### Task 1: Consolidar migrations em `db/migrations/`

**Files:**
- Move: `docs/migrations/*.sql` → `db/migrations/`; `db/migrations-acessos/` → `db/migrations/acessos/`
- Modify: `coletor/run-migrations.mjs`, `coletor/run-acessos-sql.mjs` (comentário)

- [ ] **Step 1: Grep das referências atuais (pra saber o que atualizar)**
```bash
cd /Users/erickmartins/iamundi
git grep -n "docs/migrations\|migrations-acessos" -- . ':(exclude)docs/superpowers/*' ':(exclude)legacy/*'
```
Anotar cada hit fora de `docs/superpowers/` e `legacy/`.

- [ ] **Step 2: Mover os arquivos com `git mv`**
```bash
mkdir -p db/migrations
git mv docs/migrations/*.sql db/migrations/
git mv db/migrations-acessos db/migrations/acessos
rmdir docs/migrations 2>/dev/null || true
```
Esperado: `db/migrations/*.sql` + `db/migrations/acessos/*.sql`; `docs/migrations/` e `db/migrations-acessos/` somem.

- [ ] **Step 3: Apontar `run-migrations.mjs` para `db/migrations/` (não-recursivo)**

Em `coletor/run-migrations.mjs`, achar onde ele monta o caminho da pasta de migrations (procurar `docs/migrations`). Trocar `docs/migrations` por `db/migrations`. Garantir que ele lê só os `.sql` do nível de cima (ex.: `readdirSync(dir).filter(f=>f.endsWith('.sql'))` já ignora subpastas; se ele recursa, restringir para NÃO entrar em `acessos/`). Ler o arquivo e ajustar o path literal:
```bash
grep -n "docs/migrations\|readdirSync\|readdir\|\.sql" coletor/run-migrations.mjs
```
Editar a(s) linha(s) do caminho: `docs/migrations` → `db/migrations`. Se houver leitura recursiva, adicionar guarda pra pular a subpasta `acessos`.

- [ ] **Step 4: Atualizar o comentário de exemplo em `run-acessos-sql.mjs`**

Trocar `../db/migrations-acessos/006_zoho.sql` por `../db/migrations/acessos/006_zoho.sql` (é só comentário; o script recebe o arquivo por argumento).

- [ ] **Step 5: Atualizar quaisquer outros hits do Step 1** (scripts/docs que citem os caminhos antigos).

- [ ] **Step 6: Verificar**
```bash
node --check coletor/run-migrations.mjs && echo "run-migrations sintaxe OK"
git grep -n "docs/migrations\|migrations-acessos" -- . ':(exclude)docs/superpowers/*' ':(exclude)legacy/*' ':(exclude)*.md' || echo "sem refs antigas ✅"
ls db/migrations/*.sql | head -3 && ls db/migrations/acessos/*.sql | head -3
```
Esperado: sintaxe OK, sem refs antigas (fora de docs/specs e legacy), arquivos no lugar.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "chore(migrations): consolida docs/migrations + db/migrations-acessos em db/migrations/ (+acessos/); atualiza run-migrations.mjs"
```

---

### Task 2: Consolidar mídia em `public/midia/`

**Files:**
- Delete: `projetos/central-inteligencia/midia/`, `midia/` (raiz, após conferir uso)
- Move (se usado): `midia/logos/rbv-logo.png` → `public/midia/`

- [ ] **Step 1: Grep de quem usa as mídias fora de `public/midia/`**
```bash
cd /Users/erickmartins/iamundi
git grep -n "midia/logos\|midia/elementos\|central-inteligencia/midia\|rbv-logo" -- . ':(exclude)legacy/*' ':(exclude)docs/*'
```
Se `rbv-logo.png` for referenciado no código vivo (`src/`, `projetos/.../escritorio-3d/`), levar pro `public/midia/`; senão, não levar. Se algo referenciar `projetos/.../midia/` no Escritório 3D, apontar pro caminho certo (ou anotar como órfão pós-virada).

- [ ] **Step 2: Confirmar que o app Vue só usa os 2 logos de `public/midia/`**
```bash
git grep -n "/midia/" -- src | grep -oE "/midia/[A-Za-z0-9._-]+" | sort -u
ls public/midia/
```
Esperado: só `LOGOTIPOBRENOPRETO.png` e `LOGOTIPOBRENOBRANCO.png`, ambos já em `public/midia/`.

- [ ] **Step 3: Levar o que faltar (se o Step 1 mostrou uso do rbv-logo)**
```bash
# só se rbv-logo for usado:
git mv midia/logos/rbv-logo.png public/midia/rbv-logo.png
```
(Se não for usado, pular.)

- [ ] **Step 4: Apagar as pastas de mídia mortas/duplicadas**
```bash
git rm -r projetos/central-inteligencia/midia
git rm -r midia
```
(A imagem pesada de `midia/elementos/` já é gitignored — sai junto ao remover a pasta; confirmar que nada versionado importante fica pra trás com `git status`.)

- [ ] **Step 5: Verificar**
```bash
npm run build >/dev/null 2>&1 && echo "BUILD OK ✅" || echo "BUILD FALHOU ❌"
ls dist/midia/   # os 2 logos (e rbv-logo se movido) devem estar no build
git grep -n "midia/logos\|central-inteligencia/midia" -- . ':(exclude)legacy/*' ':(exclude)docs/*' || echo "sem refs mortas ✅"
```
Esperado: build OK, `dist/midia/` com os logos, sem refs às pastas removidas.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore(midia): consolida em public/midia/ (remove cópias mortas midia/ raiz e projetos/.../midia/)"
```

---

### Task 3: `LEIA-ME.txt` em TODA pasta versionada + revisar/corrigir os existentes

**Files:** criar/editar `LEIA-ME.txt` nas pastas listadas.

- [ ] **Step 1: Criar os LEIA-ME que FALTAM** (PT, iniciante, 2-6 linhas dizendo o que a pasta é/faz). Criar em CADA uma (usar o conteúdo real da pasta):
  - `src/LEIA-ME.txt` — "O app Vue (frente que roda no navegador). Cada tela em `ferramentas/<nome>/`, o miolo em `compartilhado/`, o roteador em `mapa-de-enderecos.js`, o começo em `ponto-de-partida.js`."
  - `public/LEIA-ME.txt` — "Arquivos servidos direto (sem passar pelo build), no caminho raiz do site. Ex.: `midia/` (logos)."
  - `public/midia/LEIA-ME.txt` — "Imagens servidas em /midia/ (logos RBV usados no login e no topo das telas). Pra adicionar uma imagem estática nova, coloque aqui."
  - `supabase/LEIA-ME.txt` — "Config do Supabase. `functions/` = as Edge Functions (servidores pequenos que rodam na nuvem)."
  - `supabase/functions/LEIA-ME.txt` — "Cada subpasta é uma Edge Function (proxy/serviço). O Supabase CLI exige que fiquem aqui — não renomear a pasta `functions`."
  - Uma em CADA subpasta de função — listar com `ls -d supabase/functions/*/` e criar em todas (ex.: `coletar-dados`, `acessos-proxy`, `acessos-oauth`, `auditar-dados`, `meta-proxy`, `bling-proxy`, `invite-user`): 1-2 linhas dizendo o que a função faz.
  - `.github/workflows/LEIA-ME.txt` — "Agendamentos (GitHub Actions) que disparam os robôs do `coletor/` em horários fixos. O GitHub exige o nome `workflows`."
  - `db/LEIA-ME.txt` — "Banco de dados: `migrations/` = mudanças de estrutura do banco (rodadas pelos scripts do `coletor/`)."
  - `db/migrations/LEIA-ME.txt` — "Migrations gerais do banco (uma por arquivo `.sql`, em ordem). Rodadas por `coletor/run-migrations.mjs`. As do módulo de Acessos ficam em `acessos/`."
  - `db/migrations/acessos/LEIA-ME.txt` — "Migrations do módulo Colaboradores e Acessos. Rodadas uma a uma via `coletor/run-acessos-sql.mjs <arquivo>`."
  - `docs/superpowers/LEIA-ME.txt` — "Specs e planos de cada mudança (o registro de 'o que a gente combinou e como'). `specs/` = desenhos, `plans/` = passo a passo."
  - `docs/superpowers/specs/LEIA-ME.txt` — "Os desenhos/decisões (design docs) de cada feature."
  - `docs/superpowers/plans/LEIA-ME.txt` — "Os passo-a-passo de implementação de cada feature."
  - `coletor/lib/LEIA-ME.txt` — "Peças compartilhadas pelos robôs do `coletor/` (ex.: cálculo de ritmo de meta)."
  - `projetos/central-inteligencia/escritorio-3d/LEIA-ME.txt` — "O 'Escritório 3D' dos agentes (página estática à parte, em three.js). Não faz parte do app Vue."
  - `projetos/central-inteligencia/backup/LEIA-ME.txt` — "Backups antigos (não usados pelo app)."
  - `projetos/central-inteligencia/redes-sociais/coletor/LEIA-ME.txt` — "Coletor legado (Python) de redes sociais deste projeto. Referência histórica."

- [ ] **Step 2: REVISAR e CORRIGIR todos os LEIA-ME EXISTENTES**

Ler CADA `LEIA-ME.txt` existente e corrigir o que estiver desatualizado pós-migração:
```bash
git ls-files '*LEIA-ME.txt' | while read f; do echo "=== $f ==="; cat "$f"; echo; done
```
Corrigir especificamente:
  - Qualquer que descreva o **monólito antigo** / `index.html` gigante / v1.3 / telas por `display:none` → atualizar pra realidade Vue (componentes, rotas).
  - Qualquer que aponte para arquivo renomeado: `tela-X.vue`→`tela-de-X.vue`; migrations em `docs/migrations`/`db/migrations-acessos` → `db/migrations/`.
  - `coletor/LEIA-ME.txt` — mencionar que as migrations agora ficam em `db/migrations/` (e `db/migrations/acessos/`).
  - `midia/LEIA-ME.txt` — some (a pasta foi removida na Task 2).
  - `legacy/LEIA-ME.txt` — conferir que ainda descreve certo (é o monólito preservado pra rollback).
  - Os de `src/ferramentas/*` — conferir que o "Arquivo principal:" aponta pro nome novo `tela-de-<x>.vue` (a arrumação de nomes já corrigiu, mas revalidar).

- [ ] **Step 3: Adicionar/atualizar a regra permanente no LEIA-ME da raiz**

Criar `LEIA-ME.txt` na RAIZ do repo (se não existir) OU adicionar no `docs/LEIA-ME.txt`: uma linha dizendo "REGRA: toda pasta nova nasce com um `LEIA-ME.txt` (PT, linguagem de iniciante)."

- [ ] **Step 4: Verificar cobertura (re-auditar)**
```bash
cd /Users/erickmartins/iamundi
find . -type d -not -path '*/node_modules/*' -not -name node_modules -not -path '*/dist/*' -not -name dist -not -path '*/.git/*' -not -name .git -not -path '*/logs/*' -not -path '*/.temp/*' -not -path './.claude/*' -not -path './.vercel/*' -not -path './.superpowers/*' -not -path './.serena/*' -not -path './coletor/supabase/*' 2>/dev/null | while read d; do [ "$d" = "." ] && continue; ls "$d"/LEIA-ME.txt >/dev/null 2>&1 || echo "FALTA: $d"; done
```
Esperado: **nenhuma** linha "FALTA" (fora das gitignored já excluídas). Se sobrar alguma versionada significativa, criar.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "docs(leia-me): LEIA-ME.txt em toda pasta versionada + revisão/correção dos desatualizados pós-migração Vue"
```

---

### Task 4: Verificação final + virada (merge no main)

- [ ] **Step 1: Sanidade geral**
```bash
cd /Users/erickmartins/iamundi
git config user.email   # breno@rbvcompany.com
npm run build >/dev/null 2>&1 && echo "BUILD OK ✅" || echo "FALHOU ❌"
node --check coletor/run-migrations.mjs && echo "runner OK"
git status --short   # deve estar limpo (tudo commitado)
```

- [ ] **Step 2: Conferir que nada de produção quebrou (o serving é o mesmo)**
```bash
ls dist/midia/   # logos presentes
git diff main --stat -- src/ | grep -v LEIA-ME || echo "src só mudou LEIA-ME (esperado) ✅"
```
Esperado: `src/` só teve LEIA-ME adicionado (o app é idêntico); build gera os logos.

- [ ] **Step 3: Merge no main + push (reflete no GitHub)**
```bash
git checkout main
git config user.email breno@rbvcompany.com; git config user.name brenoov
git merge --ff-only chore/organizar-pastas
git push origin main
```
A Vercel redeploya (build igual — sem impacto no que é servido). Confirmar o deploy de produção READY.

- [ ] **Step 4: Rollback (se necessário)** — `git revert <commit>` do(s) commit(s) de arrumação (é dev/infra; não muda o app servido).

---

## Notas de execução

- **Ordem:** T1 (migrations) → T2 (mídia) → T3 (LEIA-ME) → T4 (merge).
- **Baixo risco de produção:** nada muda no que o app serve; migrations são dev-time; a mídia consolidada mantém `public/midia/` intacto. Build validado antes do merge.
- **Se o grep achar refs inesperadas** (ex.: o Escritório 3D usa `/midia/...`): apontar pro `public/midia/` OU documentar como órfão pós-virada (o Escritório 3D não está no build Vue) — não inventar; anotar no relatório.
