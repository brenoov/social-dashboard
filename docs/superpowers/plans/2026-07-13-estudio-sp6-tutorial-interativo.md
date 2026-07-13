# Estúdio SP-6 — Tutorial interativo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um tutorial interativo leve à Fábrica de Anúncios: checklist "Primeiros passos" na Home, tour guiado (coach-marks) na Home, e tooltips "?" por tela — todos com conteúdo único.

**Architecture:** Um módulo de conteúdo (`tutorial-fabrica.js`) alimenta 3 peças de UI: um card checklist na Home, um overlay caseiro `tour-coachmark.vue` (destaca elementos por `data-tour`, auto-abre 1x via localStorage), e um `ajuda-tooltip.vue` ("?") nos cabeçalhos das telas. Puro front; persistência em localStorage.

**Tech Stack:** Vue 3 `<script setup>` + Vite; CSS `.fest` em `estudio.css`; localStorage; `node:test` para o único helper puro.

## Global Constraints

- **PURO FRONT:** sem backend, migration, Edge. Nenhuma chamada ao Meta; nada ativa campanha.
- Persistência = **localStorage versionado**: `fabrica_tour_v1` (tour visto), `fabrica_checklist_v1` (itens concluídos, CSV de ids).
- **Coach-marks só na Home** (single-screen); não navega entre rotas. Alvo ausente → pula o passo (resiliente).
- Tour **auto-abre 1x** (primeira visita), nunca mais sozinho; botão "Rever tour" reabre. Dispensável a qualquer hora (Pular/ESC/clique-fora).
- Estética `.fest`; acessível (foco visível, ESC fecha, `prefers-reduced-motion`); responsivo (mobile não estoura).
- Rotas reais: `fabrica-nova`, `fabrica-campanha`, `fabrica-looks`, `inicio`, `meta-ads`.

---

### Task 1: `tutorial-fabrica.js` — conteúdo único + `proximoPassoPendente`

**Files:**
- Create: `src/ferramentas/meta-ads/tutorial-fabrica.js`
- Create: `src/ferramentas/meta-ads/tutorial-fabrica.test.mjs`

**Interfaces:**
- Produces: `CHECKLIST` (`[{id,titulo,texto,rota}]`), `COACH` (`[{selector,titulo,texto}]`), `AJUDA` (`{ <chave>: {titulo, itens:[{termo,texto}]} }`), `proximoPassoPendente(feito, checklist) -> item|null` (1º item cujo `id` ∉ `feito`).

- [ ] **Step 1: Teste (falhando)**

Create `src/ferramentas/meta-ads/tutorial-fabrica.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximoPassoPendente, CHECKLIST } from './tutorial-fabrica.js';

test('proximoPassoPendente devolve o 1º id não concluído', () => {
  const cl = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(proximoPassoPendente(['a'], cl).id, 'b');
  assert.equal(proximoPassoPendente([], cl).id, 'a');
  assert.equal(proximoPassoPendente(['a', 'b', 'c'], cl), null);
});

test('CHECKLIST tem 5 itens com id/rota', () => {
  assert.equal(CHECKLIST.length, 5);
  for (const i of CHECKLIST) { assert.ok(i.id && i.titulo && i.rota); }
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd /Users/erickmartins/iamundi && node --test src/ferramentas/meta-ads/tutorial-fabrica.test.mjs` → FAIL.

- [ ] **Step 3: Implementar `tutorial-fabrica.js`**

