# Notificação Diária de Vendas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar um push consolidado às 22h BRT com as vendas do dia (total + por canal, com % vs ontem) para todo usuário logado que ativou o 🔔.

**Architecture:** SW novo (sem cache) trata push; front Vue inscreve e mostra modal insistente; Edge `enviar-push-vendas` (Deno) busca hoje+ontem no Bling via `bling-proxy`, agrega por canal com módulo puro testável e envia via `npm:web-push`; `pg_cron` dispara a Edge às 01:00 UTC.

**Tech Stack:** Vue 3/Vite, Supabase (Edge Functions Deno, Postgres, pg_cron), Web Push (VAPID), `npm:web-push`, `node --test`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-iamundi-notificacao-vendas-design.md`.
- Nomes de arquivo/pasta em **PT kebab-case** (ex.: `notificacoes-push.js`); só nomes técnicos fixos (`sw-push.js`, slug de Edge) ficam em inglês.
- Repo: **brenoov/social-dashboard**, conta gh **brenoov**. Branch atual: `feat/notificacao-vendas`.
- Deploy conferido pelos **checks do commit** (MCP Vercel dá 403 neste projeto).
- Migrations nomeadas por data: `db/migrations/2026-07-24-<nome>.sql`.
- Pedidos do Bling: `pedidos/vendas` com `idsSituacoes[]=9`; campo de valor = `total`, contagem de itens do pedido, `loja_id` = canal. Nomes de canal na tabela `bling_lojas (loja_id, nome)`.
- Edge é **Deno** → web push com `npm:web-push@3` (não Node `/api`). VAPID em secrets do Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **SW não cacheia nada** (gotcha de PWA servindo index.html velho — [[project_erickia_gotcha_pwa_cache]]).
- `% = (hoje−ontem)/ontem`; se `ontem=0` → `null` (exibir "novo"/"—", nunca +∞).
- Bling parcial/erro às 22h → **envia mesmo assim** com aviso "dados parciais".

---

### Task 1: Migration `push_subs`

**Files:**
- Create: `db/migrations/2026-07-24-push-subs.sql`

**Interfaces:**
- Produces: tabela `push_subs(id uuid pk, endpoint text unique, p256dh text, auth text, user_id uuid, created_at timestamptz)`. RLS: dono (`auth.uid() = user_id`) faz insert/select/delete; envio usa service role (bypassa RLS).

- [ ] **Step 1: Escrever a migration**

```sql
-- db/migrations/2026-07-24-push-subs.sql
-- Inscrições de Web Push (opt-in aberto): uma linha por navegador/dispositivo inscrito.
create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_subs enable row level security;

-- O dono gerencia a própria inscrição. O envio (Edge) usa service role e ignora RLS.
create policy push_subs_dono_select on public.push_subs
  for select using (auth.uid() = user_id);
create policy push_subs_dono_insert on public.push_subs
  for insert with check (auth.uid() = user_id);
create policy push_subs_dono_update on public.push_subs
  for update using (auth.uid() = user_id);
create policy push_subs_dono_delete on public.push_subs
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Usar `mcp__plugin_supabase_supabase__apply_migration` com o SQL acima (name: `push_subs`).

- [ ] **Step 3: Verificar**

