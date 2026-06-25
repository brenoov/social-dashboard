# Controle de Acessos — Plano 1: Base Manual (Pessoas · Dispositivos · Termo de Responsabilidade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um módulo `Acessos` no dashboard (superadmin) com cadastro de pessoas, inventário de dispositivos/patrimônio por pessoa, termo de responsabilidade (gerar → imprimir → subir assinado → encerrar) e um painel de auditoria — tudo **manual, sem provedores externos**, funcionando sozinho.

**Architecture:** Mesma stack do dashboard: arquivo único `index.html` (HTML + `<script>` inline) com cliente Supabase `sbClient`, dados em tabelas novas `acessos_*` no Supabase (RLS gating só admin/feature `acessos`), termos em bucket privado `acessos-termos`. Sem Edge Function nesta fase — leitura/escrita direta via `sbClient` protegida por RLS; download de termo via `createSignedUrl` client-side; geração do termo via render de HTML + impressão em iframe.

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js` (UMD, global `window.supabase`, cliente `sbClient`), Supabase Postgres + RLS + Storage. Deploy: git push → Vercel (`socialdashboard.rbvcompany.com`).

---

## Convenções deste codebase (LER ANTES)

- **NÃO há framework de testes** (sem pytest/jest) e é **um arquivo só**. "Teste" aqui = (a) **syntax check** dos `<script>` via `node`, (b) **checagem SQL** via Supabase, (c) **smoke test manual** no navegador. Cada task traz os três quando aplicável.
- **Sincronização obrigatória:** edite **`index.html`** e depois copie por cima de `projetos/central-inteligencia/central-inteligencia-v1.3.html` (`cp`). Os dois ficam byte-a-byte idênticos. (Fonte: `LEIA-ME.txt`.)
- **Comando de syntax check** (rode da raiz `/Users/erickmartins/iamundi`):
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
  ```
- **Comando de sync** (rode após cada edição aprovada do `index.html`):
  ```bash
  cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
  ```
- **Migrations de banco:** aplique via Supabase MCP `apply_migration` (project ref `kounqtdoioootxqegkij`) **e** salve o SQL em `db/migrations-acessos/<nome>.sql` no repo (registro). Crie a pasta `db/migrations-acessos/` na Task 1.
- **Padrões de UI a espelhar:** `mkEl(tag,cls,text)`, `adminToast(msg,ok)`, `confirm()` nativo p/ ações destrutivas, `sbClient.from('tabela')...`, `list.replaceChildren()`, botões classe `sr-btn`/`sr-btn danger`, lifecycle `openX()`/`closeX()` + `sessionStorage('rbv-screen')`.
- **Sempre escapar** texto vindo do banco antes de `innerHTML` (XSS). Esta fase define `_acEsc`.
- **Nunca** testar com dados de pessoas reais (criar/excluir/alterar). Usar uma pessoa-teste descartável.

## Nomes (consistência entre tasks)

- Tabelas: `acessos_pessoas`, `acessos_dispositivos`, `acessos_termos`, `acessos_config`, `acessos_log`.
- Bucket: `acessos-termos`; paths `<termo_id>/termo.html` e `<termo_id>/assinado.pdf`.
- Enums (texto, validado por CHECK): pessoa `status` ∈ {ativo,inativo}; dispositivo `status` ∈ {em_uso,a_devolver,devolvido,perdido}; dispositivo `tipo` ∈ {celular,macbook,notebook,numero_celular,carro,outro}; termo `status` ∈ {rascunho,pendente,assinado,encerrado}.
- Estado front: `let _acData={pessoas:[],config:null};` e `let _acSel=null;` (pessoa selecionada) e `let _acTab='pessoas';`.
- Funções front (definidas ao longo do plano): `_acEsc`, `openAcessos`, `closeAcessos`, `loadAcessos`, `_acRender`, `_acRenderPessoas`, `_acOpenPessoa`, `_acFormPessoa`, `_acSavePessoa`, `_acTogglePessoa`, `_acAddDispositivo`, `_acSaveDispositivo`, `_acDelDispositivo`, `_acSetDispStatus`, `_acOpenConfig`, `_acSaveConfig`, `_acTermoHtml`, `_acGerarTermo`, `_acImprimirTermo`, `_acUploadAssinado`, `_acDownloadTermo`, `_acEncerrarTermo`, `_acRenderAuditoria`, `_acLog`.
- Helper de log: `_acLog(acao, alvo, resultado, detalhe)` → insert em `acessos_log`.

---

## File Structure

- **Modify:** `/Users/erickmartins/iamundi/index.html` — todo o módulo (markup + CSS + JS inline). É o único arquivo de código de front.
- **Sync (cópia byte-a-byte, gerada por `cp`):** `/Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html`.
- **Create:** `/Users/erickmartins/iamundi/db/migrations-acessos/001_base.sql`, `002_rls.sql`, `003_storage.sql` — SQL aplicado no Supabase (registro no repo).
- Banco: tabelas `acessos_*` + função `public.is_acessos_admin()` + bucket `acessos-termos` no projeto `kounqtdoioootxqegkij`.

Decomposição: cada task entrega um pedaço testável. Banco primeiro (Tasks 1-3), depois o gate+casca (Tasks 4-5), depois CRUD de pessoas (6), dispositivos (7), config (8), termo (9-10), auditoria (11), log+deploy (12).

---

### Task 1: Schema das tabelas `acessos_*`

**Files:**
- Create: `db/migrations-acessos/001_base.sql`
- Apply: Supabase MCP `apply_migration` (name: `acessos_base`)

- [ ] **Step 1: Escrever o SQL do schema**

Crie `db/migrations-acessos/001_base.sql` com:

