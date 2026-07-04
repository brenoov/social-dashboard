# Organização das pastas do repositório (consolidar + LEIA-ME em tudo) — Design

**Data:** 2026-07-04
**Branch de origem:** `main` (produção; app Vue já no ar)
**Status:** Design aprovado pelo Breno — aguardando revisão da spec
**Contexto:** pós-migração Vue ([[project_iamundi_vue_migracao]]), o `src/` está limpo, mas o resto do repo tem heranças do monólito: migrations em 2 lugares, mídia em 3, e várias pastas sem `LEIA-ME.txt`. O Breno quer o repositório "organizado muito melhor" — decisão: **consolidar o espalhado + nomes claros + LEIA-ME em TODAS as pastas versionadas** (sem números; manter `coletor`).

---

## 1. Princípios / restrições

- **Sem números** nos nomes (escolha do Breno). **Nomes PT literais.** Manter `coletor` (renomear mexeria em 10 GitHub Actions — risco à toa).
- **Pastas fixas por ferramenta — NÃO renomear:** `src/`, `public/`, `supabase/` (Supabase CLI exige `supabase/functions`), `.github/` (GitHub exige `.github/workflows`), `dist/`, `node_modules/`, e os arquivos-raiz (`index.html`, `vite.config.js`, `package.json`, `vercel.json`).
- **Gitignored — ignorar (não criar LEIA-ME):** `.claude/`, `.vercel/`, `.superpowers/`, `.serena/`, `**/node_modules/`, `**/logs/`, `**/.temp/`, `coletor/supabase/` (ignorada).
- **NÃO mexer** na estrutura de `projetos/central-inteligencia/` (é o Escritório 3D + coletor legado, mini-app à parte) — só remover a cópia morta de mídia lá + adicionar LEIA-MEs.
- **Risco de produção BAIXO:** a virada Vue já está no ar; esta arrumação é de arquivos de dev/infra (migrations, mídia-fonte, docs) — **não muda o que o app serve** (`public/midia/` fica como está, com os 2 logos que o app usa). O build (`dist/`) não muda.

## 2. Mudança 1 — Migrations num lugar só

Hoje: `docs/migrations/` (gerais; rodadas por `coletor/run-migrations.mjs`) + `db/migrations-acessos/` (do módulo de acessos; rodadas via `coletor/run-acessos-sql.mjs <arquivo>`).

**Alvo:** tudo sob **`db/migrations/`**:
- `docs/migrations/*.sql` → `db/migrations/*.sql`
- `db/migrations-acessos/` → `db/migrations/acessos/`

**Atualizar caminhos:**
- `coletor/run-migrations.mjs`: lê `docs/migrations/` → passa a ler `db/migrations/`; deve rodar só os `.sql` do **nível de cima** (NÃO recursivo — não pegar a subpasta `acessos/`, que é rodada à parte).
- `coletor/run-acessos-sql.mjs`: recebe o arquivo por argumento — só atualizar o **comentário** de exemplo (de `../db/migrations-acessos/006_zoho.sql` para `../db/migrations/acessos/006_zoho.sql`).
- **Grep de segurança:** procurar qualquer outra referência a `docs/migrations` ou `migrations-acessos` no repo (scripts, docs) e atualizar.

## 3. Mudança 2 — Mídia num lugar só

Hoje: `midia/` (raiz: `logos/` com 3 pngs + `elementos/` — a imagem pesada é gitignored, sobra só `.gitkeep`), `public/midia/` (2 logos — **o que o app Vue serve**), `projetos/central-inteligencia/midia/` (cópia morta, era alvo do rewrite antigo).

**Alvo:** **`public/midia/`** como único lugar da mídia servida:
- Garantir em `public/midia/` os logos que o app usa (`LOGOTIPOBRENOPRETO.png`, `LOGOTIPOBRENOBRANCO.png` — já estão) + levar `midia/logos/rbv-logo.png` se for referenciado em algum lugar (grep; se ninguém usa, não levar).
- **Apagar** `projetos/central-inteligencia/midia/` (cópia morta) e a pasta `midia/` da raiz (após mover o que for versionado e usado). A imagem pesada de `midia/elementos/` já é gitignored (não versionada) — sai junto.
- **Grep de segurança:** procurar referências a `midia/logos`, `midia/elementos`, `projetos/central-inteligencia/midia` no código vivo (`src/`, `coletor/`, `supabase/`) e no Escritório 3D (`projetos/.../escritorio-3d/`); ajustar se houver (o app vivo só usa `/midia/...` = `public/midia/`, confirmado).

