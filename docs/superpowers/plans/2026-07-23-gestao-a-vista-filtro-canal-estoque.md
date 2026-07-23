# Gestão à Vista — filtro por canal + estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à Gestão à Vista um **filtro por canal de venda** (ver 1 canal por vez ou todos) e uma **seção de estoque por canal** colapsável no fim da página (colunas por depósito, com SKU/busca/filtro/ordenar/mostrar), lendo a tabela `gc_estoque_item` que já existe.

**Architecture:** Feature **100% front** em `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue` (monólito imperativo, render via innerHTML). A lógica pura (status, filtro/ordenação/limite do estoque, mapa depósito→canal, filtro de pedidos por canal) sai num módulo testável `estoque-gv.js`. O estoque vem de `gc_estoque_item` (Supabase, já coletada; RLS SELECT authenticated), lida sob demanda quando a seção abre.

**Tech Stack:** Vue 3 (mas a tela é imperativa/innerHTML), Supabase JS (`sbClient.from`), `node:test`.

## Global Constraints

- **Não quebrar o que existe:** o board (velocímetros + rankings), o topbar, o **rodapé/ticker** (que já cicla Últimos pedidos / Itens mais vendidos / Citações) e o modo telão continuam iguais.
- **Rodapé é o ÚLTIMO elemento** da página; a seção de estoque fica **acima** do ticker.
- **Pulmão (`14888248253`) SEMPRE visível** no estoque; ao filtrar uma loja, mostra a loja + o Pulmão.
- **Nomes reais** dos depósitos (não inventar): Tivoli `14888726315`, Dom Pedro `14888617206`, Estoque Pulmão `14888248253`.
- **Classes CSS com prefixo único** (`gv-cf-*` filtro, `gv-est-*` estoque) pra não colidir com globais — ver [[project_iamundi_colisao_css_global]].
- Sem migration e sem tocar no coletor (`gc_estoque_item` já é populada).
- Branch: `feat/gv-filtro-canal-estoque` (já criada a partir de `main`).

---

### Task 1: Módulo puro `estoque-gv.js` (lógica testável)

**Files:**
- Create: `src/ferramentas/gestao-a-vista/estoque-gv.js`
- Test: `src/ferramentas/gestao-a-vista/estoque-gv.test.mjs`

**Interfaces:**
- Produces:
  - `DEPOSITOS` → `[{id:14888726315,nome:'Shopping Tivoli',pulmao:false}, {id:14888617206,nome:'Shopping Dom Pedro',pulmao:false}, {id:14888248253,nome:'Estoque Pulmão',pulmao:true}]`
  - `statusSaldo(saldo, limiares?)` → `'crit'|'low'|'ok'` (default crit≤3, low≤8)
  - `depositosVisiveis(canalNome)` → lista de `DEPOSITOS` a mostrar (o depósito do canal, se casar por nome, + sempre o Pulmão; se `canalNome` vazio/'todos' → todos)
  - `prepararEstoque(itens, {busca, status, sort, limit})` → `{rows, full}` (filtra por busca sku/produto, por status, ordena, corta no limit; `full`=antes do corte)
  - `filtrarPedidosPorCanal(pedidos, canalId)` → pedidos com `p.loja?.id===canalId` (ou todos se canalId==null)

- [ ] **Step 1: Write the failing test**

