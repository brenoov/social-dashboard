# Estúdio: Fontes de produto + Consolidação da F1 + Fundação multi-marca/multi-loja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter UMA ferramenta (Estúdio) cujo passo Gerar escolhe fonte (oportunidades/garimpo/BCG/ABC/manual) + desconto (previsto ou manual) lendo o Gestor ao vivo; aposentar a F1; e transformar marca/loja em dado (fundação multi-marca/multi-loja).

**Architecture:** Config de marca (ACT/PAGE/IG/legenda) e loja (whatsapp/geo/canal) vira tabela (`fabrica_marcas` + colunas em `fabrica_lojas`). Uma Edge `fabrica-candidatos` monta a lista de produtos ao vivo (dados_json do Gestor + gc_vendas/estoque + Bling). `gerar-criativos` ganha modo lista explícita (`itens=[{sku,deposito,pct}]`, pct por item). O painel Gerar 2.0 orquestra. A F1 (tela/robô/tabelas) é removida.

**Tech Stack:** Supabase (Postgres + Edge Deno + Storage), Node 20 (coletor/, `pg`, testes `node:test`), Vue 3 `<script setup>` + Vite, meta-proxy/bling-proxy.

## Global Constraints

- **Repo/conta:** `brenoov/social-dashboard`, git/gh `brenoov`. Aplicar migrations com `cd coletor && node run-migrations.mjs`. Deploy de Edge via MCP Supabase (não commitar segredo).
- **Zero "La Vessel" hardcoded:** nome de marca nas legendas vem de `fabrica_marcas.nome`/`caption_template`. Títulos/chrome da UI = neutros (sem marca).
- **IDs reais (seed):** ACT `act_1197997517858139`, PAGE `324679337390168`, IG `17841462952561833`, meta-proxy account `b6883e82-07cb-4f21-9fd7-ea7626786174`. Tivoli: deposito `14888726315`, whatsapp `+5519971690502`, geo `[267873,241913]`, canal `205834140`. Dom Pedro: deposito `14888617206`, whatsapp `+5519999545112`, geo `[247071]`, canal `205657609`.
- **Fonte de verdade = Gestor:** `gestao_comercial_briefings.dados_json` tem `oportunidades`/`garimpo` (arrays `{loja, itens[]}`); item de oportunidade = `{sku, descricao, categoria, publico, precoOriginal, pct, precoComDesconto, parcela6x, estoqueLoja, estoquePulmao, diasSemVender, giro}`; garimpo troca `publico`/`giro` por `motivo`.
- **BCG (`_bcgClass`):** Estrela = `giro>0 && st>=0.5`; Vaca = `giro>0 && st>=0.25`; Interrogação = `recente(diasSemVender<=21) || giro>0`; Abacaxi = resto. `st = giro/max(1,giro+estoque)`.
- **Desconto:** previsto (pct por item/loja) só em oportunidades+garimpo; manual (%) em todas; BCG/ABC/manual = só manual.
- **Loja = arte por loja** (respeita pct por loja). Geração PAUSED (inalterado). Ativação com confirm() + dry sem Graph (inalterado).
- **REST no coletor:** `sbGet(p)`/`sbPost(p,body,prefer)` com `H = { apikey: SK, Authorization: 'Bearer '+SK }`, `SK=process.env.SUPABASE_SERVICE_KEY`, base `URL+'/rest/v1'`. Edge Deno usa `createClient` (padrão fabrica-trigger).
- **Trigger/runner NÃO mudam** (repassam `params` cru; `itens` flui sozinho).

---

## File Structure

**Criar:**
- `db/migrations/018_fabrica_marcas_lojas.sql` — `fabrica_marcas` + colunas em `fabrica_lojas` + seed.
- `db/migrations/019_fabrica_remove_f1.sql` — dropa FK `fabrica_criativos.candidato_id`, `fabrica_candidatos`, `fabrica_rodadas`.
- `coletor/lib/classificacao-comercial.mjs` — `bcgClass()` + `faixaABC()`/ranking (extraído do Gestor).
- `coletor/lib/config-lojas.mjs` — `carregarMarcasELojas()` (lê `fabrica_marcas`+`fabrica_lojas` via sbGet) → resolve config por deposito.
- `supabase/functions/fabrica-candidatos/index.ts` — Edge lista viva.
- `src/ferramentas/meta-ads/use-candidatos.js` — composable que chama a Edge.

**Modificar:**
- `coletor/gestor-comercial.mjs` — importar `bcgClass` do lib (sem mudar comportamento).
- `coletor/subir-estudio.mjs`, `coletor/ativar-estudio.mjs` — ler marca/loja de `config-lojas.mjs`.
- `coletor/gerar-criativos.mjs` — modo `itens` + pct por item + legenda da marca.
- `src/ferramentas/meta-ads/painel-gerar.vue` — Gerar 2.0.
- `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`, `src/mapa-de-enderecos.js` — remover card/rota da F1.

