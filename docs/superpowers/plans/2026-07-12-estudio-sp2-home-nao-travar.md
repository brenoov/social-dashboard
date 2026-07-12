# Estúdio SP-2 — Home da Fábrica + não-travar + persistência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma Home da Fábrica com "campanhas em criação"; o disparo cria a rodada na hora, roda em background (não trava), cada rodada tem URL própria (retoma onde parou), e os criativos aparecem em streaming no Curar.

**Architecture:** A rodada (`fabrica_campanhas`) ganha `status` e é criada UP-FRONT pela Edge `fabrica-trigger` (não mais só no fim da geração). O runner marca `status` terminal. Rotas: `/fabrica-estudio` = Home; `/fabrica-estudio/nova` = Gerar; `/fabrica-estudio/:id` = Curar/Subir/Conferir. Uma Edge `fabrica-apagar` cancela+apaga. O Gerar deixa de fazer polling inline.

**Tech Stack:** Supabase (Postgres + Edge Deno + Storage), Node 20 (coletor/, `node:test`), Vue 3 + Vite + vue-router.

## Global Constraints

- **Repo/conta:** `brenoov/social-dashboard`, git/gh `brenoov`. Migrations via `cd coletor && node run-migrations.mjs`. Edge deploy via MCP Supabase. Nunca commitar segredo.
- **Estados da rodada** (`fabrica_campanhas.status`): `gerando` → `pronta` → (publicada = `fechada_em` setado, sai de "em criação") · `erro` · `cancelada`. "Em criação" = `status ∈ {gerando,pronta,erro}` AND `fechada_em IS NULL` AND `purgado_em IS NULL` AND `status <> 'cancelada'`.
- **Não-travar:** o painel Gerar NÃO faz polling inline; após o disparo, `router.push` pra `/fabrica-estudio/:id`.
- **RLS já permite** (migration 015): `authenticated` faz SELECT em `fabrica_campanhas`; quem tem `meta.fabrica` faz INSERT/UPDATE/DELETE (policy `fab_camp_write` FOR ALL). A Edge (`service_role`) faz tudo. `fabrica_criativos.campanha_id` tem `ON DELETE CASCADE`.
- **Auth de Edge caller-facing** (padrão `fabrica-trigger`): `getUser` + `role='admin' OR is_superadmin OR permissions ? 'meta.fabrica'`.
- **Estética:** Home reusa `estudio.css` (`.fest`, respeita tema claro do SP-1). Botão "← Central" (`router.push({name:'inicio'})`) e navegação Home↔campanha.
- **Nada de dado durável perdido:** publicadas (`fechada_em`) intactas; só rodadas em criação/canceladas somem.

---

## File Structure

**Criar:**
- `db/migrations/021_fabrica_campanhas_status.sql` — `status`/`job_id`/`criado_por` + backfill.
- `supabase/functions/fabrica-apagar/index.ts` — Edge: cancela run + apaga campanha/criativos/Storage.
- `src/ferramentas/meta-ads/tela-de-fabrica-home.vue` — a Home/panorama.

**Modificar:**
- `coletor/gerar-criativos.mjs` — `run()` aceita `campanhaId` (usa existente).
- `coletor/fabrica-job-runner.mjs` — ramo `gerar` marca `fabrica_campanhas.status` pronta/erro.
- `supabase/functions/fabrica-trigger/index.ts` — cria a campanha up-front no `gerar`.
- `src/mapa-de-enderecos.js` — Home + `/nova` + `/:id`.
- `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue` — adapta ao `route.params.id`.
- `src/ferramentas/meta-ads/painel-gerar.vue` — sem polling inline; handoff pra `/:id`.
- `src/ferramentas/meta-ads/painel-curar.vue` — streaming (polling enquanto `gerando`).

---

## Task 1: Migration 021 — status/job_id/criado_por na fabrica_campanhas

**Files:** Create: `db/migrations/021_fabrica_campanhas_status.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- 021_fabrica_campanhas_status.sql — SP-2: rodada vira "coisa" com status (criada no disparo).
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'gerando';
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users (id);
-- Rodadas antigas já terminaram de gerar há tempos: marca 'pronta' (as publicadas têm fechada_em e
-- ficam fora de "em criação" de qualquer forma). Novas nascem 'gerando' (default, setado no trigger).
UPDATE public.fabrica_campanhas SET status = 'pronta' WHERE status = 'gerando';
```

