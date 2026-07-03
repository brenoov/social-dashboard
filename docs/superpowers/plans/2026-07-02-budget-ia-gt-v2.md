# Budget IA / GT v2 — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aposentar o motor de regras da Gestão de Tráfego; o Opus vira a análise única, incluindo avaliação por anúncio (manter/pausar) na mesma chamada por campanha; anúncios auto-desdobrados; status real exato.

**Architecture:** Nova tabela `gt_ad_analises`. O robô `budget-ia.mjs` passa a mandar os anúncios ativos junto na chamada por campanha e devolve, além do budget da campanha, um array de vereditos por anúncio; grava campanha em `gt_budget_analises` (como hoje) e anúncios em `gt_ad_analises`. A tela (`index.html`) remove o motor de regras (postura, `_gtInlineSuggest*`, `_gtVerdict`, `GT_CRIT`, `gtCriterios`, `_gtRenderActions`) e mostra só o Opus, com o bloco de análise por anúncio e auto-desdobramento.

**Tech Stack:** Supabase (Postgres + Edge/GitHub Actions robot), Meta Graph API v21.0, Anthropic Messages (`claude-opus-4-8`), Node 20 (`node:test`), `index.html` monólito.

## Global Constraints

- **Branch:** `feat/gt-v2-opus-analise` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA build Vercel).
- **Robô:** modelo exatamente `claude-opus-4-8`; chave só via secret `ANTHROPIC_API_KEY_TRAFEGO`; vai direto ao Graph (não meta-proxy). Contas de anúncio via `/me/adaccounts` (a coluna `accounts.ad_account_id` é vazia). Ver [[project_iamundi_budget_ia]].
- **1 chamada Opus por campanha** (com os anúncios juntos) — não multiplicar por anúncio. `max_tokens` 8192.
- **Conceitos do prompt:** performance ruim (CTR muito abaixo do objetivo, CPC/CPL alto, ROAS baixo, frequência alta) **NUNCA** vira "escalar" → reduzir/pausar. "escalar" só com evidência de eficiência + dado suficiente.
- **Tela:** remover o motor de regras por completo (sem código morto); manter o bloco do Opus (`_gtIABlocoHtml`/`_gtWireBudgetControls`) e o toggle manual (`_gtManualToggleBtn`), que já existem. Escrita no Meta só via `_gtApplyAction`/`_gtConfirm` existentes. Front público → escapar texto do banco com `_gtEsc` (padrão já usado no `_gtIABlocoHtml`).
- **Status real:** exibir e considerar Ativo / Pausado / **Concluído** (ACTIVE + stop_time no passado) / Arquivado; filtro "Ativas" não conta concluída.
- **Sintaxe do monólito:** após editar `index.html`, extrair inline scripts e `node --check` (recipe em cada task de front). Verificação visual = DEFERIDA AO USUÁRIO (preview); implementer NÃO faz `git push`.
- **Fora deste plano:** bug da cor (item 5) — tarefa de debugging separada.

---

### Task 1: Migration — tabela `gt_ad_analises`

**Files:** Create `docs/migrations/2026-07-02-gt-ad-analises.sql`

**Interfaces:** Produces `public.gt_ad_analises` (PK `ad_id`); escrita só service role, leitura por ferramenta. Consumida pelo robô (Task 3) e pela tela (Task 5).

- [ ] **Step 1: Criar o arquivo**

```sql
-- docs/migrations/2026-07-02-gt-ad-analises.sql
-- Análise por anúncio gerada pelo robô semanal (Opus). Espelha o RLS de gt_budget_analises:
-- leitura só admin/meta.gestor; escrita só service role (sem policy de write).
create table if not exists public.gt_ad_analises (
  ad_id         text primary key,
  campaign_id   text,
  account_id    text,
  veredito      text,
  justificativa text,
  modelo        text not null default 'opus-4-8',
  gerado_em     timestamptz not null default now(),
  valida_ate    timestamptz
);
alter table public.gt_ad_analises enable row level security;
drop policy if exists gt_ad_read on public.gt_ad_analises;
create policy gt_ad_read on public.gt_ad_analises
  for select using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and (p.role='admin' or 'meta.gestor' = any(p.features)))
  );
```

- [ ] **Step 2: Aplicar** — via Supabase MCP `apply_migration` (project `kounqtdoioootxqegkij`, name `gt_ad_analises`, body = o SQL).

