# Relatório Interativo de Redes Sociais — Design

**Data:** 2026-07-08
**Contexto:** iamundi (dashboard social RBV). Ferramenta secundária da área de Redes Sociais, só para superadmin (`estado.role === 'admin'`), para curadoria e conferência do histórico diário coletado.

## Objetivo
Uma planilha interativa (só leitura) que mostra, por dia e por perfil, o histórico coletado: seguidores, engajamento, conteúdo e ads. Fonte = banco (coletado), que agora bate com a dashboard validada (coletor consertado em 2026-07-08 — ver `project_iamundi_coletor`).

## Entrada (submenu) — segue o padrão `tela-de-menu-vendas.vue`
- Nova rota `/redes` → `tela-de-menu-redes.vue`: submenu com **2 cards** — **Dashboard** (→ `/redes-sociais`) e **Relatório** (→ `/redes-relatorio`, card só aparece se `role==='admin'`).
- Card "Redes Sociais" da Central: se `role==='admin'` → `ir('redes')` (submenu); senão → `ir('redes-sociais')` (direto, pois só tem 1 opção).
- Guarda: `/redes-relatorio` e o card do relatório exigem `role==='admin'` (redireciona pra Central se não for).

## A ferramenta — `tela-de-relatorio-redes.vue` (rota `/redes-relatorio`)
Vue **declarativo** (estado reativo + `v-for`), não imperativo. Fonte: `sbClient.from(...)`.

### Dados (join por dia, `captured_at`)
4 queries por perfil + intervalo, unidas em JS por data:
- `daily_snapshots` → `followers_count` (Total), `gained` (Seguiram), `lost` (Saíram); Líquido = gained−lost.
- `engagement_snapshots` WHERE `period_days=1` → reach, views, total_interactions, likes, comments, saves, shares, profile_views.
- `content_snapshots` WHERE `period_days=1` → posts_count, reels_count, stories_count.
- `account_insights` WHERE `period_days=1` → impressions, spend (só de junho pra cá).

### Colunas (grupos com toggle mostrar/esconder)
- **Seguidores:** Seguiram · Saíram · Líquido · **Total**
- **Engajamento:** Alcance · Views · Interações · Curtidas · Coment. · Salv. · Compart. · Visitas
- **Conteúdo:** Posts · Reels · Stories
- **Ads:** Gasto · Impressões

### Interações
- **Seletor de perfil** (7 contas) no topo.
- **Filtro de período:** Últimos 30 dias · 90 dias · Tudo.
- **Ordenar por coluna:** clicar no cabeçalho (asc/desc; padrão dia desc).
- **Exportar:** XLS (via `window.XLSX`, já carregado) + CSV.

### Visual
Planilha: cabeçalho fixo ao rolar, zebra, `font-variant-numeric: tabular-nums`, dias sem dado = "—", coerente com a Central (tokens `--surface/--border/--accent`, responsivo, scroll-x no container da tabela). Topbar no padrão `.smenu-` com botão voltar.

## Segurança / risco
Só leitura (nenhum write). Gate por `role==='admin'`. Zero risco à dashboard ou ao coletado.

## Fora de escopo (YAGNI)
Anotações/edição (Breno escolheu só leitura), gráficos, ads por campanha, dados ao vivo.
