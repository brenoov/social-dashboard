# Base de Layout do iamundi (harmonia + responsivo pra todo dispositivo) — Design

**Data:** 2026-07-04
**Branch de origem:** `main` (app Vue no ar)
**Status:** Design aprovado pelo Breno — aguardando revisão da spec
**Contexto:** os portes foram verbatim do monólito → herdaram responsivo fraco. No celular várias telas quebram (topbars com 5 blocos numa linha que estouram ~1130px em 375px; cards que não empilham; `--gt-fs:1.3` inflando fontes; cobertura `@media` desigual: acessos 11 vs admin/banco/início ~0). O Breno quer uma REGRA de harmonia/hierarquia/margens/centralização/limites que valha pra TODA ferramenta e TODO dispositivo, e o "pente" aplicando ela.

---

## 1. Objetivo

Criar uma **base de layout compartilhada** (variáveis + classes utilitárias no `estilos-globais.css`) + um **documento de regra**, e aplicar em todas as 14 telas. Resultado: nada estoura a tela, cards empilham no celular, topbars viram um padrão único, espaçamento/hierarquia consistentes — em celular, tablet, desktop e TV.

## 2. A REGRA (valores concretos)

### 2.1 Breakpoints padrão (usar SEMPRE estes)
- **Celular:** `≤640px`
- **Tablet:** `641px–1024px`
- **Desktop:** `1025px–1919px`
- **TV/grande:** `≥1920px`
(CSS var não funciona dentro de `@media`; então os NÚMEROS acima são o padrão — documentar e usar literais.)

### 2.2 Escala de espaçamento (fonte única de padding/gap/margin)
No `:root`: `--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-8:48px`. **Nada de número solto** — padding/gap/margem saem daqui.

### 2.3 Container central + margens (limites)
- Var: `--gutter` (margem lateral segura) = `16px` no celular → `24px` tablet → `32px` desktop (via `@media`).
- Var: `--container-max` = `1280px` (telas de conteúdo) / painéis TV podem usar mais.
- Classe `.container-app{width:100%;max-width:var(--container-max);margin-inline:auto;padding-inline:var(--gutter);}` — todo miolo de tela usa. **Nunca cola na borda, nunca estoura** (`box-sizing:border-box` global; imagens/tabelas com `max-width:100%`; conteúdo largo — tabelas/gráficos — em wrapper `overflow-x:auto`; o BODY nunca rola na horizontal).

### 2.4 Grade de cards (hierarquia + empilhamento)
- Classe `.grade-cards{display:grid;gap:var(--sp-4);grid-template-columns:repeat(auto-fill,minmax(var(--card-min,260px),1fr));}` → **1 coluna no celular** naturalmente (minmax + auto-fill), N colunas conforme a largura.
- Card base: `--card-radius:12px; --card-pad:var(--sp-4); --card-gap:var(--sp-3);` classe `.card-base{background:var(--surface);border:1px solid var(--border);border-radius:var(--card-radius);padding:var(--card-pad);}`.
- **Hierarquia visual:** título da tela (`.titulo-tela`) → rótulo de seção (`.rotulo-secao`) → card → conteúdo, cada nível com espaçamento da escala.

### 2.5 Topbar padrão (`.topbar-app`)
Estrutura única: **[voltar] · [título/marca] · [filtros] · [status/relógio]**.
- **Desktop:** linha única, `justify-content:space-between`, itens sem estourar (filtros com `flex-wrap` se preciso).
- **Celular (≤640):** empilha em **2 faixas**: (1) voltar + título compacto (relógio some ou vira mini na direita), (2) os filtros de período numa **faixa rolável horizontal** (`overflow-x:auto; scroll-snap`) — NUNCA 9 botões quebrando em 3 linhas. Seletor de conta vira largura total ou compacto.
- O relógio/"Tempo Real"/update-status some no celular (`display:none` ≤640) — ninguém olha relógio no celular; libera espaço.

### 2.6 Fontes responsivas
- **Reset do "+30%" no celular:** onde há `--gt-fs`/`--gc-fs`/`--np-fs` (escala de fonte por ferramenta), no `@media(max-width:640px)` o default volta pra **1** (sem inflar).
- Tamanhos com **mínimos legíveis** (nada abaixo de ~11px no corpo, ~9px em rótulos).
- Números/valores grandes (KPIs, relógio) reduzem por breakpoint (ex.: relógio 28px→18px no tablet).

### 2.7 Regra permanente (documentada)
- Um doc `docs/base-de-layout.md` (ou `LEIA-ME` em `src/estilos/`) com a regra em PT.
- **Toda tela nova nasce usando** `.container-app`, `.grade-cards`, `.topbar-app`, a escala de espaçamento e o reset de fonte no celular.

## 3. Mecanismo (como vira base compartilhada)

Tudo no `src/estilos/estilos-globais.css` (já é o global importado uma vez): as `--sp-*`, `--gutter`, `--container-max`, `--card-*` no `:root` (+ overrides por `@media`), e as classes `.container-app/.grade-cards/.card-base/.topbar-app/.titulo-tela/.rotulo-secao`. Como o CSS das telas é `scoped`, elas usam essas peças via classes globais (que atravessam o scoped) ou re-declarando com as MESMAS vars. **Sem duplicar a régua** — as vars são a fonte única.

## 4. Aplicação — o "pente", ferramenta por ferramenta

- **Piloto: Gestão de Tráfego** (pior caso do Breno) — prova a regra ponta a ponta (topbar rolável, cards empilhando, fonte resetada no celular, container).
- Depois as demais, agrupadas por semelhança: menus (início/vendas/meta-ads) juntos; painéis-TV (gestão à vista, análise de vendas) juntos; dashboards densos (redes-sociais, análise-campanhas, GT, gestão-comercial) um a um; utilitárias (banco, acessos, admin, notícias, login).
- **Cada tela validada por RENDER** em 375px + 768px + desktop (Playwright headless, técnica do fluxograma) ANTES de subir. Sem "circo" na produção.

## 5. Não-objetivos / cuidados

- **Não mudar o comportamento nem os dados** das telas — só layout/CSS (harmonia, empilhamento, margens). Verbatim no JS.
- **Não redesenhar identidade visual** (cores/marca ficam) — é organização de layout, não rebranding.
- **Não quebrar o desktop** — a base melhora o celular sem regredir o desktop (validar nos 3 tamanhos).
- Produção está no ar: cada tela vai por branch → render → merge, com rollback pronto.

## 6. Critérios de sucesso

1. Nenhuma tela **estoura a largura** no celular (sem scroll horizontal do body); conteúdo largo rola só no seu wrapper.
2. Topbars seguem o **padrão único** e não viram "botão solto".
3. Cards **empilham pra 1 coluna** no celular; espaçamento/hierarquia consistentes (escala única).
4. Fontes legíveis (sem o +30% no celular).
5. A base vive no `estilos-globais.css` + doc de regra; telas novas nascem certas.
6. Desktop e TV **sem regressão**.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Quebrar o desktop ao mexer no responsivo | Validar SEMPRE nos 3 tamanhos (375/768/desktop) por render antes de subir. |
| CSS `scoped` não alcançar as classes globais | As classes utilitárias ficam globais (não-scoped) no `estilos-globais.css`; telas as usam direto. |
| Regressão de dados/comportamento | Só CSS/estrutura muda; JS verbatim; validar que a tela ainda carrega. |
| Esforço grande (14 telas) | Base primeiro (1 esforço) + pente por sessão; piloto GT valida a regra antes de escalar. |
