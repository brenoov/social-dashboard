# Fábrica de Anúncios — UI Estúdio + Storage/Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar uma UI "Estúdio" na seção Meta Ads pra gerar/curar/subir criativos da Fábrica sem terminal, e garantir que o Storage do Supabase nunca estoure (purga por status + backstop 30d).

**Architecture:** UI (Vue) → Edge `fabrica-trigger` → GitHub Actions `fabrica.yml` (runner Node com Chromium/Python) → status na tabela `fabrica_jobs` (UI faz polling). O motor de gerar e o de subir viram `run(opts)` reutilizáveis (CLI + runner). Uma Edge `fabrica-purga` disparada por pg_cron diário apaga PNGs de rodadas fechadas e de rodadas abandonadas (>30d), de forma centralizada e idempotente.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno + Storage), Node 20 (coletor/, `pg`, puppeteer, Python BiRefNet), Vue 3 `<script setup>` + Vite, GitHub Actions.

## Global Constraints

- **Repo/conta:** `brenoov/social-dashboard`, conta git/gh `brenoov` (email `breno@rbvcompany.com`). Nunca commitar PNG no git.
- **Permissão:** tudo gateado por `meta.fabrica` — front `hasPermission('module:meta:fabrica')`, RLS `p.permissions ? 'meta.fabrica'`, Edge caller-facing re-checa `role='admin' OR permissions ? 'meta.fabrica'`.
- **Motor de subida = idempotente + multi-destino.** Reusar a lógica PROVADA em `coletor/subir-campanha-genspark.mjs`: conjuntos multi-destino (`destination_type` contém `MESSAGING_..._WHATSAPP`) exigem `asset_feed_spec: { optimization_type:'DOF_MESSAGING_DESTINATION', call_to_actions:[Messenger, WhatsApp, Instagram] }` + `degrees_of_freedom_spec` (82 features OPT_OUT); conjunto WhatsApp-puro usa `link_data`+CTA `WHATSAPP_MESSAGE`. Idempotência por nome determinístico de ad (pula os já criados).
- **Rate limit Meta code 17** (~90–100 criações/hora): o subir fatia e é retomável; job só marca `fechada_em` em sucesso 100% (pendências → status `erro` "re-disparar pra continuar", sem fechar).
- **Tudo que sobe ao Meta sobe PAUSED.**
- **Edge chamada por cron** = padrão service-role sem CORS (ref `coletar-dados`); **Edge chamada pelo front** = padrão CORS + `getUser` + gate `profiles` (ref `acessos-proxy`).
- **Migrations**: arquivo em `db/migrations/NNN_*.sql` (header comentado + `CREATE TABLE IF NOT EXISTS` + RLS `ENABLE` + `DROP POLICY IF EXISTS`/`CREATE POLICY` read `TO authenticated`, `_srv` `service_role`), aplicado com `cd coletor && node run-migrations.mjs`.
- **pg_cron** NÃO é versionado em arquivo — agendar via `execute_sql` (MCP Supabase) com `cron.schedule('...', $$ select net.http_post(...) $$)`.

---

## File Structure

**Criar:**
- `db/migrations/017_fabrica_jobs_lifecycle.sql` — tabela `fabrica_jobs` + colunas `fechada_em`/`purgado_em`.
- `coletor/lib/meta-subir.mjs` — core reutilizável do subir (build de criativa multi-destino/whatsapp + criação idempotente de ad), extraído de `subir-campanha-genspark.mjs`.
- `coletor/fabrica-job-runner.mjs` — wrapper de status: lê `job_id`, marca `rodando`, chama `run()` de gerar/subir, grava estado terminal.
- `.github/workflows/fabrica.yml` — `workflow_dispatch` que roda o runner.
- `supabase/functions/fabrica-trigger/index.ts` — Edge caller-facing: valida + insere job + dispara o workflow.
- `supabase/functions/fabrica-purga/index.ts` — Edge service-role: purga por status + backstop 30d.
- `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue` — orquestrador dos 3 passos + `useJobStatus`.
- `src/ferramentas/meta-ads/painel-gerar.vue`, `painel-curar.vue`, `painel-subir.vue`.
- `src/ferramentas/meta-ads/use-job-status.js` — composable de polling de `fabrica_jobs`.

**Modificar:**
- `coletor/gerar-criativos.mjs` — extrair `export async function run(opts)`; CLI vira thin wrapper.
- `coletor/subir-campanha-genspark.mjs` — passar a usar `lib/meta-subir.mjs` (sem duplicar lógica).
- `src/mapa-de-enderecos.js` — rota `/fabrica-estudio`.
- `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue` — card do Estúdio.

---

## Task 1: Migration — `fabrica_jobs` + colunas de lifecycle

**Files:**
- Create: `db/migrations/017_fabrica_jobs_lifecycle.sql`
- Test: aplicar via `coletor/run-migrations.mjs` e consultar o schema.

**Interfaces:**
- Produces: tabela `public.fabrica_jobs (id, tipo, params jsonb, status, github_run_id, resultado jsonb, erro, criado_por, created_at, updated_at)`; colunas `public.fabrica_campanhas.fechada_em`, `public.fabrica_campanhas.purgado_em`, `public.fabrica_criativos.purgado_em`.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/017_fabrica_jobs_lifecycle.sql`:

```sql
-- 017_fabrica_jobs_lifecycle.sql — F2a.3 (fila de jobs da UI Estúdio) + lifecycle/purga do Storage.
-- fabrica_jobs: status voltado pra UI (enfileirado→rodando→concluido/erro).
CREATE TABLE IF NOT EXISTS public.fabrica_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                       -- 'gerar' | 'subir'
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'enfileirado',-- 'enfileirado'|'rodando'|'concluido'|'erro'
  github_run_id text,
  resultado jsonb,
  erro text,
  criado_por uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_jobs_read ON public.fabrica_jobs;
CREATE POLICY fab_jobs_read ON public.fabrica_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_jobs_srv ON public.fabrica_jobs;
CREATE POLICY fab_jobs_srv ON public.fabrica_jobs FOR ALL USING (auth.role() = 'service_role');

