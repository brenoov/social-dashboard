# Estúdio SP-4 — Localização + Público · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar controle de targeting por campanha no passo Subir — localização (cidades/raio/exclusões/idade/gênero), interesses e públicos salvos (engajamento/lookalike) — com presets reutilizáveis, sem tocar nos criativos.

**Architecture:** Abordagem A: o front fala com o meta-proxy (busca/cria audiences e interesses); um helper puro `montarTargeting(publico, loja)` constrói o `adset.targeting`; presets em `fabrica_publicos` (escrita via Edge gated `fabrica-publicos`, leitura direta por RLS). O objetivo do SP-3 continua ditando objective/otimização/destino; o público define o targeting. Faseado A→B no mesmo SP.

**Tech Stack:** Supabase Postgres (migration + RLS), Edge Functions (Deno), Node ESM coletor (`.mjs`, `node:test`), Vue 3 `<script setup>` + Vite, Meta Marketing API via meta-proxy.

## Global Constraints

- Tudo que sobe ao Meta vai **PAUSED**; o SP-4 é targeting, não ativa nada (ativação segue no job `ativar`, intocado).
- `montarTargeting` **nunca deixa o conjunto sem geo** — sem cidades no público, cai pras cidades da loja (evita público mundial acidental).
- Escrita de preset só via Edge gated (`meta.fabrica`); leitura de `fabrica_publicos` é `authenticated` por RLS.
- Nada de PII em claro (a lista de clientes CSV está fora de escopo).
- Migrations da Fábrica: arquivos `db/migrations/NNN_*.sql`, numeração segue de 022 → **023**.
- Coletor: ESM, testes `node --test` na pasta `coletor/`.
- Objetivo (SP-3) e público (SP-4) são ortogonais: objetivo=campaign/optimization/destination; público=adset.targeting.

---

## FASE A — espinha (geo + idade/gênero + interesses + amplo + presets)

### Task 1: Migration 023 — tabela `fabrica_publicos` + RLS

**Files:**
- Create: `db/migrations/023_fabrica_publicos.sql`

**Interfaces:**
- Produces: `fabrica_publicos(id uuid pk, nome, marca_id uuid null, geo jsonb, idade_min, idade_max, generos int[], interesses jsonb, custom_audiences jsonb, ativo, criado_por, created_at)`; RLS select=authenticated, sem write p/ authenticated.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/023_fabrica_publicos.sql`:
```sql
-- SP-4: presets de público (targeting reutilizável). Escrita via Edge fabrica-publicos (service-role).
create table if not exists fabrica_publicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  marca_id uuid references fabrica_marcas(id) on delete set null,
  geo jsonb not null default '{}'::jsonb,           -- { cities:[{key,radius,distance_unit}], excluded:[{key,type}] }
  idade_min int not null default 18,
  idade_max int not null default 65,
  generos int[] not null default '{}',              -- 1=masc, 2=fem; vazio = todos
  interesses jsonb not null default '[]'::jsonb,     -- [{id,name}]
  custom_audiences jsonb not null default '[]'::jsonb, -- [{id,name,subtype}] (Fase B)
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now()
);

alter table fabrica_publicos enable row level security;

drop policy if exists fab_pub_read on fabrica_publicos;
create policy fab_pub_read on fabrica_publicos for select to authenticated using (true);
-- escrita só service_role (sem policy de write p/ authenticated => negado)
```

- [ ] **Step 2: Aplicar (checkpoint do controller)** — não aplicar no subagente. Verificar depois: `select id, nome, idade_min, idade_max from fabrica_publicos;` (tabela vazia, sem erro) e `\d fabrica_publicos`.

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add db/migrations/023_fabrica_publicos.sql
git commit -m "feat(fabrica): migration 023 — tabela fabrica_publicos (presets de targeting) (SP-4)"
```

---

### Task 2: `coletor/lib/publico.mjs` — `montarTargeting(publico, loja)` (puro + testes)