Create `src/ferramentas/meta-ads/tutorial-fabrica.js`:
```js
// SP-6: conteúdo único do tutorial da Fábrica (checklist + coach-marks + tooltips "?").
export const CHECKLIST = [
  { id: 'criar', titulo: 'Crie uma campanha', texto: 'Escolha a loja, o objetivo, os produtos e o desconto. A ferramenta gera os criativos.', rota: 'fabrica-nova' },
  { id: 'curar', titulo: 'Escolha os melhores', texto: 'No passo Curar, marque os criativos que vão virar anúncio.', rota: 'fabrica-nova' },
  { id: 'publicar', titulo: 'Publique (pausado)', texto: 'No passo Subir, defina destino, localização e público. Tudo sobe PAUSADO — não gasta.', rota: 'fabrica-nova' },
  { id: 'conferir', titulo: 'Confira e ative', texto: 'No passo Conferir, revise os anúncios e ative com confirmação de gasto quando quiser.', rota: 'fabrica-nova' },
  { id: 'looks', titulo: 'Gerencie os looks', texto: 'Ligue/desligue os templates, reordene e gere as prévias na galeria de Looks.', rota: 'fabrica-looks' },
];

export const COACH = [
  { selector: '[data-tour="nova-campanha"]', titulo: 'Comece por aqui', texto: 'Clique em "Nova campanha" pra abrir o passo a passo: gerar → curar → subir → conferir.' },
  { selector: '[data-tour="numeros"]', titulo: 'Seu panorama', texto: 'Quantas campanhas estão em criação, quantos criativos já saíram e quantas foram publicadas.' },
  { selector: '[data-tour="em-criacao"]', titulo: 'Em criação', texto: 'As rodadas gerando ou prontas pra curar. Abra pra continuar de onde parou; apague se desistir.' },
  { selector: '[data-tour="publicadas"]', titulo: 'Publicadas recentes', texto: 'As campanhas que já foram pro Meta (pausadas). Abra no Gerenciador pra ativar.' },
  { selector: '[data-tour="looks-card"]', titulo: 'Looks & Templates', texto: 'A galeria dos modelos de criativo: ligue/desligue e veja as prévias.' },
];

export const AJUDA = {
  gerar: { titulo: 'Passo 1 · Gerar', itens: [
    { termo: 'Objetivo', texto: 'O que a campanha busca: conversas no WhatsApp (engajamento), vendas, reconhecimento de marca ou tráfego. Muda os criativos e a campanha no Meta.' },
    { termo: 'Fonte dos produtos', texto: 'De onde vêm os produtos: oportunidades da semana, garimpo, grade BCG, curva ABC ou busca manual.' },
    { termo: 'Desconto', texto: 'Use o desconto previsto do Gestor ou defina um % manual. No branding não há desconto.' },
    { termo: 'Curadoria', texto: 'Revise a lista, marque/desmarque os produtos antes de gerar.' },
  ] },
  curar: { titulo: 'Passo 2 · Curar', itens: [
    { termo: 'Escolher', texto: 'Toque nos criativos que vão virar anúncio — ficam com a borda âmbar.' },
    { termo: 'Ver inteiro', texto: 'Clique no criativo pra abrir em tamanho grande e decidir com calma.' },
  ] },
  subir: { titulo: 'Passo 3 · Subir', itens: [
    { termo: 'Destino', texto: 'Nova campanha por loja (a ferramenta cria) ou injetar numa campanha existente.' },
    { termo: 'Localização e público', texto: 'Cidades + raio, idade/gênero, interesses e públicos salvos. Começa pela geo da loja.' },
    { termo: 'Tudo pausado', texto: 'Os anúncios sobem PAUSADOS — ninguém vê e não gastam nada até você ativar.' },
  ] },
  conferir: { titulo: 'Passo 4 · Conferir', itens: [
    { termo: 'Revisar', texto: 'Veja quantos anúncios foram criados (pausados) antes de decidir.' },
    { termo: 'Ativar tudo', texto: 'Só ativa com uma confirmação de gasto. Enquanto não ativar, nada roda.' },
  ] },
  looks: { titulo: 'Looks & Templates', itens: [
    { termo: 'Ligar/desligar', texto: 'Um look desligado não é usado na geração.' },
    { termo: 'Ordem', texto: 'Reordene com as setas — a ordem vale na hora de gerar.' },
    { termo: 'Gerar prévias', texto: 'Renderiza uma amostra de cada look pra você ver como fica.' },
  ] },
};

export function proximoPassoPendente(feito, checklist) {
  const set = new Set(feito || []);
  return (checklist || []).find((i) => !set.has(i.id)) || null;
}
```

