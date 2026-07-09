# Permissões Micro-gerenciadas — Fase 1 (Front) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Substituir o gate binário (role admin/viewer + features[]) por permissões por-usuário com ações finas (ver/criar/editar/excluir/exportar), escopo por perfil de rede e super-admin — só no front (Fase 1).

**Architecture:** `profiles` ganha `permissions` (JSONB recurso→ações), `allowed_accounts` (uuid[]) e `is_superadmin` (bool). O front lê via `hasPermission(recurso, acao)` e `contasPermitidas()`. Gate em 3 camadas (cards da home, submenus, guarda de tela + botões de ação). Editor por-usuário no Admin. Migração aditiva: os 6 admins começam com tudo.

**Tech Stack:** Vue 3 + Vite; Supabase (Postgres + `apply_migration`); `sbClient` REST. Sem framework de testes unitários.

## Global Constraints
- **Sem framework de teste:** cada task verifica com `npm run build` + checagem no navegador via Playwright (`browser_evaluate` seta `estado.permissions`/`is_superadmin` e confere a UI) e/ou SQL. Não inventar testes unitários.
- **Ninguém perde acesso:** migração é ADITIVA; `features[]` fica intocado como fallback até a Fase 1 validar.
- **Chaves de recurso (exatas):** `social`, `social.relatorio`, `sales.gestao`, `sales.analise`, `sales.metas`, `meta.campanha`, `meta.gestor`, `banco`, `acessos`, `noticias`, `gestor`. Admin (usuários/permissões) é gateado por `is_superadmin`, NÃO é recurso.
- **Ações válidas por recurso** (o resto não aparece): social=[ver,exportar]; social.relatorio=[ver,exportar]; sales.gestao=[ver,exportar]; sales.analise=[ver,exportar]; sales.metas=[ver,editar]; meta.campanha=[ver,exportar]; meta.gestor=[ver,editar]; banco=[ver,criar,excluir]; acessos=[ver,criar,editar,excluir]; noticias=[ver]; gestor=[ver].
- Commits: `git config user.email breno@rbvcompany.com; git config user.name brenoov`; branch por task; build antes de commitar.

---

### Task 1: Migração do banco (colunas + dados)

**Files:**
- Migração Supabase (via `apply_migration`, nome `permissoes_granulares_fase1`).

**Interfaces:**
- Produces: `profiles.permissions jsonb`, `profiles.allowed_accounts uuid[]`, `profiles.is_superadmin boolean`.

- [ ] **Step 1: Aplicar a migração**

```sql
alter table profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists allowed_accounts uuid[];        -- null = todos os perfis
alter table profiles add column if not exists is_superadmin boolean not null default false;

-- Super-admin = Breno
update profiles set is_superadmin = true where email = 'breno@rbvcompany.com';

-- Demais ADMINS (menos o super-admin) começam com TUDO (todas as ações válidas por recurso), todos os perfis
update profiles set permissions = jsonb_build_object(
  'social', to_jsonb(array['ver','exportar']),
  'social.relatorio', to_jsonb(array['ver','exportar']),
  'sales.gestao', to_jsonb(array['ver','exportar']),
  'sales.analise', to_jsonb(array['ver','exportar']),
  'sales.metas', to_jsonb(array['ver','editar']),
  'meta.campanha', to_jsonb(array['ver','exportar']),
  'meta.gestor', to_jsonb(array['ver','editar']),
  'banco', to_jsonb(array['ver','criar','excluir']),
  'acessos', to_jsonb(array['ver','criar','editar','excluir']),
  'noticias', to_jsonb(array['ver']),
  'gestor', to_jsonb(array['ver'])
), allowed_accounts = null
where role = 'admin' and is_superadmin = false;

-- VIEWERS: cada feature vira {recurso:["ver"]} (+ "exportar" nos recursos que têm exportar)
-- Mapa feature->recurso é 1:1 (as chaves já batem), exceto 'sales'/'meta' pais (ignoram).
update profiles p set permissions = (
  select coalesce(jsonb_object_agg(f, case
      when f in ('social','social.relatorio','sales.gestao','sales.analise','meta.campanha') then to_jsonb(array['ver','exportar'])
      else to_jsonb(array['ver']) end), '{}'::jsonb)
  from unnest(p.features) f
  where f in ('social','social.relatorio','sales.gestao','sales.analise','sales.metas','meta.campanha','meta.gestor','banco','acessos','noticias','gestor')
), allowed_accounts = null
where role = 'viewer';
```