**Files:**
- Create: `coletor/lib/publico.mjs`
- Create: `coletor/lib/publico.test.mjs`

**Interfaces:**
- Produces: `montarTargeting(publico, loja) -> targetingObject`. `publico` = objeto no shape das colunas de `fabrica_publicos` (`geo/idade_min/idade_max/generos/interesses/custom_audiences`) OU `null` (amplo). `loja` tem `geoCities: string[]`.

- [ ] **Step 1: Escrever os testes (falhando)**

Create `coletor/lib/publico.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTargeting } from './publico.mjs';

const LOJA = { geoCities: ['1058', '2777'] };

test('sem publico = amplo: só as cidades da loja', () => {
  assert.deepEqual(montarTargeting(null, LOJA), { geo_locations: { cities: [{ key: '1058' }, { key: '2777' }] } });
});

test('cidades com raio + unidade', () => {
  const t = montarTargeting({ geo: { cities: [{ key: '1058', radius: 15, distance_unit: 'kilometer' }] } }, LOJA);
  assert.deepEqual(t.geo_locations.cities, [{ key: '1058', radius: 15, distance_unit: 'kilometer' }]);
});

test('geo.cities vazio cai pras cidades da loja', () => {
  const t = montarTargeting({ geo: { cities: [] }, generos: [] }, LOJA);
  assert.deepEqual(t.geo_locations.cities, [{ key: '1058' }, { key: '2777' }]);
});

test('excluidas agrupadas por tipo', () => {
  const t = montarTargeting({ geo: { cities: [{ key: '1058' }], excluded: [{ key: '9', type: 'city' }, { key: 'R', type: 'region' }] } }, LOJA);
  assert.deepEqual(t.excluded_geo_locations, { cities: [{ key: '9' }], regions: [{ key: 'R' }] });
});

test('idade/genero: genders só quando houver', () => {
  const t = montarTargeting({ idade_min: 25, idade_max: 45, generos: [2] }, LOJA);
  assert.equal(t.age_min, 25); assert.equal(t.age_max, 45); assert.deepEqual(t.genders, [2]);
  const t2 = montarTargeting({ generos: [] }, LOJA);
  assert.ok(!('genders' in t2));
});

test('interesses viram flexible_spec; custom_audiences só quando houver', () => {
  const t = montarTargeting({ interesses: [{ id: '6003', name: 'Moda' }], custom_audiences: [{ id: 'A1' }] }, LOJA);
  assert.deepEqual(t.flexible_spec, [{ interests: [{ id: '6003', name: 'Moda' }] }]);
  assert.deepEqual(t.custom_audiences, [{ id: 'A1' }]);
  const t2 = montarTargeting({ interesses: [] }, LOJA);
  assert.ok(!('flexible_spec' in t2)); assert.ok(!('custom_audiences' in t2));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/publico.test.mjs`
Expected: FAIL (`Cannot find module './publico.mjs'`).

- [ ] **Step 3: Implementar `lib/publico.mjs`**

Create `coletor/lib/publico.mjs`:
```js
// SP-4: monta o adset.targeting a partir de um `publico` (preset ou config inline) + a loja.
// Nunca deixa sem geo: sem cidades no publico, usa as cidades da loja (evita público mundial).
export function montarTargeting(publico, loja) {
  const cidadesLoja = (loja?.geoCities || []).map((key) => ({ key }));
  if (!publico) return { geo_locations: { cities: cidadesLoja } };

  const t = {};
  const cities = (publico.geo?.cities || []).map((c) => {
    const o = { key: c.key };
    if (c.radius) { o.radius = c.radius; o.distance_unit = c.distance_unit || 'kilometer'; }
    return o;
  });
  t.geo_locations = { cities: cities.length ? cities : cidadesLoja };

  const excl = publico.geo?.excluded || [];
  if (excl.length) {
    const ex = {};
    for (const e of excl) {
      const bucket = e.type === 'region' ? 'regions' : 'cities';
      (ex[bucket] ||= []).push({ key: e.key });
    }
    t.excluded_geo_locations = ex;
  }

  if (publico.idade_min != null) t.age_min = publico.idade_min;
  if (publico.idade_max != null) t.age_max = publico.idade_max;
  if (publico.generos?.length) t.genders = publico.generos;
  if (publico.interesses?.length) t.flexible_spec = [{ interests: publico.interesses.map((i) => ({ id: i.id, name: i.name })) }];
  if (publico.custom_audiences?.length) t.custom_audiences = publico.custom_audiences.map((a) => ({ id: a.id }));
  return t;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/publico.test.mjs`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/publico.mjs coletor/lib/publico.test.mjs
