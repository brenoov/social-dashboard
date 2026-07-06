# Redes Sociais — Fidelidade de dados + UI — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Goal:** deixar a tela de Redes Sociais fiel aos painéis da Meta (por intervalo selecionado) + ajustes de UI, começando pela Fase 1 (dados já existentes / UI), depois Fase 2 (itens que dependem de testar a API).

**Architecture:** mudanças no SFC `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (template + funções de render `update()`/`fetchData()`/`fmtN()`/`animCount()`), só CSS/JS de exibição na Fase 1 (dados já coletados). Fase 2 pode tocar o coletor `supabase/functions/coletar-dados/index.ts`. **Sem framework de teste** no repo → "teste" = validar contra os valores de referência do "mês passado" + render headless (375/desktop), como na GT.

**Tech Stack:** Vue 3 SFC, JS de render imperativo (innerHTML/getElementById), Chart/SVG, Playwright headless (validação), Supabase REST (dados coletados).

## Global Constraints

- **Branch:** `feat/redes-fidelidade` a partir do `main`. `git config user.email=breno@rbvcompany.com`.
- **INTERVALO + FILTRO dinâmicos:** toda métrica reflete o **período selecionado** (hoje/7d/30d/mês/mês passado/personalizado). **NÃO chumbar** os números do mês passado — eles são só a régua de validação. Validar em "mês passado" **E** em outro intervalo (7d ou 30d).
- **Investimento** soma **TODAS as campanhas** no período (o filtro não corta o gasto total).
- **Vale pra todos os perfis** — nada de hardcode por perfil.
- **Nunca número falso** — item da Fase 2 que a API não entregar fica de fora, com aviso claro.
- **Validar por render** (375 + desktop) e conferir que a tela ainda carrega. `npm run build` verde. Branch → validar → merge; rollback via `git revert`.
- Só CSS/JS de exibição na Fase 1 — não mudar o coletor nesta fase.

## Valores de referência ("mês passado")
Total seguidores 24.300 · Novos: Seguidores 1.281 / Deixaram 571 / Total 710 · Investimento R$ 10.442,58 · Visualizações 1.651.342 · Alcance 1.014.049 · Interações 9.926 · Visitas 9.108.

---

# FASE 1 — dados já existentes / UI

### Task 1: Tooltip universal do número inteiro (hover + toque)

**Files:** Modify `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (`animCount()` L546-554; `<style scoped>`).

- [ ] **Step 1: Ler o estado atual** de `animCount()` (L546-554) e `fmtN()` (L566). Confirmar que `animCount(el, value)` escreve o valor resumido no `el`.

- [ ] **Step 2: Setar o número inteiro como tooltip** em `animCount()`. Ao final da animação (e imediatamente), setar no elemento:
```js
// dentro de animCount, após definir o texto resumido:
try { el.title = (Number(value)||0).toLocaleString('pt-BR'); el.dataset.full = (Number(value)||0).toLocaleString('pt-BR'); el.classList.add('tem-tooltip'); } catch(e){}
```
(`title` cobre o hover no desktop; `data-full` alimenta o tooltip de toque.)

- [ ] **Step 3: Tooltip de TOQUE (mobile)** — no `<style scoped>` + um handler único. Adicionar CSS de um tooltip que aparece no `:hover`/`:focus`/`.mostrar` de `.tem-tooltip`:
```css
.tela-redes-sociais :deep(.tem-tooltip){position:relative;cursor:help;}
.tela-redes-sociais :deep(.tem-tooltip.mostrar)::after,
.tela-redes-sociais :deep(.tem-tooltip:hover)::after{
  content:attr(data-full);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);
  background:var(--text);color:var(--surface);font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;
  padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:50;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.2);}
```
E um listener delegado (uma vez, no onMounted da tela) pra toque: ao tocar num `.tem-tooltip`, alterna `.mostrar` (e remove dos outros); toque fora fecha. Expor via `Object.assign(window,{...})` se chamado por onclick, ou adicionar `addEventListener` no root da tela.

- [ ] **Step 4: Validar** — `npm run build` OK. Render headless da tela (ou de um card isolado) confirmando: desktop hover mostra o inteiro; simular toque mostra o balão. Um valor resumido (ex.: "2 mil") deve revelar "1.999".