- [ ] **Step 2: Verificar**

Rodar:
```sql
select email, role, is_superadmin, jsonb_object_keys(permissions) k from profiles order by email limit 40;
select email, permissions from profiles where email='breno@rbvcompany.com';
```
Esperado: Breno `is_superadmin=true`; os 6 admins com 11 recursos preenchidos; viewers com só os recursos que tinham em `features`.

- [ ] **Step 3: Sem commit** (migração vive no banco; anotar o SQL no plano). Seguir.

---

### Task 2: Núcleo de permissões (`hasPermission(recurso, acao)`)

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js`

**Interfaces:**
- Produces: `hasPermission(recurso, acao='ver') → bool`; `contasPermitidas() → uuid[]|null`; `RECURSOS` (catálogo); `estado.permissions`, `estado.allowed_accounts`, `estado.is_superadmin`.

- [ ] **Step 1: Estado + carregarPerfil lê os campos novos**

Em `estado` (reactive), adicionar: `permissions: {}, allowed_accounts: null, is_superadmin: false`.
Em `carregarPerfil`, trocar o select e o preenchimento:
```js
const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url,permissions,allowed_accounts,is_superadmin`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
})
const profiles = await r.json()
const p = profiles?.[0] || {}
estado.role = p.role || 'viewer'
estado.features = p.features || ['banco']
estado.permissions = p.permissions || {}
estado.allowed_accounts = p.allowed_accounts ?? null
estado.is_superadmin = !!p.is_superadmin
estado.userId = session?.user?.id || null
estado.avatarUrl = p.avatar_url || null
```
No `catch`, setar também `estado.permissions = {}; estado.allowed_accounts = null; estado.is_superadmin = false`.

- [ ] **Step 2: RECURSOS + hasPermission novo (com ponte de retrocompat)**

Substituir a função `hasPermission` e o `keyMap`/`PERMISSION_TREE` por:
```js
// Catálogo: recurso -> ações válidas. Fonte de verdade da UI de permissões.
export const RECURSOS = [
  { key: 'social', label: 'Redes Sociais (Dashboard)', acoes: ['ver', 'exportar'] },
  { key: 'social.relatorio', label: 'Redes — Relatório', acoes: ['ver', 'exportar'] },
  { key: 'sales.gestao', label: 'Gestão à Vista', acoes: ['ver', 'exportar'] },
  { key: 'sales.analise', label: 'Análise de Vendas', acoes: ['ver', 'exportar'] },
  { key: 'sales.metas', label: 'Metas de Vendas', acoes: ['ver', 'editar'] },
  { key: 'meta.campanha', label: 'Análise de Campanhas', acoes: ['ver', 'exportar'] },
  { key: 'meta.gestor', label: 'Gestão de Tráfego', acoes: ['ver', 'editar'] },
  { key: 'banco', label: 'Banco de Arquivos', acoes: ['ver', 'criar', 'excluir'] },
  { key: 'acessos', label: 'Colaboradores e Acessos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'noticias', label: 'Portal de Notícias', acoes: ['ver'] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', acoes: ['ver'] },
]

// Ponte: chaves antigas (usadas nos call sites) -> recurso novo.
const _legado = {
  'tool:social': 'social', 'tool:sales': 'sales', 'tool:meta': 'meta', 'tool:acessos': 'acessos',
  'module:sales:gestao-vista': 'sales.gestao', 'module:sales:analise-vendas': 'sales.analise',
  'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor',
}

export function hasPermission(recurso, acao = 'ver') {
  if (estado.is_superadmin) return true
  let key = _legado[recurso] || recurso
  // 'tool:sales'/'tool:meta' (pais) = tem acesso se tiver QUALQUER filho do grupo.
  if (key === 'sales') return ['sales.gestao', 'sales.analise', 'sales.metas'].some(k => (estado.permissions[k] || []).includes('ver'))
  if (key === 'meta') return ['meta.campanha', 'meta.gestor'].some(k => (estado.permissions[k] || []).includes('ver'))
  return (estado.permissions[key] || []).includes(acao)
}

// Perfis de rede que o usuário pode ver (null = todos).
export function contasPermitidas() {
  return estado.is_superadmin ? null : (estado.allowed_accounts ?? null)
}
```
(Remover `PERMISSION_TREE` e o `keyMap` antigos se nada mais os importar — checar com grep antes.)