git commit -m "feat(fabrica): lib/publico — montarTargeting(publico, loja) puro (SP-4)"
```

---

### Task 3: `subir-estudio` aplica o público no targeting

**Files:**
- Modify: `coletor/subir-estudio.mjs`
- Modify: `coletor/subir-estudio.test.mjs`

**Interfaces:**
- Consumes: `montarTargeting` (Task 2).
- Produces: `payloadCampanhaAdset(row, marca, loja, cfg, publico=null)` — `adset.targeting = montarTargeting(publico, loja)`. `criarCampanhaNova(loja, objetivoRow, publico=null)`. `run()` lê `destino.publico` e repassa.

- [ ] **Step 1: Escrever o teste (falhando)**

Em `coletor/subir-estudio.test.mjs`, adicionar:
```js
test('payloadCampanhaAdset aplica o publico no targeting (cidades+raio+interesses)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const marca = { adAccount: 'act_1', pageId: 'P', igId: 'IG' };
  const loja = { nome: 'Tivoli', whatsapp: '55', geoCities: ['1058'] };
  const publico = { geo: { cities: [{ key: '1058', radius: 15, distance_unit: 'kilometer' }] }, interesses: [{ id: '6003', name: 'Moda' }], generos: [2], idade_min: 25, idade_max: 45 };
  const { adset } = payloadCampanhaAdset(row, marca, loja, { DAILY_BUDGET: 5000, DATA: 'X' }, publico);
  assert.deepEqual(adset.targeting.geo_locations.cities, [{ key: '1058', radius: 15, distance_unit: 'kilometer' }]);
  assert.deepEqual(adset.targeting.flexible_spec, [{ interests: [{ id: '6003', name: 'Moda' }] }]);
  assert.equal(adset.targeting.age_min, 25);
});

