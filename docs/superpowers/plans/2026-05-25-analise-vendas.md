# Análise de Vendas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vessel-sales-screen with a complete Sales Analysis module featuring Chart.js charts, KPI cards, per-store breakdowns, seller metrics, and positivação frequency grid.

**Architecture:** Single-file monolith (`central-inteligencia-v1.1.html`) — add CSS block, replace HTML section, replace and add JS functions. Two-phase data loading: Phase 1 fetches orders + Supabase metadata in parallel; Phase 2 fetches vendor mapping using order IDs from Phase 1. Client-side canal filter re-renders from cached `window._saRawData` without new Bling calls. All DOM manipulation via createElement/appendChild/textContent — no variable innerHTML.

**Tech Stack:** HTML/CSS/JS vanilla + Supabase JS v2 (`sbClient`) + Chart.js 4.4.4 (CDN) + XLSX (already loaded)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `projetos/central-inteligencia/central-inteligencia-v1.1.html` | Modify | CSS (after line 1057), Chart.js CDN (before line 1302), HTML vessel-sales-screen (lines 5173-5204), JS openVesselSales/closeVesselSales (lines 3772-3787), JS auto-cycle block (lines 4097-4131), JS loadVesselSalesData+renderVesselSales (lines 4219-4494+), loadAdminMetas call + new vendor-metas functions |
| `docs/migrations/004_vendedor_metas.sql` | Create | New Supabase table definition |

---

### Task 1: Create migration file and CSS + Chart.js CDN

**Files:**
- Create: `docs/migrations/004_vendedor_metas.sql`
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (lines 1057–1302 region)

- [ ] **Step 1: Create migration file**

```sql
-- docs/migrations/004_vendedor_metas.sql
-- Colar no Supabase Dashboard → SQL Editor → New query → Run
CREATE TABLE IF NOT EXISTS public.bling_vendedor_metas (
  vendor_id   bigint  NOT NULL,
  year        int     NOT NULL,
  month       int     NOT NULL,
  meta_valor  numeric,
  daily_goals jsonb,
  PRIMARY KEY (vendor_id, year, month)
);
```

- [ ] **Step 2: Find exact lines for Chart.js and CSS insertion**

Run:
```bash
grep -n "chart.js\|Chart\.js\|</head>\|vsales-body\|vsales-loading" projetos/central-inteligencia/central-inteligencia-v1.1.html | head -30
```

Note the line number of `</head>` and the line after `.vsales-loading` styles.

- [ ] **Step 3: Add Chart.js CDN before `</head>`**