```js
// src/ferramentas/gestao-a-vista/estoque-gv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPOSITOS, statusSaldo, depositosVisiveis, prepararEstoque, filtrarPedidosPorCanal } from './estoque-gv.js';

test('statusSaldo: limiares default (crit<=3, low<=8)', () => {
  assert.equal(statusSaldo(0), 'crit'); assert.equal(statusSaldo(3), 'crit');
  assert.equal(statusSaldo(4), 'low'); assert.equal(statusSaldo(8), 'low');
  assert.equal(statusSaldo(9), 'ok');
});

test('depositosVisiveis: Pulmão sempre; canal casado mostra loja+Pulmão; todos=3', () => {
  assert.deepEqual(depositosVisiveis('').map(d=>d.id), [14888726315,14888617206,14888248253]);
  assert.deepEqual(depositosVisiveis('Shopping Tivoli').map(d=>d.id), [14888726315,14888248253]);
  // canal sem depósito casável -> só o Pulmão
  assert.deepEqual(depositosVisiveis('Loja Online').map(d=>d.id), [14888248253]);
});

test('prepararEstoque: busca + status + ordena + limita', () => {
  const itens = [
    {sku:'LV1',produto:'Bolsa Foggia',saldo:2},{sku:'LV2',produto:'Bolsa Porto',saldo:15},
    {sku:'LV3',produto:'Bolsa Pisa',saldo:6},{sku:'LV4',produto:'Bolsa Siena',saldo:20},
  ];
  // status crítico + ordena estoque asc
  let r = prepararEstoque(itens, {busca:'', status:'crit', sort:'qasc', limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['LV1']); assert.equal(r.full, 1);
  // busca por nome
  r = prepararEstoque(itens, {busca:'porto', status:'todos', sort:'qasc', limit:'all'});
  assert.deepEqual(r.rows.map(x=>x.sku), ['LV2']);
  // limite corta e full guarda o total
  r = prepararEstoque(itens, {busca:'', status:'todos', sort:'qasc', limit:2});
  assert.deepEqual(r.rows.map(x=>x.saldo), [2,6]); assert.equal(r.full, 4);
});

test('filtrarPedidosPorCanal', () => {
  const peds=[{loja:{id:1}},{loja:{id:2}},{loja:{id:1}}];
  assert.equal(filtrarPedidosPorCanal(peds, null).length, 3);
  assert.equal(filtrarPedidosPorCanal(peds, 1).length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/ferramentas/gestao-a-vista/estoque-gv.test.mjs`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```js
// src/ferramentas/gestao-a-vista/estoque-gv.js
// Lógica pura do filtro por canal + seção de estoque da Gestão à Vista. Sem Vue/DOM (node-testável).
export const DEPOSITOS = [
  { id: 14888726315, nome: 'Shopping Tivoli',   pulmao: false },
  { id: 14888617206, nome: 'Shopping Dom Pedro', pulmao: false },
  { id: 14888248253, nome: 'Estoque Pulmão',     pulmao: true  },
];
const PULMAO = DEPOSITOS.find((d) => d.pulmao);

export function statusSaldo(saldo, { crit = 3, low = 8 } = {}) {
  const q = Number(saldo) || 0;
  return q <= crit ? 'crit' : q <= low ? 'low' : 'ok';
}

// Casa o canal de venda (nome) a um depósito físico. Aproxima por palavra-chave (Tivoli/Dom Pedro).
// Canal sem depósito casável -> só o Pulmão aparece.
export function depositosVisiveis(canalNome) {
  if (!canalNome || canalNome === 'todos') return DEPOSITOS.slice();
  const n = String(canalNome).toLowerCase();
  const loja = DEPOSITOS.find((d) => !d.pulmao && (
    (d.nome.toLowerCase().includes('tivoli') && n.includes('tivoli')) ||
    (d.nome.toLowerCase().includes('dom pedro') && n.includes('dom pedro')) ||
    (n.includes('pulmão') || n.includes('pulmao') || n.includes('atacado'))
  ));
  // pulmão sempre; se casou uma loja, ela vem antes
  return loja ? [loja, PULMAO] : [PULMAO];
}

export function prepararEstoque(itens, { busca = '', status = 'todos', sort = 'qasc', limit = 'all' } = {}) {
  const b = String(busca).trim().toLowerCase();
  let rows = (itens || []).filter((it) => {
    if (b && !(String(it.sku).toLowerCase().includes(b) || String(it.produto || '').toLowerCase().includes(b))) return false;
    const s = statusSaldo(it.saldo);
    return status === 'todos' || (status === 'crit' && s === 'crit') || (status === 'baixocrit' && (s === 'crit' || s === 'low'));
  });
  rows.sort((a, b2) => {
    if (sort === 'qasc') return a.saldo - b2.saldo;
    if (sort === 'qdesc') return b2.saldo - a.saldo;
    if (sort === 'sku') return String(a.sku) < String(b2.sku) ? -1 : 1;
    return String(a.produto || '') < String(b2.produto || '') ? -1 : 1;
  });
  const full = rows.length;
  if (limit !== 'all') rows = rows.slice(0, Number(limit) || full);
  return { rows, full };
}

export function filtrarPedidosPorCanal(pedidos, canalId) {
  if (canalId == null) return pedidos || [];
  return (pedidos || []).filter((p) => p.loja && p.loja.id === canalId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/ferramentas/gestao-a-vista/estoque-gv.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-a-vista/estoque-gv.js src/ferramentas/gestao-a-vista/estoque-gv.test.mjs
git commit -m "feat(gv): logica pura do filtro por canal + estoque (estoque-gv.js)"
```