-- lifecycle: rodada (fabrica_campanhas) fecha quando o subir conclui 100%; purga marca purgado_em.
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS fechada_em timestamptz;
ALTER TABLE public.fabrica_campanhas ADD COLUMN IF NOT EXISTS purgado_em timestamptz;
ALTER TABLE public.fabrica_criativos ADD COLUMN IF NOT EXISTS purgado_em timestamptz;
```

- [ ] **Step 2: Aplicar a migration**

Run: `cd /Users/erickmartins/iamundi/coletor && node run-migrations.mjs`
Expected: linha `aplicando 017_fabrica_jobs_lifecycle.sql ... ok` (e nenhuma reaplicação das anteriores).

- [ ] **Step 3: Verificar o schema**

Run (via MCP Supabase `list_tables` no schema `public`, ou SQL):
`select column_name from information_schema.columns where table_name='fabrica_campanhas' and column_name in ('fechada_em','purgado_em');`
Expected: 2 linhas. E `fabrica_jobs` existe com as colunas listadas.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/017_fabrica_jobs_lifecycle.sql
git commit -m "feat(fabrica): migration 017 — fabrica_jobs + colunas fechada_em/purgado_em"
```

---

## Task 2: Extrair `run(opts)` do gerar-criativos

**Files:**
- Modify: `coletor/gerar-criativos.mjs`
- Test: `coletor/gerar-criativos.test.mjs` (node:test)

**Interfaces:**
- Produces: `export async function run(opts)` onde `opts = { pct, nome, parcelas, limite, dry, loja, fonte, estrela, deposito, looks, modos }` (todos opcionais com default); retorna `{ campanhaId, criativos: <n> }`. O CLI (`main()`) apenas parseia flags e chama `run()`.

- [ ] **Step 1: Escrever teste que importa `run` e roda em `--dry`**

Create `coletor/gerar-criativos.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './gerar-criativos.mjs';

test('run() é exportada e aceita opts', () => {
  assert.equal(typeof run, 'function');
});

test('run({dry:true, limite:0}) não lança e retorna shape', async () => {
  const r = await run({ dry: true, limite: 0 });
  assert.ok(r && typeof r === 'object');
  assert.ok('criativos' in r);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test gerar-criativos.test.mjs`
Expected: FAIL — `The requested module './gerar-criativos.mjs' does not provide an export named 'run'`.

- [ ] **Step 3: Refatorar `main()` → `export async function run(opts)`**

Em `coletor/gerar-criativos.mjs`: transformar as constantes de topo (`PCT`, `NOME`, `PARCELAS`, `LIMITE`, `DRY`, `opts`…) em desestruturação dos parâmetros dentro de `run`, com defaults iguais aos atuais. Assinatura:

```js
export async function run({
  pct = 50, nome = null, parcelas = 10, limite = null, dry = false,
  loja = null, fonte = null, estrela = null, deposito = null, looks = null, modos = null,
} = {}) {
  // ... corpo atual de main(), usando as variáveis acima no lugar das constantes de topo ...
  // retornar no fim:
  return { campanhaId, criativos: totalCriativos };
}
```

Manter o CLI como thin wrapper no fim do arquivo:

```js
function flag(f, d) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; }
if (import.meta.url === `file://${process.argv[1]}`) {
  run({
    pct: Number(flag('--pct', 50)), nome: flag('--nome', null),
    parcelas: Number(flag('--parcelas', 10)), limite: flag('--limite') ? Number(flag('--limite')) : null,
    dry: process.argv.includes('--dry'), loja: flag('--loja', null), fonte: flag('--fonte', null),
    estrela: flag('--estrela', null), deposito: flag('--deposito', null),
    looks: flag('--looks', null), modos: flag('--modos', null),
  }).then((r) => console.log('gerar concluído:', r)).catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test gerar-criativos.test.mjs`
Expected: PASS (2 testes).

- [ ] **Step 5: Confirmar que o CLI ainda funciona em dry**

Run: `cd /Users/erickmartins/iamundi/coletor && node --import ./lib/curl-fetch.mjs gerar-criativos.mjs --dry --limite 0`
Expected: roda sem erro e imprime `gerar concluído:`.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs coletor/gerar-criativos.test.mjs
git commit -m "refactor(fabrica): gerar-criativos exporta run(opts) + CLI thin wrapper"
```

---

## Task 3: Core reutilizável do subir — `lib/meta-subir.mjs`

**Files:**
- Create: `coletor/lib/meta-subir.mjs`
- Test: `coletor/lib/meta-subir.test.mjs`

**Interfaces:**
- Consumes: helpers de fetch/proxy já usados no genspark (meta-proxy).
- Produces:
  - `export const DOF_SPEC` — `{ creative_features_spec: {<82 features>: {enroll_status:'OPT_OUT'}} }`.
  - `export function nomeAd(prefixo, chave, adsetName)` → string determinística (idempotência).
  - `export function payloadCriativa({ hash, adsetDestinationType, waNumero, page, ig, mensagem })` → retorna o `object_story_spec`(+`asset_feed_spec` se multi-destino) + `degrees_of_freedom_spec`. Multi-destino quando `adsetDestinationType` contém `'WHATSAPP'` E (`'MESSENGER'` ou `'INSTAGRAM'`); senão WhatsApp-puro.
  - `export async function subirCriativos({ meta, act, page, ig, itens, adsets, prefixo, mensagem, jaTem, onAd })` → cria adcreative+ad PAUSED por (item × adset) pulando `jaTem`, tratando rate limit code 17 (retorna `{ criados, pendentes }` — `pendentes>0` quando parou por limite).

- [ ] **Step 1: Escrever teste das funções puras**