- [ ] **Step 3: Build**

Rodar: `npm run build`  → Esperado: `built in`. Se `PERMISSION_TREE` era importado em algum lugar, o build acusa — ajustar o import.

- [ ] **Step 4: Verificar no navegador**

`npm run dev`, abrir `/`, e no console (Playwright `browser_evaluate`) importar não dá — em vez disso testar via app: logar já carrega `estado`. Checar `window`? Não exposto. Verificação mínima: build passou + Task 3 exercita `hasPermission`. Seguir.

- [ ] **Step 5: Commit**

```bash
git add src/compartilhado/controle-de-login-e-usuario.js
git commit -m "feat(perms): hasPermission(recurso,acao) + RECURSOS + contasPermitidas + is_superadmin no estado (Fase 1)"
```

---

### Task 3: Gate dos cards da Home

**Files:**
- Modify: `src/ferramentas/inicio/tela-de-inicio.vue`

**Interfaces:**
- Consumes: `hasPermission(recurso,'ver')`, `estado.is_superadmin`.

- [ ] **Step 1: Importar hasPermission + trocar o gate do admin**

No `<script setup>`: `import { estado, hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'`.
Trocar `const ehAdmin = computed(() => estado.role === 'admin')` por `const ehAdmin = computed(() => estado.is_superadmin)`.

- [ ] **Step 2: v-show por recurso em cada card**

Adicionar em cada `.home-card` (o card admin já usa `v-show="ehAdmin"`):
- `#home-card-social`: `v-show="hasPermission('social','ver') || hasPermission('social.relatorio','ver')"`
- `#home-card-sales`: `v-show="hasPermission('sales.gestao','ver') || hasPermission('sales.analise','ver')"`
- `#home-card-meta`: `v-show="hasPermission('meta.campanha','ver') || hasPermission('meta.gestor','ver')"`
- `#home-card-banco`: `v-show="hasPermission('banco','ver')"`
- `#home-card-noticias`: `v-show="hasPermission('noticias','ver')"`
- `#home-card-gestor`: `v-show="hasPermission('gestor','ver')"`
- `#home-card-acessos`: `v-show="hasPermission('acessos','ver')"`

- [ ] **Step 3: Build + verificar**

`npm run build`. Depois `npm run dev` + Playwright: em `/`, `browser_evaluate` para simular um viewer:
```js
// pega o estado reativo via app não é trivial; validar via usuário real de teste OU
// conferir que super-admin (Breno) vê todos os cards e um viewer conhecido vê só os seus.
```
Esperado: super-admin vê todos os cards; viewer vê só os permitidos.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/inicio/tela-de-inicio.vue
git commit -m "feat(perms): cards da Home gateados por hasPermission (fecha brecha: antes todos apareciam)"
```

---

### Task 4: Atualizar as guardas de tela e submenus (call sites)

**Files (todos os call sites de hasPermission — trocar chave antiga por recurso + ação):**
- `src/ferramentas/vendas/tela-de-menu-vendas.vue`: `'module:sales:gestao-vista'`→`'sales.gestao','ver'`; `'module:sales:analise-vendas'`→`'sales.analise','ver'`; `'tool:sales'`→`'sales','ver'`.
- `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`: `'module:meta:campanha'`→`'meta.campanha','ver'`; `'module:meta:gestor'`→`'meta.gestor','ver'`; `'tool:meta'`→`'meta','ver'`.
- `src/ferramentas/redes-sociais/tela-de-menu-redes.vue:62` e `tela-de-redes-sociais.vue:2146`: `'tool:social'`→`'social','ver'`.
- `src/ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue:984`: `'module:sales:gestao-vista'`→`'sales.gestao','ver'`.
- `src/ferramentas/analise-vendas/tela-de-marca-vendas.vue:108` e `tela-de-analise-vendas.vue:1171`: `'module:sales:analise-vendas'`→`'sales.analise','ver'`.
- `src/ferramentas/analise-campanhas/tela-de-analise-campanhas.vue:1198`: `'module:meta:campanha'`→`'meta.campanha','ver'`.
- `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue:471,1025`: `'module:meta:gestor'`→`'meta.gestor','ver'`.
- `src/ferramentas/gestao-comercial/tela-de-gestao-comercial.vue:312`: `'gestor'`→`'gestor','ver'`.
- `src/ferramentas/banco/tela-de-banco.vue:163`: `'banco'`→`'banco','ver'`.
- `src/ferramentas/acessos/tela-de-acessos.vue:1513`: `'tool:acessos'`→`'acessos','ver'`.

**Interfaces:**
- Consumes: `hasPermission(recurso,'ver')`. (O `_legado` no núcleo já cobre as chaves antigas, então mesmo sem trocar tudo não quebra — mas trocar deixa consistente.)

- [ ] **Step 1: Aplicar as trocas** (find/replace por arquivo, conforme a lista acima). Manter `if (!hasPermission(...)) { adminToast('Sem acesso', false); router.push({ name: 'inicio' }) }`.

- [ ] **Step 2: Build**

Rodar: `npm run build` → Esperado: `built in`.

- [ ] **Step 3: Verificar** — Playwright: super-admin abre `/vendas`, `/meta-ads`, `/redes` e vê os submenus; navega em cada tela sem redirect. Esperado: sem redirect indevido.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas
git commit -m "refactor(perms): call sites de hasPermission usam recurso+acao novos"
```