---

### Task 2: Filtro por canal (estado + barra de chips + re-render)

**Files:**
- Modify: `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue`

**Interfaces:**
- Consumes: `filtrarPedidosPorCanal` (Task 1).

READ the file first. O fluxo atual: `loadGestaoVistaData(period)` (≈L531) busca `pedidos` via `blingPages`, lê `bling_lojas`→`canais`, guarda `window._gvRenderCtx={pedidos,pedidosPrev,canais,...}` (≈L590) e chama `renderGestaoVista(pedidos,canais,...)` (≈L654) que faz o board. Os canais dos velocímetros vêm de `canaisArr` (≈L694) a partir de `porCanal` (soma por `p.loja.id`).

- [ ] **Step 1: Import + estado do filtro**

No `<script>` (topo, junto dos outros imports/estado):
```js
import { filtrarPedidosPorCanal, depositosVisiveis, prepararEstoque, statusSaldo, DEPOSITOS } from './estoque-gv.js'
let _gvCanalSel = null   // loja.id selecionada; null = Todos
```

- [ ] **Step 2: Barra de chips no template**

Inserir ENTRE `.gv-topbar` e `.gv-board` (achar o fechamento do topbar e o início do board):
```html
<div class="gv-cf-bar" id="gv-cf-bar" aria-label="Filtro por canal">
  <span class="gv-cf-lbl">Canal</span>
  <div class="gv-cf-chips" id="gv-cf-chips"></div>
</div>
```
CSS (no `<style>`, prefixo `gv-cf-`, seguindo os tokens da tela — var(--bg)/--surface/--border/--accent/--muted/--text; tema claro+escuro herdados dos tokens):
```css
.tela-gestao-a-vista :deep(.gv-cf-bar){display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 28px;border-bottom:1px solid var(--border);background:var(--surface);position:relative;z-index:9;}
.tela-gestao-a-vista :deep(.gv-cf-lbl){font-family:var(--fonte-principal);font-size:8px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);}
.tela-gestao-a-vista :deep(.gv-cf-chips){display:flex;gap:6px;flex-wrap:wrap;}
.tela-gestao-a-vista :deep(.gv-cf-chip){font-family:var(--fonte-principal);font-size:11px;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.tela-gestao-a-vista :deep(.gv-cf-chip.active){background:var(--accent);color:#fff;border-color:var(--accent);}
```

- [ ] **Step 3: Montar os chips a partir dos canais e reaplicar o filtro**

