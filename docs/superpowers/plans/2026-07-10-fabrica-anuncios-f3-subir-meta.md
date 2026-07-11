# Fábrica de Anúncios — F3 (Subir Campanha no Meta) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Subir **2 campanhas WhatsApp PAUSADAS** (Tivoli, Dom Pedro), cada uma com 2 conjuntos (Geral=promo, De/Por=20 estrela), na conta Vessel `act_1197997517858139`, a partir dos criativos da F2a — via `meta-proxy`. Nada ativa sozinho.

**Architecture:** Um spike valida o Graph primeiro (F3.0). Depois um job do coletor (`subir-campanha-meta.mjs`) monta Campaign→AdSet→AdImage→AdCreative→Ad via `meta-proxy` (POST no Graph v22), tudo PAUSED, gravando rastro em `fabrica_meta_jobs`. Os criativos vêm do Storage (F2a).

**Tech Stack:** Node 20 (coletor), `meta-proxy` (Graph API v22.0), Postgres/Supabase.

> **Testes:** sem harness unitário. Verificação = rodar contra o Graph real e ler as respostas (ids criados). **Toda criação é PAUSED**; há modo `--dry` que monta os payloads sem chamar o Graph.
>
> **Contingência de spike:** as Tasks 4–5 (motor) estão escritas conforme a doc do Graph v22. A **Task 1 (spike)** confirma as premissas de risco (escopo do token, `/adimages` a partir de URL, resolução de geo, número de WhatsApp). Qualquer campo que o spike mostrar que precisa mudar vira um ajuste pontual na execução — não reescreve o plano.

## Global Constraints

- **Conta:** `accounts` id `b6883e82-07cb-4f21-9fd7-ea7626786174` (Vessel) → `ad_account_id=1197997517858139`, `page_id=324679337390168`, `instagram_id=17841462952561833`. Todos os POST vão em `/act_1197997517858139/...`.
- **meta-proxy:** `POST {SUPABASE_URL}/functions/v1/meta-proxy` body `{ accountId, path, params, method }` com header `Authorization: Bearer <jwt do usuário>` + `apikey`. Gate: usuário `role='admin'` (a conta de serviço `claudecode@rbvcompany.com` já é admin). Retorna o JSON do Graph. `method` ∈ GET/POST/DELETE. `params` viram query string (objetos são `JSON.stringify`).
- **Auth do coletor:** `loginServico()` (de `coletor/lib/bling-comercial.mjs`) devolve o JWT da conta de serviço. Reusar.
- **Estrutura alvo (tudo PAUSED, ABO):** 2 campanhas × 2 conjuntos; `daily_budget=5000` (R$50) por conjunto; `objective=OUTCOME_ENGAGEMENT`; adset `optimization_goal=CONVERSATIONS`, `billing_event=IMPRESSIONS`, `destination_type=WHATSAPP`, `promoted_object={page_id:324679337390168}`; `special_ad_categories=[]`.
- **Geo:** Tivoli → cidades Santa Bárbara d'Oeste + Americana; Dom Pedro → Campinas. Resolver keys via `adgeolocation` (Task 1 captura).
- **CTA WhatsApp:** `object_story_spec.link_data.call_to_action = { type:'WHATSAPP_MESSAGE', value:{ app_destination:'WHATSAPP' } }`; imagem via `image_hash`; `message` = a copy do criativo.
- **Criativos:** de `public.fabrica_criativos` (F2a) — `arquetipo` promo/produto, `url` pública, `formato`. Geral=promo; De/Por=20 estrela em estoque da loja + foto studio.
- **Segurança:** nenhum `status` diferente de `PAUSED`. `--dry` imprime payloads. Cada POST valida o `id` retornado antes do próximo; em erro, aborta e loga o já-criado.
- **Env coletor:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GESTOR_USER_EMAIL/PASSWORD` (já existem).

---

### Task 1: F3.0 — Spike de viabilidade do Graph

**Files:**
- Create: `coletor/spike-meta.mjs` (diagnóstico; mantido no repo — útil pra re-checar)

**Interfaces:**
- Produces: um relatório impresso com (a) escopos do token, (b) geo keys das 3 cidades, (c) número(s) de WhatsApp disponíveis, (d) se `/adimages` aceita URL do Storage, (e) criar+deletar 1 campanha PAUSED de teste.

- [ ] **Step 1: Escrever o spike**

Create `coletor/spike-meta.mjs`:
```js
#!/usr/bin/env node
// coletor/spike-meta.mjs — valida viabilidade do Graph antes de construir o motor F3.
// Tudo via meta-proxy. Cria e DELETA uma campanha de teste PAUSED. Não deixa nada ativo.
import './lib/carregar-env.mjs';
import { loginServico } from './lib/bling-comercial.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY;
const ACCOUNT_ID = 'b6883e82-07cb-4f21-9fd7-ea7626786174'; // Vessel
const ACT = 'act_1197997517858139';
const PAGE = '324679337390168';

