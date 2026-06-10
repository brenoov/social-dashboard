# Controle de Acesso por Usuário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar controle granular de acesso por usuário — quais ferramentas (cards da home) e módulos (sub-seções) cada usuário pode ver e acessar, com novos recursos bloqueados por padrão.

**Architecture:** Tabela `user_permissions(user_id, resource_key, granted)` no Supabase com RLS. `TOOL_REGISTRY` hard-coded no JS define todos os recursos. `hasPermission(key)` consulta um Set em memória carregado no login. Admin gerencia via painel expandível por usuário e visão matricial.

**Tech Stack:** HTML/CSS/JS puro, Supabase JS v2 (`sbClient` já disponível na página), DOM methods (nunca innerHTML com conteúdo variável).

> **CONFLITO COM PLANO DE ADMIN REDESIGN:** O plano `2026-05-25-admin-redesign.md` também modifica o sidebar do admin e o dispatcher `loadAdminSection`. Se o redesign já tiver sido implementado, nas Tasks 8 e 9 desta lista adapte as edições ao sidebar e dispatcher já refatorados.

---

## Mapa de Arquivos

| Arquivo | O que muda |
|---------|-----------|
| `docs/migrations/003_user_permissions.sql` | **CRIAR** — DDL da tabela + RLS |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:1432` | Adicionar `id="home-card-social"` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:1442` | Adicionar `id="home-card-sales"` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:4874` | Adicionar `id="smenu-card-gestao-vista"` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:4883` | Adicionar `id="smenu-card-analise-vendas"` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:~1905` | Adicionar `TOOL_REGISTRY`, `_userPerms`, `hasPermission()`, `loadUserPermissions()` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3359` | `loadDashboard()` — chamar `loadUserPermissions` antes de `showDashboard` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3090` | `showDashboard()` — aplicar permissões nos home cards |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3084` | `openDashboard()` — guard de permissão |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3510` | `openSalesDashboard()` — guard + filtro de smenu cards |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3549` | `openGestaoVista()` — guard de permissão |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:3521` | `openSalesBrandPicker()` — guard de permissão |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:~2858` | **INSERIR** `buildPermToggle()` + `renderUserPermPanel()` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:2681` | `loadAdminUsers()` — painel expandível de permissões por usuário |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:~2858` | **INSERIR** `loadAdminPermissions()` — visão matricial |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:1473` | Sidebar: adicionar nav item "Permissões" |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:~1590` | **INSERIR** `<div class="admin-section" id="admin-section-permissions">` |
| `projetos/central-inteligencia/central-inteligencia-v1.1.html:2677` | `loadAdminSection` dispatcher — adicionar `permissions` |

---

## Task 0: SQL Migration

**Files:**
- Create: `docs/migrations/003_user_permissions.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- docs/migrations/003_user_permissions.sql
-- Colar no Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  granted      boolean NOT NULL DEFAULT false,
  granted_by   uuid REFERENCES public.profiles(id),
  granted_at   timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, resource_key)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User le proprias permissoes" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin gerencia permissoes" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
```

- [ ] **Step 2: Rodar a migração no Supabase**

Abrir Supabase Dashboard → SQL Editor → New query → colar o conteúdo acima → Run.

Resultado esperado: `Success. No rows returned.`

- [ ] **Step 3: Verificar tabela criada**

No SQL Editor, rodar:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_permissions'
ORDER BY ordinal_position;
```

Resultado esperado: colunas `user_id`, `resource_key`, `granted`, `granted_by`, `granted_at`.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add docs/migrations/003_user_permissions.sql
git commit -m "feat: add user_permissions table with RLS"
```

---

## Task 1: Adicionar IDs nos cards HTML

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:1432,1442,4874,4883`

- [ ] **Step 1: Adicionar id no home card de Redes Sociais (linha ~1432)**

Localizar:
```html
      <div class="home-card" onclick="openDashboard()" onmouseenter="setHomeBgTheme('social')" onmouseleave="setHomeBgTheme('default')">
```

Substituir por:
```html
      <div class="home-card" id="home-card-social" onclick="openDashboard()" onmouseenter="setHomeBgTheme('social')" onmouseleave="setHomeBgTheme('default')">