Depois que `renderGestaoVista` roda pela 1ª vez (os canais já existem em `window._gvRenderCtx`), montar os chips uma vez. Criar `_gvMontaChips()` que lê `window._gvRenderCtx.canais` (mapa loja_id→nome), gera `[Todos]` + um chip por canal com pedido, e no clique seta `_gvCanalSel` e chama `_gvAplicaFiltro()`:
```js
function _gvMontaChips(){
  const ctx=window._gvRenderCtx; if(!ctx) return;
  const ids=[...new Set(ctx.pedidos.map(p=>p.loja&&p.loja.id).filter(Boolean))];
  const chips=document.getElementById('gv-cf-chips'); if(!chips) return;
  const mk=(id,nome)=>`<button class="gv-cf-chip${(_gvCanalSel===id||(id===null&&_gvCanalSel===null))?' active':''}" data-id="${id===null?'':id}">${nome}</button>`;
  chips.innerHTML=mk(null,'Todos')+ids.map(id=>mk(id,ctx.canais[id]||('Canal #'+String(id).slice(-4)))).join('');
  chips.querySelectorAll('.gv-cf-chip').forEach(b=>b.onclick=()=>{_gvCanalSel=b.dataset.id?parseInt(b.dataset.id,10):null;_gvAplicaFiltro();});
}
function _gvAplicaFiltro(){
  const ctx=window._gvRenderCtx; if(!ctx) return;
  const peds=filtrarPedidosPorCanal(ctx.pedidos,_gvCanalSel);
  const pedsPrev=filtrarPedidosPorCanal(ctx.pedidosPrev,_gvCanalSel);
  // re-render do board com os pedidos filtrados (mesma assinatura já usada no load)
  renderGestaoVista(peds, ctx.canais, /* ...demais args do ctx... */);
  _gvMontaChips();           // reflete o estado ativo
  _gvRenderEstoque();        // Task 3
}
```
IMPORTANTE: `renderGestaoVista` recebe muitos args (metasMap, hoje, diasMes, di, period, prevs, vendedoresMap, dailyGoalsMap, actualToday). Guardar ESSES no `window._gvRenderCtx` no load (estender o objeto de L590) pra o `_gvAplicaFiltro` repassar sem recomputar. Ao final do 1º `renderGestaoVista` no load, chamar `_gvMontaChips()`.

- [ ] **Step 4: Verificar build**

Run: `npm run build` — Expected: build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue
git commit -m "feat(gv): filtro por canal (chips) re-filtra board e rankings"
```

---

### Task 3: Seção de estoque (lê gc_estoque_item, colunas por depósito, controles)

**Files:**
- Modify: `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue`

**Interfaces:**
- Consumes: `DEPOSITOS`, `depositosVisiveis`, `prepararEstoque`, `statusSaldo` (Task 1); estado `_gvCanalSel` (Task 2).

- [ ] **Step 1: DOM da seção — ANTES do ticker**

Inserir o bloco imediatamente ANTES do `<div class="gv-ticker">` (a seção fica acima do rodapé; o ticker segue sendo o último elemento):
```html
<div class="gv-est" id="gv-est">
  <button class="gv-est-head" id="gv-est-toggle" aria-expanded="false">
    <span class="gv-est-caret">▶</span><span class="gv-est-t">Estoque por canal</span>
    <span class="gv-est-sub" id="gv-est-sub">clique para mostrar</span>
  </button>
  <div class="gv-est-body" id="gv-est-body" hidden>
    <div class="gv-est-controls">
      <input class="gv-est-search" id="gv-est-search" placeholder="Buscar SKU ou produto…">
      <select class="gv-est-sel" id="gv-est-status"><option value="todos">Todos</option><option value="baixocrit">Baixo + crítico</option><option value="crit">Só crítico</option></select>
      <select class="gv-est-sel" id="gv-est-sort"><option value="qasc">Estoque ↑</option><option value="qdesc">Estoque ↓</option><option value="sku">SKU</option><option value="nome">Nome</option></select>
      <select class="gv-est-sel" id="gv-est-limit"><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="all">Todos</option></select>
      <span class="gv-est-count" id="gv-est-count"></span>
    </div>
    <div class="gv-est-cols" id="gv-est-cols"></div>
  </div>