Create `coletor/lib/meta-subir.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOF_SPEC, nomeAd, payloadCriativa } from './meta-subir.mjs';

test('DOF_SPEC tem features todas OPT_OUT', () => {
  const f = DOF_SPEC.creative_features_spec;
  assert.ok(Object.keys(f).length >= 80);
  assert.ok(Object.values(f).every((v) => v.enroll_status === 'OPT_OUT'));
});

test('nomeAd é determinístico e <=200 chars', () => {
  const a = nomeAd('Estudio · Tivoli', 'ABC.png', '[VENDAS] SALE 50% | TIVOLI [Rmkt]');
  assert.equal(a, nomeAd('Estudio · Tivoli', 'ABC.png', '[VENDAS] SALE 50% | TIVOLI [Rmkt]'));
  assert.ok(a.length <= 200);
});

test('payloadCriativa: conjunto WhatsApp-puro usa link_data+WHATSAPP_MESSAGE, sem asset_feed_spec', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'WHATSAPP', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.object_story_spec.link_data.call_to_action.type, 'WHATSAPP_MESSAGE');
  assert.equal(p.asset_feed_spec, undefined);
  assert.ok(p.degrees_of_freedom_spec);
});

test('payloadCriativa: conjunto multi-destino usa asset_feed_spec com 3 CTAs', () => {
  const p = payloadCriativa({ hash: 'h', adsetDestinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP', waNumero: '5519999', page: 'P', ig: 'I', mensagem: 'm' });
  assert.equal(p.asset_feed_spec.optimization_type, 'DOF_MESSAGING_DESTINATION');
  assert.equal(p.asset_feed_spec.call_to_actions.length, 3);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/meta-subir.test.mjs`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `lib/meta-subir.mjs`**

Extrair de `subir-campanha-genspark.mjs` (mover, não copiar): `DOF_FEATURES`/`DOF_SPEC`, `soDigitos`, `payloadMultiDestino` → generalizar como `payloadCriativa` (com o ramo WhatsApp-puro do `subir-campanha-meta.mjs`), `nomeAd`, e o laço de criação idempotente → `subirCriativos`. Assinatura:

```js
export const DOF_FEATURES = [/* as 82 do subir-campanha-genspark.mjs */];
export const DOF_SPEC = { creative_features_spec: Object.fromEntries(DOF_FEATURES.map((f) => [f, { enroll_status: 'OPT_OUT' }])) };
export const soDigitos = (n) => String(n).replace(/\D/g, '');
export const nomeAd = (prefixo, chave, adsetName) => `${prefixo} · ${String(chave).replace(/\.png$/i, '')} · ${adsetName}`.slice(0, 200);

export function payloadCriativa({ hash, adsetDestinationType, waNumero, page, ig, mensagem }) {
  const dt = String(adsetDestinationType || '').toUpperCase();
  const multi = dt.includes('WHATSAPP') && (dt.includes('MESSENGER') || dt.includes('INSTAGRAM'));
  if (!multi) {
    return {
      object_story_spec: { page_id: page, instagram_user_id: ig, link_data: {
        image_hash: hash, link: 'https://wa.me/' + soDigitos(waNumero), message: mensagem,
        call_to_action: { type: 'WHATSAPP_MESSAGE' } } },
      degrees_of_freedom_spec: DOF_SPEC,
    };
  }
  const mLink = `https://m.me/${page}`, waUrl = `https://api.whatsapp.com/send?phone=${soDigitos(waNumero)}`;
  return {
    object_story_spec: { page_id: page, instagram_user_id: ig, link_data: {
      image_hash: hash, link: mLink, message: mensagem,
      call_to_action: { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } } } },
    asset_feed_spec: { optimization_type: 'DOF_MESSAGING_DESTINATION', call_to_actions: [
      { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER', link: mLink } },
      { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP', link: waUrl } },
      { type: 'INSTAGRAM_MESSAGE', value: { app_destination: 'INSTAGRAM_DIRECT', link: 'https://www.instagram.com' } },
    ] },
    degrees_of_freedom_spec: DOF_SPEC,
  };
}

// subirCriativos: cria adcreative+ad PAUSED por (item × adset), pulando jaTem; para e retorna
// pendentes>0 se bater rate limit code 17 (o chamador re-dispara pra retomar).
export async function subirCriativos({ meta, act, page, ig, itens, adsets, prefixo, mensagem, jaTem, onAd }) {
  let criados = 0, pendentes = 0;
  for (const item of itens) {
    const hash = await item.getHash(); // item.getHash() faz uploadImagemBytes(url) -> hash (1x por item)
    for (const a of adsets) {
      const nome = nomeAd(prefixo, item.chave, a.name);
      if (jaTem.has(`${a.id}::${nome}`)) continue;
      try {
        const params = payloadCriativa({ hash, adsetDestinationType: a.destinationType, waNumero: a.whatsapp, page, ig, mensagem });
        const cr = await meta(`/${act}/adcreatives`, params, 'POST');
        if (cr.status !== 200 || !cr.d?.id) throw new Error('adcreative ' + JSON.stringify(cr.d).slice(0, 200));
        const ad = await meta(`/${act}/ads`, { name: nome, adset_id: a.id, creative: { creative_id: cr.d.id }, status: 'PAUSED' }, 'POST');
        if (ad.status !== 200 || !ad.d?.id) throw new Error('ad ' + JSON.stringify(ad.d).slice(0, 200));
        criados++; if (onAd) onAd({ adId: ad.d.id, item, adset: a });
      } catch (e) {
        if (/code\D*17|request limit/i.test(e.message)) { pendentes++; return { criados, pendentes, rateLimited: true }; }
        throw e;
      }
    }
  }
  return { criados, pendentes };
}
```

Depois, editar `coletor/subir-campanha-genspark.mjs` pra importar `DOF_SPEC`, `nomeAd`, `payloadCriativa`(no lugar de `payloadMultiDestino`), `soDigitos` de `./lib/meta-subir.mjs` (remover as cópias locais). Rodar `node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs --dry --loja tivoli --limite 1` pra garantir que não quebrou.

- [ ] **Step 4: Rodar teste e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/meta-subir.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Confirmar genspark ainda roda em dry**

Run: `cd /Users/erickmartins/iamundi/coletor && node --import ./lib/curl-fetch.mjs subir-campanha-genspark.mjs --dry --loja tivoli --limite 1`
Expected: imprime o plano sem erro.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/meta-subir.mjs coletor/lib/meta-subir.test.mjs coletor/subir-campanha-genspark.mjs
git commit -m "refactor(fabrica): extrai lib/meta-subir.mjs (criativa multi-destino + subir idempotente)"
```