let TOKEN;
async function meta(path, params = {}, method = 'GET') {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, path, params, method }),
  });
  const d = await r.json();
  return { status: r.status, d };
}

async function main() {
  TOKEN = await loginServico();
  console.log('== (a) escopos do token ==');
  console.log(JSON.stringify((await meta('/me/permissions')).d).slice(0, 600));

  console.log('\n== (b) geo das cidades ==');
  for (const q of ['Santa Barbara Doeste', 'Americana', 'Campinas']) {
    const r = await meta('/search', { type: 'adgeolocation', location_types: ['city'], q, country_code: 'BR', limit: 3 });
    console.log(q, '->', JSON.stringify((r.d.data || []).map(c => ({ key: c.key, name: c.name, region: c.region }))));
  }

  console.log('\n== (c) números de WhatsApp da BM ==');
  const biz = await meta('/me/businesses', { fields: 'id,name' });
  console.log('businesses:', JSON.stringify(biz.d.data || biz.d).slice(0, 400));
  for (const b of (biz.d.data || [])) {
    const waba = await meta('/' + b.id + '/owned_whatsapp_business_accounts', { fields: 'id,name' });
    for (const w of (waba.d.data || [])) {
      const nums = await meta('/' + w.id + '/phone_numbers', { fields: 'id,display_phone_number,verified_name' });
      console.log('WABA', w.id, '->', JSON.stringify(nums.d.data || nums.d));
    }
  }
  // fallback: número conectado à Página
  const pageWa = await meta('/' + PAGE, { fields: 'name,whatsapp_number,connected_whatsapp' });
  console.log('page whatsapp:', JSON.stringify(pageWa.d).slice(0, 300));

  console.log('\n== (d) /adimages a partir de URL do Storage ==');
  const rr = await fetch(URL + '/rest/v1/fabrica_criativos?select=url&arquetipo=eq.promo&limit=1', { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY } });
  const one = (await rr.json())[0];
  if (one) {
    const img = await meta('/' + ACT + '/adimages', { url: one.url }, 'POST');
    console.log('adimages(url) status', img.status, '->', JSON.stringify(img.d).slice(0, 400));
  } else console.log('(sem criativo promo pra testar)');

  console.log('\n== (e) criar + deletar campanha PAUSED de teste ==');
  const camp = await meta('/' + ACT + '/campaigns', { name: 'ZZ-SPIKE-DELETAR', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [] }, 'POST');
  console.log('create status', camp.status, '->', JSON.stringify(camp.d).slice(0, 300));
  if (camp.d && camp.d.id) {
    const del = await meta('/' + camp.d.id, {}, 'DELETE');
    console.log('delete status', del.status, '->', JSON.stringify(del.d).slice(0, 200));
  }
}
main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
```

- [ ] **Step 2: Rodar o spike e capturar os achados**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node spike-meta.mjs
```
Expected e ANOTAR no report: (a) `ads_management`/`pages_messaging` presentes nos scopes; (b) as 3 `geo keys` (ex.: Campinas `key`); (c) o(s) número(s) de WhatsApp (id/display); (d) `/adimages` devolve `{images:{...:{hash}}}` (URL funciona) ou erro (→ fallback bytes); (e) create devolve `{id}` e delete `{success:true}`.

> Se (a) falhar (sem `ads_management`) ou (e) falhar → **PARAR e escalar**: o app Meta precisa de permissão; não dá pra seguir sem isso. Reporte BLOCKED com o erro do Graph.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/spike-meta.mjs
git commit -m "feat(fabrica f3): spike de viabilidade do Graph (scopes, geo, whatsapp, adimages, create/delete)"
```

---

### Task 2: Migração — `fabrica_meta_jobs`

**Files:**
- Create: `db/migrations/016_fabrica_meta_jobs.sql`

**Interfaces:**
- Produces: `fabrica_meta_jobs(id uuid PK, conta_id uuid, ad_account_id text, loja text, tipo text, meta_campaign_id text, adset_ids jsonb, ad_ids jsonb, payload jsonb, status text, erro text, created_at timestamptz)`.

- [ ] **Step 1: Escrever a migração**

Create `db/migrations/016_fabrica_meta_jobs.sql`:
```sql
-- 016_fabrica_meta_jobs.sql — F3: rastro do que foi subido no Meta.
CREATE TABLE IF NOT EXISTS public.fabrica_meta_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid,
  ad_account_id text,
  loja text,
  tipo text,
  meta_campaign_id text,
  adset_ids jsonb,
  ad_ids jsonb,
  payload jsonb,
  status text NOT NULL DEFAULT 'criado',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_meta_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_meta_read ON public.fabrica_meta_jobs;