</div>
```
CSS (prefixo `gv-est-`, tokens da tela; escrever seguindo o mesmo estilo denso — omitido aqui por espaço mas: header clicável, `.gv-est-body[hidden]{display:none}`, `.gv-est-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}`, colunas com borda 1px, linhas com sku (accent, fonte-dados), produto, pill de status (ok/low/crit) e saldo (fonte-dados); inputs/selects com `background:var(--surface2);border:1px solid var(--border);color:var(--text)`).

- [ ] **Step 2: Carregar `gc_estoque_item` sob demanda + render**

```js
let _gvEstoqueCache=null; // [{deposito_id,sku,produto,categoria,saldo}]
async function _gvCarregaEstoque(){
  if(_gvEstoqueCache) return _gvEstoqueCache;
  const ids=DEPOSITOS.map(d=>d.id);
  const { data } = await sbClient.from('gc_estoque_item').select('deposito_id,sku,produto,saldo').in('deposito_id',ids);
  _gvEstoqueCache=data||[]; return _gvEstoqueCache;
}
async function _gvRenderEstoque(){
  const body=document.getElementById('gv-est-body'); if(!body||body.hidden) return;
  const itens=await _gvCarregaEstoque();
  const canalNome=_gvCanalSel!=null?(window._gvRenderCtx?.canais?.[_gvCanalSel]||''):'todos';
  const deps=depositosVisiveis(canalNome);
  const opts={busca:document.getElementById('gv-est-search').value,status:document.getElementById('gv-est-status').value,sort:document.getElementById('gv-est-sort').value,limit:document.getElementById('gv-est-limit').value};
  const lim=opts.limit==='all'?'all':parseInt(opts.limit,10);
  let mostrado=0,filtrado=0;
  document.getElementById('gv-est-cols').innerHTML=deps.map(dep=>{
    const itensDep=itens.filter(it=>it.deposito_id===dep.id);
    const { rows, full }=prepararEstoque(itensDep,{...opts,limit:lim}); mostrado+=rows.length; filtrado+=full;
    const tot=rows.reduce((a,b)=>a+(b.saldo||0),0);
    const more=(lim!=='all'&&full>rows.length)?`<div class="gv-est-more">+ ${full-rows.length} ocultos · ${rows.length} de ${full}</div>`:'';
    const linhas=rows.length?rows.map(r=>{const s=statusSaldo(r.saldo);return `<div class="gv-est-row"><div class="gv-est-info"><span class="gv-est-sku">${r.sku}</span><span class="gv-est-nm">${r.produto||''}</span></div><span class="gv-est-pill ${s}">${s==='crit'?'Crítico':s==='low'?'Baixo':'OK'}</span><span class="gv-est-q">${r.saldo}</span></div>`;}).join(''):'<div class="gv-est-empty">Nada com esse filtro.</div>';
    return `<div class="gv-est-col"><div class="gv-est-colh"><span>${dep.nome}${dep.pulmao?' · pulmão':''}</span><span class="gv-est-tot">${tot} un.</span></div>${linhas}${more}</div>`;
  }).join('');
  document.getElementById('gv-est-count').textContent=`mostrando ${mostrado} de ${filtrado} itens · ${deps.length} depósito(s)`;
}
```

- [ ] **Step 3: Ligar toggle + controles**

```js
document.getElementById('gv-est-toggle').onclick=()=>{const b=document.getElementById('gv-est-body');b.hidden=!b.hidden;document.getElementById('gv-est').classList.toggle('open',!b.hidden);document.getElementById('gv-est-toggle').setAttribute('aria-expanded',String(!b.hidden));document.getElementById('gv-est-sub').textContent=b.hidden?'clique para mostrar':'';_gvRenderEstoque();};
['gv-est-search','gv-est-status','gv-est-sort','gv-est-limit'].forEach(id=>document.getElementById(id).addEventListener('input',_gvRenderEstoque));
```
E chamar `_gvRenderEstoque()` no fim de `_gvAplicaFiltro` (Task 2 já faz) pra seguir o filtro de canal.

- [ ] **Step 4: Build**

Run: `npm run build` — Expected: build limpo (sem erro de template).

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue
git commit -m "feat(gv): secao de estoque por canal (gc_estoque_item) com busca/filtro/ordenar/mostrar"
```