- [ ] **Step 3: Verificar**
```sql
select
 (select count(*) from information_schema.tables where table_schema='public' and table_name='gt_ad_analises') as tabela,
 (select count(*) from pg_policies where schemaname='public' and tablename='gt_ad_analises') as policies;
```
Expected: `tabela=1`, `policies=1`.

- [ ] **Step 4: Commit**
```bash
git add docs/migrations/2026-07-02-gt-ad-analises.sql
git commit -m "feat(gt-v2): migration gt_ad_analises + RLS de leitura por ferramenta"
```

---

### Task 2: Robô — pure functions (prompt com anúncios + conceitos) + testes

**Files:** Modify `coletor/budget-ia.mjs` (`montarMensagens` L16-48, `parsearSaida` L51-69, add `VEREDITOS_AD`); Modify `coletor/budget-ia.test.mjs`.

**Interfaces:**
- Produces: `montarMensagens(camp, ins, ads) -> {system,user}` (agora recebe `ads`); `parsearSaida(text) -> {budget_sugerido_centavos, veredito, justificativa, impacto_estimado, anuncios:[{ad_id,veredito,justificativa}]} | null`.
- Consumed by: Task 3 (main loop) e os testes.

- [ ] **Step 1: Atualizar os testes (RED)**

Em `coletor/budget-ia.test.mjs`, troque a chamada de `montarMensagens` (passa a receber `ads`) e adicione testes de `anuncios`. Substitua o teste `montarMensagens` existente por:

```js
test('montarMensagens: inclui objetivo, budget e os anúncios no texto do usuário', () => {
  const { system, user } = montarMensagens(
    { name: 'C1', objective: 'OUTCOME_SALES', daily_budget: '5000' },
    { spend: '120', ctr: '1.5', purchase_roas: [{ value: '3.2' }] },
    [{ ad_id: 'ad_9', ad_name: 'Criativo A', ctr: '0.15', spend: '80' }]
  );
  assert.match(system, /JSON/);
  assert.match(system, /anuncios/);
  assert.match(system, /escalar/);
  assert.match(user, /OUTCOME_SALES/);
  assert.match(user, /5000/);
  assert.match(user, /ad_9/);
});
```

E adicione estes testes de `anuncios` no `parsearSaida`:

```js
test('parsearSaida: anuncios válidos entram; inválidos são filtrados', () => {
  const o = parsearSaida('{"budget_sugerido_centavos":6000,"veredito":"manter","justificativa":"ok","impacto_estimado":"estável","anuncios":[{"ad_id":"ad_1","veredito":"pausar","justificativa":"CTR baixo"},{"ad_id":"ad_2","veredito":"turbinar","justificativa":"x"},{"veredito":"manter","justificativa":"sem id"}]}');
  assert.equal(o.anuncios.length, 1);
  assert.equal(o.anuncios[0].ad_id, 'ad_1');
  assert.equal(o.anuncios[0].veredito, 'pausar');
});
test('parsearSaida: sem anuncios = array vazio', () => {
  const o = parsearSaida('{"budget_sugerido_centavos":6000,"veredito":"escalar","justificativa":"ROAS bom","impacto_estimado":"+20% compras"}');
  assert.deepEqual(o.anuncios, []);
});
```

Run: `node --test coletor/budget-ia.test.mjs`
Expected: FALHA (montarMensagens ainda tem aridade 2 / parsearSaida sem `anuncios`).

- [ ] **Step 2: Reescrever `montarMensagens` (aceita `ads`, conceitos firmes, pede `anuncios`)**

Substitua a função inteira (L16-48) por:

```js
// Monta as mensagens (system + user) pro Opus: analisa a campanha E os anúncios dela.
export function montarMensagens(camp, ins, ads) {
  const system =
    'Você é um gestor de tráfego pago sênior. Analise UMA campanha do Meta Ads E os anúncios dela, e recomende: ' +
    '(1) o orçamento diário ideal da CAMPANHA; (2) por ANÚNCIO, manter ou pausar o criativo. ' +
    'Respeite o OBJETIVO da campanha (Vendas: ROAS/CAC; Tráfego: CPC/CTR; Reconhecimento: alcance/CPM; Leads: custo por lead; Engajamento: engajamento/CTR). ' +
    'CONCEITOS (obrigatórios): performance RUIM nunca vira "escalar" — CTR muito abaixo do aceitável pro objetivo, CPC/CPL alto, ROAS baixo, ou frequência alta (fadiga) → "reduzir" ou "pausar", NUNCA "escalar". ' +
    '"escalar" só com EVIDÊNCIA de eficiência (bom resultado a custo baixo) E volume/dado suficiente. Seja conservador quando faltar dado. ' +
    'Por anúncio: "pausar" criativo com performance ruim ou fadiga; "manter" os que vão bem. ' +
    'Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato: ' +
    '{"budget_sugerido_centavos": <inteiro, centavos de R$/dia>, ' +
    '"veredito": "escalar"|"reduzir"|"manter"|"pausar", ' +
    '"justificativa": "<1-2 frases PT-BR>", ' +
    '"impacto_estimado": "<estimativa curta PT-BR>", ' +
    '"anuncios": [ {"ad_id": "<id>", "veredito": "manter"|"pausar", "justificativa": "<1 frase PT-BR>"} ]}';
  const dados = {
    nome: camp.name || '',
    objetivo: camp.objective || '',
    budget_diario_atual_centavos: camp.daily_budget != null ? Number(camp.daily_budget) : null,
    budget_total_centavos: camp.lifetime_budget != null ? Number(camp.lifetime_budget) : null,
    gasto: num(ins.spend),
    impressoes: num(ins.impressions),
    cliques: num(ins.clicks),
    ctr_pct: num(ins.ctr),
    cpc: num(ins.cpc),
    alcance: num(ins.reach),
    frequencia: num(ins.frequency),
    roas: Array.isArray(ins.purchase_roas) && ins.purchase_roas[0] ? num(ins.purchase_roas[0].value) : null,
    acoes: ins.actions || null,
    valores_acao: ins.action_values || null,
    anuncios: (ads || []).map((a) => ({
      ad_id: a.ad_id || a.id || '',
      nome: a.ad_name || a.adset_name || '',
      gasto: num(a.spend),
      ctr_pct: num(a.ctr),
      cpc: num(a.cpc),
      impressoes: num(a.impressions),
      alcance: num(a.reach),
      frequencia: num(a.frequency),
    })),
  };
  const user =
    'Dados da campanha e dos anúncios (janela recente):\n' + JSON.stringify(dados) +
    '\nResponda apenas o JSON pedido.';
  return { system, user };
}
```

- [ ] **Step 3: Reescrever `parsearSaida` (valida `anuncios`)**

Acrescente `const VEREDITOS_AD = new Set(['manter', 'pausar']);` logo após a linha `const VEREDITOS = ...` (L5). Substitua `parsearSaida` (L51-69) por:

```js
// Extrai e valida o JSON da resposta. Retorna o objeto validado (com anuncios) ou null.
export function parsearSaida(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const b = o.budget_sugerido_centavos;
  if (!Number.isFinite(b) || b < 0) return null;
  if (!VEREDITOS.has(o.veredito)) return null;
  if (typeof o.justificativa !== 'string' || !o.justificativa.trim()) return null;
  if (typeof o.impacto_estimado !== 'string' || !o.impacto_estimado.trim()) return null;
  const anuncios = Array.isArray(o.anuncios)
    ? o.anuncios
        .filter((a) => a && typeof a.ad_id === 'string' && a.ad_id.trim()
          && VEREDITOS_AD.has(a.veredito)
          && typeof a.justificativa === 'string' && a.justificativa.trim())
        .map((a) => ({ ad_id: a.ad_id.trim(), veredito: a.veredito, justificativa: a.justificativa.trim() }))
    : [];
  return {
    budget_sugerido_centavos: Math.round(b),
    veredito: o.veredito,
    justificativa: o.justificativa.trim(),
    impacto_estimado: o.impacto_estimado.trim(),
    anuncios,
  };
}
```

- [ ] **Step 4: Rodar os testes (GREEN)**

Run: `node --test coletor/budget-ia.test.mjs`
Expected: PASS (todos, incluindo os novos de `anuncios`).

- [ ] **Step 5: Commit**
```bash
git add coletor/budget-ia.mjs coletor/budget-ia.test.mjs
git commit -m "feat(gt-v2): robô — prompt com anúncios + conceitos firmes; parse de anuncios + testes"
```

---

### Task 3: Robô — buscar anúncios e gravar `gt_ad_analises`

**Files:** Modify `coletor/budget-ia.mjs` (`main()`, área L155-210).