---

## Task 4: `run(opts)` do subir a partir de `fabrica_criativos` (Estúdio)

**Files:**
- Create: `coletor/subir-estudio.mjs`
- Test: `coletor/subir-estudio.test.mjs`

**Interfaces:**
- Consumes: `lib/meta-subir.mjs` (subirCriativos, nomeAd), meta-proxy, Supabase (`fabrica_criativos`, `fabrica_campanhas`, `fabrica_meta_jobs`).
- Produces: `export async function run({ campanhaId, destino, dry })` → lê os `fabrica_criativos.escolhido=true` da rodada `campanhaId`; `destino` = `{ tipo:'existente', campaignId }` (lista adsets via meta-proxy, com `destination_type`+`whatsapp_phone_number`) ou `{ tipo:'nova', loja }` (cria campanha+adset). Retorna `{ adIds, pendentes, metaCampaignId }`. Pré-busca `jaTem` (ads existentes) pra idempotência. **Só o chamador seta `fechada_em`** (ver Task 5), aqui só sobe.

- [ ] **Step 1: Escrever teste de shape/guard**

Create `coletor/subir-estudio.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './subir-estudio.mjs';

test('run() exportada', () => { assert.equal(typeof run, 'function'); });

test('run({dry:true}) sem escolhidos retorna adIds vazio', async () => {
  const r = await run({ campanhaId: '00000000-0000-0000-0000-000000000000', destino: { tipo: 'nova', loja: 'tivoli' }, dry: true });
  assert.deepEqual(r.adIds, []);
  assert.equal(r.pendentes, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `subir-estudio.mjs`**

Padrão de fetch/TLS/meta-proxy idêntico ao `subir-campanha-genspark.mjs` (reusar `carregar-env`, `curl-fetch`, `tls.DEFAULT_MAX_VERSION='TLSv1.2'`, helper `chamarProxy`/`meta`/`metaTodos`/`uploadImagemBytes`, `loginServico`). Diferenças: os itens vêm de `fabrica_criativos` (campo `url` público) em vez de arquivos locais; `item.getHash = () => uploadImagemBytes(item.url, 'img'+i)`. Para `destino.tipo==='existente'`: `metaTodos('/'+campaignId+'/adsets', {fields:'id,name,effective_status,destination_type,promoted_object'})` → mapear `{id,name,destinationType:a.destination_type, whatsapp:a.promoted_object?.whatsapp_phone_number}`. Para `destino.tipo==='nova'`: criar campaign+adset (reusar o bloco de `subir-campanha-meta.mjs`). `jaTem` = `metaTodos('/'+metaCampaignId+'/ads',{fields:'name,adset_id'})`. Chamar `subirCriativos({...})`. Em `dry`, não chama o Graph (retorna vazio). Assinatura:

```js
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { subirCriativos, nomeAd } from './lib/meta-subir.mjs';
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';
const CFG = { ACT: 'act_1197997517858139', PAGE: '324679337390168', IG: '17841462952561833', ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174' };
const CAPTION_PADRAO = '50% OFF em bolsas La Vessel · chame a gente 💬';

export async function run({ campanhaId, destino, dry = false }) {
  if (dry) return { adIds: [], pendentes: 0, metaCampaignId: null };
  // 1) TOKEN = await loginServico();
  // 2) escolhidos = sbGet(`/fabrica_criativos?select=id,url,storage_path&campanha_id=eq.${campanhaId}&escolhido=eq.true&purgado_em=is.null`)
  // 3) resolve metaCampaignId + adsets conforme destino
  // 4) jaTem = Set(existentes.map(a => `${a.adset_id}::${a.name}`))
  // 5) itens = escolhidos.map((c,i)=>({ chave: c.id, url: c.url, getHash: () => uploadImagemBytes(c.url, 'img'+i) }))
  // 6) const res = await subirCriativos({ meta, act: CFG.ACT, page: CFG.PAGE, ig: CFG.IG, itens, adsets, prefixo: `Estudio`, mensagem: CAPTION_PADRAO, jaTem, onAd: gravaMetaJob });
  // 7) return { adIds, pendentes: res.pendentes, metaCampaignId };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
  run({ campanhaId: arg('--campanha'), destino: arg('--campaign') ? { tipo: 'existente', campaignId: arg('--campaign') } : { tipo: 'nova', loja: arg('--loja') }, dry: process.argv.includes('--dry') })
    .then((r) => console.log('subir concluído:', r)).catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
}
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/subir-estudio.mjs coletor/subir-estudio.test.mjs
git commit -m "feat(fabrica): subir-estudio run(opts) sobe escolhidos de fabrica_criativos (idempotente)"
```

---

## Task 5: `fabrica-job-runner.mjs` (wrapper de status + fecha rodada)

**Files:**
- Create: `coletor/fabrica-job-runner.mjs`
- Test: `coletor/fabrica-job-runner.test.mjs`

**Interfaces:**
- Consumes: `gerar-criativos.mjs` `run`, `subir-estudio.mjs` `run`, Supabase service (via `sbGet/sbPatch` com service key).
- Produces: comportamento — lê `job_id` do env/arg, marca `status='rodando'`+`github_run_id`, chama o `run` certo por `tipo`, no `finally` grava `concluido`+`resultado` ou `erro`+mensagem. Para `tipo='subir'`: se `resultado.pendentes>0` → `status='erro'`, `erro='rate limit — re-disparar pra continuar'`, **NÃO** seta `fechada_em`; se `pendentes===0` → `concluido` **e** `PATCH fabrica_campanhas.fechada_em=now()`.

- [ ] **Step 1: Escrever teste do mapeamento de estado terminal (função pura)**

Create `coletor/fabrica-job-runner.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoTerminalSubir } from './fabrica-job-runner.mjs';

