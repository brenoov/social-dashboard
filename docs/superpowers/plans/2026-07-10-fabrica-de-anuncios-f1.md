# Fábrica de Anúncios — F1 (A lista sai certa) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar, em cima de um briefing real, que dá pra transformar a prosa do Gestor Comercial numa lista estruturada de produtos-anúncio (SKU + preço + estoque por loja), com pré-seleção por regra e curadoria humana numa tela dentro do módulo Meta Ads. **Sem Canva, sem Zoho, sem Meta** — só extração + enriquecimento Bling + tela de seleção.

**Architecture:** Um novo job do coletor (`coletor/fabrica-anuncios.mjs`, mesmo padrão de `gestor-comercial.mjs`) lê o último briefing de `gestao_comercial_briefings`, usa o Claude (Opus) pra extrair uma lista estruturada de candidatos, enriquece via os helpers já existentes do Bling (`coletor/lib/bling-comercial.mjs` → preço + estoque por depósito/loja) e grava em tabelas novas `fabrica_*`. Uma tela Vue nova (padrão reativo do `tela-de-menu-meta-ads.vue`) lê os candidatos agrupados por loja, mostra a pré-seleção e persiste a curadoria do usuário.

**Tech Stack:** Node 18+ (coletor, fetch nativo, sem deps novas), Postgres/Supabase (migrations via `coletor/run-migrations.mjs`), Vue 3 `<script setup>` + vue-router, Anthropic Messages API (`claude-opus-4-8`).

> **Nota sobre testes:** este repo é porte de um monólito e **não tem harness de testes unitários**. Verificação é feita rodando o código real e observando (queries SQL, execução do job com `--dry`, build + navegação), exatamente como a F1 do Gestor Comercial foi validada. Cada task termina com um passo de verificação concreto + commit.

## Global Constraints

- **Projeto Supabase:** `kounqtdoioootxqegkij` (host `db.kounqtdoioootxqegkij.supabase.co`).
- **Modelo IA:** `claude-opus-4-8`. Secret: `ANTHROPIC_API_KEY_FABRICA` com fallback `ANTHROPIC_API_KEY_GESTOR`. API: `https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`.
- **Lojas ativas (depósitos Bling):** Tivoli `14888726315`, Dom Pedro `14888617206`. **Atacado Nuvem Shop `14888248253` fica INATIVO** (fora da F1, mas cadastrado pra extensão futura).
- **Migrations:** arquivos em `db/migrations/NNN_nome.sql` (numérico sequencial — próximo é `014`), aplicados por `node coletor/run-migrations.mjs` (ordem alfabética, idempotente, registra em `public.schema_migrations`). Toda tabela com RLS: `authenticated` lê, escrita gated por `profiles.role='admin' OR profiles.permissions ? 'meta.fabrica'`, `service_role` faz tudo.
- **Env do coletor:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (⚠️ nome diferente do usado nas edge functions), `SUPABASE_ANON_KEY`, `GESTOR_USER_EMAIL`, `GESTOR_USER_PASSWORD` (conta de serviço p/ autorizar o `bling-proxy`). Já existem em `coletor/.env`.
- **Permissão do submódulo:** chave `meta.fabrica` (formato ponto) = `module:meta:fabrica` (formato legado). Regra do projeto: submódulo novo nasce como permissão própria gateada por admin.
- **Nomes de arquivo:** kebab-case em PT literal (padrão do repo: `tela-de-*.vue`, `fabrica-anuncios.mjs`).
- **Front → Bling:** o front NUNCA fala com o Bling; só lê/escreve as tabelas `fabrica_*`. O enriquecimento é do job.

---

### Task 1: Migração — tabelas `fabrica_*` + seed de lojas + RLS + pré-concessão

**Files:**
- Create: `db/migrations/014_fabrica_anuncios.sql`

**Interfaces:**
- Produces (tabelas que as próximas tasks consomem):
  - `public.fabrica_lojas(deposito_id text PK, nome text, ativo boolean, ordem int)`
  - `public.fabrica_rodadas(id uuid PK, rodada date, periodo text, briefing_id uuid, status text, created_at timestamptz)`
  - `public.fabrica_candidatos(id uuid PK, rodada_id uuid FK, sku text, nome text, categoria text, fonte text, angulo text, preco numeric, deposito_id text FK, loja_nome text, estoque int, selecionado boolean, created_at timestamptz)`
  - `fonte` ∈ {`oportunidade`,`estrela`,`interrogacao`,`garimpo`}. Unique `(rodada_id, sku, deposito_id)`.