- [ ] **Step 2: Aplicar** — `cd /Users/erickmartins/iamundi/coletor && node run-migrations.mjs` → `021_... OK`.

- [ ] **Step 3: Verificar** (MCP execute_sql ou SQL): `select column_name from information_schema.columns where table_name='fabrica_campanhas' and column_name in ('status','job_id','criado_por');` → 3 linhas. E `select distinct status from public.fabrica_campanhas;` → só `pronta` (nas antigas).

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add db/migrations/021_fabrica_campanhas_status.sql
git commit -m "feat(fabrica): migration 021 — fabrica_campanhas +status/job_id/criado_por (SP-2)"
```

---

## Task 2: gerar-criativos usa campanhaId existente

**Files:** Modify: `coletor/gerar-criativos.mjs`

**Interfaces:**
- Produces: `run({..., campanhaId})` — quando `campanhaId` vem, gera na campanha existente (não cria `fabrica_campanhas`); sem, mantém o comportamento CLI (cria). Retorno `{ campanhaId, criativos }` inalterado.

- [ ] **Step 1: Adicionar `campanhaId` à assinatura**

Em `coletor/gerar-criativos.mjs` `run()` (~L93-96), adicionar `campanhaId = null` à desestruturação de `opts` (junto de `itens = null`).

- [ ] **Step 2: Criação condicional da campanha**

Trocar o bloco (~L158-164):
```js
// campanha
let campanhaId = null;
if (!DRY) {
  const c = await sbPost('/fabrica_campanhas', [{ nome: NOME, desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS }], 'return=representation');
  campanhaId = (await c.json())[0].id;
  await garantirBucket();
}
```
por (usa `campanhaId` recebido quando presente; o `let` some, pois agora é o parâmetro):
```js
// campanha: quando o trigger já criou a rodada (SP-2), usa ela; senão cria (CLI legado).
if (!DRY) {
  if (!campanhaId) {
    const c = await sbPost('/fabrica_campanhas', [{ nome: NOME, desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS }], 'return=representation');
    campanhaId = (await c.json())[0].id;
  }
  await garantirBucket();
}
```

- [ ] **Step 3: Sanidade** — `cd coletor && node --test gerar-criativos-itens.test.mjs gerar-criativos.test.mjs` → passam; `node --import ./lib/curl-fetch.mjs gerar-criativos.mjs --dry --limite 0` roda (dry não cria campanha).

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs
git commit -m "feat(fabrica): gerar-criativos aceita campanhaId (usa a rodada criada no disparo)"
```

---

## Task 3: runner marca status da campanha (gerar)

**Files:** Modify: `coletor/fabrica-job-runner.mjs`
- Test: `coletor/fabrica-job-runner.test.mjs` (já existe)

**Interfaces:**
- Consumes: `sbPatch` (já no arquivo), `job.params.campanhaId`.
- Produces: no `tipo='gerar'`, ao concluir → `fabrica_campanhas.status='pronta'`; no `catch` (gerar) → `status='erro'`. Pura: `export function statusCampanhaGerar(ok)` → `ok ? 'pronta' : 'erro'`.

- [ ] **Step 1: Teste da função pura**

Em `coletor/fabrica-job-runner.test.mjs`, adicionar:
```js
import { statusCampanhaGerar } from './fabrica-job-runner.mjs';
test('statusCampanhaGerar: sucesso->pronta, falha->erro', () => {
  assert.equal(statusCampanhaGerar(true), 'pronta');
  assert.equal(statusCampanhaGerar(false), 'erro');
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd coletor && node --test fabrica-job-runner.test.mjs` → FAIL (sem export).

- [ ] **Step 3: Implementar**

