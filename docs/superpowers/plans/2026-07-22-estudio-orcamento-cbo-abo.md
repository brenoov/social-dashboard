# Editor de orçamento CBO/ABO por loja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No passo Subir do Estúdio (destino "nova"), deixar o usuário definir orçamento **por loja** — modo ABO/CBO, tipo Diário/Total, valor em R$, e datas (se Total).

**Architecture:** Uma função PURA (`orcamentoMeta`) traduz a config de orçamento nos campos de budget do Meta (campanha vs conjunto). `payloadCampanhaAdset` mescla esses campos; o valor flui da UI (`painel-subir.vue`, snapshot por loja igual o público) → `destino.lojas[]` → `run()` → `criarCampanhaNova` → `payloadCampanhaAdset`. Uma lógica de formulário pura no front (`orcamento-form.js`) converte R$→centavos e valida. Os 4 combos são validados AO VIVO em PAUSED antes de fechar.

**Tech Stack:** Node ESM (`node:test`), Vue 3 (Composition API, `.vue`), Meta Marketing API (via `meta-proxy`).

## Global Constraints

- **Money-path:** tudo sobe **PAUSED**; nunca apagar/pausar ativos; limpar campanhas de teste depois.
- **Retrocompat byte-idêntico:** Subir sem tocar no orçamento = ABO/Diário/`CFG_ADSET.DAILY_BUDGET` (5000) = payload idêntico ao de hoje.
- **Valores em centavos** no backend/payload; a UI trabalha em R$ e converte.
- **Copy literal em PT, sem jargão solto** (público leigo).
- **UI responsiva/full-bleed** como o resto do painel.
- **Só destino "nova"** (destino "existente" fica fora de escopo).
- Escopo: `feat/estudio-orcamento-cbo-abo` (branch já criada a partir de `main`).

---

### Task 1: Helper puro `orcamentoMeta` (tradução p/ campos de budget do Meta)

**Files:**
- Create: `coletor/lib/orcamento.mjs`
- Test: `coletor/lib/orcamento.test.mjs`

**Interfaces:**
- Produces:
  - `normalizarOrcamento(orcamento, defaultDaily = 5000)` → `{ modo:'ABO'|'CBO', tipo:'diario'|'total', valor:<centavos>, inicio?:string, fim?:string }`
  - `orcamentoMeta(orcamento, defaultDaily = 5000)` → `{ campaign:{...}, adset:{...} }` (só os campos de budget/agendamento a mesclar)

- [ ] **Step 1: Write the failing test**

```js
// coletor/lib/orcamento.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOrcamento, orcamentoMeta } from './orcamento.mjs';

test('normalizarOrcamento: sem config -> ABO/diario/default (retrocompat)', () => {
  assert.deepEqual(normalizarOrcamento(null, 5000), { modo: 'ABO', tipo: 'diario', valor: 5000 });
  assert.deepEqual(normalizarOrcamento(undefined), { modo: 'ABO', tipo: 'diario', valor: 5000 });
});

test('normalizarOrcamento: preenche defaults de campos faltando', () => {
  assert.deepEqual(normalizarOrcamento({ valor: 8000 }, 5000), { modo: 'ABO', tipo: 'diario', valor: 8000 });
});

test('orcamentoMeta ABO diario -> daily_budget no adset, nada na campanha', () => {
  const r = orcamentoMeta({ modo: 'ABO', tipo: 'diario', valor: 7000 }, 5000);
  assert.deepEqual(r, { campaign: {}, adset: { daily_budget: 7000 } });
});

test('orcamentoMeta ABO total -> lifetime_budget + datas no adset', () => {
  const r = orcamentoMeta({ modo: 'ABO', tipo: 'total', valor: 30000, inicio: '2026-08-01T00:00:00-03:00', fim: '2026-08-15T23:59:59-03:00' }, 5000);
  assert.deepEqual(r, { campaign: {}, adset: { lifetime_budget: 30000, start_time: '2026-08-01T00:00:00-03:00', end_time: '2026-08-15T23:59:59-03:00' } });
});

test('orcamentoMeta CBO diario -> daily_budget na campanha, nada no adset', () => {
  const r = orcamentoMeta({ modo: 'CBO', tipo: 'diario', valor: 9000 }, 5000);
  assert.deepEqual(r, { campaign: { daily_budget: 9000 }, adset: {} });
});

test('orcamentoMeta CBO total -> lifetime_budget na campanha, datas no adset', () => {
  const r = orcamentoMeta({ modo: 'CBO', tipo: 'total', valor: 50000, inicio: 'I', fim: 'F' }, 5000);
  assert.deepEqual(r, { campaign: { lifetime_budget: 50000 }, adset: { start_time: 'I', end_time: 'F' } });
});

test('orcamentoMeta sem config -> ABO/diario/default (byte-idêntico ao de hoje)', () => {
  assert.deepEqual(orcamentoMeta(null, 5000), { campaign: {}, adset: { daily_budget: 5000 } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test coletor/lib/orcamento.test.mjs`
