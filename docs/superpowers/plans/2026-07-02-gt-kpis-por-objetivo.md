# Gestão de Tráfego — KPIs por objetivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Gestão de Tráfego mostrar, por campanha, os KPIs adequados ao objetivo dela (padrões espertos + editor global admin), usando os dados que já vêm ao vivo do Meta + 2 campos novos.

**Architecture:** Tudo no `index.html` (monólito de produção) + 1 migration Supabase. Camada de "catálogo de métricas" e "objetivo→balde→KPIs" como funções puras; `_renderGtCampaigns` passa a renderizar os KPIs do balde de cada campanha; um modal admin edita a config global (tabela `gt_config_metricas`). Dados continuam ao vivo (meta-proxy) — só adiciona `action_values`,`purchase_roas` aos campos.

**Tech Stack:** HTML/JS vanilla (monólito), Supabase (Postgres + RLS), Meta Graph via `metaFetchAll`/meta-proxy.

## Global Constraints

- **Conta Git:** `brenoov` / `breno@rbvcompany.com`. Branch de trabalho `feat/gt-kpis-por-objetivo` (já criada). Produção (`main`) só via merge após validação em preview.
- **Sem framework de teste:** verificação = checagem de sintaxe com `node` (extrair `<script>`) + validação manual no preview. Cada task termina com um check concreto.
- **Modais próprios:** usar os modais/uiConfirm/uiAlert do projeto — nunca `alert/confirm/prompt` nativos.
- **Gating admin:** o editor da config só aparece/salva para admin/superadmin, seguindo o padrão de gating já usado no projeto.
- **Métrica sem dado:** exibir `—` (nunca 0 enganoso).
- **Objetivos novos e legados:** mapear `OUTCOME_*` e nomes legados no mesmo balde.
- **Dados ao vivo:** NÃO mexer no coletor/tabelas de snapshot; a tela usa `metaFetchAll`.

---

### Task 1: Catálogo de métricas + mapa objetivo→balde (funções puras)

**Files:**
- Modify: `index.html` (adicionar um bloco de constantes/funções perto das outras funções `gt*`, ex.: logo antes de `function loadGtData()` ~L7802)

**Interfaces:**
- Produces:
  - `GT_METRIC_CATALOG`: objeto `{ [key]: { label: string, fmt: 'int'|'money'|'pct'|'x'|'dec', compute: (row) => number|null } }`.
  - `GT_OBJETIVO_BALDE`: `{ [objectiveMeta:string]: baldeKey }`.
  - `GT_BALDE_PADRAO`: `{ [baldeKey]: string[] }` (chaves do catálogo, em ordem).
  - `_gtBalde(objective:string): baldeKey` — resolve o balde (fallback `'padrao'`).
  - `_gtActionVal(row, tipos:string[]): number|null` — soma o `value` do primeiro `action_type` de `tipos` achado em `row.actions`; `_gtActionValue(row, tipos)` idem para `row.action_values`.
  - `_gtMetricValue(key, row): number|null` — chama `GT_METRIC_CATALOG[key].compute(row)`.

- [ ] **Step 1: Escrever o bloco de catálogo/mapa**

