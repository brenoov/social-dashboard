# KPIs de Custo (Meta Ads) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coletar as interações dos anúncios (via Meta `actions`) e mostrar custo por interação/curtida (cards) + CPC/CPM/custo por alcance/comentário/salvamento/compartilhamento (chips) na seção 02·Meta Ads do dashboard social.

**Architecture:** Migration adiciona 5 colunas em `campaign_insights`. O coletor `coletar-dados` (Edge Function) passa a pedir `actions` na consulta de insights de campanha e grava as 5 contagens. A tela (`index.html`, monólito) lê essas colunas, soma no agregado `aggCi`, e calcula/exibe os KPIs de custo.

**Tech Stack:** Supabase (Postgres + Edge Function Deno/TS), Meta Graph API v21.0, `index.html` (vanilla JS monólito), Supabase MCP p/ migration/deploy/verify.

## Global Constraints

- **Branch:** `feat/kpis-custo-meta-ads` (nunca commitar em `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Coletor (drift):** antes de editar `coletar-dados`, rodar `get_edge_function` p/ pegar a versão DEPLOYADA (hoje v16 == repo, sem drift) e conferir que o repo bate; editar; deployar preservando `verify_jwt`. Ver [[project_iamundi_coletor]].
- **`action_type` do Meta via helper de aliases** (o Meta varia os nomes): interações=`post_engagement`; curtidas=`post_reaction`|`like`; comentários=`comment`; salvamentos=`onsite_conversion.post_save`|`post_save`; compartilhamentos=`post`|`share`. **Validar contra dados reais de 1 conta** (a Gestão de Tráfego ao vivo é referência).
- **Métrica sem dado exibe "—"** (nunca zera nem quebra), padrão do projeto. Usar os helpers `fmtR`/`fmtN` existentes.
- **Forward-only:** colunas novas só têm dado após o 1º ciclo do coletor com a mudança; snapshots antigos ficam null → "—".
- **Não regredir** os cards atuais (investimento, custo por seguidor) nem a coleta existente.
- **Colunas novas:** `post_engagement, likes, comments, shares, saves` (int, nullable) em `campaign_insights`.

---

### Task 1: Migration — 5 colunas de interação em `campaign_insights`

**Files:**
- Create: `docs/migrations/2026-07-02-campaign-insights-actions.sql`

**Interfaces:**
- Produces: colunas `post_engagement, likes, comments, shares, saves` (int nullable) em `public.campaign_insights`. Consumidas pelo coletor (Task 2, escrita) e pela tela (Task 3, leitura).

- [ ] **Step 1: Criar o arquivo de migration**

Crie `docs/migrations/2026-07-02-campaign-insights-actions.sql`:

```sql
-- docs/migrations/2026-07-02-campaign-insights-actions.sql
-- Contagens de interação por campanha × período (do array Meta `actions`), pro
-- cálculo dos KPIs de custo (custo por interação/curtida/etc.) no dashboard social.
-- Nullable: snapshots antigos ficam sem dado (forward-only). Sem mudança de RLS.

alter table public.campaign_insights add column if not exists post_engagement integer;
alter table public.campaign_insights add column if not exists likes integer;
alter table public.campaign_insights add column if not exists comments integer;
alter table public.campaign_insights add column if not exists shares integer;
alter table public.campaign_insights add column if not exists saves integer;
```

- [ ] **Step 2: Aplicar a migration**

Aplique via Supabase MCP `apply_migration` (project_id `kounqtdoioootxqegkij`, name `campaign_insights_actions`, body = o SQL acima).
> Alternativa: `node coletor/run-migrations.mjs` se `coletor/.env` tiver `DATABASE_URL`.

- [ ] **Step 3: Verificar as colunas**

Via Supabase MCP `execute_sql`:
```sql
select string_agg(column_name,', ' order by ordinal_position) as novas
from information_schema.columns
where table_schema='public' and table_name='campaign_insights'
  and column_name in ('post_engagement','likes','comments','shares','saves');
```
Expected: `novas = comments, likes, post_engagement, saves, shares` (as 5 colunas presentes).

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/2026-07-02-campaign-insights-actions.sql
git commit -m "feat(custo): migration — colunas de interação em campaign_insights"
```

---

### Task 2: Coletor — capturar `actions` e gravar as contagens

**Files:**
- Modify: `supabase/functions/coletar-dados/index.ts` (função `coletarAdsPorCampanha`, ~L285-298 na versão deployada)

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `campaign_insights` passa a ter `post_engagement/likes/comments/shares/saves` preenchidos por campanha × período. Consumido pela tela (Task 3).

- [ ] **Step 1: Sincronizar com a versão deployada (anti-drift)**

Rode `get_edge_function` (Supabase MCP) p/ o slug `coletar-dados` e compare com `supabase/functions/coletar-dados/index.ts`.
Expected: hoje são idênticos (v16). Se divergirem, **primeiro** sincronize o repo com a versão deployada (copie o deployado pro arquivo) e commite isso separado, antes de editar. Não edite em cima de um repo desatualizado.

- [ ] **Step 2: Adicionar `actions` aos fields da consulta de insights**

Em `coletarAdsPorCampanha`, na chamada `apiGetAll('act_${adAccountId}/insights', {...})` (~L285), troque o `fields`:

De:
```typescript
  fields: 'campaign_id,spend,impressions,clicks,reach',
```
Para:
```typescript
  fields: 'campaign_id,spend,impressions,clicks,reach,actions',
```

- [ ] **Step 3: Adicionar o helper de extração por action_type (aliases)**

Adicione, no escopo do módulo (perto dos outros helpers, ex. após `apiGetAll`):

```typescript
// Extrai a contagem de um tipo de ação do array `actions` do insight, tentando
// aliases (o Meta varia os nomes). Retorna inteiro (0 se ausente).
function actVal(actions: any, types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  for (const t of types) {
    const hit = actions.find((a: any) => a && a.action_type === t);
    if (hit) return parseInt(hit.value ?? '0') || 0;
  }
  return 0;
}
```

- [ ] **Step 4: Gravar as 5 contagens no row do upsert**

No `.map` que monta os rows do `campaign_insights` (~L290-297), acrescente os 5 campos:

De:
```typescript
const rows = items.map((r: any) => ({
  campaign_id: r.campaign_id, account_id: accountId,
  captured_at: hoje, period_days: dias,
  spend: parseFloat(r.spend ?? '0'),
  impressions: parseInt(r.impressions ?? '0'),
  clicks: parseInt(r.clicks ?? '0'),
  reach: parseInt(r.reach ?? '0'),
}));
```
Para:
```typescript
const rows = items.map((r: any) => ({
  campaign_id: r.campaign_id, account_id: accountId,
  captured_at: hoje, period_days: dias,
  spend: parseFloat(r.spend ?? '0'),
  impressions: parseInt(r.impressions ?? '0'),
  clicks: parseInt(r.clicks ?? '0'),
  reach: parseInt(r.reach ?? '0'),
  post_engagement: actVal(r.actions, ['post_engagement']),
  likes: actVal(r.actions, ['post_reaction', 'like']),
  comments: actVal(r.actions, ['comment']),
  shares: actVal(r.actions, ['post', 'share']),
  saves: actVal(r.actions, ['onsite_conversion.post_save', 'post_save']),
}));
```
(O `onConflict` continua `campaign_id,account_id,captured_at,period_days` — não muda.)

- [ ] **Step 5: Deployar a Edge Function**

Deploy via Supabase MCP `deploy_edge_function` (slug `coletar-dados`, project `kounqtdoioootxqegkij`, com o conteúdo completo do arquivo), preservando `verify_jwt` como está. Confirme com `get_edge_function` que o `fields` novo e os 5 campos estão na versão deployada.

- [ ] **Step 6: Rodar uma coleta e validar contra o Meta**

Dispare uma coleta (mesma forma do pg_cron). Descubra a chamada do cron e rode-a:
```sql
select jobname, command from cron.job where command ilike '%coletar-dados%';
```
Rode o `command` retornado (um `select net.http_post(...)`) via `execute_sql` p/ disparar 1 coleta. Aguarde ~2min e verifique:
```sql
select campaign_id, period_days, spend, post_engagement, likes, comments, shares, saves
from public.campaign_insights
where post_engagement is not null
order by captured_at desc, spend desc limit 5;
```
Expected: linhas recentes com `post_engagement`/`likes` preenchidos (não-null) e coerentes (post_engagement ≥ likes+comments+shares na maioria).

**Validação do action_type (o risco principal):** pegue 1 campanha com gasto e compare `likes`/`comments` com o que a **Gestão de Tráfego** (tela, ao vivo) mostra pra mesma campanha/período, ou com o Gerenciador de Anúncios do Meta. Se `likes` vier 0 mas o anúncio tem curtidas, ajuste os aliases (ex.: `post_reaction` vs `like`) e re-deploye. **Só marque a task concluída quando os números baterem.**

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/coletar-dados/index.ts
git commit -m "feat(custo): coletor capta actions (interações/curtidas/etc.) por campanha"
```

---

### Task 3: Tela — ler, agregar e exibir os KPIs de custo

**Files:**
- Modify: `index.html` — `aggCi` (~L3740), o `sb('campaign_insights?...select=...')` (~L3754-3755), o extrator do agregado (~L3758), o objeto `d` de retorno (~L3787-3789), o render da seção Meta Ads (~L4021-4032), e o HTML da seção 02·Meta Ads (~L3070-3122, o `<div class="sec2-grid mb40">`).

**Interfaces:**
- Consumes: colunas de `campaign_insights` (Tasks 1/2); helpers existentes `fmtR`, `fmtN`, `setChips`, `sb`.
- Produces: cards `ads-cpi-val` (custo/interação) e `ads-cpl-val` (custo/curtida); chips de custo em `chips-ads-custo`.

- [ ] **Step 1: Incluir as 5 colunas no select do `campaign_insights`**

Nas duas chamadas `sb(...)` (~L3754-3755), troque `select=campaign_id,spend,impressions,clicks,reach,captured_at` por incluir as 5 colunas. Ex. na L3754 (e igual na L3755):

De:
```javascript
      sb(`campaign_insights?account_id=eq.${accountId}&period_days=eq.${_adsPd}&${_adsCur}&limit=200&select=campaign_id,spend,impressions,clicks,reach,captured_at${idFilter}`),
```
Para:
```javascript
      sb(`campaign_insights?account_id=eq.${accountId}&period_days=eq.${_adsPd}&${_adsCur}&limit=200&select=campaign_id,spend,impressions,clicks,reach,post_engagement,likes,comments,shares,saves,captured_at${idFilter}`),
```
(Faça o mesmo na L3755, trocando só `_adsCur` por `_adsPrev` como já está.)

- [ ] **Step 2: Somar as 5 colunas em `aggCi`**

Em `aggCi` (~L3744), acrescente os 5 campos ao objeto retornado:

De:
```javascript
    return{spend:d.reduce((s,r)=>s+parseFloat(r.spend||0),0),impressions:d.reduce((s,r)=>s+parseInt(r.impressions||0),0),clicks:d.reduce((s,r)=>s+parseInt(r.clicks||0),0),reach:d.reduce((s,r)=>s+parseInt(r.reach||0),0)};
```
Para:
```javascript
    return{spend:d.reduce((s,r)=>s+parseFloat(r.spend||0),0),impressions:d.reduce((s,r)=>s+parseInt(r.impressions||0),0),clicks:d.reduce((s,r)=>s+parseInt(r.clicks||0),0),reach:d.reduce((s,r)=>s+parseInt(r.reach||0),0),adEngagement:d.reduce((s,r)=>s+parseInt(r.post_engagement||0),0),adLikes:d.reduce((s,r)=>s+parseInt(r.likes||0),0),adComments:d.reduce((s,r)=>s+parseInt(r.comments||0),0),adShares:d.reduce((s,r)=>s+parseInt(r.shares||0),0),adSaves:d.reduce((s,r)=>s+parseInt(r.saves||0),0)};
```

- [ ] **Step 3: Declarar e extrair os agregados novos (mesmo escopo de spend/impressions)**

As variáveis `spend/impressions/clicks/reach` são declaradas com `let` no TOPO (L3746) e só atribuídas dentro do `if(!noneSelected){...}`. Siga o MESMO padrão pras 5 novas.

3a. Na L3746, estenda a declaração `let`:

De:
```javascript
  let spend=0,impressions=0,clicks=0,reach=0,prevSpend=null;
```
Para:
```javascript
  let spend=0,impressions=0,clicks=0,reach=0,prevSpend=null,adEngagement=0,adLikes=0,adComments=0,adShares=0,adSaves=0;
```

3b. Logo após a linha de atribuição (~L3758) `spend=adsAgg?.spend||0;impressions=adsAgg?.impressions||0;clicks=adsAgg?.clicks||0;reach=adsAgg?.reach||0;`, adicione:
```javascript
    adEngagement=adsAgg?.adEngagement||0;adLikes=adsAgg?.adLikes||0;adComments=adsAgg?.adComments||0;adShares=adsAgg?.adShares||0;adSaves=adsAgg?.adSaves||0;
```
(Sem seleção/sem dados, ficam 0 → a UI mostra "—".)

- [ ] **Step 4: Passar os 5 campos no objeto `d` de retorno**

No objeto retornado (~L3789, linha `spend,prevSpend,cps,prevCps,`), acrescente os 5 campos:

De:
```javascript
    spend,prevSpend,cps,prevCps,
```
Para:
```javascript
    spend,prevSpend,cps,prevCps,adEngagement,adLikes,adComments,adShares,adSaves,
```

- [ ] **Step 5: HTML — 2 cards de custo na seção 02·Meta Ads**

No `index.html`, dentro do `<div class="sec2-grid mb40">` da seção 02·Meta Ads (os 2 cards atuais: investimento e custo por seguidor), adicione 2 cards logo após o card de "Custo por seguidor" (antes do `</div>` que fecha o `sec2-grid`):

```html
    <div class="card">
      <div class="mc-header"><div class="mc-icon">🤝</div></div>
      <div class="mc-lbl">CUSTO POR INTERAÇÃO</div>
      <div class="mc-val a-purple" id="ads-cpi-val">R$ —</div>
      <div class="calc-badge">⚡ Menor é melhor · investimento ÷ interações do anúncio</div>
    </div>
    <div class="card">
      <div class="mc-header"><div class="mc-icon">❤️</div></div>
      <div class="mc-lbl">CUSTO POR CURTIDA</div>
      <div class="mc-val a-blue" id="ads-cpl-val">R$ —</div>
      <div class="calc-badge">⚡ Menor é melhor · investimento ÷ curtidas do anúncio</div>
    </div>
```

E logo APÓS o fechamento do `<div class="sec2-grid mb40">...</div>`, adicione a faixa de chips de custo:

```html
    <div class="sec-chips" id="chips-ads-custo" style="margin-bottom:40px;"></div>
```

- [ ] **Step 6: Render — calcular e exibir os custos**

No render da seção Meta Ads (~L4021-4032), logo após a linha do `setChips('chips-ads',adsChips);` (L4032), adicione o cálculo e a exibição dos KPIs de custo:

```javascript
  const _cpu=(n)=>n>0&&d.spend>0?fmtR(d.spend/n):'R$ —';
  document.getElementById('ads-cpi-val').textContent=_cpu(d.adEngagement);
  document.getElementById('ads-cpl-val').textContent=_cpu(d.adLikes);
  const custoChips=[];
  if(d.clicks>0&&d.spend>0)custoChips.push('CPC '+fmtR(d.spend/d.clicks));
  if(d.impressions>0&&d.spend>0)custoChips.push('CPM '+fmtR(d.spend/d.impressions*1000));
  if(d.reach>0&&d.spend>0)custoChips.push('Custo/alcance '+fmtR(d.spend/d.reach));
  if(d.adComments>0&&d.spend>0)custoChips.push('Custo/comentário '+fmtR(d.spend/d.adComments));
  if(d.adSaves>0&&d.spend>0)custoChips.push('Custo/salvamento '+fmtR(d.spend/d.adSaves));
  if(d.adShares>0&&d.spend>0)custoChips.push('Custo/compart. '+fmtR(d.spend/d.adShares));
  if(!custoChips.length)custoChips.push('Sem custos no período');
  setChips('chips-ads-custo',custoChips);
```

- [ ] **Step 7: Verificação de sintaxe (monólito)**

Extraia os inline scripts e rode `node --check`:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_kpichk'+i+'.js',m[1]);i++;}console.log(i+' inline scripts')"
for f in /tmp/_kpichk*.js; do node --check "$f" && echo "OK $f"; done
```
Expected: todos OK. (Um SyntaxError = quebra de chave/parênteses numa inserção.)

- [ ] **Step 8: Verificação visual — DEFERIDA AO USUÁRIO**

O check visual (abrir o preview do branch, ir no dashboard social → seção 02·Meta Ads, ver os 2 cards de custo + chips) é **deferido ao Breno**. **NÃO** fazer `git push` (o controlador empurra no fim). Enquanto o coletor não tiver rodado com a mudança, os cards de custo/interação e os chips de interação mostram "R$ —"; CPC/CPM/custo-por-alcance já aparecem (dado atual).

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(custo): seção Meta Ads mostra custo por interação/curtida + chips de custo"
```

---

## Notas de execução

- **Ordem:** T1 → T2 → T3. T3 depende do select/colunas (T1) e idealmente do coletor já gravando (T2) pra validar com dado real, mas T3 é implementável e verificável por sintaxe sem esperar coleta (os custos derivados de clicks/impressões/reach já aparecem).
- **Deploy do coletor (T2)** afeta produção (a coleta roda 4x/dia). É aditivo; se algo der errado, o coletor tem resiliência e as colunas novas são nullable.
- **Validação do action_type** (T2 Step 6) é o passo que não pode ser pulado — é onde os aliases se provam certos contra o Meta real.
- **Front:** o merge/push é feito pelo controlador no fim; a validação visual é do Breno.