**Interfaces:** Consumes `montarMensagens(camp,ins,ads)` e `parsearSaida` (Task 2); tabela `gt_ad_analises` (Task 1). Produces linhas em `gt_ad_analises`.

- [ ] **Step 1: Buscar anúncios + insights de anúncio por conta de anúncio**

Dentro do `for (const aa of adAccounts)` (após buscar `camps`/`insights`, ~L172), acrescente a busca de anúncios e o merge do status, e agrupe anúncios ativos por campanha. Logo após a linha `insights.forEach((i) => { insByCamp[i.campaign_id] = i; });` (L174), adicione:

```js
      const adFields = 'ad_id,ad_name,adset_name,campaign_id,spend,impressions,clicks,ctr,cpc,reach,frequency';
      let adIns = [], adObjs = [];
      try {
        adIns = (await graphGet(`/act_${adAcc}/insights`, { level: 'ad', fields: adFields, time_range: { since, until }, limit: 500 }, acc.access_token)).data || [];
        adObjs = (await graphGet(`/act_${adAcc}/ads`, { fields: 'id,effective_status', limit: 500 }, acc.access_token)).data || [];
      } catch (e) { console.log('  act_' + adAcc + ' falhou ads no Graph: ' + e.message); }
      const adStatus = {};
      adObjs.forEach((a) => { adStatus[a.id] = a.effective_status || ''; });
      const adsAtivosPorCamp = {};
      adIns.forEach((a) => {
        if (adStatus[a.ad_id] !== 'ACTIVE') return; // só anúncios ativos
        (adsAtivosPorCamp[a.campaign_id] = adsAtivosPorCamp[a.campaign_id] || []).push(a);
      });
```

- [ ] **Step 2: Passar os anúncios pro Opus e gravar as análises de anúncio**

Na chamada de `montarMensagens` (L181), passe os anúncios da campanha:

De:
```js
      const { system, user } = montarMensagens(camp, ins);
```
Para:
```js
      const { system, user } = montarMensagens(camp, ins, adsAtivosPorCamp[camp.id] || []);
```

Aumente o `max_tokens` na chamada `anthropic(...)` (L185) de `4096` para `8192`.

Depois do bloco que grava `gt_budget_analises` (após `gravadas++;` do try da campanha, L204), adicione a gravação por anúncio (dentro do mesmo `for (const camp of ativas)`, após o `try/catch` do upsert da campanha):

```js
      if (saida.anuncios && saida.anuncios.length) {
        const adRows = saida.anuncios.map((a) => ({
          ad_id: a.ad_id,
          campaign_id: camp.id,
          account_id: acc.id,
          veredito: a.veredito,
          justificativa: a.justificativa,
          modelo: MODEL,
          gerado_em: new Date().toISOString(),
          valida_ate: proximaSegunda,
        }));
        try {
          await sbUpsert('/gt_ad_analises', adRows);
        } catch (e) { console.log('  ✗ gravar anúncios ' + (camp.name || camp.id) + ': ' + e.message); }
      }
```

- [ ] **Step 3: Verificar sintaxe + testes puros**

Run: `node --check coletor/budget-ia.mjs` → limpo.
Run: `node --test coletor/budget-ia.test.mjs` → 12/12 (os puros seguem passando; `main()` não roda no import).

- [ ] **Step 4: Commit**
```bash
git add coletor/budget-ia.mjs
git commit -m "feat(gt-v2): robô busca anúncios ativos, manda ao Opus e grava gt_ad_analises"
```

> **Verificação ao vivo (após merge):** disparar `gh workflow run budget-ia.yml --ref main` e conferir linhas em `gt_ad_analises` — DEFERIDO ao pós-merge (o workflow roda da main; os secrets já existem). Validar que nenhuma campanha com CTR ruim recebeu "escalar".

---

### Task 4: Tela — remover o motor de regras (só Opus)

**Files:** Modify `index.html` (deleções + rewire em `_renderGtCampaigns`/`_renderGtAds`).

**Interfaces:** Consumes (mantém) `_gtIABlocoHtml`, `_gtWireBudgetControls`, `_gtManualToggleBtn`, `_gtEncerrada`, `_gtBudgetIA`. Produces: tela sem motor de regras (postura/insight antigo/critérios/ações do motor), com o bloco do Opus por campanha intacto.

- [ ] **Step 1: Remover o `sug` e o `insightEl`/critério no render da campanha**

