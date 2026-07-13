# Estúdio SP-5 Fase A — Templates/Looks: curadoria + galeria + preview · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar uma galeria com preview + curadoria (ligar/desligar, ordenar, renomear, editar objetivos) dos looks de criativo existentes, movendo a metadata dos looks pra uma tabela `fabrica_looks` que o gerador passa a ler.

**Architecture:** `fabrica_looks` guarda a metadata curável dos looks; o registry em `templates.mjs` segue sendo a fonte do *render*. O gerador lê `fabrica_looks` ativos (soft-fail → fallback pro registry). Uma galeria (`/fabrica-estudio/looks`) edita a curadoria via Edge `fabrica-looks`; um job `preview` renderiza cada look com dados de amostra pro thumbnail.

**Tech Stack:** Supabase Postgres (migration + RLS), Edge Functions (Deno), Node ESM coletor (`.mjs`, `node:test`, puppeteer), Vue 3 `<script setup>` + Vite.

## Global Constraints

- **SÓ FASE A.** A Fase B (Canva) NÃO é planejada aqui — vira um plano próprio DEPOIS que o Breno registrar o app Canva Connect e as chamadas reais da API forem verificadas ao vivo. Nesta fase, looks `tipo='canva'` são ignorados pelo gerador (só `tipo='codigo'`).
- Tudo PAUSED; SP-5 é geração/curadoria, não ativa nada.
- **Nunca quebrar a geração:** a leitura de `fabrica_looks` no gerador é **soft-fail** — se a tabela estiver vazia/indisponível, cai no comportamento do SP-3 (registry + `objetivosDoTemplate`).
- Escrita de `fabrica_looks` só via Edge gated (`meta.fabrica`); leitura `authenticated` por RLS.
- Migrations da Fábrica: `db/migrations/NNN_*.sql`, numeração segue de 023 → **024**.
- Coletor ESM; testes `node --test` na pasta `coletor/`.
- Preview usa **dados de amostra fixos** (sem tocar em produto real).

---

### Task 1: Migration 024 — tabela `fabrica_looks` + RLS + seed dos code-looks

**Files:**
- Create: `db/migrations/024_fabrica_looks.sql`

**Interfaces:**
- Produces: `fabrica_looks(chave pk, nome, arquetipo, objetivos text[], ativo, ordem, preview_url, tipo, canva_formato_map jsonb, campo_map jsonb, criado_por, created_at)`; RLS select=authenticated; seed dos 13 code-looks.

- [ ] **Step 1: Escrever a migration**

Create `db/migrations/024_fabrica_looks.sql`:
```sql
-- SP-5 Fase A: metadata curável dos looks (o render fica em templates.mjs). Escrita via Edge fabrica-looks.
create table if not exists fabrica_looks (
  chave text primary key,
  nome text not null,
  arquetipo text not null,                 -- produto | promo | branding
  objetivos text[] not null default '{}',  -- engajamento|conversao|branding|trafego; vazio = todos
  ativo boolean not null default true,
  ordem int not null default 0,
  preview_url text,
  tipo text not null default 'codigo',      -- codigo | canva
  canva_formato_map jsonb not null default '{}'::jsonb,
  campo_map jsonb not null default '{}'::jsonb,
  criado_por uuid,
  created_at timestamptz not null default now()
);

alter table fabrica_looks enable row level security;
drop policy if exists fab_looks_read on fabrica_looks;
create policy fab_looks_read on fabrica_looks for select to authenticated using (true);

-- seed dos 13 code-looks (chave/nome/arquetipo/objetivos = registry atual). Idempotente: não sobrescreve curadoria.
insert into fabrica_looks (chave, nome, arquetipo, objetivos, ordem) values
  ('promo-number-hero','Promo · Number Hero','promo', array['engajamento','conversao','trafego'], 1),
  ('produto-heroi','Produto · Herói','produto', array['engajamento','conversao','trafego'], 2),
  ('produto-preco-tipo','Produto · Preço Tipográfico','produto', array['engajamento','conversao','trafego'], 3),
  ('produto-sage-circulo','Produto · Sage Círculo','produto', array['engajamento','conversao','trafego'], 4),
  ('promo-sage','Promo · Sage','promo', array['engajamento','conversao','trafego'], 5),
  ('promo-minimal-pearl','Promo · Minimal Pearl','promo', array['engajamento','conversao','trafego'], 6),
  ('promo-burnt-wood','Promo · Burnt Wood','promo', array['engajamento','conversao','trafego'], 7),
  ('editorial-sale','Editorial · Sale','produto', array['engajamento','conversao','trafego'], 8),
  ('editorial-v2','Editorial · V2','produto', array['engajamento','conversao','trafego'], 9),
  ('produto-split','Produto · Split','produto', array['engajamento','conversao','trafego'], 10),
  ('produto-modelo','Produto · Modelo','produto', array['engajamento','conversao','trafego'], 11),
  ('marca-lifestyle','Marca · Lifestyle','produto', array['branding'], 12),
  ('marca-editorial','Marca · Editorial','produto', array['branding'], 13)
on conflict (chave) do nothing;
```