Expected: FAIL — `Cannot find module './orcamento.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// coletor/lib/orcamento.mjs
// Traduz a config de orçamento do Estúdio (por loja) nos campos de budget do Meta.
// orcamento = { modo:'ABO'|'CBO', tipo:'diario'|'total', valor:<centavos>, inicio?, fim? }.
// ABO = orçamento no CONJUNTO; CBO = orçamento na CAMPANHA (a Meta divide entre conjuntos).
// Total (lifetime) exige start_time/end_time (sempre no adset — pacing do conjunto).
// Sem config -> ABO/diario/defaultDaily = comportamento atual (retrocompat byte-idêntico).

export function normalizarOrcamento(orcamento, defaultDaily = 5000) {
  if (!orcamento) return { modo: 'ABO', tipo: 'diario', valor: defaultDaily };
  return {
    modo: orcamento.modo === 'CBO' ? 'CBO' : 'ABO',
    tipo: orcamento.tipo === 'total' ? 'total' : 'diario',
    valor: orcamento.valor ?? defaultDaily,
    ...(orcamento.inicio !== undefined ? { inicio: orcamento.inicio } : {}),
    ...(orcamento.fim !== undefined ? { fim: orcamento.fim } : {}),
  };
}

export function orcamentoMeta(orcamento, defaultDaily = 5000) {
  const o = normalizarOrcamento(orcamento, defaultDaily);
  const campaign = {};
  const adset = {};
  const alvo = o.modo === 'CBO' ? campaign : adset;
  if (o.tipo === 'total') {
    alvo.lifetime_budget = o.valor;
    adset.start_time = o.inicio;   // datas SEMPRE no adset (pacing do conjunto), mesmo em CBO
    adset.end_time = o.fim;
  } else {
    alvo.daily_budget = o.valor;
  }
  return { campaign, adset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test coletor/lib/orcamento.test.mjs`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add coletor/lib/orcamento.mjs coletor/lib/orcamento.test.mjs
git commit -m "feat(estudio): helper puro orcamentoMeta (ABO/CBO x diario/total -> campos Meta)"
```

---

### Task 2: Ligar o orçamento no `subir-estudio.mjs` (payload + thread por loja)

**Files:**
- Modify: `coletor/subir-estudio.mjs` (payloadCampanhaAdset:165-186, criarCampanhaNova:189-202, lojasDoDestino:207-212, run loja-loop:296-301)
- Test: `coletor/subir-estudio.test.mjs`

**Interfaces:**
- Consumes: `orcamentoMeta` (Task 1).
- Produces: `payloadCampanhaAdset(row, marca, loja, cfg, publico=null, orcamento=null)`; `lojasDoDestino` retorna `[{ slug, publico, orcamento }]`.

- [ ] **Step 1: Write the failing tests** (adicionar ao final de `coletor/subir-estudio.test.mjs`)

```js
test('lojasDoDestino inclui orcamento por loja (default null)', () => {
  assert.deepEqual(
    lojasDoDestino({ lojas: [{ slug: 'tivoli', publico: { a: 1 }, orcamento: { modo: 'CBO', tipo: 'diario', valor: 9000 } }] }),
    [{ slug: 'tivoli', publico: { a: 1 }, orcamento: { modo: 'CBO', tipo: 'diario', valor: 9000 } }]);
  // slugs (retrocompat): orcamento null
  assert.deepEqual(lojasDoDestino({ lojas: ['dp'] }), [{ slug: 'dp', publico: null, orcamento: null }]);
});

