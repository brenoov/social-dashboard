# Fundação compartilhada Vue (permissões + avisos) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar as peças compartilhadas (avisos `adminToast` + permissões `role`/`features`/`hasPermission`/`PERMISSION_TREE`) para `src/compartilhado/`, para que as próximas telas migrem sem arrastar globais soltos.

**Architecture:** `adminToast` vira um módulo novo `src/compartilhado/avisos.js` (DOM imperativo, porte fiel). As permissões entram no módulo de login/estado que já existe (`controle-de-login-e-usuario.js`): campos reativos no `estado`, `carregarPerfil(session)` (busca `profiles`), `hasPermission(chave)` e `PERMISSION_TREE`, todos portados verbatim do monólito. `carregarPerfil` é chamado após a sessão ficar disponível (login manual + reabrir logado). Modais = nativos do navegador (nada a portar).

**Tech Stack:** Vue 3 (`reactive`), Vite, vue-router. Sem libs novas.

## Global Constraints

- **Branch:** `vue-migracao` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel), `user.name` = `brenoov`.
- **Produção intocada:** nada aqui altera `main`. Trabalho na branch → valida em preview.
- **Porte fiel:** `hasPermission`, `PERMISSION_TREE` e o corpo do `adminToast`/`carregarPerfil` são cópia do monólito (`legacy/index.html`), só adaptando a fonte das globais para o `estado` reativo e trocando `mkEl` por `document.createElement`.
- **Não trava o login:** `carregarPerfil` tem try/catch com padrões (`role='viewer'`, `features=['banco']`); nunca lança.
- **Dados reais:** testar login só com conta descartável; só leitura da `profiles`.
- **Sem harness de teste:** gate = `npm run build` passa + inspeção; validação funcional (login carrega role/features) DEFERIDA ao preview/Breno. NÃO `git push` sem pedir (o controlador faz o push/merge).

---

### Task 1: Módulos compartilhados — `avisos.js` + permissões no login

**Files:**
- Create: `src/compartilhado/avisos.js`
- Modify: `src/compartilhado/controle-de-login-e-usuario.js` (hoje 12 linhas: `estado` + `setSession`)

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_ANON_KEY` de `./conectar-no-banco-de-dados.js`.
- Produces:
  - `avisos.js` → `export function adminToast(msg, ok=true)`.
  - `controle-de-login-e-usuario.js` → `estado` com novos campos `role`/`features`/`userId`; `export async function carregarPerfil(session)`; `export function hasPermission(resourceKey)`; `export const PERMISSION_TREE`.

- [ ] **Step 1: Criar `src/compartilhado/avisos.js`**

```js
// Aviso rápido (toast) no canto da tela — porte de adminToast (legacy/index.html L4377).
// DOM imperativo: cria um #admin-toast fixo, verde se ok / vermelho se não, some em 2,8s.
// (Troca o helper mkEl do legado por document.createElement — comportamento idêntico.)
export function adminToast(msg, ok = true) {
  let t = document.getElementById('admin-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'admin-toast'
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;font-family:"IBM Plex Sans",sans-serif;font-size:13px;font-weight:500;z-index:9999;transition:opacity .3s;box-shadow:0 4px 16px rgba(0,0,0,.15)'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.background = ok ? '#166534' : '#991b1b'
  t.style.color = '#fff'
  t.style.opacity = '1'
  clearTimeout(t._to)
  t._to = setTimeout(() => { t.style.opacity = '0' }, 2800)
}
```

- [ ] **Step 2: Estender `src/compartilhado/controle-de-login-e-usuario.js`**

Substituir o conteúdo INTEIRO do arquivo (hoje só `estado` + `setSession`) por:
```js
import { reactive } from 'vue'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'

export const estado = reactive({
  currentSession: null,
  user: null,
  permissoes: null,
  role: 'viewer',
  features: [],
  userId: null,
})

export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}

// Carrega o perfil (papel + módulos liberados) da tabela `profiles`.
// Porte de loadDashboard (legacy/index.html L5586). Nunca lança: em erro usa os padrões.
export async function carregarPerfil(session) {
  try {
    const tok = session?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
    })
    const profiles = await r.json()
    estado.role = profiles?.[0]?.role || 'viewer'
    estado.features = profiles?.[0]?.features || ['banco']
    estado.userId = session?.user?.id || null
  } catch (e) {
    estado.role = 'viewer'
    estado.features = ['banco']
    estado.userId = session?.user?.id || null
  }
}

// Libera/bloqueia módulos e submódulos. Porte verbatim de hasPermission (legacy/index.html L3291),
// lendo do `estado` reativo em vez das globais soltas do monólito.
export function hasPermission(resourceKey) {
  if (estado.role === 'admin') return true
  const keyMap = {
    'tool:social': 'social', 'tool:sales': 'sales', 'tool:meta': 'meta',
    'module:sales:gestao-vista': 'sales.gestao', 'module:sales:analise-vendas': 'sales.analise',
    'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor',
  }
  const fKey = keyMap[resourceKey] || resourceKey
  return (estado.features || []).includes(fKey)
}

