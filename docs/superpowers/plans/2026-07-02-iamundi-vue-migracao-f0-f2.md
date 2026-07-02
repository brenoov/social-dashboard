# Migração iamundi → Vue — Fases 0/1/2 (esqueleto + miolo + Notícias) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar o esqueleto Vue+Vite do iamundi, migrar o miolo compartilhado (Supabase, estado, login, home) e a primeira ferramenta piloto (Notícias), tudo validado num preview da Vercel, sem tocar na produção.

**Architecture:** Trabalhamos numa branch `vue-migracao`. O monólito `index.html` é movido para `legacy/index.html` (rollback e fonte de extração). Um projeto Vite+Vue 3 nasce na raiz: `App.vue` é a moldura (topbar/fundo) e `vue-router` substitui a navegação por classe `active`. O miolo compartilhado vive em `src/lib` (poucos arquivos, mudança combinada com o TI); cada tela vira um componente próprio em `src/ferramentas/<nome>/` com CSS `scoped`. Produção (branch `main`) fica intacta até a virada final (fora do escopo deste plano).

**Tech Stack:** Vue 3, Vite, vue-router. Libs já usadas mantidas via CDN no `<head>` (supabase-js, xlsx, chart.js, chartjs-plugin-datalabels).

## Global Constraints

- **Conta Git:** commits/push na identidade `brenoov` (`git config user.name brenoov`, `user.email breno@rbvcompany.com`). Repo `brenoov/social-dashboard`.
- **E-mail do Git nunca vazio:** e-mail vazio TRAVA o build na Vercel. Confirmar antes de cada commit.
- **Produção intocada:** nada neste plano altera a branch `main`. Todo trabalho é na branch `vue-migracao` → valida em preview.
- **Comportamento idêntico:** é reorganização técnica. Nenhuma tela muda de visual ou comportamento. Copiar o HTML/CSS/JS existente; adaptar só a navegação (router) e o empacotamento (componente).
- **Dados reais:** ao testar login/dados, usar uma conta descartável/de teste — nunca semear, limpar ou trocar senha de contas reais (Franciele, Erick, admin).
- **LEIA-ME por pasta:** toda pasta nova ganha `LEIA-ME.txt` em PT, linguagem de iniciante.
- **CSS por tela é `scoped`:** só o que é realmente global (tokens, reset, topbar, fundo) vai para `src/estilos/global.css`.

---

### Task 1: Branch de migração + mover monólito para legacy

**Files:**
- Move: `index.html` → `legacy/index.html`
- Create: `legacy/LEIA-ME.txt`

**Interfaces:**
- Produces: `legacy/index.html` (monólito original preservado, fonte de extração das próximas tasks).

- [ ] **Step 1: Confirmar branch e identidade**

Run:
```bash
cd /Users/erickmartins/iamundi
git checkout main && git pull
git config user.name && git config user.email
```
Expected: branch `main` limpa; `brenoov` / `breno@rbvcompany.com`.

- [ ] **Step 2: Criar a branch de trabalho**

Run:
```bash
git checkout -b vue-migracao
```
Expected: "Switched to a new branch 'vue-migracao'".

- [ ] **Step 3: Mover o monólito para legacy**

Run:
```bash
mkdir -p legacy
git mv index.html legacy/index.html
```
Expected: `git status` mostra rename `index.html -> legacy/index.html`.

- [ ] **Step 4: Escrever o LEIA-ME do legacy**

Create `legacy/LEIA-ME.txt`:
```
O QUE É ESTA PASTA
==================
Aqui está o iamundi ANTIGO, do jeito que era antes da migração para Vue:
um único arquivo (index.html) com tudo dentro.

PARA QUE SERVE
==============
1) Rollback (botão de emergência): se algo der muito errado no site novo,
   dá para voltar a servir este arquivo.
2) Fonte de cópia: enquanto migramos tela por tela para o Vue, copiamos o
   HTML/CSS/JavaScript de cada tela a partir DESTE arquivo.

NÃO EDITE ESTE ARQUIVO para adicionar funcionalidades novas.
Ele é uma "foto congelada" do sistema antigo.
```