```sql
-- Controle de Acessos — base manual (pessoas, dispositivos, termos, config, log)
create table if not exists public.acessos_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  email_pessoal text,
  apple_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.acessos_dispositivos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  tipo text not null check (tipo in ('celular','macbook','notebook','numero_celular','carro','outro')),
  descricao text not null,
  identificador text,
  status text not null default 'em_uso' check (status in ('em_uso','a_devolver','devolvido','perdido')),
  desde date,
  observacao text,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_acessos_disp_pessoa on public.acessos_dispositivos(pessoa_id);

create table if not exists public.acessos_termos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  dispositivo_ids uuid[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho','pendente','assinado','encerrado')),
  modelo_versao text,
  pdf_path text,
  assinado_path text,
  gerado_em timestamptz,
  assinado_em timestamptz,
  encerrado_em timestamptz,
  observacao text
);
create index if not exists idx_acessos_termos_pessoa on public.acessos_termos(pessoa_id);

create table if not exists public.acessos_config (
  id int primary key default 1 check (id = 1),
  empresa text,
  modelo_termo text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.acessos_log (
  id uuid primary key default gen_random_uuid(),
  quando timestamptz not null default now(),
  quem uuid,
  acao text not null,
  provedor text,
  alvo text,
  resultado text not null default 'ok' check (resultado in ('ok','erro')),
  detalhe text
);

-- linha única de config com um modelo de termo padrão
insert into public.acessos_config (id, empresa, modelo_termo)
values (1, 'RBV Company',
'TERMO DE RESPONSABILIDADE DE EQUIPAMENTO

Eu, {{nome}} ({{cargo}}), declaro ter recebido de {{empresa}} os itens abaixo, comprometendo-me a zelar pela sua guarda e conservacao e a devolve-los quando solicitado:

{{itens}}

Data: {{data}}

Assinatura: ____________________________________________')
on conflict (id) do nothing;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Use a tool Supabase MCP `apply_migration` com `name: "acessos_base"` e o conteúdo do arquivo acima.
Expected: sucesso, sem erro.

- [ ] **Step 3: Verificar que as tabelas existem e a config foi semeada**

Rode via Supabase MCP `execute_sql`:
```sql
select table_name from information_schema.tables
where table_schema='public' and table_name like 'acessos_%' order by 1;
select id, empresa, left(modelo_termo,30) as modelo from public.acessos_config;
```
Expected: 5 linhas (`acessos_config`, `acessos_dispositivos`, `acessos_log`, `acessos_pessoas`, `acessos_termos`) e 1 linha de config com `empresa='RBV Company'`.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations-acessos/001_base.sql
git commit -m "feat(acessos): schema base (pessoas, dispositivos, termos, config, log)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: RLS — só admin / feature `acessos`

**Files:**
- Create: `db/migrations-acessos/002_rls.sql`
- Apply: Supabase MCP `apply_migration` (name: `acessos_rls`)

Contexto: `profiles.id` = id do usuário autenticado (`auth.uid()`); `profiles.role` ('admin'/'viewer') e `profiles.features` (text[]) já existem. Quem pode usar o módulo: `role='admin'` OU `'acessos' = any(features)`.

- [ ] **Step 1: Escrever o SQL de RLS**

Crie `db/migrations-acessos/002_rls.sql`:

```sql
-- helper: o usuário atual é admin ou tem a feature 'acessos'?
create or replace function public.is_acessos_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or 'acessos' = any(coalesce(p.features, array[]::text[])))
  );
$$;

alter table public.acessos_pessoas      enable row level security;
alter table public.acessos_dispositivos enable row level security;
alter table public.acessos_termos       enable row level security;
alter table public.acessos_config       enable row level security;
alter table public.acessos_log          enable row level security;

-- pessoas / dispositivos / termos / config: leitura e escrita só p/ acessos-admin
do $$
declare t text;
begin
  foreach t in array array['acessos_pessoas','acessos_dispositivos','acessos_termos','acessos_config'] loop
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format('create policy %I_rw on public.%I for all to authenticated using (public.is_acessos_admin()) with check (public.is_acessos_admin());', t, t);
  end loop;
end $$;

-- log: acessos-admin lê tudo e insere; sem update/delete
drop policy if exists acessos_log_select on public.acessos_log;
create policy acessos_log_select on public.acessos_log for select to authenticated using (public.is_acessos_admin());
drop policy if exists acessos_log_insert on public.acessos_log;
create policy acessos_log_insert on public.acessos_log for insert to authenticated with check (public.is_acessos_admin());
```

- [ ] **Step 2: Aplicar**

Supabase MCP `apply_migration`, `name: "acessos_rls"`, com o SQL acima.
Expected: sucesso.

- [ ] **Step 3: Verificar RLS ligado e policies criadas**

Supabase MCP `execute_sql`:
```sql
select relname, relrowsecurity from pg_class
where relname in ('acessos_pessoas','acessos_dispositivos','acessos_termos','acessos_config','acessos_log');
select tablename, policyname from pg_policies where tablename like 'acessos_%' order by 1,2;
select public.is_acessos_admin() as sou_admin_no_contexto_service;
```
Expected: `relrowsecurity = true` nas 5 tabelas; pelo menos 6 policies; a função existe (o valor de `is_acessos_admin` no contexto do MCP pode ser false/null — ok, ela é avaliada por usuário).

- [ ] **Step 4: Verificar advisors de segurança**

Supabase MCP `get_advisors` (type `security`).
Expected: nenhum aviso novo do tipo "RLS disabled" para tabelas `acessos_*`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations-acessos/002_rls.sql
git commit -m "feat(acessos): RLS + is_acessos_admin() (gate admin/feature acessos)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Bucket privado `acessos-termos` + storage RLS

**Files:**
- Create: `db/migrations-acessos/003_storage.sql`
- Apply: Supabase MCP `apply_migration` (name: `acessos_storage`)

- [ ] **Step 1: Escrever o SQL do bucket + policies**

Crie `db/migrations-acessos/003_storage.sql`:

```sql
-- bucket privado p/ os termos (gerado + assinado)
insert into storage.buckets (id, name, public)
values ('acessos-termos','acessos-termos', false)
on conflict (id) do nothing;

-- acesso aos objetos do bucket só p/ acessos-admin (read+write)
drop policy if exists acessos_termos_rw on storage.objects;
create policy acessos_termos_rw on storage.objects for all to authenticated
using (bucket_id = 'acessos-termos' and public.is_acessos_admin())
with check (bucket_id = 'acessos-termos' and public.is_acessos_admin());
```

- [ ] **Step 2: Aplicar**

Supabase MCP `apply_migration`, `name: "acessos_storage"`.
Expected: sucesso.

- [ ] **Step 3: Verificar bucket privado e policy**

Supabase MCP `execute_sql`:
```sql
select id, public from storage.buckets where id='acessos-termos';
select policyname from pg_policies where tablename='objects' and policyname='acessos_termos_rw';
```
Expected: bucket com `public = false`; policy presente.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations-acessos/003_storage.sql
git commit -m "feat(acessos): bucket privado acessos-termos + storage RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Registrar a permissão `acessos` (gate)

**Files:**
- Modify: `index.html` — `PERMISSION_TREE` (~L3969), array de cards do `showDashboard` (~L4726), router em `showDashboard` (~L4731-4746)

- [ ] **Step 1: Adicionar a chave na `PERMISSION_TREE`**

Em `index.html`, no array `PERMISSION_TREE` (logo após a entrada `{key:'gestor',...}`), adicione:
```js
  {key:'acessos',label:'Controle de Acessos',children:[]},