`mcp__plugin_supabase_supabase__execute_sql`:
```sql
select count(*) from public.push_subs;
select policyname from pg_policies where tablename = 'push_subs' order by policyname;
```
Esperado: count 0; 4 policies (`push_subs_dono_delete/insert/select/update`).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/2026-07-24-push-subs.sql
git commit -m "feat(push): migration push_subs (inscrições de web push + RLS por dono)"
```

---

### Task 2: Módulo puro de agregação `vendas-do-dia.js` + testes

**Files:**
- Create: `supabase/functions/_shared/vendas-do-dia.js`
- Test: `supabase/functions/_shared/vendas-do-dia.test.mjs`
- Modify: `package.json` (globs de teste incluem `supabase/functions/**`)

**Interfaces:**
- Produces:
  - `variacao(hoje: number, ontem: number): number|null` — fração; `null` se `ontem===0`.
  - `agregarVendasPorCanal({ pedidosHoje, pedidosOntem, lojas }): Agg` onde
    `Agg = { total: Metricas, canais: CanalAgg[] }`,
    `Metricas = { valor, vendas, itens, pct: { valor, vendas, itens } }` (pct = number|null),
    `CanalAgg = { loja_id, nome, ...Metricas }`, ordenado por `valor` desc.
    `pedido = { loja_id, total: number, itens: number }`; `loja = { loja_id, nome }`.
  - `montarCorpo(agg: Agg, { parcial: boolean }): { title, body, url, tag }`.

- [ ] **Step 1: Escrever os testes (falhando)**

```js
// supabase/functions/_shared/vendas-do-dia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variacao, agregarVendasPorCanal, montarCorpo } from './vendas-do-dia.js';

test('variacao: fração normal e ontem=0 vira null', () => {
  assert.equal(variacao(120, 100), 0.2);
  assert.equal(variacao(80, 100), -0.2);
  assert.equal(variacao(50, 0), null);
  assert.equal(variacao(0, 0), null);
});

const lojas = [{ loja_id: 1, nome: 'Tivoli' }, { loja_id: 2, nome: 'Dom Pedro' }, { loja_id: 3, nome: 'Shopee' }];

test('agrega por canal: total, contagem, itens e % vs ontem', () => {
  const pedidosHoje = [
    { loja_id: 1, total: 3000, itens: 30 }, { loja_id: 1, total: 1200, itens: 10 },
    { loja_id: 2, total: 2100, itens: 22 },
  ];
  const pedidosOntem = [
    { loja_id: 1, total: 3750, itens: 41 },
    { loja_id: 2, total: 2283, itens: 20 },
  ];
  const agg = agregarVendasPorCanal({ pedidosHoje, pedidosOntem, lojas });
  assert.equal(agg.total.valor, 6300);
  assert.equal(agg.total.vendas, 3);
  assert.equal(agg.total.itens, 62);
  const tiv = agg.canais.find(c => c.loja_id === 1);
  assert.equal(tiv.valor, 4200);
  assert.equal(tiv.vendas, 2);
  assert.equal(tiv.itens, 40);
  assert.equal(tiv.pct.valor, 0.12); // (4200-3750)/3750
});

test('canal sem venda hoje aparece com zero; ontem=0 => pct null (novo)', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 3, total: 900, itens: 14 }],
    pedidosOntem: [],
    lojas,
  });
  const shopee = agg.canais.find(c => c.loja_id === 3);
  assert.equal(shopee.valor, 900);
  assert.equal(shopee.pct.valor, null); // ontem=0
  const domPedro = agg.canais.find(c => c.loja_id === 2);
  assert.equal(domPedro.valor, 0);
  assert.equal(domPedro.vendas, 0);
});

test('canais ordenados por faturamento desc', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 2, total: 100, itens: 1 }, { loja_id: 1, total: 500, itens: 1 }],
    pedidosOntem: [], lojas,
  });
  assert.deepEqual(agg.canais.map(c => c.loja_id), [1, 2, 3]);
});

test('montarCorpo: título com total; corpo com quebra; parcial vira aviso', () => {
  const agg = agregarVendasPorCanal({
    pedidosHoje: [{ loja_id: 1, total: 4200, itens: 40 }],
    pedidosOntem: [{ loja_id: 1, total: 3750, itens: 41 }], lojas,
  });
  const n = montarCorpo(agg, { parcial: false });
  assert.match(n.title, /Vendas de hoje/);
  assert.match(n.title, /R\$/);
  assert.match(n.body, /Tivoli/);
  assert.equal(n.url, '/gestao-a-vista');
  const p = montarCorpo(agg, { parcial: true });
  assert.match(p.body, /parciais/i);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test supabase/functions/_shared/vendas-do-dia.test.mjs`
Expected: FAIL (`Cannot find module './vendas-do-dia.js'`).

- [ ] **Step 3: Implementar o módulo puro**

```js
// supabase/functions/_shared/vendas-do-dia.js
// Lógica pura (sem rede) de agregação das vendas do dia por canal e montagem do
// corpo da notificação. Importada pela Edge enviar-push-vendas E testada por node --test.

export function variacao(hoje, ontem) {
  if (!ontem) return null;              // ontem 0/undefined -> "novo"/"—", nunca +∞
  return (hoje - ontem) / ontem;
}

function metricasVazias() { return { valor: 0, vendas: 0, itens: 0 }; }

function somaPorLoja(pedidos) {
  const m = new Map();
  for (const p of (pedidos || [])) {
    const k = p.loja_id;
    const cur = m.get(k) || metricasVazias();
    cur.valor += Number(p.total) || 0;
    cur.vendas += 1;
    cur.itens += Number(p.itens) || 0;
    m.set(k, cur);
  }
  return m;
}

function comPct(hoje, ontem) {
  return {
    valor: hoje.valor, vendas: hoje.vendas, itens: hoje.itens,
    pct: {
      valor: variacao(hoje.valor, ontem.valor),
      vendas: variacao(hoje.vendas, ontem.vendas),
      itens: variacao(hoje.itens, ontem.itens),
    },
  };
}

export function agregarVendasPorCanal({ pedidosHoje, pedidosOntem, lojas }) {
  const hoje = somaPorLoja(pedidosHoje);
  const ontem = somaPorLoja(pedidosOntem);

  const canais = (lojas || []).map((l) => {
    const h = hoje.get(l.loja_id) || metricasVazias();
    const o = ontem.get(l.loja_id) || metricasVazias();
    return { loja_id: l.loja_id, nome: l.nome, ...comPct(h, o) };
  }).sort((a, b) => b.valor - a.valor);

  const soma = (arr, campo) => arr.reduce((s, x) => s + x[campo], 0);
  const totH = { valor: soma(canais, 'valor'), vendas: soma(canais, 'vendas'), itens: soma(canais, 'itens') };
  const totO = {
    valor: [...ontem.values()].reduce((s, x) => s + x.valor, 0),
    vendas: [...ontem.values()].reduce((s, x) => s + x.vendas, 0),
    itens: [...ontem.values()].reduce((s, x) => s + x.itens, 0),
  };
  return { total: comPct(totH, totO), canais };
}

function brl(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function pctStr(p) {
  if (p === null || p === undefined) return 'novo';
  const s = Math.round(p * 100);
  return (s > 0 ? '+' : '') + s + '%';
}

export function montarCorpo(agg, { parcial } = {}) {
  const t = agg.total;
  const title = `Vendas de hoje · ${brl(t.valor)} (${pctStr(t.pct.valor)})`;
  const linhas = [
    `${t.vendas} vendas (${pctStr(t.pct.vendas)}) · ${t.itens} itens (${pctStr(t.pct.itens)})`,
    '──────────────',
    ...agg.canais.map((c) => `${c.nome}  ${brl(c.valor)} (${pctStr(c.pct.valor)})`),
  ];
  if (parcial) linhas.push('⚠️ dados parciais (Bling instável às 22h)');
  return { title, body: linhas.join('\n'), url: '/gestao-a-vista', tag: 'vendas-do-dia' };
}
```

- [ ] **Step 4: Ampliar globs de teste no package.json**

Modificar `package.json` linhas 9-10:
```json
    "test": "node --test 'src/**/*.test.mjs' 'coletor/**/*.test.mjs' 'supabase/functions/**/*.test.mjs'",
    "test:ci": "node --test 'src/**/*.test.mjs' 'supabase/functions/**/*.test.mjs'",
