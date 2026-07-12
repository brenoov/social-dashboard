# Estúdio SP-1 — Polimento & navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar 4 pontas soltas do `/fabrica-estudio`: marca-neutra no chrome, botão "voltar pra Central", marcar/desmarcar todos nos 2 grids de curadoria, e ver o criativo inteiro (não cortado) + lightbox no Curar.

**Architecture:** Só front (Vue 3 `<script setup>` + `.fest` CSS). Sem backend, sem migration, sem Edge. 3 tasks independentes, cada uma testável por `npm run build` + smoke manual.

**Tech Stack:** Vue 3 + Vite, `estudio.css` (`.fest` scoped), vue-router.

## Global Constraints

- **Sem backend/schema/Edge.** Só `src/ferramentas/meta-ads/*.vue` + `estudio.css`.
- **CSS scoped em `.fest`** (nunca vazar). Foco visível (o `.fest button:focus-visible` já existe). Respeitar `prefers-reduced-motion` (já há a media query).
- **Central = rota `inicio`** (`/`, tela-de-inicio.vue). Padrão do app: `router.push({ name: 'inicio' })` (ex.: `tela-de-banco.vue:44`).
- **Não quebrar a fiação existente:** emits (`gerado`/`subido`), `useJobStatus`, `useCandidatos`, o toggle `escolhido` (persistido) e o `purgado_em` (placeholder, não curável).
- Após cada task: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` limpo.

---

## Task 1: Chrome marca-neutra + botão "voltar pra Central"

**Files:**
- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

- [ ] **Step 1: Tirar "La Vessel" do chrome**

Em `tela-de-fabrica-estudio.vue`:
- Linha 37: `<div class="s">Estúdio de Criativos · La Vessel</div>` → `<div class="s">Estúdio de Criativos</div>`
- Linha 90: `<span>Estúdio de Criativos · La Vessel</span>` → `<span>Estúdio de Criativos</span>`

- [ ] **Step 2: Adicionar a função e o botão de voltar**

No `<script setup>` (após `const router = useRouter()`), adicionar:

```js
function voltarCentral() { router.push({ name: 'inicio' }) }
```

No `<template>`, dentro do `<header class="topbar">`, adicionar o botão como PRIMEIRO filho (antes de `<div class="brand">`):

```html
<button class="voltar-central" @click="voltarCentral" aria-label="Voltar para a Central">← Central</button>
```

- [ ] **Step 3: CSS do botão**

Em `estudio.css`, adicionar (perto das regras da `.topbar`):

```css
.fest .voltar-central{
  appearance:none; cursor:pointer; font:inherit; align-self:center;
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 12px; margin-right:4px;
  background:var(--panel-2); color:var(--ink-dim);
  border:1px solid var(--edge); border-radius:6px;
  font-size:12px; letter-spacing:.04em; white-space:nowrap;
  transition:border-color .15s, color .15s;
}
.fest .voltar-central:hover{ border-color:var(--cyan); color:var(--ink); }
```

- [ ] **Step 4: Build + smoke**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.
Smoke: abrir `/fabrica-estudio` — cabeçalho e rodapé sem "La Vessel"; botão "← Central" no topo leva pra `/` (a Central). `grep -rn "La Vessel" src/ferramentas/meta-ads/` não retorna nada.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): chrome marca-neutra (tira La Vessel) + botão voltar pra Central"
```

---

