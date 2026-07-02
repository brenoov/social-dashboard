# Migração iamundi → Vue — Fases 0/1/2 (esqueleto + miolo + Notícias) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar o esqueleto Vue+Vite do iamundi, migrar o miolo compartilhado (Supabase, estado, login, home) e a primeira ferramenta piloto (Notícias), tudo validado num preview da Vercel, sem tocar na produção.

**Architecture:** Trabalhamos numa branch `vue-migracao`. O monólito `index.html` é movido para `legacy/index.html` (rollback e fonte de extração). Um projeto Vite+Vue 3 nasce na raiz: `src/moldura-do-aplicativo.vue` é a moldura (topbar/fundo) e `vue-router` substitui a navegação por classe `active`. O miolo compartilhado vive em `src/compartilhado/` (poucos arquivos, mudança combinada com o TI); cada tela vira um componente próprio em `src/ferramentas/<nome>/` com CSS `scoped`. Produção (branch `main`) fica intacta até a virada final (fora do escopo deste plano).

**Tech Stack:** Vue 3, Vite, vue-router. Libs já usadas mantidas via CDN no `<head>` (supabase-js, xlsx, chart.js, chartjs-plugin-datalabels).

## Global Constraints

- **Conta Git:** commits/push na identidade `brenoov` (`git config user.name brenoov`, `user.email breno@rbvcompany.com`). Repo `brenoov/social-dashboard`.
- **E-mail do Git nunca vazio:** e-mail vazio TRAVA o build na Vercel. Confirmar antes de cada commit.
- **Produção intocada:** nada neste plano altera a branch `main`. Todo trabalho é na branch `vue-migracao` → valida em preview.
- **Comportamento idêntico:** é reorganização técnica. Nenhuma tela muda de visual ou comportamento. Copiar o HTML/CSS/JS existente; adaptar só a navegação (router) e o empacotamento (componente).
- **Dados reais:** ao testar login/dados, usar uma conta descartável/de teste — nunca semear, limpar ou trocar senha de contas reais (Franciele, Erick, admin).
- **Nomes de arquivos/pastas em PT literal (kebab-case):** nomes bem descritivos em português, ex.: `conectar-no-banco-de-dados.js`, `tela-de-noticias.vue`, `src/compartilhado/`. Só ficam com nome técnico os fixados pela ferramenta (`index.html`, `package.json`, `vite.config.js`) — e esses são explicados num `LEIA-ME.txt`. Identificadores dentro do código JS (funções/exports) seguem convenção normal (não podem ter hífen).
- **LEIA-ME por pasta:** TODA pasta nova ganha `LEIA-ME.txt` em PT, linguagem de iniciante.
- **CSS por tela é `scoped`:** só o que é realmente global (tokens, reset, topbar, fundo) vai para `src/estilos/estilos-globais.css`.

---

### Task 1: Branch de migração + mover monólito para legacy

**Files:**
- Move: `index.html` → `legacy/index.html`
- Create: `legacy/LEIA-ME.txt`

**Interfaces:**
- Produces: `legacy/index.html` (monólito original preservado, fonte de extração das próximas tasks).

**STATUS: CONCLUÍDA** (commit 876e87c). Mantida aqui para referência.

- [x] **Step 1: Confirmar branch e identidade** — `main` limpa, `brenoov`/`breno@rbvcompany.com`.
- [x] **Step 2: Criar a branch** — `git checkout -b vue-migracao`.
- [x] **Step 3: Mover o monólito** — `git mv index.html legacy/index.html`.
- [x] **Step 4: LEIA-ME do legacy** — criado.
- [x] **Step 5: Commit** — 876e87c.

---

### Task 2: Esqueleto Vite + Vue 3 (Fase 0)

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore` (append `node_modules`, `dist`)
- Create: `index.html` (novo, entrada do Vite)
- Create: `src/ponto-de-partida.js`, `src/moldura-do-aplicativo.vue`, `src/mapa-de-enderecos.js`
- Create placeholders: `src/ferramentas/inicio/tela-inicial.vue`, `src/ferramentas/noticias/tela-de-noticias.vue`

**Interfaces:**
- Produces: app Vue montável (`#app`), roteador com rotas `inicio` e `noticias` (placeholders). Libs globais (`window.supabase`, `window.XLSX`, `window.Chart`) disponíveis via CDN no `index.html`.

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

Create `index.html` (mantém as libs CDN que o código legado usa via `window.*`; o script aponta para o nosso ponto de partida):
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
  <script type="module" src="/src/ponto-de-partida.js"></script>