---

### Task 4: Layout do telão (scroll quando abre) + responsivo + validação visual

**Files:**
- Modify: `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue`

- [ ] **Step 1: Permitir a página crescer quando o estoque abre**

A tela é `.tela-gestao-a-vista{height:100vh;overflow:hidden}`. Com a seção fechada, tudo cabe. Aberta, o conteúdo passa da viewport. Ajustar: quando `.gv-est.open`, permitir scroll do container SEM quebrar o telão fechado. Opção: no `.gv-est.open` ancestral, trocar `overflow:hidden`→`auto` só nesse estado (ex.: classe no root `is-est-open` que seta `.tela-gestao-a-vista.is-est-open{height:auto;min-height:100vh;overflow-y:auto}`), aplicada no toggle. Garantir que o ticker continua como último filho no fluxo (não `position:fixed`). No ≤1024px a tela já é `overflow-y:auto` (nada a fazer).

```css
.tela-gestao-a-vista.is-est-open{height:auto;min-height:100vh;max-height:none;overflow-y:auto;}
```
No toggle (Task 3 Step 3), adicionar: `document.querySelector('.tela-gestao-a-vista')?.classList.toggle('is-est-open',!b.hidden);`

- [ ] **Step 2: Verificar build + testes da lógica pura**

Run: `npm run build` — Expected: limpo.
Run: `node --test src/ferramentas/gestao-a-vista/estoque-gv.test.mjs` — Expected: PASS.

- [ ] **Step 3: Validação visual (controlador, repro/Playwright)**

Padrão de repro do projeto ([[project_iamundi_colisao_css_global]]): montar o componente real com deps stubadas (sbClient devolvendo `gc_estoque_item`/pedidos de amostra) e conferir no Playwright:
- chips filtram board + rankings + estoque; "Todos" volta;
- estoque abre/fecha no fim (ticker continua por último); Pulmão sempre presente; ao filtrar Tivoli aparece Tivoli + Pulmão;
- busca/status/ordenar/mostrar combinam; contador certo;
- responsivo 390px sem estourar; tema claro e escuro ok (tokens).
NÃO dá pra logar no iamundi via Playwright real (loga no erickIA) — usar o harness de repro com stubs, ou o dono valida no telão pós-deploy.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue
git commit -m "fix(gv): telao rola quando o estoque abre + responsivo"
```

---

## Self-Review

- **Spec coverage:** filtro por canal (T2) · estoque colunas por depósito com SKU/busca/filtro/ordenar/mostrar (T1+T3) · Pulmão sempre + nomes reais (T1 DEPOSITOS/depositosVisiveis) · seção antes do ticker, ticker por último (T3+T4) · lê gc_estoque_item, sem migration/coletor (T3) · lógica pura testada (T1) · layout telão/responsivo (T4). ✔
- **Placeholders:** o CSS do `gv-est-*` (T3 Step 1) está descrito, não com valores literais completos — o implementador escreve seguindo os tokens/estilo denso da tela (é um port de estilo, não lógica). Aceitável; se o revisor quiser, detalhar. Fora isso, sem TODO/TBD.
- **Type consistency:** `estoque-gv.js` exporta o que T2/T3 importam (DEPOSITOS/depositosVisiveis/prepararEstoque/statusSaldo/filtrarPedidosPorCanal); `_gvRenderCtx` estendido no load é consumido em `_gvAplicaFiltro`/`_gvRenderEstoque`. ✔
- **Nota:** a assinatura longa de `renderGestaoVista` (T2 Step 3) — no implementar, LER a chamada real do load (≈L654) e guardar exatamente esses args no `_gvRenderCtx` pra repassar; não recomputar.
