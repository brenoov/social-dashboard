# Base de Layout responsivo do iamundi — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Goal:** criar a base de layout compartilhada (variáveis + classes utilitárias no `estilos-globais.css` + doc de regra) e aplicá-la nas 14 telas, começando pela Gestão de Tráfego (piloto), pra que nada estoure no celular e o layout fique harmônico em todo dispositivo.

**Architecture:** vars `--sp-*`/`--gutter`/`--container-max`/`--card-*` e classes globais (`.container-app`, `.grade-cards`, `.card-base`, `.topbar-app`, `.titulo-tela`, `.rotulo-secao`) no `estilos-globais.css` (não-scoped → atravessam o CSS scoped das telas). O "pente" aplica isso por tela, só em CSS/estrutura (JS verbatim), validando por render headless em 375/768/desktop.

**Tech Stack:** CSS (custom properties + `@media`), Vue SFC `<style>`, Vite build, Playwright headless (render de validação).

## Global Constraints

- **Branch por etapa** (`feat/layout-base`, depois `feat/layout-gt`, etc.), a partir do `main`; nunca direto no main. `git config user.email = breno@rbvcompany.com` (vazio TRAVA o build).
- **Breakpoints padrão (literais):** celular `≤640px` · tablet `641–1024px` · desktop `1025–1919px` · TV `≥1920px`.
- **Escala de espaçamento única:** `--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:24px --sp-6:32px --sp-8:48px`. Nada de número solto novo.
- **Sem mudar comportamento/dados** — só layout/CSS. JS verbatim. **Não regredir o desktop.**
- **Validar por RENDER** (Playwright headless: `browser_run_code_unsafe` → `setContent`+`screenshot` na MESMA chamada; `:root` com as vars) em 375px, 768px e desktop antes de subir. `npm run build` verde.
- Produção no ar: cada etapa por branch → render → merge, rollback pronto (`git revert`).

---

### Task 1: Base compartilhada no `estilos-globais.css` + doc da regra

**Files:**
- Modify: `src/estilos/estilos-globais.css` (adicionar vars no `:root` + classes utilitárias + overrides `@media`)
- Create: `docs/base-de-layout.md`

**Interfaces:**
- Produces (globais, disponíveis a todas as telas): vars `--sp-1..--sp-8`, `--gutter`, `--container-max`, `--card-radius`, `--card-pad`, `--card-gap`, `--card-min`; classes `.container-app`, `.grade-cards`, `.card-base`, `.topbar-app` (+ `.topbar-app__voltar/__titulo/__filtros/__status`), `.titulo-tela`, `.rotulo-secao`, `.rolagem-x`.

- [ ] **Step 1: Adicionar as variáveis no `:root`**

No topo do `:root` de `estilos-globais.css` (junto das vars existentes), acrescentar:
```css
  /* ── Base de layout (espaçamento, container, cards) — ver docs/base-de-layout.md ── */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-8:48px;
  --gutter:16px;            /* margem lateral segura (cresce no desktop, ver @media) */
  --container-max:1280px;   /* largura máxima do conteúdo */
  --card-radius:12px; --card-pad:var(--sp-4); --card-gap:var(--sp-3); --card-min:260px;
```

- [ ] **Step 2: Adicionar as classes utilitárias (não-scoped, globais)**

No fim do `estilos-globais.css`:
```css
/* ── Base de layout do iamundi (classes compartilhadas) ── */
*{box-sizing:border-box;}
.container-app{width:100%;max-width:var(--container-max);margin-inline:auto;padding-inline:var(--gutter);}
.grade-cards{display:grid;gap:var(--sp-4);grid-template-columns:repeat(auto-fill,minmax(var(--card-min),1fr));}
.card-base{background:var(--surface);border:1px solid var(--border);border-radius:var(--card-radius);padding:var(--card-pad);}
.titulo-tela{font-family:'Oswald',sans-serif;font-size:clamp(18px,2.4vw,26px);font-weight:600;letter-spacing:1px;color:var(--text);}
.rotulo-secao{font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
.rolagem-x{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;}
.rolagem-x::-webkit-scrollbar{height:5px;} .rolagem-x::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
/* Topbar padrão */
.topbar-app{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--gutter);border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.topbar-app__titulo{flex:1;min-width:0;}
.topbar-app__filtros{display:flex;align-items:center;gap:var(--sp-2);flex-shrink:0;}
.topbar-app__status{flex-shrink:0;text-align:right;}
/* Nunca rolar o body na horizontal */
html,body{max-width:100%;overflow-x:hidden;}
img{max-width:100%;}
/* ── Responsivo por breakpoint ── */
@media(min-width:1025px){ :root{ --gutter:32px; } }
@media(min-width:641px) and (max-width:1024px){ :root{ --gutter:24px; } }
@media(max-width:640px){
  :root{ --gutter:16px; --card-min:100%; }        /* cards viram 1 coluna */
  .topbar-app{flex-wrap:wrap;gap:var(--sp-2);}
  .topbar-app__filtros{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;}
  .topbar-app__status{display:none;}              /* relógio/status somem no celular */
}
```
(As vars `--surface/--border/--muted/--text` já existem no global.)