</body>
</html>
```

- [ ] **Step 4: Criar `src/mapa-de-enderecos.js` com rotas placeholder**

Create `src/mapa-de-enderecos.js`:
```js
import { createRouter, createWebHistory } from 'vue-router'

const rotas = [
  { path: '/', name: 'inicio', component: () => import('./ferramentas/inicio/tela-inicial.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue') },
]

export const roteador = createRouter({
  history: createWebHistory(),
  routes: rotas,
})
```

- [ ] **Step 5: Criar componentes placeholder para as rotas**

Create `src/ferramentas/inicio/tela-inicial.vue`:
```vue
<template><div style="padding:40px">Início (placeholder)</div></template>
```
Create `src/ferramentas/noticias/tela-de-noticias.vue`:
```vue
<template><div style="padding:40px">Notícias (placeholder)</div></template>
```

- [ ] **Step 6: Criar `src/moldura-do-aplicativo.vue` (moldura mínima)**

Create `src/moldura-do-aplicativo.vue`:
```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 7: Criar `src/ponto-de-partida.js`**

Create `src/ponto-de-partida.js`:
```js
import { createApp } from 'vue'
import Moldura from './moldura-do-aplicativo.vue'
import { roteador } from './mapa-de-enderecos.js'

createApp(Moldura).use(roteador).mount('#app')
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
Expected: Vite sobe (ex.: `http://localhost:5173`). Abrir no navegador: rota `/` mostra "Início (placeholder)"; `/noticias` mostra "Notícias (placeholder)". Parar com Ctrl+C.

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
git commit -m "feat: esqueleto Vite + Vue 3 com roteador e libs CDN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Miolo compartilhado — `src/compartilhado/` (Fase 1)

**Files:**
- Create: `src/compartilhado/conectar-no-banco-de-dados.js`, `src/compartilhado/buscar-e-salvar-dados.js`, `src/compartilhado/controle-de-login-e-usuario.js`, `src/compartilhado/LEIA-ME.txt`
- Reference: `legacy/index.html` (config Supabase ~linha 3208; helpers "SUPABASE FETCH" ~linha 3276)

**Interfaces:**
- Produces:
  - `conectar-no-banco-de-dados.js` → `export const sbClient` (cliente Supabase criado com `window.supabase.createClient`), `export const SUPABASE_URL`, `export const SUPABASE_ANON_KEY`.
  - `buscar-e-salvar-dados.js` → `export async function sb(path)` (o MESMO helper de leitura do legado — `legacy/index.html` L3277-3286: GET, devolve sempre um array, engole erros retornando `[]`). Mantém o nome `sb` para o código das telas funcionar sem alteração.
  - `controle-de-login-e-usuario.js` → `export const estado` (objeto `reactive` com `currentSession`, `user`, `permissoes`), `export function setSession(session)`.

- [ ] **Step 1: Criar `conectar-no-banco-de-dados.js`**

Copiar os valores de `SUPABASE_URL` e `SUPABASE_ANON_KEY` de `legacy/index.html` (~linha 3209-3210). Create `src/compartilhado/conectar-no-banco-de-dados.js`:
```js
export const SUPABASE_URL = 'https://kounqtdoioootxqegkij.supabase.co'
export const SUPABASE_ANON_KEY = '<COPIAR-A-ANON-KEY-DE-legacy/index.html-linha-3210>'
export const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

- [ ] **Step 2: Criar `controle-de-login-e-usuario.js`**

Create `src/compartilhado/controle-de-login-e-usuario.js`:
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

- [ ] **Step 3: Criar `buscar-e-salvar-dados.js`**

Portar o helper `sb` EXATAMENTE como está no legado (`legacy/index.html` L3277-3286), mudando APENAS a referência de sessão: o legado usa a global `currentSession`; aqui use `estado.currentSession` (importado). NÃO inventar opções/method/throw — manter o mesmo comportamento (GET, devolve array, engole erro → `[]`). Create `src/compartilhado/buscar-e-salvar-dados.js`:
```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'
import { estado } from './controle-de-login-e-usuario.js'

// Helper de leitura ao REST do Supabase — portado VERBATIM de legacy/index.html
// L3277-3286 (única mudança: currentSession -> estado.currentSession).
export async function sb(path) {
  try {
    const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    return Array.isArray(json) ? json : []
  } catch (e) { return [] }
}
```

- [ ] **Step 4: LEIA-ME do miolo**

Create `src/compartilhado/LEIA-ME.txt`:
```
O QUE É ESTA PASTA (MIOLO COMPARTILHADO)
========================================
Aqui ficam as peças que TODAS as ferramentas usam:
- conectar-no-banco-de-dados.js  → conexão com o banco (Supabase)
- buscar-e-salvar-dados.js       → função para buscar/salvar dados no banco
- controle-de-login-e-usuario.js → quem está logado, usuário e permissões

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
git commit -m "feat: miolo compartilhado (banco, dados, login) em src/compartilhado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: CSS global + moldura (topbar/fundo)