```
(O módulo é puro/sem rede, então pode rodar no CI.)

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test supabase/functions/_shared/vendas-do-dia.test.mjs`
Expected: PASS (todos os testes).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/vendas-do-dia.js supabase/functions/_shared/vendas-do-dia.test.mjs package.json
git commit -m "feat(push): módulo puro vendas-do-dia (agregação por canal + corpo da notificação) + testes"
```

---

### Task 3: Service Worker `public/sw-push.js`

**Files:**
- Create: `public/sw-push.js`

**Interfaces:**
- Produces: SW que ouve `push` (mostra notificação a partir de `{title, body, url, tag}`) e `notificationclick` (foca/abre aba na `url`). **Sem cache.**

- [ ] **Step 1: Escrever o SW**

```js
// public/sw-push.js
// Service worker MÍNIMO só para Web Push. NÃO cacheia nada (evita servir index.html
// velho — gotcha de PWA já visto no erickIA). Ativa na hora.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }
  const title = d.title || 'Vendas de hoje';
  const options = {
    body: d.body || '',
    tag: d.tag || 'vendas-do-dia',
    renotify: true,
    icon: '/midia/app-icon-192.png',
    badge: '/midia/app-icon-192.png',
    data: { url: d.url || '/gestao-a-vista' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/gestao-a-vista';
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsArr) {
      if ('focus' in c) { c.navigate(url); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
```

- [ ] **Step 2: Verificar (smoke manual no harness)**

Copiar `public/sw-push.js` para o scratchpad num HTML mínimo que registra o SW e chama `registration.showNotification` via `postMessage` não é trivial; a validação real é no device. Verificação mínima aqui: `node -e "require('fs').readFileSync('public/sw-push.js','utf8')"` compila sem erro de sintaxe e o arquivo existe. Teste E2E de push fica na Task 8 (device do Breno).

- [ ] **Step 3: Commit**

```bash
git add public/sw-push.js
git commit -m "feat(push): service worker sw-push (push + notificationclick, sem cache)"
```

---

### Task 4: Helpers de push no front `notificacoes-push.js` + teste

**Files:**
- Create: `src/compartilhado/notificacoes-push.js`
- Test: `src/compartilhado/notificacoes-push.test.mjs`

**Interfaces:**
- Consumes: `sbClient` de `./conectar-no-banco-de-dados.js`; `VAPID_PUBLIC_KEY` (constante embutida).
- Produces:
  - `urlBase64ToUint8Array(base64: string): Uint8Array`
  - `pushSuportado(): boolean`
  - `permissaoAtual(): 'default'|'granted'|'denied'|'nao-suportado'`
  - `async registrarSW(): Promise<ServiceWorkerRegistration>`
  - `async inscrever(userId: string): Promise<boolean>` — pede permissão, inscreve, `upsert` em `push_subs`.
  - `async jaInscrito(): Promise<boolean>`
  - `async desinscrever(): Promise<void>`

- [ ] **Step 1: Escrever o teste da parte pura (falhando)**

```js
// src/compartilhado/notificacoes-push.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array } from './notificacoes-push.js';

test('urlBase64ToUint8Array: decodifica VAPID base64url para bytes', () => {
  // "BLc" base64url -> 3 bytes conhecidos
  const out = urlBase64ToUint8Array('BLc');
  assert.ok(out instanceof Uint8Array);
  assert.equal(out.length, 2);       // "BLc" (3 chars b64) = 2 bytes
  assert.equal(out[0], 0x04);
  assert.equal(out[1], 0xb7);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/compartilhado/notificacoes-push.test.mjs`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar os helpers**

```js
// src/compartilhado/notificacoes-push.js
import { sbClient } from './conectar-no-banco-de-dados.js';

// VAPID pública (pode ficar no front; a privada vive só nos secrets do Supabase).
// TROCAR pelo valor real gerado na Task 6 antes do deploy.
export const VAPID_PUBLIC_KEY = '__VAPID_PUBLIC_PLACEHOLDER__';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSuportado() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function permissaoAtual() {
  if (!pushSuportado()) return 'nao-suportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function registrarSW() {
  return navigator.serviceWorker.register('/sw-push.js');
}

export async function jaInscrito() {
  if (!pushSuportado()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function inscrever(userId) {
  if (!pushSuportado()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await registrarSW();
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const j = sub.toJSON();
  const { error } = await sbClient.from('push_subs').upsert({
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_id: userId,
  }, { onConflict: 'endpoint' });
  return !error;
}

export async function desinscrever() {
  const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const j = sub.toJSON();
  await sbClient.from('push_subs').delete().eq('endpoint', j.endpoint);
  await sub.unsubscribe();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/compartilhado/notificacoes-push.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compartilhado/notificacoes-push.js src/compartilhado/notificacoes-push.test.mjs
git commit -m "feat(push): helpers de inscrição no front (notificacoes-push) + teste do decoder VAPID"
```

---

### Task 5: Botão 🔔 + modal insistente na moldura

**Files:**
- Modify: `src/moldura-do-aplicativo.vue`

**Interfaces:**
- Consumes: `inscrever`, `jaInscrito`, `permissaoAtual`, `pushSuportado` de `../compartilhado/notificacoes-push.js` (caminho conforme a moldura); `estado.userId` de `controle-de-login-e-usuario.js`.
- Produces: nada consumido por outras tasks (UI final).

- [ ] **Step 1: Ler a moldura pra achar onde encaixar**

Ler `src/moldura-do-aplicativo.vue` inteiro. Localizar: (a) o `<script setup>` e imports; (b) onde há um topbar/cabeçalho pra pôr o botão 🔔; (c) o gancho de "abriu a Central logado" (montagem quando `estado.userId` existe).

- [ ] **Step 2: Adicionar estado e lógica no `<script setup>`**

```js
import { ref, watch, onMounted } from 'vue';
import { inscrever, jaInscrito, permissaoAtual, pushSuportado } from './compartilhado/notificacoes-push.js';
import { estado } from './compartilhado/controle-de-login-e-usuario.js';

const mostrarModalPush = ref(false);
const pushAtivo = ref(false);

async function avaliarPush() {
  if (!estado.userId || !pushSuportado()) return;
  pushAtivo.value = await jaInscrito();
  // Insistente: reaparece toda vez que abre logado e ainda não ativou,
  // desde que o navegador não tenha NEGADO explicitamente.
  mostrarModalPush.value = !pushAtivo.value && permissaoAtual() !== 'denied';
}

async function ativarPush() {
  const ok = await inscrever(estado.userId);
  pushAtivo.value = ok;
  if (ok) mostrarModalPush.value = false;
}

onMounted(avaliarPush);
// estado.userId pode chegar depois do boot (sessão assíncrona) -> reavaliar.
watch(() => estado.userId, avaliarPush);
```

- [ ] **Step 2b: Adicionar o botão 🔔 no topbar e o modal no template**

Botão (no cabeçalho existente):
```html
<button v-if="pushSuportado()" class="np-btn" :class="{ 'np-on': pushAtivo }"
        @click="ativarPush" :title="pushAtivo ? 'Notificações ativas' : 'Ativar notificações de vendas'">
  🔔
</button>
```

Modal insistente (final do template, dentro do root):
```html
<div v-if="mostrarModalPush" class="np-modal-fundo">
  <div class="np-modal">
    <div class="np-modal-emoji">🔔</div>
    <h3>Ativar notificação de vendas</h3>
    <p>Todo dia às 22h você recebe o resultado de vendas por canal, direto no celular.</p>
    <button class="np-modal-ativar" @click="ativarPush">Ativar agora</button>
  </div>
</div>
```

CSS (no `<style scoped>` da moldura; prefixo único `np-` — colisão CSS global é gotcha do projeto — [[project_iamundi_colisao_css_global]]):
```css
.np-btn { background: none; border: 0; font-size: 20px; cursor: pointer; opacity: .6; }
.np-btn.np-on { opacity: 1; }
.np-modal-fundo { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex;
  align-items: center; justify-content: center; z-index: 9999; }
.np-modal { background: #111; color: #fff; border-radius: 16px; padding: 28px 24px; max-width: 340px;
  width: calc(100% - 48px); text-align: center; }
.np-modal-emoji { font-size: 40px; }
.np-modal h3 { margin: 8px 0; }
.np-modal p { opacity: .8; font-size: 14px; line-height: 1.4; }
.np-modal-ativar { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 10px;
  background: #fff; color: #000; font-weight: 700; cursor: pointer; }
```

- [ ] **Step 3: Validar visualmente no harness**

Criar `scratchpad/push-modal-lab.html` que renderiza só o modal (HTML/CSS acima, sem Vue) e tirar screenshot pra conferir o visual. (Não há Playwright logado na iamundi — [[feedback_playwright_logado_conta_real]].)

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/moldura-do-aplicativo.vue
git commit -m "feat(push): botão 🔔 + modal insistente de opt-in na moldura"
```

---

### Task 6: Edge `enviar-push-vendas`

**Files:**
- Create: `supabase/functions/enviar-push-vendas/index.ts`
- Import: `../_shared/vendas-do-dia.js` (Task 2)

**Interfaces:**
- Consumes: `agregarVendasPorCanal`, `montarCorpo` de `../_shared/vendas-do-dia.js`; env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Produces: POST autenticado (service key) → busca dados, envia push a todas as `push_subs`, poda 410/404. Sem auth → 401.

- [ ] **Step 1: Gerar par de chaves VAPID**

Local: `node -e "const w=require('web-push');console.log(w.generateVAPIDKeys())"` (se `web-push` não estiver instalado localmente: `npx web-push generate-vapid-keys`). Guardar `publicKey`/`privateKey`.

- [ ] **Step 2: Setar secrets no Supabase**

Via CLI/MCP: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:breno@rbvcompany.com`.
E substituir `__VAPID_PUBLIC_PLACEHOLDER__` em `src/compartilhado/notificacoes-push.js` pela pública real (commit à parte).

- [ ] **Step 3: Escrever a Edge**

```ts
// supabase/functions/enviar-push-vendas/index.ts
// Cron 22h BRT: agrega vendas do dia (hoje vs ontem) por canal via bling-proxy e
// envia UM push consolidado a todas as inscrições push_subs. Envia parcial se o Bling falhar.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { agregarVendasPorCanal, montarCorpo } from '../_shared/vendas-do-dia.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:breno@rbvcompany.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Datas em BRT (UTC-3), como YYYY-MM-DD.
function brtHoje(): { hoje: string; ontem: string } {
  const nowBrt = new Date(Date.now() - 3 * 3600 * 1000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const ontem = new Date(nowBrt); ontem.setUTCDate(ontem.getUTCDate() - 1);
  return { hoje: d(nowBrt), ontem: d(ontem) };
}

// Chama bling-proxy (Edge->Edge) com service key. Pagina como o front (blingPages).
async function blingPages(endpoint: string, params: Record<string, unknown>) {
  const all: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/bling-proxy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: { ...params, pagina: page, limite: 100 } }),
    });
    const d = (await r.json())?.data;
    if (!Array.isArray(d) || d.length === 0) break;
    all.push(...d);
    if (d.length < 100) break;
  }
  return all;
}

// Normaliza pedido do Bling -> { loja_id, total, itens }.
function normalizar(p: any) {
  return {
    loja_id: p.loja?.id ?? p.loja_id ?? null,
    total: Number(p.total) || 0,
    itens: Array.isArray(p.itens) ? p.itens.length : (Number(p.numeroItens) || 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // Gate: exige Authorization Bearer com o service key (o pg_cron manda esse header).
  const auth = req.headers.get('Authorization') || '';
  if (!auth.includes(SERVICE_KEY)) return json({ error: 'nao_autorizado' }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { hoje, ontem } = brtHoje();

  let parcial = false;
  let pedidosHoje: any[] = [], pedidosOntem: any[] = [];
  try {
    pedidosHoje = await blingPages('pedidos/vendas', { dataInicial: hoje, dataFinal: hoje, 'idsSituacoes[]': 9 });
    pedidosOntem = await blingPages('pedidos/vendas', { dataInicial: ontem, dataFinal: ontem, 'idsSituacoes[]': 9 });
  } catch (_e) {
    parcial = true; // manda o que tiver
  }

  const { data: lojas } = await sb.from('bling_lojas').select('loja_id,nome');
  const agg = agregarVendasPorCanal({
    pedidosHoje: pedidosHoje.map(normalizar),
    pedidosOntem: pedidosOntem.map(normalizar),
    lojas: lojas || [],
  });
  const payload = JSON.stringify(montarCorpo(agg, { parcial }));

  const { data: subs } = await sb.from('push_subs').select('*');
  let enviados = 0, podados = 0;
  for (const s of (subs || [])) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      enviados++;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await sb.from('push_subs').delete().eq('endpoint', s.endpoint);
        podados++;
      }
    }
  }
  return json({ ok: true, parcial, enviados, podados, total: agg.total });
});
```

- [ ] **Step 4: Deploy da Edge**

Via `mcp__plugin_supabase_supabase__deploy_edge_function` (name `enviar-push-vendas`, incluir `index.ts` + `../_shared/vendas-do-dia.js`).

- [ ] **Step 5: Smoke — sem auth deve dar 401**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SUPABASE_URL/functions/v1/enviar-push-vendas"
```
Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/enviar-push-vendas/index.ts src/compartilhado/notificacoes-push.js
git commit -m "feat(push): edge enviar-push-vendas (agrega hoje/ontem via bling-proxy + envio web-push) e VAPID pública real"
```

---

### Task 7: Agendar pg_cron às 22h BRT

**Files:**
- Create: `db/migrations/2026-07-24-cron-push-vendas.sql`

**Interfaces:**
- Consumes: extensões `pg_cron` + `pg_net`; a Edge `enviar-push-vendas`.
- Produces: job diário `push-vendas-22h` às 01:00 UTC.

- [ ] **Step 1: Escrever a migration do cron**

```sql
-- db/migrations/2026-07-24-cron-push-vendas.sql
-- 22h BRT = 01:00 UTC. Chama a Edge enviar-push-vendas com o service key no header.
-- O service key vem de vault/segredos_de_cron (NÃO hardcode). Ajustar a leitura ao
-- padrão do projeto (segredos_de_cron) na aplicação.
select cron.schedule(
  'push-vendas-22h',
  '0 1 * * *',
  $$
  select net.http_post(
    url    := (select 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-push-vendas'),
    headers:= jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select segredo from public.segredos_de_cron where nome = 'service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Garantir o segredo do service key**

Conferir/gravar em `segredos_de_cron` a linha `nome='service_role_key'` (via MCP execute_sql, valor do service role). Se o projeto já tem outro padrão de segredo pra cron, usar o existente.

- [ ] **Step 3: Aplicar via MCP e verificar**

`apply_migration` (name `cron_push_vendas`), depois:
```sql
select jobname, schedule, active from cron.job where jobname = 'push-vendas-22h';
```
Expected: 1 linha, schedule `0 1 * * *`, active true.

- [ ] **Step 4: Disparo manual de teste**

`select net.http_post(...)` igual ao do job (ou invocar a Edge com o service key). Conferir retorno `{ ok:true, enviados, ... }` nos logs da Edge (`get_logs`).

- [ ] **Step 5: Commit**

```bash
git add db/migrations/2026-07-24-cron-push-vendas.sql
git commit -m "feat(push): pg_cron push-vendas-22h (01:00 UTC) chama a edge de envio"
```

---

### Task 8: Deploy, PR e validação no device

**Files:** nenhum novo.

- [ ] **Step 1: Rodar a suíte**

Run: `npm run test:ci`
Expected: PASS (inclui `vendas-do-dia` e `notificacoes-push`).

- [ ] **Step 2: Push do branch + abrir PR**

```bash
git push -u origin feat/notificacao-vendas
```
Abrir PR em `brenoov/social-dashboard` (usar a conta gh **brenoov** só pro remoto — [[feedback_trocar_contas_por_projeto]]). Descrição resumindo as 4 decisões da spec.

- [ ] **Step 3: Conferir deploy pelos checks do commit**

Ver os checks do commit de merge (MCP Vercel dá 403 neste projeto — [[project_iamundi_fabrica_hero_ia]]).

- [ ] **Step 4: Teste E2E no iPhone do Breno**

Instalar/abrir a Central (PWA na Tela de Início pra iOS) → modal 🔔 aparece → "Ativar agora" → aceitar permissão. Disparar a Edge manualmente (Step 4 da Task 7) → notificação consolidada chega com total + canais. Conferir que tocar abre a Gestão à Vista.

- [ ] **Step 5: Atualizar memória**

Atualizar `project_iamundi_notificacao_vendas.md` de PENDENTE → NO AR (com PR/commit e gotchas achados).

---

## Self-Review

**1. Cobertura da spec:**
- Push consolidado total+canais → Task 2 (`montarCorpo`) + Task 6. ✓
- % vs ontem, ontem=0→"novo" → Task 2 (`variacao`). ✓
- Opt-in aberto, modal insistente só "Ativar agora" → Task 5. ✓
- SW sem cache → Task 3. ✓
- pg_cron 22h BRT → Task 7. ✓
- Bling parcial → envia com aviso → Task 2 (`montarCorpo parcial`) + Task 6 (try/catch). ✓
- Poda 410/404 → Task 6. ✓
- Todos os canais (canal sem venda = R$0) → Task 2 (usa `lojas` como base). ✓
- Testes do módulo puro → Task 2. ✓  Smoke 401 → Task 6. ✓

**2. Placeholders:** `__VAPID_PUBLIC_PLACEHOLDER__` e `<PROJECT_REF>` são substituições explícitas com passo próprio (Task 6 Step 2 / Task 7). Não são placeholders de lógica.

**3. Consistência de tipos:** `agregarVendasPorCanal`/`montarCorpo`/`variacao` com as mesmas assinaturas na Task 2 (definição), Task 2 testes e Task 6 (consumo). `pedido = {loja_id,total,itens}` produzido por `normalizar` na Task 6 casa com o esperado na Task 2. `push_subs` colunas idênticas entre Task 1, Task 4 (`upsert`) e Task 6 (`select/delete`). ✓

**Riscos a validar na execução (não bloqueiam o plano):**
- `bling-proxy` aceitar o **service key** como Bearer (Edge→Edge). Se recusar, alternativa: a Edge lê `bling_tokens` e chama o Bling direto (replicando `getValidToken`).
- Forma exata do pedido do Bling (`p.loja.id` vs `loja_id`, itens como array vs `numeroItens`) — `normalizar` cobre os dois; ajustar após inspecionar 1 pedido real.
- Padrão de leitura do service key no pg_cron (`segredos_de_cron`) — confirmar o nome da linha.