```

- [ ] **Step 2: Adicionar id no home card de Vendas (linha ~1442)**

Localizar:
```html
      <div class="home-card" onclick="openSalesDashboard()" onmouseenter="setHomeBgTheme('sales')" onmouseleave="setHomeBgTheme('default')">
```

Substituir por:
```html
      <div class="home-card" id="home-card-sales" onclick="openSalesDashboard()" onmouseenter="setHomeBgTheme('sales')" onmouseleave="setHomeBgTheme('default')">
```

- [ ] **Step 3: Adicionar id no smenu card de Gestão à Vista (linha ~4874)**

Localizar:
```html
      <div class="smenu-card" onclick="openGestaoVista()">
```

Substituir por:
```html
      <div class="smenu-card" id="smenu-card-gestao-vista" onclick="openGestaoVista()">
```

- [ ] **Step 4: Adicionar id no smenu card de Análise de Vendas (linha ~4883)**

Localizar:
```html
      <div class="smenu-card" onclick="openSalesBrandPicker()">
```

Substituir por:
```html
      <div class="smenu-card" id="smenu-card-analise-vendas" onclick="openSalesBrandPicker()">
```

- [ ] **Step 5: Verificar no navegador**

Abrir o arquivo no browser. Abrir DevTools → Console → rodar:
```js
document.getElementById('home-card-social')
document.getElementById('home-card-sales')
document.getElementById('smenu-card-gestao-vista')
document.getElementById('smenu-card-analise-vendas')
```

Cada comando deve retornar o elemento, não `null`.

- [ ] **Step 6: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add IDs to home cards and smenu cards for permission enforcement"
```

---

## Task 2: TOOL_REGISTRY, globals e funções de permissão

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:~1905`

- [ ] **Step 1: Localizar o ponto de inserção**

Encontrar a linha que contém `const sbClient = window.supabase.createClient(` (em torno da linha 1905). O bloco novo vai logo **depois** dessa linha (e da linha `const SUPABASE_URL` e `const SUPABASE_ANON_KEY` que estão antes).

- [ ] **Step 2: Inserir TOOL_REGISTRY e funções de permissão**

Logo após a linha `const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`, inserir o bloco abaixo:

```js
// ── PERMISSIONS ──
const TOOL_REGISTRY=[
  {key:'social',label:'Análise de Redes Sociais',icon:'📊',modules:[]},
  {key:'sales',label:'Vendas',icon:'💰',modules:[
    {key:'gestao-vista',label:'Gestão à Vista'},
    {key:'analise-vendas',label:'Análise de Vendas'}
  ]}
];
let _userPerms=new Set();
let _isAdmin=false;
function hasPermission(resourceKey){return _isAdmin||_userPerms.has(resourceKey);}
async function loadUserPermissions(userId,role){
  _isAdmin=(role==='admin');
  if(_isAdmin)return;
  const{data}=await sbClient.from('user_permissions').select('resource_key,granted').eq('user_id',userId).eq('granted',true);
  _userPerms=new Set((data||[]).map(r=>r.resource_key));
}
```

- [ ] **Step 3: Verificar no DevTools**

Abrir o arquivo no browser, fazer login como admin, abrir Console e rodar:
```js
hasPermission('tool:social')   // deve retornar true (admin tem tudo)
hasPermission('foo:bar')       // deve retornar true (admin tem tudo)
TOOL_REGISTRY.length           // deve retornar 2
```

- [ ] **Step 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add TOOL_REGISTRY, hasPermission, and loadUserPermissions"
```

---

## Task 3: Carregar permissões no login e aplicar nos home cards

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:3359,3090`

- [ ] **Step 1: Modificar loadDashboard para chamar loadUserPermissions**

Localizar a função `loadDashboard` (linha ~3359):

```js
async function loadDashboard(session){
  const tok=session.access_token||SUPABASE_ANON_KEY;
  const pr=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role`,{
    headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${tok}`}
  });
  const profiles=await pr.json();
  const role=profiles?.[0]?.role||'viewer';
  showDashboard(session.user,role);
