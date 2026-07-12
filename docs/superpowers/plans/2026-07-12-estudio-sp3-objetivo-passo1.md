# Estúdio SP-3 — Objetivo da campanha no passo 1 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escolher o objetivo da campanha (engajamento/conversão/branding/tráfego) no passo Gerar do Estúdio, mudando tanto os criativos gerados quanto a campanha criada no Meta, com o mapa objetivo→Meta como dado editável.

**Architecture:** Config-as-data: nova tabela `fabrica_objetivos` mapeia cada objetivo → parâmetros do Meta (objective/optimization/destination/promoted_object/cta/looks/pede_desconto). O objetivo é escolhido no Gerar, gravado em `fabrica_campanhas.objetivo`, filtra os looks na geração e dirige `criarCampanhaNova` na subida (adeus `OUTCOME_ENGAGEMENT` cravado). Looks etiquetados por objetivo + 2 looks novos de branding sem preço.

**Tech Stack:** Supabase Postgres (migration + RLS), Node ESM coletor (`.mjs`, `node:test`), puppeteer templates, Edge Function Deno (`fabrica-trigger`), Vue 3 `<script setup>` + Vite.

## Global Constraints

- Tudo que sobe ao Meta vai **PAUSED**; o SP-3 não ativa nada (ativação segue no job `ativar`, intocado).
- Nada de IDs/objetivos hardcoded novos: o combo do Meta sai sempre de `fabrica_objetivos` (a única exceção provada é o seed inicial).
- `instagram_user_id` (NÃO `instagram_actor_id`, descontinuado na v22) para o promoted_object de IG.
- Coletor roda ESM com `import './lib/carregar-env.mjs'`; testes com `node --test`; scripts que tocam rede usam `node --import ./lib/curl-fetch.mjs` + `tls.DEFAULT_MAX_VERSION='TLSv1.2'`.
- Migrations da Fábrica são arquivos em `db/migrations/NNN_*.sql` aplicados pelo runner pg próprio (porta 6543); a numeração segue de 021 (última) → **022**.
- Objetivos: `engajamento` (provado) · `conversao` · `branding` · `trafego` (os 3 últimos = combos a validar ao vivo).

---

### Task 1: Migration 022 — coluna `objetivo` + tabela `fabrica_objetivos` + seed + RLS

**Files:**
- Create: `db/migrations/022_fabrica_objetivos.sql`

**Interfaces:**
- Produces: `fabrica_campanhas.objetivo text NOT NULL DEFAULT 'engajamento'`; tabela `fabrica_objetivos(chave pk, rotulo, descricao, meta_objective, optimization_goal, billing_event, destination_type, promoted_object_tipo, cta_type, looks text[], pede_desconto bool, ativo bool, ordem int)` com 4 linhas seed; RLS read=authenticated, write=service_role.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/022_fabrica_objetivos.sql`:
```sql
-- SP-3: objetivo da campanha. Coluna na rodada + tabela de config (mapa objetivo -> Meta).
alter table fabrica_campanhas add column if not exists objetivo text not null default 'engajamento';

create table if not exists fabrica_objetivos (
  chave text primary key,
  rotulo text not null,
  descricao text not null default '',
  meta_objective text not null,
  optimization_goal text not null,
  billing_event text not null default 'IMPRESSIONS',
  destination_type text,                 -- null = sem messaging (branding)
  promoted_object_tipo text not null default 'none',  -- whatsapp|page|ig|none
  cta_type text not null default 'LEARN_MORE',
  looks text[] not null default '{}',    -- etiquetas de look que servem
  pede_desconto boolean not null default true,
  ativo boolean not null default true,
  ordem int not null default 0
);

alter table fabrica_objetivos enable row level security;

drop policy if exists fab_obj_read on fabrica_objetivos;
create policy fab_obj_read on fabrica_objetivos for select to authenticated using (true);
-- escrita só service_role (as políticas de write ficam ausentes p/ authenticated => negado)

