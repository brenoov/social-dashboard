# Admin Redesign — Central de Inteligência

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 bugs críticos do módulo admin e adicionar seções Temas & Cores e Comportamento com live preview, gradientes, drag-to-reorder e autocycle configurável.

**Architecture:** Arquivo único `central-inteligencia-v1.1.html` (5054 linhas). Todas as escritas migram de `adFetch` raw para `sbClient.from(...)` (Supabase JS v2, já disponível como `sbClient`). Novas funções `loadAdminThemes()` e `loadAdminBehavior()` adicionadas após linha 2857. Nova função helper `applyAccountTheme(name, color, colorEnd)` adicionada após `applyProfileTheme` (linha 1929).

**Tech Stack:** HTML/CSS/JS puro, Supabase JS v2 (`sbClient` inicializado na linha 1905), sem dependências externas.

---

## Mapeamento de arquivos

| Arquivo | Ação |
|---------|------|
| `projetos/central-inteligencia/central-inteligencia-v1.1.html` | Modificar |
| `projetos/central-inteligencia/central-inteligencia-v1.2-preview.html` | **Deletar** |

**Seções modificadas dentro do v1.1:**

| Linha | O que muda |
|-------|-----------|
| 1471–1483 | `<nav class="admin-sidebar">` — nova estrutura com grupos |
| 1525–1536 | Seção Aparência — HTML limpo, sem cores |
| 1584–1587 | Inserir 2 novas `admin-section` (Temas & Cores, Comportamento) |
| 1929 | Inserir `applyAccountTheme()` após `applyProfileTheme` |
| 2456 | `buildProfiles` — query com novos campos |
| 2481 | `buildProfiles` — popular `_acQueue` |
| 2498–2506 | Trocar `const AC_DURATION=40` por `let _acDuration=40` + `let _acQueue=[]` |
| 2508–2516 | `_acSwitchTo` — usar `_acQueue` |
| 2519–2542 | `_acStartCycle` — usar `_acDuration` e `_acQueue` |
| 2577–2585 | `initAutoCycleToggle` — ler intervalo do banco |
| 2659 | `adFetch` — verificar `response.ok` |
| 2677 | Dispatcher — adicionar `themes` e `behavior` |
| 2741–2786 | `loadAdminAccounts` — remover color picker |
| 2790–2811 | `loadAdminAppearance` — refatorar |
| 2813–2819 | `adminSaveSetting` — PATCH → UPSERT |
| Após 2857 | Inserir `loadAdminThemes` e `loadAdminBehavior` |

---

## Task 0: Cleanup e SQL Migration

**Files:**
- Delete: `projetos/central-inteligencia/central-inteligencia-v1.2-preview.html`
- Create: `docs/migrations/002_admin_redesign.sql`

- [ ] **Passo 1: Deletar arquivo obsoleto**

```bash
rm /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.2-preview.html
```

- [ ] **Passo 2: Criar migração SQL**

Criar `docs/migrations/002_admin_redesign.sql`:

```sql
-- Migration 002: Admin Redesign
-- Colar no Supabase Dashboard -> SQL Editor -> Run

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS accent_color_end text,
  ADD COLUMN IF NOT EXISTS display_emoji text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_rotation boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Autenticados leem settings" ON public.platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admin gerencia settings" ON public.platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Policy de UPDATE para accounts (necessaria para salvar cores)
CREATE POLICY IF NOT EXISTS "Admin atualiza accounts" ON public.accounts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_name',            'Inteligencia RBV'),
  ('footer_phrase',            'Mentalidade Vencedora'),
  ('autocycle_interval',       '40'),
  ('default_period',           '7'),
  ('default_theme',            'dark'),
  ('header_collapsed_default', 'false')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Passo 3: Rodar no Supabase**

Supabase Dashboard -> SQL Editor -> colar -> Run. Verificar: sem erros vermelhos.

- [ ] **Passo 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add docs/migrations/002_admin_redesign.sql
git rm projetos/central-inteligencia/central-inteligencia-v1.2-preview.html
git commit -m "chore: remove v1.2-preview, add migration 002"
```

---

## Task 1: Corrigir `adFetch` — falha silenciosa

**Files:**
- Modify: `central-inteligencia-v1.1.html:2659`

- [ ] **Passo 1: Localizar**

```bash
grep -n "function adFetch" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir**

Localizar (linha ~2659) — linha única:
```js
function adFetch(path,opts={}){return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opts,headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${adTok()}`,'Content-Type':'application/json',...(opts.headers||{})}});}
```

Substituir por:
```js
async function adFetch(path,opts={}){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opts,headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${adTok()}`,'Content-Type':'application/json',...(opts.headers||{})}});
  if(!r.ok){const msg=await r.text().catch(()=>'Erro desconhecido');throw new Error(msg);}
  return r;
}
```

- [ ] **Passo 3: Verificar**

Abrir Admin -> Usuarios. Editar nome de um usuario -> toast verde. Verificar no Supabase que o valor mudou.

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "fix: adFetch lanca erro quando response.ok e false"
```

---

## Task 2: Corrigir `adminSaveSetting` — PATCH para UPSERT

**Files:**
- Modify: `central-inteligencia-v1.1.html:2813–2819`

- [ ] **Passo 1: Localizar**