- [ ] **Step 5: Commit**

Run:
```bash
git add -A
git commit -m "chore: mover monólito para legacy/ e abrir branch de migração Vue

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: 1 arquivo renomeado + 1 criado.

---

### Task 2: Esqueleto Vite + Vue 3 (Fase 0)

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore` (append `node_modules`, `dist`)
- Create: `index.html` (novo, entrada do Vite)
- Create: `src/main.js`, `src/App.vue`, `src/router.js`

**Interfaces:**
- Produces: app Vue montável (`#app`), `router` com rotas `home` e `noticias` (placeholders). Libs globais (`window.supabase`, `window.XLSX`, `window.Chart`) disponíveis via CDN no `index.html`.

- [ ] **Step 1: Criar `package.json`**

Create `package.json`:
```json
{
  "name": "iamundi",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Criar `vite.config.js`**

Create `vite.config.js`:
```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
```

- [ ] **Step 3: Criar o novo `index.html` (entrada do Vite)**

Create `index.html` (mantém as libs CDN que o código legado usa via `window.*`):
```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>iamundi</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Criar `src/router.js` com rotas placeholder**

Create `src/router.js`:
```js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./ferramentas/home/Home.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/Noticias.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
```

- [ ] **Step 5: Criar componentes placeholder para as rotas**

Create `src/ferramentas/home/Home.vue`:
```vue
<template><div style="padding:40px">Home (placeholder)</div></template>
```
Create `src/ferramentas/noticias/Noticias.vue`:
```vue
<template><div style="padding:40px">Notícias (placeholder)</div></template>
```

- [ ] **Step 6: Criar `src/App.vue` (moldura mínima)**

Create `src/App.vue`:
```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 7: Criar `src/main.js`**

Create `src/main.js`:
```js
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 8: Ignorar artefatos de build**

Append a `.gitignore`:
```
node_modules
dist
```

- [ ] **Step 9: Instalar e rodar em dev**

Run:
```bash
npm install
npm run dev
```
Expected: Vite sobe (ex.: `http://localhost:5173`). Abrir no navegador: rota `/` mostra "Home (placeholder)"; `/noticias` mostra "Notícias (placeholder)". Parar com Ctrl+C.

- [ ] **Step 10: Verificar o build**

Run:
```bash
npm run build
```
Expected: termina sem erro e gera a pasta `dist/`.

- [ ] **Step 11: Commit**

Run:
```bash
git add -A
git commit -m "feat: esqueleto Vite + Vue 3 com router e libs CDN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Miolo compartilhado — `src/lib` (Fase 1)

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/api.js`, `src/lib/estado.js`, `src/lib/LEIA-ME.txt`
- Reference: `legacy/index.html` (config Supabase ~linha 3208; helpers "SUPABASE FETCH" ~linha 3276)

**Interfaces:**
- Produces:
  - `src/lib/supabase.js` → `export const sbClient` (cliente Supabase criado com `window.supabase.createClient`), `export const SUPABASE_URL`, `export const SUPABASE_ANON_KEY`.
  - `src/lib/api.js` → `export async function sbFetch(path, options)` (o mesmo fetch autenticado do legado, usando o token da sessão ou a anon key).
  - `src/lib/estado.js` → `export const estado` (objeto `reactive` com `currentSession`, `user`, `permissoes`), `export function setSession(session)`.

- [ ] **Step 1: Criar `src/lib/supabase.js`**

Copiar os valores de `SUPABASE_URL` e `SUPABASE_ANON_KEY` de `legacy/index.html` (~linha 3209-3210). Create `src/lib/supabase.js`:
```js
export const SUPABASE_URL = 'https://kounqtdoioootxqegkij.supabase.co'
export const SUPABASE_ANON_KEY = '<COPIAR-A-ANON-KEY-DE-legacy/index.html-linha-3210>'
export const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

- [ ] **Step 2: Criar `src/lib/estado.js`**

Create `src/lib/estado.js`:
```js
import { reactive } from 'vue'