Find the `</head>` tag in the file and insert before it:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
```

Use the Edit tool. The old_string should be `</head>` (verify it is unique — if not, use more context lines around it).

- [ ] **Step 4: Add SA CSS block after existing vsales CSS**

Find the end of the vsales CSS block (around line 1057 — look for `/* end vsales */` or the rule just before the next section comment). Insert after it:

```css
/* ── SALES ANALYSIS ── */
#sales-analysis-screen{display:none;flex-direction:column;height:100%;overflow:hidden;background:var(--bg)}
.sa-topbar{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--card);border-bottom:1px solid var(--border);flex-wrap:wrap}
.sa-back{background:none;border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px}
.sa-back:hover{background:var(--hover)}
.sa-brand-av{width:28px;height:28px;border-radius:50%;object-fit:cover}
.sa-brand-nm{font-size:13px;font-weight:600;color:var(--text)}
.sa-filters{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap}
.sa-canal-sel{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}
.sa-period-btns{display:flex;gap:4px}
.sa-pbtn{background:none;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;transition:all .15s}
.sa-pbtn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.sa-pbtn:hover:not(.active){background:var(--hover);color:var(--text)}
#sa-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px}
.sa-loading{color:var(--muted);font-size:13px;padding:32px;text-align:center}
.sa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.sa-kpi{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.sa-kpi-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.sa-kpi-val{font-size:18px;font-weight:700;color:var(--text)}
.sa-kpi-sub{font-size:11px;color:var(--muted)}
.sa-kpi-delta{font-size:11px;font-weight:600}
.sa-kpi-delta.good{color:#22c55e}
.sa-kpi-delta.warn{color:#f59e0b}
.sa-kpi-delta.bad{color:#ef4444}
.sa-section{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px}
.sa-section-title{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.sa-chart-wrap{position:relative;width:100%;height:220px}
.sa-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-chart-row .sa-chart-wrap{height:200px}
.sa-tab-row{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.sa-tab{background:none;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer}
.sa-tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.sa-summary-card{background:var(--hover);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--muted);margin-top:10px;display:flex;flex-wrap:wrap;gap:12px}
.sa-summary-card span{color:var(--text);font-weight:600}
.sa-loja-section{display:flex;flex-direction:column;gap:12px}
.sa-loja-title{font-size:13px;font-weight:700;color:var(--text)}
.sa-loja-table{width:100%;border-collapse:collapse;font-size:12px}
.sa-loja-table th{color:var(--muted);font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
.sa-loja-table td{padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top}
.sa-loja-table tr:last-child td{border-bottom:none}
.sa-pos-grid{display:grid;gap:2px;overflow-x:auto}
.sa-pos-row{display:contents}
.sa-pos-cell{padding:4px 6px;border-radius:4px;font-size:10px;text-align:center;white-space:nowrap;min-width:52px}
.sa-pos-cell.green{background:#22c55e22;color:#22c55e}
.sa-pos-cell.red{background:#ef444422;color:#ef4444}
.sa-pos-cell.header{background:none;color:var(--muted);font-weight:600}
.sa-pos-name{font-size:11px;color:var(--text);font-weight:600;padding:4px 8px;white-space:nowrap}
.sa-delta.good{color:#22c55e;font-weight:600}
.sa-delta.bad{color:#ef4444;font-weight:600}
.sa-delta.warn{color:#f59e0b;font-weight:600}
```

- [ ] **Step 5: Verify no errors introduced**

Run:
```bash
grep -c "sa-topbar\|sa-kpis\|sa-section\|sa-pos-grid" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 4+ matches (CSS definitions added)

- [ ] **Step 6: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html docs/migrations/004_vendedor_metas.sql
git commit -m "feat: add SA CSS + Chart.js CDN + vendedor_metas migration"
```

---

### Task 2: Replace vessel-sales HTML and update navigation references

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (lines 5150, 5172-5204, line 3337)

- [ ] **Step 1: Update sbrand-card onclick (line ~5150)**

Find:
```
onclick="openVesselSales()"
```
Replace with:
```
onclick="openSalesAnalysis()"
```

- [ ] **Step 2: Replace vessel-sales-screen HTML block**

Find the existing HTML block (lines 5172-5204):
```html
<!-- VESSEL SALES ANALYSIS -->
<div id="vessel-sales-screen" style="display:none">
  <div class="vsales-topbar">
```
(use enough context to make the old_string unique — include the closing `</div>` of the screen)

Replace the entire block from `<!-- VESSEL SALES ANALYSIS -->` through the closing `</div>` of `vessel-sales-screen` with:

```html
<!-- SALES ANALYSIS -->
<div id="sales-analysis-screen" style="display:none">
  <div class="sa-topbar">
    <button class="sa-back" onclick="closeSalesAnalysis()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Marcas
    </button>
    <img id="sa-brand-av" class="sa-brand-av" src="" alt="" onerror="this.style.display='none'">
    <span class="sa-brand-nm">Vessel · Análise de Vendas</span>
    <div class="sa-filters">
      <select id="sa-canal-select" class="sa-canal-sel" onchange="saSelectCanal(this.value)">
        <option value="">Todas as lojas</option>
      </select>
      <div class="sa-period-btns">
        <button class="sa-pbtn active" data-period="sofar" onclick="saSelectPeriod('sofar')">ATÉ AGORA</button>
        <button class="sa-pbtn" data-period="today" onclick="saSelectPeriod('today')">HOJE</button>
        <button class="sa-pbtn" data-period="7d" onclick="saSelectPeriod('7d')">7D</button>
        <button class="sa-pbtn" data-period="14d" onclick="saSelectPeriod('14d')">14D</button>
        <button class="sa-pbtn" data-period="month" onclick="saSelectPeriod('month')">MÊS</button>
      </div>
    </div>
  </div>
  <div id="sa-body"></div>
</div>
```

- [ ] **Step 3: Update session restore (line ~3337)**

Find:
```
else if(screen==='vessel-sales'){openSalesDashboard();setTimeout(()=>{openSalesBrandPicker();setTimeout(openVesselSales,0);},0);}
```
Replace with:
```
else if(screen==='sales-analysis'){openSalesDashboard();setTimeout(()=>{openSalesBrandPicker();setTimeout(openSalesAnalysis,0);},0);}
```

- [ ] **Step 4: Verify**

```bash
grep -n "vessel-sales\|openVesselSales\|closeVesselSales\|sales-analysis\|openSalesAnalysis" projetos/central-inteligencia/central-inteligencia-v1.1.html | grep -v "^.*:.*//\|vsales-"
```

Expected: only `sales-analysis` and `openSalesAnalysis` references (no remaining `vessel-sales-screen` or `openVesselSales` in non-CSS, non-comment lines).

- [ ] **Step 5: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: replace vessel-sales HTML with sales-analysis screen"
```

---

### Task 3: Replace openVesselSales/closeVesselSales and remove auto-cycle

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (lines 3772-3787, lines 4097-4131)

- [ ] **Step 1: Replace openVesselSales + closeVesselSales**

Find (lines 3772-3787):
```js
function openVesselSales(){
  document.getElementById('sales-brand-screen').style.display='none';
  document.getElementById('vessel-sales-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','vessel-sales');
  setHomeBgTheme('sales');
  const vesselImg=document.querySelector('#sbrand-vessel-img');
  if(vesselImg&&vesselImg.src)document.getElementById('vsales-brand-av').src=vesselImg.src;
  loadVesselSalesData('today');
  vsAutoStart();
}
function closeVesselSales(){
  vsAutoStop();
  document.getElementById('vessel-sales-screen').style.display='none';
  document.getElementById('sales-brand-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-brand');
}
```

Replace with:
```js
function openSalesAnalysis(){
  if(!hasPermission('module:sales:analise-vendas'))return;
  document.getElementById('sales-brand-screen').style.display='none';
  document.getElementById('sales-analysis-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-analysis');
  setHomeBgTheme('sales');
  const vesselImg=document.querySelector('#sbrand-vessel-img');
  if(vesselImg&&vesselImg.src)document.getElementById('sa-brand-av').src=vesselImg.src;
  loadSalesAnalysisData('sofar');
}
function closeSalesAnalysis(){
  if(window._saCharts){Object.values(window._saCharts).forEach(c=>{try{c.destroy();}catch(e){}});window._saCharts={};}
  document.getElementById('sales-analysis-screen').style.display='none';
  document.getElementById('sales-brand-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-brand');
}
```

- [ ] **Step 2: Remove vessel-sales auto-cycle block**

Find (lines 4097-4131):
```js
/* ── VESSEL-SALES AUTO-CYCLE ── */
const VS_AC_PERIODS=['today','1d','7d','14d','30d','month'];
const VS_AC_DURATION=25;
let _vsAcIdx=0,_vsAcTimer=null;

function vsSelectPeriod(p){loadVesselSalesData(p);}
```
(extend old_string to include all functions through `vsApplyCustom` closing brace)

Replace with:
```js
function saSelectPeriod(p){
  document.querySelectorAll('.sa-pbtn').forEach(b=>b.classList.toggle('active',b.dataset.period===p));
  loadSalesAnalysisData(p);
}
function saSelectCanal(lojaId){
  if(!window._saRawData)return;
  renderSalesAnalysis(window._saRawData,lojaId);
}
```

- [ ] **Step 3: Verify**

```bash
grep -n "vsSelectPeriod\|vsAutoStart\|vsAutoStop\|vsToggle\|vsApplyCustom\|VS_AC\|_vsAc" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 0 matches.

- [ ] **Step 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add openSalesAnalysis/closeSalesAnalysis, remove vessel-sales auto-cycle"
```

---

### Task 4: Replace loadVesselSalesData with loadSalesAnalysisData

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (lines 4219-4252 region)

Note: `loadVesselSalesData` starts at line ~4220 and ends at line ~4252. `renderVesselSales` follows and extends to ~4494+. Replace BOTH functions in this task with the new orchestrator. The render functions are added in Tasks 5-11.

- [ ] **Step 1: Find exact boundary of old functions**

```bash
grep -n "function loadVesselSalesData\|function renderVesselSales\|^\/\* ── GESTÃO À VISTA AUTO-CYCLE\|^\/\* ── VESSEL SALES ANALYSIS" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Note the line numbers. `loadVesselSalesData` starts at ~4220. `renderVesselSales` ends just before the `/* ── GESTÃO À VISTA AUTO-CYCLE ──` comment (or similar section boundary). Everything between those markers gets replaced.

- [ ] **Step 2: Replace loadVesselSalesData + renderVesselSales with new orchestrator**

The old_string should be everything from `/* ── VESSEL SALES ANALYSIS ── */` through the closing `}` of `renderVesselSales`, right before the next `/* ──` comment block.

Replace with:

```js
/* ── SALES ANALYSIS ── */
window._saCharts={};
window._saRawData=null;

async function loadSalesAnalysisData(period){
  document.querySelectorAll('.sa-pbtn').forEach(b=>b.classList.toggle('active',b.dataset.period===period));
  const body=document.getElementById('sa-body');
  body.textContent='';
  const loading=document.createElement('div');
  loading.className='sa-loading';
  loading.textContent='Carregando dados...';
  body.appendChild(loading);

  const now=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));
  const y=now.getFullYear(),m=now.getMonth()+1;
  const iso=d=>d.toISOString().slice(0,10);
  const pad=n=>String(n).padStart(2,'0');
  let di,df;
  if(period==='sofar'){di=`${y}-${pad(m)}-01`;df=iso(now);}
  else if(period==='today'){di=df=iso(now);}
  else if(period==='7d'){di=iso(new Date(now-7*864e5));df=iso(now);}
  else if(period==='14d'){di=iso(new Date(now-14*864e5));df=iso(now);}
  else if(period==='month'){di=`${y}-${pad(m)}-01`;df=new Date(y,m,0).toISOString().slice(0,10);}
  else{di=`${y}-${pad(m)}-01`;df=iso(now);}

  const spanMs=new Date(df)-new Date(di);
  const diPrev=iso(new Date(new Date(di)-spanMs-864e5));
  const dfPrev=iso(new Date(new Date(di)-864e5));

  const di15=iso(new Date(now-14*864e5));
  const df15=iso(now);

  try{
    const[pedidos,pedidosPrev,lojaMap,metasArr,vendedoresArr,pedidos15]=await Promise.all([
      blingPages('pedidos/vendas',{dataInicial:di,dataFinal:df,'idsSituacoes[]':9}),
      blingPages('pedidos/vendas',{dataInicial:diPrev,dataFinal:dfPrev,'idsSituacoes[]':9}).catch(()=>[]),
      sbClient.from('bling_lojas').select('loja_id,nome').order('loja_id').then(r=>{const mp={};(r.data||[]).forEach(l=>mp[l.loja_id]=l.nome);return mp;}),
      sbClient.from('bling_metas').select('loja_id,meta_valor,daily_goals').eq('year',y).eq('month',m).then(r=>r.data||[]),
      sbClient.from('bling_vendedores').select('vendor_id,nome').then(r=>r.data||[]),
      blingPages('pedidos/vendas',{dataInicial:di15,dataFinal:df15,'idsSituacoes[]':9}).catch(()=>[])
    ]);

    const allIds=[...new Set([...pedidos,...pedidosPrev,...pedidos15].map(p=>parseInt(p.id)))];
    let pvMap={};
    if(allIds.length){
      const pvArr=await sbClient.from('bling_pedido_vendedor').select('pedido_id,vendor_id').in('pedido_id',allIds.slice(0,500)).then(r=>r.data||[]);
      pvArr.forEach(r=>{pvMap[r.pedido_id]=r.vendor_id;});
    }

    const lojas=Object.entries(lojaMap).map(([id,nome])=>({id:parseInt(id),nome})).sort((a,b)=>a.id-b.id);
    const canalSel=document.getElementById('sa-canal-select');
    if(canalSel){
      canalSel.textContent='';
      const optAll=document.createElement('option');optAll.value='';optAll.textContent='Todas as lojas';canalSel.appendChild(optAll);
      lojas.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.nome;canalSel.appendChild(o);});
    }

    window._saRawData={pedidos,pedidosPrev,lojaMap,lojas,metasArr,vendedoresArr,pvMap,pedidos15,period,di,df,diPrev,dfPrev,di15,df15,now,y,m};
    renderSalesAnalysis(window._saRawData,'');
  }catch(e){
    body.textContent='';
    const err=document.createElement('div');err.className='sa-loading';err.textContent='Erro: '+e.message;body.appendChild(err);
  }
}

function renderSalesAnalysis(raw,lojaFilter){
  const{pedidos:allPedidos,pedidosPrev:allPrev,lojaMap,lojas,metasArr,vendedoresArr,pvMap,pedidos15,period,di,df,diPrev,dfPrev,di15,df15,now,y,m}=raw;
  const pedidos=lojaFilter?allPedidos.filter(p=>String(p.loja?.id)===String(lojaFilter)):allPedidos;
  const pedidosPrev=lojaFilter?allPrev.filter(p=>String(p.loja?.id)===String(lojaFilter)):allPrev;

  if(window._saCharts){Object.values(window._saCharts).forEach(c=>{try{c.destroy();}catch(e){}});window._saCharts={};}

  const body=document.getElementById('sa-body');
  body.textContent='';

  const diasMes=new Date(y,m,0).getDate();
  const dInicio=new Date(di+'T00:00:00');
  const dFim=new Date(df+'T00:00:00');
  const diasTot=Math.ceil((dFim-dInicio)/864e5)+1;
  const diasDec=Math.min(Math.ceil((now-dInicio)/864e5)+1,diasTot);

  const metasMap={};const dailyGoalsMap={};
  metasArr.forEach(r=>{
    if(!lojaFilter||String(r.loja_id)===String(lojaFilter)||r.loja_id===0){
      metasMap[r.loja_id]=parseFloat(r.meta_valor||0);
      if(r.daily_goals)dailyGoalsMap[r.loja_id]=r.daily_goals;
    }
  });
  const metaTotal=lojaFilter
    ?(metasMap[parseInt(lojaFilter)]||0)
    :(metasMap[0]>0?metasMap[0]:Object.entries(metasMap).filter(([k])=>k!=='0').reduce((s,[,v])=>s+v,0))||0;

  const calcMetaPeriodo=(lojaId)=>{
    let dg=lojaId===0?null:dailyGoalsMap[lojaId];
    if(lojaId===0){const mg={};Object.values(dailyGoalsMap).forEach(g=>{if(g)Object.entries(g).forEach(([d,v])=>mg[d]=(mg[d]||0)+Number(v||0));});if(Object.keys(mg).length)dg=mg;}
    if(dg&&di.slice(0,7)===df.slice(0,7)){const d1=parseInt(di.slice(8)),d2=parseInt(df.slice(8));let s=0;for(let d=d1;d<=d2;d++)s+=Number(dg[String(d)]||0);if(s>0)return s;}
    return lojaId===0?metaTotal/diasMes*diasTot:(metasMap[lojaId]||0)/diasMes*diasTot;
  };

  const metaPeriodo=calcMetaPeriodo(0);

  body.appendChild(renderSAKpis({pedidos,pedidosPrev,metaPeriodo,diasMes,diasTot,diasDec,now,y,m,dailyGoalsMap,metasMap,period}));
  body.appendChild(renderSACanal({pedidos,pedidosPrev,lojas,lojaMap,metasMap,dailyGoalsMap,di,df,diasMes,diasTot}));
  body.appendChild(renderSADiario({pedidos,di,df,diasTot,dailyGoalsMap,metaTotal,diasMes}));
  body.appendChild(renderSATicket({pedidos,pedidosPrev,lojas,lojaMap}));
  body.appendChild(renderSADesconto({pedidos,lojas,lojaMap}));
  body.appendChild(renderSAVendedoras({pedidos,vendedoresArr,pvMap,lojaMap}));
  lojas.forEach(loja=>{
    if(lojaFilter&&String(loja.id)!==String(lojaFilter))return;
    body.appendChild(renderSALojaSection({loja,pedidos:allPedidos,pedidosPrev:allPrev,vendedoresArr,pvMap,metasArr,now,y,m,pedidos15,di15,df15}));
  });
}
```

- [ ] **Step 3: Verify syntax**

```bash
grep -n "function loadSalesAnalysisData\|function renderSalesAnalysis\|function loadVesselSalesData\|function renderVesselSales" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: only `loadSalesAnalysisData` and `renderSalesAnalysis` (no old functions).

- [ ] **Step 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add loadSalesAnalysisData + renderSalesAnalysis orchestrators"
```

---

### Task 5: Add renderSAKpis function

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSalesAnalysis closing brace)

- [ ] **Step 1: Add renderSAKpis after renderSalesAnalysis**

Find the end of `renderSalesAnalysis` (closing `}`) and insert after it:

```js
function renderSAKpis({pedidos,pedidosPrev,metaPeriodo,diasMes,diasTot,diasDec,now,y,m,dailyGoalsMap,metasMap,period}){
  const total=pedidos.reduce((s,p)=>s+parseFloat(p.total||0),0);
  const totalPrev=pedidosPrev.reduce((s,p)=>s+parseFloat(p.total||0),0);
  const n=pedidos.length;
  const totalItens=pedidos.reduce((s,p)=>s+(p.itens?.reduce((si,i)=>si+(parseFloat(i.quantidade)||1),0)||1),0);
  const multiItem=pedidos.filter(p=>(p.itens?.length||0)>=2).length;
  const pct=metaPeriodo>0?Math.round(total/metaPeriodo*100):null;
  const proj=diasDec>0?(total/diasDec)*diasTot:0;
  const hoje=now.toISOString().slice(0,10);
  const hojeDayNum=now.getDate();
  let metaHoje=0;let hasDaily=false;
  Object.values(dailyGoalsMap).forEach(dg=>{if(dg&&dg[String(hojeDayNum)]!=null){metaHoje+=Number(dg[String(hojeDayNum)]||0);hasDaily=true;}});
  if(!hasDaily&&metaPeriodo>0)metaHoje=metaPeriodo/diasTot;

  const pctCls=pct===null?'':(pct>=100?'good':pct>=85?'warn':'bad');
  const deltaTotal=totalPrev>0?((total-totalPrev)/totalPrev*100):null;
  const mediaItens=n>0?totalItens/n:0;
  const mediaItensPrev=pedidosPrev.length>0?pedidosPrev.reduce((s,p)=>s+(p.itens?.reduce((si,i)=>si+(parseFloat(i.quantidade)||1),0)||1),0)/pedidosPrev.length:0;
  const multiPct=n>0?Math.round(multiItem/n*100):0;
  const multiPrev=pedidosPrev.length>0?Math.round(pedidosPrev.filter(p=>(p.itens?.length||0)>=2).length/pedidosPrev.length*100):0;

  const sec=document.createElement('div');sec.className='sa-kpis';

  const kpis=[
    {label:'Venda Realizada',val:fmtR(total),delta:deltaTotal!=null?`${deltaTotal>=0?'+':''}${deltaTotal.toFixed(1)}% vs ant.`:null,cls:deltaTotal!=null?(deltaTotal>=0?'good':'bad'):null},
    {label:'Meta Total',val:metaPeriodo>0?fmtR(metaPeriodo):'—',delta:null,cls:null},
    {label:'% Atingido',val:pct!=null?pct+'%':'—',delta:null,cls:pctCls},
    {label:'Projeção Mês',val:fmtR(proj),delta:metaPeriodo>0?`${proj>=metaPeriodo?'+':''}${((proj/metaPeriodo-1)*100).toFixed(1)}% vs meta`:null,cls:metaPeriodo>0?(proj>=metaPeriodo?'good':'bad'):null},
    {label:'Meta Hoje',val:fmtR(metaHoje),delta:null,cls:null},
    {label:'Média Itens/Venda',val:mediaItens.toFixed(1),delta:mediaItensPrev>0?`${((mediaItens-mediaItensPrev)/mediaItensPrev*100)>=0?'+':''}${((mediaItens-mediaItensPrev)/mediaItensPrev*100).toFixed(1)}% vs ant.`:null,cls:mediaItensPrev>0?(mediaItens>=mediaItensPrev?'good':'bad'):null},
    {label:'Vendas +1 Item',val:multiPct+'%',delta:multiPrev>0?`${multiPct-multiPrev>=0?'+':''}${multiPct-multiPrev}pp vs ant.`:null,cls:multiPrev>0?(multiPct>=multiPrev?'good':'bad'):null}
  ];

  kpis.forEach(k=>{
    const card=document.createElement('div');card.className='sa-kpi';
    const lbl=document.createElement('div');lbl.className='sa-kpi-label';lbl.textContent=k.label;
    const val=document.createElement('div');val.className='sa-kpi-val';val.textContent=k.val;
    card.appendChild(lbl);card.appendChild(val);
    if(k.delta){const d=document.createElement('div');d.className='sa-kpi-delta'+(k.cls?' '+k.cls:'');d.textContent=k.delta;card.appendChild(d);}
    sec.appendChild(card);
  });
  return sec;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderSAKpis" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSAKpis function"
```

---

### Task 6: Add renderSACanal (grouped bar chart by store)

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSAKpis)

- [ ] **Step 1: Add renderSACanal**

```js
function renderSACanal({pedidos,pedidosPrev,lojas,lojaMap,metasMap,dailyGoalsMap,di,df,diasMes,diasTot}){
  const sec=document.createElement('div');sec.className='sa-section';
  const title=document.createElement('div');title.className='sa-section-title';title.textContent='Desdobramento por Canal';
  const wrap=document.createElement('div');wrap.className='sa-chart-wrap';
  const canvas=document.createElement('canvas');wrap.appendChild(canvas);
  sec.appendChild(title);sec.appendChild(wrap);

  const labels=lojas.map(l=>l.nome);
  const realizado=lojas.map(l=>pedidos.filter(p=>String(p.loja?.id)===String(l.id)).reduce((s,p)=>s+parseFloat(p.total||0),0));
  const anterior=lojas.map(l=>pedidosPrev.filter(p=>String(p.loja?.id)===String(l.id)).reduce((s,p)=>s+parseFloat(p.total||0),0));
  const meta=lojas.map(l=>{
    const dg=dailyGoalsMap[l.id];
    if(dg&&di.slice(0,7)===df.slice(0,7)){const d1=parseInt(di.slice(8)),d2=parseInt(df.slice(8));let s=0;for(let d=d1;d<=d2;d++)s+=Number(dg[String(d)]||0);if(s>0)return s;}
    return(metasMap[l.id]||0)/diasMes*diasTot;
  });

  window._saCharts=window._saCharts||{};
  window._saCharts.canal=new Chart(canvas,{
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Realizado',data:realizado,backgroundColor:'rgba(var(--accent-rgb,99,102,241),0.8)',borderRadius:4},
        {label:'Meta',data:meta,backgroundColor:'rgba(180,180,180,0.3)',borderColor:'rgba(180,180,180,0.6)',borderWidth:1,borderDash:[4,4],type:'bar',borderRadius:4},
        {label:'Anterior',data:anterior,backgroundColor:'rgba(var(--accent-rgb,99,102,241),0.25)',borderRadius:4}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>{const i=ctx.dataIndex;const r=realizado[i],mt=meta[i],ant=anterior[i];if(ctx.datasetIndex===0)return[`Realizado: ${fmtR(r)}`,`Meta: ${fmtR(mt)}`,`Desvio: ${fmtR(r-mt)} (${mt>0?((r/mt-1)*100).toFixed(1):'—'}%)`,`Anterior: ${fmtR(ant)}`,`Δ vs ant: ${ant>0?((r/ant-1)*100).toFixed(1)+'%':'—'}`];return null;}}}
      },
      scales:{y:{ticks:{callback:v=>fmtR0(v)},grid:{color:'rgba(128,128,128,0.1)'}},x:{grid:{display:false}}}
    }
  });
  return sec;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderSACanal" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSACanal grouped bar chart"
```

---

### Task 7: Add renderSADiario, renderSATicket, renderSADesconto

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSACanal)

- [ ] **Step 1: Add renderSADiario (line chart with area)**

```js
function renderSADiario({pedidos,di,df,diasTot,dailyGoalsMap,metaTotal,diasMes}){
  const sec=document.createElement('div');sec.className='sa-section';
  const title=document.createElement('div');title.className='sa-section-title';title.textContent='Visão Diária';
  const wrap=document.createElement('div');wrap.className='sa-chart-wrap';
  const canvas=document.createElement('canvas');wrap.appendChild(canvas);
  sec.appendChild(title);sec.appendChild(wrap);

  const dates=[];const d=new Date(di+'T00:00:00');const end=new Date(df+'T00:00:00');
  while(d<=end){dates.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}

  const vendido=dates.map(dt=>pedidos.filter(p=>p.data?.slice(0,10)===dt).reduce((s,p)=>s+parseFloat(p.total||0),0));
  const metaDia=dates.map(dt=>{
    const dayNum=parseInt(dt.slice(8));
    let s=0;let has=false;
    Object.values(dailyGoalsMap).forEach(dg=>{if(dg&&dg[String(dayNum)]!=null){s+=Number(dg[String(dayNum)]||0);has=true;}});
    return has?s:(metaTotal>0?metaTotal/diasMes:null);
  });

  const labels=dates.map(dt=>dt.slice(8)+'/'+dt.slice(5,7));
  window._saCharts=window._saCharts||{};
  window._saCharts.diario=new Chart(canvas,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Vendido',data:vendido,borderColor:'rgba(99,102,241,1)',backgroundColor:'rgba(99,102,241,0.15)',fill:true,tension:0.3,pointRadius:3},
        {label:'Meta',data:metaDia,borderColor:'rgba(180,180,180,0.7)',borderDash:[5,5],fill:false,tension:0.3,pointRadius:0}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:ctx=>{const i=ctx.dataIndex;const v=vendido[i],mt=metaDia[i];if(ctx.datasetIndex===0)return[`Vendido: ${fmtR(v)}`,`Meta: ${mt!=null?fmtR(mt):'—'}`,`Desvio: ${mt!=null?fmtR(v-mt)+' ('+(mt>0?((v/mt-1)*100).toFixed(1):'—')+'%)':'—'}`];return null;}}}},
      scales:{y:{ticks:{callback:v=>fmtR0(v)},grid:{color:'rgba(128,128,128,0.1)'}},x:{grid:{display:false},ticks:{maxRotation:45,font:{size:10}}}}
    }
  });
  return sec;
}
```

- [ ] **Step 2: Add renderSATicket (grouped bars by store)**

```js
function renderSATicket({pedidos,pedidosPrev,lojas,lojaMap}){
  const sec=document.createElement('div');sec.className='sa-section';
  const title=document.createElement('div');title.className='sa-section-title';title.textContent='Comparativo de Ticket Médio';
  const wrap=document.createElement('div');wrap.className='sa-chart-wrap';
  const canvas=document.createElement('canvas');wrap.appendChild(canvas);
  sec.appendChild(title);sec.appendChild(wrap);

  const labels=lojas.map(l=>l.nome);
  const ticketAtual=lojas.map(l=>{const pp=pedidos.filter(p=>String(p.loja?.id)===String(l.id));return pp.length>0?pp.reduce((s,p)=>s+parseFloat(p.total||0),0)/pp.length:0;});
  const ticketAnt=lojas.map(l=>{const pp=pedidosPrev.filter(p=>String(p.loja?.id)===String(l.id));return pp.length>0?pp.reduce((s,p)=>s+parseFloat(p.total||0),0)/pp.length:0;});

  window._saCharts=window._saCharts||{};
  window._saCharts.ticket=new Chart(canvas,{
    type:'bar',
    data:{labels,datasets:[
      {label:'Atual',data:ticketAtual,backgroundColor:'rgba(99,102,241,0.8)',borderRadius:4},
      {label:'Anterior',data:ticketAnt,backgroundColor:'rgba(99,102,241,0.25)',borderRadius:4}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:ctx=>{const i=ctx.dataIndex;if(ctx.datasetIndex===0)return[`Atual: ${fmtR(ticketAtual[i])}`,`Anterior: ${fmtR(ticketAnt[i])}`,`Δ: ${ticketAnt[i]>0?((ticketAtual[i]/ticketAnt[i]-1)*100).toFixed(1)+'%':'—'}`];return null;}}}},
      scales:{y:{ticks:{callback:v=>fmtR0(v)},grid:{color:'rgba(128,128,128,0.1)'}},x:{grid:{display:false}}}
    }
  });
  return sec;
}
```

- [ ] **Step 3: Add renderSADesconto (donut + stacked bars side by side)**

```js
function renderSADesconto({pedidos,lojas,lojaMap}){
  const sec=document.createElement('div');sec.className='sa-section';
  const title=document.createElement('div');title.className='sa-section-title';title.textContent='Vendas com vs Sem Desconto';
  const row=document.createElement('div');row.className='sa-chart-row';

  const wrapD=document.createElement('div');wrapD.className='sa-chart-wrap';
  const canvasD=document.createElement('canvas');wrapD.appendChild(canvasD);
  const wrapB=document.createElement('div');wrapB.className='sa-chart-wrap';
  const canvasB=document.createElement('canvas');wrapB.appendChild(canvasB);
  row.appendChild(wrapD);row.appendChild(wrapB);
  sec.appendChild(title);sec.appendChild(row);

  const comDesc=pedidos.filter(p=>parseFloat(p.desconto||0)>0);
  const semDesc=pedidos.filter(p=>!(parseFloat(p.desconto||0)>0));
  const totalCom=comDesc.reduce((s,p)=>s+parseFloat(p.total||0),0);
  const totalSem=semDesc.reduce((s,p)=>s+parseFloat(p.total||0),0);

  window._saCharts=window._saCharts||{};
  window._saCharts.descontoDonut=new Chart(canvasD,{
    type:'doughnut',
    data:{labels:['Com Desconto','Sem Desconto'],datasets:[{data:[comDesc.length,semDesc.length],backgroundColor:['rgba(239,68,68,0.8)','rgba(34,197,94,0.8)']}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:ctx=>{const n=ctx.raw;const tot=pedidos.length;const r=ctx.datasetIndex===0?(ctx.dataIndex===0?totalCom:totalSem):0;return[`${n} pedidos (${tot>0?(n/tot*100).toFixed(1):'0'}%)`,`${fmtR(ctx.dataIndex===0?totalCom:totalSem)}`];}}}}}
  });

  const labelsB=lojas.map(l=>l.nome);
  const comB=lojas.map(l=>pedidos.filter(p=>String(p.loja?.id)===String(l.id)&&parseFloat(p.desconto||0)>0).reduce((s,p)=>s+parseFloat(p.total||0),0));
  const semB=lojas.map(l=>pedidos.filter(p=>String(p.loja?.id)===String(l.id)&&!(parseFloat(p.desconto||0)>0)).reduce((s,p)=>s+parseFloat(p.total||0),0));

  window._saCharts.descontoBar=new Chart(canvasB,{
    type:'bar',
    data:{labels:labelsB,datasets:[
      {label:'Com Desconto',data:comB,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:4},
      {label:'Sem Desconto',data:semB,backgroundColor:'rgba(34,197,94,0.7)',borderRadius:4}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:ctx=>{const i=ctx.dataIndex;const tot=comB[i]+semB[i];return[`Com Desconto: ${fmtR(comB[i])}`,`Sem Desconto: ${fmtR(semB[i])}`,`% com desc: ${tot>0?(comB[i]/tot*100).toFixed(1)+'%':'—'}`];}}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>fmtR0(v)},grid:{color:'rgba(128,128,128,0.1)'}}}
    }
  });
  return sec;
}
```

- [ ] **Step 4: Verify**

```bash
grep -n "function renderSADiario\|function renderSATicket\|function renderSADesconto" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 3 matches.