**Remover:**
- `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, `coletor/fabrica-anuncios.mjs`.

---

## Task 1: Migration — `fabrica_marcas` + colunas de loja + seed

**Files:**
- Create: `db/migrations/018_fabrica_marcas_lojas.sql`

**Interfaces:**
- Produces: tabela `public.fabrica_marcas (id, nome, caption_template, ad_account, page_id, ig_id, account_id, ativo, created_at)`; colunas `public.fabrica_lojas.marca_id/whatsapp/geo_cities/canal_loja_id`; 1 marca seed + Tivoli/Dom Pedro vinculadas.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/018_fabrica_marcas_lojas.sql`:

```sql
-- 018_fabrica_marcas_lojas.sql — fundação multi-marca/multi-loja: config que era hardcoded vira dado.
CREATE TABLE IF NOT EXISTS public.fabrica_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  caption_template text NOT NULL DEFAULT '{desconto} em bolsas {marca} · chame a gente 💬',
  ad_account text NOT NULL,
  page_id text NOT NULL,
  ig_id text NOT NULL,
  account_id text NOT NULL,           -- accountId do meta-proxy
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fabrica_marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fab_marcas_read ON public.fabrica_marcas;
CREATE POLICY fab_marcas_read ON public.fabrica_marcas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS fab_marcas_srv ON public.fabrica_marcas;
CREATE POLICY fab_marcas_srv ON public.fabrica_marcas FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS marca_id uuid REFERENCES public.fabrica_marcas(id);
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS geo_cities jsonb;
ALTER TABLE public.fabrica_lojas ADD COLUMN IF NOT EXISTS canal_loja_id text;

-- Seed: marca atual (nome usado nas legendas) + IDs reais.
INSERT INTO public.fabrica_marcas (nome, ad_account, page_id, ig_id, account_id)
SELECT 'La Vessel', 'act_1197997517858139', '324679337390168', '17841462952561833', 'b6883e82-07cb-4f21-9fd7-ea7626786174'
WHERE NOT EXISTS (SELECT 1 FROM public.fabrica_marcas);

-- Vincula as lojas existentes à marca + preenche config de loja.
UPDATE public.fabrica_lojas l SET
  marca_id = (SELECT id FROM public.fabrica_marcas ORDER BY created_at LIMIT 1),
  whatsapp = v.whatsapp, geo_cities = v.geo::jsonb, canal_loja_id = v.canal
FROM (VALUES
  ('14888726315', '+5519971690502', '[267873,241913]', '205834140'),
  ('14888617206', '+5519999545112', '[247071]',        '205657609')
) AS v(deposito_id, whatsapp, geo, canal)
WHERE l.deposito_id = v.deposito_id;
```

- [ ] **Step 2: Aplicar** — Run: `cd /Users/erickmartins/iamundi/coletor && node run-migrations.mjs`
Expected: `aplicando 018_fabrica_marcas_lojas.sql ... ok`.

- [ ] **Step 3: Verificar** (MCP `execute_sql` ou SQL):
`select m.nome, m.ad_account, l.deposito_id, l.whatsapp, l.geo_cities, l.canal_loja_id from public.fabrica_lojas l join public.fabrica_marcas m on m.id=l.marca_id order by l.ordem;`
Expected: 2 linhas (Tivoli, Dom Pedro) com whatsapp/geo/canal preenchidos e a mesma marca.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/018_fabrica_marcas_lojas.sql
git commit -m "feat(fabrica): migration 018 — fabrica_marcas + config de loja (marca_id/whatsapp/geo/canal) + seed"
```

---

## Task 2: `lib/config-lojas.mjs` — resolver marca+loja da tabela

**Files:**
- Create: `coletor/lib/config-lojas.mjs`
- Test: `coletor/lib/config-lojas.test.mjs`

**Interfaces:**
- Produces:
  - `export function montarLegenda(caption_template, { desconto, marca })` → aplica os placeholders `{desconto}`/`{marca}` (pura).
  - `export async function carregarMarcasELojas(sbGet)` → `{ lojas: [{depositoId, nome, ativo, whatsapp, geoCities, canalLojaId, marca:{id,nome,captionTemplate,adAccount,pageId,igId,accountId}}], marcaAtiva }`. Recebe um `sbGet` injetado (o mesmo padrão do coletor) pra ser testável.

- [ ] **Step 1: Teste das funções**

Create `coletor/lib/config-lojas.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarLegenda, carregarMarcasELojas } from './config-lojas.mjs';

test('montarLegenda substitui placeholders', () => {
  assert.equal(montarLegenda('{desconto} em bolsas {marca} · chame', { desconto: '50% OFF', marca: 'La Vessel' }),
    '50% OFF em bolsas La Vessel · chame');
});