Em `coletor/fabrica-job-runner.mjs`, adicionar a função pura (perto de `estadoTerminalSubir`):
```js
export function statusCampanhaGerar(ok) { return ok ? 'pronta' : 'erro'; }
```
No ramo `gerar` (após o `sbPatch` do job concluído, ~L70):
```js
if (job.tipo === 'gerar') {
  const r = await gerarRun(job.params || {});
  await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'concluido', resultado: r, updated_at: new Date().toISOString() });
  if (job.params?.campanhaId) await sbPatch(`/fabrica_campanhas?id=eq.${job.params.campanhaId}`, { status: statusCampanhaGerar(true) });
}
```
No `catch` (~L85-87), após marcar o job `erro`, marcar a campanha só quando for gerar:
```js
} catch (e) {
  await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'erro', erro: String(e.message).slice(0, 500), updated_at: new Date().toISOString() });
  if (job?.tipo === 'gerar' && job?.params?.campanhaId) await sbPatch(`/fabrica_campanhas?id=eq.${job.params.campanhaId}`, { status: statusCampanhaGerar(false) });
  throw e;
}
```

- [ ] **Step 4: Rodar e ver passar** — `cd coletor && node --test fabrica-job-runner.test.mjs` → PASS.

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/fabrica-job-runner.mjs coletor/fabrica-job-runner.test.mjs
git commit -m "feat(fabrica): runner marca fabrica_campanhas.status pronta/erro no gerar"
```

---

## Task 4: fabrica-trigger cria a campanha up-front (gerar)

**Files:** Modify: `supabase/functions/fabrica-trigger/index.ts`

**Interfaces:**
- Produces: `POST {tipo:'gerar', params:{itens, nome?}}` → cria `fabrica_campanhas` (status `gerando`, `criado_por`, `nome`), injeta `params.campanhaId`, cria o job, seta `fabrica_campanhas.job_id`, dispara Actions, retorna `{ job_id, campanha_id }`. `tipo='subir'/'ativar'` inalterados.

- [ ] **Step 1: Implementar (padrão service-role já existente no arquivo)**

No `supabase/functions/fabrica-trigger/index.ts`, entre a validação do `tipo` e o insert do job, inserir:
```ts
// SP-2: no 'gerar', a rodada é criada AGORA (aparece na Home 'em criação' na hora).
let campanhaId = (params && params.campanhaId) || null;
if (tipo === "gerar" && !campanhaId) {
  const nome = (params && params.nome) || ("Rodada · " + new Date().toISOString().slice(0, 16).replace("T", " "));
  const { data: camp, error: ec } = await sb.from("fabrica_campanhas")
    .insert({ nome, status: "gerando", criado_por: ud.user.id }).select("id").single();
  if (ec) return json({ error: "campanha_insert_falhou", detail: ec.message }, 500);
  campanhaId = camp.id;
  params.campanhaId = campanhaId;   // vai pro job.params → gerar-criativos usa
}
```
No insert do job já existente, `params` agora carrega `campanhaId`. Após o insert do job (antes do dispatch), ligar a campanha ao job:
```ts
if (tipo === "gerar" && campanhaId) await sb.from("fabrica_campanhas").update({ job_id: job.id }).eq("id", campanhaId);
```
No caminho de dispatch-falho (`!gh.ok`), além de marcar o job `erro`, marcar a campanha:
```ts
if (campanhaId) await sb.from("fabrica_campanhas").update({ status: "erro" }).eq("id", campanhaId);
```
E o retorno de sucesso passa a incluir a campanha:
```ts
return json({ job_id: job.id, campanha_id: campanhaId });
```

- [ ] **Step 2: (Deploy é checkpoint do controller)** — o arquivo é escrito e commitado; o controller faz o `deploy_edge_function` (verify_jwt=true) via MCP no checkpoint. Não deployar aqui.

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-trigger/index.ts
git commit -m "feat(fabrica): fabrica-trigger cria a rodada up-front no gerar (status gerando + job_id + campanhaId)"
```

---

## Task 5: Edge fabrica-apagar (cancela + apaga)

**Files:** Create: `supabase/functions/fabrica-apagar/index.ts`

**Interfaces:**
- Produces: `POST {campanhaId}` → cancela o Actions run (best-effort, se `gerando`) + apaga Storage dos criativos + apaga a campanha (cascade). Gate `meta.fabrica`. Idempotente. `{ ok:true }`.

- [ ] **Step 1: Implementar**