- [ ] **Step 1: Escrever a migração**

Create `db/migrations/014_fabrica_anuncios.sql`:

```sql
-- 014_fabrica_anuncios.sql
-- Fábrica de Anúncios — F1: tabelas de candidatos extraídos do briefing do Gestor.
-- Idempotente. RLS: authenticated lê; escreve quem for admin OU tiver meta.fabrica; service_role total.

-- ── Lojas (lookup por depósito Bling; extensível) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_lojas (
  deposito_id text PRIMARY KEY,
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  ordem       int NOT NULL DEFAULT 0
);

INSERT INTO public.fabrica_lojas (deposito_id, nome, ativo, ordem) VALUES
  ('14888726315', 'Tivoli (Santa Bárbara)', true,  1),
  ('14888617206', 'Shopping Dom Pedro',     true,  2),
  ('14888248253', 'Atacado Nuvem Shop',     false, 3)
ON CONFLICT (deposito_id) DO UPDATE SET nome = EXCLUDED.nome, ativo = EXCLUDED.ativo, ordem = EXCLUDED.ordem;

-- ── Rodadas (uma por briefing processado) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_rodadas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada      date NOT NULL,
  periodo     text,
  briefing_id uuid,
  status      text NOT NULL DEFAULT 'rascunho',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fab_rodadas_rodada ON public.fabrica_rodadas (rodada DESC);

-- ── Candidatos (produto × loja) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fabrica_candidatos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada_id    uuid NOT NULL REFERENCES public.fabrica_rodadas (id) ON DELETE CASCADE,
  sku          text,
  nome         text NOT NULL,
  categoria    text,
  fonte        text NOT NULL,
  angulo       text,
  preco        numeric,
  deposito_id  text NOT NULL REFERENCES public.fabrica_lojas (deposito_id),
  loja_nome    text NOT NULL,
  estoque      int NOT NULL DEFAULT 0,
  selecionado  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodada_id, sku, deposito_id)
);
CREATE INDEX IF NOT EXISTS idx_fab_cand_rodada ON public.fabrica_candidatos (rodada_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.fabrica_lojas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_rodadas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_candidatos ENABLE ROW LEVEL SECURITY;

-- helper de gate de escrita: admin OU permissão meta.fabrica
-- (profiles.permissions é jsonb objeto recurso->ações; '? chave' = a chave existe)
DROP POLICY IF EXISTS fab_lojas_read ON public.fabrica_lojas;
CREATE POLICY fab_lojas_read ON public.fabrica_lojas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_rodadas_read ON public.fabrica_rodadas;
CREATE POLICY fab_rodadas_read ON public.fabrica_rodadas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_cand_read ON public.fabrica_candidatos;
CREATE POLICY fab_cand_read ON public.fabrica_candidatos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fab_cand_update ON public.fabrica_candidatos;
CREATE POLICY fab_cand_update ON public.fabrica_candidatos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND (p.role = 'admin' OR p.is_superadmin = true OR p.permissions ? 'meta.fabrica')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND (p.role = 'admin' OR p.is_superadmin = true OR p.permissions ? 'meta.fabrica')));

-- service_role total (o job do coletor grava com service key)
DROP POLICY IF EXISTS fab_lojas_srv ON public.fabrica_lojas;
CREATE POLICY fab_lojas_srv ON public.fabrica_lojas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_rodadas_srv ON public.fabrica_rodadas;
CREATE POLICY fab_rodadas_srv ON public.fabrica_rodadas FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS fab_cand_srv ON public.fabrica_candidatos;
CREATE POLICY fab_cand_srv ON public.fabrica_candidatos FOR ALL USING (auth.role() = 'service_role');

-- ── Pré-concessão da permissão nova aos admins (chave nova = pré-conceder) ──
UPDATE public.profiles
SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{meta.fabrica}', '["ver","editar"]'::jsonb, true)
WHERE role = 'admin';
```

- [ ] **Step 2: Aplicar a migração (dry-run primeiro)**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node run-migrations.mjs --dry
```
Expected: lista incluindo `014_fabrica_anuncios.sql` como pendente, sem aplicar.

- [ ] **Step 3: Aplicar de verdade**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node run-migrations.mjs
```
Expected: `014_fabrica_anuncios.sql` aplicado, registrado em `schema_migrations`.

- [ ] **Step 4: Verificar tabelas e seed**