---

### Task 5: Gate dos BOTÕES de ação (editar/criar/excluir/exportar)

**Files (só onde há ação além de ver):**
- `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue:1032` — o botão de config já usa display por `hasPermission('module:meta:gestor')`; trocar para `hasPermission('meta.gestor','editar')`.
- `src/ferramentas/redes-sociais/tela-de-relatorio-redes.vue` — os botões Excel/CSV: envolver com `v-if="hasPermission('social.relatorio','exportar')"`.
- `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` — export/relatório dentro do dashboard (se houver botão de export): `hasPermission('social','exportar')`.
- `src/ferramentas/banco/tela-de-banco.vue` — botão de upload: `hasPermission('banco','criar')`; botão excluir: `hasPermission('banco','excluir')`.
- `src/ferramentas/acessos/tela-de-acessos.vue` — botões criar/editar/excluir colaborador: `hasPermission('acessos','criar'|'editar'|'excluir')` (o excluir hoje usa `estado.role==='admin'` na L997 — trocar).
- `src/ferramentas/gestao-a-vista` / `analise-vendas` — botões de export: `hasPermission(recurso,'exportar')`.
- Metas de vendas (onde estiver o editor de metas): botão salvar/editar meta: `hasPermission('sales.metas','editar')`.

**Interfaces:**
- Consumes: `hasPermission(recurso, acao)`.

- [ ] **Step 1: Envolver cada botão de ação** com o `v-if`/display correspondente (lista acima). Para elementos imperativos (innerHTML), condicionar a inclusão do botão a `hasPermission(...)`.

- [ ] **Step 2: Build** → `npm run build`.

- [ ] **Step 3: Verificar** — Playwright com um usuário sem `editar` no `meta.gestor`: abre GT, o botão de config NÃO aparece; com `exportar` ausente no relatório, os botões Excel/CSV somem.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas
git commit -m "feat(perms): botões de ação (editar/criar/excluir/exportar) gateados por ação"
```

---

### Task 6: Escopo por perfil de rede social

**Files:**
- Modify: `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (montagem do seletor de perfis)
- Modify: `src/ferramentas/redes-sociais/tela-de-relatorio-redes.vue` (`onMounted` que carrega `contas`)

**Interfaces:**
- Consumes: `contasPermitidas()` (uuid[]|null).

- [ ] **Step 1: Relatório — filtrar contas**

Em `tela-de-relatorio-redes.vue`, `onMounted`, após buscar `accounts`:
```js
import { contasPermitidas } from '../../compartilhado/conectar...'  // na verdade de controle-de-login-e-usuario.js
const permitidas = contasPermitidas()
contas.value = (data || []).filter(c => !permitidas || permitidas.includes(c.id))
```
(import de `contasPermitidas` de `../../compartilhado/controle-de-login-e-usuario.js`.)