- [ ] **Step 5: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSADiario, renderSATicket, renderSADesconto charts"
```

---

### Task 8: Add renderSAVendedoras (horizontal bar + tabs + summary)

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSADesconto)

- [ ] **Step 1: Add renderSAVendedoras**

```js
function renderSAVendedoras({pedidos,vendedoresArr,pvMap,lojaMap}){
  const sec=document.createElement('div');sec.className='sa-section';
  const title=document.createElement('div');title.className='sa-section-title';title.textContent='Vendedoras';
  sec.appendChild(title);

  const tabs=['Vendas (R$)','Qtd Cupons','Ticket Médio','% 2+ Itens','% Desconto'];
  const tabRow=document.createElement('div');tabRow.className='sa-tab-row';
  const wrap=document.createElement('div');wrap.className='sa-chart-wrap';wrap.style.height='260px';
  const canvas=document.createElement('canvas');wrap.appendChild(canvas);
  sec.appendChild(tabRow);sec.appendChild(wrap);

  const stats={};
  vendedoresArr.forEach(v=>{stats[v.vendor_id]={nome:v.nome,vendas:0,cupons:0,itens:0,desc:0};});
  pedidos.forEach(p=>{
    const vid=pvMap[parseInt(p.id)];if(!vid)return;
    if(!stats[vid])stats[vid]={nome:'ID '+vid,vendas:0,cupons:0,itens:0,desc:0};
    const s=stats[vid];
    s.vendas+=parseFloat(p.total||0);
    s.cupons++;
    s.itens+=(p.itens?.reduce((si,i)=>si+(parseFloat(i.quantidade)||1),0)||1);
    if(parseFloat(p.desconto||0)>0)s.desc++;
  });

  const vends=Object.entries(stats).filter(([,s])=>s.cupons>0).sort((a,b)=>b[1].vendas-a[1].vendas).map(([id,s])=>({id,nome:s.nome,vendas:s.vendas,cupons:s.cupons,ticket:s.cupons>0?s.vendas/s.cupons:0,multi:s.cupons>0?pedidos.filter(p=>pvMap[parseInt(p.id)]==id&&(p.itens?.length||0)>=2).length/s.cupons*100:0,desc:s.cupons>0?s.desc/s.cupons*100:0}));

  const metrics=[
    vends.map(v=>v.vendas),
    vends.map(v=>v.cupons),
    vends.map(v=>v.ticket),
    vends.map(v=>parseFloat(v.multi.toFixed(1))),
    vends.map(v=>parseFloat(v.desc.toFixed(1)))
  ];
  const fmtMetric=(i,val)=>i===0?fmtR(val):i===2?fmtR(val):i>=3?val.toFixed(1)+'%':String(val);

  let activeTab=0;
  let chart=null;

  const buildChart=()=>{
    if(chart){try{chart.destroy();}catch(e){}}
    chart=new Chart(canvas,{
      type:'bar',
      data:{labels:vends.map(v=>v.nome),datasets:[{label:tabs[activeTab],data:metrics[activeTab],backgroundColor:'rgba(99,102,241,0.75)',borderRadius:4}]},
      options:{
        indexAxis:'y',responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>{const i=ctx.dataIndex;const v=vends[i];return[`Vendas: ${fmtR(v.vendas)}`,`Cupons: ${v.cupons}`,`Ticket: ${fmtR(v.ticket)}`,`2+ itens: ${v.multi.toFixed(1)}%`,`Desconto: ${v.desc.toFixed(1)}%`];}}}
        },
        scales:{x:{ticks:{callback:(val)=>activeTab===0||activeTab===2?fmtR0(val):activeTab>=3?val+'%':String(val)},grid:{color:'rgba(128,128,128,0.1)'}},y:{grid:{display:false}}}
      }
    });
    window._saCharts=window._saCharts||{};
    window._saCharts.vendedoras=chart;
  };

  tabs.forEach((t,i)=>{
    const btn=document.createElement('button');btn.className='sa-tab'+(i===0?' active':'');btn.textContent=t;
    btn.addEventListener('click',()=>{activeTab=i;tabRow.querySelectorAll('.sa-tab').forEach((b,j)=>b.classList.toggle('active',j===i));buildChart();});
    tabRow.appendChild(btn);
  });

  buildChart();

  const totalVendas=vends.reduce((s,v)=>s+v.vendas,0);
  const totalCupons=vends.reduce((s,v)=>s+v.cupons,0);
  const ticketGeral=totalCupons>0?totalVendas/totalCupons:0;
  const pctMulti=pedidos.length>0?pedidos.filter(p=>(p.itens?.length||0)>=2).length/pedidos.length*100:0;
  const pctDesc=pedidos.length>0?pedidos.filter(p=>parseFloat(p.desconto||0)>0).length/pedidos.length*100:0;

  const sumCard=document.createElement('div');sumCard.className='sa-summary-card';
  const parts=[
    ['Total vendido',fmtR(totalVendas)],
    ['Cupons',String(totalCupons)],
    ['Ticket médio',fmtR(ticketGeral)],
    ['2+ itens',pctMulti.toFixed(1)+'%'],
    ['Com desconto',pctDesc.toFixed(1)+'%']
  ];
  parts.forEach(([lbl,val])=>{const sp=document.createElement('span');sp.textContent=lbl+': ';const vsp=document.createElement('span');vsp.textContent=val;sumCard.appendChild(sp);sumCard.appendChild(vsp);const sep=document.createTextNode(' ');sumCard.appendChild(sep);});
  sec.appendChild(sumCard);
  return sec;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderSAVendedoras" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSAVendedoras with tabs + summary"