- [ ] **Step 4: Rodar e ver passar** — `node --test src/ferramentas/meta-ads/tutorial-fabrica.test.mjs` → PASS (2).

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tutorial-fabrica.js src/ferramentas/meta-ads/tutorial-fabrica.test.mjs
git commit -m "feat(fabrica): tutorial-fabrica — conteúdo único (checklist/coach/ajuda) + proximoPassoPendente (SP-6)"
```

---

### Task 2: `ajuda-tooltip.vue` — o "?" reutilizável

**Files:**
- Create: `src/ferramentas/meta-ads/ajuda-tooltip.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Consumes: `AJUDA` de `tutorial-fabrica.js`.
- Produces: componente `<ajuda-tooltip chave="gerar" />` — ícone "?" que abre/fecha um balão `.fest` com `AJUDA[chave].titulo` + `itens`.

- [ ] **Step 1: Implementar o componente**

Create `src/ferramentas/meta-ads/ajuda-tooltip.vue`:
```vue
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AJUDA } from './tutorial-fabrica.js'
const props = defineProps({ chave: { type: String, required: true } })
const aberto = ref(false)
const conteudo = computed(() => AJUDA[props.chave] || null)
function onKey(e) { if (e.key === 'Escape') aberto.value = false }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <span class="ajuda" v-if="conteudo">
    <button class="ajuda-btn" type="button" :aria-expanded="aberto" aria-label="Ajuda" @click.stop="aberto = !aberto">?</button>
    <div v-if="aberto" class="ajuda-back" @click="aberto = false"></div>
    <div v-if="aberto" class="ajuda-balao" role="dialog">
      <div class="ajuda-tit">{{ conteudo.titulo }}</div>
      <div v-for="it in conteudo.itens" :key="it.termo" class="ajuda-item">
        <b>{{ it.termo }}</b><span>{{ it.texto }}</span>
      </div>
      <button class="ajuda-fechar" type="button" @click="aberto = false">Fechar</button>
    </div>
  </span>
</template>
```

- [ ] **Step 2: CSS**

Em `src/ferramentas/meta-ads/estudio.css` (`.fest`):
```css
.fest .ajuda{position:relative; display:inline-flex}
.fest .ajuda-btn{appearance:none; cursor:pointer; width:20px; height:20px; border-radius:50%; border:1px solid var(--edge); background:var(--panel-2); color:var(--ink-dim); font-size:12px; font-weight:700; line-height:1}
.fest .ajuda-btn:hover{border-color:var(--edge-hot); color:var(--ink)}
.fest .ajuda-back{position:fixed; inset:0; z-index:40}
.fest .ajuda-balao{position:absolute; z-index:41; top:26px; left:0; width:min(320px,84vw); background:var(--panel); border:1px solid var(--edge-hot); border-radius:var(--r); padding:12px 14px; box-shadow:0 10px 30px rgba(0,0,0,.35)}
.fest .ajuda-tit{font-weight:700; font-size:13px; margin-bottom:8px}
.fest .ajuda-item{display:flex; flex-direction:column; gap:2px; font-size:12.5px; color:var(--ink-dim); margin-bottom:8px}
.fest .ajuda-item b{color:var(--ink)}
.fest .ajuda-fechar{appearance:none; cursor:pointer; background:var(--panel-2); border:1px solid var(--edge); border-radius:6px; color:var(--ink-dim); font-size:12px; padding:5px 10px}
```

- [ ] **Step 3: Build** — `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/ajuda-tooltip.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): ajuda-tooltip — o '?' reutilizável por tela (SP-6)"
```

---

### Task 3: `tour-coachmark.vue` — overlay caseiro