- [ ] **Step 2: Aplicar (checkpoint do controller)** — não aplicar no subagente. Verificar depois: `select chave, arquetipo, ativo, ordem from fabrica_looks order by ordem;` (13 linhas).

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add db/migrations/024_fabrica_looks.sql
git commit -m "feat(fabrica): migration 024 — tabela fabrica_looks + seed dos 13 code-looks (SP-5A)"
```

---

### Task 2: `coletor/lib/looks.mjs` — funções puras (sync + ativos ordenados)

**Files:**
- Create: `coletor/lib/looks.mjs`
- Create: `coletor/lib/looks.test.mjs`

**Interfaces:**
- Produces:
  - `sincronizarLooks(registryEntries, existentes) -> Row[]` — devolve SÓ as linhas a inserir (chaves do registry que faltam em `existentes`); shape `{chave,nome,arquetipo,objetivos,tipo:'codigo',ativo:true,ordem:0}`. Não sobrescreve nada.
  - `looksAtivosOrdenados(fabricaLooks, objetivo) -> string[]` — filtra `ativo!==false`, filtra por objetivo (`objetivos` vazio = todos, senão inclui `objetivo`), ordena por `ordem`, devolve as `chave`.

- [ ] **Step 1: Escrever os testes (falhando)**

Create `coletor/lib/looks.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarLooks, looksAtivosOrdenados } from './looks.mjs';

test('sincronizarLooks devolve só as chaves faltantes', () => {
  const registry = [{ chave: 'a', nome: 'A', arquetipo: 'produto', objetivos: ['x'] }, { chave: 'b', nome: 'B', arquetipo: 'promo', objetivos: [] }];
  const out = sincronizarLooks(registry, [{ chave: 'a' }]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { chave: 'b', nome: 'B', arquetipo: 'promo', objetivos: [], tipo: 'codigo', ativo: true, ordem: 0 });
});