```

---

### Task 9: Add renderSALojaSection and renderSALojaTable

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSAVendedoras)

- [ ] **Step 1: Add renderSALojaSection + renderSALojaTable**

```js
function renderSALojaSection({loja,pedidos,pedidosPrev,vendedoresArr,pvMap,metasArr,now,y,m,pedidos15,di15,df15}){
  const sec=document.createElement('div');sec.className='sa-section sa-loja-section';
  const t=document.createElement('div');t.className='sa-section-title sa-loja-title';t.textContent=loja.nome;
  sec.appendChild(t);
  sec.appendChild(renderSALojaTable({loja,pedidos,vendedoresArr,pvMap,metasArr,now,y,m}));
  sec.appendChild(renderSAPositivacao({loja,pedidos15,vendedoresArr,pvMap,di15,df15,now}));
  return sec;
}

function renderSALojaTable({loja,pedidos,vendedoresArr,pvMap,metasArr,now,y,m}){
  const hoje=now.toISOString().slice(0,10);
  const ontem=new Date(now-864e5).toISOString().slice(0,10);
  const diaSem=new Date(now-6*864e5).toISOString().slice(0,10);
  const diaMes=`${y}-${String(m).padStart(2,'0')}-01`;

  const metaLoja=metasArr.find(r=>r.loja_id===loja.id)||null;
  const dg=metaLoja?.daily_goals||null;
  const diasMes=new Date(y,m,0).getDate();
  const metaVal=parseFloat(metaLoja?.meta_valor||0);

  const getMetaDia=(dt)=>{const dn=parseInt(dt.slice(8));return dg&&dg[String(dn)]!=null?Number(dg[String(dn)]):metaVal/diasMes;};
  const getMetaWeek=()=>{if(!dg)return metaVal/diasMes*7;let s=0;for(let i=0;i<7;i++){const d=new Date(now-i*864e5);s+=Number(dg[String(d.getDate())]||metaVal/diasMes);}return s;};
  const metaMes=metaVal;

  const lojaPedidos=pedidos.filter(p=>String(p.loja?.id)===String(loja.id));
  const vendStats=vendedoresArr.map(v=>{
    const vid=v.vendor_id;
    const mine=lojaPedidos.filter(p=>pvMap[parseInt(p.id)]===vid);
    const mHoje=mine.filter(p=>p.data?.slice(0,10)===hoje).reduce((s,p)=>s+parseFloat(p.total||0),0);
    const mOntem=mine.filter(p=>p.data?.slice(0,10)===ontem).reduce((s,p)=>s+parseFloat(p.total||0),0);
    const mSem=mine.filter(p=>p.data?.slice(0,10)>=diaSem).reduce((s,p)=>s+parseFloat(p.total||0),0);
    const mMes=mine.reduce((s,p)=>s+parseFloat(p.total||0),0);
    return{nome:v.nome,mHoje,mOntem,mSem,mMes};
  }).filter(v=>v.mMes>0).sort((a,b)=>b.mMes-a.mMes);

  const wrap=document.createElement('div');wrap.style.overflowX='auto';
  const tbl=document.createElement('table');tbl.className='sa-loja-table';

  const thead=document.createElement('thead');
  const hr=document.createElement('tr');
  ['Vendedora','Hoje Vend.','Hoje Meta','Hoje Falt.','Ontem Vend.','Ontem Meta','Ontem Falt.','Sem. Vend.','Sem. Meta','Sem. Falt.','Mês Vend.','Mês Meta','Mês Falt.'].forEach(h=>{const th=document.createElement('th');th.textContent=h;hr.appendChild(th);});
  thead.appendChild(hr);tbl.appendChild(thead);

  const tbody=document.createElement('tbody');
  const metaH=getMetaDia(hoje);
  const metaO=getMetaDia(ontem);
  const metaW=getMetaWeek();

  vendStats.forEach(v=>{
    const tr=document.createElement('tr');
    const addCell=(val,isMeta,diff)=>{
      const td=document.createElement('td');
      td.textContent=fmtR(val);
      if(diff!=null){td.style.color=diff<=0?'#22c55e':'#ef4444';}
      tr.appendChild(td);
    };
    const nm=document.createElement('td');nm.textContent=v.nome;tr.appendChild(nm);
    addCell(v.mHoje);addCell(metaH);addCell(v.mHoje-metaH,false,v.mHoje-metaH);
    addCell(v.mOntem);addCell(metaO);addCell(v.mOntem-metaO,false,v.mOntem-metaO);
    addCell(v.mSem);addCell(metaW/vendStats.length);addCell(v.mSem-metaW/vendStats.length,false,v.mSem-metaW/vendStats.length);
    addCell(v.mMes);addCell(metaMes/vendStats.length);addCell(v.mMes-metaMes/vendStats.length,false,v.mMes-metaMes/vendStats.length);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderSALojaSection\|function renderSALojaTable" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 2 matches.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSALojaSection and renderSALojaTable"
```

---

### Task 10: Add renderSAPositivacao (15-day frequency grid)

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (add after renderSALojaTable)

- [ ] **Step 1: Add renderSAPositivacao**

```js
function renderSAPositivacao({loja,pedidos15,vendedoresArr,pvMap,di15,df15,now}){
  const dias=[];const d=new Date(di15+'T00:00:00');const end=new Date(df15+'T00:00:00');
  while(d<=end){dias.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}

  const lojaPed=pedidos15.filter(p=>String(p.loja?.id)===String(loja.id));
  const vendCom=vendedoresArr.filter(v=>lojaPed.some(p=>pvMap[parseInt(p.id)]===v.vendor_id));

  const wrap=document.createElement('div');
  const posTitle=document.createElement('div');posTitle.className='sa-section-title';posTitle.style.marginBottom='8px';posTitle.textContent='Frequência de Positivação — 15 dias';
  wrap.appendChild(posTitle);

  if(!vendCom.length){
    const empty=document.createElement('div');empty.style.cssText='color:var(--muted);font-size:12px';empty.textContent='Sem vendas nos últimos 15 dias.';
    wrap.appendChild(empty);return wrap;
  }

  const WEEK_NAMES=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:auto repeat('+dias.length+',1fr);gap:3px;overflow-x:auto';

  const empty=document.createElement('div');grid.appendChild(empty);
  dias.forEach(dt=>{
    const hd=document.createElement('div');hd.className='sa-pos-cell header';
    const dd=new Date(dt+'T12:00:00');
    hd.textContent=WEEK_NAMES[dd.getDay()]+' '+dd.getDate();
    grid.appendChild(hd);
  });

  vendCom.forEach(v=>{
    const nm=document.createElement('div');nm.className='sa-pos-name';nm.textContent=v.nome.split(' ')[0];grid.appendChild(nm);
    dias.forEach(dt=>{
      const dayPed=lojaPed.filter(p=>p.data?.slice(0,10)===dt&&pvMap[parseInt(p.id)]===v.vendor_id);
      const cell=document.createElement('div');cell.className='sa-pos-cell '+(dayPed.length>0?'green':'red');
      cell.textContent=dayPed.length>0?fmtR0(dayPed.reduce((s,p)=>s+parseFloat(p.total||0),0)):'—';
      grid.appendChild(cell);
    });
  });

  wrap.appendChild(grid);
  return wrap;
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderSAPositivacao" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add renderSAPositivacao 15-day grid"
```

---

### Task 11: Add vendor metas admin functions and extend loadAdminMetas

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` (lines 2920-2953 region and after downloadMetasTemplate)

- [ ] **Step 1: Add loadAdminVendMetas call at end of loadAdminMetas**

Find the closing `}` of `loadAdminMetas` function (line ~2953, the line with `body.innerHTML=html;` is near the end). Add a call to the new function at the very end of `loadAdminMetas`, just before the closing `}`:

Find this closing pattern of `loadAdminMetas`:
```js
  body.innerHTML=html;
}
```

Replace with:
```js
  body.innerHTML=html;
  await loadAdminVendMetas(body,y,m,mesLabel);
}
```

- [ ] **Step 2: Add loadAdminVendMetas after loadAdminMetas closing brace**

Find the end of `importMetasCSV` (around line 3026) and add after it:

```js
async function loadAdminVendMetas(parentBody,y,m,mesLabel){
  const[vendsRes,vendMetasRes]=await Promise.all([
    sbClient.from('bling_vendedores').select('vendor_id,nome').order('nome'),
    sbClient.from('bling_vendedor_metas').select('vendor_id,meta_valor').eq('year',y).eq('month',m)
  ]);
  const vends=vendsRes.data||[];
  const vendMetasMap={};(vendMetasRes.data||[]).forEach(r=>vendMetasMap[r.vendor_id]=r.meta_valor);
  const diasMes=new Date(y,m,0).getDate();
  const hasVendData=Object.keys(vendMetasMap).length>0;

  const sec=document.createElement('div');sec.style.marginTop='32px';
  const hdr=document.createElement('div');hdr.className='sg-label';hdr.textContent='METAS DE VENDEDORAS';
  sec.appendChild(hdr);

  const desc=document.createElement('div');desc.className='admin-section-sub';desc.style.marginBottom='20px';
  desc.textContent='Baixe o template, preencha as metas diárias por vendedora e importe.';
  sec.appendChild(desc);

  const btnRow=document.createElement('div');btnRow.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:24px';

  const dlBtn=document.createElement('button');dlBtn.className='admin-btn-sm';dlBtn.style.cssText='display:flex;align-items:center;gap:6px;padding:8px 16px';dlBtn.textContent='Baixar template .xlsx';
  dlBtn.addEventListener('click',()=>downloadVendedoresTemplate());
  btnRow.appendChild(dlBtn);

  const label=document.createElement('label');label.className='admin-btn-sm';label.style.cssText='display:flex;align-items:center;gap:6px;padding:8px 16px;cursor:pointer;background:var(--accent);color:#fff;border-color:var(--accent)';
  label.textContent='Importar planilha';
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.xlsx,.xls,.csv';fileInput.style.display='none';fileInput.id='vend-metas-csv-input';
  fileInput.addEventListener('change',function(){importVendedoresCSV(this,y,m);});
  label.appendChild(fileInput);
  btnRow.appendChild(label);
  sec.appendChild(btnRow);

  const msgEl=document.createElement('div');msgEl.id='vend-metas-import-msg';msgEl.style.cssText='font-size:12px;margin-bottom:16px;display:none';
  sec.appendChild(msgEl);

  if(hasVendData){
    const tblTitle=document.createElement('div');tblTitle.className='sg-label';tblTitle.textContent='Metas actuais — '+mesLabel;sec.appendChild(tblTitle);
    const sg=document.createElement('div');sg.className='sg';
    const tbl=document.createElement('table');tbl.className='metas-tbl';
    const thead=document.createElement('thead');
    const hr=document.createElement('tr');
    ['Vendedora','Meta (R$)','Meta/dia'].forEach(h=>{const th=document.createElement('th');th.textContent=h;hr.appendChild(th);});
    thead.appendChild(hr);tbl.appendChild(thead);
    const tbody=document.createElement('tbody');
    vends.filter(v=>vendMetasMap[v.vendor_id]).forEach(v=>{
      const tr=document.createElement('tr');
      const nm=document.createElement('td');nm.textContent=v.nome;tr.appendChild(nm);
      const mv=document.createElement('td');mv.style.textAlign='right';mv.textContent=fmtR(vendMetasMap[v.vendor_id]);tr.appendChild(mv);
      const md=document.createElement('td');md.style.cssText='text-align:right;color:var(--muted)';md.textContent=fmtR(vendMetasMap[v.vendor_id]/diasMes);tr.appendChild(md);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);sg.appendChild(tbl);sec.appendChild(sg);
  }else{
    const empty=document.createElement('div');empty.style.cssText='color:var(--muted);font-size:12px;padding:8px 0';empty.textContent='Nenhuma meta de vendedora para este mês.';sec.appendChild(empty);
  }
  parentBody.appendChild(sec);
}

async function downloadVendedoresTemplate(){
  const now=new Date();const y=now.getFullYear(),m=now.getMonth()+1;const diasMes=new Date(y,m,0).getDate();
  const[{data:vends},{data:metas}]=await Promise.all([
    sbClient.from('bling_vendedores').select('vendor_id,nome').order('nome'),
    sbClient.from('bling_vendedor_metas').select('vendor_id,daily_goals').eq('year',y).eq('month',m)
  ]);
  const dailyMap={};(metas||[]).forEach(r=>{if(r.daily_goals)dailyMap[r.vendor_id]=r.daily_goals;});
  const dayHdrs=Array.from({length:diasMes},(_,i)=>String(i+1));
  const makeRow=(id,nome)=>{const dg=dailyMap[id]||{};return[id,nome,...Array.from({length:diasMes},(_,i)=>dg[i+1]!=null?Number(dg[i+1]):'')];};
  const rows=[['vendor_id','nome',...dayHdrs],...(vends||[]).map(v=>makeRow(v.vendor_id,v.nome))];
  const ws=XLSX.utils.aoa_to_sheet(rows);ws['!freeze']={xSplit:2,ySplit:1,topLeftCell:'C2',activePane:'bottomLeft',state:'frozen'};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'MetasVendedoras');
  XLSX.writeFile(wb,`metas_vendedoras_${y}_${String(m).padStart(2,'0')}.xlsx`);
}

async function importVendedoresCSV(input,y,m){
  const msgEl=document.getElementById('vend-metas-import-msg');
  if(msgEl){msgEl.style.display='block';msgEl.textContent='Processando...';}
  try{
    const file=input.files[0];if(!file)return;
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(rows.length<2){throw new Error('Planilha vazia');}
    const header=rows[0].map(h=>String(h).trim());
    const idIdx=header.indexOf('vendor_id');const nIdx=header.indexOf('nome');
    if(idIdx<0)throw new Error('Coluna vendor_id não encontrada');
    const dayIdxs=[];for(let c=0;c<header.length;c++){const n=parseInt(header[c]);if(!isNaN(n)&&n>=1&&n<=31)dayIdxs.push({col:c,day:n});}
    const records=[];
    for(let r=1;r<rows.length;r++){
      const row=rows[r];const id=parseInt(row[idIdx]);if(!id||isNaN(id))continue;
      const goals={};let total=0;
      dayIdxs.forEach(({col,day})=>{const v=parseFloat(row[col])||0;if(v>0){goals[String(day)]=v;total+=v;}});
      records.push({vendor_id:id,year:y,month:m,meta_valor:total,daily_goals:goals});
    }
    for(const rec of records){
      const{error}=await sbClient.from('bling_vendedor_metas').upsert(rec,{onConflict:'vendor_id,year,month'});
      if(error)throw error;
    }
    if(msgEl){msgEl.style.color='var(--accent)';msgEl.textContent=records.length+' vendedora(s) importada(s) com sucesso.';}
    adminToast('Metas de vendedoras importadas');
  }catch(e){
    if(msgEl){msgEl.style.color='#ef4444';msgEl.textContent='Erro: '+e.message;}
    adminToast('Erro ao importar: '+e.message,false);
  }
  input.value='';
}
```

- [ ] **Step 3: Verify**

```bash
grep -n "function loadAdminVendMetas\|function downloadVendedoresTemplate\|function importVendedoresCSV\|loadAdminVendMetas" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

Expected: 4 matches (3 definitions + 1 call inside `loadAdminMetas`).

- [ ] **Step 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add vendor metas admin (loadAdminVendMetas, download, import)"
```

---

### Task 12: Apply migration and deploy

**Files:**
- `docs/migrations/004_vendedor_metas.sql` (apply to Supabase)

- [ ] **Step 1: Apply migration to Supabase**

Copy the contents of `docs/migrations/004_vendedor_metas.sql` and run in Supabase Dashboard → SQL Editor → New query → Run.

- [ ] **Step 2: Smoke-test navigation**

Open the app, log in, go to Vendas → Marcas → Vessel Brasil. Verify:
- Sales Analysis screen appears (not vessel-sales)
- Period buttons render (ATÉ AGORA selected by default)
- Canal dropdown renders with store options
- KPI cards appear after loading
- Charts render (Canal, Diário, Ticket, Desconto, Vendedoras)
- Loja breakdown tables appear per store
- Positivação grids appear

- [ ] **Step 3: Smoke-test admin metas**

Open Admin → Metas. Verify:
- Existing store goals section still works
- New "METAS DE VENDEDORAS" section appears below
- Download template button generates xlsx
- Import button accepts file

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

Wait for Vercel deployment to complete at `socialdashboard.rbvcompany.com`.

- [ ] **Step 5: Final verification on production**

Access production URL, verify the Sales Analysis screen loads correctly.