test('carregarMarcasELojas junta loja+marca via sbGet injetado', async () => {
  const fake = async (p) => p.startsWith('/fabrica_marcas')
    ? [{ id: 'm1', nome: 'La Vessel', caption_template: 'x', ad_account: 'act_1', page_id: 'P', ig_id: 'I', account_id: 'A', ativo: true }]
    : [{ deposito_id: 'd1', nome: 'Tivoli', ativo: true, marca_id: 'm1', whatsapp: '+55', geo_cities: [1, 2], canal_loja_id: 'c1' }];
  const r = await carregarMarcasELojas(fake);
  assert.equal(r.lojas[0].marca.adAccount, 'act_1');
  assert.equal(r.lojas[0].whatsapp, '+55');
  assert.equal(r.marcaAtiva.nome, 'La Vessel');
});
```

- [ ] **Step 2: Rodar e ver falhar** — Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/config-lojas.test.mjs` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Create `coletor/lib/config-lojas.mjs`:

```js
// Resolve config de marca/loja da tabela (substitui as constantes CFG/LOJAS hardcoded).
export function montarLegenda(template, { desconto, marca }) {
  return String(template || '').replace(/\{desconto\}/g, desconto ?? '').replace(/\{marca\}/g, marca ?? '');
}

export async function carregarMarcasELojas(sbGet) {
  const marcas = await sbGet('/fabrica_marcas?select=id,nome,caption_template,ad_account,page_id,ig_id,account_id,ativo');
  const lojasRaw = await sbGet('/fabrica_lojas?select=deposito_id,nome,ativo,ordem,marca_id,whatsapp,geo_cities,canal_loja_id&order=ordem');
  const marcaById = Object.fromEntries(marcas.map((m) => [m.id, {
    id: m.id, nome: m.nome, captionTemplate: m.caption_template, adAccount: m.ad_account,
    pageId: m.page_id, igId: m.ig_id, accountId: m.account_id, ativo: m.ativo,
  }]));
  const lojas = lojasRaw.map((l) => ({
    depositoId: l.deposito_id, nome: l.nome, ativo: l.ativo, ordem: l.ordem,
    whatsapp: l.whatsapp, geoCities: l.geo_cities || [], canalLojaId: l.canal_loja_id,
    marca: marcaById[l.marca_id] || null,
  }));
  const marcaAtiva = marcas.find((m) => m.ativo) ? marcaById[marcas.find((m) => m.ativo).id] : null;
  return { lojas, marcaAtiva };
}
```

- [ ] **Step 4: Rodar e ver passar** — Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/config-lojas.test.mjs` → PASS (2).

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/config-lojas.mjs coletor/lib/config-lojas.test.mjs
git commit -m "feat(fabrica): lib/config-lojas (resolve marca+loja da tabela + montarLegenda)"
```

---

## Task 3: `subir-estudio`/`ativar-estudio` leem config da tabela

**Files:**
- Modify: `coletor/subir-estudio.mjs`, `coletor/ativar-estudio.mjs`

**Interfaces:**
- Consumes: `carregarMarcasELojas`/`montarLegenda` de `./lib/config-lojas.mjs`.
- Produces: comportamento idêntico ao atual, mas ACT/PAGE/IG/account/legenda vêm da marca e whatsapp/geo/canal da loja (por `deposito_id`), não das constantes.

- [ ] **Step 1: Refatorar `subir-estudio.mjs`**

Em `coletor/subir-estudio.mjs`: no início de `run()`, carregar `const { lojas } = await carregarMarcasELojas(sbGet)` e, para cada `deposito` usado, resolver a loja/marca dessa lista em vez de `CFG`/`LOJAS`. Trocar `CFG.ACT/PAGE/IG/ACCOUNT_ID` por `loja.marca.adAccount/pageId/igId/accountId`, `loja.whatsapp`, `loja.geoCities`. Trocar `CAPTION_PADRAO` por `montarLegenda(loja.marca.captionTemplate, { desconto: '<pct>% OFF', marca: loja.marca.nome })`. Remover as constantes `CFG`/`LOJAS`/`CAPTION_PADRAO` que ficarem órfãs.

- [ ] **Step 2: Refatorar `ativar-estudio.mjs`**

Em `coletor/ativar-estudio.mjs`: `CFG.ACCOUNT_ID` (usado no meta-proxy) passa a vir da marca da loja resolvida via `carregarMarcasELojas`. (A ativação só faz POST status ACTIVE; precisa do `accountId` correto por marca.)

- [ ] **Step 3: Smoke em dry**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test ativar-estudio.test.mjs subir-estudio.test.mjs`
Expected: PASS (os testes existentes de dry guard continuam passando — dry não chama a tabela nem o Graph). Se algum teste tocava `CFG`, ajustar o teste pra o novo shape.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/subir-estudio.mjs coletor/ativar-estudio.mjs
git commit -m "refactor(fabrica): subir/ativar-estudio leem marca+loja de fabrica_marcas/lojas (sem hardcode)"
```

---

## Task 4: `lib/classificacao-comercial.mjs` (BCG + ABC compartilhado)

**Files:**
- Create: `coletor/lib/classificacao-comercial.mjs`
- Test: `coletor/lib/classificacao-comercial.test.mjs`
- Modify: `coletor/gestor-comercial.mjs` (importar `bcgClass`)