export const estado = reactive({
  currentSession: null,
  user: null,
  permissoes: null,
})

export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}
```

- [ ] **Step 3: Criar `src/lib/api.js`**

Localizar o bloco "SUPABASE FETCH" em `legacy/index.html` (~linha 3276) e copiar a função de fetch, trocando a referência à sessão global por `estado.currentSession`. Create `src/lib/api.js`:
```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js'
import { estado } from './estado.js'

// Fetch autenticado ao REST do Supabase (portado de legacy/index.html ~L3276).
// Copiar o corpo/headers exatos do legado; abaixo o formato esperado:
export async function sbFetch(path, options = {}) {
  const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}
```

- [ ] **Step 4: LEIA-ME do miolo**

Create `src/lib/LEIA-ME.txt`:
```
O QUE É ESTA PASTA (MIOLO COMPARTILHADO)
========================================
Aqui ficam as peças que TODAS as ferramentas usam:
- supabase.js  → conexão com o banco de dados (Supabase)
- api.js       → função para buscar/salvar dados no banco
- estado.js    → quem está logado, usuário e permissões

REGRA IMPORTANTE
================
Estes arquivos são compartilhados. Mudanças aqui afetam TODO o sistema.
Só altere combinando com o TI. As ferramentas do dia a dia ficam em
../ferramentas/ — é lá que cada pessoa trabalha.
```

- [ ] **Step 5: Verificar build**

Run:
```bash
npm run build
```
Expected: build sem erro (imports resolvem).

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat: miolo compartilhado (supabase, api, estado) em src/lib

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: CSS global + moldura (topbar/fundo) no `App.vue`

**Files:**
- Create: `src/estilos/global.css`
- Modify: `src/App.vue`, `src/main.js`
- Reference: `legacy/index.html` (bloco `<style>` — `:root`, reset, `.topbar`, fundo)

**Interfaces:**
- Consumes: `estado` de `src/lib/estado.js`.
- Produces: `App.vue` renderiza topbar/fundo + `<router-view>`; `global.css` importado uma vez em `main.js`.

- [ ] **Step 1: Extrair o CSS global**

De `legacy/index.html`, copiar para `src/estilos/global.css` APENAS o que é global: variáveis `:root` (e `[data-theme="dark"]`), reset (`*`, `body`, fontes `@import`/`@font-face`), e as regras da topbar e do fundo. **NÃO** copiar regras que começam com `#...-screen` (essas vão para cada componente depois). Create `src/estilos/global.css` com esse conteúdo.

- [ ] **Step 2: Importar o CSS global**

Modify `src/main.js` — adicionar no topo:
```js
import './estilos/global.css'
```

- [ ] **Step 3: Montar a moldura em `App.vue`**

De `legacy/index.html`, copiar o HTML da topbar (o cabeçalho fixo comum a todas as telas). Modify `src/App.vue`:
```vue
<template>
  <div class="app-shell">
    <!-- Copiar aqui o HTML da topbar do legacy/index.html -->
    <router-view />
  </div>
</template>

<script setup>
import { estado } from './lib/estado.js'
</script>
```

- [ ] **Step 4: Verificar em dev**

Run:
```bash
npm run dev
```
Expected: a topbar aparece no topo com o visual atual; fundo correto; placeholders de Home/Notícias abaixo. Parar com Ctrl+C.

- [ ] **Step 5: Commit**

Run:
```bash
git add -A
git commit -m "feat: CSS global + moldura (topbar/fundo) em App.vue

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Login (auth) como componente

**Files:**
- Create: `src/ferramentas/auth/Auth.vue`, `src/ferramentas/auth/LEIA-ME.txt`
- Modify: `src/router.js`, `src/App.vue`
- Reference: `legacy/index.html` (`#auth-screen` + funções de login/`sbClient.auth`)