test('subir 100% -> concluido + fecha', () => {
  assert.deepEqual(estadoTerminalSubir({ pendentes: 0, adIds: ['a'] }), { status: 'concluido', fecha: true });
});
test('subir parcial (rate limit) -> erro + não fecha', () => {
  const r = estadoTerminalSubir({ pendentes: 3, adIds: ['a'] });
  assert.equal(r.status, 'erro'); assert.equal(r.fecha, false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test fabrica-job-runner.test.mjs`
Expected: FAIL — sem export `estadoTerminalSubir`.

- [ ] **Step 3: Implementar o runner**

Create `coletor/fabrica-job-runner.mjs`:

```js
import './lib/carregar-env.mjs';
import { run as gerarRun } from './gerar-criativos.mjs';
import { run as subirRun } from './subir-estudio.mjs';
// sbGet/sbPatch usando SUPABASE_SERVICE_KEY (mesmo padrão dos outros .mjs do coletor)

export function estadoTerminalSubir(res) {
  if (res.pendentes > 0) return { status: 'erro', fecha: false, erro: 'rate limit — re-disparar pra continuar' };
  return { status: 'concluido', fecha: true };
}

async function main() {
  const jobId = process.env.FABRICA_JOB_ID || (process.argv.includes('--job') ? process.argv[process.argv.indexOf('--job') + 1] : null);
  if (!jobId) throw new Error('FABRICA_JOB_ID ausente');
  const job = (await sbGet(`/fabrica_jobs?select=*&id=eq.${jobId}`))[0];
  if (!job) throw new Error('job não encontrado');
  await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'rodando', github_run_id: process.env.GITHUB_RUN_ID || null, updated_at: new Date().toISOString() });
  try {
    if (job.tipo === 'gerar') {
      const r = await gerarRun(job.params);
      await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'concluido', resultado: r, updated_at: new Date().toISOString() });
    } else if (job.tipo === 'subir') {
      const r = await subirRun(job.params);
      const t = estadoTerminalSubir(r);
      await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: t.status, resultado: r, erro: t.erro || null, updated_at: new Date().toISOString() });
      if (t.fecha && job.params.campanhaId) await sbPatch(`/fabrica_campanhas?id=eq.${job.params.campanhaId}`, { fechada_em: new Date().toISOString() });
    } else { throw new Error('tipo inválido: ' + job.tipo); }
  } catch (e) {
    await sbPatch(`/fabrica_jobs?id=eq.${jobId}`, { status: 'erro', erro: String(e.message).slice(0, 500), updated_at: new Date().toISOString() });
    throw e;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
```

- [ ] **Step 4: Rodar teste e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test fabrica-job-runner.test.mjs`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/fabrica-job-runner.mjs coletor/fabrica-job-runner.test.mjs
git commit -m "feat(fabrica): fabrica-job-runner (status + fecha rodada só em subir 100%)"
```

---

## Task 6: Workflow `fabrica.yml`

**Files:**
- Create: `.github/workflows/fabrica.yml`

**Interfaces:**
- Consumes: `coletor/fabrica-job-runner.mjs`; secrets `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY*` (já no repo).
- Produces: workflow `workflow_dispatch` com input `job_id` (+ params) que roda o runner com Chromium/Python instalados e cache do peso BiRefNet.

- [ ] **Step 1: Escrever o workflow**

Create `.github/workflows/fabrica.yml` (baseado em `relatorios-comerciais.yml`, + Python/BiRefNet/cache):

```yaml
name: Fábrica de Anúncios (Estúdio)
on:
  workflow_dispatch:
    inputs:
      job_id: { description: 'fabrica_jobs.id', required: true }
concurrency: { group: fabrica-estudio, cancel-in-progress: false }
jobs:
  rodar:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Cache BiRefNet + deps
        uses: actions/cache@v4
        with:
          path: |
            ~/.u2net
            coletor/node_modules
            ~/.cache/pip
          key: fabrica-${{ runner.os }}-${{ hashFiles('coletor/package-lock.json') }}
      - name: Instalar deps
        run: |
          cd coletor && npm ci
          pip install rembg onnxruntime pillow numpy
      - name: Rodar job
        env:
          FABRICA_JOB_ID: ${{ github.event.inputs.job_id }}
          GITHUB_RUN_ID: ${{ github.run_id }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TRAFEGO }}
        run: cd coletor && node --import ./lib/curl-fetch.mjs fabrica-job-runner.mjs
```

- [ ] **Step 2: Validar o YAML**

Run: `cd /Users/erickmartins/iamundi && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/fabrica.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 3: Commit + push (workflow precisa existir no remoto pra ser disparável)**

```bash
cd /Users/erickmartins/iamundi
git add .github/workflows/fabrica.yml
git commit -m "feat(fabrica): workflow fabrica.yml (runner do Estúdio via workflow_dispatch)"
git push origin main
```

> Nota: a conta `brenoov` precisa do escopo `workflow` no gh pra push de workflow (memória). Se o push falhar por escopo, `gh auth refresh -h github.com -s workflow`.

---

## Task 7: Edge `fabrica-trigger` (front → dispara workflow)

**Files:**
- Create: `supabase/functions/fabrica-trigger/index.ts`
- Test: verificação manual via `curl` (sem harness de Edge no repo).

**Interfaces:**
- Consumes: tabela `fabrica_jobs`, GitHub API `workflow_dispatch`, secrets `GITHUB_PAT_FABRICA`, `GITHUB_REPO`.
- Produces: `POST { tipo, params }` → `{ job_id }`. Gate: `role='admin' OR permissions ? 'meta.fabrica'`.

- [ ] **Step 1: Implementar a função (padrão caller-facing de `acessos-proxy`)**