```

- [ ] **Step 2: Mostrar/ocultar o card por feature**

No `showDashboard`, localize o array em `['social','sales','meta','banco','noticias','gestor']` e troque por:
```js
['social','sales','meta','banco','noticias','gestor','acessos'].forEach(f=>{
```

- [ ] **Step 3: Adicionar a rota de restauração de tela**

No bloco de roteamento dentro de `showDashboard` (onde há `else if(screen==='noticias')openNoticias();`), adicione logo depois:
```js
        else if(screen==='acessos')openAcessos();
```

- [ ] **Step 4: Pré-conceder a feature ao superadmin (SQL)**

Supabase MCP `execute_sql` (garante que o dono já vê o módulo; ajuste o email se o superadmin for outro):
```sql
update public.profiles
set features = (select array(select distinct unnest(coalesce(features,'{}') || array['acessos'])))
where email in ('erick@rbvcompany.com');
select email, features from public.profiles where 'acessos' = any(features);
```
Expected: a linha do superadmin aparece com `acessos` em `features`. (Admins já passam por `role='admin'`, mas isso cobre o gate de card que checa `features`.)

- [ ] **Step 5: Syntax check + sync + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`. (`openAcessos` ainda não existe — tudo bem, é referência tardia dentro de uma função; `new Function` não resolve identificadores em runtime.)
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): registra permissao acessos (tree + card + router)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Casca do módulo — home card, tela, lifecycle e CSS

**Files:**
- Modify: `index.html` — markup do home card (junto aos demais `home-card`, ~L2254-2273), markup da tela (junto aos outros `*-screen`, ~L9972+), CSS (junto a `#noticias-screen`, ~L925), JS (novo bloco de funções)

- [ ] **Step 1: Adicionar o home card**

Logo após o card `home-card-gestor` (~L2273), adicione:
```html
<div class="home-card" id="home-card-acessos" onclick="openAcessos()">
  <div class="home-card-icon" style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  </div>
  <div class="home-card-text">
    <h3>Controle de<br>Acessos</h3>
    <p>Pessoas, dispositivos e termo de responsabilidade</p>
  </div>
  <span class="home-card-enter">→</span>
</div>
```

- [ ] **Step 2: Adicionar o container da tela**

Logo após o fechamento de `<div id="noticias-screen">…</div>` (ou junto aos outros `*-screen`), adicione:
```html
<div id="acessos-screen">
  <div class="ac-topbar">
    <button class="ac-back" onclick="closeAcessos()">← Central</button>
    <div class="ac-title">Controle de Acessos</div>
    <div class="ac-tabs">
      <button class="ac-tab" data-tab="pessoas" onclick="_acSetTab('pessoas')">Pessoas</button>
      <button class="ac-tab" data-tab="auditoria" onclick="_acSetTab('auditoria')">Auditoria</button>
      <button class="ac-tab" data-tab="config" onclick="_acSetTab('config')">Modelo do termo</button>
    </div>
  </div>
  <div class="ac-body" id="ac-body"></div>
</div>
```

- [ ] **Step 3: Adicionar o CSS**

Junto ao bloco CSS de `#noticias-screen` (~L925), adicione:
```css
#acessos-screen{display:none;flex-direction:column;position:fixed;inset:0;background:var(--bg,#0b0f14);z-index:50;overflow:auto}
.ac-topbar{display:flex;align-items:center;gap:18px;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:inherit;flex-wrap:wrap}
.ac-back{background:none;border:1px solid rgba(255,255,255,.18);color:inherit;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
.ac-title{font-weight:700;font-size:18px}
.ac-tabs{display:flex;gap:6px;margin-left:auto}
.ac-tab{background:none;border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px}
.ac-tab.active{background:#0d9488;border-color:#0d9488;color:#fff}
.ac-body{padding:20px 24px;max-width:1100px;width:100%;margin:0 auto}
.ac-card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;margin-bottom:14px}
.ac-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:8px;flex-wrap:wrap}
.ac-row .grow{flex:1;min-width:160px}
.ac-muted{opacity:.6;font-size:12px}
.ac-btn{background:#0d9488;border:none;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px}
.ac-btn.ghost{background:none;border:1px solid rgba(255,255,255,.18);color:inherit}
.ac-btn.danger{background:#991b1b}
.ac-input,.ac-select,.ac-textarea{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.16);color:inherit;border-radius:8px;padding:8px 10px;font-size:13px;width:100%}
.ac-textarea{min-height:160px;font-family:ui-monospace,monospace}
.ac-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ac-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600}
.ac-pill.ok{background:rgba(13,148,136,.2);color:#2dd4bf}
.ac-pill.warn{background:rgba(245,158,11,.18);color:#fbbf24}
.ac-pill.bad{background:rgba(239,68,68,.18);color:#f87171}
@media(max-width:640px){.ac-grid2{grid-template-columns:1fr}.ac-tabs{width:100%;margin-left:0}}
```

- [ ] **Step 4: Adicionar o bloco JS base (lifecycle + escape + tabs + render raiz)**

Em um `<script>` do final do arquivo (junto às outras funções de módulo, ex. perto de `openNoticias`), adicione:
```js
/* ===== Controle de Acessos (base manual) ===== */
let _acData={pessoas:[],config:null};
let _acSel=null;      // id da pessoa aberta (ou null)
let _acTab='pessoas';
function _acEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function _acLog(acao,alvo,resultado,detalhe){
  try{const{data:{session:s}}=await sbClient.auth.getSession();
    await sbClient.from('acessos_log').insert({quem:s?.user?.id||null,acao,alvo:alvo||null,resultado:resultado||'ok',detalhe:detalhe||null});}catch(e){}
}
function openAcessos(){
  if(currentUserRole!=='admin'&&!(currentUserFeatures||[]).includes('acessos')){adminToast('Sem acesso',false);return;}
  document.getElementById('home-screen').style.display='none';
  document.getElementById('acessos-screen').style.display='flex';
  sessionStorage.setItem('rbv-screen','acessos');
  _acTab='pessoas';_acSel=null;
  loadAcessos();
}
function closeAcessos(){
  document.getElementById('acessos-screen').style.display='none';
  showHome();
}
function _acSetTab(t){_acTab=t;_acSel=null;_acRender();}
async function loadAcessos(){
  const body=document.getElementById('ac-body');
  body.innerHTML='<div class="ac-muted">Carregando…</div>';
  const[p,c]=await Promise.all([
    sbClient.from('acessos_pessoas').select('*').order('nome'),
    sbClient.from('acessos_config').select('*').eq('id',1).maybeSingle()
  ]);
  if(p.error){body.innerHTML='<div class="ac-card">Erro: '+_acEsc(p.error.message)+'</div>';return;}
  _acData.pessoas=p.data||[];
  _acData.config=c.data||{empresa:'',modelo_termo:''};
  _acRender();
}
function _acRender(){
  document.querySelectorAll('#acessos-screen .ac-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===_acTab));
  if(_acTab==='config')return _acRenderConfig();
  if(_acTab==='auditoria')return _acRenderAuditoria();
  if(_acSel)return _acRenderFicha(_acSel);
  return _acRenderPessoas();
}
```

- [ ] **Step 5: Adicionar stubs temporários (evitar ReferenceError ao navegar)**

No mesmo bloco JS, adicione stubs que serão substituídos nas próximas tasks:
```js
function _acRenderPessoas(){document.getElementById('ac-body').innerHTML='<div class="ac-muted">Pessoas (em construção)</div>';}
function _acRenderFicha(id){document.getElementById('ac-body').innerHTML='<div class="ac-muted">Ficha (em construção)</div>';}
function _acRenderConfig(){document.getElementById('ac-body').innerHTML='<div class="ac-muted">Modelo (em construção)</div>';}
function _acRenderAuditoria(){document.getElementById('ac-body').innerHTML='<div class="ac-muted">Auditoria (em construção)</div>';}
```

- [ ] **Step 6: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke manual:** abrir o `index.html` no navegador logado como admin → o card "Controle de Acessos" aparece na Central → clicar abre a tela com as 3 abas e "Pessoas (em construção)"; clicar nas abas troca o conteúdo; "← Central" volta. (Pode usar a URL de prod só depois do deploy; localmente, se houver login, testar lá.)
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): casca do modulo (card, tela, abas, lifecycle, CSS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: CRUD de Pessoas (lista + adicionar/editar + ativar/inativar)

**Files:**
- Modify: `index.html` — substituir o stub `_acRenderPessoas` e adicionar `_acOpenPessoa/_acFormPessoa/_acSavePessoa/_acTogglePessoa`

- [ ] **Step 1: Implementar a lista de pessoas**

Substitua o stub `_acRenderPessoas` por:
```js
function _acRenderPessoas(){
  const body=document.getElementById('ac-body');
  const rows=_acData.pessoas.map(p=>`
    <div class="ac-row">
      <div class="grow">
        <div><strong>${_acEsc(p.nome)}</strong> ${p.status==='inativo'?'<span class="ac-pill bad">inativo</span>':'<span class="ac-pill ok">ativo</span>'}</div>
        <div class="ac-muted">${_acEsc(p.cargo||'—')}${p.email_pessoal?' · '+_acEsc(p.email_pessoal):''}</div>
      </div>
      <button class="ac-btn ghost" onclick="_acOpenPessoa('${p.id}')">Abrir ficha</button>
    </div>`).join('');
  body.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <h3 style="margin:0">Pessoas <span class="ac-muted">(${_acData.pessoas.length})</span></h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acFormPessoa()">+ Nova pessoa</button>
    </div>
    ${rows||'<div class="ac-muted">Nenhuma pessoa cadastrada ainda.</div>'}`;
}
```

- [ ] **Step 2: Implementar o formulário de pessoa (criar/editar) inline**

Adicione:
```js
function _acFormPessoa(id){
  const p=id?_acData.pessoas.find(x=>x.id===id):{nome:'',cargo:'',email_pessoal:'',apple_id:'',status:'ativo'};
  if(!p)return;
  const body=document.getElementById('ac-body');
  body.innerHTML=`
    <div class="ac-card" style="max-width:560px">
      <h3 style="margin-top:0">${id?'Editar pessoa':'Nova pessoa'}</h3>
      <div class="ac-grid2">
        <label>Nome<input class="ac-input" id="acf-nome" value="${_acEsc(p.nome)}"></label>
        <label>Cargo<input class="ac-input" id="acf-cargo" value="${_acEsc(p.cargo||'')}"></label>
        <label>E-mail pessoal<input class="ac-input" id="acf-email" value="${_acEsc(p.email_pessoal||'')}"></label>
        <label>Apple ID<input class="ac-input" id="acf-apple" value="${_acEsc(p.apple_id||'')}"></label>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="ac-btn" onclick="_acSavePessoa(${id?"'"+id+"'":'null'})">Salvar</button>
        <button class="ac-btn ghost" onclick="${id?"_acOpenPessoa('"+id+"')":"_acSetTab('pessoas')"}">Cancelar</button>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Implementar salvar (insert/update)**

Adicione:
```js
async function _acSavePessoa(id){
  const rec={
    nome:document.getElementById('acf-nome').value.trim(),
    cargo:document.getElementById('acf-cargo').value.trim()||null,
    email_pessoal:document.getElementById('acf-email').value.trim()||null,
    apple_id:document.getElementById('acf-apple').value.trim()||null,
    atualizado_em:new Date().toISOString()
  };
  if(!rec.nome){adminToast('Nome é obrigatório',false);return;}
  let err;
  if(id){({error:err}=await sbClient.from('acessos_pessoas').update(rec).eq('id',id));}
  else{const r=await sbClient.from('acessos_pessoas').insert(rec).select('id').single();err=r.error;id=r.data?.id;}
  if(err){adminToast('Erro: '+err.message,false);return;}
  await _acLog(id?'pessoa.editar':'pessoa.criar','pessoa:'+rec.nome,'ok',null);
  adminToast('Pessoa salva');
  await loadAcessos();_acOpenPessoa(id);
}
```

- [ ] **Step 4: Implementar abrir ficha (placeholder até a Task 7) + ativar/inativar**

Substitua o stub `_acRenderFicha` por uma versão mínima que mostra dados da pessoa e o botão de status (dispositivos/termos entram na Task 7/9):
```js
function _acOpenPessoa(id){_acSel=id;_acTab='pessoas';_acRender();}
async function _acTogglePessoa(id){
  const p=_acData.pessoas.find(x=>x.id===id);if(!p)return;
  const novo=p.status==='ativo'?'inativo':'ativo';
  if(!confirm(`Marcar "${p.nome}" como ${novo}?`))return;
  const{error}=await sbClient.from('acessos_pessoas').update({status:novo,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('pessoa.status','pessoa:'+p.nome,'ok',novo);
  adminToast('Status atualizado');
  await loadAcessos();_acOpenPessoa(id);
}
function _acRenderFicha(id){
  const p=_acData.pessoas.find(x=>x.id===id);
  if(!p){_acSel=null;return _acRenderPessoas();}
  const body=document.getElementById('ac-body');
  body.innerHTML=`
    <button class="ac-btn ghost" onclick="_acSetTab('pessoas')">← Pessoas</button>
    <div class="ac-card" style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 style="margin:0">${_acEsc(p.nome)}</h2>
        ${p.status==='inativo'?'<span class="ac-pill bad">inativo</span>':'<span class="ac-pill ok">ativo</span>'}
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="ac-btn ghost" onclick="_acFormPessoa('${p.id}')">Editar</button>
          <button class="ac-btn ${p.status==='ativo'?'danger':''}" onclick="_acTogglePessoa('${p.id}')">${p.status==='ativo'?'Inativar':'Reativar'}</button>
        </div>
      </div>
      <div class="ac-muted" style="margin-top:6px">${_acEsc(p.cargo||'—')}${p.email_pessoal?' · '+_acEsc(p.email_pessoal):''}${p.apple_id?' · Apple ID: '+_acEsc(p.apple_id):''}</div>
    </div>
    <div id="ac-disp-wrap"></div>
    <div id="ac-termos-wrap"></div>`;
  if(window._acRenderDispositivos)_acRenderDispositivos(id);
  if(window._acRenderTermos)_acRenderTermos(id);
}
```

- [ ] **Step 5: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** criar uma pessoa-teste "ZZ Teste" → aparece na lista → abrir ficha → editar cargo → inativar/reativar. Conferir no banco: `select nome,status from acessos_pessoas order by atualizado_em desc limit 3;`
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): CRUD de pessoas + ficha + ativar/inativar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Dispositivos por pessoa (inventário + status)

**Files:**
- Modify: `index.html` — adicionar `_acRenderDispositivos/_acAddDispositivo/_acSaveDispositivo/_acDelDispositivo/_acSetDispStatus`

- [ ] **Step 1: Renderizar a lista de dispositivos da pessoa**

Adicione (a ficha já chama `_acRenderDispositivos(id)` no `#ac-disp-wrap`):
```js
const AC_TIPOS=[['celular','Celular'],['macbook','MacBook'],['notebook','Notebook'],['numero_celular','Número de linha'],['carro','Carro'],['outro','Outro']];
const AC_DST=[['em_uso','Em uso','ok'],['a_devolver','A devolver','warn'],['devolvido','Devolvido',''],['perdido','Perdido','bad']];
function _acTipoLabel(t){return (AC_TIPOS.find(x=>x[0]===t)||[t,t])[1];}
function _acDstMeta(s){return AC_DST.find(x=>x[0]===s)||[s,s,''];}
async function _acRenderDispositivos(pessoaId){
  const wrap=document.getElementById('ac-disp-wrap');if(!wrap)return;
  const{data,error}=await sbClient.from('acessos_dispositivos').select('*').eq('pessoa_id',pessoaId).order('atualizado_em',{ascending:false});
  if(error){wrap.innerHTML='<div class="ac-card">Erro dispositivos: '+_acEsc(error.message)+'</div>';return;}
  const list=(data||[]).map(d=>{
    const m=_acDstMeta(d.status);
    return `<div class="ac-row">
      <div class="grow">
        <div><strong>${_acEsc(_acTipoLabel(d.tipo))}</strong> — ${_acEsc(d.descricao)} <span class="ac-pill ${m[2]||'warn'}">${_acEsc(m[1])}</span></div>
        <div class="ac-muted">${d.identificador?'ID: '+_acEsc(d.identificador):'sem identificador'}${d.desde?' · desde '+_acEsc(d.desde):''}${d.observacao?' · '+_acEsc(d.observacao):''}</div>
      </div>
      <select class="ac-select" style="width:auto" onchange="_acSetDispStatus('${d.id}','${pessoaId}',this.value)">
        ${AC_DST.map(s=>`<option value="${s[0]}" ${s[0]===d.status?'selected':''}>${s[1]}</option>`).join('')}
      </select>
      <button class="ac-btn ghost" onclick="_acAddDispositivo('${pessoaId}','${d.id}')">Editar</button>
      <button class="ac-btn danger" onclick="_acDelDispositivo('${d.id}','${pessoaId}')">Excluir</button>
    </div>`;}).join('');
  wrap.innerHTML=`<div class="ac-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <h3 style="margin:0">Dispositivos / patrimônio</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acAddDispositivo('${pessoaId}')">+ Adicionar</button>
    </div>
    ${list||'<div class="ac-muted">Nenhum item registrado.</div>'}
  </div>`;
}
```

- [ ] **Step 2: Formulário de dispositivo (criar/editar) via prompt simples em modal inline**

Adicione um mini-form que aparece no topo do `#ac-disp-wrap`:
```js
async function _acAddDispositivo(pessoaId,id){
  let d={tipo:'celular',descricao:'',identificador:'',desde:'',observacao:''};
  if(id){const{data}=await sbClient.from('acessos_dispositivos').select('*').eq('id',id).single();if(data)d=data;}
  const wrap=document.getElementById('ac-disp-wrap');
  const form=document.createElement('div');form.className='ac-card';
  form.innerHTML=`<h3 style="margin-top:0">${id?'Editar item':'Novo item'}</h3>
    <div class="ac-grid2">
      <label>Tipo<select class="ac-select" id="acd-tipo">${AC_TIPOS.map(t=>`<option value="${t[0]}" ${t[0]===d.tipo?'selected':''}>${t[1]}</option>`).join('')}</select></label>
      <label>Descrição / modelo<input class="ac-input" id="acd-desc" value="${_acEsc(d.descricao||'')}"></label>
      <label>Identificador (serial/IMEI/placa/número)<input class="ac-input" id="acd-ident" value="${_acEsc(d.identificador||'')}"></label>
      <label>Desde<input class="ac-input" id="acd-desde" type="date" value="${_acEsc(d.desde||'')}"></label>
      <label style="grid-column:1/-1">Observação<input class="ac-input" id="acd-obs" value="${_acEsc(d.observacao||'')}"></label>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="ac-btn" id="acd-save">Salvar</button>
      <button class="ac-btn ghost" id="acd-cancel">Cancelar</button>
    </div>`;
  wrap.prepend(form);
  form.querySelector('#acd-cancel').onclick=()=>_acRenderDispositivos(pessoaId);
  form.querySelector('#acd-save').onclick=()=>_acSaveDispositivo(pessoaId,id||null);
}
```

- [ ] **Step 3: Salvar dispositivo**

Adicione:
```js
async function _acSaveDispositivo(pessoaId,id){
  const rec={
    pessoa_id:pessoaId,
    tipo:document.getElementById('acd-tipo').value,
    descricao:document.getElementById('acd-desc').value.trim(),
    identificador:document.getElementById('acd-ident').value.trim()||null,
    desde:document.getElementById('acd-desde').value||null,
    observacao:document.getElementById('acd-obs').value.trim()||null,
    atualizado_em:new Date().toISOString()
  };
  if(!rec.descricao){adminToast('Descrição é obrigatória',false);return;}
  let err;
  if(id){({error:err}=await sbClient.from('acessos_dispositivos').update(rec).eq('id',id));}
  else{({error:err}=await sbClient.from('acessos_dispositivos').insert(rec));}
  if(err){adminToast('Erro: '+err.message,false);return;}
  await _acLog(id?'dispositivo.editar':'dispositivo.criar','disp:'+rec.descricao,'ok',rec.tipo);
  adminToast('Item salvo');
  _acRenderDispositivos(pessoaId);
}
```

- [ ] **Step 4: Mudar status e excluir**

Adicione:
```js
async function _acSetDispStatus(id,pessoaId,status){
  const{error}=await sbClient.from('acessos_dispositivos').update({status,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('dispositivo.status','disp:'+id,'ok',status);
  adminToast('Status atualizado');_acRenderDispositivos(pessoaId);
}
async function _acDelDispositivo(id,pessoaId){
  if(!confirm('Excluir este item do inventário?'))return;
  const{error}=await sbClient.from('acessos_dispositivos').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('dispositivo.excluir','disp:'+id,'ok',null);
  adminToast('Item excluído');_acRenderDispositivos(pessoaId);
}
```

- [ ] **Step 5: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** na ficha da pessoa-teste, adicionar um "MacBook" e um "Número de linha", editar um, mudar status para "A devolver", excluir o outro. Conferir: `select tipo,descricao,status from acessos_dispositivos order by atualizado_em desc limit 5;`
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): inventario de dispositivos por pessoa + status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Modelo do termo (aba Config)

**Files:**
- Modify: `index.html` — substituir o stub `_acRenderConfig` e adicionar `_acSaveConfig`

- [ ] **Step 1: Implementar o editor do modelo**

Substitua o stub `_acRenderConfig` por:
```js
function _acRenderConfig(){
  const c=_acData.config||{empresa:'',modelo_termo:''};
  document.getElementById('ac-body').innerHTML=`
    <div class="ac-card" style="max-width:760px">
      <h3 style="margin-top:0">Modelo do termo de responsabilidade</h3>
      <p class="ac-muted">Placeholders disponíveis: <code>{{nome}}</code> <code>{{cargo}}</code> <code>{{empresa}}</code> <code>{{itens}}</code> <code>{{data}}</code>.</p>
      <label>Empresa<input class="ac-input" id="acc-empresa" value="${_acEsc(c.empresa||'')}"></label>
      <label style="display:block;margin-top:10px">Texto do termo
        <textarea class="ac-textarea" id="acc-modelo">${_acEsc(c.modelo_termo||'')}</textarea>
      </label>
      <div style="margin-top:12px"><button class="ac-btn" onclick="_acSaveConfig()">Salvar modelo</button></div>
    </div>`;
}
async function _acSaveConfig(){
  const rec={id:1,empresa:document.getElementById('acc-empresa').value.trim(),
    modelo_termo:document.getElementById('acc-modelo').value,atualizado_em:new Date().toISOString()};
  const{error}=await sbClient.from('acessos_config').upsert(rec,{onConflict:'id'});
  if(error){adminToast('Erro: '+error.message,false);return;}
  _acData.config=rec;await _acLog('config.salvar','modelo_termo','ok',null);
  adminToast('Modelo salvo');
}
```

- [ ] **Step 2: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** aba "Modelo do termo" → editar a empresa e o texto → salvar → recarregar a tela → o texto persiste. Conferir: `select empresa,left(modelo_termo,40) from acessos_config where id=1;`
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): editor do modelo do termo (config)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Termo — gerar (render do modelo → HTML no Storage) + imprimir

**Files:**
- Modify: `index.html` — adicionar `_acRenderTermos/_acTermoHtml/_acGerarTermo/_acImprimirTermo`

- [ ] **Step 1: Renderizar a seção de termos na ficha + seletor de itens p/ gerar**

A ficha já chama `_acRenderTermos(id)` no `#ac-termos-wrap`. Adicione:
```js
const AC_TST=[['rascunho','Rascunho','warn'],['pendente','Pendente assinatura','warn'],['assinado','Assinado','ok'],['encerrado','Encerrado','']];
function _acTstMeta(s){return AC_TST.find(x=>x[0]===s)||[s,s,''];}
async function _acRenderTermos(pessoaId){
  const wrap=document.getElementById('ac-termos-wrap');if(!wrap)return;
  const[{data:disps},{data:termos,error}]=await Promise.all([
    sbClient.from('acessos_dispositivos').select('id,tipo,descricao').eq('pessoa_id',pessoaId),
    sbClient.from('acessos_termos').select('*').eq('pessoa_id',pessoaId).order('gerado_em',{ascending:false,nullsFirst:false})
  ]);
  if(error){wrap.innerHTML='<div class="ac-card">Erro termos: '+_acEsc(error.message)+'</div>';return;}
  const dispOpts=(disps||[]).map(d=>`<label style="display:block"><input type="checkbox" class="ac-tdisp" value="${d.id}"> ${_acEsc(_acTipoLabel(d.tipo))} — ${_acEsc(d.descricao)}</label>`).join('')||'<div class="ac-muted">Cadastre dispositivos para gerar um termo.</div>';
  const tlist=(termos||[]).map(t=>{
    const m=_acTstMeta(t.status);const n=(t.dispositivo_ids||[]).length;
    return `<div class="ac-row">
      <div class="grow">
        <div><strong>Termo</strong> <span class="ac-pill ${m[2]||'warn'}">${_acEsc(m[1])}</span> <span class="ac-muted">${n} item(ns)${t.gerado_em?' · gerado '+new Date(t.gerado_em).toLocaleDateString('pt-BR'):''}</span></div>
      </div>
      ${t.pdf_path?`<button class="ac-btn ghost" onclick="_acImprimirTermo('${t.id}')">Imprimir</button>`:''}
      ${t.pdf_path?`<button class="ac-btn ghost" onclick="_acDownloadTermo('${t.id}','pdf_path')">Baixar gerado</button>`:''}
      ${t.status==='pendente'?`<button class="ac-btn" onclick="document.getElementById('act-up-${t.id}').click()">Subir assinado</button><input id="act-up-${t.id}" type="file" accept="application/pdf" style="display:none" onchange="_acUploadAssinado('${t.id}','${pessoaId}',this.files[0])">`:''}
      ${t.assinado_path?`<button class="ac-btn ghost" onclick="_acDownloadTermo('${t.id}','assinado_path')">Baixar assinado</button>`:''}
      ${t.status!=='encerrado'?`<button class="ac-btn danger" onclick="_acEncerrarTermo('${t.id}','${pessoaId}')">Encerrar</button>`:''}
    </div>`;}).join('');
  wrap.innerHTML=`<div class="ac-card">
    <h3 style="margin-top:0">Termo de responsabilidade</h3>
    <div class="ac-card" style="background:rgba(255,255,255,.02)">
      <div class="ac-muted" style="margin-bottom:6px">Selecione os itens cobertos e gere o termo:</div>
      ${dispOpts}
      <div style="margin-top:10px"><button class="ac-btn" onclick="_acGerarTermo('${pessoaId}')">Gerar termo</button></div>
    </div>
    <div style="margin-top:12px">${tlist||'<div class="ac-muted">Nenhum termo ainda.</div>'}</div>
  </div>`;
}
```

- [ ] **Step 2: Montar o HTML do termo a partir do modelo**

Adicione:
```js
function _acTermoHtml(pessoa,disps,config){
  const itens=disps.map(d=>'- '+_acTipoLabel(d.tipo)+': '+(d.descricao||'')+(d.identificador?(' ('+d.identificador+')'):'')).join('\n');
  const modelo=(config&&config.modelo_termo)||'';
  const txt=modelo
    .replace(/{{nome}}/g,pessoa.nome||'')
    .replace(/{{cargo}}/g,pessoa.cargo||'')
    .replace(/{{empresa}}/g,(config&&config.empresa)||'')
    .replace(/{{itens}}/g,itens||'(nenhum item)')
    .replace(/{{data}}/g,new Date().toLocaleDateString('pt-BR'));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo</title>
    <style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}
    pre{white-space:pre-wrap;font-family:inherit;font-size:15px}@media print{body{margin:0}}</style></head>
    <body><pre>${_acEsc(txt)}</pre></body></html>`;
}
```

- [ ] **Step 3: Gerar o termo (upload do HTML + registro pendente)**

Adicione:
```js
async function _acGerarTermo(pessoaId){
  const ids=[...document.querySelectorAll('.ac-tdisp:checked')].map(c=>c.value);
  if(!ids.length){adminToast('Selecione ao menos um item',false);return;}
  const pessoa=_acData.pessoas.find(p=>p.id===pessoaId);
  const{data:disps}=await sbClient.from('acessos_dispositivos').select('*').in('id',ids);
  // cria o registro p/ obter o id
  const{data:novo,error:e1}=await sbClient.from('acessos_termos')
    .insert({pessoa_id:pessoaId,dispositivo_ids:ids,status:'pendente',modelo_versao:(_acData.config?.atualizado_em||null),gerado_em:new Date().toISOString()})
    .select('id').single();
  if(e1){adminToast('Erro: '+e1.message,false);return;}
  const path=novo.id+'/termo.html';
  const html=_acTermoHtml(pessoa,disps||[],_acData.config);
  const blob=new Blob([html],{type:'text/html'});
  const{error:e2}=await sbClient.storage.from('acessos-termos').upload(path,blob,{upsert:true,contentType:'text/html'});
  if(e2){adminToast('Erro storage: '+e2.message,false);return;}
  await sbClient.from('acessos_termos').update({pdf_path:path}).eq('id',novo.id);
  await _acLog('termo.gerar','termo:'+novo.id,'ok',ids.length+' itens');
  adminToast('Termo gerado');_acRenderTermos(pessoaId);
}
```

- [ ] **Step 4: Imprimir (iframe → print) — novo padrão neste codebase**

Adicione (busca o HTML gerado via URL assinada e imprime num iframe oculto):
```js
async function _acImprimirTermo(termoId){
  const{data,error}=await sbClient.from('acessos_termos').select('pdf_path').eq('id',termoId).single();
  if(error||!data?.pdf_path){adminToast('Termo gerado não encontrado',false);return;}
  const{data:sg,error:e2}=await sbClient.storage.from('acessos-termos').createSignedUrl(data.pdf_path,120);
  if(e2){adminToast('Erro URL: '+e2.message,false);return;}
  let f=document.getElementById('ac-print-frame');
  if(!f){f=document.createElement('iframe');f.id='ac-print-frame';f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);}
  f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){window.open(sg.signedUrl,'_blank');}};
  f.src=sg.signedUrl;
}
```

- [ ] **Step 5: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** na ficha da pessoa-teste, marcar 1-2 dispositivos → "Gerar termo" → surge um termo "Pendente assinatura" → "Imprimir" abre a janela de impressão com nome/itens/data corretos. Conferir: `select status,pdf_path,gerado_em from acessos_termos order by gerado_em desc limit 3;` e que o objeto existe no bucket (Supabase MCP `execute_sql`: `select name from storage.objects where bucket_id='acessos-termos' order by created_at desc limit 3;`).
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): gerar termo (HTML no storage) + imprimir via iframe

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Termo — subir assinado, baixar, encerrar

**Files:**
- Modify: `index.html` — adicionar `_acUploadAssinado/_acDownloadTermo/_acEncerrarTermo`

- [ ] **Step 1: Subir o PDF assinado**

Adicione:
```js
async function _acUploadAssinado(termoId,pessoaId,file){
  if(!file){return;}
  if(file.type!=='application/pdf'){adminToast('Envie um PDF',false);return;}
  const path=termoId+'/assinado.pdf';
  const{error:e1}=await sbClient.storage.from('acessos-termos').upload(path,file,{upsert:true,contentType:'application/pdf'});
  if(e1){adminToast('Erro upload: '+e1.message,false);return;}
  const{error:e2}=await sbClient.from('acessos_termos').update({assinado_path:path,status:'assinado',assinado_em:new Date().toISOString()}).eq('id',termoId);
  if(e2){adminToast('Erro: '+e2.message,false);return;}
  await _acLog('termo.assinar','termo:'+termoId,'ok',null);
  adminToast('Termo assinado anexado');_acRenderTermos(pessoaId);
}
```

- [ ] **Step 2: Baixar (gerado ou assinado) via URL assinada**

Adicione:
```js
async function _acDownloadTermo(termoId,col){
  const{data,error}=await sbClient.from('acessos_termos').select(col).eq('id',termoId).single();
  if(error||!data?.[col]){adminToast('Arquivo não encontrado',false);return;}
  const{data:sg,error:e2}=await sbClient.storage.from('acessos-termos').createSignedUrl(data[col],120);
  if(e2){adminToast('Erro URL: '+e2.message,false);return;}
  window.open(sg.signedUrl,'_blank');
}
```

- [ ] **Step 3: Encerrar o termo**

Adicione:
```js
async function _acEncerrarTermo(termoId,pessoaId){
  if(!confirm('Encerrar este termo? (use quando os itens forem devolvidos)'))return;
  const{error}=await sbClient.from('acessos_termos').update({status:'encerrado',encerrado_em:new Date().toISOString()}).eq('id',termoId);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('termo.encerrar','termo:'+termoId,'ok',null);
  adminToast('Termo encerrado');_acRenderTermos(pessoaId);
}
```

- [ ] **Step 4: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** num termo "Pendente", "Subir assinado" com um PDF qualquer de teste → vira "Assinado", botão "Baixar assinado" abre o PDF; "Encerrar" → vira "Encerrado". Conferir: `select status,assinado_path,assinado_em,encerrado_em from acessos_termos order by gerado_em desc limit 3;`
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): subir assinado, baixar (url assinada) e encerrar termo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Auditoria (quem tem o quê + divergências)

**Files:**
- Modify: `index.html` — substituir o stub `_acRenderAuditoria`

- [ ] **Step 1: Implementar o painel de auditoria**

Substitua o stub `_acRenderAuditoria` por:
```js
async function _acRenderAuditoria(){
  const body=document.getElementById('ac-body');
  body.innerHTML='<div class="ac-muted">Carregando auditoria…</div>';
  const[{data:pessoas},{data:disps},{data:termos}]=await Promise.all([
    sbClient.from('acessos_pessoas').select('*').order('nome'),
    sbClient.from('acessos_dispositivos').select('*'),
    sbClient.from('acessos_termos').select('id,pessoa_id,dispositivo_ids,status')
  ]);
  const byPessoaDisp={},assinadoDisp=new Set();
  (disps||[]).forEach(d=>{(byPessoaDisp[d.pessoa_id]=byPessoaDisp[d.pessoa_id]||[]).push(d);});
  (termos||[]).forEach(t=>{if(t.status==='assinado')(t.dispositivo_ids||[]).forEach(id=>assinadoDisp.add(id));});
  const flags=[];
  (pessoas||[]).forEach(p=>{
    const ds=byPessoaDisp[p.id]||[];
    if(p.status==='inativo'){ds.filter(d=>d.status==='em_uso'||d.status==='a_devolver').forEach(d=>flags.push(`Pessoa inativa <strong>${_acEsc(p.nome)}</strong> ainda com item <em>${_acEsc(d.descricao)}</em> (${_acEsc(_acDstMeta(d.status)[1])})`));}
    ds.filter(d=>d.status==='em_uso'&&!assinadoDisp.has(d.id)).forEach(d=>flags.push(`Item <em>${_acEsc(d.descricao)}</em> de <strong>${_acEsc(p.nome)}</strong> está em uso <strong>sem termo assinado</strong>`));
  });
  const linhas=(pessoas||[]).map(p=>{
    const ds=byPessoaDisp[p.id]||[];
    const itens=ds.length?ds.map(d=>`${_acEsc(_acTipoLabel(d.tipo))} (${_acEsc(_acDstMeta(d.status)[1])})`).join(', '):'<span class="ac-muted">sem itens</span>';
    return `<div class="ac-row"><div class="grow"><strong>${_acEsc(p.nome)}</strong> ${p.status==='inativo'?'<span class="ac-pill bad">inativo</span>':''}<div class="ac-muted">${itens}</div></div></div>`;
  }).join('');
  body.innerHTML=`
    <div class="ac-card">
      <h3 style="margin-top:0">Divergências ${flags.length?`<span class="ac-pill bad">${flags.length}</span>`:'<span class="ac-pill ok">0</span>'}</h3>
      ${flags.length?flags.map(f=>`<div class="ac-row" style="border-color:rgba(239,68,68,.4)">⚠️ ${f}</div>`).join(''):'<div class="ac-muted">Nenhuma divergência.</div>'}
    </div>
    <div class="ac-card">
      <h3 style="margin-top:0">Quem tem o quê</h3>
      ${linhas||'<div class="ac-muted">Sem pessoas.</div>'}
    </div>`;
}
```

- [ ] **Step 2: Syntax check + sync + smoke + commit**

```bash
cd /Users/erickmartins/iamundi
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
```
Expected: `SINTAXE OK`.
**Smoke:** aba "Auditoria" → a pessoa-teste com item "em uso" sem termo assinado aparece como divergência; inativar a pessoa-teste com item em uso gera a 2ª divergência; a tabela "Quem tem o quê" lista pessoa + itens.
```bash
cp /Users/erickmartins/iamundi/index.html /Users/erickmartins/iamundi/projetos/central-inteligencia/central-inteligencia-v1.3.html
git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html
git commit -m "feat(acessos): painel de auditoria (quem tem o que + divergencias)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Limpeza da pessoa-teste, verificação do log e deploy