**Interfaces:**
- Produces:
  - `export function bcgClass({ estoqueLoja, giro, diasSemVender })` → `'Estrela'|'Vaca leiteira'|'Interrogação'|'Abacaxi'` (idêntico ao `_bcgClass` atual).
  - `export function faixaABC(itens)` → recebe `[{sku, faturamento}]`, ordena desc, marca faixa por faturamento acumulado (A ≤80%, B ≤95%, C resto), retorna `[{sku, faturamento, faixa}]`.

- [ ] **Step 1: Teste**

Create `coletor/lib/classificacao-comercial.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bcgClass, faixaABC } from './classificacao-comercial.mjs';

test('bcgClass cobre os 4 quadrantes', () => {
  assert.equal(bcgClass({ giro: 10, estoqueLoja: 2, diasSemVender: 1 }), 'Estrela');   // st=0.83
  assert.equal(bcgClass({ giro: 5, estoqueLoja: 12, diasSemVender: 1 }), 'Vaca leiteira'); // st=0.29
  assert.equal(bcgClass({ giro: 0, estoqueLoja: 5, diasSemVender: 10 }), 'Interrogação'); // recente
  assert.equal(bcgClass({ giro: 0, estoqueLoja: 5, diasSemVender: 90 }), 'Abacaxi');
});

test('faixaABC marca A/B/C por faturamento acumulado', () => {
  const r = faixaABC([{ sku: 'x', faturamento: 80 }, { sku: 'y', faturamento: 15 }, { sku: 'z', faturamento: 5 }]);
  assert.equal(r.find((i) => i.sku === 'x').faixa, 'A');
  assert.equal(r.find((i) => i.sku === 'y').faixa, 'B');
  assert.equal(r.find((i) => i.sku === 'z').faixa, 'C');
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd coletor && node --test lib/classificacao-comercial.test.mjs` → FAIL.

- [ ] **Step 3: Implementar** (copiar a lógica exata de `gestor-comercial.mjs:173-183`)

Create `coletor/lib/classificacao-comercial.mjs`:

```js
export function bcgClass({ estoqueLoja, giro, diasSemVender }) {
  const estoque = Number(estoqueLoja) || 0;
  const g = Number(giro) || 0;
  const diasN = parseInt(diasSemVender, 10);
  const recente = Number.isFinite(diasN) && diasN <= 21;
  const st = g / Math.max(1, g + estoque);
  if (g > 0 && st >= 0.5) return 'Estrela';
  if (g > 0 && st >= 0.25) return 'Vaca leiteira';
  if (recente || g > 0) return 'Interrogação';
  return 'Abacaxi';
}

export function faixaABC(itens) {
  const ord = [...itens].sort((a, b) => (Number(b.faturamento) || 0) - (Number(a.faturamento) || 0));
  const total = ord.reduce((s, i) => s + (Number(i.faturamento) || 0), 0) || 1;
  let acc = 0;
  return ord.map((i) => {
    acc += Number(i.faturamento) || 0;
    const p = acc / total;
    return { ...i, faixa: p <= 0.8 ? 'A' : p <= 0.95 ? 'B' : 'C' };
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `cd coletor && node --test lib/classificacao-comercial.test.mjs` → PASS (2).

- [ ] **Step 5: Gestor importa o lib (sem mudar comportamento)**

Em `coletor/gestor-comercial.mjs`: substituir a função local `_bcgClass` (linhas ~173-183) por `import { bcgClass } from './lib/classificacao-comercial.mjs';` e trocar as chamadas `_bcgClass(it)` por `bcgClass(it)` (o `it` já tem `estoqueLoja`/`giro`/`diasSemVender`). Rodar o teste do gestor se existir; senão, `node -c gestor-comercial.mjs` (parse) + conferir que os campos batem.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/classificacao-comercial.mjs coletor/lib/classificacao-comercial.test.mjs coletor/gestor-comercial.mjs
git commit -m "refactor(fabrica): extrai lib/classificacao-comercial (bcgClass + faixaABC) e reusa no Gestor"
```

---

## Task 5: `gerar-criativos.mjs` — modo lista explícita + pct por item

**Files:**
- Modify: `coletor/gerar-criativos.mjs`
- Test: `coletor/gerar-criativos-itens.test.mjs`

**Interfaces:**
- Consumes: `blingProdutos` (já usado), `carregarMarcasELojas`/`montarLegenda`.
- Produces: `run({ itens: [{sku, deposito, pct}], ...})` gera exatamente esses produtos (× loja), com o `pct` de cada item; a legenda vem da marca. Retorno `{ campanhaId, criativos }` inalterado.

- [ ] **Step 1: Teste do parsing/merge dos itens (função pura)**

Extrair a montagem de `cands` a partir de `itens` numa função pura `export function candsDeItens(itens, precoPorCodigo)`:

Create `coletor/gerar-criativos-itens.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candsDeItens } from './gerar-criativos.mjs';

test('candsDeItens resolve preço via mapa e mantém pct/deposito por item', () => {
  const r = candsDeItens(
    [{ sku: 'ABC', deposito: 'd1', pct: 30 }, { sku: 'XYZ', deposito: 'd2', pct: 50 }],
    { ABC: 449.9, XYZ: 200 });
  assert.equal(r.length, 2);
  assert.deepEqual({ sku: r[0].sku, preco: r[0].preco, deposito_id: r[0].deposito_id, pct: r[0].pct, id: r[0].id },
    { sku: 'ABC', preco: 449.9, deposito_id: 'd1', pct: 30, id: null });
});

test('candsDeItens pula item sem preço', () => {
  assert.equal(candsDeItens([{ sku: 'NOPE', deposito: 'd1', pct: 10 }], {}).length, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd coletor && node --test gerar-criativos-itens.test.mjs` → FAIL (sem export `candsDeItens`).

- [ ] **Step 3: Implementar `candsDeItens` + ramo `itens` + pct por item**

Em `coletor/gerar-criativos.mjs`:

```js
// Modo lista explícita (Estúdio): resolve nome/preço via mapa Bling (codigo.toUpperCase()->preco),
// carregando o pct e o deposito de cada item. id=null (não há candidato). Pula sem preço.
export function candsDeItens(itens, precoPorCodigo) {
  return (itens || []).map((it) => {
    const preco = precoPorCodigo[String(it.sku).toUpperCase()];
    if (preco == null) return null;
    return { id: null, sku: it.sku, nome: it.sku, preco, deposito_id: it.deposito, pct: it.pct };
  }).filter(Boolean);
}
```

No `run()`: adicionar `itens = null` na desestruturação; ANTES do ramo estrela (`if (ESTRELA_CANAL)`), inserir:

```js
if (itens?.length) {
  const token = await loginServico();
  const prodMap = await blingProdutos(token);          // id -> {nome, codigo, preco}
  const precoPorCodigo = {};
  for (const p of Object.values(prodMap)) if (p.codigo) precoPorCodigo[String(p.codigo).toUpperCase()] = p.preco;
  cands = candsDeItens(itens, precoPorCodigo);
}
```

No loop de geração (`for (const cand of produtos)`, ~L164-181): passar o pct do item pra `variacoesProduto`. Alterar `variacoesProduto(cand, campanha, opts)` para aceitar `variacoesProduto(cand, campanha, opts, cand.pct ?? campanha.desconto_pct)` e, dentro dela, usar esse pct efetivo no cálculo De/Por (em vez de `campanha.desconto_pct` fixo). Legenda: onde a copy usa marca, resolver via `carregarMarcasELojas` + `montarLegenda` (marca da loja do `deposito_id`). Manter o comportamento atual quando `itens` não vem.

- [ ] **Step 4: Rodar e ver passar** — `cd coletor && node --test gerar-criativos-itens.test.mjs` → PASS (2).