insert into fabrica_objetivos (chave, rotulo, descricao, meta_objective, optimization_goal, billing_event, destination_type, promoted_object_tipo, cta_type, looks, pede_desconto, ativo, ordem) values
  ('engajamento','Engajamento (WhatsApp)','Conversas no WhatsApp da loja','OUTCOME_ENGAGEMENT','CONVERSATIONS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['engajamento'], true, true, 1),
  ('conversao','Conversão / Vendas','Foco em quem tem intenção de compra','OUTCOME_SALES','CONVERSATIONS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['conversao'], true, true, 2),
  ('branding','Reconhecimento','Alcance de marca, leva ao Instagram','OUTCOME_AWARENESS','REACH','IMPRESSIONS', null,'none','LEARN_MORE', array['branding'], false, true, 3),
  ('trafego','Tráfego','Manda o máximo de gente pro destino','OUTCOME_TRAFFIC','LINK_CLICKS','IMPRESSIONS','WHATSAPP','whatsapp','WHATSAPP_MESSAGE', array['trafego'], true, true, 4)
on conflict (chave) do nothing;
```

- [ ] **Step 2: Aplicar a migration (checkpoint do controller)**

O controller aplica via runner pg (`coletor/` runner, porta 6543) OU via MCP `apply_migration`. Não aplicar dentro do subagente. Verificar depois com: `select chave, meta_objective, destination_type from fabrica_objetivos order by ordem;` (espera 4 linhas) e `select column_default from information_schema.columns where table_name='fabrica_campanhas' and column_name='objetivo';` (espera `'engajamento'::text`).

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/022_fabrica_objetivos.sql
git commit -m "feat(fabrica): migration 022 — objetivo na rodada + tabela fabrica_objetivos (SP-3)"
```

---

### Task 2: `lib/objetivos.mjs` — mapaObjetivo / montaPromotedObject / looksDoObjetivo (funções puras + testes)

**Files:**
- Create: `coletor/lib/objetivos.mjs`
- Create: `coletor/lib/objetivos.test.mjs`

**Interfaces:**
- Consumes: uma função `sbGet(path)` injetada (mesmo padrão de `config-lojas.mjs`), que retorna o array de `fabrica_objetivos`.
- Produces:
  - `async carregarObjetivos(sbGet) -> { objetivos: Row[], porChave: Map }` — lê `fabrica_objetivos?select=*&ativo=eq.true&order=ordem`.
  - `mapaObjetivo(porChave, chave) -> Row` (fallback à linha `engajamento`; lança se nem essa existir).
  - `montaPromotedObject(tipo, marca, loja) -> object|undefined` — `whatsapp`→`{page_id, whatsapp_phone_number}`, `page`→`{page_id}`, `ig`→`{instagram_user_id}`, `none`→`undefined`.
  - `looksDoObjetivo(row, looksDisponiveis) -> string[]` — interseção de `row.looks` com `looksDisponiveis`; se `row.looks` vazio, devolve `looksDisponiveis` inteiro (retrocompat).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `coletor/lib/objetivos.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapaObjetivo, montaPromotedObject, looksDoObjetivo } from './objetivos.mjs';

const ROWS = [
  { chave: 'engajamento', looks: ['engajamento'], destination_type: 'WHATSAPP', promoted_object_tipo: 'whatsapp' },
  { chave: 'branding', looks: ['branding'], destination_type: null, promoted_object_tipo: 'none' },
];
const porChave = new Map(ROWS.map((r) => [r.chave, r]));

test('mapaObjetivo devolve a linha e faz fallback p/ engajamento', () => {
  assert.equal(mapaObjetivo(porChave, 'branding').chave, 'branding');
  assert.equal(mapaObjetivo(porChave, 'inexistente').chave, 'engajamento');
});

test('mapaObjetivo lança se nem engajamento existe', () => {
  assert.throws(() => mapaObjetivo(new Map(), 'x'), /objetivo/);
});

test('montaPromotedObject por tipo', () => {
  const marca = { pageId: 'P', igId: 'IG' };
  const loja = { whatsapp: '55349...' };
  assert.deepEqual(montaPromotedObject('whatsapp', marca, loja), { page_id: 'P', whatsapp_phone_number: '55349...' });
  assert.deepEqual(montaPromotedObject('page', marca, loja), { page_id: 'P' });
  assert.deepEqual(montaPromotedObject('ig', marca, loja), { instagram_user_id: 'IG' });
  assert.equal(montaPromotedObject('none', marca, loja), undefined);
});

test('looksDoObjetivo faz interseção; looks vazio = todos', () => {
  const disp = ['produto-heroi', 'branding', 'preco-tipo'];
  assert.deepEqual(looksDoObjetivo({ looks: ['branding'] }, disp), ['branding']);
  assert.deepEqual(looksDoObjetivo({ looks: [] }, disp), disp);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/objetivos.test.mjs`
Expected: FAIL (`Cannot find module './objetivos.mjs'`).

- [ ] **Step 3: Implementar `lib/objetivos.mjs`**

Create `coletor/lib/objetivos.mjs`:
```js
// SP-3: mapa objetivo -> Meta (lido de fabrica_objetivos) + helpers puros.
export async function carregarObjetivos(sbGet) {
  const objetivos = await sbGet('/fabrica_objetivos?select=*&ativo=eq.true&order=ordem');
  const porChave = new Map((objetivos || []).map((o) => [o.chave, o]));
  return { objetivos: objetivos || [], porChave };
}

export function mapaObjetivo(porChave, chave) {
  const row = porChave.get(chave) || porChave.get('engajamento');
  if (!row) throw new Error('objetivo indisponível (nem engajamento na tabela)');
  return row;
}

export function montaPromotedObject(tipo, marca, loja) {
  if (tipo === 'whatsapp') return { page_id: marca.pageId, whatsapp_phone_number: loja.whatsapp };
  if (tipo === 'page') return { page_id: marca.pageId };
  if (tipo === 'ig') return { instagram_user_id: marca.igId };
  return undefined; // 'none'
}

export function looksDoObjetivo(row, looksDisponiveis) {
  const tags = row?.looks || [];
  if (!tags.length) return looksDisponiveis;
  return looksDisponiveis.filter((l) => tags.includes(l));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test lib/objetivos.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/objetivos.mjs coletor/lib/objetivos.test.mjs
git commit -m "feat(fabrica): lib/objetivos — mapaObjetivo/montaPromotedObject/looksDoObjetivo (SP-3)"
```

---

### Task 3: `templates.mjs` — etiquetar looks + 2 looks de branding

**Files:**
- Modify: `coletor/templates-criativos/templates.mjs`
- Create: `coletor/templates-criativos/objetivos-looks.test.mjs`

**Interfaces:**
- Consumes: a estrutura atual `TEMPLATES = { <chave>: { render(dados, formato), ... } }` e `DIM`.
- Produces: cada entrada de `TEMPLATES` ganha `objetivos: string[]`; duas entradas novas `'marca-lifestyle'` e `'marca-editorial'` com `objetivos: ['branding']` e `render(dados, formato)` que NÃO mostra preço/desconto. Um helper exportado `objetivosDoTemplate(chave) -> string[]` (default `[]` = todos).

- [ ] **Step 1: Escrever o teste (falhando)**

Create `coletor/templates-criativos/objetivos-looks.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, objetivosDoTemplate } from './templates.mjs';

test('looks de branding existem e estão etiquetados', () => {
  assert.ok(TEMPLATES['marca-lifestyle'], 'marca-lifestyle existe');
  assert.ok(TEMPLATES['marca-editorial'], 'marca-editorial existe');
  assert.deepEqual(objetivosDoTemplate('marca-lifestyle'), ['branding']);
  assert.deepEqual(objetivosDoTemplate('marca-editorial'), ['branding']);
});

test('um look de preço serve conversão/engajamento e NÃO branding', () => {
  const objs = objetivosDoTemplate('produto-heroi');
  assert.ok(objs.includes('engajamento'));
  assert.ok(!objs.includes('branding'));
});

test('objetivosDoTemplate default [] p/ template sem etiqueta', () => {
  assert.deepEqual(objetivosDoTemplate('__inexistente__'), []);
});

test('render dos looks de branding não contém "50%" nem "POR R$"', () => {
  const dados = { nome: 'Bolsa Cambridge', marca: 'La Vessel', fotoDataUrl: '', cidade: 'Campinas' };
  for (const chave of ['marca-lifestyle', 'marca-editorial']) {
    const html = TEMPLATES[chave].render(dados, '1080x1350');
    assert.ok(!/50%|POR R\$|DE R\$/i.test(html), `${chave} não deve ter preço/oferta`);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test templates-criativos/objetivos-looks.test.mjs`
Expected: FAIL (looks não existem / `objetivosDoTemplate` indefinido).

- [ ] **Step 3: Etiquetar os looks existentes**

Em `coletor/templates-criativos/templates.mjs`, adicionar `objetivos: [...]` a cada entrada de `TEMPLATES`. Regra: looks que exibem preço/oferta → `['engajamento','conversao','trafego']`; looks editoriais que dá pra usar sem gritar preço podem receber também `'branding'` se o render já suportar ocultar oferta (por ora NÃO — mantê-los fora de branding). Mapa exato a aplicar (ajustar às chaves reais do arquivo — ler o arquivo primeiro):
```js
// exemplos (aplicar a TODAS as chaves existentes):
// 'produto-heroi':      objetivos: ['engajamento','conversao','trafego']
// 'preco-tipo':         objetivos: ['engajamento','conversao','trafego']
// 'split':              objetivos: ['engajamento','conversao','trafego']
// 'editorial-sale':     objetivos: ['engajamento','conversao','trafego']
// 'editorial-v2':       objetivos: ['engajamento','conversao','trafego']
// 'sage-circulo':       objetivos: ['engajamento','conversao','trafego']
// (qualquer outro look de preço segue a mesma lista)
```

- [ ] **Step 4: Criar os 2 looks de branding**

Ainda em `templates.mjs`, adicionar duas entradas novas. Espelhar a estrutura de `render` de um look existente (ex.: `editorial-v2`) — ler o arquivo — mas **sem o bloco de oferta/preço**. Requisitos concretos de cada um:
- `'marca-lifestyle'`: `objetivos: ['branding']`. `render(dados, formato)` monta o HTML nos 2 formatos de `DIM` (1080×1350 e 1080×1920): foto do produto (`dados.fotoDataUrl`) com respiro, o nome da marca (`dados.marca`) em destaque tipográfico, uma frase curta de marca (fixa, ex.: "Peças que ficam com você."), **sem** `dados.oferta`/preço/"50%". Usa as mesmas fontes/reset base64 já no arquivo.
- `'marca-editorial'`: `objetivos: ['branding']`. Variante editorial: layout tipo revista (foto grande + assinatura da marca no rodapé), também **sem preço**.

Exportar o helper no fim do arquivo:
```js
export function objetivosDoTemplate(chave) {
  return TEMPLATES[chave]?.objetivos ?? [];
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test templates-criativos/objetivos-looks.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 6: Smoke visual dos looks novos (render pra arquivo)**

Rodar um render rápido dos 2 looks nos 2 formatos e conferir que abre imagem sã (o repo tem `render-criativo.mjs`; usar um script ad-hoc ou o caminho de teste existente). Não commitar PNGs. Se não houver harness rápido, pular — o teste do Step 4 já garante ausência de preço.

- [ ] **Step 7: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/templates-criativos/templates.mjs coletor/templates-criativos/objetivos-looks.test.mjs
git commit -m "feat(fabrica): etiqueta looks por objetivo + 2 looks de branding sem preço (SP-3)"
```

---

### Task 4: `gerar-criativos.mjs` — `run()` recebe `objetivo`, filtra looks, tom da legenda

**Files:**
- Modify: `coletor/gerar-criativos.mjs`
- Modify: `coletor/gerar-criativos.test.mjs` (adicionar caso)

**Interfaces:**
- Consumes: `looksDoObjetivo` (Task 2), `objetivosDoTemplate`/`TEMPLATES` (Task 3), `carregarObjetivos`/`mapaObjetivo` (Task 2).
- Produces: `run({ ..., objetivo=null })` — quando `objetivo` vem, resolve a linha via `carregarObjetivos(sbGet)`+`mapaObjetivo`, calcula os looks permitidos (`looksDoObjetivo(row, looksDisponiveis)`) e seta `opts.looks` com essa lista antes de `variacoesProduto`; passa `objetivo` como contexto de tom pra `gerarCopysProduto` (campo `campanha.objetivo`). Sem `objetivo` (CLI legado) → comportamento atual (todos os looks).

- [ ] **Step 1: Escrever o teste (falhando)**

Em `coletor/gerar-criativos.test.mjs`, adicionar (mantém os testes atuais):
```js
test('run() aceita objetivo no destructuring (não quebra a assinatura)', async () => {
  const mod = await import('./gerar-criativos.mjs');
  assert.equal(typeof mod.run, 'function');
  // dry sem itens/objetivo continua no-op seguro
  const r = await mod.run({ dry: true, objetivo: 'branding', itens: [] });
  assert.ok(r && typeof r === 'object');
});
```
(Se o `run({dry:true, itens:[]})` atual já retorna cedo sem tocar rede, este teste roda puro. Confirmar lendo o guard de dry no arquivo.)

- [ ] **Step 2: Rodar e ver falhar/erro**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test gerar-criativos.test.mjs`
Expected: FAIL (objetivo ainda não no destructuring → pode passar por acaso; se passar, o valor de `objetivo` é ignorado — o Step 3 dá sentido a ele e o Step 4 revalida).

- [ ] **Step 3: Implementar no `run()`**

Em `coletor/gerar-criativos.mjs`:
1. No destructuring do `run({...})` (linha ~93-95), adicionar `objetivo = null,`.
2. Importar no topo: `import { carregarObjetivos, mapaObjetivo, looksDoObjetivo } from './lib/objetivos.mjs';` e `import { objetivosDoTemplate } from './templates-criativos/templates.mjs';` (o `TEMPLATES` já é importado).
3. Depois de resolver `LOOKS` (linha ~112-120) e **antes** de montar `opts`, se `objetivo` vier e `opts.looks` não foi explicitamente passado por CLI:
```js
// SP-3: filtra os looks pelo objetivo (lido da tabela). CLI --looks explícito vence.
if (objetivo && !(LOOKS && LOOKS.length)) {
  const { porChave } = await carregarObjetivos(sbGet);
  const row = mapaObjetivo(porChave, objetivo);
  const looksDisponiveis = Object.keys(TEMPLATES).filter((k) => {
    const objs = objetivosDoTemplate(k);
    return objs.length === 0 || objs.includes(objetivo);
  });
  const permitidos = looksDoObjetivo(row, looksDisponiveis);
  if (permitidos.length) opts.looks = permitidos;
}
```
(usar o `sbGet` já existente no arquivo; se o nome local for outro, adaptar.)
4. Passar o objetivo como contexto de tom: onde monta o objeto `campanha` usado por `gerarCopysProduto`, incluir `objetivo`. Ex.: `const campanha = { ..., objetivo };` — e em `copy-efeito.mjs` o prompt já recebe `campanha`; nenhuma mudança obrigatória lá além de o campo existir (tom é best-effort).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test gerar-criativos.test.mjs`
Expected: PASS (todos, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs coletor/gerar-criativos.test.mjs
git commit -m "feat(fabrica): gerar-criativos filtra looks pelo objetivo + tom da legenda (SP-3)"
```

---

### Task 5: `fabrica-trigger` grava `objetivo` na rodada (gerar)

**Files:**
- Modify: `supabase/functions/fabrica-trigger/index.ts`

**Interfaces:**
- Consumes: `params.objetivo` (string) do body do disparo `tipo='gerar'`.
- Produces: o insert de `fabrica_campanhas` up-front (SP-2) passa a gravar `objetivo`; `params.objetivo` também segue no job (pro runner/gerar-criativos). Default `'engajamento'` se ausente. `subir`/`ativar` inalterados.

- [ ] **Step 1: Implementar**

Em `supabase/functions/fabrica-trigger/index.ts`, no bloco SP-2 que cria a campanha up-front (`if (tipo === "gerar" && !campanhaId) {...}`):
1. Ler o objetivo do params com default: logo após `let params = body.params || {};`, nada muda; dentro do bloco de criação, trocar o insert:
```ts
const objetivo = (params && params.objetivo) || "engajamento";
const { data: camp, error: ec } = await sb.from("fabrica_campanhas")
  .insert({ nome, status: "gerando", criado_por: ud.user.id, objetivo }).select("id").single();
```
2. Garantir que `params.objetivo` segue pro job (o runner passa `job.params` pro `gerar-criativos.run()`). Se `params.objetivo` estiver ausente, setar `params.objetivo = objetivo;` antes do insert do job (junto do `params.campanhaId`).

- [ ] **Step 2: Validar por leitura (sem harness de Edge)**

Conferir: só `gerar` grava `objetivo`; default `engajamento`; `params.objetivo` presente no job. `subir`/`ativar` intactos.

- [ ] **Step 3: (Deploy é checkpoint do controller)** — escrever + commitar; o controller faz `deploy_edge_function` (verify_jwt=true) via MCP no checkpoint.

- [ ] **Step 4: Commit**

```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-trigger/index.ts
git commit -m "feat(fabrica): fabrica-trigger grava objetivo na rodada (gerar, default engajamento) (SP-3)"
```

---

### Task 6: `subir-estudio.criarCampanhaNova` data-driven + `meta-subir` ramo branding

**Files:**
- Modify: `coletor/subir-estudio.mjs`
- Modify: `coletor/lib/meta-subir.mjs`
- Create: `coletor/subir-estudio.test.mjs` (ou adicionar a um test existente do módulo, se houver)

**Interfaces:**
- Consumes: `mapaObjetivo`/`montaPromotedObject`/`carregarObjetivos` (Task 2); `fabrica_campanhas.objetivo` (Task 1).
- Produces: `criarCampanhaNova(loja)` monta campaign+adset a partir da linha de `fabrica_objetivos` do objetivo da rodada; `payloadCriativa` ganha ramo `adsetDestinationType` falsy/none → object_story_spec simples com CTA do objetivo (link p/ perfil IG), sem asset_feed_spec.

- [ ] **Step 1: Escrever o teste (falhando) — payload de campanha por objetivo (puro, sem Graph)**

Extrair a montagem do payload pra uma função pura testável. Em `subir-estudio.mjs`, criar `export function payloadCampanhaAdset(row, marca, loja, cfg)` que devolve `{ campaign, adset }` (objetos que iriam pro POST), e `criarCampanhaNova` passa a usá-la. Teste `coletor/subir-estudio.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payloadCampanhaAdset } from './subir-estudio.mjs';

const MARCA = { adAccount: 'act_1', pageId: 'P', igId: 'IG' };
const LOJA = { nome: 'Tivoli', whatsapp: '5519...', geoCities: ['1058'] };
const CFG = { DAILY_BUDGET: 5000, DATA: '11-07-2026' };

test('engajamento: OUTCOME_ENGAGEMENT + CONVERSATIONS + WHATSAPP + promoted whatsapp', () => {
  const row = { chave:'engajamento', meta_objective:'OUTCOME_ENGAGEMENT', optimization_goal:'CONVERSATIONS', billing_event:'IMPRESSIONS', destination_type:'WHATSAPP', promoted_object_tipo:'whatsapp' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(campaign.objective, 'OUTCOME_ENGAGEMENT');
  assert.equal(campaign.status, 'PAUSED');
  assert.equal(adset.optimization_goal, 'CONVERSATIONS');
  assert.equal(adset.destination_type, 'WHATSAPP');
  assert.deepEqual(adset.promoted_object, { page_id: 'P', whatsapp_phone_number: '5519...' });
  assert.equal(adset.status, 'PAUSED');
});

test('branding: OUTCOME_AWARENESS + REACH + sem destination_type + sem promoted_object', () => {
  const row = { chave:'branding', meta_objective:'OUTCOME_AWARENESS', optimization_goal:'REACH', billing_event:'IMPRESSIONS', destination_type:null, promoted_object_tipo:'none' };
  const { campaign, adset } = payloadCampanhaAdset(row, MARCA, LOJA, CFG);
  assert.equal(campaign.objective, 'OUTCOME_AWARENESS');
  assert.equal(adset.optimization_goal, 'REACH');
  assert.ok(!('destination_type' in adset) || adset.destination_type == null);
  assert.ok(!('promoted_object' in adset) || adset.promoted_object === undefined);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs`
Expected: FAIL (`payloadCampanhaAdset` não existe).

- [ ] **Step 3: Implementar `payloadCampanhaAdset` + refatorar `criarCampanhaNova`**

Em `coletor/subir-estudio.mjs`:
1. Importar: `import { carregarObjetivos, mapaObjetivo, montaPromotedObject } from './lib/objetivos.mjs';`
2. Adicionar a função pura:
```js
export function payloadCampanhaAdset(row, marca, loja, cfg) {
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
    targeting: { geo_locations: { cities: (loja.geoCities || []).map((key) => ({ key })) } },
  };
  if (row.destination_type) adset.destination_type = row.destination_type;
  const po = montaPromotedObject(row.promoted_object_tipo, marca, loja);
  if (po) adset.promoted_object = po;
  return { campaign, adset };
}
```
3. `criarCampanhaNova(loja)` passa a: ler o objetivo da rodada (a rodada já foi carregada em `run()` — passar `objetivoRow` como parâmetro OU carregar aqui via `carregarObjetivos(sbGet)`+`mapaObjetivo(porChave, campanhaObjetivo)`), montar `{campaign, adset}` com `payloadCampanhaAdset`, e fazer os dois POSTs (`campaign_id` do adset preenchido após criar a campanha). Retorno mantém o shape atual `{ campaignId, adsets: [{ id, name, destinationType, whatsapp }] }` — `destinationType` = `row.destination_type` (pode ser null p/ branding).
4. Em `run()`: onde hoje resolve `MARCA`/loja e chama `criarCampanhaNova`, carregar o objetivo da rodada: `const campanha = (await sbGet('/fabrica_campanhas?select=objetivo&id=eq.'+campanhaId))[0]; const { porChave } = await carregarObjetivos(sbGet); const objetivoRow = mapaObjetivo(porChave, campanha?.objetivo || 'engajamento');` e passar `objetivoRow` adiante (pro `criarCampanhaNova` e pro cálculo de CTA no subir).

- [ ] **Step 4: `payloadCriativa` — ramo branding (sem messaging)**

Em `coletor/lib/meta-subir.mjs`, na `payloadCriativa({ hash, adsetDestinationType, waNumero, page, ig, mensagem })`, adicionar no topo o ramo quando **não há messaging** (branding): quando `adsetDestinationType` é falsy/`'none'`, devolver um creative simples com CTA `LEARN_MORE` e link pro perfil do IG:
```js
const dt = (adsetDestinationType || '').toUpperCase();
if (!dt || dt === 'NONE') {
  // branding: sem messaging. Liga ao perfil IG da marca (só temos o instagram_user_id numérico,
  // não o @handle — então o link é o instagram.com genérico e o instagram_user_id amarra o anúncio
  // à conta certa). CTA LEARN_MORE.
  return {
    object_story_spec: {
      page_id: page,
      instagram_user_id: ig,
      link_data: { image_hash: hash, link: 'https://www.instagram.com/', message: mensagem, call_to_action: { type: 'LEARN_MORE' } },
    },
    degrees_of_freedom_spec: { creative_features_spec: Object.fromEntries(DOF_FEATURES.map((f) => [f, { enroll_status: 'OPT_OUT' }])) },
  };
}
```
(usar o mesmo padrão de `degrees_of_freedom_spec` já no arquivo; se houver um helper que monta esse spec, reusar em vez de repetir.)

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test subir-estudio.test.mjs && node --test lib/meta-subir.test.mjs 2>/dev/null || true`
Expected: os testes de `payloadCampanhaAdset` PASS. (Se existir teste de `meta-subir`, roda junto.)

- [ ] **Step 6: Rodar a suíte inteira do coletor**

Run: `cd /Users/erickmartins/iamundi/coletor && node --test`
Expected: tudo verde (inclui gerar/subir/ativar/objetivos).

- [ ] **Step 7: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/subir-estudio.mjs coletor/lib/meta-subir.mjs coletor/subir-estudio.test.mjs
git commit -m "feat(fabrica): criarCampanhaNova data-driven por objetivo + payloadCriativa ramo branding (SP-3)"
```

---

### Task 7: `painel-gerar.vue` — seletor de Objetivo + esconder desconto no branding

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-gerar.vue`

**Interfaces:**
- Consumes: `sb()` helper (já importado no arquivo); a tabela `fabrica_objetivos`.
- Produces: `sel.objetivo` (string, default primeira linha ativa); o `gerar()` passa `objetivo: sel.objetivo` no `params` do `fabrica-trigger`; o campo de desconto some quando o objetivo tem `pede_desconto=false`.

- [ ] **Step 1: Ler objetivos no onMounted + estado**

Em `src/ferramentas/meta-ads/painel-gerar.vue` `<script setup>`:
1. Adicionar estado: `const objetivos = ref([])` e no `sel` reactive, `objetivo: 'engajamento'`.
2. No `onMounted` (que já carrega `lojas`), carregar também:
```js
objetivos.value = await sb('fabrica_objetivos?select=chave,rotulo,descricao,pede_desconto&ativo=eq.true&order=ordem')
if (objetivos.value.length) sel.objetivo = objetivos.value[0].chave
```
3. Computed do objetivo atual e se pede desconto:
```js
const objetivoAtual = computed(() => objetivos.value.find((o) => o.chave === sel.objetivo))
const pedeDesconto = computed(() => objetivoAtual.value?.pede_desconto !== false)
```

- [ ] **Step 2: Seletor no template (topo, antes de Lojas)**

Adicionar um painel de Objetivo antes do painel de Lojas:
```html
<div class="panel">
  <div class="ph"><span class="eyebrow">Objetivo</span></div>
  <div class="choices">
    <label v-for="o in objetivos" :key="o.chave" class="choice" :class="{ sel: sel.objetivo === o.chave }">
      <input type="radio" :value="o.chave" v-model="sel.objetivo">
      <span class="ch-nm">{{ o.rotulo }}</span>
      <span class="ch-sub">{{ o.descricao }}</span>
    </label>
  </div>
</div>
```

- [ ] **Step 3: Esconder desconto quando não pede**

Envolver o bloco de escolha de desconto (os `<label class="choice">` de `descontoModo` previsto/manual) com `v-if="pedeDesconto"`. Quando `pedeDesconto` é false (branding), o `itensEscolhidos()` deve mandar pct 0/none — ajustar: em `itensEscolhidos()`, se `!pedeDesconto.value`, empurrar `pct: 0` (branding não aplica desconto). Conferir que o gerar-criativos aceita pct 0 (não rende "De/Por"; branding usa looks sem preço de qualquer jeito).

- [ ] **Step 4: `gerar()` manda o objetivo**

No `gerar()`, incluir `objetivo` no params do invoke:
```js
const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'gerar', params: { itens, nome, objetivo: sel.objetivo } } })
```

- [ ] **Step 5: Build**

Run: `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/painel-gerar.vue
git commit -m "feat(fabrica): seletor de objetivo no Gerar + esconde desconto no branding (SP-3)"
```

---

## Checkpoints do mundo real (controller + Breno)

Após as 7 tasks:
1. **Aplicar migration 022** (coluna + tabela + seed) via runner pg ou MCP.
2. **Deploy `fabrica-trigger`** (atualizada) via MCP (verify_jwt=true).
3. **VALIDAÇÃO AO VIVO dos 3 combos ⚠️** (`conversao`/`branding`/`trafego`): pra cada um, o Breno (ou o controller com a conta de serviço) dispara/sobe **1 campanha PAUSED de teste** e confere se o Graph aceita o combo. Se reclamar, ajustar a linha correspondente de `fabrica_objetivos` (SQL) — sem redeploy. Nada gasta (PAUSED); apagável via `fabrica-apagar` ou no Gerenciador.
4. **Merge→main + push** (conta brenoov) → Vercel deploya o front. **Ordem**: migration+deploy da Edge podem ir antes; o front só depende do seletor + tabela existir.
5. **Smoke ao vivo**: no Gerar, trocar de objetivo esconde desconto no branding; gerar branding produz só os looks de marca (sem preço); subir cria a campanha com o objective certo.

## Testes (resumo)

- **node:test (puros):** `objetivos.test.mjs` (mapa/promoted_object/looks), `objetivos-looks.test.mjs` (etiquetas + branding sem preço), `subir-estudio.test.mjs` (payload por objetivo), caso novo em `gerar-criativos.test.mjs`. Mais a suíte inteira do coletor verde.
- **Edge:** `fabrica-trigger` por deploy (grava objetivo).
- **Front:** `vite build` + smoke do seletor.
- **DB:** migration 022 (coluna + tabela + seed 4 linhas).
- **Ao vivo:** 3 combos ⚠️ validados em campanha PAUSED.

## Sequência

1 (migration) → 2 (lib/objetivos) → 3 (templates+branding) → 4 (gerar filtra looks) → 5 (trigger grava objetivo) → 6 (subir data-driven + payload branding) → 7 (seletor no Gerar). Backend 1-6, front 7. Migration/deploy/validação-ao-vivo/push nos checkpoints.