**Files:**
- Banco: limpar dados de teste
- Deploy: git push (somente quando o dono autorizar)

- [ ] **Step 1: Conferir que o log registrou as ações da fase**

Supabase MCP `execute_sql`:
```sql
select quando, acao, alvo, resultado from public.acessos_log order by quando desc limit 20;
```
Expected: linhas de `pessoa.criar`, `dispositivo.criar`, `termo.gerar`, `termo.assinar`, etc.

- [ ] **Step 2: Remover a pessoa-teste (cascata limpa dispositivos/termos)**

Supabase MCP `execute_sql` (ajuste o nome se usou outro):
```sql
delete from public.acessos_pessoas where nome ilike 'ZZ Teste%';
select count(*) as pessoas_restantes from public.acessos_pessoas;
```
Também remova os objetos de teste do bucket pela aba Storage do Supabase, se desejar (os paths `<termo_id>/...` dos termos da pessoa-teste).

- [ ] **Step 3: Confirmação final de integridade dos dois arquivos**

```bash
cd /Users/erickmartins/iamundi
cmp index.html projetos/central-inteligencia/central-inteligencia-v1.3.html && echo "IDENTICOS"
```
Expected: `IDENTICOS` (sem saída do `cmp` = arquivos iguais).

- [ ] **Step 4: Deploy (apenas com OK do dono)**