- [ ] **Step 2: Dashboard — filtrar `_allAccounts`/os `.profile-btn`**

Em `tela-de-redes-sociais.vue`, onde as contas são carregadas para os botões de perfil, aplicar o mesmo filtro por `contasPermitidas()` antes de render. Se sobrar 1, já seleciona ela.

- [ ] **Step 3: Build + verificar** — Playwright: setar um usuário de teste com `allowed_accounts=[<id da Raíssa>]` (via SQL) e logar → o seletor mostra só a Raíssa. Super-admin vê os 7.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/redes-sociais
git commit -m "feat(perms): seletor de perfis de rede filtrado por allowed_accounts"
```

---

### Task 7: Editor de permissões no Admin

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue`

**Interfaces:**
- Consumes: `RECURSOS`, `estado.is_superadmin`, `sbClient`. Lê/grava `profiles.permissions/allowed_accounts/is_superadmin`.

- [ ] **Step 1: Gate da tela de Admin por super-admin**

No `onMounted`/guarda da tela de admin, trocar o gate atual (role admin) por `if (!estado.is_superadmin) { router.push({ name: 'inicio' }); return }`.

- [ ] **Step 2: Ao selecionar um usuário, renderizar o editor**

Para o usuário selecionado (linha existente da lista de usuários), montar um painel:
- Toggle **Super-admin** (checkbox) ligado a `usuario.is_superadmin`. Quando ligado, esconder a matriz.
- **Matriz**: para cada `r` em `RECURSOS`, uma linha com o `r.label` e um checkbox por `acao` em `r.acoes`. Marcado se `(perm[r.key]||[]).includes(acao)`. Ao marcar/desmarcar, atualizar o objeto `perm` local. Regra de UI: desmarcar "ver" limpa as outras ações do recurso; marcar outra ação marca "ver" junto.
- **Perfis de rede**: buscar `accounts` (id,name); checkbox "Todos" (= `allowed_accounts=null`) + um checkbox por conta. Estado local `contasSel` (array de ids ou null).
- Botão **Duplicar permissões de…**: um `select` dos outros usuários; ao confirmar, copia `permissions` + `allowed_accounts` deles para o `perm`/`contasSel` local.

- [ ] **Step 3: Salvar**

Botão Salvar → `sbClient.from('profiles').update({ permissions: perm, allowed_accounts: contasSel, is_superadmin: superFlag }).eq('id', usuario.id)`. Toast de sucesso. Recarregar a lista.

- [ ] **Step 4: Build + verificar** — Playwright (como Breno/super-admin): abrir Admin, selecionar um usuário, tirar "editar" de `meta.gestor`, salvar; reabrir e confirmar persistido. Conferir no SQL: `select permissions from profiles where id='...'`.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue
git commit -m "feat(perms): editor de permissões por usuário no Admin (matriz recurso×ação, perfis, super-admin, duplicar)"
```

---

### Task 8: Validação ponta-a-ponta + limpeza

**Files:** nenhum novo (validação).

- [ ] **Step 1:** Criar/usar um usuário de teste (viewer). Via Admin, dar só `social:ver` + `allowed_accounts=[Raíssa]`. Logar como ele (ou simular): vê só o card Redes, só o perfil da Raíssa, sem botões de export/editar, e é redirecionado se tentar `/meta-ads`.
- [ ] **Step 2:** Confirmar que Breno (super-admin) vê tudo e edita permissões.
- [ ] **Step 3:** Rodar `npm run build` final. Merge das branches → `main` → push (deploy Vercel).
- [ ] **Step 4:** Só depois de validado em produção, planejar remover `features[]` e `PERMISSION_TREE` legados (task futura, não agora).

---

## Notas de escopo
- **Fase 2 (backend)** — NÃO neste plano: Edge Functions + RLS checando `permissions`/`allowed_accounts`; auditoria. O front da Fase 1 é UX/organização, não segurança dura (a memória registra que o front é público).
- Verificação sem framework de teste: o padrão do projeto é build + Playwright + SQL (usado a sessão toda).
