# Gestor Comercial — F1 (backend do agente) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente autônomo semanal que coleta números comerciais reais (faturamento R$ do Bling, metas, concorrentes) e grava um briefing estratégico de gestor comercial no Supabase.

**Architecture:** Script Node (sem deps além de `pg` já instalado; usa `fetch` nativo) rodando no GitHub Actions (cron semanal). Autentica como conta de serviço no Supabase → chama o edge function `bling-proxy` (já existente) pra faturamento por canal → lê metas/concorrentes via REST → manda os números pro Claude (Opus 4.8) que escreve o briefing → grava em `gestao_comercial_briefings`. Observabilidade em `gestor_log`. A tela do dashboard é a F2 (plano separado).

**Tech Stack:** Node 20 (fetch nativo), Postgres/`pg` (runner de migrations já existe), Supabase REST + Auth + edge function `bling-proxy`, Anthropic Messages API (Opus 4.8), GitHub Actions.

---

## File Structure

- Create: `docs/migrations/011_gestao_comercial.sql` — tabelas `gestao_comercial_briefings` + `gestor_log`
- Create: `coletor/lib/meta-pace.mjs` — funções puras de cálculo de ritmo de meta (testável)
- Create: `coletor/lib/meta-pace.test.mjs` — testes unitários do cálculo (Node test runner)
- Create: `coletor/gestor-comercial.mjs` — agente principal (auth + coleta + Claude + grava)
- Create: `.github/workflows/gestor-comercial.yml` — cron semanal (segunda 11:00 UTC)
- Modify: `coletor/.env.exemplo` — documentar novas variáveis
- Reuse: `coletor/run-migrations.mjs`, `coletor/supabase-ca.crt`

**Constantes compartilhadas (canais foco)** — usadas no agente:
```
Tivoli  = Loja Santa Bárbara d'Oeste → loja_id 205834140
Dom Pedro = Loja Dom Pedro          → loja_id 205657609
Atacado  = Atacado Nuvem Shop        → loja_id 205451611
```

---

## Task 1: Migration — tabelas do gestor

**Files:**
- Create: `docs/migrations/011_gestao_comercial.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- docs/migrations/011_gestao_comercial.sql
-- Agente Gestor Comercial: briefings semanais + log de bordo.

CREATE TABLE IF NOT EXISTS public.gestao_comercial_briefings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada      date NOT NULL DEFAULT current_date,
  periodo     text,
  resumo      text,
  conteudo    text NOT NULL,
  dados_json  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcb_rodada ON public.gestao_comercial_briefings (rodada DESC);
ALTER TABLE public.gestao_comercial_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gcb_select ON public.gestao_comercial_briefings;
CREATE POLICY gcb_select ON public.gestao_comercial_briefings
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gestor_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at      timestamptz NOT NULL DEFAULT now(),
  fase        text,
  erro        text,
  detalhe     text
);
CREATE INDEX IF NOT EXISTS idx_gestor_log_run_at ON public.gestor_log (run_at DESC);
ALTER TABLE public.gestor_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gestor_log_select ON public.gestor_log;
CREATE POLICY gestor_log_select ON public.gestor_log
  FOR SELECT TO authenticated USING (true);
```

- [ ] **Step 2: Aplicar via runner**

Run: `cd coletor && npm run migrate`
Expected: `→ 011_gestao_comercial.sql … OK` e `✓ 1 migration(s) aplicada(s).`

- [ ] **Step 3: Verificar que as tabelas existem**