// Árvore de módulos (para o painel de admin gerenciar depois). Porte verbatim (legacy/index.html L4525).
export const PERMISSION_TREE = [
  { key: 'social', label: 'Dashboard Redes Sociais', children: [] },
  { key: 'sales', label: 'Dashboard de Vendas', children: [
    { key: 'sales.gestao', label: 'Gestão à Vista' },
    { key: 'sales.analise', label: 'Análise de Vendas' },
  ] },
  { key: 'meta', label: 'Meta Ads', children: [
    { key: 'meta.campanha', label: 'Análise de Campanhas' },
    { key: 'meta.gestor', label: 'Gestão de Tráfego' },
  ] },
  { key: 'banco', label: 'Banco de Arquivos', children: [] },
  { key: 'noticias', label: 'Portal de Notícias', children: [] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', children: [] },
  { key: 'acessos', label: 'Colaboradores e Acessos', children: [] },
]
```

- [ ] **Step 3: Verificar o build**

Run:
```bash
cd /Users/erickmartins/iamundi
npm run build
```
Expected: build termina sem erro (imports resolvem; `SUPABASE_URL`/`SUPABASE_ANON_KEY` existem em `conectar-no-banco-de-dados.js`).

Run (conferir exports):
```bash
grep -c "export function adminToast" src/compartilhado/avisos.js
grep -c "export async function carregarPerfil\|export function hasPermission\|export const PERMISSION_TREE" src/compartilhado/controle-de-login-e-usuario.js
```
Expected: `1` e `3`.

- [ ] **Step 4: Commit**
```bash
git add src/compartilhado/avisos.js src/compartilhado/controle-de-login-e-usuario.js
git commit -m "feat(vue): fundação compartilhada — avisos (adminToast) + permissões (estado role/features, carregarPerfil, hasPermission, PERMISSION_TREE)"
```

---

### Task 2: Carregar o perfil no login e ao reabrir logado

**Files:**
- Modify: `src/ferramentas/login/tela-de-login.vue` (funções `entrar` e `definirSenha`; import na L84)
- Modify: `src/ponto-de-partida.js` (restauração da sessão)

**Interfaces:**
- Consumes: `carregarPerfil` de `controle-de-login-e-usuario.js` (Task 1).
- Produces: `estado.role`/`estado.features` preenchidos antes de qualquer tela abrir.

- [ ] **Step 1: Importar `carregarPerfil` no login**

Em `src/ferramentas/login/tela-de-login.vue`, na linha de import (atual L84):
```js
import { setSession } from '../../compartilhado/controle-de-login-e-usuario.js'
```
trocar por:
```js
import { setSession, carregarPerfil } from '../../compartilhado/controle-de-login-e-usuario.js'
```

- [ ] **Step 2: Carregar o perfil após o login manual (`entrar`)**

Em `entrar()`, trocar:
```js
  if (data?.session) {
    setSession(data.session)
    router.push({ name: 'inicio' })
  }
```
por:
```js
  if (data?.session) {
    setSession(data.session)
    await carregarPerfil(data.session)
    router.push({ name: 'inicio' })
  }
```

- [ ] **Step 3: Carregar o perfil após definir senha (`definirSenha`)**

Em `definirSenha()`, trocar:
```js
  if (session) {
    setSession(session)
    router.push({ name: 'inicio' })
  }
```
por:
```js
  if (session) {
    setSession(session)
    await carregarPerfil(session)
    router.push({ name: 'inicio' })
  }
```

- [ ] **Step 4: Carregar o perfil ao reabrir já logado (`ponto-de-partida.js`)**

Em `src/ponto-de-partida.js`, trocar o import (L6):
```js
import { setSession } from './compartilhado/controle-de-login-e-usuario.js'
```
por:
```js
import { setSession, carregarPerfil } from './compartilhado/controle-de-login-e-usuario.js'
```
e no corpo de `iniciar()`, trocar:
```js
  const { data } = await sbClient.auth.getSession()
  if (data.session) setSession(data.session)
```
por:
```js
  const { data } = await sbClient.auth.getSession()
  if (data.session) {
    setSession(data.session)
    await carregarPerfil(data.session)
  }
```

- [ ] **Step 5: Verificar o build**

Run:
```bash
cd /Users/erickmartins/iamundi
npm run build
```
Expected: build sem erro.

Run:
```bash
grep -c "carregarPerfil" src/ferramentas/login/tela-de-login.vue
grep -c "carregarPerfil" src/ponto-de-partida.js
```
Expected: `3` (import + 2 chamadas) e `2` (import + 1 chamada).

**Teste do Breno no preview (conta descartável):** logar → a Início abre; nada muda visualmente; internamente `estado.role`/`features` vêm da `profiles` (validável quando a 1ª tela gateada for portada). NÃO `git push` sem pedir.

- [ ] **Step 6: Commit**
```bash
git add src/ferramentas/login/tela-de-login.vue src/ponto-de-partida.js
git commit -m "feat(vue): carregar perfil (role/features) no login e ao reabrir logado"
```

---

## Notas de execução

- **Ordem:** T1 (módulos) → T2 (ligação). T2 depende do `carregarPerfil` da T1.
- **Modais:** nada a fazer — o app usa `confirm()`/`alert()` nativos, que funcionam no Vue.
- **Uso futuro (contrato):** cada tela gateada, ao ser portada, importa `hasPermission`/`estado` e `adminToast` e reproduz o gate do monólito (`if(!hasPermission('tool:xxx')){ adminToast('Sem acesso',false); router.push({name:'inicio'}); return }`); a Início esconde cards com `v-if="hasPermission(...)"`. Isso é feito no port de cada tela, não aqui.
- **Push/preview:** o controlador faz o push da branch quando a fundação estiver validada (a Vercel gera o preview).