Run (psql via DATABASE_URL do coletor/.env, ou o MCP Supabase `execute_sql` no projeto `kounqtdoioootxqegkij`):
```sql
SELECT deposito_id, nome, ativo FROM public.fabrica_lojas ORDER BY ordem;
```
Expected: 3 linhas; Tivoli e Dom Pedro `ativo=true`, Atacado `ativo=false`.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add db/migrations/014_fabrica_anuncios.sql
git commit -m "feat(fabrica): tabelas fabrica_lojas/rodadas/candidatos + RLS + seed lojas"
```

---

### Task 2: Declarar a permissão `meta.fabrica` no front

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js` (RECURSOS ~L58, _legado ~L71, hasPermission meta ~L80, PERMISSION_TREE ~L96-99)

**Interfaces:**
- Consumes: nada.
- Produces: `hasPermission('module:meta:fabrica')` e `hasPermission('meta.fabrica','ver'/'editar')` funcionando; `hasPermission('tool:meta')` passa a considerar `meta.fabrica` como filho.

- [ ] **Step 1: Adicionar o recurso em RECURSOS**

Em `src/compartilhado/controle-de-login-e-usuario.js`, logo após a linha do `meta.gestor` (L59), adicionar:

```js
  { key: 'meta.gestor', label: 'Gestão de Tráfego', acoes: ['ver', 'editar'] },
  { key: 'meta.fabrica', label: 'Fábrica de Anúncios', acoes: ['ver', 'editar'] },
```

- [ ] **Step 2: Adicionar a ponte legada em _legado**

Na constante `_legado`, na linha das chaves de meta (L71), adicionar `module:meta:fabrica`:

```js
  'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor', 'module:meta:fabrica': 'meta.fabrica',
```

- [ ] **Step 3: Incluir meta.fabrica na regra do pai `meta`**

Em `hasPermission` (L80), incluir `'meta.fabrica'` no array do grupo meta:

```js
  if (key === 'meta') return ['meta.campanha', 'meta.gestor', 'meta.fabrica'].some(k => (estado.permissions[k] || []).includes('ver'))
```

- [ ] **Step 4: Adicionar o nó na PERMISSION_TREE**

No nó `meta` da `PERMISSION_TREE` (L96-99), adicionar o filho:

```js
  { key: 'meta', label: 'Meta Ads', children: [
    { key: 'meta.campanha', label: 'Análise de Campanhas' },
    { key: 'meta.gestor', label: 'Gestão de Tráfego' },
    { key: 'meta.fabrica', label: 'Fábrica de Anúncios' },
  ] },
```

- [ ] **Step 5: Verificar que o build não quebra**

Run:
```bash
cd /Users/erickmartins/iamundi && npm run build
```
Expected: build conclui sem erro (o editor de permissões do admin passa a listar "Fábrica de Anúncios" automaticamente, pois lê `RECURSOS`).

- [ ] **Step 6: Commit**

```bash
git add src/compartilhado/controle-de-login-e-usuario.js
git commit -m "feat(fabrica): permissao meta.fabrica (RECURSOS + arvore + ponte legada)"
```

---

### Task 3: Job do coletor — extração IA do briefing (com `--dry`)

**Files:**
- Create: `coletor/fabrica-anuncios.mjs`

**Interfaces:**
- Consumes: `loginServico`, `blingProdutos`, `blingSaldoFoco`, `classificarItem`, `DEP_FOCO` de `./lib/bling-comercial.mjs` (assinaturas já existentes).
- Produces (nesta task, só a metade de extração):
  - `async function buscarUltimoBriefing(): Promise<{ id, rodada, periodo, conteudo, dados_json }>`
  - `async function extrairCandidatos(briefing): Promise<Array<{ sku: string|null, nome: string, fonte: string, angulo: string }>>`
  - `fonte` normalizado ∈ {`oportunidade`,`estrela`,`interrogacao`,`garimpo`}.
  - Rodar com `--dry` imprime a lista extraída e NÃO grava nada.

- [ ] **Step 1: Escrever o esqueleto do job + extração**

Create `coletor/fabrica-anuncios.mjs`:

```js
#!/usr/bin/env node
// coletor/fabrica-anuncios.mjs
// F1 da Fábrica de Anúncios: lê o último briefing do Gestor, extrai candidatos
// (IA), enriquece via Bling (preço + estoque por loja) e grava fabrica_*.
// Padrão herdado de gestor-comercial.mjs. Sem deps externas (fetch nativo).
//
// Uso:
//   node fabrica-anuncios.mjs         # roda completo (extrai + enriquece + grava)
//   node fabrica-anuncios.mjs --dry   # só imprime o que extrairia/gravaria, sem escrever

import { loginServico, blingProdutos, blingSaldoFoco, classificarItem, DEP_FOCO } from './lib/bling-comercial.mjs';

// ── carrega coletor/.env (mesmo parser simples do run-migrations) ──
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
(function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const DRY = process.argv.includes('--dry');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = SUPABASE_URL + '/rest/v1';
const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_FABRICA || process.env.ANTHROPIC_API_KEY_GESTOR;
const MODEL = process.env.FABRICA_MODEL || 'claude-opus-4-8';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── REST helpers (service key) ──
async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sbHeaders });
  if (!r.ok) throw new Error('REST GET ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

// ── Último briefing do Gestor ──
async function buscarUltimoBriefing() {
  const rows = await sbGet('/gestao_comercial_briefings?select=id,rodada,periodo,conteudo,dados_json&order=rodada.desc&limit=1');
  if (!rows.length) throw new Error('nenhum briefing em gestao_comercial_briefings');
  return rows[0];
}

// ── Anthropic (retry, herdado de gestor-comercial.mjs) ──
async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) { await sleep(1500 * (t + 1)); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (t + 1)); continue; }
    throw new Error('Anthropic ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  throw new Error('Anthropic falhou após retries');
}

// Normaliza a fonte que o modelo devolve pra um vocabulário fixo.
function normalizarFonte(f) {
  const n = (f || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('oportunidade')) return 'oportunidade';
  if (n.includes('estrela')) return 'estrela';
  if (n.includes('interrog')) return 'interrogacao';
  if (n.includes('garimpo')) return 'garimpo';
  return 'garimpo'; // default conservador
}

// ── Extração IA: prosa do briefing → lista estruturada ──
async function extrairCandidatos(briefing) {
  const sys = 'Você é um extrator de dados. Lê o briefing comercial semanal (markdown) e devolve APENAS os produtos que valem virar anúncio nesta semana. Não invente produtos. Ignore itens da matriz "Abacaxi" (baixo giro sem ângulo). Responda SOMENTE com um bloco ```json contendo um array.';
  const user = [
    'Briefing (markdown):', '"""', (briefing.conteudo || '').slice(0, 24000), '"""',
    '',
    'Dados estruturados do briefing (se houver):',
    JSON.stringify(briefing.dados_json || {}).slice(0, 6000),
    '',
    'Extraia os produtos-anúncio. Para cada um devolva:',
    '- "sku": o código/SKU do Bling se aparecer no texto (ex.: "LV108-Sand Liz"); senão null',
    '- "nome": nome do produto como no briefing',
    '- "fonte": um de "oportunidade" (Oportunidades da Semana), "estrela", "interrogacao", "garimpo" (garimpo do Gestor)',
    '- "angulo": a frase curta de venda/argumento que o briefing sugere pra esse item',
    '',
    'Formato exato: ```json\n[{"sku":"...","nome":"...","fonte":"...","angulo":"..."}]\n```',
  ].join('\n');

  const resp = await anthropic({ model: MODEL, max_tokens: 4000, system: sys, messages: [{ role: 'user', content: user }] });
  const texto = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const m = texto.match(/```json\s*([\s\S]*?)```/);
  const cru = m ? m[1] : texto;
  let arr;
  try { arr = JSON.parse(cru.trim()); } catch (e) { throw new Error('extração não devolveu JSON válido: ' + texto.slice(0, 300)); }
  if (!Array.isArray(arr)) throw new Error('extração não devolveu array');
  return arr
    .filter(x => x && x.nome)
    .map(x => ({ sku: x.sku ? String(x.sku).trim() : null, nome: String(x.nome).trim(), fonte: normalizarFonte(x.fonte), angulo: (x.angulo || '').toString().trim() }));
}

// ── main (nesta task, só extração; enriquecimento/gravação vêm na Task 4) ──
async function main() {
  const token = await loginServico();
  console.log('login serviço ok');
  const briefing = await buscarUltimoBriefing();
  console.log('briefing:', briefing.rodada, '—', briefing.periodo);
  const candidatos = await extrairCandidatos(briefing);
  console.log('candidatos extraídos:', candidatos.length);
  for (const c of candidatos) console.log(`  [${c.fonte}] ${c.nome} (sku=${c.sku || '—'}) :: ${c.angulo.slice(0, 60)}`);
  if (DRY) { console.log('\n(--dry) parando antes de enriquecer/gravar.'); return; }
  console.log('\n(TODO Task 4: enriquecer via Bling + gravar)');
}