Run (do `coletor/`):
```bash
node -e 'import("pg").then(async ({default:pg})=>{const fs=await import("node:fs");const ca=fs.readFileSync("supabase-ca.crt","utf8");const c=new pg.Client({connectionString:process.env.DATABASE_URL||readEnv(),ssl:{rejectUnauthorized:true,ca}});function readEnv(){return fs.readFileSync(".env","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL="))?.slice(13).trim();}await c.connect();const r=await c.query("select table_name from information_schema.tables where table_name in ($1,$2)",["gestao_comercial_briefings","gestor_log"]);console.log(r.rows.map(x=>x.table_name));await c.end();});'
```
Expected: imprime `[ 'gestao_comercial_briefings', 'gestor_log' ]`

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/011_gestao_comercial.sql
git commit -m "feat(gestor): migration tabelas briefings + gestor_log"
```

---

## Task 2: Cálculo de ritmo de meta (função pura + teste)

O núcleo testável: dado a meta do mês, o mapa de metas diárias e o realizado em R$, calcular quanto era esperado até hoje, o status (adiantado/atrasado) e a projeção de fechamento. Isola o risco de data/fuso e acumulação do `daily_goals`.

**Files:**
- Create: `coletor/lib/meta-pace.mjs`
- Test: `coletor/lib/meta-pace.test.mjs`

- [ ] **Step 1: Escrever o teste falhando**

```js
// coletor/lib/meta-pace.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaPace } from './meta-pace.mjs';

test('acumula meta diária até o dia corrente e calcula status/projeção', () => {
  // mês com 30 dias; meta diária 1000/dia = 30000 no mês
  const daily = {};
  for (let d = 1; d <= 30; d++) daily[String(d)] = 1000;
  // hoje = dia 10; realizado = 12000 (acima do esperado 10000)
  const r = metaPace({ metaValor: 30000, dailyGoals: daily, diaDoMes: 10, diasNoMes: 30, realizado: 12000 });
  assert.equal(r.esperadoAteHoje, 10000);
  assert.equal(r.realizado, 12000);
  assert.equal(r.status, 'adiantado');
  // ritmo diário = 1200/dia → projeção = 1200*30 = 36000
  assert.equal(r.projecaoFechamento, 36000);
  assert.equal(r.percentMeta, 40); // 12000/30000
});

test('status atrasado quando realizado abaixo do esperado', () => {
  const daily = {}; for (let d = 1; d <= 31; d++) daily[String(d)] = 1000;
  const r = metaPace({ metaValor: 31000, dailyGoals: daily, diaDoMes: 20, diasNoMes: 31, realizado: 15000 });
  assert.equal(r.esperadoAteHoje, 20000);
  assert.equal(r.status, 'atrasado');
});

