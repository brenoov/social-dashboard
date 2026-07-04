# Virada final da migração Vue (produção passa a servir o app Vue) — Design

**Data:** 2026-07-04
**Branch de origem:** `vue-migracao` (todas as 14 telas portadas, HEAD c8358c4)
**Status:** Design — aguardando (1) smoke-test do Breno no preview e (2) aprovação
**Contexto:** [[project_iamundi_vue_migracao]]. Todas as telas foram migradas do monólito para componentes Vue e validadas no preview. Esta spec descreve a VIRADA: fazer a produção (`main` → socialdashboard.rbvcompany.com) servir o build Vue em vez do `index.html` monólito, com rollback garantido.

---

## 1. Situação atual (como serve hoje vs. como vai servir)

- **Produção (`main`):** `index.html` = monólito (12.249 linhas), servido **estático** pela Vercel (sem build). `vercel.json` reescreve `/midia/:path*` → `projetos/central-inteligencia/midia/:path*` + headers de segurança.
- **Branch (`vue-migracao`):** `index.html` = entry do Vite (18 linhas, com as libs CDN); o app Vue vive em `src/`; `npm run build` gera `dist/`. `legacy/index.html` = o monólito preservado. `vercel.json` = fallback SPA `/(.*)→/index.html` + os MESMOS headers de segurança. A Vercel detecta Vite e builda automaticamente (os previews comprovam).

## 2. Descoberta que simplifica a virada — `/midia`

Investigação: os componentes Vue referenciam **apenas 2 imagens** em `/midia` (os logos `LOGOTIPOBRENOPRETO.png` e `LOGOTIPOBRENOBRANCO.png`), e a pasta de produção `projetos/central-inteligencia/midia/` tem **exatamente essas 2**. Ambas já estão em `public/midia/` na branch → o build gera `dist/midia/` → servidas como estático (com precedência sobre o fallback SPA). **Logo, a regra de rewrite `/midia` NÃO é necessária** no app Vue. A `vercel.json` da branch (SPA + headers) está correta para produção como está.

(Se no futuro entrarem mais imagens estáticas em `/midia`, basta colocá-las em `public/midia/`.)

## 3. A virada = merge `vue-migracao` → `main`

Ao mergear, `main` passa a ter: o entry Vite (`index.html`), o app (`src/`), o build config, a `vercel.json` SPA, e o monólito preservado (`legacy/index.html`). A Vercel, no push do `main`, detecta Vite → `npm run build` → publica o `dist/` em produção. O domínio passa a servir o app Vue.

**Conflito esperado no merge:** apenas `index.html` (monólito no `main` vs. entry-Vite na branch). Resolver para a **versão da branch** (o entry Vite). O conteúdo do monólito já está salvo como `legacy/index.html` na branch (idêntico ao `main:index.html` atual — sincronizado no commit 13f6cca e conferido). Todos os outros arquivos que o `main` mudou desde a base já foram trazidos para a branch (backend/migrations/docs), então não devem conflitar. **Critério de sucesso do merge:** `git diff vue-migracao main` vazio (árvore do `main` == árvore da branch).

## 4. Rollback (garantido)

Se algo quebrar em produção após a virada:
- **Opção A (mais rápida):** Vercel **Instant Rollback** — no painel da Vercel, promover de volta o último deployment de produção do monólito (1 clique; volta em segundos). Os deployments antigos do monólito continuam disponíveis.
- **Opção B (git):** `git revert -m 1 <commit-do-merge>` no `main` → a Vercel redeploya o monólito.
- **Fonte do monólito:** `legacy/index.html` continua no repo como referência/rollback manual se necessário.

## 5. Pré-requisitos e gotchas

- **Smoke-test do Breno no preview** (todas as telas) ANTES da virada — o preview usa o MESMO build que a produção usará. É a hora de pegar qualquer runtime bug.
- **`git config user.email` NUNCA vazio** — email vazio TRAVA o build na Vercel ([[project_iamundi_deploy]]). Confirmar `breno@rbvcompany.com` antes do merge/push.
- **Backend intocado:** coletor, edge functions (meta-proxy, bling-proxy, invite-user, coletar-dados), robôs (GitHub Actions), migrations — nada muda. Só a camada de serviço do FRONTEND muda.
- **Sem novas variáveis de ambiente:** o app usa a mesma anon key (hardcoded em `conectar-no-banco-de-dados.js`) + as edge functions autenticadas por sessão; libs via CDN. Nada a configurar na Vercel.
- **Conta gh:** `brenoov` (push no repo `brenoov/social-dashboard`).

## 6. Verificação pós-virada (produção)

Após o deploy de produção ficar READY, abrir **socialdashboard.rbvcompany.com** e conferir:
1. Login funciona (conta real do Breno) → cai na Início com os cards certos (permissões).
2. Cada tela abre e carrega dados reais (passar por todas).
3. Logos aparecem (`/midia`), fontes carregam, sem erro no console.
4. Headers de segurança presentes (X-Frame-Options etc.).
5. Deep-link/refresh numa rota (ex.: `/gestao-trafego`) funciona (fallback SPA).

Se tudo ok → virada concluída. Se não → rollback (§4) e investigar no preview.

## 7. Fora de escopo / follow-ups

- Apagar `legacy/index.html` (manter por enquanto como rede de segurança; remover só depois de dias estável).
- Papercut do avatar no Admin (`_setGubAvatar` toast falso) — follow-up cosmético.
- Extrair helpers duplicados (fmtR/escHtml/bling/perfColor copiados em vários componentes) para `src/compartilhado/` — refactor de limpeza futuro, não bloqueia a virada.
- Remover CSS morto acumulado em `estilos-globais.css` (regras já duplicadas nos componentes) — limpeza futura.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Runtime bug só aparece com dados/permissões reais em produção | Smoke-test exaustivo do Breno no preview (mesmo build); rollback pronto. |
| Merge bagunçado (index.html) | Conflito só no index.html; resolver pra branch; validar `git diff vue-migracao main` vazio. |
| Build trava na Vercel (email git vazio) | Conferir `git config user.email` antes. |
| Domínio/preview exige auth mas prod não | Prod é público (login do próprio app); previews sob a conta Vercel. Sem mudança de DNS. |
| Imagem `/midia` nova referenciada e ausente do build | Só 2 logos hoje, ambos em public/midia; regra: novas imagens estáticas vão em `public/midia/`. |
