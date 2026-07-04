# Virada final da migração Vue — Plano de execução (runbook)

> **Natureza:** este NÃO é um plano de código com TDD — é um **roteiro de operação** (merge + deploy de produção + verificação + rollback). Executar só APÓS (1) o smoke-test do Breno no preview e (2) o "ok" explícito dele. É mudança de PRODUÇÃO.

**Goal:** fazer socialdashboard.rbvcompany.com servir o app Vue (build do Vite) em vez do `index.html` monólito, preservando `/midia`, headers de segurança e rollback.

**Pré-condições:** todas as 14 telas portadas na `vue-migracao` (HEAD c8358c4), preview validado pelo Breno, `git config user.email = breno@rbvcompany.com` (email vazio TRAVA o build), conta gh `brenoov`.

---

## Passo 0 — Pré-voo (confirmar antes de tocar no main)

```bash
cd /Users/erickmartins/iamundi
git checkout vue-migracao
git config user.email   # DEVE imprimir breno@rbvcompany.com (se vazio, corrigir)
git config user.name    # brenoov
npm run build           # DEVE terminar sem erro (gera dist/)
git status --short      # DEVE estar limpo (tudo commitado)
git rev-parse --short HEAD   # anotar (esperado: c8358c4 ou o commit dos docs desta spec)
```
Esperado: build OK, working tree limpa. Se algo falhar, **parar** e resolver antes de mergear.

**Confirmar a `vercel.json` (SPA + headers, sem precisar de /midia):**
```bash
cat vercel.json
```
Esperado: `rewrites: [{ source:"/(.*)", destination:"/index.html" }]` + os 6 headers de segurança. (Os 2 logos vivem em `public/midia/` → build em `dist/midia/` → estáticos.)

## Passo 1 — Mergear `vue-migracao` → `main`

```bash
git checkout main
git config user.email breno@rbvcompany.com; git config user.name brenoov
git merge --no-ff vue-migracao -m "feat: virada para o app Vue (produção passa a servir o build Vite; monólito preservado em legacy/)"
```

**Conflito esperado: SÓ `index.html`** (monólito no main vs. entry-Vite na branch). Resolver para a **versão da branch** (o entry do Vite):
```bash
# se o merge parar com conflito em index.html:
git checkout --theirs index.html      # "theirs" = a branch sendo mergeada (vue-migracao) = o entry Vite
git add index.html
# conferir que nenhum OUTRO arquivo ficou em conflito:
git diff --name-only --diff-filter=U   # DEVE estar vazio
git commit --no-edit
```
(Se aparecer conflito em outro arquivo além de `index.html`, **parar** e inspecionar — não era esperado; a branch já trouxe o backend/docs do main.)

## Passo 2 — Verificar que o `main` ficou idêntico à branch (árvore certa)

```bash
git diff vue-migracao main --stat    # DEVE estar VAZIO (mesma árvore)
test -f legacy/index.html && wc -l legacy/index.html   # o monólito preservado (~12249 linhas)
head -1 index.html                    # DEVE ser <!doctype html> do entry Vite (18 linhas), NÃO o monólito
wc -l index.html                      # DEVE ser ~18
npm run build                         # sanity: build do main OK, gera dist/
```
Esperado: `git diff` vazio, `index.html` = entry Vite, `legacy/index.html` = monólito, build OK.

## Passo 3 — Publicar (deploy de produção)

```bash
git push origin main
```
A Vercel detecta o push no `main` → detecta Vite → `npm run build` → publica o `dist/` em **produção**.

**Acompanhar o deploy** (via MCP Vercel ou painel):
- Esperar o deployment de `main` com `target: production` ficar `state: READY`.
- Se `state: ERROR` → ver o log do build; causa provável = email git vazio ou erro de build (que o Passo 0 já pegaria). Corrigir e re-push.

## Passo 4 — Verificação em produção (checklist do Breno)

Abrir **https://socialdashboard.rbvcompany.com** (Ctrl+Shift+R):
- [ ] **Login** com a conta real → cai na Início com os cards certos (permissões via `profiles`).
- [ ] Passar por **todas as telas**: Notícias, Acessos, Banco, Vendas (Gestão à Vista + Análise de Vendas), Meta Ads (Análise de Campanhas + Gestão de Tráfego), Gestão Comercial, Dashboard Redes Sociais, Admin — cada uma abre e carrega dados reais.
- [ ] **Logos** aparecem, fontes carregam, **sem erro** no console (F12).
- [ ] **Deep-link/refresh** numa rota interna (ex.: recarregar em `/gestao-trafego`) funciona (fallback SPA).
- [ ] Headers de segurança presentes (aba Network → Response Headers: X-Frame-Options DENY etc.).
- [ ] Ações sensíveis (pausar campanha na GT, convidar usuário no Admin) — testar com cuidado OU só confirmar que os modais de confirmação aparecem.

Se tudo ✅ → **virada concluída**. Comunicar ao Breno. Se ❌ → **rollback (Passo 5)**.

## Passo 5 — Rollback (se algo quebrar)

**Opção A — Vercel Instant Rollback (segundos, recomendado):**
- No painel da Vercel (projeto social-dashboard) → Deployments → achar o último deployment de produção do MONÓLITO (antes do merge) → "Promote to Production" / "Instant Rollback". Produção volta ao monólito na hora.

**Opção B — git revert:**
```bash
git checkout main
git revert -m 1 <SHA-do-commit-de-merge>   # desfaz o merge
git push origin main                        # Vercel redeploya o monólito
```

Depois do rollback: investigar o bug no **preview da branch** (mesmo build), corrigir, re-testar, e reagendar a virada. O `legacy/index.html` continua sendo a fonte do monólito.

## Passo 6 — Pós-virada (dias depois, estável)

- Manter `legacy/index.html` por alguns dias como rede de segurança; remover só quando confiante.
- Follow-ups (não urgentes): papercut do avatar no Admin; extrair helpers duplicados para `src/compartilhado/`; limpar CSS morto de `estilos-globais.css`.

---

## Resumo de decisões

- **Virada = merge simples** `vue-migracao`→`main`; conflito só no `index.html` (resolver pra branch); Vercel builda Vite e serve `dist/`.
- **`/midia` não precisa de rewrite** (2 logos em `public/midia/` → `dist/midia/`).
- **Rollback** = Vercel Instant Rollback (1 clique) ou `git revert` do merge; monólito preservado em `legacy/`.
- **Nada muda no backend** (edge functions, robôs, migrations, secrets).
- **Não executar** sem o smoke-test + "ok" do Breno.