**Interfaces:**
- Consumes: `sbClient` (supabase.js), `setSession` (estado.js).
- Produces: rota `/login` (name `login`); ao autenticar, chama `setSession` e navega para `home`. Guarda de rota: rotas protegidas redirecionam para `/login` quando `estado.currentSession` é nulo.

- [ ] **Step 1: Criar o componente de login**

De `legacy/index.html`, copiar o HTML de `#auth-screen`, o CSS `#auth-screen ...` (para dentro de `<style scoped>`) e a lógica de login (chamadas a `sbClient.auth.signInWithPassword`/`getSession`). Create `src/ferramentas/auth/Auth.vue`:
```vue
<template>
  <div class="auth-screen"><!-- HTML de #auth-screen do legacy --></div>
</template>

<script setup>
import { sbClient } from '../../lib/supabase.js'
import { setSession } from '../../lib/estado.js'
import { useRouter } from 'vue-router'
const router = useRouter()

async function entrar(email, senha) {
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password: senha })
  if (error) { /* mostrar erro como no legado */ return }
  setSession(data.session)
  router.push({ name: 'home' })
}
</script>

<style scoped>
/* Colar aqui as regras #auth-screen do legacy, trocando o seletor por .auth-screen */
</style>
```

- [ ] **Step 2: Registrar a rota e a guarda**

Modify `src/router.js`: adicionar a rota de login e uma guarda global.
```js
{ path: '/login', name: 'login', component: () => import('./ferramentas/auth/Auth.vue') },
```
E depois de criar o router:
```js
import { estado } from './lib/estado.js'
router.beforeEach((to) => {
  if (to.name !== 'login' && !estado.currentSession) return { name: 'login' }
})
```

- [ ] **Step 3: Restaurar sessão ao abrir**

Modify `src/main.js` — antes de montar, tentar recuperar a sessão salva:
```js
import { sbClient } from './lib/supabase.js'
import { setSession } from './lib/estado.js'
const { data } = await sbClient.auth.getSession()
if (data.session) setSession(data.session)
```
(Envolver o `mount` para rodar após o `getSession`.)

- [ ] **Step 4: LEIA-ME**

Create `src/ferramentas/auth/LEIA-ME.txt`:
```
FERRAMENTA: Login (auth)
========================
Tela de entrada do sistema. Pede e-mail e senha e valida no Supabase.
Depois de logar, leva para a Home.
Arquivo principal: Auth.vue
```

- [ ] **Step 5: Testar login em dev (conta descartável)**

Run:
```bash
npm run dev
```
Expected: `/login` aparece; ao entrar com uma **conta de teste descartável** (NÃO usar contas reais), navega para a Home (placeholder). Recarregar a página mantém logado. Parar com Ctrl+C.

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat: tela de login (auth) como componente + guarda de rota

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Home como componente (navegação via router)

**Files:**
- Create: `src/ferramentas/home/LEIA-ME.txt`
- Modify: `src/ferramentas/home/Home.vue`
- Reference: `legacy/index.html` (`#home-screen` + funções `open*` chamadas pelos cards)

**Interfaces:**
- Consumes: `router` (vue-router), `estado`.
- Produces: Home com os cards das ferramentas; cada card navega via `router.push({ name: '<ferramenta>' })` em vez de `classList.add('active')`.

- [ ] **Step 1: Portar a Home**

De `legacy/index.html`, copiar o HTML de `#home-screen`, o CSS `#home-screen ...` (para `<style scoped>`) e a lógica dos cards. Trocar cada chamada de navegação (ex.: `openNoticias()`) por `router.push({ name: 'noticias' })`. Modify `src/ferramentas/home/Home.vue`:
```vue
<template>
  <div class="home-screen"><!-- HTML de #home-screen; cada card com @click="ir('noticias')" --></div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { estado } from '../../lib/estado.js'
const router = useRouter()
function ir(nome) { router.push({ name: nome }) }
</script>

<style scoped>
/* regras #home-screen do legacy, seletor trocado para .home-screen */
</style>
```