main().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });

export { buscarUltimoBriefing, extrairCandidatos, normalizarFonte };
```

- [ ] **Step 2: Rodar em modo dry pra ver a extração no briefing real**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node fabrica-anuncios.mjs --dry
```
Expected: imprime `login serviço ok`, a rodada do último briefing, e uma lista de candidatos com `[fonte] nome (sku=...) :: angulo`. Confira manualmente que os produtos citados no briefing (ex.: Carteira Londres, Necessaire, Canvas premium) aparecem com fonte coerente e nenhum "Abacaxi".

- [ ] **Step 3: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/fabrica-anuncios.mjs
git commit -m "feat(fabrica): job coletor - extracao IA de candidatos do briefing (--dry)"
```

---

### Task 4: Job do coletor — enriquecimento Bling + gravação

**Files:**
- Modify: `coletor/fabrica-anuncios.mjs` (adicionar enriquecimento + persistência; completar `main`)

**Interfaces:**
- Consumes: `extrairCandidatos` (Task 3), `blingProdutos`/`blingSaldoFoco` de `./lib/bling-comercial.mjs`, tabelas da Task 1.
- Produces: linhas em `fabrica_rodadas` (1) e `fabrica_candidatos` (produto × loja ativa com estoque > 0), com `selecionado` pré-marcado pela regra.

- [ ] **Step 1: Adicionar POST helper, lojas ativas, matching e regra de seleção**

Em `coletor/fabrica-anuncios.mjs`, adicionar após `sbGet` (perto do topo):

```js
async function sbPost(path, body, prefer) {
  const r = await fetch(REST + path, { method: 'POST', headers: prefer ? { ...sbHeaders, Prefer: prefer } : sbHeaders, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('REST POST ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

// Lojas ativas (depósitos) lidas da tabela — respeita o toggle ativo/extensível.
async function lojasAtivas() {
  const rows = await sbGet('/fabrica_lojas?select=deposito_id,nome,ativo&ativo=eq.true&order=ordem');
  return rows; // [{deposito_id, nome, ativo}]
}

// Regra de pré-seleção (default A): oportunidade/estrela/interrogacao/garimpo entram marcados.
function preSelecionar(fonte) { return ['oportunidade', 'estrela', 'interrogacao', 'garimpo'].includes(fonte); }

// Casa um candidato extraído com o produto do Bling (por código/SKU, depois por nome).
function casarProduto(cand, prodPorCodigo, prodPorId) {
  if (cand.sku) {
    const chave = cand.sku.toUpperCase();
    if (prodPorCodigo[chave]) return prodPorCodigo[chave];
    // prefixo (SKU do briefing pode vir com sufixo de cor/variação)
    const pref = Object.keys(prodPorCodigo).find(k => chave.startsWith(k) || k.startsWith(chave));
    if (pref) return prodPorCodigo[pref];
  }
  // fallback por nome (contains, normalizado)
  const alvo = cand.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hit = Object.values(prodPorId).find(p => {
    const n = (p.nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return n && (n.includes(alvo) || alvo.includes(n));
  });
  return hit || null;
}
```

- [ ] **Step 2: Completar o `main` com enriquecimento + gravação**

Substituir o corpo do `main` (da linha `if (DRY) {...}` em diante) por:

```js
  // 1) catálogo Bling: id->{nome,codigo,preco} e índice por código (SKU)
  const prodPorId = await blingProdutos(token);
  const prodPorCodigo = {};
  for (const [id, p] of Object.entries(prodPorId)) {
    p.id = id;
    if (p.codigo) prodPorCodigo[p.codigo.toUpperCase()] = p;
  }
  console.log('produtos Bling:', Object.keys(prodPorId).length);

  // 2) saldo por depósito
  const saldoPorDep = await blingSaldoFoco(token, prodPorId);

  // 3) lojas ativas
  const lojas = await lojasAtivas();
  console.log('lojas ativas:', lojas.map(l => l.nome).join(', '));

  // 4) monta linhas produto × loja (só onde há estoque)
  const linhas = [];
  const semMatch = [];
  for (const c of candidatos) {
    const prod = casarProduto(c, prodPorCodigo, prodPorId);
    if (!prod) { semMatch.push(c.nome); continue; }
    for (const loja of lojas) {
      const saldo = (saldoPorDep[loja.deposito_id] || {})[prod.id] || 0;
      if (saldo <= 0) continue;
      linhas.push({
        sku: prod.codigo || c.sku || null,
        nome: prod.nome || c.nome,
        categoria: classificarItem(prod.nome || c.nome),
        fonte: c.fonte,
        angulo: c.angulo,
        preco: prod.preco || null,
        deposito_id: loja.deposito_id,
        loja_nome: loja.nome,
        estoque: saldo,
        selecionado: preSelecionar(c.fonte),
      });
    }
  }
  console.log('linhas produto×loja:', linhas.length, '| sem match no Bling:', semMatch.length, semMatch.slice(0, 8));

  if (DRY) { console.log('\n(--dry) não gravou.'); return; }

  // 5) grava rodada + candidatos
  const rRod = await sbPost('/fabrica_rodadas',
    [{ rodada: briefing.rodada, periodo: briefing.periodo, briefing_id: briefing.id, status: 'rascunho' }],
    'return=representation');
  const rodada = (await rRod.json())[0];
  const comRodada = linhas.map(l => ({ ...l, rodada_id: rodada.id }));
  // insere em lotes de 200
  for (let i = 0; i < comRodada.length; i += 200) {
    await sbPost('/fabrica_candidatos', comRodada.slice(i, i + 200), 'return=minimal');
  }
  console.log('gravado: rodada', rodada.id, 'com', comRodada.length, 'candidatos.');
```

- [ ] **Step 3: Rodar dry (agora mostra as linhas produto×loja com estoque)**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node fabrica-anuncios.mjs --dry
```
Expected: além dos candidatos, imprime `produtos Bling: N`, `lojas ativas: Tivoli..., Shopping Dom Pedro`, e `linhas produto×loja: M | sem match no Bling: K [...]`. Verifique que M > 0 e que os "sem match" fazem sentido (produtos do briefing sem SKU claro).

- [ ] **Step 4: Rodar de verdade e conferir no banco**

Run:
```bash
cd /Users/erickmartins/iamundi/coletor && node fabrica-anuncios.mjs
```
Then (SQL via MCP Supabase `execute_sql` no projeto `kounqtdoioootxqegkij` ou psql):
```sql
SELECT loja_nome, fonte, count(*), sum(estoque) AS estoque, count(*) FILTER (WHERE selecionado) AS marcados
FROM public.fabrica_candidatos
WHERE rodada_id = (SELECT id FROM public.fabrica_rodadas ORDER BY created_at DESC LIMIT 1)
GROUP BY loja_nome, fonte ORDER BY loja_nome, fonte;
```
Expected: linhas por loja/fonte, `marcados` > 0 (pré-seleção funcionou), só lojas Tivoli/Dom Pedro (nunca Atacado), todo estoque > 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/erickmartins/iamundi
git add coletor/fabrica-anuncios.mjs
git commit -m "feat(fabrica): enriquecimento Bling (preco+estoque/loja) + gravacao de candidatos"
```

---

### Task 5: Tela Vue — seção "Fábrica de Anúncios" (leitura + agrupamento por loja)

**Files:**
- Create: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`
- Modify: `src/mapa-de-enderecos.js` (adicionar rota)
- Modify: `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue` (adicionar card gated)

**Interfaces:**
- Consumes: tabelas `fabrica_rodadas`/`fabrica_candidatos` (Task 1/4); `hasPermission` (Task 2); `sb()` helper (`buscar-e-salvar-dados.js`).
- Produces: rota `name: 'fabrica-anuncios'`; card no hub; tela que lista candidatos da última rodada agrupados por loja com checkbox refletindo `selecionado` (persistência é a Task 6).

- [ ] **Step 1: Criar o componente da tela (leitura)**

Create `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`:

```vue
<template>
  <div class="tela-fabrica">
    <div class="smenu-topbar">
      <button class="smenu-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Meta Ads
      </button>
      <span class="smenu-title">Fábrica de Anúncios</span>
      <span class="fab-rodada">{{ rodadaLabel }}</span>
    </div>

    <div class="fab-body">
      <p v-if="carregando" class="fab-msg">Carregando…</p>
      <p v-else-if="!lojas.length" class="fab-msg">Nenhuma rodada disponível. Rode o job <code>coletor/fabrica-anuncios.mjs</code>.</p>

      <div v-for="loja in lojas" :key="loja.nome" class="fab-loja">
        <h3>{{ loja.nome }} <span class="fab-cont">{{ loja.itens.filter(i => i.selecionado).length }}/{{ loja.itens.length }}</span></h3>
        <label v-for="item in loja.itens" :key="item.id" class="fab-item">
          <input type="checkbox" :checked="item.selecionado" @change="alternar(item, $event.target.checked)" />
          <span class="fab-tag" :data-fonte="item.fonte">{{ item.fonte }}</span>
          <span class="fab-nome">{{ item.nome }}</span>
          <span class="fab-preco">{{ item.preco ? ('R$ ' + Number(item.preco).toFixed(2)) : '—' }}</span>
          <span class="fab-estoque">{{ item.estoque }} un</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'

const router = useRouter()
const carregando = ref(true)
const rodadaLabel = ref('')
const candidatos = ref([])

function voltar() { router.push({ name: 'meta-ads' }) }

// Agrupa candidatos por loja (nome), preservando a ordem de chegada.
const lojas = computed(() => {
  const mapa = new Map()
  for (const c of candidatos.value) {
    if (!mapa.has(c.loja_nome)) mapa.set(c.loja_nome, { nome: c.loja_nome, itens: [] })
    mapa.get(c.loja_nome).itens.push(c)
  }
  return [...mapa.values()]
})

async function carregar() {
  carregando.value = true
  // última rodada
  const rod = await sb('fabrica_rodadas?select=id,rodada,periodo&order=created_at.desc&limit=1')
  if (!rod.length) { carregando.value = false; return }
  rodadaLabel.value = rod[0].periodo || rod[0].rodada
  candidatos.value = await sb(`fabrica_candidatos?select=id,sku,nome,fonte,angulo,preco,loja_nome,estoque,selecionado&rodada_id=eq.${rod[0].id}&order=loja_nome,fonte`)
  carregando.value = false
}

// Placeholder — a persistência real entra na Task 6.
function alternar(item, valor) { item.selecionado = valor }

onMounted(() => {
  if (!hasPermission('module:meta:fabrica')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  carregar()
})
</script>

<style scoped>
.tela-fabrica{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;}
.tela-fabrica .smenu-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);gap:16px;position:sticky;top:0;z-index:10;}
.tela-fabrica .smenu-back{font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:5px 10px;display:flex;align-items:center;gap:5px;}
.tela-fabrica .smenu-title{font-family:'Oswald',sans-serif;font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.fab-rodada{font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);}
.fab-body{flex:1;padding:24px;max-width:820px;margin:0 auto;width:100%;}
.fab-msg{color:var(--muted);font-family:'IBM Plex Sans',sans-serif;font-size:13px;}
.fab-loja{margin-bottom:26px;}
.fab-loja h3{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;}
.fab-cont{font-size:11px;color:var(--muted);font-family:'IBM Plex Sans',sans-serif;letter-spacing:0;}
.fab-item{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;cursor:pointer;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);}
.fab-item:hover{background:var(--accent-light);}
.fab-tag{font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--border);color:var(--muted);}
.fab-tag[data-fonte="oportunidade"]{background:#dcfce7;color:#166534;}
.fab-tag[data-fonte="estrela"]{background:#fef9c3;color:#854d0e;}
.fab-tag[data-fonte="interrogacao"]{background:#e0e7ff;color:#3730a3;}
.fab-nome{flex:1;}
.fab-preco{font-variant-numeric:tabular-nums;color:var(--text);}
.fab-estoque{font-size:11px;color:var(--muted);min-width:52px;text-align:right;}
@media(max-width:640px){
  .fab-item{flex-wrap:wrap;gap:8px;}
  .fab-nome{flex-basis:100%;order:5;}
}
</style>
```

- [ ] **Step 2: Registrar a rota**

Em `src/mapa-de-enderecos.js`, após a linha do `gestao-trafego` (L15), adicionar:

```js
  { path: '/fabrica-anuncios', name: 'fabrica-anuncios', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue') },
```

- [ ] **Step 3: Adicionar o card no hub Meta Ads**

Em `src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue`, após o card de Gestão de Tráfego (fecha na L49), adicionar dentro de `.smenu-cards`:

```vue
        <div class="smenu-card" v-if="hasPermission('module:meta:fabrica')" @click="ir('fabrica-anuncios')">
          <span class="smenu-card-num">03</span>
          <div class="smenu-card-icon" style="background:linear-gradient(135deg,#ea580c,#db2777)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <div class="smenu-card-title">Fábrica de Anúncios</div>
          <div class="smenu-card-desc">Do briefing do Gestor aos criativos e campanhas: selecione produtos por loja e aprove antes de subir.</div>
          <span class="smenu-card-enter">→</span>
        </div>
```

- [ ] **Step 4: Verificar build + navegação**

Run:
```bash
cd /Users/erickmartins/iamundi && npm run build && npm run preview
```
Expected: build ok. No navegador (logado como admin), Central → Meta Ads mostra o card "Fábrica de Anúncios" (03); clicando, a tela lista os candidatos da última rodada agrupados por Tivoli e Dom Pedro, com fonte, preço, estoque e checkboxes já marcados conforme a pré-seleção. (Alternar ainda NÃO persiste — Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue src/mapa-de-enderecos.js src/ferramentas/meta-ads/tela-de-menu-meta-ads.vue
git commit -m "feat(fabrica): tela de selecao (leitura + agrupamento por loja) + rota + card"
```

---

### Task 6: Tela Vue — persistir a curadoria (`selecionado`)

**Files:**
- Modify: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue` (função `alternar` + import do client)

**Interfaces:**
- Consumes: RLS de UPDATE da Task 1 (authenticated com permissão `meta.fabrica`); `sbClient` de `conectar-no-banco-de-dados.js`.
- Produces: toggle do checkbox grava `fabrica_candidatos.selecionado` no banco.

- [ ] **Step 1: Importar o client e reescrever `alternar`**

Em `tela-de-fabrica-de-anuncios.vue`, no `<script setup>`, adicionar o import:

```js
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
```

E substituir a função placeholder por uma que persiste com rollback otimista:

```js
async function alternar(item, valor) {
  const anterior = item.selecionado
  item.selecionado = valor // otimista
  const { error } = await sbClient.from('fabrica_candidatos').update({ selecionado: valor }).eq('id', item.id)
  if (error) {
    item.selecionado = anterior // desfaz
    adminToast('Não foi possível salvar a seleção', false)
  }
}
```

- [ ] **Step 2: Verificar persistência ponta a ponta**

Run:
```bash
cd /Users/erickmartins/iamundi && npm run build && npm run preview
```
Then no navegador (admin): abra a Fábrica de Anúncios, desmarque um item, recarregue a página (F5). Expected: o item continua desmarcado (persistiu). Marque de novo e confirme via SQL:
```sql
SELECT nome, loja_nome, selecionado FROM public.fabrica_candidatos
WHERE id = '<id-do-item>';
```
Expected: `selecionado` reflete o último clique.

- [ ] **Step 3: Verificar o gate de permissão (negativo)**

Logado como um usuário SEM `meta.fabrica` (nem admin), a rota `/fabrica-anuncios` deve redirecionar pra Central e o card não aparece no hub. Se tiver só um usuário admin à mão, valide ao menos que o `onMounted` redireciona quando `hasPermission('module:meta:fabrica')` é falso (pode simular temporariamente forçando `false` no if e revertendo).

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue
git commit -m "feat(fabrica): persistir curadoria (update selecionado com rollback otimista)"
```

---

## Definition of Done (F1)

- `node coletor/fabrica-anuncios.mjs` roda no briefing real e popula `fabrica_candidatos` com produto × loja (Tivoli/Dom Pedro) só onde há estoque, preço vindo do Bling e `selecionado` pré-marcado pela regra.
- A seção "Fábrica de Anúncios" aparece no hub Meta Ads (gated por `meta.fabrica`), lista os candidatos agrupados por loja e a curadoria (marcar/desmarcar) persiste no banco.
- Nada de Canva/Zoho/Meta ainda (F2/F3).

## Follow-ups conhecidos (não são F1)

- **F2:** motor de criativos (Canva Autofill vs Claude gera arte — decisão em aberto no spec) + Zoho. **Bloqueador conhecido:** o Bling não expõe foto de produto hoje; resolver a fonte da imagem antes/na F2.
- **F3:** criação de campanha no Meta (por loja), estrutura/verba/público.
- **Promos guarda-chuva** ("50% OFF - Sales", "Toda a loja") entram junto com o motor de criativos (F2), não na F1.
- **Cron:** o job já nasce pronto pra ser agendado (GitHub Actions), mas na F1 dispara na mão.