test('payloadCampanhaAdset sem orcamento = ABO diario DAILY_BUDGET (retrocompat byte-idêntico)', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(adset.daily_budget, 5000);
  assert.ok(!('lifetime_budget' in adset));
  assert.ok(!('daily_budget' in campaign));
  assert.equal(campaign.is_adset_budget_sharing_enabled, false);
});

test('payloadCampanhaAdset CBO diario -> budget na campanha, adset sem budget', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG, null, { modo: 'CBO', tipo: 'diario', valor: 12000 });
  assert.equal(campaign.daily_budget, 12000);
  assert.ok(!('daily_budget' in adset));
});

test('payloadCampanhaAdset ABO total -> lifetime + datas no adset', () => {
  const row = { chave: 'engajamento', meta_objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG, null, { modo: 'ABO', tipo: 'total', valor: 30000, inicio: 'I', fim: 'F' });
  assert.equal(adset.lifetime_budget, 30000);
  assert.equal(adset.start_time, 'I');
  assert.equal(adset.end_time, 'F');
  assert.ok(!('daily_budget' in adset));
  assert.ok(!('lifetime_budget' in campaign));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test coletor/subir-estudio.test.mjs`
Expected: FAIL — `lojasDoDestino` sem `orcamento`; `campaign.daily_budget` undefined; etc.

- [ ] **Step 3: Implement — import + payloadCampanhaAdset**

No topo do arquivo, adicionar o import (junto aos outros `import ... from './lib/...`):

```js
import { orcamentoMeta } from './lib/orcamento.mjs';
```

Em `payloadCampanhaAdset` (linha 165), trocar a assinatura e o corpo. O `adset.daily_budget` fixo SAI e vira mescla do `orcamentoMeta`:

```js
export function payloadCampanhaAdset(row, marca, loja, cfg, publico = null, orcamento = null) {
  const campaign = {
    name: nomeCampanha(loja, row, cfg),
    objective: row.meta_objective,
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  };
  const adset = {
    name: nomeConjunto(loja, row),
    billing_event: row.billing_event || 'IMPRESSIONS',
    optimization_goal: row.optimization_goal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    targeting: montarTargeting(publico, loja),
  };
  const orc = orcamentoMeta(orcamento, cfg.DAILY_BUDGET);
  Object.assign(campaign, orc.campaign);
  Object.assign(adset, orc.adset);
  if (row.destination_type) adset.destination_type = row.destination_type;
  const po = montaPromotedObject(row.promoted_object_tipo, marca, loja);
  if (po) adset.promoted_object = po;
  return { campaign, adset };
}
```

- [ ] **Step 4: Implement — thread orcamento (lojasDoDestino, criarCampanhaNova, run)**

`lojasDoDestino` (linha 207) passa a carregar `orcamento`:

```js
export function lojasDoDestino(destino) {
  const arr = (destino?.lojas && destino.lojas.length) ? destino.lojas : (destino?.loja ? [destino.loja] : []);
  return arr.map((l) => (typeof l === 'string')
    ? { slug: l, publico: destino?.publico ?? null, orcamento: null }
    : { slug: l.slug, publico: (l.publico !== undefined ? l.publico : (destino?.publico ?? null)), orcamento: (l.orcamento ?? null) });
}
```

`criarCampanhaNova` (linha 189) recebe `orcamento` e repassa:

```js
async function criarCampanhaNova(loja, objetivoRow, publico = null, orcamento = null) {
  const { campaign: campaignPayload, adset: adsetPayload } = payloadCampanhaAdset(
    objetivoRow, MARCA, loja, { DAILY_BUDGET: CFG_ADSET.DAILY_BUDGET, DATA: CFG_ADSET.DATA_CAMPANHA }, publico, orcamento,
  );
  const campaign = await meta(`/${MARCA.adAccount}/campaigns`, campaignPayload, 'POST');
  if (campaign.status !== 200 || !campaign.d?.id) throw new Error(`POST /campaigns falhou (status ${campaign.status}): ${JSON.stringify(campaign.d).slice(0, 500)}`);
  const campaignId = campaign.d.id;
  const adset = await meta(`/${MARCA.adAccount}/adsets`, { ...adsetPayload, campaign_id: campaignId }, 'POST');
  if (adset.status !== 200 || !adset.d?.id) throw new Error(`POST /adsets falhou (status ${adset.status}): ${JSON.stringify(adset.d).slice(0, 500)}`);
  return { campaignId, adsets: [{ id: adset.d.id, name: adsetPayload.name, destinationType: objetivoRow.destination_type, whatsapp: loja.whatsapp }] };
}
```

No `run()` (linha 296), desestruturar `orcamento` e passar:

```js
    for (const { slug, publico, orcamento } of alvosLoja) {
      const loja = resolverLoja(lojas, slug);
      if (!loja || !loja.marca) throw new Error(`loja inválida p/ destino 'nova': ${slug} (use tivoli|dp)`);
      MARCA = loja.marca;
      const { campaignId: metaCampaignId, adsets } = await criarCampanhaNova(loja, objetivoRow, publico, orcamento);
      resultados.push(await subirNumaCampanha({ metaCampaignId, adsets, escolhidos, destino, campanhaId, lojaNome: loja.nome }));
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test coletor/subir-estudio.test.mjs`
Expected: PASS (todos os testes, inclusive os antigos — retrocompat).

- [ ] **Step 6: Commit**

```bash
git add coletor/subir-estudio.mjs coletor/subir-estudio.test.mjs
git commit -m "feat(estudio): orcamento por loja fluindo ate o payload (payloadCampanhaAdset + thread)"
```

---

### Task 3: Lógica de formulário pura no front (`orcamento-form.js`)

**Files:**
- Create: `src/ferramentas/meta-ads/orcamento-form.js`
- Test: `src/ferramentas/meta-ads/orcamento-form.test.mjs`

**Interfaces:**
- Produces:
  - `orcamentoBase()` → estado inicial do form `{ modo:'ABO', tipo:'diario', valorReais:'50,00', inicio:'', fim:'' }`
  - `reaisParaCentavos(str)` → inteiro (centavos) | `null` se inválido
  - `validarOrcamento(form)` → `{ ok:boolean, erro?:string }`
  - `orcamentoParaEnvio(form)` → `{ modo, tipo, valor, inicio?, fim? }` p/ o backend (datas em ISO -03:00)

- [ ] **Step 1: Write the failing test**

```js
// src/ferramentas/meta-ads/orcamento-form.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orcamentoBase, reaisParaCentavos, validarOrcamento, orcamentoParaEnvio } from './orcamento-form.js';

test('orcamentoBase: ABO/diario/50,00 (= o de hoje)', () => {
  assert.deepEqual(orcamentoBase(), { modo: 'ABO', tipo: 'diario', valorReais: '50,00', inicio: '', fim: '' });
});

test('reaisParaCentavos: aceita virgula, ponto, inteiro', () => {
  assert.equal(reaisParaCentavos('50,00'), 5000);
  assert.equal(reaisParaCentavos('50.00'), 5000);
  assert.equal(reaisParaCentavos('50'), 5000);
  assert.equal(reaisParaCentavos('1.234,56'), 123456);
  assert.equal(reaisParaCentavos(''), null);
  assert.equal(reaisParaCentavos('abc'), null);
});

test('validarOrcamento: valor abaixo do minimo (R$5) reprova', () => {
  assert.deepEqual(validarOrcamento({ modo: 'ABO', tipo: 'diario', valorReais: '3,00' }), { ok: false, erro: 'Valor mínimo é R$ 5,00.' });
});

test('validarOrcamento: total sem datas reprova; fim antes do inicio reprova', () => {
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '', fim: '' }).ok, false);
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-10', fim: '2026-08-01' }).ok, false);
  assert.equal(validarOrcamento({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-01', fim: '2026-08-10' }).ok, true);
});

test('orcamentoParaEnvio: diario -> centavos sem datas; total -> datas ISO -03:00', () => {
  assert.deepEqual(orcamentoParaEnvio({ modo: 'CBO', tipo: 'diario', valorReais: '80,00', inicio: '', fim: '' }),
    { modo: 'CBO', tipo: 'diario', valor: 8000 });
  assert.deepEqual(orcamentoParaEnvio({ modo: 'ABO', tipo: 'total', valorReais: '300,00', inicio: '2026-08-01', fim: '2026-08-10' }),
    { modo: 'ABO', tipo: 'total', valor: 30000, inicio: '2026-08-01T00:00:00-03:00', fim: '2026-08-10T23:59:59-03:00' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/ferramentas/meta-ads/orcamento-form.test.mjs`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```js
// src/ferramentas/meta-ads/orcamento-form.js
// Lógica PURA do formulário de orçamento (sem Vue) — testável em node.
// form = { modo:'ABO'|'CBO', tipo:'diario'|'total', valorReais:string, inicio:'YYYY-MM-DD', fim:'YYYY-MM-DD' }
const MIN_CENTAVOS = 500; // R$ 5,00

export function orcamentoBase() {
  return { modo: 'ABO', tipo: 'diario', valorReais: '50,00', inicio: '', fim: '' };
}

export function reaisParaCentavos(str) {
  if (typeof str !== 'string' || !str.trim()) return null;
  // remove separador de milhar '.', troca vírgula decimal por '.'
  const limpo = str.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

export function validarOrcamento(form) {
  const c = reaisParaCentavos(form.valorReais);
  if (c == null) return { ok: false, erro: 'Digite um valor válido em R$.' };
  if (c < MIN_CENTAVOS) return { ok: false, erro: 'Valor mínimo é R$ 5,00.' };
  if (form.tipo === 'total') {
    if (!form.inicio || !form.fim) return { ok: false, erro: 'Preencha data de início e fim.' };
    if (form.fim <= form.inicio) return { ok: false, erro: 'A data de fim deve ser depois do início.' };
  }
  return { ok: true };
}

export function orcamentoParaEnvio(form) {
  const valor = reaisParaCentavos(form.valorReais);
  const out = { modo: form.modo === 'CBO' ? 'CBO' : 'ABO', tipo: form.tipo === 'total' ? 'total' : 'diario', valor };
  if (out.tipo === 'total') {
    out.inicio = `${form.inicio}T00:00:00-03:00`;
    out.fim = `${form.fim}T23:59:59-03:00`;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/ferramentas/meta-ads/orcamento-form.test.mjs`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/meta-ads/orcamento-form.js src/ferramentas/meta-ads/orcamento-form.test.mjs
git commit -m "feat(estudio): logica pura do form de orcamento (R$->centavos, validacao, envio)"
```

---

### Task 4: UI + estado no `painel-subir.vue` (bloco Orçamento por loja)

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-subir.vue`

**Interfaces:**
- Consumes: `orcamentoBase`, `validarOrcamento`, `orcamentoParaEnvio` (Task 3); espelha o padrão `publicoPorLoja`/`salvarAtiva`/`carregarLoja`/`trocarAba`/`toggleLoja`.

- [ ] **Step 1: Importar o form helper + estado por loja**

No `<script setup>`, junto dos imports do topo:

```js
import { orcamentoBase, validarOrcamento, orcamentoParaEnvio } from './orcamento-form.js'
```

Perto de `const publicoPorLoja = reactive({})` (linha ~45), adicionar o estado espelho:

```js
const orcamento = reactive(orcamentoBase())          // config da loja ATIVA
const orcamentoPorLoja = reactive({})                // slug -> snapshot do orçamento
```

- [ ] **Step 2: Salvar/carregar orçamento junto do público**

Estender `salvarAtiva` e `carregarLoja` (linhas ~48-49) p/ também tratar o orçamento:

```js
function salvarAtiva() {
  if (!lojaAtiva.value) return
  publicoPorLoja[lojaAtiva.value] = clone(publico)
  orcamentoPorLoja[lojaAtiva.value] = clone(orcamento)
}
function carregarLoja(slug) {
  Object.assign(publico, clone(publicoPorLoja[slug] || publicoBase(slug)))
  Object.assign(orcamento, clone(orcamentoPorLoja[slug] || orcamentoBase()))
}
```

Em `toggleLoja` (linha ~52-59), ao adicionar loja garantir o snapshot de orçamento (junto do `publicoPorLoja[slug] = publicoBase(slug)`):

```js
    if (!orcamentoPorLoja[slug]) orcamentoPorLoja[slug] = orcamentoBase()
```

E ao remover a loja, limpar também (junto do `delete publicoPorLoja[slug]`):

```js
    delete orcamentoPorLoja[slug]
```

Na inicialização em massa (linha ~155, `for (const slug of destino.lojas) publicoPorLoja[slug] = publicoBase(slug)`), adicionar na mesma iteração:

```js
  for (const slug of destino.lojas) { publicoPorLoja[slug] = publicoBase(slug); orcamentoPorLoja[slug] = orcamentoBase() }
```

- [ ] **Step 3: Validar + incluir orçamento no envio**

No `subir()` (linha ~166), ANTES de montar `params`, salvar a aba ativa e validar cada loja:

```js
  if (destino.tipo === 'nova') {
    salvarAtiva()
    for (const slug of destino.lojas) {
      const v = validarOrcamento(orcamentoPorLoja[slug] || orcamento)
      if (!v.ok) return alert(`Orçamento da loja ${LOJAS.find(l=>l.slug===slug)?.nome || slug}: ${v.erro}`)
    }
  }
```

E no objeto `params` (linha ~168-170), incluir `orcamento` em cada loja:

```js
  const params = { campanhaId: props.campanhaId, destino: destino.tipo === 'existente'
    ? { tipo: 'existente', campaignId: destino.campaignId }
    : { tipo: 'nova', lojas: destino.lojas.map((slug) => ({
        slug,
        publico: publicoParaEnvio(publicoPorLoja[slug] || publico),
        orcamento: orcamentoParaEnvio(orcamentoPorLoja[slug] || orcamento),
      })) } }
```

- [ ] **Step 4: Bloco de UI "Orçamento" no painel por loja**

Dentro do `<div class="panel" v-if="destino.tipo==='nova'">` (linha ~231), logo abaixo do cabeçalho de abas de loja (após a linha ~242 "Editando o público de..."), inserir o bloco. Ele edita a config da loja ATIVA (`orcamento`), no mesmo modelo do público:

```html
      <div class="orc-bloco" style="margin:8px 0 18px; padding:14px; border:1px solid var(--linha,#2a2a2a); border-radius:12px">
        <p class="eyebrow" style="margin:0 0 10px"><b>Orçamento</b> desta loja</p>

        <div class="orc-linha" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px">
          <button type="button" class="loja-chip" :class="{ sel: orcamento.modo==='ABO' }" @click="orcamento.modo='ABO'">ABO — no conjunto</button>
          <button type="button" class="loja-chip" :class="{ sel: orcamento.modo==='CBO' }" @click="orcamento.modo='CBO'">CBO — na campanha</button>
        </div>
        <p class="muted" style="font-size:12px; margin:-4px 0 12px">
          {{ orcamento.modo==='CBO' ? 'CBO: você dá um orçamento único e a Meta divide entre os conjuntos, otimizando sozinha.' : 'ABO: o orçamento fica fixo neste conjunto de anúncios.' }}
        </p>

        <div class="orc-linha" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px">
          <button type="button" class="loja-chip" :class="{ sel: orcamento.tipo==='diario' }" @click="orcamento.tipo='diario'">Diário</button>
          <button type="button" class="loja-chip" :class="{ sel: orcamento.tipo==='total' }" @click="orcamento.tipo='total'">Total (período)</button>
        </div>

        <label class="campo" style="display:block; margin-bottom:12px">
          <span class="eyebrow muted">Valor {{ orcamento.tipo==='diario' ? 'por dia' : 'total do período' }} (R$)</span>
          <input type="text" inputmode="decimal" v-model="orcamento.valorReais" placeholder="50,00" style="width:100%">
        </label>

        <div v-if="orcamento.tipo==='total'" style="display:flex; flex-wrap:wrap; gap:12px">
          <label class="campo" style="flex:1 1 160px">
            <span class="eyebrow muted">Início</span>
            <input type="date" v-model="orcamento.inicio" style="width:100%">
          </label>
          <label class="campo" style="flex:1 1 160px">
            <span class="eyebrow muted">Fim</span>
            <input type="date" v-model="orcamento.fim" style="width:100%">
          </label>
        </div>
        <p v-if="orcamento.tipo==='total'" class="muted" style="font-size:12px; margin:8px 0 0">
          A campanha sobe pausada; se a data de início já tiver passado quando você ativar, a Meta ajusta pra ativação.
        </p>
      </div>
```

- [ ] **Step 5: Verificação — build + teste no componente real**

Run: `npm run build` (raiz do repo) — Expected: build limpo, sem erro de template.

Depois, validar interativamente o componente (padrão de repro do repo — Vite harness com deps stubadas + Playwright, ver [[project_iamundi_colisao_css_global]]):
- trocar de aba de loja preserva o orçamento de cada uma (snapshot),
- alternar ABO/CBO e Diário/Total mostra/esconde datas e troca o texto,
- valor inválido / datas erradas barram o Subir com alerta,
- responsivo em 390px sem estourar.

- [ ] **Step 6: Commit**

```bash
git add src/ferramentas/meta-ads/painel-subir.vue
git commit -m "feat(estudio): bloco de orcamento CBO/ABO por loja no passo Subir (UI + estado)"
```

---

### Task 5: Validação AO VIVO dos 4 combos (PAUSED) + acerto do mapeamento

**Files:**
- Create: `coletor/validar-orcamento-combos.mjs`
- Modify (se a Meta exigir): `coletor/lib/orcamento.mjs`

**Interfaces:**
- Consumes: `payloadCampanhaAdset`/`criarCampanhaNova` (Task 2), `meta-proxy`, padrão de `coletor/validar-objetivos-combos.mjs`.

- [ ] **Step 1: Escrever o validador (espelho do validar-objetivos-combos.mjs)**

Ler `coletor/validar-objetivos-combos.mjs` como molde. Criar `coletor/validar-orcamento-combos.mjs` que, para cada combo em `[{modo:'ABO',tipo:'diario'},{modo:'ABO',tipo:'total'},{modo:'CBO',tipo:'diario'},{modo:'CBO',tipo:'total'}]`:
- monta o payload via `payloadCampanhaAdset(objetivoRow, MARCA, loja, cfg, null, { ...combo, valor: 5000|30000, inicio, fim })`,
- cria campanha+adset **PAUSED** via `meta-proxy`,
- loga ACEITO/REJEITADO (com subcode do erro),
- **apaga** o que criou (nunca deixa lixo).
- Flags: `--loja tivoli|dp`, `--combos`, `--manter` (não apagar, p/ inspeção).
- Rodar com: `cd coletor && node --import ./lib/curl-fetch.mjs validar-orcamento-combos.mjs --loja tivoli`

- [ ] **Step 2: Rodar e ler os 4 veredictos**

Run: `cd coletor && node --import ./lib/curl-fetch.mjs validar-orcamento-combos.mjs --loja tivoli`
Expected: os 4 combos **ACEITOS** (campanha+adset PAUSED criados e apagados). Se algum REJEITAR, anotar o subcode.

- [ ] **Step 3: Ajustar o mapeamento conforme a Meta (só se algo reprovar)**

Se a Meta reprovar algum combo (ex.: CBO exige `is_adset_budget_sharing_enabled:true`; lifetime exige formato de data diferente; mínimo de orçamento por moeda), corrigir em `coletor/lib/orcamento.mjs` — NÃO por suposição, pelo que a Meta ACEITAR (lição dos públicos SP-4). Re-rodar o validador até os 4 passarem. Atualizar os testes da Task 1 se o shape mudar.

- [ ] **Step 4: Commit**

```bash
git add coletor/validar-orcamento-combos.mjs coletor/lib/orcamento.mjs coletor/lib/orcamento.test.mjs
git commit -m "test(estudio): validador ao vivo dos 4 combos de orcamento (PAUSED) + acerto do mapeamento Meta"
```

---

## Self-Review

- **Spec coverage:** UX (Task 4) · fluxo de dados/`orcamentoPorLoja`/`lojasDoDestino` (Tasks 2,4) · tradução Meta 4 combos (Task 1) · datas do total (Tasks 1,3,4) · retrocompat byte-idêntico (Tasks 1,2, testes) · validação ao vivo PAUSED (Task 5) · testes (todas). Fora de escopo respeitado (só "nova"). ✔
- **Placeholders:** nenhum — todo passo tem código/comando reais. ✔
- **Type consistency:** `orcamento = { modo, tipo, valor, inicio?, fim? }` (centavos) igual em orcamento.mjs, subir-estudio, e no `orcamentoParaEnvio` do front; `payloadCampanhaAdset(...,publico,orcamento)` 6 args consistente; `lojasDoDestino` → `{slug,publico,orcamento}` consumido no loop do `run()`. ✔
- **Nota:** o `DATA_CAMPANHA: '11-07-2026'` hardcoded fica como está (issue separada, fora de escopo).