**Files:**
- Create: `src/ferramentas/meta-ads/tour-coachmark.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Produces: componente `<tour-coachmark :passos="COACH" v-model="tourAberto" />` — destaca o elemento de cada passo (por `selector`) com realce + balão; Anterior/Próximo/Pular; pula passo cujo elemento não existe; fecha (emite `update:modelValue=false`) no fim/Pular/ESC.

- [ ] **Step 1: Implementar o componente**

Create `src/ferramentas/meta-ads/tour-coachmark.vue`:
```vue
<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
const props = defineProps({ passos: { type: Array, required: true }, modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const idx = ref(0)
const rect = ref(null)   // bounding do alvo atual
const passo = ref(null)  // {selector,titulo,texto}

function medir() {
  const p = props.passos[idx.value]
  passo.value = p || null
  if (!p) return
  const el = document.querySelector(p.selector)
  if (!el) { rect.value = null; return }
  el.scrollIntoView({ block: 'center', behavior: 'auto' })
  const r = el.getBoundingClientRect()
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height }
}
async function irPara(i) {
  // pula passos cujo elemento não existe (resiliente a mudanças de UI)
  let n = i
  while (n >= 0 && n < props.passos.length && !document.querySelector(props.passos[n].selector)) n += (i >= idx.value ? 1 : -1)
  if (n < 0 || n >= props.passos.length) { fechar(); return }
  idx.value = n; await nextTick(); medir()
}
function proximo() { irPara(idx.value + 1) }
function anterior() { irPara(idx.value - 1) }
function fechar() { emit('update:modelValue', false) }
function onKey(e) { if (e.key === 'Escape') fechar(); else if (e.key === 'ArrowRight') proximo(); else if (e.key === 'ArrowLeft') anterior() }
function reMedir() { if (props.modelValue) medir() }

watch(() => props.modelValue, async (v) => {
  if (v) {
    idx.value = 0
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', reMedir); window.addEventListener('scroll', reMedir, true)
    await nextTick(); irPara(0)
  } else {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', reMedir); window.removeEventListener('scroll', reMedir, true)
  }
})
onUnmounted(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', reMedir); window.removeEventListener('scroll', reMedir, true) })

const estiloRealce = () => rect.value ? { top: rect.value.top - 6 + 'px', left: rect.value.left - 6 + 'px', width: rect.value.width + 12 + 'px', height: rect.value.height + 12 + 'px' } : {}
const estiloBalao = () => {
  if (!rect.value) return { top: '40%', left: '50%', transform: 'translate(-50%,-50%)' }
  const abaixo = rect.value.top + rect.value.height + 12
  return { top: Math.min(abaixo, window.innerHeight - 180) + 'px', left: Math.max(12, Math.min(rect.value.left, window.innerWidth - 320)) + 'px' }
}
</script>
<template>
  <div v-if="modelValue" class="tour-overlay">
    <div class="tour-back" @click="fechar"></div>
    <div v-if="rect" class="tour-realce" :style="estiloRealce()"></div>
    <div class="tour-balao" :style="estiloBalao()" role="dialog">
      <div class="tour-tit">{{ passo?.titulo }}</div>
      <div class="tour-txt">{{ passo?.texto }}</div>
      <div class="tour-acoes">
        <span class="tour-passo">{{ idx + 1 }} / {{ passos.length }}</span>
        <button class="mini" type="button" @click="fechar">Pular</button>
        <button class="mini" type="button" :disabled="idx === 0" @click="anterior">Anterior</button>
        <button class="cmd cyan" type="button" @click="idx >= passos.length - 1 ? fechar() : proximo()">{{ idx >= passos.length - 1 ? 'Concluir' : 'Próximo' }}</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: CSS**

Em `src/ferramentas/meta-ads/estudio.css` (`.fest` — mas o overlay é montado dentro do `.fest` da Home, então prefixar `.fest`):
```css
.fest .tour-overlay{position:fixed; inset:0; z-index:50}
.fest .tour-back{position:absolute; inset:0; background:rgba(3,6,10,.55)}
.fest .tour-realce{position:absolute; border:2px solid var(--cyan); border-radius:10px; box-shadow:0 0 0 9999px rgba(3,6,10,.55); pointer-events:none; transition:all .15s ease}
@media (prefers-reduced-motion: reduce){ .fest .tour-realce{ transition:none } }
.fest .tour-balao{position:absolute; z-index:51; width:min(320px,86vw); background:var(--panel); border:1px solid var(--edge-hot); border-radius:var(--r); padding:14px 16px; box-shadow:0 12px 34px rgba(0,0,0,.4)}
.fest .tour-tit{font-weight:700; font-size:14px}
.fest .tour-txt{font-size:13px; color:var(--ink-dim); margin:6px 0 12px}
.fest .tour-acoes{display:flex; align-items:center; gap:8px; flex-wrap:wrap}
.fest .tour-passo{font-size:11.5px; color:var(--ink-faint); margin-right:auto}
```
(Reusa `.mini`/`.cmd` que já existem em `estudio.css`.)

- [ ] **Step 3: Build** — `npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tour-coachmark.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): tour-coachmark — overlay caseiro (destaca por data-tour, pula alvo ausente) (SP-6)"
```

---

### Task 4: Home — checklist + Rever tour + tour + `data-tour`

**Files:**
- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-home.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Consumes: `CHECKLIST`, `COACH`, `proximoPassoPendente` (Task 1), `<tour-coachmark>` (Task 3).
- Produces: a Home com o card "Primeiros passos", o botão "Rever tour", o tour montado (auto 1x), e `data-tour` nos elementos.

- [ ] **Step 1: Script**

Em `src/ferramentas/meta-ads/tela-de-fabrica-home.vue` `<script setup>`, adicionar:
```js
import TourCoachmark from './tour-coachmark.vue'
import { CHECKLIST, COACH } from './tutorial-fabrica.js'
const CHK_KEY = 'fabrica_checklist_v1', TOUR_KEY = 'fabrica_tour_v1'
const tourAberto = ref(false)
const feitos = ref((localStorage.getItem(CHK_KEY) || '').split(',').filter(Boolean))
const mostrarChecklist = ref(localStorage.getItem('fabrica_checklist_hide_v1') !== '1')
function feito(id) { return feitos.value.includes(id) || (id === 'publicar' && publicadas.value.length > 0) }
function irChecklist(item) {
  if (!feitos.value.includes(item.id)) { feitos.value.push(item.id); localStorage.setItem(CHK_KEY, feitos.value.join(',')) }
  router.push({ name: item.rota })
}
function ocultarChecklist() { mostrarChecklist.value = false; localStorage.setItem('fabrica_checklist_hide_v1', '1') }
function mostrarChecklistDeNovo() { mostrarChecklist.value = true; localStorage.removeItem('fabrica_checklist_hide_v1') }
function reverTour() { tourAberto.value = true }
```
No `onMounted` existente (após `carregar()`), auto-abrir o tour 1x:
```js
if (localStorage.getItem(TOUR_KEY) !== '1') { localStorage.setItem(TOUR_KEY, '1'); setTimeout(() => { tourAberto.value = true }, 600) }
```
`CHECKLIST`/`COACH` ficam disponíveis no template automaticamente (imports em `<script setup>`), assim como `<TourCoachmark>`.

- [ ] **Step 2: Template**

1. No `<header class="topbar">`, adicionar (perto do botão Nova campanha): `<button class="voltar-central" @click="reverTour">Rever tour</button>`.
2. `data-tour` nos elementos: no botão Nova campanha `data-tour="nova-campanha"`; na `<div class="readout">` `data-tour="numeros"`; no painel "Campanhas em criação" `data-tour="em-criacao"`; no painel "Publicadas recentes" `data-tour="publicadas"`; no painel "Looks & Templates" `data-tour="looks-card"`.
3. Card checklist (antes da seção "Em criação", ou logo após o readout), só quando `mostrarChecklist`:
```html
<div v-if="mostrarChecklist" class="panel">
  <div class="ph"><span class="eyebrow">Primeiros passos</span>
    <button class="mini" @click="ocultarChecklist">Ocultar</button></div>
  <div class="chk-list">
    <div v-for="item in CHECKLIST" :key="item.id" class="chk-item" :class="{ ok: feito(item.id) }">
      <span class="chk-mark">{{ feito(item.id) ? '✓' : '' }}</span>
      <div class="chk-body"><div class="chk-tit">{{ item.titulo }}</div><div class="chk-txt">{{ item.texto }}</div></div>
      <button class="mini" @click="irChecklist(item)">ir</button>
    </div>
  </div>
</div>
<p v-else class="empty"><a href="#" @click.prevent="mostrarChecklistDeNovo">mostrar primeiros passos</a></p>
```
4. Antes de fechar o `.shell`, montar o tour: `<TourCoachmark :passos="COACH" v-model="tourAberto" />`.

- [ ] **Step 3: CSS**

Em `estudio.css` (`.fest`):
```css
.fest .chk-list{display:flex; flex-direction:column; gap:8px}
.fest .chk-item{display:flex; align-items:center; gap:10px; border:1px solid var(--edge); border-radius:var(--r); background:var(--panel-2); padding:10px 12px}
.fest .chk-item.ok{opacity:.7}
.fest .chk-mark{width:22px; height:22px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid var(--edge); color:var(--go); font-weight:700}
.fest .chk-item.ok .chk-mark{border-color:var(--go)}
.fest .chk-tit{font-weight:600; font-size:13px} .fest .chk-txt{font-size:12px; color:var(--ink-dim); margin-top:2px}
.fest .chk-body{flex:1}
```

- [ ] **Step 4: Build** — `npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tela-de-fabrica-home.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): Home — checklist Primeiros passos + tour coach-marks (auto 1x) + Rever tour + data-tour (SP-6)"
```

---

### Task 5: Tooltips "?" nas telas

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-gerar.vue`
- Modify: `src/ferramentas/meta-ads/painel-curar.vue`
- Modify: `src/ferramentas/meta-ads/painel-subir.vue`
- Modify: `src/ferramentas/meta-ads/painel-conferir.vue`
- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-looks.vue`

**Interfaces:**
- Consumes: `<ajuda-tooltip>` (Task 2) + as chaves de `AJUDA` (gerar/curar/subir/conferir/looks).

- [ ] **Step 1: Inserir o "?" em cada tela**

Em cada arquivo: importar `import AjudaTooltip from './ajuda-tooltip.vue'` no `<script setup>` e colocar `<AjudaTooltip chave="<chave>" />` no cabeçalho (`.stagehead`, ao lado do `<h2>`; em `tela-de-fabrica-looks.vue` no `.topbar`/cabeçalho da galeria). Chaves: `painel-gerar`→`gerar`, `painel-curar`→`curar`, `painel-subir`→`subir`, `painel-conferir`→`conferir`, `tela-de-fabrica-looks`→`looks`. Ex. em painel-curar.vue no `.stagehead`:
```html
<h2>Escolha os melhores <AjudaTooltip chave="curar" /></h2>
```

- [ ] **Step 2: Build** — `npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-gerar.vue src/ferramentas/meta-ads/painel-curar.vue src/ferramentas/meta-ads/painel-subir.vue src/ferramentas/meta-ads/painel-conferir.vue src/ferramentas/meta-ads/tela-de-fabrica-looks.vue
git commit -m "feat(fabrica): tooltip '?' de ajuda nos cabeçalhos de gerar/curar/subir/conferir/looks (SP-6)"
```

---

## Checkpoints do mundo real (controller + Breno)

- **Merge→main + push** (conta brenoov) → Vercel deploya o front. **Sem migration, sem Edge, sem deploy manual** — é puro front.
- **Smoke ao vivo:** o tour abre 1x na 1ª visita (e não reabre); "Rever tour" reabre; os coach-marks destacam os elementos certos e pulam alvo ausente; o checklist marca ✓ ao "ir" (e "Publicadas" deriva do dado); os "?" abrem/fecham em cada tela; ocultar/mostrar primeiros passos; mobile não estoura.

## Testes (resumo)

- **node:test:** `tutorial-fabrica.test.mjs` (`proximoPassoPendente` + shape do CHECKLIST). Suíte coletor inalterada (nada no coletor).
- **Front:** `vite build` por task + smoke acima.

## Sequência

1 (conteúdo) → 2 (ajuda-tooltip) → 3 (tour-coachmark) → 4 (Home: checklist+tour+data-tour) → 5 (tooltips nas telas). Merge/push no checkpoint (puro front).