## Task 2: Marcar / desmarcar todos (2 grids)

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-gerar.vue` (grid de produtos, estado `marcados` por sku, local)
- Modify: `src/ferramentas/meta-ads/painel-curar.vue` (grid de criativos, `escolhido` persistido — update em lote)
- Modify: `src/ferramentas/meta-ads/estudio.css` (botão `.marcar-todos`)

- [ ] **Step 1: painel-gerar — marcar/desmarcar todos (local)**

No `<script setup>`, após `const totalMarcados = computed(...)` (~L46), adicionar:

```js
const todosMarcados = computed(() => candidatos.value.length > 0 && candidatos.value.every((c) => marcados.value[c.sku]))
function alternarTodos() {
  const novo = !todosMarcados.value
  const m = {}
  for (const c of candidatos.value) m[c.sku] = novo
  marcados.value = m
}
```

No `<template>`, no header do painel de Produtos (`~L153`), trocar:

```html
<div class="ph"><span class="eyebrow">Produtos</span><span class="eyebrow muted">{{ totalMarcados }} de {{ candidatos.length }} marcados</span></div>
```

por:

```html
<div class="ph">
  <span class="eyebrow">Produtos</span>
  <span class="ph-right">
    <button v-if="candidatos.length" class="marcar-todos" @click="alternarTodos">{{ todosMarcados ? 'Desmarcar todos' : 'Marcar todos' }}</button>
    <span class="eyebrow muted">{{ totalMarcados }} de {{ candidatos.length }} marcados</span>
  </span>
</div>
```

- [ ] **Step 2: painel-curar — marcar/desmarcar todos (update em lote)**

No `<script setup>`, após `alternar(it)` (~L15), adicionar:

```js
import { computed } from 'vue'   // juntar ao import existente de 'vue' (ref, watch) — NÃO duplicar a linha
const visiveis = computed(() => itens.value.filter((i) => !i.purgado_em))
const todosEscolhidos = computed(() => visiveis.value.length > 0 && visiveis.value.every((i) => i.escolhido))
async function alternarTodos() {
  const alvo = visiveis.value
  if (!alvo.length) return
  const novo = !todosEscolhidos.value
  const antes = alvo.map((i) => [i, i.escolhido])
  alvo.forEach((i) => { i.escolhido = novo })                 // otimista
  const { error } = await sbClient.from('fabrica_criativos').update({ escolhido: novo }).in('id', alvo.map((i) => i.id))
  if (error) { antes.forEach(([i, v]) => { i.escolhido = v }); alert('Falha ao salvar') }
}
```

(O import atual é `import { ref, watch } from 'vue'` na L2 — trocar para `import { ref, watch, computed } from 'vue'`.)

No `<template>`, no header do painel de Criativos (`~L32`), trocar:

```html
<div class="ph"><span class="eyebrow">Criativos</span><span class="eyebrow muted">toque para escolher</span></div>
```

por:

```html
<div class="ph">
  <span class="eyebrow">Criativos</span>
  <span class="ph-right">
    <button v-if="visiveis.length" class="marcar-todos" @click="alternarTodos">{{ todosEscolhidos ? 'Desmarcar todos' : 'Marcar todos' }}</button>
    <span class="eyebrow muted">toque para escolher</span>
  </span>
</div>
```

- [ ] **Step 3: CSS**

Em `estudio.css`:

```css
.fest .ph-right{ display:inline-flex; align-items:center; gap:12px; }
.fest .marcar-todos{
  appearance:none; cursor:pointer; font:inherit;
  padding:4px 10px; background:var(--panel-2); color:var(--ink-dim);
  border:1px solid var(--edge); border-radius:5px; font-size:11.5px;
  transition:border-color .15s, color .15s;
}
.fest .marcar-todos:hover{ border-color:var(--amber); color:var(--ink); }
```

- [ ] **Step 4: Build + smoke**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.
Smoke: no Gerar, após "Ver produtos", "Marcar/Desmarcar todos" alterna todos os checkboxes visíveis (respeita o filtro/fonte atual); no Curar, "Marcar/Desmarcar todos" alterna a borda âmbar de todos os criativos e persiste (recarregar mantém). Um item `purgado_em` não é afetado.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-gerar.vue src/ferramentas/meta-ads/painel-curar.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): marcar/desmarcar todos nos grids de Gerar e Curar (Curar = update em lote)"
```

---

## Task 3: Criativo inteiro no card + lightbox (Curar)

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-curar.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Consumes (de Task 2): `visiveis`, `alternar(it)`, `itens`. UX: card mostra a imagem inteira; um checkbox de canto marca sem abrir; clicar na imagem abre o lightbox (imagem grande + botão marcar/desmarcar + fechar).

- [ ] **Step 1: Card mostra a imagem inteira (sem corte)**