test('payloadCampanhaAdset sem publico mantém geo da loja (retrocompat)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { adset } = payloadCampanhaAdset(row, { adAccount: 'act_1', pageId: 'P' }, { nome: 'T', whatsapp: '55', geoCities: ['1058'] }, { DAILY_BUDGET: 5000, DATA: 'X' });
  assert.deepEqual(adset.targeting, { geo_locations: { cities: [{ key: '1058' }] } });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs`
Expected: FAIL (o targeting atual ignora `publico`; o 1º teste falha nos campos novos).

- [ ] **Step 3: Implementar**

Em `coletor/subir-estudio.mjs`:
1. Importar no topo (junto dos outros imports de lib): `import { montarTargeting } from './lib/publico.mjs';`
2. `payloadCampanhaAdset` recebe `publico`:
```js
export function payloadCampanhaAdset(row, marca, loja, cfg, publico = null) {
  const campaign = {
    name: `[Estudio] ${loja.nome} · ${row.chave} · ${cfg.DATA}`,
    objective: row.meta_objective,
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  };
  const adset = {
    name: 'Estudio · Geral',
    daily_budget: cfg.DAILY_BUDGET,
    billing_event: row.billing_event || 'IMPRESSIONS',
    optimization_goal: row.optimization_goal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    targeting: montarTargeting(publico, loja),
  };
  if (row.destination_type) adset.destination_type = row.destination_type;
  const po = montaPromotedObject(row.promoted_object_tipo, marca, loja);
  if (po) adset.promoted_object = po;
  return { campaign, adset };
}
```
3. `criarCampanhaNova(loja, objetivoRow, publico = null)` — passar `publico` pro `payloadCampanhaAdset(objetivoRow, MARCA, loja, {...}, publico)`.
4. No `run()`, no ramo `destino?.tipo === 'nova'`, extrair o público e repassar:
```js
const publico = destino.publico || null;
({ campaignId: metaCampaignId, adsets } = await criarCampanhaNova(lojaNova, objetivoRow, publico));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs && node --test`
Expected: PASS (novos + suíte inteira verde).

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/subir-estudio.mjs coletor/subir-estudio.test.mjs
git commit -m "feat(fabrica): subir aplica o publico no adset.targeting via montarTargeting (SP-4)"
```

---

### Task 4: Edge `fabrica-publicos` — salvar/apagar preset (gated)

**Files:**
- Create: `supabase/functions/fabrica-publicos/index.ts`

**Interfaces:**
- Produces: `POST { acao:'salvar', preset:{...} }` → upsert em `fabrica_publicos`, retorna `{ id }`; `POST { acao:'apagar', id }` → delete idempotente. Gate `meta.fabrica`. Não toca no Meta.

- [ ] **Step 1: Implementar**

Create `supabase/functions/fabrica-publicos/index.ts`:
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

    const body = await req.json();
    const acao = body.acao;
    if (acao === "apagar") {
      if (!body.id) return json({ error: "id_obrigatorio" }, 400);
      const { error } = await sb.from("fabrica_publicos").delete().eq("id", body.id);
      if (error) return json({ error: "delete_falhou", detail: error.message }, 500);
      return json({ ok: true });
    }
    if (acao === "salvar") {
      const p = body.preset || {};
      if (!p.nome) return json({ error: "nome_obrigatorio" }, 400);
      const linha = {
        nome: p.nome, marca_id: p.marca_id ?? null,
        geo: p.geo ?? {}, idade_min: p.idade_min ?? 18, idade_max: p.idade_max ?? 65,
        generos: p.generos ?? [], interesses: p.interesses ?? [], custom_audiences: p.custom_audiences ?? [],
        criado_por: ud.user.id,
      };
      const q = p.id
        ? sb.from("fabrica_publicos").update(linha).eq("id", p.id).select("id").single()
        : sb.from("fabrica_publicos").insert(linha).select("id").single();
      const { data, error } = await q;
      if (error) return json({ error: "salvar_falhou", detail: error.message }, 500);
      return json({ id: data.id });
    }
    return json({ error: "acao_invalida" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
```

- [ ] **Step 2: (Deploy é checkpoint)** — escrever + commitar; o controller deploya (verify_jwt=true) via MCP no checkpoint. Validar por leitura (gate 401/403; salvar upsert; apagar idempotente).

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-publicos/index.ts
git commit -m "feat(fabrica): Edge fabrica-publicos — salvar/apagar preset de público (gated) (SP-4)"
```

---

### Task 5: `painel-subir.vue` — seção Localização + Público (Fase A)

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-subir.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Consumes: `sb()`/`sbClient` (já no projeto), Edge `fabrica-publicos`, meta-proxy (busca geo/interesses).
- Produces: `params.destino.publico` no invoke do `subir` (quando destino='nova').

- [ ] **Step 1: Estado + carregamento de presets**

Em `src/ferramentas/meta-ads/painel-subir.vue` `<script setup>`, adicionar imports `import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'` e `computed` ao import de vue. Adicionar estado:
```js
const presets = ref([])
const publico = reactive({ presetId: '', nome: '', geo: { cities: [], excluded: [] }, idade_min: 18, idade_max: 65, generos: [], interesses: [], custom_audiences: [] })
const buscaCidade = ref(''); const cidadesAchadas = ref([])
const buscaInteresse = ref(''); const interessesAchados = ref([])
onMounted(async () => { presets.value = await sb('fabrica_publicos?select=*&ativo=eq.true&order=created_at.desc') })
function aplicarPreset() {
  const p = presets.value.find((x) => x.id === publico.presetId); if (!p) return
  Object.assign(publico, { nome: p.nome, geo: p.geo || { cities: [], excluded: [] }, idade_min: p.idade_min, idade_max: p.idade_max, generos: p.generos || [], interesses: p.interesses || [], custom_audiences: p.custom_audiences || [] })
}
```

- [ ] **Step 2: Busca de cidades e interesses via meta-proxy**

Adicionar (usa o `ACCOUNT_ID`/`ACT` já no arquivo):
```js
async function buscarCidades() {
  if (!buscaCidade.value.trim()) return
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: '/search', params: { type: 'adgeolocation', location_types: JSON.stringify(['city']), q: buscaCidade.value, limit: 10 }, method: 'GET' } })
  cidadesAchadas.value = data?.data || []
}
function addCidade(c) { if (!publico.geo.cities.some((x) => x.key === c.key)) publico.geo.cities.push({ key: c.key, nome: `${c.name}${c.region ? ' · ' + c.region : ''}`, radius: 15, distance_unit: 'kilometer' }); cidadesAchadas.value = []; buscaCidade.value = '' }
function rmCidade(key) { publico.geo.cities = publico.geo.cities.filter((x) => x.key !== key) }
function excluirCidade(c) { if (!publico.geo.excluded.some((x) => x.key === c.key)) publico.geo.excluded.push({ key: c.key, nome: c.name, type: 'city' }); cidadesAchadas.value = []; buscaCidade.value = '' }
function rmExcluida(key) { publico.geo.excluded = publico.geo.excluded.filter((x) => x.key !== key) }
async function buscarInteresses() {
  if (!buscaInteresse.value.trim()) return
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: '/search', params: { type: 'adinterest', q: buscaInteresse.value, limit: 10 }, method: 'GET' } })
  interessesAchados.value = data?.data || []
}
function addInteresse(i) { if (!publico.interesses.some((x) => x.id === i.id)) publico.interesses.push({ id: i.id, name: i.name }); interessesAchados.value = []; buscaInteresse.value = '' }
function rmInteresse(id) { publico.interesses = publico.interesses.filter((x) => x.id !== id) }
```

- [ ] **Step 3: Salvar/apagar preset + montar o `publico` pro subir**

```js
function toggleGenero(g) { const i = publico.generos.indexOf(g); i > -1 ? publico.generos.splice(i, 1) : publico.generos.push(g) }
function publicoParaEnvio() {
  return { geo: { cities: publico.geo.cities.map((c) => ({ key: c.key, radius: c.radius, distance_unit: c.distance_unit })), excluded: publico.geo.excluded.map((e) => ({ key: e.key, type: e.type })) }, idade_min: publico.idade_min, idade_max: publico.idade_max, generos: [...publico.generos], interesses: publico.interesses.map((i) => ({ id: i.id, name: i.name })), custom_audiences: publico.custom_audiences.map((a) => ({ id: a.id, name: a.name, subtype: a.subtype })) }
}
async function salvarPreset() {
  const nome = prompt('Nome do preset:', publico.nome || ''); if (!nome) return
  const { data, error } = await sbClient.functions.invoke('fabrica-publicos', { body: { acao: 'salvar', preset: { ...publicoParaEnvio(), nome } } })
  if (error) return alert('Falha ao salvar: ' + error.message)
  publico.nome = nome; presets.value = await sb('fabrica_publicos?select=*&ativo=eq.true&order=created_at.desc'); if (data?.id) publico.presetId = data.id
}
async function apagarPreset() {
  if (!publico.presetId) return; if (!confirm('Apagar este preset?')) return
  const { error } = await sbClient.functions.invoke('fabrica-publicos', { body: { acao: 'apagar', id: publico.presetId } })
  if (error) return alert('Falha ao apagar: ' + error.message)
  publico.presetId = ''; presets.value = await sb('fabrica_publicos?select=*&ativo=eq.true&order=created_at.desc')
}
```
E no `subir()`, quando `destino.tipo==='nova'`, incluir o público no params:
```js
const params = { campanhaId: props.campanhaId, destino: destino.tipo === 'existente'
  ? { tipo: 'existente', campaignId: destino.campaignId }
  : { tipo: 'nova', loja: destino.loja, publico: publicoParaEnvio() } }
```

- [ ] **Step 4: Template da seção (só quando destino='nova')**

Adicionar, dentro do painel de Destino ou logo após, um bloco `v-if="destino.tipo==='nova'"` com: dropdown de presets (`v-model="publico.presetId"` + `@change="aplicarPreset"`), busca de cidade (input + botão + lista `cidadesAchadas` com "adicionar"/"excluir"), chips de `publico.geo.cities` (com input de raio `v-model.number="c.radius"` + select de unidade + botão remover), chips de `publico.geo.excluded` (remover), inputs de idade (`publico.idade_min`/`idade_max`), toggles de gênero (`@click="toggleGenero(1)"`/`toggleGenero(2)`), busca de interesses (input + botão + lista + chips), e os botões "Salvar preset"/"Apagar preset". Reusar as classes `.panel/.ph/.eyebrow/.choices/.choice/.ch-nm/.loja-chip/.marcar-todos/.fi` já em `estudio.css`; adicionar em `estudio.css` só o que faltar (ex.: `.chip`/`.chip-x` p/ os chips com botão remover). Manter o botão "Publicar (pausado)" e o status do job como estão.

- [ ] **Step 5: Build**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6`
Expected: limpo.

- [ ] **Step 6: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-subir.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): painel-subir — seção Localização+Público (geo/idade/gênero/interesses/presets) (SP-4 Fase A)"
```

---

## FASE B — públicos salvos (criar/selecionar audiences)

### Task 6: `painel-subir.vue` — bloco Públicos salvos (engajamento/lookalike)

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-subir.vue`

**Interfaces:**
- Consumes: meta-proxy (`GET /{ACT}/customaudiences`, `POST /{ACT}/customaudiences`); marca (page/ig) — via `ACT`/`ACCOUNT_ID` já no arquivo (marca única hoje).
- Produces: itens em `publico.custom_audiences` `[{id,name,subtype}]` (já consumidos por `publicoParaEnvio`/`montarTargeting`).

- [ ] **Step 1: Listar e selecionar audiences existentes**

Adicionar ao `<script setup>`:
```js
const audiences = ref([]); const carregandoAud = ref(false)
async function listarAudiences() {
  carregandoAud.value = true
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, params: { fields: 'id,name,subtype,approximate_count', limit: 50 }, method: 'GET' } })
  audiences.value = data?.data || []; carregandoAud.value = false
}
function toggleAudiencia(a) {
  const i = publico.custom_audiences.findIndex((x) => x.id === a.id)
  i > -1 ? publico.custom_audiences.splice(i, 1) : publico.custom_audiences.push({ id: a.id, name: a.name, subtype: a.subtype })
}
```

- [ ] **Step 2: Criar engajamento e lookalike**

```js
const IG_ID = '17841462952561833', PAGE_ID = '324679337390168' // marca única hoje; futuro = da tabela de marcas
async function criarEngajamento() {
  const nome = prompt('Nome do público de engajamento:', 'Engajou IG 365d'); if (!nome) return
  const rule = { engagement_specs: [{ object_id: IG_ID, event_types: ['ig_business_profile_all'], retention_days: 365 }] } // regra de engajamento IG
  const { data, error } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, method: 'POST', params: { name: nome, subtype: 'ENGAGEMENT', rule: JSON.stringify(rule) } } })
  if (error || !data?.id) return alert('Falha ao criar engajamento: ' + (error?.message || JSON.stringify(data)))
  publico.custom_audiences.push({ id: data.id, name: nome, subtype: 'ENGAGEMENT' }); await listarAudiences()
}
async function criarLookalike(origem) {
  const nome = prompt('Nome do lookalike:', 'Lookalike 1%'); if (!nome) return
  const spec = { country: 'BR', ratio: 0.01, type: 'similarity' }
  const { data, error } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, method: 'POST', params: { name: nome, subtype: 'LOOKALIKE', origin_audience_id: origem, lookalike_spec: JSON.stringify(spec) } } })
  if (error || !data?.id) return alert('Falha ao criar lookalike: ' + (error?.message || JSON.stringify(data)))
  publico.custom_audiences.push({ id: data.id, name: nome, subtype: 'LOOKALIKE' }); await listarAudiences()
}
```
(Nota: a regra exata de engajamento IG e o `lookalike_spec` são validados ao vivo no checkpoint; se o Graph reclamar, ajustar aqui — é o mesmo espírito dos combos ⚠️ do SP-3.)

- [ ] **Step 3: Template do bloco Públicos salvos**

Dentro da seção `v-if="destino.tipo==='nova'"`, adicionar um sub-painel "Públicos salvos": botão "Carregar públicos" (`@click="listarAudiences"`), lista `audiences` com checkbox (`@change="toggleAudiencia(a)"` marcado quando em `publico.custom_audiences`) mostrando `a.name` + `a.subtype` + contagem; botões "Criar engajamento" (`@click="criarEngajamento"`) e, ao lado de cada audience selecionável, "Criar lookalike desta" (`@click="criarLookalike(a.id)"`). Reusar `.loja-chip`/`.choice`/`.cmd`. Chips dos selecionados via `publico.custom_audiences`.

- [ ] **Step 4: Build**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6`
Expected: limpo.

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-subir.vue
git commit -m "feat(fabrica): painel-subir — públicos salvos (listar/criar engajamento+lookalike) (SP-4 Fase B)"
```

---

## Checkpoints do mundo real (controller + Breno)

1. **Aplicar migration 023** (`fabrica_publicos` + RLS) via MCP.
2. **Deploy Edge `fabrica-publicos`** (verify_jwt=true) via MCP.
3. **VALIDAÇÃO AO VIVO:** subir 1 campanha PAUSED com público montado (cidades+raio+idade/gênero+interesses + uma audience) e confirmar que o Graph aceita o `targeting` — reusar/estender `coletor/validar-objetivos-combos.mjs` (ou um validador análogo que passe um `publico`). Se engajamento/lookalike/regra reclamarem, ajustar as chamadas (Task 6). Nada gasta (PAUSED).
4. **Merge→main + push** (conta brenoov) → Vercel deploya o front.

## Testes (resumo)

- **node:test puros:** `publico.test.mjs` (montarTargeting — amplo/cidades+raio/excluídas/idade-gênero/interesses/custom_audiences/omissões), casos novos em `subir-estudio.test.mjs` (payload aplica público + retrocompat). Suíte coletor inteira verde.
- **Edge:** `fabrica-publicos` por deploy + smoke (gate; salvar/apagar).
- **Front:** `vite build` por task + smoke (editor de geo, salvar/usar preset, listar/criar audiences).
- **Ao vivo:** targeting aceito pelo Graph (checkpoint).

## Sequência

Fase A: 1 (migration) → 2 (montarTargeting) → 3 (subir aplica) → 4 (Edge presets) → 5 (UI geo/interesses/presets). Fase B: 6 (públicos salvos). Migration/deploy/validação-ao-vivo/push nos checkpoints (após Fase A já dá pra ir ao ar; Fase B é incremento).