```

Substituir pela versão com `await loadUserPermissions` **antes** de `showDashboard`:

```js
async function loadDashboard(session){
  const tok=session.access_token||SUPABASE_ANON_KEY;
  const pr=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role`,{
    headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${tok}`}
  });
  const profiles=await pr.json();
  const role=profiles?.[0]?.role||'viewer';
  await loadUserPermissions(session.user.id,role);
  showDashboard(session.user,role);
```

- [ ] **Step 2: Modificar showDashboard para aplicar permissões nos home cards**

Localizar `function showDashboard(user,role){` (linha ~3090). Localizar o bloco que controla o `adminCard`:

```js
  const adminCard=document.getElementById('home-card-admin');
  if(adminCard)adminCard.style.display=role==='admin'?'':'none';
  if(!appInitialized){
```

Substituir por (adiciona os dois cards novos logo após o adminCard):

```js
  const adminCard=document.getElementById('home-card-admin');
  if(adminCard)adminCard.style.display=role==='admin'?'':'none';
  const socialCard=document.getElementById('home-card-social');
  if(socialCard)socialCard.style.display=hasPermission('tool:social')?'':'none';
  const salesCard=document.getElementById('home-card-sales');
  if(salesCard)salesCard.style.display=hasPermission('tool:sales')?'':'none';
  if(!appInitialized){
```

- [ ] **Step 3: Testar como viewer sem permissões**

1. Criar (ou usar) um usuário com `role='viewer'` que não tenha linhas em `user_permissions`.
2. Fazer login com esse usuário.
3. Verificar: home screen deve mostrar apenas o card Admin oculto (já era) + cards de Social e Vendas também ocultos.
4. Abrir DevTools → Console: `hasPermission('tool:social')` deve retornar `false`.

- [ ] **Step 4: Testar como admin**

1. Fazer login como admin.
2. Verificar: todos os cards visíveis (Admin + Social + Vendas).
3. `hasPermission('tool:social')` deve retornar `true`.

- [ ] **Step 5: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: load permissions on login and apply to home cards"
```

---

## Task 4: Guards nas funções de navegação

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:3084,3510,3549,3521`

- [ ] **Step 1: Adicionar guard em openDashboard**

Localizar `function openDashboard(){` (linha ~3084):

```js
function openDashboard(){
  document.getElementById('home-screen').style.display='none';
  document.querySelector('.wrapper').style.display='block';
  sessionStorage.setItem('rbv-screen','dashboard');
  setHomeBgTheme('social');
}
```

Substituir por:

```js
function openDashboard(){
  if(!hasPermission('tool:social'))return;
  document.getElementById('home-screen').style.display='none';
  document.querySelector('.wrapper').style.display='block';
  sessionStorage.setItem('rbv-screen','dashboard');
  setHomeBgTheme('social');
}
```

- [ ] **Step 2: Adicionar guard em openSalesDashboard e filtrar smenu cards**

Localizar `function openSalesDashboard(){` (linha ~3510):

```js
function openSalesDashboard(){
  document.getElementById('home-screen').style.display='none';
  document.getElementById('sales-menu-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-menu');
  setHomeBgTheme('sales');
  setSMenuView(localStorage.getItem('smenu-view')||'grid');
}
```

Substituir por:

```js
function openSalesDashboard(){
  if(!hasPermission('tool:sales'))return;
  const gvCard=document.getElementById('smenu-card-gestao-vista');
  if(gvCard)gvCard.style.display=hasPermission('module:sales:gestao-vista')?'':'none';
  const avCard=document.getElementById('smenu-card-analise-vendas');
  if(avCard)avCard.style.display=hasPermission('module:sales:analise-vendas')?'':'none';
  document.getElementById('home-screen').style.display='none';
  document.getElementById('sales-menu-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-menu');
  setHomeBgTheme('sales');
  setSMenuView(localStorage.getItem('smenu-view')||'grid');
}
```

- [ ] **Step 3: Adicionar guard em openGestaoVista**

Localizar `function openGestaoVista(){` (linha ~3549). A primeira linha do corpo é `document.getElementById('sales-menu-screen').style.display='none';`.

Inserir o guard como **primeira linha** do corpo da função:

```js
function openGestaoVista(){
  if(!hasPermission('module:sales:gestao-vista'))return;
  document.getElementById('sales-menu-screen').style.display='none';
  document.getElementById('gestao-vista-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','gestao-vista');
  setHomeBgTheme('sales');
  startGVClock();
  initGvBgAnim();
  window._gvTickerIdx=null;
  window._gvTickerSlides=null;
  window._gvVendedoresCache={};
  window._gvPedidoVendorMap={};
  window._gvRenderCtx=null;
  if(window._gvTickerTimer){clearTimeout(window._gvTickerTimer);window._gvTickerTimer=null;}
  if(_gvStatusTimer){clearInterval(_gvStatusTimer);_gvStatusTimer=null;}
  _gvLastLoadTime=null;
  updateGvUpdateStatus();
  _gvAcIdx=0;
  _gvCurrentPeriod='month';
  loadGestaoVistaData('month');
  gvAutoStart();
}
```

- [ ] **Step 4: Adicionar guard em openSalesBrandPicker**

Localizar `function openSalesBrandPicker(){` (linha ~3521):

```js
function openSalesBrandPicker(){
  document.getElementById('sales-menu-screen').style.display='none';
  document.getElementById('sales-brand-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-brand');
  setHomeBgTheme('sales');
  loadBrandPickerPhotos();
}
```

Substituir por:

```js
function openSalesBrandPicker(){
  if(!hasPermission('module:sales:analise-vendas'))return;
  document.getElementById('sales-menu-screen').style.display='none';
  document.getElementById('sales-brand-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','sales-brand');
  setHomeBgTheme('sales');
  loadBrandPickerPhotos();
}
```

- [ ] **Step 5: Testar guards como viewer sem permissões**

No DevTools Console, com um viewer logado (sem permissões):
```js
openDashboard()          // não deve acontecer nada
openSalesDashboard()     // não deve acontecer nada
openGestaoVista()        // não deve acontecer nada
openSalesBrandPicker()   // não deve acontecer nada
```

- [ ] **Step 6: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add permission guards to all navigation functions"
```

---

## Task 5: Helper buildPermToggle e renderUserPermPanel

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` — inserir após `loadAdminRequests` (linha ~2858, antes do bloco `/* ── CONTAS ──`)

- [ ] **Step 1: Inserir buildPermToggle**

Localizar onde a função `loadAdminRequests` termina (linha ~2857). Inserir o bloco abaixo **após** o fechamento `}` dessa função (é a última função do bloco de seções admin existentes):

```js
/* ── PERMISSIONS ADMIN HELPERS ── */
function buildPermToggle(initialValue,onChange){
  const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;cursor:pointer;';
  const inp=document.createElement('input');inp.type='checkbox';inp.checked=initialValue;inp.style.display='none';
  const track=document.createElement('div');
  track.style.cssText='width:36px;height:20px;border-radius:10px;background:'+(initialValue?'var(--accent)':'var(--surface2)')+';border:1px solid var(--border);position:relative;transition:background .2s;cursor:pointer;flex-shrink:0';
  const thumb=document.createElement('div');
  thumb.style.cssText='width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:'+(initialValue?'18px':'2px')+';transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)';
  track.appendChild(thumb);label.appendChild(inp);label.appendChild(track);
  label.addEventListener('click',async(e)=>{
    e.preventDefault();
    const newVal=!inp.checked;inp.checked=newVal;
    track.style.background=newVal?'var(--accent)':'var(--surface2)';
    thumb.style.left=newVal?'18px':'2px';
    await onChange(newVal);
  });
  return label;
}

async function renderUserPermPanel(panel,userId,role){
  panel.textContent='';
  if(role==='admin'){
    const msg=document.createElement('div');
    msg.style.cssText='font-family:"IBM Plex Sans",sans-serif;font-size:12px;color:var(--muted);padding:4px 0';
    msg.textContent='Admin tem acesso total a todas as ferramentas.';
    panel.appendChild(msg);return;
  }
  const{data:rows}=await sbClient.from('user_permissions').select('resource_key,granted').eq('user_id',userId);
  const permMap=new Map((rows||[]).map(r=>[r.resource_key,r.granted]));
  const{data:{session}}=await sbClient.auth.getSession();
  const grantedBy=session?.user?.id;

  TOOL_REGISTRY.forEach((tool,toolIdx)=>{
    const toolKey='tool:'+tool.key;
    const toolWrap=document.createElement('div');toolWrap.style.marginBottom='8px';
    const toolRow=document.createElement('div');
    toolRow.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:6px 0';
    const toolLbl=document.createElement('span');
    toolLbl.style.cssText='font-family:"IBM Plex Sans",sans-serif;font-size:13px;font-weight:500;color:var(--text)';
    toolLbl.textContent=tool.icon+' '+tool.label;
    const modWrappers=[];
    const toolToggle=buildPermToggle(permMap.get(toolKey)||false,async(v)=>{
      await sbClient.from('user_permissions').upsert(
        {user_id:userId,resource_key:toolKey,granted:v,granted_by:grantedBy,granted_at:new Date().toISOString()},
        {onConflict:'user_id,resource_key'}
      );
      modWrappers.forEach(w=>{w.style.opacity=v?'1':'0.4';w.style.pointerEvents=v?'':'none';});
      adminToast(v?'Acesso liberado':'Acesso revogado');
    });
    toolRow.appendChild(toolLbl);toolRow.appendChild(toolToggle);toolWrap.appendChild(toolRow);

    tool.modules.forEach(mod=>{
      const modKey='module:'+tool.key+':'+mod.key;
      const toolGranted=permMap.get(toolKey)||false;
      const modWrap=document.createElement('div');
      modWrap.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 0 5px 20px;'+(toolGranted?'':'opacity:0.4;pointer-events:none');
      const modLbl=document.createElement('span');
      modLbl.style.cssText='font-family:"IBM Plex Sans",sans-serif;font-size:12px;color:var(--muted)';
      modLbl.textContent='↳ '+mod.label;
      const modToggle=buildPermToggle(permMap.get(modKey)||false,async(v)=>{
        await sbClient.from('user_permissions').upsert(
          {user_id:userId,resource_key:modKey,granted:v,granted_by:grantedBy,granted_at:new Date().toISOString()},
          {onConflict:'user_id,resource_key'}
        );
        adminToast(v?'Módulo liberado':'Módulo revogado');
      });
      modWrap.appendChild(modLbl);modWrap.appendChild(modToggle);
      toolWrap.appendChild(modWrap);modWrappers.push(modWrap);
    });

    panel.appendChild(toolWrap);
    if(toolIdx<TOOL_REGISTRY.length-1){
      const sep=document.createElement('div');sep.style.cssText='border-top:1px solid var(--border);margin:4px 0';
      panel.appendChild(sep);
    }
  });
}
```

- [ ] **Step 2: Verificar no DevTools que as funções existem**

```js
typeof buildPermToggle        // "function"
typeof renderUserPermPanel    // "function"
```

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add buildPermToggle and renderUserPermPanel helpers"
```

---

## Task 6: Painel expandível de permissões por usuário (seção Usuários)

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:2681`

- [ ] **Step 1: Modificar loadAdminUsers para adicionar botão Permissões e painel**

Localizar o final do `users.forEach(u=>{...})` dentro de `loadAdminUsers`. A última linha dentro do forEach é:

```js
    row.appendChild(av);row.appendChild(main);row.appendChild(ctrl);list.appendChild(row);
```

Substituir essa linha por:

```js
    row.appendChild(av);row.appendChild(main);row.appendChild(ctrl);
    const permPanel=document.createElement('div');
    permPanel.style.cssText='display:none;border-top:1px solid var(--border);padding:14px 16px;background:var(--surface2)';
    let permOpen=false;
    const permBtn=mkEl('button','sr-btn');permBtn.textContent='Permissões ▾';
    permBtn.addEventListener('click',async()=>{
      permOpen=!permOpen;
      permPanel.style.display=permOpen?'block':'none';
      permBtn.textContent=permOpen?'Permissões ▲':'Permissões ▾';
      if(permOpen)await renderUserPermPanel(permPanel,u.id,u.role);
    });
    ctrl.appendChild(permBtn);
    const wrapper=document.createElement('div');
    wrapper.style.cssText='border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px';
    wrapper.appendChild(row);wrapper.appendChild(permPanel);list.appendChild(wrapper);
```

- [ ] **Step 2: Testar o painel expandível**

1. Ir para Admin → Usuários.
2. Cada usuário deve ter botão "Permissões ▾" ao lado dos controles existentes.
3. Clicar no botão para um viewer: deve expandir painel com toggles de Análise de Redes Sociais e Vendas (com sub-módulos).
4. Clicar no botão para um admin: deve mostrar mensagem "Admin tem acesso total...".
5. Ativar um toggle: verificar no Supabase que a linha foi inserida em `user_permissions`.
6. Desativar o toggle: verificar que `granted` foi atualizado para `false`.
7. Toast deve aparecer após cada ação.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add expandable permissions panel to each user card"
```

---

## Task 7: loadAdminPermissions — visão matricial

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html` — inserir após `renderUserPermPanel`

- [ ] **Step 1: Inserir função loadAdminPermissions**

Logo após o final de `renderUserPermPanel`, inserir:

```js
async function loadAdminPermissions(){
  const container=document.getElementById('admin-perms-matrix');
  if(!container)return;
  container.textContent='';

  const{data:users}=await sbClient.from('profiles').select('id,name,email,role').order('created_at',{ascending:true});
  const viewers=(users||[]).filter(u=>u.role!=='admin');

  const{data:allPerms}=await sbClient.from('user_permissions').select('user_id,resource_key,granted').eq('granted',true);
  const permSet=new Set((allPerms||[]).map(r=>r.user_id+'|'+r.resource_key));

  const{data:{session}}=await sbClient.auth.getSession();
  const grantedBy=session?.user?.id;

  const resources=[];
  TOOL_REGISTRY.forEach(t=>{
    resources.push({key:'tool:'+t.key,label:t.label,isModule:false});
    t.modules.forEach(m=>resources.push({key:'module:'+t.key+':'+m.key,label:m.label,isModule:true}));
  });

  const wrap=document.createElement('div');wrap.style.cssText='overflow-x:auto';
  const table=document.createElement('table');
  table.style.cssText='width:100%;border-collapse:collapse;font-family:"IBM Plex Sans",sans-serif;font-size:12px';

  // Header
  const thead=document.createElement('thead');
  const hRow=document.createElement('tr');
  const thUser=document.createElement('th');
  thUser.style.cssText='text-align:left;padding:8px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--border);white-space:nowrap';
  thUser.textContent='Usuário';hRow.appendChild(thUser);
  resources.forEach(r=>{
    const th=document.createElement('th');
    th.style.cssText='padding:8px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--border);text-align:center;white-space:nowrap;'+(r.isModule?'padding-left:18px;color:var(--accent)':'');
    th.textContent=(r.isModule?'↳ ':'')+r.label;hRow.appendChild(th);
  });
  const thActions=document.createElement('th');thActions.style.cssText='padding:8px 10px;border-bottom:2px solid var(--border)';hRow.appendChild(thActions);
  thead.appendChild(hRow);table.appendChild(thead);

  const tbody=document.createElement('tbody');
  viewers.forEach((u,uIdx)=>{
    const tr=document.createElement('tr');
    tr.style.cssText='border-bottom:1px solid var(--border);'+(uIdx%2===1?'background:var(--surface2)':'');

    const tdName=document.createElement('td');tdName.style.cssText='padding:10px 12px;white-space:nowrap';
    const nameDiv=document.createElement('div');nameDiv.style.cssText='font-weight:500;color:var(--text);font-size:13px';nameDiv.textContent=u.name||u.email;
    const emailDiv=document.createElement('div');emailDiv.style.cssText='font-size:10px;color:var(--muted)';emailDiv.textContent=u.email;
    tdName.appendChild(nameDiv);tdName.appendChild(emailDiv);tr.appendChild(tdName);

    const rowCbs=[];
    resources.forEach(r=>{
      const td=document.createElement('td');td.style.cssText='text-align:center;padding:8px 10px';
      const cb=document.createElement('input');cb.type='checkbox';
      cb.checked=permSet.has(u.id+'|'+r.key);
      cb.style.cssText='width:16px;height:16px;cursor:pointer;accent-color:var(--accent)';
      cb.addEventListener('change',async()=>{
        const granted=cb.checked;
        await sbClient.from('user_permissions').upsert(
          {user_id:u.id,resource_key:r.key,granted,granted_by:grantedBy,granted_at:new Date().toISOString()},
          {onConflict:'user_id,resource_key'}
        );
        if(granted)permSet.add(u.id+'|'+r.key);else permSet.delete(u.id+'|'+r.key);
        adminToast(granted?'Acesso liberado':'Acesso revogado');
      });
      td.appendChild(cb);tr.appendChild(td);rowCbs.push(cb);
    });

    const tdAct=document.createElement('td');tdAct.style.cssText='padding:8px 12px;white-space:nowrap';
    const grantAllBtn=mkEl('button','sr-btn');grantAllBtn.textContent='Liberar tudo';grantAllBtn.style.cssText='font-size:10px;margin-right:4px';
    grantAllBtn.addEventListener('click',async()=>{
      const ups=resources.map(r=>({user_id:u.id,resource_key:r.key,granted:true,granted_by:grantedBy,granted_at:new Date().toISOString()}));
      await sbClient.from('user_permissions').upsert(ups,{onConflict:'user_id,resource_key'});
      resources.forEach(r=>permSet.add(u.id+'|'+r.key));
      rowCbs.forEach(c=>c.checked=true);
      adminToast('Todos os acessos liberados');
    });
    const revokeAllBtn=mkEl('button','sr-btn danger');revokeAllBtn.textContent='Revogar tudo';revokeAllBtn.style.cssText='font-size:10px';
    revokeAllBtn.addEventListener('click',async()=>{
      const ups=resources.map(r=>({user_id:u.id,resource_key:r.key,granted:false,granted_by:grantedBy,granted_at:new Date().toISOString()}));
      await sbClient.from('user_permissions').upsert(ups,{onConflict:'user_id,resource_key'});
      resources.forEach(r=>permSet.delete(u.id+'|'+r.key));
      rowCbs.forEach(c=>c.checked=false);
      adminToast('Todos os acessos revogados');
    });
    tdAct.appendChild(grantAllBtn);tdAct.appendChild(revokeAllBtn);tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });

  if(viewers.length===0){
    const tr=document.createElement('tr');
    const td=document.createElement('td');td.colSpan=resources.length+2;
    td.style.cssText='padding:24px;text-align:center;color:var(--muted);font-size:13px';
    td.textContent='Nenhum usuário viewer cadastrado.';
    tr.appendChild(td);tbody.appendChild(tr);
  }

  table.appendChild(tbody);wrap.appendChild(table);container.appendChild(wrap);
}
```

- [ ] **Step 2: Verificar que a função existe**

```js
typeof loadAdminPermissions  // "function"
```

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add loadAdminPermissions matrix view function"
```

---

## Task 8: Sidebar nav item e section HTML

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:1473,~1590`

> **NOTA:** Se o plano de admin redesign já foi implementado, a sidebar já tem grupos (GESTÃO, PERSONALIZAÇÃO, etc.). Nesse caso, adicionar o nav item de Permissões dentro do grupo GESTÃO, após o item de Usuários.

- [ ] **Step 1: Adicionar nav item "Permissões" na sidebar**

Localizar o item de Usuários na sidebar (linha ~1473):

```html
      <div class="admin-nav-item active" data-section="users" onclick="loadAdminSection('users')"><svg ...></svg><span>Usuários</span></div>
```

Inserir **após** essa linha:

```html
      <div class="admin-nav-item" data-section="permissions" onclick="loadAdminSection('permissions')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Permissões</span></div>
```

- [ ] **Step 2: Adicionar section HTML para Permissões**

Localizar o final das divs `.admin-section` existentes (próximo da linha 1584–1590). Adicionar uma nova seção logo após a última `admin-section` existente, antes do fechamento do `admin-content`:

```html
      <div class="admin-section" id="admin-section-permissions">
        <div class="admin-section-title">Permissões</div>
        <div class="admin-section-sub">Controle de acesso por ferramenta e módulo para cada usuário</div>
        <div id="admin-perms-matrix"></div>
      </div>
```

- [ ] **Step 3: Verificar no browser que o item aparece no sidebar**

Abrir Admin. O sidebar deve mostrar "Permissões" (com ícone de cadeado) logo abaixo de "Usuários". Clicar nele ainda não carregará nada (o dispatcher ainda não está atualizado — próxima task).

- [ ] **Step 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: add Permissões nav item and section to admin panel"
```

---

## Task 9: Atualizar loadAdminSection dispatcher

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.1.html:2677`

- [ ] **Step 1: Adicionar permissions ao dispatcher**

Localizar a linha do dispatcher (linha ~2677):

```js
  ({users:loadAdminUsers,accounts:loadAdminAccounts,appearance:loadAdminAppearance,data:loadAdminData,system:loadAdminSystem,metas:loadAdminMetas,requests:loadAdminRequests})[name]?.();
```

Substituir por (adiciona `permissions:loadAdminPermissions` no objeto):

```js
  ({users:loadAdminUsers,accounts:loadAdminAccounts,appearance:loadAdminAppearance,data:loadAdminData,system:loadAdminSystem,metas:loadAdminMetas,requests:loadAdminRequests,permissions:loadAdminPermissions})[name]?.();
```

> **NOTA:** Se o plano de admin redesign já foi implementado, o dispatcher já pode ter `themes` e `behavior` — apenas adicionar `permissions:loadAdminPermissions` ao objeto existente.

- [ ] **Step 2: Testar a seção Permissões completa**

1. Abrir Admin → clicar em "Permissões" no sidebar.
2. A seção deve carregar com a tabela matricial.
3. Linhas = usuários viewers, colunas = recursos (Análise de Redes Sociais, Vendas, ↳ Gestão à Vista, ↳ Análise de Vendas).
4. Marcar checkbox de "Análise de Redes Sociais" para um usuário → toast "Acesso liberado" → verificar no Supabase que a linha foi inserida.
5. Clicar "Liberar tudo" para um usuário → todos os checkboxes ficam marcados.
6. Clicar "Revogar tudo" → todos desmarcados.

- [ ] **Step 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: wire loadAdminPermissions into admin section dispatcher"
```

---

## Task 10: Verificação de regressão

**Files:**
- Nenhuma mudança de código — apenas testes manuais.

- [ ] **Step 1: Testar fluxo completo admin**

1. Login como admin.
2. Home: todos os 3 cards visíveis (Admin, Redes Sociais, Vendas).
3. Abrir Redes Sociais → dashboard carrega normalmente.
4. Voltar → Vendas → smenu com 2 cards (Gestão à Vista, Análise de Vendas).
5. Abrir Gestão à Vista → funciona.
6. Voltar → Abrir Análise de Vendas → funciona.

- [ ] **Step 2: Testar viewer com zero permissões**

1. Login como viewer sem nenhuma permissão concedida.
2. Home: apenas card Admin oculto. Redes Sociais e Vendas também ocultos. Home está vazia.
3. No Console: `openDashboard()` → nada acontece. `openSalesDashboard()` → nada. `openGestaoVista()` → nada.

- [ ] **Step 3: Testar concessão e revogação em tempo real**

1. Login como admin na aba 1. Login como viewer na aba 2 (ou browser diferente).
2. Na aba admin: liberar `tool:social` para o viewer (via Admin → Usuários → Permissões ▾ ou Admin → Permissões).
3. Recarregar a aba do viewer: card "Redes Sociais" aparece, Vendas continua oculto.
4. Clicar em Redes Sociais → dashboard abre normalmente.
5. Na aba admin: revogar `tool:social`. Recarregar aba do viewer: card some.

- [ ] **Step 4: Testar novo recurso bloqueado por padrão**

1. Adicionar temporariamente um recurso novo no `TOOL_REGISTRY`:
   ```js
   {key:'test-tool',label:'Ferramenta Teste',icon:'🧪',modules:[]}
   ```
2. Adicionar o home card correspondente no HTML com `id="home-card-test-tool"`.
3. Fazer login como viewer (sem permissões): card deve estar oculto sem nenhuma ação.
4. Remover a entrada de teste do `TOOL_REGISTRY` e o card HTML.

- [ ] **Step 5: Commit final**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "test: verify permission system end-to-end regression"
```