Adicionar em `index.html` (antes de `loadGtData`):
```js
/* ── GT: CATÁLOGO DE MÉTRICAS POR OBJETIVO ── */
function _gtNum(x){ const n=Number(x); return isFinite(n)?n:null; }
function _gtActionVal(row, tipos){
  const arr=row&&row.actions; if(!Array.isArray(arr))return null;
  for(const t of tipos){ const a=arr.find(x=>x.action_type===t); if(a)return _gtNum(a.value); }
  return null;
}
function _gtActionValue(row, tipos){
  const arr=row&&row.action_values; if(!Array.isArray(arr))return null;
  for(const t of tipos){ const a=arr.find(x=>x.action_type===t); if(a)return _gtNum(a.value); }
  return null;
}
const _GT_PURCHASE=['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase'];
const _GT_LEAD=['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'];
const _GT_VISIT=['landing_page_view','link_click'];
const GT_METRIC_CATALOG={
  alcance:{label:'Alcance',fmt:'int',compute:r=>_gtNum(r.reach)},
  impressoes:{label:'Impressões',fmt:'int',compute:r=>_gtNum(r.impressions)},
  frequencia:{label:'Frequência',fmt:'dec',compute:r=>_gtNum(r.frequency)},
  ctr:{label:'CTR',fmt:'pct',compute:r=>_gtNum(r.ctr)},
  cpc:{label:'CPC',fmt:'money',compute:r=>_gtNum(r.cpc)},
  cpm:{label:'CPM',fmt:'money',compute:r=>{const i=_gtNum(r.impressions),s=_gtNum(r.spend);return i?s/i*1000:null;}},
  cliques:{label:'Cliques',fmt:'int',compute:r=>_gtNum(r.clicks)},
  visitas:{label:'Visitas',fmt:'int',compute:r=>_gtActionVal(r,_GT_VISIT)},
  compras:{label:'Compras',fmt:'int',compute:r=>_gtActionVal(r,_GT_PURCHASE)},
  valor_conversao:{label:'Valor de conversão',fmt:'money',compute:r=>_gtActionValue(r,_GT_PURCHASE)},
  roas:{label:'ROAS',fmt:'x',compute:r=>{const pr=r.purchase_roas&&r.purchase_roas[0]&&_gtNum(r.purchase_roas[0].value);if(pr!=null)return pr;const v=_gtActionValue(r,_GT_PURCHASE),s=_gtNum(r.spend);return (v!=null&&s)?v/s:null;}},
  cac:{label:'CAC',fmt:'money',compute:r=>{const c=_gtActionVal(r,_GT_PURCHASE),s=_gtNum(r.spend);return c?s/c:null;}},
  gasto:{label:'Gasto',fmt:'money',compute:r=>_gtNum(r.spend)},
  leads:{label:'Leads',fmt:'int',compute:r=>_gtActionVal(r,_GT_LEAD)},
  custo_lead:{label:'Custo/Lead',fmt:'money',compute:r=>{const l=_gtActionVal(r,_GT_LEAD),s=_gtNum(r.spend);return l?s/l:null;}},
};
const GT_OBJETIVO_BALDE={
  OUTCOME_TRAFFIC:'trafego', LINK_CLICKS:'trafego',
  OUTCOME_SALES:'vendas', CONVERSIONS:'vendas', PRODUCT_CATALOG_SALES:'vendas',
  OUTCOME_AWARENESS:'reconhecimento', BRAND_AWARENESS:'reconhecimento', REACH:'reconhecimento', VIDEO_VIEWS:'reconhecimento',
  OUTCOME_ENGAGEMENT:'engajamento', POST_ENGAGEMENT:'engajamento', PAGE_LIKES:'engajamento', MESSAGES:'engajamento',
  OUTCOME_LEADS:'leads', LEAD_GENERATION:'leads',
};
const GT_BALDE_PADRAO={
  trafego:['ctr','cpc','visitas','cpm'],
  vendas:['roas','cac','valor_conversao','compras'],
  reconhecimento:['alcance','cpm','frequencia','impressoes'],
  engajamento:['ctr','cpc','cliques','gasto'],
  leads:['leads','custo_lead','ctr','gasto'],
  padrao:['ctr','cpc','gasto','alcance'],
};
function _gtBalde(objective){ return GT_OBJETIVO_BALDE[String(objective||'').toUpperCase()]||'padrao'; }
function _gtMetricValue(key,row){ const m=GT_METRIC_CATALOG[key]; return m?m.compute(row):null; }
```

- [ ] **Step 2: Checar sintaxe**

Run:
```bash
cd /Users/erickmartins/iamundi
node -e "const s=require('fs').readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,all='';while((m=re.exec(s)))all+='\n;(function(){'+m[1]+'\n})();';new Function(all);console.log('sintaxe OK')"
```
Expected: `sintaxe OK`.

- [ ] **Step 3: Teste rápido do catálogo (inline node)**

Run:
```bash
node -e "
const _gtNum=x=>{const n=Number(x);return isFinite(n)?n:null};
const row={spend:100,impressions:10000,clicks:200,reach:8000,ctr:2,cpc:0.5,actions:[{action_type:'purchase',value:'5'},{action_type:'landing_page_view',value:'150'}],action_values:[{action_type:'purchase',value:'900'}],purchase_roas:[{value:'9'}]};
const cpm=_gtNum(row.impressions)?_gtNum(row.spend)/_gtNum(row.impressions)*1000:null;
const compras=(row.actions.find(a=>a.action_type==='purchase')||{}).value;
const cac=Number(compras)?_gtNum(row.spend)/Number(compras):null;
console.log('cpm',cpm,'| compras',compras,'| cac',cac,'| roas',row.purchase_roas[0].value);
"
```
Expected: `cpm 10 | compras 5 | cac 20 | roas 9`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(gt): catálogo de métricas + mapa objetivo->balde (funções puras)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Adicionar campos ao vivo (action_values, purchase_roas) + validar proxy