**Files:**
- Create: `src/estilos/estilos-globais.css`, `src/estilos/LEIA-ME.txt`
- Modify: `src/moldura-do-aplicativo.vue`, `src/ponto-de-partida.js`
- Reference: `legacy/index.html` (bloco `<style>` — `:root`, reset, `.topbar`, fundo)

**Interfaces:**
- Consumes: `estado` de `src/compartilhado/controle-de-login-e-usuario.js`.
- Produces: `moldura-do-aplicativo.vue` renderiza topbar/fundo + `<router-view>`; `estilos-globais.css` importado uma vez em `ponto-de-partida.js`.

- [ ] **Step 1: Extrair o CSS global**

De `legacy/index.html`, copiar para `src/estilos/estilos-globais.css` APENAS o que é global: variáveis `:root` (e `[data-theme="dark"]`), reset (`*`, `body`, fontes `@import`/`@font-face`), e as regras da topbar e do fundo. **NÃO** copiar regras que começam com `#...-screen` (essas vão para cada componente depois).

- [ ] **Step 2: Importar o CSS global**

Modify `src/ponto-de-partida.js` — adicionar no topo:
```js
import './estilos/estilos-globais.css'
```

- [ ] **Step 3: Montar a moldura**

De `legacy/index.html`, copiar o HTML da topbar (o cabeçalho fixo comum a todas as telas). Modify `src/moldura-do-aplicativo.vue`:
```vue
<template>
  <div class="moldura">
    <!-- Copiar aqui o HTML da topbar do legacy/index.html -->
    <router-view />
  </div>
</template>

<script setup>
import { estado } from './compartilhado/controle-de-login-e-usuario.js'
</script>
```

- [ ] **Step 4: LEIA-ME dos estilos**

Create `src/estilos/LEIA-ME.txt`:
```
PASTA: estilos
==============
estilos-globais.css → cores, fontes, a barra do topo (topbar) e o fundo.
É o visual que aparece em TODAS as telas.
O visual específico de cada tela fica DENTRO do arquivo da própria tela
(na parte <style scoped>), para não misturar nem dar conflito.
```

- [ ] **Step 5: Verificar em dev**