Create `supabase/functions/fabrica-trigger/index.ts`:

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
    const { data: prof } = await sb.from("profiles").select("role, permissions").eq("id", ud.user.id).single();
    const ok = prof && (prof.role === "admin" || (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, "meta.fabrica")));
    if (!ok) return json({ error: "sem_permissao" }, 403);
    const { tipo, params } = await req.json();
    if (!["gerar", "subir"].includes(tipo)) return json({ error: "tipo_invalido" }, 400);
    const { data: job, error } = await sb.from("fabrica_jobs").insert({ tipo, params: params || {}, status: "enfileirado", criado_por: ud.user.id }).select("id").single();
    if (error) return json({ error: "insert_falhou", detail: error.message }, 500);
    const repo = Deno.env.get("GITHUB_REPO")!; // "brenoov/social-dashboard"
    const gh = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/fabrica.yml/dispatches`, {
      method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("GITHUB_PAT_FABRICA")!}`, Accept: "application/vnd.github+json", "User-Agent": "fabrica-trigger" },
      body: JSON.stringify({ ref: "main", inputs: { job_id: job.id } }),
    });
    if (!gh.ok) { await sb.from("fabrica_jobs").update({ status: "erro", erro: "dispatch_falhou " + gh.status }).eq("id", job.id); return json({ error: "dispatch_falhou", detail: await gh.text() }, 502); }
    return json({ job_id: job.id });
  } catch (e) { return json({ error: String(e) }, 500); }
});
```

- [ ] **Step 2: Criar secrets e deployar**

Definir secrets no projeto (via MCP/dashboard): `GITHUB_PAT_FABRICA` (fine-grained, `actions:write` só em `brenoov/social-dashboard`) e `GITHUB_REPO=brenoov/social-dashboard`. Deploy: `supabase functions deploy fabrica-trigger` (ou MCP `deploy_edge_function`).

- [ ] **Step 3: Smoke com um usuário admin**

Run (com um JWT válido de admin em `$TOK`):
`curl -s -X POST "$SUPABASE_URL/functions/v1/fabrica-trigger" -H "Authorization: Bearer $TOK" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"tipo":"gerar","params":{"dry":true,"limite":0}}'`
Expected: `{"job_id":"..."}` e uma linha nova em `fabrica_jobs` (`status` vira `rodando`/`concluido` quando o Actions roda). Sem token/admin → 401/403.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-trigger/index.ts
git commit -m "feat(fabrica): Edge fabrica-trigger (gate meta.fabrica + insere job + dispara Actions)"
```

---

## Task 8: Edge `fabrica-purga` + pg_cron

**Files:**
- Create: `supabase/functions/fabrica-purga/index.ts`
- Test: verificação via SQL/dry.

**Interfaces:**
- Consumes: `fabrica_campanhas`, `fabrica_criativos`, Storage bucket `fabrica-criativos` (service role).
- Produces: `POST {}` → apaga PNGs de rodadas fechadas e abandonadas>30d, marca `purgado_em`. Idempotente. Retorna `{ rodadas_purgadas, objetos_apagados }`.

- [ ] **Step 1: Implementar a função (padrão service-role de `coletar-dados`)**

Create `supabase/functions/fabrica-purga/index.ts`:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
const BUCKET = "fabrica-criativos";
async function purgar() {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const trintaDias = new Date(Date.now() - 30 * 864e5).toISOString();
  // rodadas alvo: fechadas não purgadas OU abandonadas (nunca fechadas) com >30d
  const { data: rodadas } = await sb.from("fabrica_campanhas")
    .select("id, fechada_em, created_at")
    .is("purgado_em", null)
    .or(`fechada_em.not.is.null,and(fechada_em.is.null,created_at.lt.${trintaDias})`);
  let objetos = 0, purgadas = 0;
  for (const r of rodadas || []) {
    const { data: crs } = await sb.from("fabrica_criativos").select("id, storage_path").eq("campanha_id", r.id).is("purgado_em", null);
    const paths = (crs || []).map((c) => c.storage_path).filter(Boolean);
    if (paths.length) { const { error } = await sb.storage.from(BUCKET).remove(paths); if (error) throw error; objetos += paths.length; }
    const agora = new Date().toISOString();
    await sb.from("fabrica_criativos").update({ purgado_em: agora }).eq("campanha_id", r.id).is("purgado_em", null);
    await sb.from("fabrica_campanhas").update({ purgado_em: agora }).eq("id", r.id);
    purgadas++;
  }
  return { rodadas_purgadas: purgadas, objetos_apagados: objetos };
}
Deno.serve(async () => {
  try { return new Response(JSON.stringify({ ok: true, ...(await purgar()) }), { headers: { "Content-Type": "application/json" } }); }
  catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});
```

- [ ] **Step 2: Deploy**

`supabase functions deploy fabrica-purga` (ou MCP `deploy_edge_function`).

- [ ] **Step 3: Teste manual (seed → invoca → confere)**

Via SQL (MCP `execute_sql`): criar uma `fabrica_campanhas` com `fechada_em=now()` e uma `fabrica_criativos` com `storage_path` de um objeto de teste no bucket. Invocar: `curl -s -X POST "$SUPABASE_URL/functions/v1/fabrica-purga" -H "Authorization: Bearer $SERVICE_KEY"`. Expected: `{ ok:true, rodadas_purgadas>=1 }`; a `fabrica_campanhas` e `fabrica_criativos` ficam com `purgado_em` setado; o objeto some do bucket. Rodar de novo → `rodadas_purgadas:0` (idempotente).

- [ ] **Step 4: Agendar pg_cron diário**