## 4. Mudança 3 — `LEIA-ME.txt` em TODA pasta versionada significativa

Auditoria feita. Adicionar `LEIA-ME.txt` (PT, iniciante, 2-6 linhas dizendo o que é a pasta) nas versionadas que faltam:
- `src/` (raiz do app), `public/`, `public/midia/`
- `supabase/`, `supabase/functions/`, e **cada** subpasta de função (`coletar-dados`, `acessos-proxy`, `acessos-oauth`, `auditar-dados`, `meta-proxy`, `bling-proxy`, `invite-user` — listar todas)
- `.github/workflows/`
- `db/`, `db/migrations/`, `db/migrations/acessos/`
- `docs/superpowers/`, `docs/superpowers/specs/`, `docs/superpowers/plans/`
- `coletor/lib/`
- `projetos/central-inteligencia/escritorio-3d/`, `projetos/central-inteligencia/backup/`, `projetos/central-inteligencia/redes-sociais/coletor/`

**REVISAR E CORRIGIR TODOS os `LEIA-ME.txt` EXISTENTES (pedido do Breno):** ler cada um e atualizar o que estiver ANTIGO/DESATUALIZADO pós-migração — ex.: LEIA-ME que descreve o monólito antigo, aponta para arquivo/pasta renomeado ou movido (migrations, mídia, `tela-X.vue`→`tela-de-X.vue`), ou descreve fluxo que mudou. Os já existentes: `src/ferramentas/*` (14), `src/compartilhado`, `src/estilos`, `coletor` (mencionar que migrations vão pra `db/migrations/`), `docs`, `legacy`, `projetos`, `projetos/central-inteligencia`, `projetos/.../redes-sociais`, `.github`. (A de `midia/` sai junto com a pasta.) Conferir cada um contra a realidade atual e corrigir.

**Regra permanente (documentar no LEIA-ME da raiz de `docs/` ou num `LEIA-ME.txt` da raiz do repo):** toda pasta nova nasce com `LEIA-ME.txt`.

## 5. Execução + verificação

- Fazer numa branch a partir do `main` (`chore/organizar-pastas`). Usar `git mv` (preserva histórico).
- **Verificar:**
  - `npm run build` OK (o app não deve ser afetado — só LEIA-MEs tocam `src/`).
  - `git grep` não acha mais `docs/migrations` nem `migrations-acessos` (fora do histórico/docs desta spec).
  - Toda pasta-alvo tem `LEIA-ME.txt` (re-rodar a auditoria).
  - `coletor/run-migrations.mjs` aponta pra `db/migrations/` e não recursa em `acessos/`.
- **Merge + push** pro `main` (reflete no GitHub / "online") — como a mudança não afeta o serving, o deploy de produção é seguro (build igual).
- **Rollback:** `git revert` do commit de arrumação (é dev/infra; não muda o app servido).

## 6. Fora de escopo

- Renomear `coletor`→`robos` (Breno quis manter).
- Renomear/mover pastas fixas por ferramenta.
- Reestruturar o Escritório 3D (`projetos/.../escritorio-3d/`) — mini-app à parte; só ganha LEIA-ME.
- Apagar `legacy/` (só depois de dias estável — item à parte).
- Migrar o Escritório 3D pro Vue (não pedido).

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Quebrar o runner de migrations | Atualizar `run-migrations.mjs` (path + não-recursivo) e testar o grep; migrations são dev-time (não afetam produção). |
| Apagar mídia que algo usa | Grep antes de apagar (`midia/logos`, `elementos`, projetos midia); o app vivo só usa `public/midia`. |
| Afetar o serving de produção | Não afeta: `public/midia` intacto, `dist/` igual, `src/` só ganha 1 LEIA-ME. Build validado antes do merge. |
| Referência solta no Escritório 3D | Grep no `escritorio-3d/`; se referenciar `/midia/...`, apontar pro `public/midia` (ou deixar, pois é orfão pós-virada — documentar). |