Em `_renderGtCampaigns` (loop `filtered.forEach`), remova:
- a linha `const sug=_gtInlineSuggest(ins,camp,insights);`
- a linha `const insightEl=document.createElement('div');insightEl.className=\`gt-insight ${sug.priority}\`;` e a seguinte `insightEl.innerHTML=...`
- troque `let actBar=_gtRenderActions(sug.actions,row);` por `let actBar=null;`
- na linha `inner.appendChild(top);inner.appendChild(insightEl);` remova o `inner.appendChild(insightEl);` (fica só `inner.appendChild(top);`)
- remova o bloco `if(sug.criteria){const cr=...;inner.appendChild(cr);}`
Mantém intactos: `iaRow`/`iaBloco`/`if(iaRow&&!encerrada){...appendChild(iaEl);_gtWireBudgetControls(...)}`, o `_gtManualToggleBtn`, e `if(!encerrada&&actBar)inner.appendChild(actBar);`.

- [ ] **Step 2: Remover a barra de postura e o botão "?"**

- Remova o bloco da barra de postura (o comentário "Seletor de POSTURA…" + `const postBar=...` + o `GT_POSTURAS.forEach(...)`).
- Na montagem do `hdrRight`, remova o `hdrRight.appendChild(postBar);` (mantém `filterWrap` e `searchInp`).
- Remova o botão de ajuda: as 3 linhas do `helpBtn` (`const helpBtn=...`, o `helpBtn.style.cssText=...`, e `helpBtn.onclick=()=>gtCriterios();ttlWrap.appendChild(helpBtn);`).

- [ ] **Step 3: Remover o `sug`/`insightEl` no render do anúncio**

Em `_renderGtAds`, remova:
- `const sug=_gtInlineSuggestAd(ad,allAdInsights);`
- `const insightEl=document.createElement('div');insightEl.className=\`gt-insight ${sug.priority}\`;` + `insightEl.innerHTML=...`
- troque `let actBar=_gtRenderActions(sug.actions,card);` por `let actBar=null;`
- na linha `card.appendChild(top);card.appendChild(insightEl);if(actBar)card.appendChild(actBar);` remova o `card.appendChild(insightEl);` (fica `card.appendChild(top);if(actBar)card.appendChild(actBar);`).
Mantém o `_gtManualToggleBtn('ad',...)`.

- [ ] **Step 4: Deletar as funções/consts mortas**

Delete por completo: `_gtInlineSuggest`, `_gtInlineSuggestAd`, `_gtVerdict`, `gtCriterios`, `GT_PRESETS`, `GT_POSTURAS`, `_gtPostura`, `GT_CRIT`, `_gtSetPostura`, e `_gtRenderActions` (agora sem uso).

- [ ] **Step 5: Remover helpers órfãos (só se ficaram sem uso)**

Rode `grep -n "_getActions\|_gtObjCategory" index.html`. Se algum ficou **sem nenhuma referência** após as remoções, delete a definição dele. Se ainda houver uso em outro lugar, NÃO delete.