- [ ] **Step 5: Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): tooltip universal com o número inteiro ao passar o mouse/tocar (fmtN resume; title+data-full revelam)"
```

---

### Task 2: Novos seguidores em 3 linhas (Seguidores / Deixaram / Total)

**Files:** Modify `tela-de-redes-sociais.vue` (template do card `#new-followers-val` ~L137 + breakdown L1229-1236; `update()` L1219-1331; `<style scoped>`).

**Interfaces:** Consome de `d` (retorno de `fetchData`): `d.newFollowers` (net), o breakdown bruto `gained`/`lost` (hoje em L1229-1236), `d.confirmadoIG`.

- [ ] **Step 1: Ler** o template do card de novos seguidores (~L137) e o trecho de render L1227-1246 (headline + breakdown ▲/▼ + selo consolidação). Identificar de onde vêm `gained` e `lost` somados no período (em `fetchData`, ~L918).

- [ ] **Step 2: Trocar o card por 3 linhas de FONTE IGUAL**, na ordem **Seguidores · Deixaram de seguir · Total**. No template, substituir o headline único por 3 linhas (mesma classe/tamanho), ex.:
```html
<div class="nf-linha"><span class="nf-lbl">Seguidores</span><span class="nf-val" id="nf-gained">—</span></div>
<div class="nf-linha"><span class="nf-lbl">Deixaram de seguir</span><span class="nf-val" id="nf-lost">—</span></div>
<div class="nf-linha"><span class="nf-lbl">Total</span><span class="nf-val" id="nf-total">—</span></div>
```
CSS: `.nf-val` todos com o MESMO `font-size`/peso; `.nf-linha{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}`.

- [ ] **Step 3: Preencher no `update()`** com os brutos do período (confirmados pelo IG), via `animCount` (pega o tooltip da Task 1):
```js
animCount(document.getElementById('nf-gained'), d.gainedPeriodo);   // 1281
animCount(document.getElementById('nf-lost'),   d.lostPeriodo);     // 571
animCount(document.getElementById('nf-total'),  d.newFollowers);    // 710 (net)
```
Se `d.gainedPeriodo`/`d.lostPeriodo` ainda não existirem no retorno de `fetchData`, adicioná-los (somatório de `gained`/`lost` do período — já são lidos em L912-930). Manter o **selo "confirmado/consolidando"** e o gráfico novos/dia como estão.

- [ ] **Step 4: Validar** — em "mês passado": Seguidores=1.281, Deixaram=571, Total=710, fontes iguais. Conferir em 7d/30d que os 3 números batem entre si (gained−lost=total). Render 375+desktop limpo.

- [ ] **Step 5: Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): novos seguidores em 3 linhas de fonte igual (Seguidores/Deixaram/Total) usando o bruto confirmado do IG"
```

---

### Task 3: Remover cards — Contas Engajadas + Stories (novos seguidores, visitas)

**Files:** Modify `tela-de-redes-sociais.vue` (template L314 `#eng-engaged`, L346 `#st-profile-visits`, L347 `#st-follows`; loops de render em `update()` L1293 e L1307).

- [ ] **Step 1: Remover do TEMPLATE** os 3 cards: `#eng-engaged` (Contas Engajadas, L314), `#st-profile-visits` (Visitas ao perfil dos stories, L346), `#st-follows` (Novos seguidores dos stories, L347).

- [ ] **Step 2: Remover do RENDER** as referências nos loops (`update()` L1293 e L1307) que setam `eng-engaged`, `st-profile-visits`, `st-follows` (senão `getElementById` retorna null — sem erro, mas limpar). Remover também o `setCompare` desses, se houver.

- [ ] **Step 3: Validar** — a seção Engajamento fica com Visualizações/Alcance/Interações/Visitas (sem Contas Engajadas); Stories sem "novos seguidores"/"visitas". Grade não fica com buraco (ajustar `grid`/`flex-wrap` se necessário). Render 375+desktop.