- [ ] **Step 5: Sanidade CLI (não quebrou o modo antigo)** — `cd coletor && node --import ./lib/curl-fetch.mjs gerar-criativos.mjs --dry --limite 0` → roda sem erro.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs coletor/gerar-criativos-itens.test.mjs
git commit -m "feat(fabrica): gerar-criativos modo lista explícita (itens + pct por item + legenda da marca)"
```

---

## Task 6: Edge `fabrica-candidatos` (lista viva)

**Files:**
- Create: `supabase/functions/fabrica-candidatos/index.ts`
- Create: `src/ferramentas/meta-ads/use-candidatos.js`

**Interfaces:**
- Produces: `POST {lojas:[depositoId], fonte, filtros}` → `{ candidatos: [{ sku, nome, categoria, porLoja: { <depositoId>: { preco, pctPrevisto, precoComDesconto, estoque } } }] }`. Gate `role='admin' OR permissions ? 'meta.fabrica'`. `useCandidatos()` composable chama via `sbClient.functions.invoke`.

- [ ] **Step 1: Implementar a Edge** (padrão auth do fabrica-trigger)

Create `supabase/functions/fabrica-candidatos/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
// BCG idêntico ao lib (Deno não importa .mjs do coletor; espelho fiel — coberto por teste do lib).
function bcgClass(e: number, g: number, d: number): string {
  const st = g / Math.max(1, g + e); const recente = Number.isFinite(d) && d <= 21;
  if (g > 0 && st >= 0.5) return "Estrela";
  if (g > 0 && st >= 0.25) return "Vaca leiteira";
  if (recente || g > 0) return "Interrogação";
  return "Abacaxi";
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ud } = await uc.auth.getUser();
    if (!ud?.user) return json({ error: "nao_autenticado" }, 401);
    const { data: prof } = await sb.from("profiles").select("role, permissions").eq("id", ud.user.id).single();
    if (!(prof && (prof.role === "admin" || (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, "meta.fabrica"))))) return json({ error: "sem_permissao" }, 403);

    const { lojas = [], fonte, filtros = {} } = await req.json();
    // fabrica_lojas: deposito -> {nome, canal_loja_id}
    const { data: lojasCfg } = await sb.from("fabrica_lojas").select("deposito_id, nome, canal_loja_id").in("deposito_id", lojas);
    const cfgByDep: Record<string, any> = Object.fromEntries((lojasCfg || []).map((l) => [l.deposito_id, l]));

    let candidatos: any[] = [];
    if (fonte === "oportunidades" || fonte === "garimpo") {
      const { data: brief } = await sb.from("gestao_comercial_briefings").select("dados_json").order("rodada", { ascending: false }).limit(1).single();
      const blocos = (brief?.dados_json?.[fonte] || []) as any[]; // [{loja, itens[]}]
      const acc: Record<string, any> = {};
      for (const bloco of blocos) {
        const dep = Object.keys(cfgByDep).find((d) => cfgByDep[d].nome?.toLowerCase().includes(String(bloco.loja).toLowerCase())) ;
        if (!dep) continue;
        for (const it of bloco.itens || []) {
          acc[it.sku] ??= { sku: it.sku, nome: it.descricao, categoria: it.categoria, porLoja: {} };
          acc[it.sku].porLoja[dep] = { preco: it.precoOriginal, pctPrevisto: it.pct, precoComDesconto: it.precoComDesconto, estoque: it.estoqueLoja };
        }
      }
      candidatos = Object.values(acc);
    } else if (fonte === "bcg" || fonte === "abc") {
      // vendas (faturamento/giro) + estoque por loja a partir de gc_vendas_item/gc_estoque_item
      const canais = lojas.map((d: string) => cfgByDep[d]?.canal_loja_id).filter(Boolean);
      const { data: vendas } = await sb.from("gc_vendas_item").select("sku, produto, categoria, unidades, faturamento, canal_loja_id").in("canal_loja_id", canais);
      const { data: estoque } = await sb.from("gc_estoque_item").select("sku, saldo, deposito_id").in("deposito_id", lojas);
      const estByDepSku: Record<string, number> = {}; for (const e of estoque || []) estByDepSku[e.deposito_id + "|" + e.sku] = e.saldo;
      const fatBySku: Record<string, any> = {}; for (const v of vendas || []) { fatBySku[v.sku] ??= { sku: v.sku, nome: v.produto, categoria: v.categoria, faturamento: 0, unidades: 0 }; fatBySku[v.sku].faturamento += Number(v.faturamento) || 0; fatBySku[v.sku].unidades += Number(v.unidades) || 0; }
      let arr = Object.values(fatBySku) as any[];
      if (fonte === "abc") {
        arr.sort((a, b) => b.faturamento - a.faturamento);
        const total = arr.reduce((s, i) => s + i.faturamento, 0) || 1; let acc = 0;
        arr = arr.map((i) => { acc += i.faturamento; const p = acc / total; return { ...i, faixa: p <= 0.8 ? "A" : p <= 0.95 ? "B" : "C" }; });
        if (filtros.faixa) arr = arr.filter((i) => i.faixa === filtros.faixa);
      } else { // bcg: quadrante por loja (usa estoque da loja + unidades como giro proxy)
        const quads: string[] = filtros.quadrantes || ["Estrela", "Vaca leiteira", "Interrogação"];
        arr = arr.filter((i) => lojas.some((d: string) => quads.includes(bcgClass(estByDepSku[d + "|" + i.sku] || 0, i.unidades || 0, 0))));
        if (filtros.categoria) arr = arr.filter((i) => (i.categoria || "").toLowerCase().includes(String(filtros.categoria).toLowerCase()));
      }
      candidatos = arr.map((i) => ({ sku: i.sku, nome: i.nome, categoria: i.categoria, porLoja: Object.fromEntries(lojas.map((d: string) => [d, { preco: null, pctPrevisto: null, precoComDesconto: null, estoque: estByDepSku[d + "|" + i.sku] || 0 }])) }));
    } else if (fonte === "manual") {
      const termo = String(filtros.termo || "").toLowerCase();
      const { data: vendas } = await sb.from("gc_vendas_item").select("sku, produto, categoria").in("canal_loja_id", lojas.map((d: string) => cfgByDep[d]?.canal_loja_id).filter(Boolean));
      const uniq: Record<string, any> = {}; for (const v of vendas || []) if (!termo || (v.produto || "").toLowerCase().includes(termo) || (v.sku || "").toLowerCase().includes(termo)) uniq[v.sku] ??= { sku: v.sku, nome: v.produto, categoria: v.categoria, porLoja: {} };
      candidatos = Object.values(uniq);
    } else return json({ error: "fonte_invalida" }, 400);

    return json({ candidatos });
  } catch (e) { return json({ error: String(e) }, 500); }
});
```

> Nota: preço/estoque "ao vivo" do Bling (BCG/ABC/manual) fica como enriquecimento na geração (o `gerar-criativos` já resolve preço via Bling). A Edge devolve preço `null` nesses casos e o painel mostra "—" (o preço final aparece no criativo). Oportunidades/garimpo já trazem preço do briefing.

- [ ] **Step 2: Composable**

Create `src/ferramentas/meta-ads/use-candidatos.js`:

```js
import { ref } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
export function useCandidatos() {
  const candidatos = ref([]); const carregando = ref(false); const erro = ref(null)
  async function buscar({ lojas, fonte, filtros }) {
    carregando.value = true; erro.value = null
    const { data, error } = await sbClient.functions.invoke('fabrica-candidatos', { body: { lojas, fonte, filtros } })
    carregando.value = false
    if (error) { erro.value = error.message; candidatos.value = []; return }
    candidatos.value = data?.candidatos || []
  }
  return { candidatos, carregando, erro, buscar }
}
```

- [ ] **Step 3: Deploy + smoke** (controller/MCP)

Deploy `fabrica-candidatos` (verify_jwt=true) via MCP Supabase. Smoke (com JWT admin): `invoke fabrica-candidatos { lojas:['14888726315'], fonte:'oportunidades', filtros:{} }` → `{candidatos:[...]}` (ou lista vazia se não há briefing) e 401 sem token. `build`: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -4` (composable compila).

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-candidatos/index.ts src/ferramentas/meta-ads/use-candidatos.js
git commit -m "feat(fabrica): Edge fabrica-candidatos (lista viva por fonte) + composable useCandidatos"
```

---

## Task 7: Painel Gerar 2.0 + remoção da F1

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-gerar.vue`
- Modify: `src/mapa-de-enderecos.js`, `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`
- Remove: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, `coletor/fabrica-anuncios.mjs`
- Create: `db/migrations/019_fabrica_remove_f1.sql`