Create `supabase/functions/fabrica-apagar/index.ts`:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ud } = await uc.auth.getUser();
    if (!ud?.user) return json({ error: "nao_autenticado" }, 401);
    const { data: prof } = await sb.from("profiles").select("role, permissions, is_superadmin").eq("id", ud.user.id).single();
    if (!(prof && (prof.role === "admin" || prof.is_superadmin === true || (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, "meta.fabrica"))))) return json({ error: "sem_permissao" }, 403);

    const { campanhaId } = await req.json();
    if (!campanhaId) return json({ error: "campanhaId_obrigatorio" }, 400);
    const { data: camp } = await sb.from("fabrica_campanhas").select("id, job_id, status").eq("id", campanhaId).single();
    if (!camp) return json({ ok: true }); // idempotente

    // best-effort: cancela o Actions run se ainda gerando
    if (camp.status === "gerando" && camp.job_id) {
      const { data: job } = await sb.from("fabrica_jobs").select("github_run_id").eq("id", camp.job_id).single();
      const runId = job?.github_run_id;
      if (runId) {
        try {
          await fetch(`https://api.github.com/repos/${Deno.env.get("GITHUB_REPO")}/actions/runs/${runId}/cancel`, {
            method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("GITHUB_PAT_FABRICA")}`, Accept: "application/vnd.github+json", "User-Agent": "fabrica-apagar" },
          });
        } catch (_) { /* best-effort */ }
      }
    }
    // apaga Storage dos criativos
    const { data: crs } = await sb.from("fabrica_criativos").select("storage_path").eq("campanha_id", campanhaId);
    const paths = (crs || []).map((c) => c.storage_path).filter(Boolean);
    if (paths.length) await sb.storage.from("fabrica-criativos").remove(paths);
    // apaga a campanha (ON DELETE CASCADE remove os criativos)
    const { error: ed } = await sb.from("fabrica_campanhas").delete().eq("id", campanhaId);
    if (ed) return json({ error: "delete_falhou", detail: ed.message }, 500);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
```

- [ ] **Step 2: (Deploy é checkpoint)** — escrever e commitar; o controller deploya `fabrica-apagar` (verify_jwt=true) via MCP + smoke. Não deployar aqui.

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-apagar/index.ts
git commit -m "feat(fabrica): Edge fabrica-apagar (cancela Actions run + apaga campanha/criativos/Storage)"
```

---

## Task 6: Rotas + tela adapta ao :id + Gerar sem polling

**Files:**
- Modify: `src/mapa-de-enderecos.js`, `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue`, `src/ferramentas/meta-ads/painel-gerar.vue`

**Interfaces:**
- Consumes: `fabrica-trigger` retornando `{ campanha_id }` (Task 4).
- Produces: `/fabrica-estudio` (Home, Task 7), `/fabrica-estudio/nova` (Gerar), `/fabrica-estudio/:id` (Curar/Subir/Conferir). `painel-gerar` emite `gerado(campanhaId)` logo após o disparo (sem esperar a geração).

- [ ] **Step 1: Rotas**

Em `src/mapa-de-enderecos.js`, substituir a linha da rota `fabrica-estudio` por (ordem importa: `/nova` antes de `/:id`):
```js
{ path: '/fabrica-estudio', name: 'fabrica-estudio', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-home.vue') },
{ path: '/fabrica-estudio/nova', name: 'fabrica-nova', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-estudio.vue') },
{ path: '/fabrica-estudio/:id', name: 'fabrica-campanha', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-estudio.vue'), props: true },
```
(O card do menu `tela-de-menu-meta-ads.vue` usa `ir('fabrica-estudio')` → agora cai na Home. Sem mudança lá.)

- [ ] **Step 2: painel-gerar — sem polling inline, handoff imediato**

Em `src/ferramentas/meta-ads/painel-gerar.vue`: remover o `useJobStatus` e o `watch(job, ...)` (o status agora vive na Home/campanha). Trocar `gerar()` para emitir a campanha logo após o disparo:
```js
async function gerar() {
  const itens = itensEscolhidos()
  if (!itens.length) return alert('Marque ao menos um produto (com estoque numa loja selecionada) antes de gerar.')
  const nome = 'Rodada · ' + FONTES.find(f => f.v === sel.fonte)?.l + ' · ' + new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'gerar', params: { itens, nome } } })
  if (error) return alert('Falha ao disparar: ' + error.message)
  if (!data?.campanha_id) return alert('Sem campanha na resposta')
  emit('gerado', data.campanha_id)
}
```
Remover o bloco `<div v-if="job" class="jobstat">…</div>` do template (o status saiu do Gerar). Manter o resto (lojas/fonte/filtros/lista/curadoria/desconto).

- [ ] **Step 3: tela-de-fabrica-estudio.vue — adapta ao route.params.id**

Trocar o `<script setup>` (topo) para ler a rota:
```js
import { useRoute, useRouter } from 'vue-router'
const route = useRoute(); const router = useRouter()
const campanhaId = ref(route.params.id || null)
const passo = ref(campanhaId.value ? 'curar' : 'gerar')
const subirResultado = ref(null)
// nova campanha: ao disparar, navega pra /:id (a tela recarrega já como campanha, no Curar)
function aoGerar(id) { router.push({ name: 'fabrica-campanha', params: { id } }) }
function aoSubir(res) { subirResultado.value = res; passo.value = 'conferir' }
function voltarHome() { router.push({ name: 'fabrica-estudio' }) }
```
No `<template>`: adicionar um botão "← Fábrica" (chama `voltarHome`) no topbar (perto do "← Central"). O trilho e os painéis (`v-if` por `passo`) seguem; em `/nova` só o passo `gerar` está ativo, em `/:id` os passos `curar/subir/conferir`. Os `:disabled` do trilho podem checar `campanhaId`/`subirResultado` como hoje.

- [ ] **Step 4: Build + smoke** — `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo. (Smoke completo depende do deploy — no checkpoint.)

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/mapa-de-enderecos.js src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue src/ferramentas/meta-ads/painel-gerar.vue
git commit -m "feat(fabrica): rotas Home/nova/:id + Gerar sem polling (handoff pra /:id)"
```

---

## Task 7: Home (tela-de-fabrica-home.vue)

**Files:** Create: `src/ferramentas/meta-ads/tela-de-fabrica-home.vue`

**Interfaces:**
- Consumes: `sb()` (listas/contagens), `sbClient.functions.invoke('fabrica-apagar')`, rotas `fabrica-nova`/`fabrica-campanha`.
- Produces: a Home — números + em criação (status ao vivo, abrir/apagar) + publicadas + atalho templates.

- [ ] **Step 1: Implementar a Home**

Create `src/ferramentas/meta-ads/tela-de-fabrica-home.vue` (usa `.fest`; o implementer expande o markup seguindo o padrão dos painéis):
```vue
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import './estudio.css'
const router = useRouter()
const emCriacao = ref([])       // fabrica_campanhas em criação (com contagem de criativos)
const publicadas = ref([])
const nums = ref({ criando: 0, criativos: 0, publicadas: 0 })
let timer = null

async function carregar() {
  if (!hasPermission('module:meta:fabrica')) { router.push({ name: 'meta-ads' }); return }
  // em criação
  const camp = await sb("fabrica_campanhas?select=id,nome,status,created_at&fechada_em=is.null&purgado_em=is.null&status=in.(gerando,pronta,erro)&order=created_at.desc")
  // contagem de criativos por campanha (uma consulta por campanha; volume pequeno)
  for (const c of camp) {
    const { count } = await sbClient.from('fabrica_criativos').select('id', { count: 'exact', head: true }).eq('campanha_id', c.id)
    c.qtd = count || 0
  }
  emCriacao.value = camp
  publicadas.value = await sb("fabrica_campanhas?select=id,nome,fechada_em&fechada_em=not.is.null&order=fechada_em.desc&limit=8")
  const { count: totCri } = await sbClient.from('fabrica_criativos').select('id', { count: 'exact', head: true })
  nums.value = { criando: camp.length, criativos: totCri || 0, publicadas: publicadas.value.length }
}
const temGerando = computed(() => emCriacao.value.some((c) => c.status === 'gerando'))
function statusLabel(c) { return c.status === 'gerando' ? `Gerando… ${c.qtd} criativos` : c.status === 'pronta' ? 'Pronta pra curar' : 'Deu erro ao gerar' }
function abrir(c) { router.push({ name: 'fabrica-campanha', params: { id: c.id } }) }
function nova() { router.push({ name: 'fabrica-nova' }) }
function voltarCentral() { router.push({ name: 'inicio' }) }
const GERENCIADOR = 'https://adsmanager.facebook.com/adsmanager/'
async function apagar(c) {
  if (!confirm(`Apagar a campanha "${c.nome}"? ${c.status === 'gerando' ? 'A geração em andamento será cancelada. ' : ''}Isso remove os criativos e não dá pra desfazer.`)) return
  const { error } = await sbClient.functions.invoke('fabrica-apagar', { body: { campanhaId: c.id } })
  if (error) return alert('Falha ao apagar: ' + error.message)
  carregar()
}
onMounted(() => { carregar(); timer = setInterval(() => { if (temGerando.value) carregar() }, 4000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <div class="fest">
    <div class="shell">
      <header class="topbar">
        <button class="voltar-central" @click="voltarCentral" aria-label="Voltar para a Central">← Central</button>
        <div class="brand"><div class="t">Fábrica de Anúncios</div><div class="s">Painel</div></div>
        <div class="divider"></div>
        <button class="cmd amber" @click="nova"><span class="ci">▶</span> Nova campanha</button>
      </header>

      <!-- números -->
      <div class="readout">
        <div class="c"><div class="k">Em criação</div><div class="v mono">{{ nums.criando }}</div></div>
        <div class="c"><div class="k">Criativos gerados</div><div class="v mono">{{ nums.criativos }}</div></div>
        <div class="c"><div class="k">Publicadas</div><div class="v mono">{{ nums.publicadas }}</div></div>
      </div>

      <!-- em criação -->
      <div class="panel">
        <div class="ph"><span class="eyebrow">Campanhas em criação</span></div>
        <div v-if="emCriacao.length" class="home-list">
          <div v-for="c in emCriacao" :key="c.id" class="home-card" :class="c.status">
            <div class="hc-main">
              <div class="hc-nome">{{ c.nome }}</div>
              <div class="hc-status"><i class="led" :class="c.status==='pronta' ? 'go' : c.status==='erro' ? 'abort' : 'run'"></i>{{ statusLabel(c) }}</div>
            </div>
            <div class="hc-acoes">
              <button class="cmd cyan" @click="abrir(c)">Abrir</button>
              <button class="hc-apagar" @click="apagar(c)" aria-label="Apagar">🗑</button>
            </div>
          </div>
        </div>
        <p v-else class="empty">Nenhuma campanha em criação. Clique "Nova campanha" pra começar.</p>
      </div>

      <!-- publicadas -->
      <div class="panel">
        <div class="ph"><span class="eyebrow">Publicadas recentes</span></div>
        <div v-if="publicadas.length" class="home-list">
          <div v-for="c in publicadas" :key="c.id" class="home-card">
            <div class="hc-main"><div class="hc-nome">{{ c.nome }}</div></div>
            <a class="cmd" :href="GERENCIADOR" target="_blank">Ver no Gerenciador ↗</a>
          </div>
        </div>
        <p v-else class="empty">Nada publicado ainda.</p>
      </div>

      <!-- atalho templates (SP-5) -->
      <div class="panel home-soon">
        <div class="ph"><span class="eyebrow">Looks & Templates</span><span class="eyebrow muted">em breve</span></div>
        <p class="empty">Gerenciar e criar novos looks/templates chega no próximo passo da fábrica.</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: CSS da Home**

Em `src/ferramentas/meta-ads/estudio.css`, adicionar (no `.fest`):
```css
.fest .home-list{display:flex; flex-direction:column; gap:8px}
.fest .home-card{display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  border:1px solid var(--edge); border-radius:var(--r); background:var(--panel-2); padding:12px 14px}
.fest .home-card.erro{border-color:#5a231c}
.fest .hc-nome{font-weight:600}
.fest .hc-status{display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--ink-dim); margin-top:3px}
.fest .hc-acoes{display:flex; align-items:center; gap:8px}
.fest .hc-apagar{appearance:none; cursor:pointer; background:var(--panel); border:1px solid var(--edge); border-radius:6px;
  color:var(--ink-dim); font-size:14px; padding:6px 9px}
.fest .hc-apagar:hover{border-color:var(--abort); color:var(--abort)}
.fest .home-soon{opacity:.7}
```

- [ ] **Step 3: Build** — `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tela-de-fabrica-home.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): Home da Fábrica (números + em criação + publicadas + atalho templates)"
```

---

## Task 8: Streaming no Curar

**Files:** Modify: `src/ferramentas/meta-ads/painel-curar.vue`

**Interfaces:**
- Consumes: `props.campanhaId`. Enquanto a campanha está `gerando`, faz polling de `fabrica_criativos` e mostra "ainda gerando"; para quando `pronta`/`erro`.

- [ ] **Step 1: Adicionar status da campanha + polling**

Em `src/ferramentas/meta-ads/painel-curar.vue` `<script setup>`, adicionar (o painel já tem `carregar()`, `itens`, `onMounted/onUnmounted` da Task 3 do SP-1):
```js
const statusCampanha = ref(null)
let poll = null
async function lerStatus() {
  if (!props.campanhaId) return
  const r = await sb(`fabrica_campanhas?select=status&id=eq.${props.campanhaId}`)
  statusCampanha.value = r[0]?.status || null
  if (statusCampanha.value !== 'gerando' && poll) { clearInterval(poll); poll = null }
}
async function tickStreaming() { await carregar(); await lerStatus() }
```
No `watch(() => props.campanhaId, ...)` existente (ou no `onMounted`), após o `carregar()` inicial, iniciar o polling se estiver gerando:
```js
async function iniciar() {
  await carregar(); await lerStatus()
  if (statusCampanha.value === 'gerando' && !poll) poll = setInterval(tickStreaming, 4000)
}
```
Trocar o `watch(() => props.campanhaId, carregar, { immediate: true })` por `watch(() => props.campanhaId, iniciar, { immediate: true })`, e no `onUnmounted` (já existe do SP-1) também `if (poll) clearInterval(poll)`.

- [ ] **Step 2: Aviso "ainda gerando" no template**

No `<template>`, dentro do painel de Criativos (após o `.ph`), adicionar:
```html
<p v-if="statusCampanha === 'gerando'" class="js-run"><i class="led run"></i> Ainda gerando… os criativos vão aparecendo aqui. Pode ir marcando os que gostar.</p>
<p v-else-if="statusCampanha === 'erro'" class="js-err">A geração falhou. Volte à Fábrica e tente uma nova campanha.</p>
```
CSS (estudio.css, `.fest`):
```css
.fest .js-run{display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--cyan); margin:2px 0 8px}
```

- [ ] **Step 3: Build** — `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 4: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-curar.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): streaming no Curar — criativos aparecem enquanto a campanha gera"
```

---

## Checkpoints do mundo real (controller + Breno)

Após as 8 tasks (ou intercalado): **aplicar a migration 021** (Task 1 já aplica via runner), **deployar via MCP** a `fabrica-trigger` (atualizada, verify_jwt=true) e a nova `fabrica-apagar` (verify_jwt=true), **push** da main, e **smoke ao vivo**: disparar uma nova campanha (não trava, vai pra /:id), ver na Home "em criação" com status ao vivo, streaming no Curar, apagar remove.

## Testes (resumo)

- **node:test:** `statusCampanhaGerar` (runner); os testes existentes de gerar/subir/ativar seguem verdes.
- **Edge:** `fabrica-apagar` smoke (gate 401/403; apaga campanha+criativos+Storage; inexistente→ok); `fabrica-trigger` gerar cria campanha up-front.
- **Front:** `vite build` por task + smoke do fluxo (não-trava, Home, streaming, apagar).
- **DB:** migration 021 (colunas + backfill status).

## Sequência

1 (migration) → 2 (gerar campanhaId) → 3 (runner status) → 4 (trigger up-front) → 5 (Edge apagar) → 6 (rotas+tela+gerar handoff) → 7 (Home) → 8 (streaming). Backend 1-5, front 6-8. Deploys/migration/push no checkpoint.