```bash
grep -n "async function adminSaveSetting" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir o bloco completo**

Localizar:
```js
async function adminSaveSetting(key,inputId){
  const val=document.getElementById(inputId)?.value?.trim();if(!val)return;
  await adFetch(`platform_settings?key=eq.${key}`,{method:'PATCH',body:JSON.stringify({value:val,updated_at:new Date().toISOString()})});
  if(key==='footer_phrase'){const el=document.querySelector('.home-footer-phrase');if(el)el.textContent=val;}
  if(key==='platform_name'){['apb-name','admin-topbar-title'].forEach(id=>{const el=document.getElementById(id);});}
  adminToast('Configuracao salva');
}
```

Substituir por:
```js
async function adminSaveSetting(key,inputId){
  const val=document.getElementById(inputId)?.value?.trim();if(!val)return;
  const{error}=await sbClient.from('platform_settings').upsert({key,value:val,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(error){adminToast('Erro: '+error.message,false);return;}
  if(key==='footer_phrase'){const el=document.querySelector('.home-footer-phrase');if(el)el.textContent=val;}
  if(key==='platform_name'){const el=document.getElementById('admin-topbar-title');if(el)el.textContent=val;}
  adminToast('Configuracao salva');
}
```

- [ ] **Passo 3: Verificar**

Admin -> Aparencia -> Nome da plataforma -> digitar "Inteligencia RBV 2" -> Salvar. Verificar no Supabase: `platform_settings` tem `key='platform_name'` com valor atualizado. Reabrir secao: input mostra o valor novo.

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "fix: adminSaveSetting usa UPSERT, platform_settings persiste corretamente"
```

---

## Task 3: Adicionar `applyAccountTheme()` helper

**Files:**
- Modify: `central-inteligencia-v1.1.html` — inserir apos linha 1929

- [ ] **Passo 1: Localizar o fim de `applyProfileTheme`**

```bash
grep -n "function applyProfileTheme\|const GOALS" projetos/central-inteligencia/central-inteligencia-v1.1.html | head -5
```

`applyProfileTheme` termina ~linha 1929. Logo apos comeca `const GOALS=`.

- [ ] **Passo 2: Inserir nova funcao ANTES de `const GOALS`**

Localizar a linha:
```js
const GOALS={
```

Inserir imediatamente antes:
```js
function applyAccountTheme(name,color,colorEnd){
  if(!color)return;
  function hexToRgba(h,a){
    const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
    return'rgba('+r+','+g+','+b+','+a+')';
  }
  if(!PROFILE_THEMES[name])PROFILE_THEMES[name]={};
  PROFILE_THEMES[name].accent=color;
  PROFILE_THEMES[name].light=hexToRgba(color,0.08);
  PROFILE_THEMES[name].mid=hexToRgba(color,0.30);
  PROFILE_THEMES[name].end=colorEnd||null;
  // Aplicar CSS vars se esta conta estiver ativa
  const activeName=(document.getElementById('apb-name')||{}).textContent||'';
  if(activeName.trim()===name){
    document.documentElement.style.setProperty('--accent',color);
    document.documentElement.style.setProperty('--accent-light',PROFILE_THEMES[name].light);
    document.documentElement.style.setProperty('--accent-mid',PROFILE_THEMES[name].mid);
  }
  // Atualizar cor do avatar no botao de perfil
  document.querySelectorAll('.av[data-account-name]').forEach(function(av){
    if(av.dataset.accountName===name){
      av.style.background=colorEnd?'linear-gradient(135deg,'+color+','+colorEnd+')':color;
    }
  });
}

```

- [ ] **Passo 3: Atualizar `buildProfiles` — query, avatar e acQueue**

Localizar (linha ~2456):
```js
const accounts=await sb('accounts?order=name.asc&select=id,name,username,picture_url,accent_color');
```
Substituir por:
```js
const accounts=await sb('accounts?order=display_order.asc,name.asc&select=id,name,username,picture_url,accent_color,accent_color_end,in_rotation');
```

Localizar (linha ~2459):
```js
if(acc.accent_color&&PROFILE_THEMES[acc.name]){PROFILE_THEMES[acc.name].accent=acc.accent_color;PROFILE_THEMES[acc.name].light=acc.accent_color+'1a';PROFILE_THEMES[acc.name].mid=acc.accent_color+'4d';}
```
Substituir por:
```js
if(acc.accent_color)applyAccountTheme(acc.name,acc.accent_color,acc.accent_color_end||null);
```

Localizar (linha ~2466):
```js
const av=document.createElement('div');av.className='av';av.style.background=t.accent;av.dataset.accountId=acc.id;
```
Substituir por:
```js
const bg=(t.end)?'linear-gradient(135deg,'+t.accent+','+t.end+')':t.accent;
const av=document.createElement('div');av.className='av';av.style.background=bg;av.dataset.accountId=acc.id;av.dataset.accountName=acc.name;
```

Localizar (linha ~2481):
```js
_allAccounts=accounts;
```
Substituir por:
```js
_allAccounts=accounts;
_acQueue=accounts.filter(function(a){return a.in_rotation!==false;});
```

- [ ] **Passo 4: Verificar**

Abrir dashboard. Avatares de perfil continuam com as cores corretas. Console sem erros.

- [ ] **Passo 5: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: applyAccountTheme helper, buildProfiles com novos campos e acQueue"
```

---

## Task 4: Corrigir cores em `loadAdminAppearance` — sbClient + live preview

**Files:**
- Modify: `central-inteligencia-v1.1.html:2799–2810`

- [ ] **Passo 1: Localizar o bloco de cores dentro de `loadAdminAppearance`**

```bash
grep -n "Cores por conta\|admin-theme-list" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir o bloco de cores (linhas ~2799–2810)**

Localizar o trecho que começa com:
```js
  // Cores por conta
  const accounts=await sb('accounts?order=name.asc&select=id,name,accent_color');
```
...e termina com:
```js
  });
```
(o forEach que popula `admin-theme-list`)

Substituir todo esse bloco por:
```js
  // Cores por conta — sbClient com live preview
  const accs=await sb('accounts?order=display_order.asc,name.asc&select=id,name,accent_color,accent_color_end');
  const list=document.getElementById('admin-theme-list');
  list.textContent='';
  accs.forEach(function(acc){
    const color=acc.accent_color||(PROFILE_THEMES[acc.name]||{accent:'#1A3A6B'}).accent;
    const colorEnd=acc.accent_color_end||null;
    const row=mkEl('div','sr');row.style.justifyContent='space-between';
    row.appendChild(mkEl('div','sr-label',acc.name));
    const right=mkEl('div');right.style.cssText='display:flex;align-items:center;gap:10px';
    const pick=mkEl('input');pick.type='color';pick.value=color;pick.style.cssText='width:36px;height:26px;border:none;border-radius:5px;cursor:pointer;padding:0';
    const val=mkEl('span','sr-val',color);
    pick.addEventListener('input',function(){val.textContent=pick.value;applyAccountTheme(acc.name,pick.value,colorEnd);});
    pick.addEventListener('change',async function(){
      const{error}=await sbClient.from('accounts').update({accent_color:pick.value}).eq('id',acc.id);
      if(error){adminToast('Erro: '+error.message,false);return;}
      applyAccountTheme(acc.name,pick.value,colorEnd);
      adminToast('Cor de '+acc.name+' salva');
    });
    right.appendChild(pick);right.appendChild(val);row.appendChild(right);list.appendChild(row);
  });
```

- [ ] **Passo 3: Verificar — este e o bug principal reportado**

1. Admin -> Aparencia -> mover o color picker de uma conta.
2. O botao de perfil na dashboard muda de cor em tempo real.
3. Soltar o picker (evento change): toast verde.
4. Navegar para outra secao e voltar em Aparencia: cor correta (nao revertida).
5. Verificar no Supabase Table Editor -> accounts -> coluna `accent_color` atualizada.

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "fix: cores salvas com sbClient, live preview funcional, reversao eliminada"
```

---

## Task 5: Redesenhar sidebar `<nav>`

**Files:**
- Modify: `central-inteligencia-v1.1.html:1471–1483`

- [ ] **Passo 1: Localizar**

```bash
grep -n 'class="admin-sidebar"' projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir o bloco `<nav>` completo**

Localizar o bloco entre `<nav class="admin-sidebar">` e `</nav>` (linhas 1471–1483) e substituir por:

```html
    <nav class="admin-sidebar">
      <div class="admin-nav-group-label">Gestao</div>
      <div class="admin-nav-item active" data-section="users" onclick="loadAdminSection('users')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Usuarios</span>
      </div>
      <div class="admin-nav-item" data-section="accounts" onclick="loadAdminSection('accounts')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        <span>Contas</span>
      </div>
      <div class="admin-nav-item" data-section="requests" onclick="loadAdminSection('requests')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Solicitacoes</span>
      </div>
      <div class="admin-nav-group-label">Personalizacao</div>
      <div class="admin-nav-item" data-section="themes" onclick="loadAdminSection('themes')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
        <span>Temas e Cores</span>
      </div>
      <div class="admin-nav-item" data-section="appearance" onclick="loadAdminSection('appearance')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        <span>Aparencia Global</span>
      </div>
      <div class="admin-nav-item" data-section="behavior" onclick="loadAdminSection('behavior')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Comportamento</span>
      </div>
      <div class="admin-nav-group-label">Dados</div>
      <div class="admin-nav-item" data-section="data" onclick="loadAdminSection('data')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        <span>Sincronizacao</span>
      </div>
      <div class="admin-nav-item" data-section="metas" onclick="loadAdminSection('metas')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Metas</span>
      </div>
      <div class="admin-nav-group-label">Info</div>
      <div class="admin-nav-item" data-section="system" onclick="loadAdminSection('system')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Sistema</span>
      </div>
    </nav>
```

- [ ] **Passo 3: Verificar**

Abrir Admin. Sidebar deve exibir grupos "Gestao", "Personalizacao", "Dados", "Info". Clicar em "Temas e Cores" e "Comportamento" nao deve crashar (secoes estarao vazias ate Task 6).

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: nova estrutura sidebar admin com grupos Personalizacao e Dados"
```

---

## Task 6: Adicionar HTML das novas secoes + atualizar Aparencia

**Files:**
- Modify: `central-inteligencia-v1.1.html:1525–1587`

- [ ] **Passo 1: Substituir HTML da secao Aparencia (linhas ~1525–1536)**

Localizar o bloco:
```html
      <!-- APARENCIA -->
      <div class="admin-section" id="admin-section-appearance">
```
...ate o fechamento `</div>` dessa secao (inclui `admin-theme-list`).

Substituir por:
```html
      <!-- APARENCIA GLOBAL -->
      <div class="admin-section" id="admin-section-appearance">
        <div class="admin-section-title">Aparencia Global</div>
        <div class="admin-section-sub">Identidade textual e preferencias da plataforma</div>
        <span class="sg-label">Identidade</span>
        <div class="sg">
          <div class="sr" style="justify-content:space-between;gap:12px">
            <div class="sr-main">
              <div class="sr-label">Nome da plataforma</div>
              <div class="sr-sub">Exibido no header — edite para ver ao vivo</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input id="adm-platform-name" class="admin-input" style="width:200px;padding:6px 10px;font-size:12px" placeholder="Inteligencia RBV">
              <button class="admin-btn-sm" onclick="adminSaveSetting('platform_name','adm-platform-name')">Salvar</button>
            </div>
          </div>
          <div class="sr" style="justify-content:space-between;gap:12px">
            <div class="sr-main">
              <div class="sr-label">Frase de rodape</div>
              <div class="sr-sub">Tela inicial — edite para ver ao vivo</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input id="adm-footer-phrase" class="admin-input" style="width:200px;padding:6px 10px;font-size:12px" placeholder="Mentalidade Vencedora">
              <button class="admin-btn-sm" onclick="adminSaveSetting('footer_phrase','adm-footer-phrase')">Salvar</button>
            </div>
          </div>
        </div>
        <span class="sg-label">Preferencias</span>
        <div class="sg">
          <div class="sr" style="justify-content:space-between;gap:12px">
            <div class="sr-main">
              <div class="sr-label">Tema padrao</div>
              <div class="sr-sub">Aplicado para novos usuarios</div>
            </div>
            <select id="adm-default-theme" class="auth-input" style="max-width:120px;font-size:12px;padding:5px 8px" onchange="adminSaveSetting('default_theme','adm-default-theme')">
              <option value="dark">Escuro</option>
              <option value="light">Claro</option>
            </select>
          </div>
        </div>
      </div>
```

- [ ] **Passo 2: Inserir secoes Temas e Comportamento antes do `</div>` que fecha `admin-content`**

Localizar o fim da secao requests (linha ~1585):
```html
      </div>
    </div>
  </div>
```

Inserir as duas novas secoes antes desse bloco:
```html
      <!-- TEMAS E CORES -->
      <div class="admin-section" id="admin-section-themes">
        <div class="admin-section-title">Temas e Cores</div>
        <div class="admin-section-sub">Personalize cada conta com live preview em tempo real</div>
        <div id="admin-themes-body"></div>
      </div>
      <!-- COMPORTAMENTO -->
      <div class="admin-section" id="admin-section-behavior">
        <div class="admin-section-title">Comportamento</div>
        <div class="admin-section-sub">Configure como a plataforma se comporta por padrao</div>
        <div id="admin-behavior-body"></div>
      </div>
```

- [ ] **Passo 3: Verificar**

Abrir Admin -> Aparencia Global: deve mostrar apenas nome, frase de rodape e tema padrao — sem lista de cores. Clicar em Temas e Cores: secao aparece vazia (funcao ainda nao implementada).

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: HTML das secoes Temas e Cores e Comportamento; Aparencia Global limpa"
```

---

## Task 7: Atualizar `loadAdminSection` dispatcher

**Files:**
- Modify: `central-inteligencia-v1.1.html:2677`

- [ ] **Passo 1: Localizar**

```bash
grep -n "loadAdminUsers,accounts" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir a linha do dispatcher**

Localizar:
```js
  ({users:loadAdminUsers,accounts:loadAdminAccounts,appearance:loadAdminAppearance,data:loadAdminData,system:loadAdminSystem,metas:loadAdminMetas,requests:loadAdminRequests})[name]?.();
```

Substituir por:
```js
  ({users:loadAdminUsers,accounts:loadAdminAccounts,appearance:loadAdminAppearance,data:loadAdminData,system:loadAdminSystem,metas:loadAdminMetas,requests:loadAdminRequests,themes:loadAdminThemes,behavior:loadAdminBehavior})[name]?.();
```

- [ ] **Passo 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: dispatcher registra loadAdminThemes e loadAdminBehavior"
```

---

## Task 8: Implementar `loadAdminThemes()`

**Files:**
- Modify: `central-inteligencia-v1.1.html` — inserir antes de `/* -- SISTEMA -- */` (linha ~2859)

- [ ] **Passo 1: Localizar ponto de insercao**

```bash
grep -n "SISTEMA\|function loadAdminSystem" projetos/central-inteligencia/central-inteligencia-v1.1.html | head -5
```

- [ ] **Passo 2: Inserir `loadAdminThemes` antes do bloco SISTEMA**

```js
/* -- TEMAS & CORES -- */
async function loadAdminThemes(){
  const body=document.getElementById('admin-themes-body');
  body.textContent='';
  const loading=mkEl('div');loading.style.cssText='color:var(--muted);font-size:12px';loading.textContent='Carregando...';body.appendChild(loading);
  const accs=await sb('accounts?order=display_order.asc,name.asc&select=id,name,username,picture_url,accent_color,accent_color_end,display_emoji');
  body.textContent='';
  if(!accs.length){const em=mkEl('div');em.style.cssText='color:var(--muted);font-size:12px';em.textContent='Nenhuma conta cadastrada.';body.appendChild(em);return;}
  const hint=mkEl('div');hint.style.cssText='font-family:"IBM Plex Sans",sans-serif;font-size:11px;color:var(--muted);margin-bottom:16px';hint.textContent='Arraste os cards para reordenar as contas na barra de perfis. As cores mudam em tempo real ao mover o picker.';body.appendChild(hint);
  let dragSrcIdx=null;
  const accArr=accs.slice();
  function renderCards(){
    const old=body.querySelectorAll('.theme-card');old.forEach(function(e){e.remove();});
    accArr.forEach(function(acc,idx){
      const card=mkEl('div','sg theme-card');card.style.cssText='margin-bottom:12px;cursor:grab;position:relative';
      card.draggable=true;
      card.addEventListener('dragstart',function(e){dragSrcIdx=idx;e.dataTransfer.effectAllowed='move';card.style.opacity='.45';});
      card.addEventListener('dragend',function(){card.style.opacity='1';});
      card.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='move';});
      card.addEventListener('drop',async function(e){
        e.preventDefault();if(dragSrcIdx===null||dragSrcIdx===idx)return;
        const moved=accArr.splice(dragSrcIdx,1)[0];accArr.splice(idx,0,moved);dragSrcIdx=null;
        renderCards();
        await Promise.all(accArr.map(function(a,i){return sbClient.from('accounts').update({display_order:i}).eq('id',a.id);}));
        adminToast('Ordem salva');
        buildProfiles();
      });
      // Header
      const head=mkEl('div','sr');head.style.cssText='border-bottom:1px solid var(--border);padding-bottom:0;gap:10px;align-items:center';
      const dragHint=mkEl('span');dragHint.textContent='::';dragHint.style.cssText='color:var(--muted);letter-spacing:1px;flex-shrink:0;font-size:14px;cursor:grab';head.appendChild(dragHint);
      const color=acc.accent_color||(PROFILE_THEMES[acc.name]||{accent:'#1A3A6B'}).accent;
      const colorEnd=acc.accent_color_end||null;
      const av=mkEl('div');av.style.cssText='width:40px;height:40px;border-radius:50%;background:'+(colorEnd?'linear-gradient(135deg,'+color+','+colorEnd+')':color)+';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid var(--border);font-size:18px';
      if(acc.picture_url){const img=mkEl('img');img.src=acc.picture_url;img.style.cssText='width:100%;height:100%;object-fit:cover';av.appendChild(img);}
      else if(acc.display_emoji){av.textContent=acc.display_emoji;}
      else{const sp=mkEl('span');sp.style.cssText='color:#fff;font-size:16px;font-weight:700';sp.textContent=(acc.name||'?').charAt(0);av.appendChild(sp);}
      const hMain=mkEl('div','sr-main');hMain.style.marginLeft='4px';
      hMain.appendChild(mkEl('div','sr-label',acc.name));
      hMain.appendChild(mkEl('div','sr-sub','@'+(acc.username||'')));
      head.append(av,hMain);card.appendChild(head);
      // Emoji
      const emojiRow=mkEl('div','sr');emojiRow.style.justifyContent='space-between';emojiRow.appendChild(mkEl('div','sr-sub','Emoji customizado (substitui a inicial quando sem foto)'));
      const emojiInp=mkEl('input','auth-input');emojiInp.value=acc.display_emoji||'';emojiInp.placeholder='Ex: ✨';emojiInp.maxLength=2;emojiInp.style.cssText='max-width:80px;font-size:18px;text-align:center;padding:4px 8px';
      emojiInp.addEventListener('input',function(){if(!acc.picture_url)av.textContent=emojiInp.value||acc.name.charAt(0);});
      emojiRow.appendChild(emojiInp);card.appendChild(emojiRow);
      // Modo cor
      const modeRow=mkEl('div','sr');modeRow.style.justifyContent='space-between';modeRow.appendChild(mkEl('div','sr-sub','Tipo de cor'));
      const modeWrap=mkEl('div');modeWrap.style.cssText='display:flex;gap:6px';
      const btnSolid=mkEl('button','sr-btn'+(colorEnd?'':' active'));btnSolid.textContent='Solido';btnSolid.style.cssText='font-size:11px;padding:4px 12px';
      const btnGrad=mkEl('button','sr-btn'+(colorEnd?' active':''));btnGrad.textContent='Gradiente';btnGrad.style.cssText='font-size:11px;padding:4px 12px';
      modeWrap.append(btnSolid,btnGrad);modeRow.appendChild(modeWrap);card.appendChild(modeRow);
      // Pickers
      const colorRow=mkEl('div','sr');colorRow.style.justifyContent='space-between';colorRow.appendChild(mkEl('div','sr-sub','Cor'));
      const colorWrap=mkEl('div');colorWrap.style.cssText='display:flex;align-items:center;gap:8px';
      const pick1=mkEl('input');pick1.type='color';pick1.value=color;pick1.style.cssText='width:36px;height:28px;border:none;border-radius:5px;cursor:pointer;padding:0';
      const arrow=mkEl('span');arrow.textContent='→';arrow.style.cssText='color:var(--muted);display:'+(colorEnd?'inline':'none');
      const pick2=mkEl('input');pick2.type='color';pick2.value=colorEnd||color;pick2.style.cssText='width:36px;height:28px;border:none;border-radius:5px;cursor:pointer;padding:0;display:'+(colorEnd?'block':'none');
      colorWrap.append(pick1,arrow,pick2);colorRow.appendChild(colorWrap);card.appendChild(colorRow);
      btnSolid.addEventListener('click',function(){pick2.style.display='none';arrow.style.display='none';btnSolid.classList.add('active');btnGrad.classList.remove('active');});
      btnGrad.addEventListener('click',function(){pick2.style.display='block';arrow.style.display='inline';btnGrad.classList.add('active');btnSolid.classList.remove('active');});
      function updateAv(){const c2=pick2.style.display!=='none'?pick2.value:null;av.style.background=c2?'linear-gradient(135deg,'+pick1.value+','+c2+')':pick1.value;applyAccountTheme(acc.name,pick1.value,c2);}
      pick1.addEventListener('input',updateAv);pick2.addEventListener('input',updateAv);
      // Salvar
      const actRow=mkEl('div','sr');actRow.style.justifyContent='flex-end';
      const saveBtn=mkEl('button','sr-btn');saveBtn.textContent='Salvar';saveBtn.style.cssText='background:var(--accent);color:#fff;font-size:12px;padding:6px 18px';
      saveBtn.addEventListener('click',async function(){
        saveBtn.textContent='Salvando...';saveBtn.disabled=true;
        const newColor=pick1.value;
        const newColorEnd=pick2.style.display!=='none'?pick2.value:null;
        const newEmoji=emojiInp.value.trim()||null;
        const{error}=await sbClient.from('accounts').update({accent_color:newColor,accent_color_end:newColorEnd,display_emoji:newEmoji}).eq('id',acc.id);
        if(error){adminToast('Erro: '+error.message,false);saveBtn.textContent='Salvar';saveBtn.disabled=false;return;}
        acc.accent_color=newColor;acc.accent_color_end=newColorEnd;acc.display_emoji=newEmoji;
        applyAccountTheme(acc.name,newColor,newColorEnd);
        adminToast(acc.name+' salvo');saveBtn.textContent='Salvo';setTimeout(function(){saveBtn.textContent='Salvar';saveBtn.disabled=false;},1500);
      });
      actRow.appendChild(saveBtn);card.appendChild(actRow);
      body.appendChild(card);
    });
  }
  renderCards();
}
```

- [ ] **Passo 3: Verificar**

Admin -> Temas e Cores:
- Card por conta com avatar, emoji, pickers e botao Salvar.
- Mover pick1 -> avatar do card e botao de perfil na dashboard mudam ao vivo.
- Clicar Gradiente -> pick2 aparece; mover pick2 -> gradiente aplicado ao vivo.
- Salvar -> toast verde, persiste ao reabrir secao.
- Arrastar card -> ordem muda na secao e na barra de perfis.

- [ ] **Passo 4: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: loadAdminThemes com live preview, gradiente, emoji e drag-to-reorder"
```

---

## Task 9: Implementar `loadAdminBehavior()` + variavel `_acDuration`

**Files:**
- Modify: `central-inteligencia-v1.1.html` — variaveis de autocycle + nova funcao

**Sub-passo A: trocar `AC_DURATION` por variavel e adicionar `_acQueue`**

- [ ] **Passo 1: Localizar variaveis de autocycle**

```bash
grep -n "AC_DURATION\|_allAccounts\|_acQueue" projetos/central-inteligencia/central-inteligencia-v1.1.html | head -10
```

- [ ] **Passo 2: Substituir o bloco de declaracao (linhas ~2498–2506)**

Localizar:
```js
let _allAccounts=[];
let _acIdx=0;
...
const AC_INACTIVITY=5;
const AC_DURATION=40;
```

Substituir por:
```js
let _allAccounts=[];
let _acQueue=[];
let _acIdx=0;
let _acTimer=null;
let _acCountdown=null;
let _acInactivity=null;
let _acSecsLeft=0;
let _acEnabled=true;
const AC_INACTIVITY=5;
let _acDuration=40;
```

- [ ] **Passo 3: Substituir `AC_DURATION` por `_acDuration` em `_acStartCycle`**

Localizar (linha ~2521):
```js
  _acSecsLeft=AC_DURATION;
```
Substituir por:
```js
  _acSecsLeft=_acDuration;
```

Localizar (linha ~2525):
```js
    prog.style.transition='width '+AC_DURATION+'s linear';
```
Substituir por:
```js
    prog.style.transition='width '+_acDuration+'s linear';
```

Localizar (linha ~2535):
```js
    _acSwitchTo((_acIdx+1)%_allAccounts.length);
    _acSecsLeft=AC_DURATION;
```
Substituir por:
```js
    const queue=_acQueue.length?_acQueue:_allAccounts;
    _acSwitchTo((_acIdx+1)%queue.length);
    _acSecsLeft=_acDuration;
```

Localizar em `_acStartCycle` a condicao inicial:
```js
  if(!_acEnabled||_acTimer||_allAccounts.length<=1)return;
```
Substituir por:
```js
  const queue=_acQueue.length?_acQueue:_allAccounts;
  if(!_acEnabled||_acTimer||queue.length<=1)return;
```

Localizar em `_acSwitchTo`:
```js
    const acc=_allAccounts[idx];
```
Substituir por:
```js
    const queue=_acQueue.length?_acQueue:_allAccounts;
    const acc=queue[idx]||_allAccounts[idx];
```

**Sub-passo B: inserir `loadAdminBehavior` apos `loadAdminThemes`**

- [ ] **Passo 4: Inserir a funcao**

```js
/* -- COMPORTAMENTO -- */
async function loadAdminBehavior(){
  const body=document.getElementById('admin-behavior-body');
  body.textContent='';
  const loading=mkEl('div');loading.style.cssText='color:var(--muted);font-size:12px';loading.textContent='Carregando...';body.appendChild(loading);
  const[settingsRes,accs]=await Promise.all([
    adFetch('platform_settings?select=key,value').then(function(r){return r.json();}).catch(function(){return[];}),
    sb('accounts?order=display_order.asc,name.asc&select=id,name,in_rotation')
  ]);
  const map={};(Array.isArray(settingsRes)?settingsRes:[]).forEach(function(s){map[s.key]=s.value;});
  body.textContent='';

  // Rotacao automatica
  const rotLabel=mkEl('span','sg-label','Rotacao automatica');body.appendChild(rotLabel);
  const cycleCard=mkEl('div','sg');

  // Slider de intervalo
  const intRow=mkEl('div','sr');intRow.style.justifyContent='space-between';
  const intMain=mkEl('div','sr-main');
  intMain.appendChild(mkEl('div','sr-label','Intervalo por perfil'));
  intMain.appendChild(mkEl('div','sr-sub','Segundos antes de trocar de conta automaticamente'));
  intRow.appendChild(intMain);
  const intRight=mkEl('div');intRight.style.cssText='display:flex;align-items:center;gap:10px;flex-shrink:0';
  const currentInterval=parseInt(map.autocycle_interval||String(_acDuration)||'40');
  const intValLbl=mkEl('span','sr-val',currentInterval+'s');intValLbl.style.minWidth='32px';
  const slider=mkEl('input');slider.type='range';slider.min=10;slider.max=120;slider.step=5;slider.value=currentInterval;
  slider.style.cssText='width:120px;cursor:pointer;accent-color:var(--accent)';
  slider.addEventListener('input',function(){intValLbl.textContent=slider.value+'s';});
  slider.addEventListener('change',async function(){
    _acDuration=parseInt(slider.value);
    const{error}=await sbClient.from('platform_settings').upsert({key:'autocycle_interval',value:slider.value,updated_at:new Date().toISOString()},{onConflict:'key'});
    if(error){adminToast('Erro: '+error.message,false);}else{adminToast('Intervalo: '+slider.value+'s salvo');}
  });
  intRight.append(slider,intValLbl);intRow.appendChild(intRight);cycleCard.appendChild(intRow);

  // Toggles de contas na rotacao
  const rotSub=mkEl('div');rotSub.style.cssText='font-family:"IBM Plex Sans",sans-serif;font-size:11px;color:var(--muted);padding:10px 16px 4px;font-weight:600';rotSub.textContent='Contas incluidas na rotacao';cycleCard.appendChild(rotSub);
  accs.forEach(function(acc){
    const row=mkEl('div','sr');row.style.justifyContent='space-between';row.appendChild(mkEl('div','sr-label',acc.name));
    let isOn=acc.in_rotation!==false;
    const tog=mkEl('div');tog.style.cssText='position:relative;width:38px;height:20px;border-radius:10px;cursor:pointer;transition:background .2s;flex-shrink:0;background:'+(isOn?'var(--accent)':'var(--border)');
    const thumb=mkEl('div');thumb.style.cssText='position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;left:'+(isOn?'20px':'2px');
    tog.appendChild(thumb);
    tog.addEventListener('click',async function(){
      isOn=!isOn;
      tog.style.background=isOn?'var(--accent)':'var(--border)';
      thumb.style.left=isOn?'20px':'2px';
      const{error}=await sbClient.from('accounts').update({in_rotation:isOn}).eq('id',acc.id);
      if(error){adminToast('Erro: '+error.message,false);isOn=!isOn;return;}
      acc.in_rotation=isOn;
      _acQueue=_allAccounts.filter(function(a){return a.in_rotation!==false;});
      adminToast(acc.name+(isOn?' incluida':' removida')+' da rotacao');
    });
    row.appendChild(tog);cycleCard.appendChild(row);
  });
  body.appendChild(cycleCard);

  // Dashboard
  const dashLabel=mkEl('span','sg-label','Dashboard');body.appendChild(dashLabel);
  const dashCard=mkEl('div','sg');

  // Periodo padrao
  const periodRow=mkEl('div','sr');periodRow.style.justifyContent='space-between';
  const pMain=mkEl('div','sr-main');pMain.appendChild(mkEl('div','sr-label','Periodo padrao'));pMain.appendChild(mkEl('div','sr-sub','Periodo selecionado ao abrir o dashboard'));
  periodRow.appendChild(pMain);
  const periodSel=mkEl('select','auth-input');periodSel.style.cssText='max-width:120px;font-size:12px;padding:5px 8px';
  [{v:'0',l:'Hoje'},{v:'1',l:'1 dia'},{v:'7',l:'7 dias'},{v:'14',l:'14 dias'},{v:'30',l:'30 dias'}].forEach(function(opt){
    const o=mkEl('option');o.value=opt.v;o.textContent=opt.l;if(String(map.default_period||'7')===opt.v)o.selected=true;periodSel.appendChild(o);
  });
  periodSel.addEventListener('change',async function(){
    const{error}=await sbClient.from('platform_settings').upsert({key:'default_period',value:periodSel.value,updated_at:new Date().toISOString()},{onConflict:'key'});
    if(error){adminToast('Erro: '+error.message,false);}else{adminToast('Periodo padrao salvo');}
  });
  periodRow.appendChild(periodSel);dashCard.appendChild(periodRow);

  // Header recolhido
  const hdrRow=mkEl('div','sr');hdrRow.style.justifyContent='space-between';
  const hMain=mkEl('div','sr-main');hMain.appendChild(mkEl('div','sr-label','Header recolhido por padrao'));hMain.appendChild(mkEl('div','sr-sub','Barra de perfis comeca minimizada'));
  hdrRow.appendChild(hMain);
  let hOn=(map.header_collapsed_default==='true');
  const hTog=mkEl('div');hTog.style.cssText='position:relative;width:38px;height:20px;border-radius:10px;cursor:pointer;transition:background .2s;flex-shrink:0;background:'+(hOn?'var(--accent)':'var(--border)');
  const hThumb=mkEl('div');hThumb.style.cssText='position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;left:'+(hOn?'20px':'2px');
  hTog.appendChild(hThumb);
  hTog.addEventListener('click',async function(){
    hOn=!hOn;hTog.style.background=hOn?'var(--accent)':'var(--border)';hThumb.style.left=hOn?'20px':'2px';
    const{error}=await sbClient.from('platform_settings').upsert({key:'header_collapsed_default',value:String(hOn),updated_at:new Date().toISOString()},{onConflict:'key'});
    if(error){adminToast('Erro: '+error.message,false);}else{adminToast('Configuracao salva');}
  });
  hdrRow.appendChild(hTog);dashCard.appendChild(hdrRow);
  body.appendChild(dashCard);
}
```

- [ ] **Passo 5: Verificar**

Admin -> Comportamento:
- Slider de intervalo mostra 40s; mover para 20s -> label atualiza; soltar -> toast "Intervalo: 20s salvo".
- Verificar Supabase: `platform_settings` tem `autocycle_interval = '20'`.
- Toggles de contas: clicar -> muda estado + toast.
- Voltar ao dashboard: autocycle usa o novo intervalo.
- Periodo padrao e toggle de header: mudam e persistem.

- [ ] **Passo 6: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: loadAdminBehavior com slider de autocycle, toggles e periodo padrao"
```

---

## Task 10: Refatorar `loadAdminAppearance` — live preview + tema padrao

**Files:**
- Modify: `central-inteligencia-v1.1.html:2790–2811`

- [ ] **Passo 1: Substituir funcao completa**

Localizar `async function loadAdminAppearance()` e substituir o corpo inteiro por:

```js
async function loadAdminAppearance(){
  const settings=await adFetch('platform_settings?select=key,value').then(function(r){return r.json();}).catch(function(){return[];});
  const map={};(Array.isArray(settings)?settings:[]).forEach(function(s){map[s.key]=s.value;});
  const pn=document.getElementById('adm-platform-name');
  if(pn){
    pn.value=map.platform_name||'Inteligencia RBV';
    pn.addEventListener('input',function(){const el=document.getElementById('admin-topbar-title');if(el)el.textContent=pn.value;});
  }
  const fp=document.getElementById('adm-footer-phrase');
  if(fp){
    fp.value=map.footer_phrase||'Mentalidade Vencedora';
    fp.addEventListener('input',function(){const el=document.querySelector('.home-footer-phrase');if(el)el.textContent=fp.value;});
  }
  const dtSel=document.getElementById('adm-default-theme');
  if(dtSel)dtSel.value=map.default_theme||'dark';
}
```

- [ ] **Passo 2: Verificar**

Admin -> Aparencia Global:
- Digitar no campo Nome: titulo "Administracao" no topbar muda ao vivo.
- Digitar na Frase de rodape: frase muda ao vivo na home (visivel ao alternar para home).
- Salvar -> toast verde. Reabrir secao: valores corretos (UPSERT funcionando via Task 2).

- [ ] **Passo 3: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: loadAdminAppearance com live preview; remove cores (agora em Temas)"
```

---

## Task 11: Limpar `loadAdminAccounts` — remover color picker

**Files:**
- Modify: `central-inteligencia-v1.1.html:2766–2784`

- [ ] **Passo 1: Localizar o bloco de cor**

```bash
grep -n "Cor de destaque\|colorPick\|colorRow\|storedColor" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Remover o bloco de Cor de destaque**

Localizar e remover as ~7 linhas do bloco:
```js
    // Linha: Cor de destaque
    const colorRow=mkEl('div','sr');...
    const colorWrap=mkEl('div');...
    const colorPick=mkEl('input');...
    const colorVal=mkEl('span','sr-val',storedColor);
    colorPick.addEventListener('input',...);
    colorWrap.appendChild(colorPick);...card.appendChild(colorRow);
```

- [ ] **Passo 3: Atualizar `saveBtn` — remover `accent_color` e usar `sbClient`**

Localizar o listener do `saveBtn` em `loadAdminAccounts`:
```js
    saveBtn.addEventListener('click',async()=>{
      saveBtn.textContent='Salvando...';saveBtn.disabled=true;
      await adFetch(`accounts?id=eq.${acc.id}`,{method:'PATCH',body:JSON.stringify({name:nameInp.value.trim(),username:usrInp.value.trim(),accent_color:colorPick.value})});
      if(PROFILE_THEMES[acc.name]){...}
      ACCOUNT_PICS[nameInp.value.trim()]=ACCOUNT_PICS[acc.name];
      saveBtn.textContent='Salvo ✓';...
      adminToast('Conta atualizada');
    });
```

Substituir por:
```js
    saveBtn.addEventListener('click',async function(){
      saveBtn.textContent='Salvando...';saveBtn.disabled=true;
      const{error}=await sbClient.from('accounts').update({name:nameInp.value.trim(),username:usrInp.value.trim()}).eq('id',acc.id);
      if(error){adminToast('Erro: '+error.message,false);saveBtn.textContent='Salvar alteracoes';saveBtn.disabled=false;return;}
      ACCOUNT_PICS[nameInp.value.trim()]=ACCOUNT_PICS[acc.name];
      saveBtn.textContent='Salvo';setTimeout(function(){saveBtn.textContent='Salvar alteracoes';saveBtn.disabled=false;},1500);
      adminToast('Conta atualizada');
    });
```

- [ ] **Passo 4: Remover `storedColor` que nao e mais usada para o avatar**

Localizar (linha ~2745):
```js
    const storedColor=acc.accent_color||(PROFILE_THEMES[acc.name]||{accent:'#1A3A6B'}).accent;
```

A variavel `storedColor` era usada para o background do avatar e para o colorPick. Como o colorPick foi removido, o avatar deve usar `PROFILE_THEMES` (ja atualizado por `buildProfiles`):

Substituir por:
```js
    const storedColor=(PROFILE_THEMES[acc.name]||{accent:'#1A3A6B'}).accent;
```

- [ ] **Passo 5: Verificar**

Admin -> Contas: cards sem color picker. Editar nome/username e Salvar: toast verde, Supabase atualizado.

- [ ] **Passo 6: Commit**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "refactor: remove color picker de Contas (centralizado em Temas e Cores)"
```

---

## Task 12: `initAutoCycleToggle` — ler intervalo do banco

**Files:**
- Modify: `central-inteligencia-v1.1.html:2576–2585`

- [ ] **Passo 1: Localizar**

```bash
grep -n "function initAutoCycleToggle" projetos/central-inteligencia/central-inteligencia-v1.1.html
```

- [ ] **Passo 2: Substituir a funcao**

Localizar:
```js
function initAutoCycleToggle(){
  const saved=localStorage.getItem('ac_enabled');
  if(saved==='0'){
    _acEnabled=false;
    const btn=document.getElementById('ac-toggle-btn');
    const track=document.getElementById('ac-toggle-track');
    if(btn)btn.classList.remove('on');
    if(track)track.classList.remove('on');
  }
}
```

Substituir por:
```js
async function initAutoCycleToggle(){
  const saved=localStorage.getItem('ac_enabled');
  if(saved==='0'){
    _acEnabled=false;
    const btn=document.getElementById('ac-toggle-btn');
    const track=document.getElementById('ac-toggle-track');
    if(btn)btn.classList.remove('on');
    if(track)track.classList.remove('on');
  }
  try{
    const rows=await sb('platform_settings?key=eq.autocycle_interval&select=value');
    if(rows.length&&rows[0].value){
      const v=parseInt(rows[0].value);
      if(v>=10&&v<=120)_acDuration=v;
    }
  }catch(e){}
}
```

- [ ] **Passo 3: Verificar**

Salvar intervalo de 20s em Admin -> Comportamento. Recarregar pagina. Autocycle deve trocar a cada 20 segundos (verificar pelo contador no badge).

- [ ] **Passo 4: Commit final**

```bash
git add projetos/central-inteligencia/central-inteligencia-v1.1.html
git commit -m "feat: autocycle le intervalo configurado do banco ao inicializar"
```

---

## Task 13: Verificacao final e commit de encerramento

- [ ] **Passo 1: Estado do git**

```bash
cd /Users/erickmartins/iamundi
git log --oneline -15
git status
```

Esperado: sem arquivos pendentes.

- [ ] **Passo 2: Checklist de regressao**

| Funcionalidade | Esperado |
|---------------|----------|
| Login e carregamento | Funciona normalmente |
| Barra de perfis — ordem | Segue `display_order` do banco |
| Autocycle — intervalo | Usa valor configurado em Comportamento |
| Admin -> Usuarios | Lista, edita role, desativa |
| Admin -> Contas | Edita nome/username sem color picker |
| Admin -> Temas e Cores | Cards com live preview, gradiente, emoji, drag |
| Admin -> Aparencia Global | Nome/frase com live preview, salva corretamente |
| Admin -> Comportamento | Slider, toggles de rotacao, periodo padrao |
| Admin -> Dados | Nao regrediu |
| Admin -> Metas | Nao regrediu |
| Admin -> Sistema | Nao regrediu |
| Toast de erro | Aparece vermelho quando save falha |
| Dark/Light mode | Continua funcionando |

- [ ] **Passo 3: Commit de ajustes finais se necessario**

```bash
git add -p
git commit -m "fix: ajustes finais pos admin-redesign"
```

---

## Notas importantes

**Se o save de `accent_color` ainda falhar apos Task 4:** A tabela `accounts` pode nao ter policy de UPDATE para admin. A migration 002 ja inclui essa policy. Se ja rodou a migration, verificar no Supabase Dashboard -> Authentication -> Policies -> tabela `accounts` se a policy "Admin atualiza accounts" existe.

**`mkEl` helper:** Funcao ja existente no codigo (nao precisa criar). Aceita `(tagName, className, textContent)` e retorna elemento DOM.

**`buildProfiles` e `_acQueue`:** O `_acQueue` so e populado apos `buildProfiles()` ser chamado (no carregamento inicial). Se o usuario altera os toggles em Comportamento, o `_acQueue` e atualizado inline no evento de clique do toggle.