- [ ] **Step 3: Escrever o doc da regra**

Create `docs/base-de-layout.md` (PT, iniciante): explica os breakpoints, a escala de espaçamento, o container, a grade de cards, a topbar padrão, o reset de fonte no celular, e a REGRA "toda tela nova usa `.container-app`/`.grade-cards`/`.topbar-app`, a escala `--sp-*`, e reseta a fonte no celular; validar em 375/768/desktop".

- [ ] **Step 4: Verificar**
```bash
cd /Users/erickmartins/iamundi
npm run build >/dev/null 2>&1 && echo "BUILD OK ✅" || echo "FALHOU ❌"
grep -c "container-app\|grade-cards\|topbar-app\|--sp-4" src/estilos/estilos-globais.css
```
Esperado: build OK; classes/vars presentes. **Render de sanidade:** um `.container-app` com `.grade-cards` de 4 `.card-base` em 375px (1 coluna) e desktop (várias colunas) — confirmar empilhamento.

- [ ] **Step 5: Commit**
```bash
git add src/estilos/estilos-globais.css docs/base-de-layout.md
git commit -m "feat(layout): base compartilhada — vars de espaçamento/container/card + classes .container-app/.grade-cards/.topbar-app + doc da regra"
```

---

### Task 2: Piloto — aplicar a base na Gestão de Tráfego

**Files:** Modify `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (template da topbar + `<style scoped>`).

**Interfaces:** Consumes as classes/vars da Task 1.

- [ ] **Step 1: Topbar da GT → padrão responsivo**

No template, o `.gv-topbar` (5 blocos numa linha) passa a se comportar como `.topbar-app`: manter as classes `.gv-*` mas, no `<style scoped>`, no `@media(max-width:640px)`:
  - `.gv-topbar` → `flex-wrap:wrap; padding:var(--sp-2) var(--sp-4); gap:var(--sp-2);`
  - `.gv-period-btns` → `width:100%; overflow-x:auto; flex-wrap:nowrap; -webkit-overflow-scrolling:touch;` (os 9 botões viram uma **faixa rolável**, não quebram em 3 linhas)
  - `.gv-clock-wrap` → `display:none;` (relógio some no celular)
  - `.gv-topbar-brand .gv-brand-tag` → `display:none;` (subtítulo some)
  - o seletor de conta (`#gt-account-picker`) → largura total ou compacto (`order:3`)

- [ ] **Step 2: Reset da fonte inflada no celular**

O root `.tela-gestao-trafego` tem `--gt-fs:1.3`. Adicionar no scoped:
```css
@media(max-width:640px){ .tela-gestao-trafego{ --gt-fs:1; } }
```
(No celular a fonte volta pra 100% — para de inflar.)

- [ ] **Step 3: Container + cards no miolo**

O `.gt-body`/lista de campanhas: garantir `padding-inline:var(--gutter)` e que os cards de campanha empilham/couberem (largura total no celular, sem estourar). Onde houver métricas/linhas lado a lado que se sobrepõem no celular, deixar `flex-wrap:wrap` + `gap:var(--sp-2)`. Tabelas/conteúdo largo em `.rolagem-x`.

- [ ] **Step 4: VALIDAR por render (375 + 768 + desktop)**

Renderizar a topbar + um card de campanha da GT (replicar HTML/CSS reais) nos 3 tamanhos via Playwright headless; Ler os PNGs; confirmar: topbar não estoura (filtros rolam), fonte normal, card empilha, nada sobreposto. Iterar até ficar limpo.

- [ ] **Step 5: Build + commit**
```bash
npm run build >/dev/null 2>&1 && echo OK
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(layout-gt): Gestão de Tráfego responsiva — topbar com filtros roláveis, relógio oculto no celular, fonte 100%, cards empilham"
```

- [ ] **Step 6: Merge no main + validar produção**

Após o Breno conferir o render, merge `feat/layout-gt`→`main`, push, e conferir no celular real. (Se algo, rollback via `git revert`.)

---

## Próximas etapas (fora deste plano — 1 grupo/sessão)

Repetir o padrão da Task 2 nas demais, agrupadas:
- **Menus** (início, vendas, meta-ads): cards da home empilham; topbar simples.
- **Painéis-TV** (gestão à vista, análise de vendas): já têm modo TV; ajustar o celular (grade 1 coluna, topbar rolável).
- **Dashboards densos** (redes-sociais, análise-campanhas, gestão-comercial): um a um (muitos cards/gráficos).
- **Utilitárias** (banco, acessos, admin, notícias, login): topbar + grade + margens.
Cada uma: branch → aplica a base → render 375/768/desktop → merge.

## Notas

- **Ordem:** T1 (base) → T2 (GT piloto) → demais por sessão.
- **Só CSS/estrutura muda** — validar que cada tela ainda carrega (build + abrir no preview).
- **Render é obrigatório** antes de subir (lição do fluxograma: não chutar geometria).