> Não rode sem autorização explícita. Quando autorizado, da raiz do repo:
```bash
cd /Users/erickmartins/iamundi
git push origin main
```
Depois, validar no ar em `https://socialdashboard.rbvcompany.com`: card "Controle de Acessos" abre; criar uma pessoa real simples; abas funcionam; mobile não estoura a tela.

---

## Self-Review (rodado contra a spec)

**1. Spec coverage (seção a seção da spec):**
- "Cadastro próprio de pessoas (fonte da verdade)" → Task 6 ✔
- "Patrimônio/dispositivos por pessoa (manual)" → Task 7 ✔
- "Termo de responsabilidade: gerar/assinar/guardar/encerrar" → Tasks 9, 10 ✔
- "`acessos_config` modelo editável com placeholders" → Task 8 ✔ (placeholders `{{nome}}/{{cargo}}/{{empresa}}/{{itens}}/{{data}}` consistentes entre Task 1 seed, Task 8 dica e Task 9 `_acTermoHtml`)
- "Tabelas `acessos_pessoas/dispositivos/termos/config/log`" → Task 1 ✔ (as tabelas de provedores — `acessos_recursos/vinculos/zoho/conexoes` — ficam para os planos 2-4; **fora do escopo deste plano**, declarado no topo)
- "RLS restrita (só admin/feature acessos)" → Task 2 ✔
- "Storage dos termos: bucket privado + URL assinada de curta duração" → Tasks 3, 9 (impressão), 10 (download) ✔ (`createSignedUrl(...,120)`)
- "Permissão nova `acessos` (PERMISSION_TREE + features)" → Task 4 ✔
- "Auditoria: quem tem o quê + divergências (item em_uso sem termo, pessoa inativa com item)" → Task 11 ✔
- "Confirmação antes de ações destrutivas + log" → `confirm()` em inativar/excluir/encerrar + `_acLog` em todas as mutações (Tasks 6-10) ✔
- **Lacunas conscientes (fora do escopo do Plano 1, viram Plano 2-4):** OAuth (`acessos-oauth`), proxy (`acessos-proxy`), Zoho, OneDrive, iCloud, e os fluxos de onboarding/offboarding que orquestram provedores. O "marcar dispositivos como `a_devolver` no offboarding" depende do orquestrador → entra no Plano 4; nesta fase o status `a_devolver` já existe e é setável à mão (Task 7).

**2. Placeholder scan:** Sem "TBD/TODO". Todo passo de código traz o código completo. As referências tardias (`_acRenderDispositivos`/`_acRenderTermos` chamadas na Task 6 e definidas nas Tasks 7/9) são guardadas com `if(window._acRenderDispositivos)` para não quebrar entre tasks.

**3. Type/nome consistency:** Tabelas e colunas batem entre Task 1 (schema) e os `.from(...)` das Tasks 6-11. Funções e estado seguem a lista "Nomes". Enums (`em_uso/a_devolver/devolvido/perdido`, `rascunho/pendente/assinado/encerrado`, `ativo/inativo`) idênticos entre o CHECK do banco (Task 1) e os arrays `AC_DST`/`AC_TST` do front (Tasks 7/9). Bucket `acessos-termos` e paths `<id>/termo.html`/`<id>/assinado.pdf` idênticos entre Tasks 3, 9, 10.