CREATE POLICY fab_meta_read ON public.fabrica_meta_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_meta_srv ON public.fabrica_meta_jobs;
CREATE POLICY fab_meta_srv ON public.fabrica_meta_jobs FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Aplicar (só a 016, drift-safe)** — via MCP Supabase `apply_migration` name `016_fabrica_meta_jobs` (project `kounqtdoioootxqegkij`). Verificar:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name='fabrica_meta_jobs';
```
Expected: 1 linha.

- [ ] **Step 3: Commit**
```bash
git add db/migrations/016_fabrica_meta_jobs.sql
git commit -m "feat(fabrica f3): tabela fabrica_meta_jobs (rastro do que subiu no Meta)"
```

---

### Task 3: Lote de criativos por loja (20 estrela + promo)

**Files:**
- Modify: `coletor/gerar-criativos.mjs` (add `--loja` + `--fonte` + `--limite` já existe)

**Interfaces:**
- Consumes: F2a (`gerar-criativos.mjs`, `fabrica_candidatos.fonte`/`loja_nome`/`deposito_id`).
- Produces: uma campanha F2a (`fabrica_campanhas` + `fabrica_criativos`) por loja com os **20 estrela** (fonte='estrela', em estoque, foto studio) + reaproveita o set promo.

- [ ] **Step 1: Adicionar filtro por loja + fonte no orquestrador**

Em `coletor/gerar-criativos.mjs`, na query de candidatos, adicionar filtros opcionais: `--loja <deposito_id>` (filtra `deposito_id=eq.<x>`) e `--fonte estrela` (filtra `fonte=eq.estrela`). Ordenar por performance se houver coluna; senão manter ordem atual e cortar em `--limite 20`. Manter todo o resto (copy, studio-skip, upload) igual.

Trecho (dentro do build da query `cands`):
```js
const LOJA = arg('--loja', null);
const FONTE = arg('--fonte', null);
let q = `/fabrica_candidatos?select=id,sku,nome,preco,selecionado,deposito_id,fonte&rodada_id=eq.${rodadaId}&selecionado=eq.true`;
if (LOJA) q += `&deposito_id=eq.${LOJA}`;
if (FONTE) q += `&fonte=eq.${FONTE}`;
q += `&order=loja_nome`;
const cands = await sbGet(q);
```

- [ ] **Step 2: Verificar disponibilidade de estrela por loja**

Run (MCP `execute_sql`):
```sql
SELECT loja_nome, count(*) FILTER (WHERE fonte='estrela') AS estrelas, count(*) AS total
FROM public.fabrica_candidatos
WHERE rodada_id=(SELECT id FROM public.fabrica_rodadas ORDER BY created_at DESC LIMIT 1)
GROUP BY loja_nome;
```
Expected: idealmente ≥20 estrela por loja. **Se houver menos** (a extração da F1 pode sub-marcar estrela): reportar DONE_WITH_CONCERNS com a contagem real — o dono decide completar com outro quadrante ou subir menos ads. Não invente estrelas.

- [ ] **Step 3: Gerar os lotes por loja**

Run (Tivoli `14888726315`, Dom Pedro `14888617206`):
```bash
cd /Users/erickmartins/iamundi/coletor
node gerar-criativos.mjs --pct 50 --nome "Tivoli De x Por" --loja 14888726315 --fonte estrela --limite 20
node gerar-criativos.mjs --pct 50 --nome "Dom Pedro De x Por" --loja 14888617206 --fonte estrela --limite 20
```
Expected: 2 campanhas F2a com os produtos estrela por loja (foto studio) no Storage. Anotar os `campanha` ids.

- [ ] **Step 4: Commit**
```bash
git add coletor/gerar-criativos.mjs
git commit -m "feat(fabrica f3): filtro --loja/--fonte no gerador (lote 20 estrela por loja)"
```

---

### Task 4: Motor — `subir-campanha-meta.mjs` (dry)

**Files:**
- Create: `coletor/subir-campanha-meta.mjs`

**Interfaces:**
- Consumes: `meta-proxy`, `fabrica_criativos`, geo keys + whatsapp number (da Task 1), Task 2.
- Produces: função que, dado a config, monta Campaign→AdSet→AdImage→AdCreative→Ad (PAUSED) via Graph. `--dry` só imprime os payloads.

- [ ] **Step 1: Escrever o motor**

Create `coletor/subir-campanha-meta.mjs` com:
- helper `meta(path, params, method)` (igual ao do spike),
- `const CFG` no topo: número de WhatsApp escolhido, geo keys por loja (preenchidos com os achados da Task 1), `ACT`, `PAGE`, `IG`,
- para cada campanha (Tivoli, Dom Pedro): `POST /act/campaigns` (PAUSED) → para cada conjunto: `POST /act/adsets` (daily_budget 5000, optimization CONVERSATIONS, destination WHATSAPP, promoted_object {page_id}, targeting {geo_locations:{cities:[{key}]}}) → para cada criativo do conjunto: `POST /act/adimages {url}` → `image_hash`; `POST /act/adcreatives {object_story_spec:{page_id, instagram_actor_id:IG, link_data:{image_hash, message:copy, call_to_action:{type:'WHATSAPP_MESSAGE'}}}}` → `creative_id`; `POST /act/ads {adset_id, creative:{creative_id}, status:'PAUSED'}`.
- `--dry`: imprime cada payload e NÃO chama o Graph.
- Grava `fabrica_meta_jobs` por campanha.

> **Preencher `CFG` com os valores REAIS que a Task 1 (spike) capturou** (geo keys, número). Se a Task 1 mostrou que `/adimages` NÃO aceita URL, trocar o passo da imagem por upload de bytes (baixar o PNG e mandar `bytes` base64) — decidir conforme o achado.

- [ ] **Step 2: Rodar em `--dry` e conferir os payloads**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node subir-campanha-meta.mjs --dry
```
Expected: imprime 2 campanhas × 2 conjuntos × N ads com os payloads corretos (PAUSED, geo certo por loja, budget 5000, WhatsApp CTA, image por URL). Nenhuma chamada ao Graph. Conferir manualmente que os geo/loja/criativos batem.