- [ ] **Step 2: LEIA-ME**

Create `src/ferramentas/home/LEIA-ME.txt`:
```
FERRAMENTA: Home
================
Tela inicial depois do login. Mostra os "cards" que levam a cada
ferramenta (Notícias, Meta Ads, Gestão, etc.).
Para adicionar um card novo: copie um card existente e troque o
router.push({ name: '...' }) para o nome da rota da ferramenta.
Arquivo principal: Home.vue
```

- [ ] **Step 3: Testar em dev**

Run:
```bash
npm run dev
```
Expected: após login, a Home mostra os cards com o visual atual; clicar no card de Notícias vai para `/noticias` (placeholder por enquanto). Parar com Ctrl+C.

- [ ] **Step 4: Commit**

Run:
```bash
git add -A
git commit -m "feat: Home como componente, navegação via vue-router

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Notícias — ferramenta piloto (Fase 2)

**Files:**
- Modify: `src/ferramentas/noticias/Noticias.vue`
- Create: `src/ferramentas/noticias/LEIA-ME.txt`
- Reference: `legacy/index.html` — HTML `#noticias-screen` (L11966); CSS `#noticias-screen ...` (a partir de L925 e L1287+); JS `openNoticias` (L9479), `closeNoticias` (L9486), `loadNoticias` (L10957) e helpers `np-*` que essas funções usam.

**Interfaces:**
- Consumes: `sbFetch` (api.js) e/ou `sbClient`; `estado`.
- Produces: rota `/noticias` renderiza a tela de Notícias idêntica à atual, carregando as notícias do banco.

- [ ] **Step 1: Extrair os pedaços da Notícias do legado**

Run (localizar limites exatos para copiar):
```bash
cd /Users/erickmartins/iamundi
grep -nE '#noticias-screen' legacy/index.html | head -40   # todas as regras CSS
awk 'NR>=11966 && NR<=12032' legacy/index.html | head -80   # HTML da tela (ajustar fim no fechamento da div)
awk 'NR>=10957 && /^}/{print NR": "$0; exit} NR>=10957' legacy/index.html | tail -1  # fim de loadNoticias
```
Expected: identificar (a) o bloco `<div id="noticias-screen">…</div>`, (b) o conjunto de regras CSS `#noticias-screen …`, (c) o corpo de `openNoticias`, `closeNoticias`, `loadNoticias`.

- [ ] **Step 2: Montar o componente**

Modify `src/ferramentas/noticias/Noticias.vue`:
```vue
<template>
  <div class="noticias-screen"><!-- HTML de #noticias-screen do legacy --></div>
</template>

<script setup>
import { onMounted } from 'vue'
import { sbFetch } from '../../lib/api.js'
import { estado } from '../../lib/estado.js'

// Portar aqui o corpo de loadNoticias() do legado, trocando as buscas
// diretas ao Supabase por sbFetch(...) e a manipulação de DOM (getElementById)
// por refs/estado reativo do Vue.
async function carregar() {
  // ... conteúdo portado de loadNoticias (L10957) ...
}

onMounted(carregar)
</script>

<style scoped>
/* Colar TODAS as regras #noticias-screen do legacy, trocando o seletor
   #noticias-screen por .noticias-screen (o scoped isola o resto). */
</style>
```

- [ ] **Step 3: LEIA-ME**

Create `src/ferramentas/noticias/LEIA-ME.txt`:
```
FERRAMENTA: Notícias
====================
Portal de notícias (revista). Carrega as matérias do banco (Supabase)
e mostra em formato de revista com abas.
Arquivo principal: Noticias.vue
- carregar(): busca as notícias no banco quando a tela abre.
Para mexer só nesta tela, edite apenas esta pasta.
```