Run:
```bash
npm run dev
```
Expected: a topbar aparece no topo com o visual atual; fundo correto; placeholders de Início/Notícias abaixo. Parar com Ctrl+C.

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat: CSS global + moldura (topbar/fundo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Login como componente

**Files:**
- Create: `src/ferramentas/login/tela-de-login.vue`, `src/ferramentas/login/LEIA-ME.txt`
- Modify: `src/mapa-de-enderecos.js`
- Reference: `legacy/index.html` (`#auth-screen` + funções de login/`sbClient.auth`)

**Interfaces:**
- Consumes: `sbClient` (conectar-no-banco-de-dados.js), `setSession` (controle-de-login-e-usuario.js).
- Produces: rota `/login` (name `login`); ao autenticar, chama `setSession` e navega para `inicio`. Guarda de rota: rotas protegidas redirecionam para `/login` quando `estado.currentSession` é nulo.

- [ ] **Step 1: Criar o componente de login**

De `legacy/index.html`, copiar o HTML de `#auth-screen`, o CSS `#auth-screen ...` (para dentro de `<style scoped>`) e a lógica de login (chamadas a `sbClient.auth.signInWithPassword`/`getSession`). Create `src/ferramentas/login/tela-de-login.vue`:
```vue
<template>
  <div class="tela-login"><!-- HTML de #auth-screen do legacy --></div>
</template>

<script setup>
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { setSession } from '../../compartilhado/controle-de-login-e-usuario.js'
import { useRouter } from 'vue-router'
const router = useRouter()

async function entrar(email, senha) {
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password: senha })
  if (error) { /* mostrar erro como no legado */ return }
  setSession(data.session)
  router.push({ name: 'inicio' })
}
</script>

<style scoped>
/* Colar aqui as regras #auth-screen do legacy, trocando o seletor por .tela-login */
</style>
```

- [ ] **Step 2: Registrar a rota e a guarda**

Modify `src/mapa-de-enderecos.js`: adicionar a rota de login e uma guarda global.
```js
{ path: '/login', name: 'login', component: () => import('./ferramentas/login/tela-de-login.vue') },
```
E depois de criar o roteador:
```js
import { estado } from './compartilhado/controle-de-login-e-usuario.js'
roteador.beforeEach((to) => {
  if (to.name !== 'login' && !estado.currentSession) return { name: 'login' }
})
```

- [ ] **Step 3: Restaurar sessão ao abrir**

Modify `src/ponto-de-partida.js` — antes de montar, tentar recuperar a sessão salva:
```js
import { sbClient } from './compartilhado/conectar-no-banco-de-dados.js'
import { setSession } from './compartilhado/controle-de-login-e-usuario.js'
const { data } = await sbClient.auth.getSession()
if (data.session) setSession(data.session)
```
(Envolver o `mount` para rodar após o `getSession`.)

- [ ] **Step 4: LEIA-ME**

Create `src/ferramentas/login/LEIA-ME.txt`:
```
FERRAMENTA: Login
=================
Tela de entrada do sistema. Pede e-mail e senha e valida no Supabase.
Depois de logar, leva para a tela Início.
Arquivo principal: tela-de-login.vue
```

- [ ] **Step 5: Testar login em dev (conta descartável)**

Run:
```bash
npm run dev
```
Expected: `/login` aparece; ao entrar com uma **conta de teste descartável** (NÃO usar contas reais), navega para Início (placeholder). Recarregar a página mantém logado. Parar com Ctrl+C.

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat: tela de login como componente + guarda de rota

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Início (home) como componente

**Files:**
- Create: `src/ferramentas/inicio/LEIA-ME.txt`
- Modify: `src/ferramentas/inicio/tela-inicial.vue`
- Reference: `legacy/index.html` (`#home-screen` + funções `open*` chamadas pelos cards)

**Interfaces:**
- Consumes: `roteador` (vue-router), `estado`.
- Produces: Início com os cards das ferramentas; cada card navega via `router.push({ name: '<ferramenta>' })` em vez de `classList.add('active')`.

- [ ] **Step 1: Portar a tela Início**

De `legacy/index.html`, copiar o HTML de `#home-screen`, o CSS `#home-screen ...` (para `<style scoped>`) e a lógica dos cards. Trocar cada chamada de navegação (ex.: `openNoticias()`) por `router.push({ name: 'noticias' })`. Modify `src/ferramentas/inicio/tela-inicial.vue`:
```vue
<template>
  <div class="tela-inicio"><!-- HTML de #home-screen; cada card com @click="ir('noticias')" --></div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { estado } from '../../compartilhado/controle-de-login-e-usuario.js'
const router = useRouter()
function ir(nome) { router.push({ name: nome }) }
</script>

<style scoped>
/* regras #home-screen do legacy, seletor trocado para .tela-inicio */
</style>
```

- [ ] **Step 2: LEIA-ME**

Create `src/ferramentas/inicio/LEIA-ME.txt`:
```
FERRAMENTA: Início
==================
Tela inicial depois do login. Mostra os "cards" que levam a cada
ferramenta (Notícias, Meta Ads, Gestão, etc.).
Para adicionar um card novo: copie um card existente e troque o
router.push({ name: '...' }) para o nome da rota da ferramenta.
Arquivo principal: tela-inicial.vue
```

- [ ] **Step 3: Testar em dev**

Run:
```bash
npm run dev
```
Expected: após login, a tela Início mostra os cards com o visual atual; clicar no card de Notícias vai para `/noticias` (placeholder por enquanto). Parar com Ctrl+C.

- [ ] **Step 4: Commit**

Run:
```bash
git add -A
git commit -m "feat: tela Início como componente, navegação via vue-router

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Notícias — ferramenta piloto (Fase 2)

**Files:**
- Modify: `src/ferramentas/noticias/tela-de-noticias.vue`
- Create: `src/ferramentas/noticias/LEIA-ME.txt`
- Reference: `legacy/index.html` — HTML `#noticias-screen` (L11966); CSS `#noticias-screen ...` (a partir de L925 e L1287+); JS `openNoticias` (L9479), `closeNoticias` (L9486), `loadNoticias` (L10957) e helpers `np-*` que essas funções usam.

**Interfaces:**
- Consumes: `sb` (buscar-e-salvar-dados.js) e/ou `sbClient`; `estado`.
- Produces: rota `/noticias` renderiza a tela de Notícias idêntica à atual, carregando as notícias do banco.

- [ ] **Step 1: Extrair os pedaços da Notícias do legado**

Run (localizar limites exatos para copiar):
```bash
cd /Users/erickmartins/iamundi
grep -nE '#noticias-screen' legacy/index.html | head -40   # todas as regras CSS
awk 'NR>=11966 && NR<=12032' legacy/index.html | head -80   # HTML da tela (ajustar fim no fechamento da div)
```
Expected: identificar (a) o bloco `<div id="noticias-screen">…</div>`, (b) o conjunto de regras CSS `#noticias-screen …`, (c) o corpo de `openNoticias`, `closeNoticias`, `loadNoticias`.

- [ ] **Step 2: Montar o componente**

Modify `src/ferramentas/noticias/tela-de-noticias.vue`:
```vue
<template>
  <div class="tela-noticias"><!-- HTML de #noticias-screen do legacy --></div>
</template>

<script setup>
import { onMounted } from 'vue'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { estado } from '../../compartilhado/controle-de-login-e-usuario.js'

// Portar aqui o corpo de loadNoticias() do legado, trocando as buscas
// diretas ao Supabase por sb(...) e a manipulação de DOM (getElementById)
// por refs/estado reativo do Vue.
async function carregar() {
  // ... conteúdo portado de loadNoticias (L10957) ...
}

onMounted(carregar)
</script>

<style scoped>
/* Colar TODAS as regras #noticias-screen do legacy, trocando o seletor
   #noticias-screen por .tela-noticias (o scoped isola o resto). */
</style>
```

- [ ] **Step 3: LEIA-ME**

Create `src/ferramentas/noticias/LEIA-ME.txt`:
```
FERRAMENTA: Notícias
====================
Portal de notícias (revista). Carrega as matérias do banco (Supabase)
e mostra em formato de revista com abas.
Arquivo principal: tela-de-noticias.vue
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
- Create: `src/ferramentas/LEIA-ME.txt`, `LEIA-ME-COMO-RODAR.txt` (raiz)
- Push: branch `vue-migracao`

**Interfaces:**
- Produces: URL de preview da Vercel com login → início → Notícias funcionando; documentação de como rodar/estruturar.

- [ ] **Step 1: LEIA-ME das ferramentas**

Create `src/ferramentas/LEIA-ME.txt`:
```
PASTA: ferramentas
==================
Cada subpasta aqui é UMA ferramenta/tela do iamundi (um "componente").
Regra de ouro para trabalhar em equipe sem conflito:
- Cada pessoa mexe SÓ na pasta da ferramenta dela.
- Duas pessoas em ferramentas diferentes nunca editam o mesmo arquivo.
O que é compartilhado por todas fica em ../compartilhado (mexer só com o TI).
```

- [ ] **Step 2: Guia de desenvolvimento na raiz**

Create `LEIA-ME-COMO-RODAR.txt`:
```
COMO RODAR O IAMUNDI (VERSÃO NOVA, EM VUE)
==========================================
1) Instalar uma vez:   npm install
2) Rodar no seu Mac:    npm run dev   (abre em http://localhost:5173)
3) Testar o build:      npm run build