**Files:**
- Modify: `index.html:7824` (fields do insights por campanha) e `:7825` (adFields) se aplicável.

**Interfaces:**
- Produces: `insights`/`adInsights` de `loadGtData` passam a conter `action_values` e `purchase_roas` por linha.

- [ ] **Step 1: Adicionar os 2 campos**

Em `index.html:7824`, trocar:
```js
    const fields='campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,objective,video_play_actions';
```
por:
```js
    const fields='campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,action_values,purchase_roas,objective,video_play_actions';
```

- [ ] **Step 2: Checar sintaxe** (mesmo comando do Task 1 Step 2). Expected: `sintaxe OK`.

- [ ] **Step 3: Validar que o meta-proxy repassa os campos (preview/dev)**

Este passo é validado no PREVIEW (Task 6): abrir a Gestão de Tráfego numa conta com campanha de vendas e confirmar, no console/DevTools (Network → chamada de insights), que a resposta traz `action_values` e `purchase_roas`. Se o proxy filtrar (campo sumindo), ajustar a allowlist do `meta-proxy` (Edge Function) para incluí-los. Anotar como dependência do Task 6 (não bloqueia o commit do código).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(gt): buscar action_values e purchase_roas ao vivo (ROI/valor de conversão)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Tabela de config global `gt_config_metricas` + leitura/escrita

**Files:**
- Create: `docs/migrations/2026-07-02-gt-config-metricas.sql` (migration para rodar no Supabase)
- Modify: `index.html` (funções `_gtLoadConfig`/`_gtSaveConfig` perto do bloco do Task 1)

**Interfaces:**
- Consumes: `sb(...)` (helper de leitura já existente) e o client autenticado para escrita.
- Produces:
  - `_gtConfig` (cache em memória: `{ [balde]: string[] }`).
  - `async _gtLoadConfig()` — lê `gt_config_metricas`, popula `_gtConfig` (ausência → `{}`; render usa fallback `GT_BALDE_PADRAO`).
  - `async _gtSaveConfig(balde, metricas)` — upsert (`onConflict: balde`).
  - `_gtMetricasDoBalde(balde)` — `(_gtConfig[balde]?.length ? _gtConfig[balde] : GT_BALDE_PADRAO[balde]||GT_BALDE_PADRAO.padrao)`.

- [ ] **Step 1: Escrever a migration**

Create `docs/migrations/2026-07-02-gt-config-metricas.sql`:
```sql
create table if not exists public.gt_config_metricas (
  balde text primary key,
  metricas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.gt_config_metricas enable row level security;
-- leitura liberada (dados não sensíveis)
create policy gt_cfg_read on public.gt_config_metricas for select using (true);
-- escrita só para admin: seguir o padrão do projeto. Placeholder de policy por role de serviço;
-- se o projeto edita config via RPC security-definer com guarda de username, criar a RPC no lugar.
create policy gt_cfg_write on public.gt_config_metricas for all
  using (false) with check (false);
```
NOTA: a escrita real deve seguir o mesmo mecanismo de admin já usado no projeto (RPC security-definer com guarda de username OU policy por role). Ajustar `gt_cfg_write` conforme o padrão existente antes de rodar (ver como os outros configs do projeto gatam escrita de admin).

- [ ] **Step 2: Rodar a migration no Supabase**

Aplicar via MCP `apply_migration` (ou painel). Verificar com:
```sql
select * from public.gt_config_metricas;
```
Expected: tabela existe, vazia.

- [ ] **Step 3: Funções de leitura/escrita no client**