test('sem dailyGoals usa distribuição linear da metaValor', () => {
  const r = metaPace({ metaValor: 30000, dailyGoals: null, diaDoMes: 10, diasNoMes: 30, realizado: 9000 });
  assert.equal(r.esperadoAteHoje, 10000); // linear: 30000/30*10
  assert.equal(r.status, 'atrasado');
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd coletor && node --test lib/meta-pace.test.mjs`
Expected: FALHA com erro de import (`meta-pace.mjs` não existe / `metaPace` indefinida)

- [ ] **Step 3: Implementar a função**

```js
// coletor/lib/meta-pace.mjs
// Cálculo puro de ritmo de meta. Sem I/O — fácil de testar.
// metaValor: meta do mês em R$
// dailyGoals: objeto {"1":valor,...} ou null (cai pra linear)
// diaDoMes: dia corrente (1..N)  ·  diasNoMes: total de dias do mês
// realizado: faturamento real acumulado no mês até hoje (R$)
export function metaPace({ metaValor, dailyGoals, diaDoMes, diasNoMes, realizado }) {
  const meta = Number(metaValor) || 0;
  let esperadoAteHoje = 0;
  if (dailyGoals && typeof dailyGoals === 'object') {
    for (let d = 1; d <= diaDoMes; d++) esperadoAteHoje += Number(dailyGoals[String(d)]) || 0;
  } else {
    esperadoAteHoje = diasNoMes > 0 ? (meta / diasNoMes) * diaDoMes : 0;
  }
  esperadoAteHoje = Math.round(esperadoAteHoje);
  const real = Math.round(Number(realizado) || 0);
  const ritmoDiario = diaDoMes > 0 ? real / diaDoMes : 0;
  const projecaoFechamento = Math.round(ritmoDiario * diasNoMes);
  const percentMeta = meta > 0 ? Math.round((real / meta) * 100) : 0;
  const status = real >= esperadoAteHoje ? 'adiantado' : 'atrasado';
  return { metaValor: meta, esperadoAteHoje, realizado: real, status, projecaoFechamento, percentMeta };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd coletor && node --test lib/meta-pace.test.mjs`
Expected: PASS (3 testes verdes)

- [ ] **Step 5: Commit**

```bash
git add coletor/lib/meta-pace.mjs coletor/lib/meta-pace.test.mjs
git commit -m "feat(gestor): cálculo puro de ritmo de meta + testes"
```

---

## Task 3: Agente principal — coleta + Claude + grava

Script único e autocontido (mesmo estilo do `agente-noticias.mjs`). Reúne: auth de conta de serviço, faturamento por canal via `bling-proxy`, metas, concorrentes, chamada ao Claude e gravação.

**Files:**
- Create: `coletor/gestor-comercial.mjs`

- [ ] **Step 1: Escrever o script completo**

```js
#!/usr/bin/env node
// Agente Gestor Comercial — roda no GitHub Actions (cron semanal).
// Coleta faturamento real (Bling via bling-proxy, autenticado como conta de
// serviço), metas e notícias de concorrentes; o Claude (Opus 4.8) escreve o
// briefing; grava em gestao_comercial_briefings. Log em gestor_log.
// Sem deps externas — fetch nativo (Node 18+).

import { metaPace } from './lib/meta-pace.mjs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_GESTOR || process.env.ANTHROPIC_API_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const GESTOR_EMAIL = process.env.GESTOR_USER_EMAIL;
const GESTOR_PASS = process.env.GESTOR_USER_PASSWORD;
const MODEL = process.env.GESTOR_MODEL || 'claude-opus-4-8';

if (!ANTHROPIC_API_KEY || !SERVICE_KEY || !GESTOR_EMAIL || !GESTOR_PASS) {
  console.error('✗ Faltam segredos: ANTHROPIC_API_KEY_GESTOR, SUPABASE_SERVICE_KEY, GESTOR_USER_EMAIL, GESTOR_USER_PASSWORD');
  process.exit(1);
}

const CANAIS = [
  { nome: 'Shopping Tivoli (Santa Bárbara)', loja_id: '205834140' },
  { nome: 'Shopping Dom Pedro',              loja_id: '205657609' },
  { nome: 'Atacado Nuvem Shop',             loja_id: '205451611' },
];
const REST = SUPABASE_URL + '/rest/v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Supabase REST (service key) ──
const sb = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sb });
  if (!r.ok) throw new Error('REST GET ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbInsert(path, body, prefer) {
  const r = await fetch(REST + path, { method: 'POST', headers: prefer ? { ...sb, Prefer: prefer } : sb, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('REST POST ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}
async function logGestor(fase, erro, detalhe) {
  try { await sbInsert('/gestor_log', { fase, erro: erro || null, detalhe: detalhe || null }, 'return=minimal'); }
  catch (e) { console.error('aviso log:', e.message); }
}

// ── Conta de serviço: login → access_token ──
async function loginServico() {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: GESTOR_EMAIL, password: GESTOR_PASS }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('login conta de serviço falhou: ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

// ── Bling via edge function bling-proxy (precisa do token de usuário) ──
async function blingProxy(token, endpoint, params) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/bling-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, params }),
  });
  if (!r.ok) throw new Error('bling-proxy ' + endpoint + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
// Lista todas as páginas de pedidos de venda concluídos no intervalo
async function blingPedidos(token, dataInicial, dataFinal) {
  const all = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    let items = [];
    for (let retry = 0; retry < 3; retry++) {
      const resp = await blingProxy(token, 'pedidos/vendas', { dataInicial, dataFinal, 'idsSituacoes[]': 9, pagina, limite: 100 });
      const d = resp.data;
      if (Array.isArray(d) && d.length) { items = d; break; }
      if (retry < 2) await sleep(700);
    }
    if (!items.length) break;
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

// ── Anthropic (retry em 429/5xx/rede) ──
async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { console.log('  rede falhou; aguardando…'); await sleep(Math.min(60, 8 * (t + 1)) * 1000); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { const ra = parseInt(r.headers.get('retry-after') || '0', 10); console.log('  rate/sobrecarga ' + r.status + '; aguardando…'); await sleep((ra > 0 ? ra : Math.min(60, 8 * (t + 1))) * 1000); continue; }
    throw new Error('Anthropic ' + r.status + ' ' + JSON.stringify(await r.json().catch(() => ({}))).slice(0, 300));
  }
  throw new Error('Anthropic: tentativas esgotadas');
}

// ── Datas (America/Sao_Paulo) ──
function hojeBR() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date()); // YYYY-MM-DD
}

async function main() {
  const hoje = hojeBR();
  const [y, m, d] = hoje.split('-').map(Number);
  const diasNoMes = new Date(y, m, 0).getDate();
  const di = `${y}-${String(m).padStart(2, '0')}-01`;
  const df = hoje;
  console.log('== Gestor Comercial · ' + hoje + ' · ' + MODEL + ' ==');
  await logGestor('inicio', null, 'rodada ' + hoje + ' (' + MODEL + ')');

  // 1) faturamento real por canal (mês corrente) via bling-proxy
  const token = await loginServico();
  const pedidos = await blingPedidos(token, di, df);
  const realPorCanal = {};
  for (const c of CANAIS) realPorCanal[c.loja_id] = 0;
  for (const p of pedidos) {
    const lid = String(p.loja?.id || '');
    if (lid in realPorCanal) realPorCanal[lid] += parseFloat(p.total || 0);
  }

  // 2) metas do mês (todas as lojas; casa pelos canais foco quando houver)
  const metas = await sbGet(`/bling_metas?year=eq.${y}&month=eq.${m}&select=loja_id,loja_nome,meta_valor,daily_goals`);

  // 3) concorrentes recentes (últimas ~2 semanas)
  const desde = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const noticias = await sbGet(`/noticias_concorrentes?rodada=gte.${desde}&select=marca,titulo,resumo,categoria,fonte,data_publicacao&order=data_publicacao.desc&limit=40`);

  // 4) monta o pacote de números (com ritmo de meta por canal foco)
  const canaisResumo = CANAIS.map(c => {
    const meta = metas.find(mm => String(mm.loja_id) === c.loja_id);
    const pace = metaPace({ metaValor: meta?.meta_valor, dailyGoals: meta?.daily_goals, diaDoMes: d, diasNoMes, realizado: realPorCanal[c.loja_id] });
    return { canal: c.nome, ...pace };
  });
  const dados = { rodada: hoje, mesReferencia: `${y}-${String(m).padStart(2, '0')}`, diaDoMes: d, diasNoMes, canaisFoco: canaisResumo, totalPedidosMes: pedidos.length };

  // 5) Claude escreve o briefing (persona de gestor veterano)
  const sys = 'Você é um gestor comercial veterano de varejo e atacado de moda (bolsas, marca Vessel). '
    + 'Escreve briefings semanais diretos, práticos e acionáveis — chão de loja, sem encheção. '
    + 'Foco TOTAL em 3 canais: Shopping Tivoli (Santa Bárbara), Shopping Dom Pedro e Atacado Nuvem Shop.';
  const user = 'Dados desta semana (R$ reais do Bling, metas e movimento de concorrentes):\n\n'
    + 'NÚMEROS:\n' + JSON.stringify(dados, null, 2) + '\n\n'
    + 'CONCORRENTES (últimas 2 semanas):\n' + noticias.map(n => `- [${n.marca}/${n.categoria}] ${n.titulo} (${n.fonte}, ${n.data_publicacao})`).join('\n') + '\n\n'
    + 'Escreva o briefing em markdown com estas seções: '
    + '## Resumo executivo (3-5 bullets) · ## Ritmo das metas (por canal foco: % da meta, adiantado/atrasado, projeção de fechamento) · '
    + '## Frente competitiva (o que os concorrentes fizeram + resposta promocional sugerida) · '
    + '## Calendário comercial (próximas datas relevantes e o que preparar) · '
    + '## Performance (destaques/alertas) · ## Ações priorizadas (lista numerada: o quê, onde, urgência). '
    + 'Use os números reais fornecidos. Não invente faturamento que não está nos dados. '
    + 'No fim, escreva numa última linha SÓ um resumo de 1 frase prefixado por "RESUMO: " para usar no card.';

  const resp = await anthropic({ model: MODEL, max_tokens: 4000, thinking: { type: 'adaptive' }, system: sys, messages: [{ role: 'user', content: user }] });
  const conteudo = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const mResumo = conteudo.match(/RESUMO:\s*(.+)\s*$/);
  const resumo = mResumo ? mResumo[1].trim() : (canaisResumo.map(c => `${c.canal}: ${c.percentMeta}% da meta`).join(' · '));
  const periodo = `Semana de ${hoje} (${dados.mesReferencia})`;

  // 6) grava o briefing
  await sbInsert('/gestao_comercial_briefings', [{ rodada: hoje, periodo, resumo, conteudo, dados_json: dados }], 'return=minimal');
  console.log('briefing gravado. canais:', canaisResumo.map(c => `${c.canal}=${c.percentMeta}%`).join(', '));
  await logGestor('fim', null, 'pedidos=' + pedidos.length + ' · ' + canaisResumo.map(c => `${c.canal}:${c.status}`).join(' · '));
}

main().catch(async (e) => { console.error('FALHA:', e.message); await logGestor('fim', e.message.slice(0, 500), 'falha geral'); process.exit(1); });
```

- [ ] **Step 2: Commit (sem rodar ainda — depende de segredos da conta de serviço)**

```bash
git add coletor/gestor-comercial.mjs
git commit -m "feat(gestor): agente principal (bling-proxy + Claude + grava briefing)"
```

---

## Task 4: Conta de serviço + `.env` local + teste ponta-a-ponta

Requer ação do usuário: criar um usuário dedicado no dashboard (conta de serviço) e a key de API separada. Depois roda local pra validar antes de automatizar.

**Files:**
- Modify: `coletor/.env.exemplo`

- [ ] **Step 1: Documentar variáveis no `.env.exemplo`**

Adicionar ao fim de `coletor/.env.exemplo`:
```
# Gestor Comercial (agente)
ANTHROPIC_API_KEY_GESTOR=cole_aqui_a_key_separada
GESTOR_USER_EMAIL=usuario_de_servico@dominio
GESTOR_USER_PASSWORD=senha_do_usuario_de_servico
```

- [ ] **Step 2: [AÇÃO DO USUÁRIO] Criar a conta de serviço e a key**

- Criar um usuário no dashboard (ex.: `gestor-agente@rbvcompany.com`) com permissão de ver Gestão à Vista (pra o `bling-proxy` aceitar). Anotar email+senha.
- Criar uma API key separada da Anthropic (`gestor-comercial`).
- Preencher essas 3 variáveis no `coletor/.env` local (gitignored).

- [ ] **Step 3: Rodar o agente localmente**

Run (do `coletor/`, com as 3 vars + `SUPABASE_SERVICE_KEY` exportadas ou no `.env`):
```bash
set -a; . ./.env; set +a
node gestor-comercial.mjs
```
Expected: imprime `briefing gravado. canais: ...` sem erro. Se `bling-proxy` recusar (401/403), a conta de serviço não tem acesso — revisar permissão do usuário (plano B: abordagem B do spec).

- [ ] **Step 4: Verificar o briefing no banco**

Run (do `coletor/`):
```bash
node -e 'import("pg").then(async ({default:pg})=>{const fs=await import("node:fs");const ca=fs.readFileSync("supabase-ca.crt","utf8");const env=fs.readFileSync(".env","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL="))?.slice(13).trim();const c=new pg.Client({connectionString:env,ssl:{rejectUnauthorized:true,ca}});await c.connect();const r=await c.query("select rodada,periodo,left(resumo,120) resumo,length(conteudo) tam from public.gestao_comercial_briefings order by created_at desc limit 1");console.table(r.rows);await c.end();});'
```
Expected: 1 linha com `periodo`, `resumo` preenchido e `tam` > 500.

- [ ] **Step 5: Commit**

```bash
git add coletor/.env.exemplo
git commit -m "docs(gestor): variáveis do agente no .env.exemplo"
```

---

## Task 5: Workflow semanal no GitHub Actions

**Files:**
- Create: `.github/workflows/gestor-comercial.yml`

- [ ] **Step 1: Escrever o workflow**

```yaml
name: Gestor Comercial (briefing semanal)

# Segunda 11:00 UTC (08:00 Brasília) + disparo manual.
on:
  schedule:
    - cron: '0 11 * * 1'
  workflow_dispatch: {}

concurrency:
  group: gestor-comercial
  cancel-in-progress: false

jobs:
  briefing:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Rodar gestor comercial
        env:
          ANTHROPIC_API_KEY_GESTOR: ${{ secrets.ANTHROPIC_API_KEY_GESTOR }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          GESTOR_USER_EMAIL: ${{ secrets.GESTOR_USER_EMAIL }}
          GESTOR_USER_PASSWORD: ${{ secrets.GESTOR_USER_PASSWORD }}
        run: node coletor/gestor-comercial.mjs
```

- [ ] **Step 2: [AÇÃO DO USUÁRIO] Cadastrar os 4 segredos**

Em `https://github.com/brenoov/social-dashboard/settings/secrets/actions` criar:
`ANTHROPIC_API_KEY_GESTOR`, `GESTOR_USER_EMAIL`, `GESTOR_USER_PASSWORD`
(o `SUPABASE_SERVICE_KEY` já existe).

- [ ] **Step 3: Commit + push (precisa do escopo `workflow` na conta brenoov)**

```bash
git add .github/workflows/gestor-comercial.yml
git commit -m "ci(gestor): workflow semanal do briefing"
git push origin main
```

- [ ] **Step 4: Disparar à mão e acompanhar**

Run:
```bash
gh workflow run "Gestor Comercial (briefing semanal)" -R brenoov/social-dashboard
sleep 8 && gh run list -R brenoov/social-dashboard --workflow="Gestor Comercial (briefing semanal)" --limit 1
```
Expected: run aparece `in_progress`; ao concluir, `success` e um novo briefing na tabela (repetir a verificação do Task 4 Step 4).

---

## Self-review (cobertura do spec)

- Persona gestor veterano → system prompt (Task 3). ✓
- 4 frentes (meta/concorrente/calendário/performance) → seções do prompt + dados (Task 3). ✓
- Canais foco (3, com IDs) → constante CANAIS (Task 3). ✓
- Faturamento R$ via bling-proxy + conta de serviço → loginServico + blingPedidos (Task 3/4). ✓
- Metas + ritmo → metaPace testado (Task 2) usado no Task 3. ✓
- Concorrentes → sbGet noticias_concorrentes (Task 3). ✓
- Tabela briefings + log → migration 011 (Task 1). ✓
- Autônomo semanal → workflow cron `0 11 * * 1` (Task 5). ✓
- Key separada → ANTHROPIC_API_KEY_GESTOR (Task 3/4/5). ✓
- Opus 4.8 → GESTOR_MODEL default (Task 3). ✓
- Riscos do spec (auth headless, fuso, daily_goals) → tratados em loginServico, hojeBR, metaPace. ✓

F2 (módulo no dashboard) = plano separado, depois que a F1 gerar briefings reais.