Em `estudio.css`, trocar a regra do `.art` (linha ~224):

```css
.fest .tile .art{position:absolute; inset:0; width:100%; height:100%; object-fit:cover}
```

por:

```css
.fest .tile .art{position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:var(--panel-2)}
```

(assim os formatos 1:1 e 9:16 aparecem inteiros, letterboxed no card.)

- [ ] **Step 2: Estado do lightbox + separar clique-do-card do toggle**

Em `painel-curar.vue` `<script setup>`, adicionar o estado do lightbox e handlers (o ESC fecha):

```js
import { onMounted, onUnmounted } from 'vue'  // juntar ao import de 'vue'
const visor = ref(null)   // o criativo aberto no lightbox, ou null
function abrirVisor(it) { if (!it.purgado_em) visor.value = it }
function fecharVisor() { visor.value = null }
function onKey(e) { if (e.key === 'Escape') fecharVisor() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
```

(Import final da 1ª linha: `import { ref, watch, computed, onMounted, onUnmounted } from 'vue'`.)

- [ ] **Step 3: Template — checkbox de canto + clique abre visor + o lightbox**

Trocar o bloco do tile (`~L34-38`):

```html
<div v-for="it in itens" :key="it.id" class="tile" :class="{ ok: it.escolhido, subido: it.purgado_em }" @click="!it.purgado_em && alternar(it)">
  <img v-if="!it.purgado_em" class="art" :src="it.url" loading="lazy">
  <div v-else class="art placeholder">subido — ver no Gerenciador</div>
  <span class="cap">{{ it.arquetipo }} · {{ it.formato }}</span>
</div>
```

por:

```html
<div v-for="it in itens" :key="it.id" class="tile" :class="{ ok: it.escolhido, subido: it.purgado_em }">
  <img v-if="!it.purgado_em" class="art" :src="it.url" loading="lazy" @click="abrirVisor(it)">
  <div v-else class="art placeholder">subido — ver no Gerenciador</div>
  <label v-if="!it.purgado_em" class="pick" @click.stop>
    <input type="checkbox" :checked="it.escolhido" @change="alternar(it)">
  </label>
  <span class="cap">{{ it.arquetipo }} · {{ it.formato }}</span>
</div>
```

E, ao final do `<section class="stage">` (antes de `</section>`), adicionar o lightbox:

```html
<div v-if="visor" class="lightbox" @click.self="fecharVisor">
  <div class="lb-inner">
    <button class="lb-close" @click="fecharVisor" aria-label="Fechar">✕</button>
    <img :src="visor.url" class="lb-img" :alt="visor.arquetipo + ' ' + visor.formato">
    <div class="lb-bar">
      <span>{{ visor.arquetipo }} · {{ visor.formato }}</span>
      <button class="cmd" :class="visor.escolhido ? 'amber' : 'cyan'" @click="alternar(visor)">
        {{ visor.escolhido ? '✓ Escolhido — desmarcar' : 'Marcar como escolhido' }}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: CSS do checkbox de canto + lightbox**

Em `estudio.css`:

```css
.fest .tile .art{cursor:zoom-in}
.fest .tile .pick{position:absolute; top:5px; right:5px; z-index:2; background:rgba(5,10,15,.6); border-radius:4px; padding:2px 3px; line-height:0}
.fest .tile .pick input{cursor:pointer; width:16px; height:16px}

.fest .lightbox{position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:20px;
  background:rgba(2,6,10,.86); backdrop-filter:blur(2px)}
.fest .lb-inner{position:relative; max-width:min(92vw,720px); max-height:92vh; display:flex; flex-direction:column; gap:10px}
.fest .lb-img{max-width:100%; max-height:78vh; object-fit:contain; border:1px solid var(--edge); border-radius:4px; background:var(--panel-2)}
.fest .lb-bar{display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  font-size:12.5px; color:var(--ink-dim)}
.fest .lb-close{position:absolute; top:-12px; right:-12px; width:32px; height:32px; border-radius:50%;
  background:var(--panel); color:var(--ink); border:1px solid var(--edge); cursor:pointer; font-size:14px}