Adicionar em `index.html` (perto do bloco do Task 1):
```js
let _gtConfig={};
async function _gtLoadConfig(){
  try{ const rows=await sb('gt_config_metricas?select=balde,metricas'); _gtConfig={}; (rows||[]).forEach(r=>{ if(Array.isArray(r.metricas)) _gtConfig[r.balde]=r.metricas; }); }
  catch(e){ _gtConfig={}; }
}
function _gtMetricasDoBalde(balde){
  const c=_gtConfig[balde]; return (Array.isArray(c)&&c.length)?c:(GT_BALDE_PADRAO[balde]||GT_BALDE_PADRAO.padrao);
}
async function _gtSaveConfig(balde, metricas){
  // usar o mesmo caminho de escrita-admin do projeto (RPC/patch autenticado)
  await sbAuthUpsert('gt_config_metricas', { balde, metricas, updated_at: new Date().toISOString() }, 'balde');
  _gtConfig[balde]=metricas;
}
```
(Ajustar `sbAuthUpsert` para o helper de escrita autenticada real do projeto.)

- [ ] **Step 4: Carregar a config no fluxo da tela**

Em `loadGtData` (`index.html` ~L7810, no início do `try`), garantir a config carregada uma vez:
```js
    if(!_gtConfigLoaded){ await _gtLoadConfig(); _gtConfigLoaded=true; }
```
Declarar `let _gtConfigLoaded=false;` junto das outras globais `_gt*`.

- [ ] **Step 5: Checar sintaxe** (comando do Task 1 Step 2). Expected: `sintaxe OK`.

- [ ] **Step 6: Commit**

```bash
git add index.html docs/migrations/2026-07-02-gt-config-metricas.sql
git commit -m "feat(gt): tabela gt_config_metricas + leitura/escrita da config global

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Render dos KPIs por objetivo em `_renderGtCampaigns`

**Files:**
- Modify: `index.html` — `_renderGtCampaigns` (~L7841 chama; a função em si — localizar com `grep -n "function _renderGtCampaigns"`).

**Interfaces:**
- Consumes: `_gtBalde`, `_gtMetricasDoBalde`, `_gtMetricValue`, `GT_METRIC_CATALOG`, e um formatador `_gtFmt(val, fmt)`.
- Produces: cada campanha renderiza os KPIs do seu balde.

- [ ] **Step 1: Formatador de valores**

Adicionar (perto do catálogo):
```js
function _gtFmt(v, fmt){
  if(v==null||!isFinite(v))return '—';
  if(fmt==='money')return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(fmt==='pct')return v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
  if(fmt==='x')return v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'×';
  if(fmt==='dec')return v.toLocaleString('pt-BR',{maximumFractionDigits:2});
  return Math.round(v).toLocaleString('pt-BR'); // int
}
function _gtKpisHtml(row){
  const balde=_gtBalde(row.objective);
  const keys=_gtMetricasDoBalde(balde);
  return keys.map(k=>{ const m=GT_METRIC_CATALOG[k]; if(!m)return ''; const val=_gtFmt(m.compute(row), m.fmt);
    return `<div class="gt-kpi"><span class="gt-kpi-lbl">${m.label}</span><span class="gt-kpi-val">${val}</span></div>`;
  }).join('');
}
```

- [ ] **Step 2: Integrar no card da campanha**

Em `_renderGtCampaigns`, onde hoje monta o bloco de métricas de cada campanha, substituir esse bloco pela chamada `_gtKpisHtml(insightDaCampanha)`. (Ler a função para achar o ponto exato; o `insight` por campanha vem de `insights` casado por `campaign_id`; a campanha traz `objective`.) Preservar o layout/CSS existente (classes `gt-kpi*` — se não existirem, reaproveitar as classes de KPI já usadas na tela).

- [ ] **Step 3: CSS (se necessário)**

Se as classes `.gt-kpi/.gt-kpi-lbl/.gt-kpi-val` não existirem, adicionar regras mínimas reaproveitando as variáveis de tema (`var(--text)`, `var(--muted)`, etc.), no bloco `#gestao-trafego-screen ...`.

- [ ] **Step 4: Checar sintaxe** (comando do Task 1 Step 2). Expected: `sintaxe OK`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(gt): render dos KPIs conforme o objetivo de cada campanha

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Editor global (modal admin) da config por objetivo

**Files:**
- Modify: `index.html` — topbar da Gestão de Tráfego (botão engrenagem) + função `_gtOpenEditor()`.

**Interfaces:**
- Consumes: `_gtConfig`, `_gtSaveConfig`, `GT_METRIC_CATALOG`, `GT_BALDE_PADRAO`, o gate de admin do projeto (ex.: `isSuperAdmin()`/username guard), e os modais próprios (`uiModal`/equivalente).