**Interfaces:**
- Consumes: `useCandidatos`, `useJobStatus`, `sbClient`. Lê lojas ativas de `fabrica_lojas`.
- Produces: passo Gerar com loja(s)→fonte→filtros→lista→curadoria→desconto; ao Gerar, dispara `fabrica-trigger` tipo `gerar` com `params.itens=[{sku,deposito,pct}]`.

- [ ] **Step 1: Reescrever `painel-gerar.vue`** (mantém emit `gerado` + guard job_id)

Substituir o conteúdo por (resumido — o implementador expande o template seguindo o padrão dos outros painéis e o `estudio.css` `.fest`):

```vue
<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { useJobStatus } from './use-job-status.js'
import { useCandidatos } from './use-candidatos.js'
const emit = defineEmits(['gerado'])
const lojas = ref([])                 // fabrica_lojas ativas
const sel = reactive({ lojas: [], fonte: 'oportunidades', filtros: {}, descontoModo: 'previsto', pctManual: 50 })
const { candidatos, carregando, buscar } = useCandidatos()
const marcados = ref({})              // sku -> bool
const { job, start } = useJobStatus()
onMounted(async () => { lojas.value = await sb('fabrica_lojas?select=deposito_id,nome&ativo=eq.true&order=ordem') })
const previstoDisponivel = computed(() => ['oportunidades', 'garimpo'].includes(sel.fonte))
async function carregarLista() {
  await buscar({ lojas: sel.lojas, fonte: sel.fonte, filtros: sel.filtros })
  marcados.value = Object.fromEntries(candidatos.value.map((c) => [c.sku, true]))   // pré-marca automáticas
}
function itensEscolhidos() {
  const out = []
  for (const c of candidatos.value) {
    if (!marcados.value[c.sku]) continue
    for (const dep of sel.lojas) {
      const info = c.porLoja[dep]; if (!info) continue
      const pct = (sel.descontoModo === 'previsto' && previstoDisponivel.value && info.pctPrevisto != null) ? info.pctPrevisto : sel.pctManual
      out.push({ sku: c.sku, deposito: dep, pct })
    }
  }
  return out
}
async function gerar() {
  const itens = itensEscolhidos()
  if (!itens.length) return alert('Marque ao menos um produto')
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'gerar', params: { itens } } })
  if (error) return alert('Falha: ' + error.message)
  if (!data?.job_id) return alert('Sem job_id na resposta')
  start(data.job_id)
}
import { watch } from 'vue'
watch(job, (j) => { if (j?.status === 'concluido' && j.resultado?.campanhaId) emit('gerado', j.resultado.campanhaId) })
</script>
<template>
  <div class="fest">
    <!-- lojas (checkbox, dinâmico) -->
    <label v-for="l in lojas" :key="l.deposito_id"><input type="checkbox" :value="l.deposito_id" v-model="sel.lojas"> {{ l.nome }}</label>
    <!-- fonte -->
    <select v-model="sel.fonte"><option value="oportunidades">Oportunidades da semana</option><option value="garimpo">Garimpo</option><option value="bcg">Grade BCG</option><option value="abc">Curva ABC</option><option value="manual">Manual</option></select>
    <!-- filtros conforme fonte -->
    <template v-if="sel.fonte==='bcg'">
      <label v-for="q in ['Estrela','Vaca leiteira','Interrogação']" :key="q"><input type="checkbox" :value="q" v-model="(sel.filtros.quadrantes ||= [])"> {{ q }}</label>
      <input v-model="sel.filtros.categoria" placeholder="categoria (opcional)">
    </template>
    <select v-else-if="sel.fonte==='abc'" v-model="sel.filtros.faixa"><option value="A">Faixa A</option><option value="B">B</option><option value="C">C</option></select>
    <input v-else-if="sel.fonte==='manual'" v-model="sel.filtros.termo" placeholder="buscar nome/SKU">
    <button :disabled="!sel.lojas.length" @click="carregarLista">Ver produtos</button>
    <!-- desconto -->
    <div>
      <label v-if="previstoDisponivel"><input type="radio" value="previsto" v-model="sel.descontoModo"> Usar desconto previsto do Gestor</label>
      <label><input type="radio" value="manual" v-model="sel.descontoModo"> % manual <input type="number" v-model.number="sel.pctManual" :disabled="sel.descontoModo!=='manual'"></label>
    </div>
    <!-- lista viva -->
    <p v-if="carregando">Carregando…</p>
    <table v-else-if="candidatos.length">
      <tr v-for="c in candidatos" :key="c.sku">
        <td><input type="checkbox" v-model="marcados[c.sku]"></td>
        <td>{{ c.nome }} <small>{{ c.categoria }}</small></td>
        <td v-for="dep in sel.lojas" :key="dep">
          <template v-if="c.porLoja[dep]">{{ c.porLoja[dep].estoque }} un<span v-if="c.porLoja[dep].pctPrevisto!=null"> · {{ c.porLoja[dep].pctPrevisto }}%</span></template>
          <template v-else>—</template>
        </td>
      </tr>
    </table>
    <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="gerar">Gerar criativos</button>
    <p v-if="job">Status: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
  </div>
</template>
```