Via MCP `execute_sql`:
```sql
select cron.schedule('fabrica-purga-diaria', '17 4 * * *',
  $$ select net.http_post(
       url:='https://kounqtdoioootxqegkij.supabase.co/functions/v1/fabrica-purga',
       headers:=jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>','Content-Type','application/json'),
       timeout_milliseconds:=120000) $$);
```
Verificar: `select jobname, schedule from cron.job where jobname='fabrica-purga-diaria';`

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-purga/index.ts
git commit -m "feat(fabrica): Edge fabrica-purga (purga fechadas + backstop 30d) + pg_cron diário"
```

---

## Task 9: Composable `use-job-status.js`

**Files:**
- Create: `src/ferramentas/meta-ads/use-job-status.js`

**Interfaces:**
- Consumes: `sbClient` (`src/compartilhado/conectar-no-banco-de-dados.js`).
- Produces: `export function useJobStatus()` → `{ job (ref), start(jobId), stop() }`. Faz polling de `fabrica_jobs` a cada 3s enquanto `status ∈ {enfileirado,rodando}`; para no terminal.

- [ ] **Step 1: Implementar**

Create `src/ferramentas/meta-ads/use-job-status.js`:

```js
import { ref } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'

export function useJobStatus() {
  const job = ref(null)
  let timer = null
  async function tick(id) {
    const { data } = await sbClient.from('fabrica_jobs').select('*').eq('id', id).single()
    job.value = data
    if (data && ['concluido', 'erro'].includes(data.status)) stop()
  }
  function start(id) { stop(); tick(id); timer = setInterval(() => tick(id), 3000) }
  function stop() { if (timer) { clearInterval(timer); timer = null } }
  return { job, start, stop }
}
```

- [ ] **Step 2: Sanidade de import (build não quebra)**

Run: `cd /Users/erickmartins/iamundi && npx vite build 2>&1 | tail -5`
Expected: build conclui (o composable é importado nas telas nas próximas tasks; aqui só garante sintaxe válida). Se ainda não referenciado, pular pro commit.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/use-job-status.js
git commit -m "feat(fabrica): composable useJobStatus (polling de fabrica_jobs)"
```

---

## Task 10: `painel-gerar.vue`

**Files:**
- Create: `src/ferramentas/meta-ads/painel-gerar.vue`

**Interfaces:**
- Consumes: `sbClient.functions.invoke('fabrica-trigger', { body })`, `useJobStatus`.
- Produces: `<PainelGerar @gerado="campanhaId => ..." />` — formulário (desconto %, looks com favoritos pré-marcados, limite) + botão Gerar + status ao vivo; emite `gerado` com o `resultado.campanhaId` ao concluir.

- [ ] **Step 1: Implementar (padrão `<script setup>` + invoke)**

Create `src/ferramentas/meta-ads/painel-gerar.vue`:

```vue
<script setup>
import { reactive, watch } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { useJobStatus } from './use-job-status.js'
const emit = defineEmits(['gerado'])
const form = reactive({ pct: 50, limite: 8, looks: '' })
const { job, start } = useJobStatus()
async function gerar() {
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'gerar', params: { pct: form.pct, limite: form.limite, looks: form.looks || null } } })
  if (error) return alert('Falha ao disparar: ' + error.message)
  start(data.job_id)
}
watch(job, (j) => { if (j?.status === 'concluido' && j.resultado?.campanhaId) emit('gerado', j.resultado.campanhaId) })
</script>
<template>
  <div class="painel">
    <label>Desconto %<input type="number" v-model.number="form.pct"></label>
    <label>Limite<input type="number" v-model.number="form.limite"></label>
    <label>Looks (vazio = favoritos)<input v-model="form.looks" placeholder="ex.: 4,5,7,10"></label>
    <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="gerar">Gerar</button>
    <p v-if="job">Status: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
  </div>
</template>
```

- [ ] **Step 2: Build**