.fest .lb-close:hover{border-color:var(--abort); color:var(--abort)}
@media(max-width:560px){ .fest .lb-close{top:0; right:0} }
```

- [ ] **Step 5: Build + smoke**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.
Smoke: no Curar — os cards mostram o criativo inteiro (Story 9:16 e Feed 1:1 completos, sem corte); o checkbox no canto marca/desmarca sem abrir nada; clicar na imagem abre o lightbox grande; no lightbox dá pra marcar/desmarcar e o botão reflete o estado; fecha no ✕, no clique fora, e no ESC. Item `purgado_em` mostra o placeholder e não abre lightbox.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-curar.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): Curar mostra criativo inteiro + lightbox (checkbox de canto p/ marcar rápido)"
```

---

## Task 4: Tema claro no Estúdio (respeitar o toggle global)

**Files:**
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Contexto:** o app troca tema setando **`data-theme="dark"|"light"` no `<html>`** (`src/moldura-do-aplicativo.vue:146`, persiste em localStorage). O `.fest` define seus tokens escuros em `estudio.css:7-15` (`.fest{ --void; --panel; --ink; ... }`) e todos os componentes usam `var(--...)`, mas nunca reagem ao tema → o Estúdio fica sempre escuro (o botão de tema não faz efeito nele). Fix: um único bloco de override dos tokens quando `data-theme="light"`.

- [ ] **Step 1: Adicionar o override de tema claro**

Em `src/ferramentas/meta-ads/estudio.css`, logo APÓS o bloco `.fest{...}` (que termina na linha ~16), adicionar:

```css
/* ===== tema claro (respeita o data-theme='light' do <html>, setado por moldura-do-aplicativo.vue) ===== */
:root[data-theme="light"] .fest{
  --void:#e9eff5; --panel:#ffffff; --panel-2:#f2f6fa; --grid-l:#d5dfe9;
  --edge:#cbd7e3; --edge-hot:#93a8bd;
  --ink:#17232f; --ink-dim:#4c5e6e; --ink-faint:#7c8ea0;
  --amber:#c47f10; --amber-soft:#e2a542; --cyan:#0f9b8e;
  --go:#1f9d5a; --hold:#c8920f; --abort:#e23b28; --idle:#93a3b3;
}
/* glows quentes/frios do fundo escuro somem no claro (ficariam sujos sobre branco) */
:root[data-theme="light"] .fest{ background-image:none; }
```

> Nota: os tokens são os MESMOS nomes do bloco escuro (`estudio.css:8-12`) — só os valores mudam, então todos os componentes (`.topbar/.panel/.tile/.cmd/.lightbox/.voltar-central/.marcar-todos` etc.) adaptam sozinhos via `var(--...)`. Não tocar em nenhum `.vue`.

- [ ] **Step 2: Build + smoke (os dois temas)**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.
Smoke: abrir `/fabrica-estudio`, clicar no botão de tema (canto do app):
- **Claro:** fundo claro, texto escuro legível, painéis brancos, LEDs/acentos (âmbar/ciano/go/hold/abort) visíveis e com contraste; a grade de fundo aparece sutil (linha clara), sem o brilho quente/frio sujando o branco.
- **Escuro:** idêntico ao de hoje (nada regrediu).
- Recarregar mantém o tema (localStorage). O contraste do texto no claro está confortável (nada âmbar-claro ilegível sobre branco).

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): Estúdio respeita o tema claro (override de tokens .fest sob data-theme=light)"
```

---

## Testes (resumo)

- Sem harness de front no repo → cada task fecha com `npm run build` limpo + o smoke manual descrito.
- Nada de backend/migration/Edge; nenhum teste `node:test` novo.

## Fora do plano (próximos SPs)

SP-2 (home/panorama + não-travar + persistência), SP-3 (objetivo no passo 1), SP-4 (construtor de campanhas), SP-5 (templates/Canva), SP-6 (tutorial).

## Sequência

Tasks independentes; ordem natural 1 → 2 → 3 (a Task 3 usa `visiveis`/`alternar` que a Task 2 já deixa no painel-curar, então fazer 2 antes de 3).