- [ ] **Step 1: Botão engrenagem (só admin)**

Na topbar do `#gestao-trafego-screen`, adicionar um botão de engrenagem que só aparece para admin (usar o mesmo gate já usado em outros lugares — localizar com `grep -n "superadmin\|isSuperAdmin\|super_admin"`). `onclick="_gtOpenEditor()"`.

- [ ] **Step 2: Modal editor**

```js
async function _gtOpenEditor(){
  await _gtLoadConfig();
  const baldes=Object.keys(GT_BALDE_PADRAO);
  const catalogo=Object.entries(GT_METRIC_CATALOG).map(([k,m])=>({k,label:m.label}));
  const body=baldes.map(b=>{
    const sel=_gtMetricasDoBalde(b);
    const chks=catalogo.map(c=>`<label class="gt-cfg-chk"><input type="checkbox" data-balde="${b}" value="${c.k}" ${sel.includes(c.k)?'checked':''}> ${c.label}</label>`).join('');
    return `<div class="gt-cfg-sec"><div class="gt-cfg-obj">${b}</div><div class="gt-cfg-grid">${chks}</div></div>`;
  }).join('');
  // Renderizar com o modal próprio do projeto (uiModal). No "Salvar":
  //   para cada balde, coletar os checkboxes marcados na ordem do catálogo e _gtSaveConfig(b, keys)
  // Depois: loadGtData() para re-renderizar.
}
```
Implementar o "Salvar" lendo os checkboxes por balde e chamando `_gtSaveConfig` para cada, então `await loadGtData()`. Usar `uiAlert` de sucesso. Preservar ordem = ordem do catálogo (ou permitir arrastar numa 2ª etapa — YAGNI por ora).

- [ ] **Step 3: Guard de escrita**

Garantir que `_gtSaveConfig`/o botão só funcionam para admin (o gate visual + a policy/RPC do Task 3). Não confiar só no esconder-botão: a escrita no banco precisa da guarda server-side.

- [ ] **Step 4: Checar sintaxe** (comando do Task 1 Step 2). Expected: `sintaxe OK`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(gt): editor global (admin) das métricas por objetivo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Preview + validação com o Gerenciador do Meta

**Files:** push da branch `feat/gt-kpis-por-objetivo`.

- [ ] **Step 1: Push**

```bash
git push -u origin feat/gt-kpis-por-objetivo
```

- [ ] **Step 2: Validar no preview** (URL da branch na Vercel)

- Abrir a Gestão de Tráfego numa conta com campanhas de **objetivos diferentes**.
- Confirmar que campanha de **Tráfego** mostra CTR/CPC/Visitas/CPM e a de **Vendas** mostra ROAS/CAC/Valor de conversão/Compras.
- **Validar os números de venda contra o Gerenciador de Anúncios do Meta** (ROAS/valor de conversão) — mesma conta e período.
- Confirmar (DevTools → Network) que a resposta de insights traz `action_values`/`purchase_roas`; se não, ajustar a allowlist do `meta-proxy` (dependência do Task 2 Step 3).
- Testar o **editor** (como admin): mudar as métricas de um objetivo, salvar, recarregar, ver refletido; confirmar que **não-admin não vê/nem salva**.

- [ ] **Step 3: Métrica sem dado**

Confirmar que uma campanha de tráfego (sem compras) mostra `—` em Compras/ROAS, não `0`.

- [ ] **Step 4: Merge (após OK do usuário)**

Só depois da validação: merge `feat/gt-kpis-por-objetivo` → `main` (deploy de produção).

---

## Self-review (cobertura do spec)

- Catálogo (spec §3) → Task 1. Objetivo→balde+padrões (§4) → Task 1. Edição global (§5) → Tasks 3+5. Render (§6) → Task 4. +2 campos (§7) → Task 2. Critérios (§9) → Task 6 (validação). Riscos (§10): proxy → Task 2 Step 3/Task 6; aliases → `_gtActionVal`; objetivo desconhecido → `_gtBalde` fallback; guarda admin → Tasks 3+5 Step 3.
- Pendências a resolver na execução (dependem de ler o código existente): helper exato de escrita-admin (`sbAuthUpsert`/RPC) e o gate de admin (`isSuperAdmin`) — o implementador deve casar com o padrão real do projeto (grep indicado nos passos).