Run: `cd /Users/erickmartins/iamundi && npx vite build 2>&1 | tail -5`
Expected: build ok.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-gerar.vue
git commit -m "feat(fabrica): painel-gerar (formulário + disparo via fabrica-trigger + status)"
```

---

## Task 11: `painel-curar.vue`

**Files:**
- Create: `src/ferramentas/meta-ads/painel-curar.vue`

**Interfaces:**
- Consumes: `sb()` (leitura), `sbClient` (update de `escolhido`).
- Produces: `<PainelCurar :campanha-id="id" />` — grid dos `fabrica_criativos` da rodada; clique alterna `escolhido` (update otimista); criativo com `purgado_em` mostra placeholder + link Meta em vez de imagem.

- [ ] **Step 1: Implementar**

Create `src/ferramentas/meta-ads/painel-curar.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
const props = defineProps({ campanhaId: String })
const itens = ref([])
async function carregar() {
  if (!props.campanhaId) return
  itens.value = await sb(`fabrica_criativos?select=id,url,arquetipo,formato,escolhido,purgado_em&campanha_id=eq.${props.campanhaId}&order=created_at`)
}
async function alternar(it) {
  const novo = !it.escolhido; it.escolhido = novo // otimista
  const { error } = await sbClient.from('fabrica_criativos').update({ escolhido: novo }).eq('id', it.id)
  if (error) { it.escolhido = !novo; alert('Falha ao salvar') }
}
watch(() => props.campanhaId, carregar, { immediate: true })
</script>
<template>
  <div class="grid">
    <div v-for="it in itens" :key="it.id" class="card" :class="{ on: it.escolhido }" @click="!it.purgado_em && alternar(it)">
      <img v-if="!it.purgado_em" :src="it.url" loading="lazy">
      <div v-else class="placeholder">subido — ver no Gerenciador</div>
      <span class="tag">{{ it.arquetipo }} · {{ it.formato }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Build**

Run: `cd /Users/erickmartins/iamundi && npx vite build 2>&1 | tail -5`
Expected: build ok.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-curar.vue
git commit -m "feat(fabrica): painel-curar (grid + toggle escolhido + placeholder p/ purgado)"
```

---

## Task 12: `painel-subir.vue`

**Files:**
- Create: `src/ferramentas/meta-ads/painel-subir.vue`

**Interfaces:**
- Consumes: `sbClient.functions.invoke('fabrica-trigger')` (tipo `subir`) + `sbClient.functions.invoke('meta-proxy')` pra listar campanhas/adsets; `useJobStatus`.
- Produces: `<PainelSubir :campanha-id="id" />` — seletor de destino (nova campanha por loja OU campanha existente listada via meta-proxy) + botão Subir (PAUSED) + status + `ad_ids`/link.

- [ ] **Step 1: Implementar**

Create `src/ferramentas/meta-ads/painel-subir.vue`:

```vue
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { useJobStatus } from './use-job-status.js'
const props = defineProps({ campanhaId: String })
const ACCOUNT_ID = 'b6883e82-07cb-4f21-9fd7-ea7626786174', ACT = 'act_1197997517858139'
const campanhas = ref([]); const destino = reactive({ tipo: 'nova', loja: 'tivoli', campaignId: '' })
const { job, start } = useJobStatus()
onMounted(async () => {
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/campaigns`, params: { fields: 'id,name', limit: 200 }, method: 'GET' } })
  campanhas.value = data?.data || []
})
async function subir() {
  const params = { campanhaId: props.campanhaId, destino: destino.tipo === 'existente' ? { tipo: 'existente', campaignId: destino.campaignId } : { tipo: 'nova', loja: destino.loja } }
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'subir', params } })
  if (error) return alert('Falha: ' + error.message)
  start(data.job_id)
}
</script>
<template>
  <div class="painel">
    <label><input type="radio" value="nova" v-model="destino.tipo"> Nova campanha por loja</label>
    <select v-if="destino.tipo==='nova'" v-model="destino.loja"><option value="tivoli">Tivoli</option><option value="dp">Dom Pedro</option></select>
    <label><input type="radio" value="existente" v-model="destino.tipo"> Campanha existente</label>
    <select v-if="destino.tipo==='existente'" v-model="destino.campaignId"><option v-for="c in campanhas" :key="c.id" :value="c.id">{{ c.name }}</option></select>
    <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="subir">Subir (PAUSED)</button>
    <p v-if="job">Status: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
    <p v-if="job?.resultado?.adIds">{{ job.resultado.adIds.length }} ads criados (PAUSED). Revisar no Gerenciador.</p>
  </div>
</template>
```

- [ ] **Step 2: Build**

Run: `cd /Users/erickmartins/iamundi && npx vite build 2>&1 | tail -5`
Expected: build ok.

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-subir.vue
git commit -m "feat(fabrica): painel-subir (destino nova/existente via meta-proxy + subir PAUSED)"
```

---

## Task 13: Tela orquestradora + rota + menu

**Files:**
- Create: `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue`
- Modify: `src/mapa-de-enderecos.js`, `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`

**Interfaces:**
- Consumes: os 3 painéis + `hasPermission('module:meta:fabrica')`.
- Produces: rota `/fabrica-estudio` + card no menu Meta Ads; navegação dos 3 passos, guardando `campanhaId` entre Gerar→Curar→Subir.

- [ ] **Step 1: Implementar a tela**

Create `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import PainelGerar from './painel-gerar.vue'
import PainelCurar from './painel-curar.vue'
import PainelSubir from './painel-subir.vue'
const router = useRouter()
const passo = ref('gerar'); const campanhaId = ref(null)
onMounted(() => { if (!hasPermission('module:meta:fabrica')) router.push({ name: 'meta-ads' }) })
function aoGerar(id) { campanhaId.value = id; passo.value = 'curar' }
</script>
<template>
  <div class="estudio">
    <nav><button :class="{on:passo==='gerar'}" @click="passo='gerar'">1. Gerar</button>
      <button :class="{on:passo==='curar'}" :disabled="!campanhaId" @click="passo='curar'">2. Curar</button>
      <button :class="{on:passo==='subir'}" :disabled="!campanhaId" @click="passo='subir'">3. Subir</button></nav>
    <PainelGerar v-if="passo==='gerar'" @gerado="aoGerar" />
    <PainelCurar v-else-if="passo==='curar'" :campanha-id="campanhaId" />
    <PainelSubir v-else :campanha-id="campanhaId" />
  </div>
</template>
```

- [ ] **Step 2: Registrar a rota**

Em `src/mapa-de-enderecos.js`, ao lado da rota `/fabrica-anuncios`, adicionar:

```js
{ path: '/fabrica-estudio', name: 'fabrica-estudio', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-estudio.vue') },
```

- [ ] **Step 3: Card no menu Meta Ads**

Em `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`, ao lado do card da Fábrica (F1), adicionar um card gateado por `hasPermission('module:meta:fabrica')` com `@click="ir('fabrica-estudio')"` e rótulo "Estúdio de Criativos".

- [ ] **Step 4: Build + smoke manual**

Run: `cd /Users/erickmartins/iamundi && npx vite build 2>&1 | tail -5`
Expected: build ok. Smoke manual (dev server): abrir `/fabrica-estudio` como admin → 3 passos aparecem; Gerar dispara job e mostra status; Curar mostra grid; Subir lista campanhas. Sem permissão → redireciona.

- [ ] **Step 5: Commit + push**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue src/mapa-de-enderecos.js src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue
git commit -m "feat(fabrica): tela Estúdio (3 passos) + rota + card no menu Meta Ads"
git push origin main
```

---

## Testes (resumo por camada)

- **Pure/logic (node:test):** `gerar-criativos` (run exportada), `meta-subir` (DOF/nomeAd/payloadCriativa), `fabrica-job-runner` (estadoTerminalSubir), `subir-estudio` (guard dry).
- **Edge:** smoke via `curl` (`fabrica-trigger` gate 401/403/200; `fabrica-purga` seed→purga→idempotente).
- **DB:** `fabrica-purga` marca `purgado_em` e apaga objeto; re-run não reprocessa.
- **UI:** `vite build` por task + smoke manual do fluxo (o repo não tem harness de front).
- **E2E:** um `workflow_dispatch` manual de ponta a ponta (gerar `--dry` → job `concluido`).

## Fora do plano (Fase 2, desenhada no spec)

- Arquivo Zoho WorkDrive (arquiva-antes-de-apagar) + escopo `WorkDrive.files.CREATE` + colunas `zoho_file_id`/`arquivado_em`.
- Escada de desconto por quadrante BCG.
- Agendamento automático (cron) da geração.