- [ ] **Step 6: Verificar sintaxe**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_v2chk'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_v2chk*.js; do node --check "$f" && echo OK; done
```
Também: `grep -n "_gtInlineSuggest\|_gtVerdict\|GT_CRIT\|GT_POSTURAS\|_gtPostura\|gtCriterios\|_gtRenderActions\|postBar\|helpBtn" index.html` → **sem resultados** (tudo removido).
Expected: todos os inline scripts OK; grep vazio. Visual DEFERIDO ao usuário. NÃO dar `git push`.

- [ ] **Step 7: Commit**
```bash
git add index.html
git commit -m "feat(gt-v2): aposenta o motor de regras da GT (postura/insight antigo/critérios/ações)"
```

---

### Task 5: Tela — análise do Opus por anúncio + auto-desdobrar + status "Concluído"

**Files:** Modify `index.html` (`loadGtData`, `_renderGtCampaigns`, `_renderGtAds`, + novos helpers perto de `_gtIABlocoHtml`).

**Interfaces:** Consumes `gt_ad_analises` (Task 1/3), `_gtEsc`, `sb`. Produces `_gtAdIA` (mapa ad_id→row), `_gtLoadAdIA()`, `_gtAdIABlocoHtml(adRow)`; ads auto-desdobrados; badge "Concluído".

- [ ] **Step 1: Global + carregador de `gt_ad_analises`**

Perto de `let _gtBudgetIA={};` e `_gtLoadBudgetIA` (~L7907), adicione:
```javascript
let _gtAdIA={};
async function _gtLoadAdIA(){
  try{
    const rows=await sb('gt_ad_analises?select=ad_id,veredito,justificativa,gerado_em');
    _gtAdIA={};
    (rows||[]).forEach(r=>{ if(r&&r.ad_id) _gtAdIA[r.ad_id]=r; });
  }catch(e){ _gtAdIA={}; }
}
```
E em `loadGtData`, logo após `await _gtLoadBudgetIA();`, adicione `await _gtLoadAdIA();`.

- [ ] **Step 2: Helper de HTML da análise por anúncio**

Perto de `_gtIABlocoHtml`, adicione:
```javascript
// Bloco da análise do Opus por anúncio (manter/pausar). row = _gtAdIA[ad_id].
function _gtAdIABlocoHtml(row){
  if(!row)return '';
  const cor=row.veredito==='pausar'?'#dc2626':'#16a34a';
  const quando=row.gerado_em?new Date(row.gerado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'';
  return `<div class="gt-ia-sug" style="margin-top:6px;padding:6px 9px;border:1px solid var(--border);border-left:3px solid ${cor};border-radius:7px;background:var(--surface2);">
    <span style="font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${cor};">✦ IA · ${_gtEsc(quando)} · ${_gtEsc(row.veredito||'')}</span>
    <div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4;">${_gtEsc(row.justificativa||'')}</div>
  </div>`;
}
```

- [ ] **Step 3: Renderizar a análise por anúncio em `_renderGtAds`**

No `sorted.forEach(ad=>{...})`, troque a linha final de montagem do card `card.appendChild(top);if(actBar)card.appendChild(actBar);` pela versão abaixo, que insere o bloco de análise do anúncio entre o `top` e o `actBar` (ordem no card: top → bloco IA do anúncio → actBar):
```javascript
    card.appendChild(top);
    const adIaRow=_gtAdIA[ad.ad_id];
    if(adIaRow){ const adIaEl=document.createElement('div'); adIaEl.innerHTML=_gtAdIABlocoHtml(adIaRow); card.appendChild(adIaEl.firstElementChild); }
    if(actBar)card.appendChild(actBar);
```

- [ ] **Step 4: Auto-desdobrar os anúncios**

Em `_renderGtCampaigns`, a `adsPane` hoje abre só no clique (`top.addEventListener('click',...)`). Faça abrir por padrão quando a campanha tem anúncios. Logo após `row.appendChild(inner);row.appendChild(adsPane);` (antes do `list.appendChild(row);`), adicione:
```javascript
      if(ads.length){ adsPane.classList.add('open'); chev.classList.add('open'); adsPane.dataset.loaded='1'; _renderGtAds(adsPane,ads,insights,adInsights); }
```
Mantém o `top.addEventListener('click',...)` existente (permite recolher/reexpandir; o guard `if(isOpen&&!adsPane.dataset.loaded)` evita render duplicado).

- [ ] **Step 5: Status "Concluído" (campanha)**

No cálculo do badge da campanha, troque o rótulo `'Encerrada'` por `'Concluído'`:
De `const badgeLbl=encerrada?'Encerrada':(...)` para `const badgeLbl=encerrada?'Concluído':(...)`. (O `badgeCls` continua `'inactive'`.)

- [ ] **Step 6: Verificar sintaxe**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_v2chk'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_v2chk*.js; do node --check "$f" && echo OK; done
```
Expected: todos OK. Visual (anúncios desdobrados com análise IA; badge "Concluído") DEFERIDO ao usuário. NÃO dar `git push`.

- [ ] **Step 7: Commit**
```bash
git add index.html
git commit -m "feat(gt-v2): análise do Opus por anúncio + auto-desdobrar anúncios + status Concluído"
```

---

## Notas de execução

- **Ordem:** T1 → T2 → T3 (robô), T4 → T5 (tela). T4 e T5 mexem nas MESMAS funções de render — em sequência, nunca em paralelo.
- **Bug da cor (item 5):** NÃO está neste plano — vira tarefa de debugging separada depois do merge.
- **Deploy do robô:** roda da `main` via GitHub Actions; a validação ao vivo (rodar o workflow + conferir gt_ad_analises + checar que CTR ruim não virou "escalar") é pós-merge.
- **Front:** merge/push feito pelo controlador; validação visual pelo Breno.