- [ ] **Step 4: Testar em dev contra o banco real (leitura)**

Run:
```bash
npm run dev
```
Expected: após login (conta de teste), abrir `/noticias`: a tela aparece **idêntica** à produção atual e lista as notícias vindas do banco. Comparar lado a lado com o site em produção. Parar com Ctrl+C.

- [ ] **Step 5: Verificar o build**

Run:
```bash
npm run build
```
Expected: build sem erro.

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat: Notícias migrada para componente Vue (ferramenta piloto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Preview na Vercel + documentação da estrutura

**Files:**
- Create: `src/ferramentas/LEIA-ME.txt`, `LEIA-ME-DEV.txt` (raiz)
- Push: branch `vue-migracao`

**Interfaces:**
- Produces: URL de preview da Vercel com login → home → Notícias funcionando; documentação de como rodar/estruturar.

- [ ] **Step 1: LEIA-ME das ferramentas**

Create `src/ferramentas/LEIA-ME.txt`:
```
PASTA: ferramentas
==================
Cada subpasta aqui é UMA ferramenta/tela do iamundi (um "componente").
Regra de ouro para trabalhar em equipe sem conflito:
- Cada pessoa mexe SÓ na pasta da ferramenta dela.
- Duas pessoas em ferramentas diferentes nunca editam o mesmo arquivo.
O que é compartilhado por todas fica em ../lib (mexer só com o TI).
```

- [ ] **Step 2: Guia de desenvolvimento na raiz**

Create `LEIA-ME-DEV.txt`:
```
COMO RODAR O IAMUNDI (VERSÃO NOVA, EM VUE)
==========================================
1) Instalar uma vez:   npm install
2) Rodar no seu Mac:    npm run dev   (abre em http://localhost:5173)
3) Testar o build:      npm run build

ONDE FICA CADA COISA
====================
- src/ferramentas/<nome>/  → cada tela (é aqui que você trabalha)
- src/lib/                 → conexão com banco/estado (mexer só com o TI)
- src/estilos/global.css   → cores, fontes, topbar
- legacy/index.html        → sistema ANTIGO (rollback e fonte de cópia)

IMPORTANTE
==========
- Sempre trabalhe na pasta da SUA ferramenta para evitar conflito.
- A produção só muda na "virada final", quando tudo estiver migrado.
```

- [ ] **Step 3: Commit e push da branch**

Run:
```bash
git add -A
git commit -m "docs: LEIA-ME da estrutura Vue (ferramentas + guia de dev)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin vue-migracao
```
Expected: push aceito na conta `brenoov`.

- [ ] **Step 4: Validar o preview na Vercel**

A Vercel cria automaticamente um preview para a branch. Abrir a URL de preview e verificar:
- Login com conta de teste funciona.
- Home aparece com os cards.
- Notícias abre idêntica à produção e lista as matérias.

Expected: build da Vercel verde e as três telas funcionando no preview. **Produção (main) permanece intocada.**

- [ ] **Step 5: Marcar conclusão da Fase 2**

O preview validado encerra este plano. As próximas ferramentas (Meta Ads, Gestão×3, Acessos, Admin, Banco, Sales×3) seguem **exatamente o padrão da Task 7**, uma por sessão, cada uma no seu plano. A **virada final** (merge para `main` + apontar a Vercel para o build) é um plano à parte, executado só quando todas as telas estiverem migradas e o preview tiver paridade total.

---

## Próximos planos (fora deste)

- **1 plano por ferramenta restante** (repetir Task 7): `meta-ads` (Hub + Campanha), `gestao-comercial`, `gestao-trafego`, `gestao-vista`, `acessos`, `admin`, `banco`, `sales` (Menu + Análise + Marca).
- **Plano de virada final:** merge `vue-migracao` → `main`, ajuste do `vercel.json`/config para servir o build (`dist/`) preservando rewrites de `/midia` e headers de segurança, e teste de rollback via `legacy/index.html`.