- [ ] **Step 3: Commit**
```bash
git add coletor/subir-campanha-meta.mjs
git commit -m "feat(fabrica f3): motor subir-campanha-meta (dry) - campaign/adset/creative/ad PAUSED"
```

---

### Task 5: Subir de verdade (PAUSED) + conferência

**Files:** nenhum (execução)

- [ ] **Step 1: Subir as 2 campanhas (PAUSED)**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node subir-campanha-meta.mjs
```
Expected: cria as 2 campanhas + 4 conjuntos + ads, todos **PAUSED**; grava `fabrica_meta_jobs`. Imprime os `meta_campaign_id`.

- [ ] **Step 2: Conferir no Graph (via meta-proxy) que está tudo PAUSED**

Run (MCP `execute_sql` pega os ids; ou o próprio job imprime):
Confirmar via `GET /{ad_account}/campaigns?fields=name,status,effective_status` que as 2 campanhas existem e `status=PAUSED`. **Nenhuma ACTIVE.**

- [ ] **Step 3: Handoff pro humano**

Reportar os `meta_campaign_id` e instruir: **revisar no Gerenciador de Anúncios e ATIVAR manualmente** (o robô nunca ativa). Registrar no `fabrica_meta_jobs`.

---

## Definition of Done (F3.1)
- Spike passou (token com ads_management, create/delete ok, geo + whatsapp + adimages resolvidos).
- 2 campanhas WhatsApp **PAUSED** na conta Vessel: Tivoli (geo Sta Bárbara+Americana) e Dom Pedro (geo Campinas), cada uma com conjunto Geral (promo) + De/Por (20 estrela em estoque), ABO R$50, ads com os criativos da F2a.
- Rastro em `fabrica_meta_jobs`. Nada ativado — handoff pro humano ativar.

## Follow-ups
- **F3.2 UI seletor** (tipo WhatsApp/Link/Insta → destino dinâmico) na Fábrica.
- Destinos **Link/Instagram** completos.
- **Ranking de performance** real dos estrela (hoje corta por ordem/limite).
- Pixel/Conversões; ativação assistida; limpeza de dados de teste.