ONDE FICA CADA COISA
====================
- src/ferramentas/<nome>/   → cada tela (é aqui que você trabalha)
- src/compartilhado/        → conexão com banco/dados/login (mexer só com o TI)
- src/estilos/estilos-globais.css → cores, fontes, topbar
- legacy/index.html         → sistema ANTIGO (rollback e fonte de cópia)

NOMES FIXOS (não renomear — a ferramenta exige):
- index.html       → página de entrada
- package.json     → lista de dependências
- vite.config.js   → configuração do montador (Vite)

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
- Início aparece com os cards.
- Notícias abre idêntica à produção e lista as matérias.

Expected: build da Vercel verde e as três telas funcionando no preview. **Produção (main) permanece intocada.**

- [ ] **Step 5: Marcar conclusão da Fase 2**

O preview validado encerra este plano. As próximas ferramentas (Meta Ads, Gestão×3, Acessos, Admin, Banco, Sales×3) seguem **exatamente o padrão da Task 7**, uma por sessão, cada uma no seu plano. A **virada final** (merge para `main` + apontar a Vercel para o build) é um plano à parte, executado só quando todas as telas estiverem migradas e o preview tiver paridade total.

---

## Próximos planos (fora deste)

- **1 plano por ferramenta restante** (repetir Task 7): `meta-ads` (com `tela-meta-ads-hub.vue` + `tela-meta-ads-campanha.vue`), `gestao-comercial`, `gestao-trafego`, `gestao-vista`, `acessos`, `admin`, `banco`, `sales` (menu + análise + marca). Cada pasta em PT literal + `LEIA-ME.txt`.
- **Plano de virada final:** merge `vue-migracao` → `main`, ajuste do `vercel.json`/config para servir o build (`dist/`) preservando rewrites de `/midia` e headers de segurança, e teste de rollback via `legacy/index.html`.