test('looksAtivosOrdenados: ativo + objetivo + ordem', () => {
  const looks = [
    { chave: 'z', ativo: true, objetivos: ['branding'], ordem: 2 },
    { chave: 'a', ativo: true, objetivos: [], ordem: 1 },            // vazio = todos
    { chave: 'x', ativo: false, objetivos: ['engajamento'], ordem: 0 }, // inativo
    { chave: 'e', ativo: true, objetivos: ['engajamento'], ordem: 3 },
  ];
  assert.deepEqual(looksAtivosOrdenados(looks, 'engajamento'), ['a', 'e']);
  assert.deepEqual(looksAtivosOrdenados(looks, 'branding'), ['a', 'z']);
  // sem objetivo = todos os ativos por ordem
  assert.deepEqual(looksAtivosOrdenados(looks, null), ['a', 'z', 'e']);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd /Users/erickmartins/iamundi/coletor && node --test lib/looks.test.mjs` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lib/looks.mjs`**
```js
// SP-5A: funções puras de curadoria de looks (metadata em fabrica_looks; render em templates.mjs).
export function sincronizarLooks(registryEntries, existentes) {
  const has = new Set((existentes || []).map((e) => e.chave));
  return (registryEntries || [])
    .filter((r) => !has.has(r.chave))
    .map((r) => ({ chave: r.chave, nome: r.nome, arquetipo: r.arquetipo, objetivos: r.objetivos || [], tipo: 'codigo', ativo: true, ordem: 0 }));
}

export function looksAtivosOrdenados(fabricaLooks, objetivo) {
  return (fabricaLooks || [])
    .filter((l) => l.ativo !== false)
    .filter((l) => !objetivo || !(l.objetivos && l.objetivos.length) || l.objetivos.includes(objetivo))
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((l) => l.chave);
}
```

- [ ] **Step 4: Rodar e ver passar** — `node --test lib/looks.test.mjs` → PASS (2).

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/lib/looks.mjs coletor/lib/looks.test.mjs
git commit -m "feat(fabrica): lib/looks — sincronizarLooks + looksAtivosOrdenados puros (SP-5A)"
```

---

### Task 3: `gerar-criativos` lê `fabrica_looks` (soft-fail → fallback SP-3)

**Files:**
- Modify: `coletor/gerar-criativos.mjs`
- Modify: `coletor/gerar-criativos.test.mjs`

**Interfaces:**
- Consumes: `looksAtivosOrdenados` (Task 2); `TEMPLATES` (registry).
- Produces: quando o usuário não passou `--looks` explícito, `opts.looks` vem de `fabrica_looks` ativos (∩ `TEMPLATES`, exclui canva) cruzado com objetivo; fallback pro bloco SP-3 (registry + `objetivosDoTemplate`) se a tabela estiver vazia/indisponível. Promo só roda se `promo-number-hero` estiver ativo.

- [ ] **Step 1: Escrever o teste (falhando)**

Em `coletor/gerar-criativos.test.mjs`, adicionar (o `run` com dry+itens vazios já rejeita — testamos as puras via import; aqui garantimos que a assinatura não quebra e que o import de looks existe):
```js
test('gerar importa looksAtivosOrdenados (integra fabrica_looks)', async () => {
  const looks = await import('./lib/looks.mjs');
  assert.equal(typeof looks.looksAtivosOrdenados, 'function');
});
```
(A lógica de seleção é coberta pelos testes puros da Task 2; aqui o gate é o wiring do import + não-regressão da suíte.)

- [ ] **Step 2: Rodar e ver estado atual** — `cd /Users/erickmartins/iamundi/coletor && node --test gerar-criativos.test.mjs` (o novo teste passa trivialmente; o valor é a suíte inteira seguir verde após a mudança).

- [ ] **Step 3: Implementar no `run()`**

Em `coletor/gerar-criativos.mjs`:
1. Importar no topo: `import { looksAtivosOrdenados } from './lib/looks.mjs';`
2. Substituir o bloco atual do filtro por objetivo (hoje em ~L138-147) por:
```js
// SP-5A: os looks vêm de fabrica_looks (ativos, curados). Só filtra por objetivo quando o
// chamador não passou --looks explícito. Soft-fail: sem tabela/sem match, cai no fallback SP-3.
if (!(LOOKS && LOOKS.length)) {
  let usouTabela = false;
  try {
    const fabricaLooks = await sbGet('/fabrica_looks?select=chave,objetivos,ativo,ordem,tipo&order=ordem');
    const ativos = looksAtivosOrdenados(fabricaLooks, objetivo).filter((k) => TEMPLATES[k]); // só code-looks conhecidos
    if (ativos.length) { opts.looks = ativos; usouTabela = true; }
  } catch (e) {
    console.warn('aviso: fabrica_looks indisponível, fallback SP-3:', e.message);
  }
  if (!usouTabela && objetivo) {
    // fallback SP-3: registry + objetivosDoTemplate
    const { porChave } = await carregarObjetivos(sbGet);
    const row = mapaObjetivo(porChave, objetivo);
    const looksDisponiveis = Object.keys(TEMPLATES).filter((k) => { const o = objetivosDoTemplate(k); return o.length === 0 || o.includes(objetivo); });
    const permitidos = looksDoObjetivo(row, looksDisponiveis);
    if (permitidos.length) opts.looks = permitidos;
  }
}
```
3. Promo respeita a curadoria: na linha do loop de promo (`if (primeiraFoto && objetivoPermitePromo(objetivo)) {`), trocar por:
```js
const promoAtivo = !opts.looks || opts.looks.includes('promo-number-hero');
if (primeiraFoto && objetivoPermitePromo(objetivo) && promoAtivo) {
```

- [ ] **Step 4: Rodar a suíte inteira** — `cd /Users/erickmartins/iamundi/coletor && node --test` → tudo verde.

- [ ] **Step 5: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-criativos.mjs coletor/gerar-criativos.test.mjs
git commit -m "feat(fabrica): gerar lê looks de fabrica_looks (soft-fail fallback SP-3) + promo respeita curadoria (SP-5A)"
```

---

### Task 4: Edge `fabrica-looks` — salvar/ordenar/sync (gated)

**Files:**
- Create: `supabase/functions/fabrica-looks/index.ts`

**Interfaces:**
- Produces: `POST { acao:'salvar', look:{chave,nome?,objetivos?,ativo?} }` → update dos campos curáveis (por `chave`); `{ acao:'ordenar', ordem:[{chave,ordem}] }` → update de `ordem` em lote; `{ acao:'sync', registry:[{chave,nome,arquetipo,objetivos}] }` → insere os que faltam (não sobrescreve). Gate `meta.fabrica`. Não mexe em `tipo`/render.

- [ ] **Step 1: Implementar**

Create `supabase/functions/fabrica-looks/index.ts`:
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
    if (acao === "salvar") {
      const l = body.look || {};
      if (!l.chave) return json({ error: "chave_obrigatoria" }, 400);
      const patch: Record<string, unknown> = {};
      if (l.nome !== undefined) patch.nome = l.nome;
      if (l.objetivos !== undefined) patch.objetivos = l.objetivos;
      if (l.ativo !== undefined) patch.ativo = l.ativo;
      const { error } = await sb.from("fabrica_looks").update(patch).eq("chave", l.chave);
      if (error) return json({ error: "salvar_falhou", detail: error.message }, 500);
      return json({ ok: true });
    }
    if (acao === "ordenar") {
      for (const o of (body.ordem || [])) {
        if (o?.chave == null) continue;
        await sb.from("fabrica_looks").update({ ordem: o.ordem ?? 0 }).eq("chave", o.chave);
      }
      return json({ ok: true });
    }
    if (acao === "sync") {
      const registry = body.registry || [];
      const { data: existentes } = await sb.from("fabrica_looks").select("chave");
      const has = new Set((existentes || []).map((e: { chave: string }) => e.chave));
      const faltam = registry.filter((r: { chave: string }) => !has.has(r.chave))
        .map((r: any) => ({ chave: r.chave, nome: r.nome, arquetipo: r.arquetipo, objetivos: r.objetivos || [], tipo: "codigo", ativo: true, ordem: r.ordem ?? 0 }));
      if (faltam.length) { const { error } = await sb.from("fabrica_looks").insert(faltam); if (error) return json({ error: "sync_falhou", detail: error.message }, 500); }
      return json({ inseridos: faltam.length });
    }
    return json({ error: "acao_invalida" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
```

- [ ] **Step 2: (Deploy é checkpoint)** — escrever + commitar; controller deploya (verify_jwt=true) via MCP. Validar por leitura (gate 401/403; salvar patcha só campos curáveis; ordenar em lote; sync não sobrescreve).

- [ ] **Step 3: Commit**
```bash
cd /Users/erickmartins/iamundi
git add supabase/functions/fabrica-looks/index.ts
git commit -m "feat(fabrica): Edge fabrica-looks — salvar/ordenar/sync curadoria (gated) (SP-5A)"
```

---

### Task 5: Job de PREVIEW — `gerar-previews.mjs` + tipo no trigger/runner

**Files:**
- Create: `coletor/gerar-previews.mjs`
- Create: `coletor/gerar-previews.test.mjs`
- Modify: `coletor/fabrica-job-runner.mjs`
- Modify: `supabase/functions/fabrica-trigger/index.ts`

**Interfaces:**
- Consumes: `TEMPLATES`/`DIM` (registry), `renderPNG` (render-criativo), `variacoesProduto`/`variacoesPromo` (criativo-modelo).
- Produces: `dadosAmostra() -> { cand, campanha, fotoDataUrl }` (puro, testável); `run()` renderiza cada code-look nos 2 formatos com a amostra → sobe pro Storage `fabrica-criativos/_previews/<chave>-<formato>.png` → grava `fabrica_looks.preview_url` (a do formato 1080x1350). Runner dispatch `tipo:'preview'`; trigger aceita `preview` na whitelist.

- [ ] **Step 1: Teste da amostra (falhando)**

Create `coletor/gerar-previews.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dadosAmostra } from './gerar-previews.mjs';

test('dadosAmostra: cand e campanha de exemplo coerentes (De/Por + pct)', () => {
  const { cand, campanha } = dadosAmostra();
  assert.ok(cand.nome && cand.preco > 0);
  assert.equal(campanha.desconto_pct, 50);
  assert.ok(cand.sku);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd /Users/erickmartins/iamundi/coletor && node --test gerar-previews.test.mjs` → FAIL.

- [ ] **Step 3: Implementar `gerar-previews.mjs`**

Create `coletor/gerar-previews.mjs` (a foto de amostra: usar uma imagem embutida — reutilizar um asset já em `templates-criativos/assets/` como data URL; se não houver bolsa, usar um retângulo cinza data URL 1x1 ampliado — o preview é ilustrativo):
```js
import './lib/carregar-env.mjs';
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const BUCKET = 'fabrica-criativos';

// foto de amostra neutra (data URL PNG cinza) — preview é ilustrativo.
const FOTO_AMOSTRA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function dadosAmostra() {
  const cand = { sku: 'AMOSTRA', nome: 'Bolsa Modelo', categoria: 'bolsas', preco: 449.9, pct: 50 };
  const campanha = { nome: 'Amostra', desconto_pct: 50, desconto_tipo: 'fixo', parcelas: 10, marca: 'a marca' };
  return { cand, campanha, fotoDataUrl: FOTO_AMOSTRA };
}

async function sbPatch(p, body) { const r = await fetch(REST + p, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) }); if (!r.ok && ![200,204].includes(r.status)) throw new Error('PATCH ' + p + ' ' + r.status); }
async function subir(path, buf) {
  const up = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf });
  if (!up.ok && up.status !== 200) throw new Error('storage ' + up.status + ' ' + (await up.text()).slice(0, 120));
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function run() {
  const { cand, campanha, fotoDataUrl } = dadosAmostra();
  let n = 0;
  for (const chave of Object.keys(TEMPLATES)) {
    const arq = TEMPLATES[chave].arquetipo;
    const variants = arq === 'promo'
      ? variacoesPromo(campanha, fotoDataUrl, 'Coleção').filter((v) => v.template === chave)
      : variacoesProduto({ ...cand, fotoDataUrl }, campanha, { looks: [chave] }, 50);
    const v = variants[0];
    if (!v) { console.warn('sem variante p/', chave); continue; }
    let feedUrl = null;
    for (const formato of Object.keys(DIM)) {
      const html = TEMPLATES[chave].render(v.dados, formato);
      const buf = await renderPNG(html, DIM[formato]);
      const url = await subir(`_previews/${chave}-${formato}.png`, buf);
      if (formato === '1080x1350') feedUrl = url;
    }
    if (feedUrl) await sbPatch(`/fabrica_looks?chave=eq.${chave}`, { preview_url: feedUrl });
    n++;
  }
  await fecharRender();
  console.log(`previews gerados: ${n} looks`);
  return { previews: n };
}

if (import.meta.url === `file://${process.argv[1]}`) { run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); }); }
```
(Confirmar ao ler `DIM` que as chaves são `'1080x1350'` e `'1080x1920'`; ajustar se diferentes.)

- [ ] **Step 4: Rodar e ver passar** — `node --test gerar-previews.test.mjs` → PASS. (O render em si é validado no checkpoint via Actions; o teste puro cobre `dadosAmostra`.)

- [ ] **Step 5: Runner + trigger aceitam `preview`**

Em `coletor/fabrica-job-runner.mjs`: importar `import { run as previewRun } from './gerar-previews.mjs';` e adicionar um ramo `else if (job.tipo === 'preview') { const r = await previewRun(); await sbPatch('/fabrica_jobs?id=eq.'+job.id, { status: 'concluido', resultado: r }); }` (espelhar o padrão dos outros ramos; sem tocar campanha).
Em `supabase/functions/fabrica-trigger/index.ts`: incluir `'preview'` na whitelist `if (!["gerar","subir","ativar","preview"].includes(tipo))`. Preview não cria campanha nem grava objetivo (só o ramo gerar faz isso) — o bloco `if (tipo === "gerar" && ...)` já é gated por gerar, então preview passa direto pro insert do job + dispatch. [deploy = checkpoint]

- [ ] **Step 6: Commit**
```bash
cd /Users/erickmartins/iamundi
git add coletor/gerar-previews.mjs coletor/gerar-previews.test.mjs coletor/fabrica-job-runner.mjs supabase/functions/fabrica-trigger/index.ts
git commit -m "feat(fabrica): job preview — renderiza cada look com amostra p/ a galeria (SP-5A)"
```

---

### Task 6: Tela `/fabrica-estudio/looks` — galeria + curadoria

**Files:**
- Create: `src/ferramentas/meta-ads/tela-de-fabrica-looks.vue`
- Modify: `src/mapa-de-enderecos.js`
- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-home.vue`
- Modify: `src/ferramentas/meta-ads/estudio.css`

**Interfaces:**
- Consumes: `sb()` (lê `fabrica_looks`), Edge `fabrica-looks`, `fabrica-trigger` (tipo preview), `hasPermission`.
- Produces: rota `fabrica-looks` (`/fabrica-estudio/looks`); a Home linka pra cá.

- [ ] **Step 1: Rota**

Em `src/mapa-de-enderecos.js`, adicionar (perto das outras rotas fabrica-estudio):
```js
{ path: '/fabrica-estudio/looks', name: 'fabrica-looks', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-looks.vue') },
```

- [ ] **Step 2: Tela**

Create `src/ferramentas/meta-ads/tela-de-fabrica-looks.vue` (`.fest`; espelhar a estrutura de `tela-de-fabrica-home.vue` — topbar com "← Central"/"← Fábrica", gate no onMounted):
```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import './estudio.css'
const router = useRouter()
const OBJETIVOS = ['engajamento', 'conversao', 'branding', 'trafego']
const looks = ref([])
const gerandoPreview = ref(false)
async function carregar() {
  if (!hasPermission('module:meta:fabrica')) { router.push({ name: 'meta-ads' }); return }
  looks.value = await sb('fabrica_looks?select=*&order=ordem')
}
async function salvar(l) {
  const { error } = await sbClient.functions.invoke('fabrica-looks', { body: { acao: 'salvar', look: { chave: l.chave, nome: l.nome, objetivos: l.objetivos, ativo: l.ativo } } })
  if (error) { alert('Falha ao salvar: ' + error.message); carregar() }
}
function toggleObjetivo(l, o) { const i = l.objetivos.indexOf(o); i > -1 ? l.objetivos.splice(i, 1) : l.objetivos.push(o); salvar(l) }
function toggleAtivo(l) { l.ativo = !l.ativo; salvar(l) }
async function mover(l, dir) {
  const i = looks.value.findIndex((x) => x.chave === l.chave); const j = i + dir
  if (j < 0 || j >= looks.value.length) return
  const arr = looks.value; [arr[i], arr[j]] = [arr[j], arr[i]]
  const ordem = arr.map((x, idx) => ({ chave: x.chave, ordem: idx + 1 }))
  arr.forEach((x, idx) => { x.ordem = idx + 1 })
  await sbClient.functions.invoke('fabrica-looks', { body: { acao: 'ordenar', ordem } })
}
async function renomear(l) { const nome = prompt('Nome do look:', l.nome); if (nome && nome !== l.nome) { l.nome = nome; salvar(l) } }
async function gerarPreviews() {
  gerandoPreview.value = true
  const { error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'preview', params: {} } })
  gerandoPreview.value = false
  alert(error ? 'Falha: ' + error.message : 'Gerando previews — recarregue em ~1 min pra ver as imagens.')
}
function voltarCentral() { router.push({ name: 'inicio' }) }
function voltarFabrica() { router.push({ name: 'fabrica-estudio' }) }
onMounted(carregar)
</script>
<template>
  <div class="fest"><div class="shell">
    <header class="topbar">
      <button class="voltar-central" @click="voltarCentral">← Central</button>
      <button class="voltar-central" @click="voltarFabrica">← Fábrica</button>
      <div class="brand"><div class="t">Looks & Templates</div><div class="s">Curadoria</div></div>
      <div class="divider"></div>
      <button class="cmd cyan" :disabled="gerandoPreview" @click="gerarPreviews">Gerar previews</button>
    </header>
    <div class="panel">
      <div class="ph"><span class="eyebrow">Looks</span><span class="eyebrow muted">{{ looks.length }} · {{ looks.filter(l=>l.ativo).length }} ativos</span></div>
      <div class="looks-grid">
        <div v-for="(l, i) in looks" :key="l.chave" class="look-card" :class="{ off: !l.ativo }">
          <img v-if="l.preview_url" :src="l.preview_url" class="look-prev" loading="lazy">
          <div v-else class="look-prev ph-vazio">sem preview</div>
          <div class="look-nome">{{ l.nome }} <span class="cat">{{ l.arquetipo }}</span></div>
          <div class="look-objs">
            <label v-for="o in OBJETIVOS" :key="o" class="loja-chip" :class="{ sel: l.objetivos.includes(o) }">
              <input type="checkbox" :checked="l.objetivos.includes(o)" @change="toggleObjetivo(l, o)"> {{ o }}
            </label>
          </div>
          <div class="look-acoes">
            <button class="mini" @click="toggleAtivo(l)">{{ l.ativo ? 'Desativar' : 'Ativar' }}</button>
            <button class="mini" @click="renomear(l)">Renomear</button>
            <button class="mini" :disabled="i===0" @click="mover(l, -1)">↑</button>
            <button class="mini" :disabled="i===looks.length-1" @click="mover(l, 1)">↓</button>
          </div>
        </div>
      </div>
    </div>
  </div></div>
</template>
```

- [ ] **Step 3: CSS**

Em `src/ferramentas/meta-ads/estudio.css`, adicionar (`.fest`):
```css
.fest .looks-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px}
.fest .look-card{border:1px solid var(--edge); border-radius:var(--r); background:var(--panel-2); padding:10px; display:flex; flex-direction:column; gap:8px}
.fest .look-card.off{opacity:.5}
.fest .look-prev{width:100%; aspect-ratio:4/5; object-fit:cover; border-radius:8px; background:var(--panel); border:1px solid var(--edge)}
.fest .look-prev.ph-vazio{display:flex; align-items:center; justify-content:center; color:var(--ink-faint); font-size:12px}
.fest .look-nome{font-weight:600; font-size:13px} .fest .look-nome .cat{color:var(--ink-dim); font-weight:400; font-size:11px}
.fest .look-objs{display:flex; flex-wrap:wrap; gap:4px}
.fest .look-acoes{display:flex; gap:6px; flex-wrap:wrap; margin-top:auto}
.fest .mini{appearance:none; cursor:pointer; background:var(--panel); border:1px solid var(--edge); border-radius:6px; color:var(--ink-dim); font-size:12px; padding:5px 8px}
.fest .mini:hover:not(:disabled){border-color:var(--edge-hot)} .fest .mini:disabled{opacity:.4; cursor:default}
```

- [ ] **Step 4: Home linka pra cá**

Em `src/ferramentas/meta-ads/tela-de-fabrica-home.vue`, o card placeholder "Looks & Templates" (o `home-soon`) vira um link: trocar o bloco por um botão/card que faz `router.push({ name: 'fabrica-looks' })`. Manter a estética; tirar o `home-soon`/"em breve".

- [ ] **Step 5: Build** — `cd /Users/erickmartins/iamundi && npm run build 2>&1 | tail -6` → limpo.

- [ ] **Step 6: Commit**
```bash
cd /Users/erickmartins/iamundi
git add src/ferramentas/meta-ads/tela-de-fabrica-looks.vue src/mapa-de-enderecos.js src/ferramentas/meta-ads/tela-de-fabrica-home.vue src/ferramentas/meta-ads/estudio.css
git commit -m "feat(fabrica): tela Looks & Templates (galeria + curadoria) + link na Home (SP-5A)"
```

---

## Checkpoints do mundo real (controller + Breno)

1. **Aplicar migration 024** (`fabrica_looks` + seed dos 13) via MCP.
2. **Deploy Edge `fabrica-looks`** (verify_jwt=true) via MCP.
3. **Deploy `fabrica-trigger`** atualizada (whitelist `preview`) via MCP.
4. **Rodar o job de previews** (disparar tipo `preview` pela tela ou via Actions) e conferir que `fabrica_looks.preview_url` preenche e as imagens aparecem na galeria.
5. **Merge→main + push** (conta brenoov) → Vercel.

## Follow-up — Fase B (Canva) — NÃO planejada aqui

A Fase B (conectar Canva: autofill por produto + import de design pronto) vira um **plano próprio** DEPOIS de: (a) o Breno registrar o app **Canva Connect** (client id/secret + OAuth) e passar os secrets; (b) eu **verificar ao vivo** as chamadas reais da API do Canva (listar brand templates, dataset, create-design-from-brand-template com autofill, export/poll, upload asset) — evitando planejar contra uma API não testada (lição dos públicos do Meta no SP-4). Só então: `canva-proxy` (Edge), UI de mapear campos, e o ramo `tipo='canva'` no gerador.

## Testes (resumo)

- **node:test puros:** `looks.test.mjs` (sincronizarLooks/looksAtivosOrdenados), caso novo em `gerar-criativos.test.mjs` (wiring), `gerar-previews.test.mjs` (dadosAmostra). Suíte coletor inteira verde.
- **Edge:** `fabrica-looks` por deploy+smoke; `fabrica-trigger` (preview) por deploy.
- **Front:** `vite build` + smoke (galeria, toggle/ordem/rename/objetivos, gerar previews, link da Home).
- **Ao vivo (checkpoint):** previews renderizam e aparecem na galeria; desativar um look faz o gerador pular (conferir num gerar de teste `--dry`).

## Sequência

1 (migration) → 2 (lib/looks) → 3 (gerar lê tabela) → 4 (Edge fabrica-looks) → 5 (job preview) → 6 (tela galeria). Migration/deploy/previews/push nos checkpoints.