- [ ] **Step 2: Remover a F1 (front)**

- `src/mapa-de-enderecos.js`: remover a linha da rota `/fabrica-anuncios`.
- `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`: remover o card da Fábrica F1 (manter só o card do Estúdio; se o rótulo dele não for "Estúdio de Criativos", renomear).
- Deletar `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`.
- Deletar `coletor/fabrica-anuncios.mjs`.
- Grep de sanidade: `grep -rn "fabrica-anuncios\|tela-de-fabrica-de-anuncios\|fabrica_candidatos\|fabrica_rodadas" src/ coletor/` → só pode sobrar em docs/migrations, não em código vivo.

- [ ] **Step 3: Migration de remoção do banco**

Create `db/migrations/019_fabrica_remove_f1.sql`:

```sql
-- 019_fabrica_remove_f1.sql — aposenta a F1: candidatos/rodadas não são mais usados (modo lista).
ALTER TABLE public.fabrica_criativos DROP COLUMN IF EXISTS candidato_id;  -- remove a FK -> fabrica_candidatos
DROP TABLE IF EXISTS public.fabrica_candidatos;                            -- CASCADE das policies
DROP TABLE IF EXISTS public.fabrica_rodadas;
```

Aplicar: `cd coletor && node run-migrations.mjs`.

- [ ] **Step 4: Build + smoke**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → build limpo (a tela removida não é mais referenciada; o painel Gerar 2.0 compila). Smoke manual: abrir `/fabrica-estudio` como admin → escolher loja + fonte → "Ver produtos" lista → marcar → Gerar dispara job. `/fabrica-anuncios` não existe mais.

- [ ] **Step 5: Commit + push**

```bash
cd /Users/erickmartins/iamundi
git add -A
git commit -m "feat(fabrica): painel Gerar 2.0 (fonte/filtros/lista viva/curadoria/desconto) + remove F1 (tela/rota/card/robô + migration 019)"
git push origin main
```

---

## Testes (resumo por camada)

- **Pure/logic (node:test):** `config-lojas` (montarLegenda + carregarMarcasELojas com sbGet fake), `classificacao-comercial` (bcgClass 4 quadrantes + faixaABC), `gerar-criativos` (candsDeItens: preço via mapa, pct/deposito por item, pula sem preço).
- **Edge:** `fabrica-candidatos` smoke via invoke (cada fonte devolve shape; gate 401/403).
- **DB:** migration 018 (marca+loja seed), 019 (drop sem quebrar FK).
- **Refactor sem regressão:** `subir/ativar-estudio` testes de dry seguem verdes; Gestor parseia após trocar `_bcgClass` pelo lib.
- **UI:** `vite build` por task + smoke manual do fluxo Gerar 2.0.
- **Config por tabela:** inserir loja fake ativa → aparece no seletor; a legenda usa nome de marca da tabela.

## Fora do plano (spec: fora de escopo)

- Seletor de marca na UI (fase futura, quando houver 2ª marca).
- Preço ao vivo do Bling na Edge (fica no enriquecimento da geração).
- Canais não-Meta.

## Sequência (dependências)

1 (migration marca/loja) → 2 (config-lojas lib) → 3 (subir/ativar leem tabela). 4 (classificacao lib) independe de 1-3. 5 (gerar modo itens) depende de 2 (legenda). 6 (Edge candidatos) depende de 4 (lógica BCG/ABC). 7 (painel + remoção) depende de 5 e 6. Ordem de execução: **1 → 2 → 3 → 4 → 5 → 6 → 7**.