- [ ] **Step 4: Commit**
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "feat(redes): remove Contas Engajadas + stories (novos seguidores, visitas ao perfil)"
```

---

### Task 4: Conferir fidelidade — total seguidores + 4 engajamentos (por intervalo)

**Files:** Modify `tela-de-redes-sociais.vue` (`fetchData()` L806-1033 — janela de período das queries) se algo estiver off.

- [ ] **Step 1: Validar contra a régua** ("mês passado"): Total=24.300; Visualizações=1.651.342; Alcance=1.014.049; Interações=9.926; Visitas=9.108. Comparar o que a tela mostra com esses valores (com dados reais — ver nota de execução sobre acesso local).

- [ ] **Step 2: Se algum não bater, investigar a JANELA de período** — o mapa aponta que o engajamento pega o "último snapshot do `period_days`" (L876). Confirmar que para "mês passado" a query pega o snapshot/janela do mês anterior (não do mês atual). Ajustar o filtro de data/`period_days` em `fetchData` para refletir o intervalo selecionado. NÃO mudar o coletor nesta fase — só a seleção/janela na leitura.

- [ ] **Step 3: Conferir outro intervalo** (7d ou 30d) pra garantir que flui dinâmico (números coerentes, não os do mês passado).

- [ ] **Step 4: Commit** (se houve ajuste)
```bash
git add src/ferramentas/redes-sociais/tela-de-redes-sociais.vue
git commit -m "fix(redes): janela de período correta p/ total seguidores + engajamento (dinâmico por intervalo)"
```

---

### Task 5: Fase 1 — build + validação final + merge

- [ ] **Step 1:** `npm run build` OK; a tela carrega; `git diff main --stat` só toca `redes-sociais`.
- [ ] **Step 2:** Render 375 + desktop da tela inteira: 3-linhas ok, cards removidos, tooltips ok, sem buraco de grade, sem estouro (a base de layout da GT já cobre responsivo).
- [ ] **Step 3:** Breno confere os números no "mês passado" na produção/preview. Merge `feat/redes-fidelidade`→`main` + push. Rollback via `git revert` se preciso.

---

# FASE 2 — testar a API antes (probe → implementar o que for viável)

### Task 6: Probe da API da Meta (decidir viabilidade item a item)

**Files:** script temporário de teste (scratchpad) chamando a Meta via meta-proxy (ou via a mesma rota do coletor) — NÃO commitar segredo.

- [ ] **Step 1: Investimento (todas as campanhas)** — somar `spend` de TODAS as campanhas no "mês passado" e comparar com **R$ 10.442,58**. Confirmar que bate; anotar a query certa (ignorar `campaign_filters.selected_ids` para o gasto total).
- [ ] **Step 2: Stories seguidores × não-seguidores** — testar se insights de story/reach aceitam `breakdown=follow_type` (FOLLOWER/NON_FOLLOWER), geral e por conteúdo. Anotar: **viável** (com o formato) ou **API não expõe**.
- [ ] **Step 3: Alcance de stories (Visão Geral)** — testar se dá pra obter o alcance agregado/deduplicado de stories da conta (vs somar por story). Anotar diferença.
- [ ] **Step 4: Collabs na contagem de posts** — testar como identificar collabs (campo `owner` em `/media`, ou outro endpoint) e se dá pra somar na contagem. Anotar viabilidade.
- [ ] **Step 5: Encaminhamentos/Respostas** — confirmar que `story_shares`/`story_replies` batem com o Painel Profissional.
- [ ] **Step 6: RELATÓRIO ao Breno** — item por item: "bate 100% (faço)" vs "limitação da API (não faço, explico)". **Só depois** detalhamos as tasks de implementação da Fase 2 (investimento, barra seguidores×não-seguidores, alcance stories, collabs) conforme o que for viável.

---

## Notas de execução

- **Acesso local pra validar dados reais:** a tela precisa de login (Supabase). Igual à GT, dá pra rodar `npm run dev` + injetar `estado` (role admin + sessão) via `import('/src/compartilhado/controle-de-login-e-usuario.js')` e navegar por `roteador.push('/redes-sociais')` no Playwright, escolhendo o intervalo "mês passado". Não digitar senha (regra). Os dados vêm das tabelas coletadas (Supabase) — devem carregar mesmo sem token Meta ao vivo.
- **Ordem:** T1 (tooltip) → T2 (3 linhas) → T3 (remoções) → T4 (fidelidade/intervalo) → T5 (merge) → T6 (probe Fase 2).
- **Só exibição na Fase 1.** Coletor só na Fase 2 se necessário.
- **Render obrigatório** antes de subir.
