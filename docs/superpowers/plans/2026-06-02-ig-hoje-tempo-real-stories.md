# HOJE em tempo real + correção do indicador de Stories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No dashboard de redes sociais, o período HOJE passa a mostrar o líquido de seguidores em tempo real (sem barra "chapada" de bruto não-consolidado), o gráfico do HOJE mostra os últimos 7 dias de contexto, e o indicador de Stories passa a ser somado por-dia dentro da janela (corrige HOJE = 1D).

**Architecture:** Tudo numa única função `fetchData` (+ `buildChart`/`update`) do arquivo único `projetos/central-inteligencia/central-inteligencia-v1.3.html`. Reordena-se o cálculo das janelas dia-precisas (`followStart`/`followEnd`/`prevStartStr`/`prevEndStr`) para ANTES das queries, de modo que Stories use as mesmas janelas. HOJE usa o delta de `followers_count` (já coletado) como líquido em tempo real.

**Tech Stack:** HTML/JS vanilla + Supabase REST (`sb()`), Chart SVG próprio. Sem framework de testes — verificação por: checagem de sintaxe dos `<script>` inline via Node, simulação de lógica de datas em Node, e conferência de dados via SQL (Supabase MCP, projeto `kounqtdoioootxqegkij`).

**Convenção do projeto:** após CADA edição do `.html`, rodar `cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html` e `git push origin main`. Datas sempre em BRT (`America/Sao_Paulo`); o banco está em UTC (não usar `CURRENT_DATE` para "hoje").

**Helper de verificação de sintaxe (usado em vários passos):**
```bash
cd /Users/erickmartins/iamundi && cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html && node -e '
const fs=require("fs"),vm=require("vm");const html=fs.readFileSync("index.html","utf8");
const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0,bad=0;
while((m=re.exec(html))){if(/\bsrc=/.test(m[1]||""))continue;i++;try{new vm.Script(m[2]);}catch(e){bad++;console.log("X #"+i+": "+e.message);}}
console.log("inline scripts:",i,"| erros:",bad,bad===0?"OK":"FALHOU");'
```
Esperado sempre: `erros: 0 OK`.

---

### Task 1: Reordenar janelas + Stories por-dia (Seção 3)

Move o cálculo das janelas dia-precisas para antes das queries e faz Stories (count/shares/replies) somar por-dia dentro da janela, corrigindo HOJE = 1D.

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.3.html` (função `fetchData`)

- [ ] **Step 1: Localizar os trechos**

Run:
```bash
cd /Users/erickmartins/iamundi && F=projetos/central-inteligencia/central-inteligencia-v1.3.html
grep -n "periodStartStr2=localDate\|const\[snaps,engCurr\|storyDailyCurr\|storyDailyPrev\|const periodStart=new Date(refDate)\|let followStart,followEnd\|const prevWindow=snaps.filter\|const storyShares=\|const storiesCount=\|const prevStoriesCount=" "$F"
```
Anotar as linhas de: (a) bloco `periodStart`/`followStart`/`followEnd` (hoje DEPOIS do Promise.all); (b) `prevStartStr`/`prevEndStr`; (c) as queries `storyDailyCurr`/`storyDailyPrev` no Promise.all; (d) os cálculos `storyShares`/`storyRep`/`storiesCount`/`prevStoriesCount`.

- [ ] **Step 2: Mover o cálculo das janelas para ANTES do Promise.all**

Recortar este bloco (que hoje está logo após `const periodStart=new Date(refDate)...`, depois do Promise.all) e colá-lo IMEDIATAMENTE ANTES da linha `const[snaps,engCurr,engPrev,...]=await Promise.all([`. O bloco a mover/garantir antes do Promise.all:

```javascript
  const periodStart=new Date(refDate);periodStart.setDate(periodStart.getDate()-effectivePeriod);
  const periodStartStr=localDate(periodStart);
  // Janelas dia-precisas por período: HOJE = só hoje · 1D = só ontem · demais = rolante/mês.
  const _hojeBRT=localDate(new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})));
  const _ontemBRT=localDate(new Date(new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})).getTime()-86400000));
  let followStart,followEnd;
  if(isHoje){followStart=followEnd=_hojeBRT;}
  else if(period===1){followStart=followEnd=_ontemBRT;}
  else{followStart=periodStartStr;followEnd=refDateStr;}
  const _fsMs=new Date(followStart+'T00:00:00').getTime();
  const _spanDays=Math.round((new Date(followEnd+'T00:00:00').getTime()-_fsMs)/86400000)+1;
  const prevEndStr=localDate(new Date(_fsMs-86400000));
  const prevStartStr=localDate(new Date(_fsMs-_spanDays*86400000));
```

Depois, no local ORIGINAL (após o Promise.all), REMOVER as definições duplicadas de `periodStart`, `periodStartStr`, `_hojeBRT`, `_ontemBRT`, `followStart`, `followEnd`, `_fsMs`, `_spanDays`, `prevEndStr`, `prevStartStr` (todas agora estão acima). Manter apenas o restante do bloco de seguidores (inWindow, latest, etc.).

- [ ] **Step 3: Trocar as queries de Stories para a janela dia-precisa**

Na lista do `Promise.all`, substituir as duas linhas das stories (`storyDailyCurr` e `storyDailyPrev`) por estas (usam `period_days=1`, somam por dia dentro das janelas e trazem `captured_at`):

```javascript
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.1&captured_at=gte.${followStart}&captured_at=lte.${followEnd}&select=captured_at,story_shares,story_replies,stories_count`),
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.1&captured_at=gte.${prevStartStr}&captured_at=lte.${prevEndStr}&select=captured_at,story_shares,story_replies,stories_count`),
```

- [ ] **Step 4: Recalcular storiesCount/shares/replies como soma da janela (todos os períodos)**

Localizar os cálculos atuais (`storyShares`, `storyRep`, `prevStoryShares`, `prevStoryRep`, `storiesCount`, `prevStoriesCount`) e substituí-los por:

```javascript
  const storyShares=storyDailyCurr.reduce((s,r)=>s+(r.story_shares||0),0);
  const storyRep=storyDailyCurr.reduce((s,r)=>s+(r.story_replies||0),0);
  const prevStoryShares=storyDailyPrev.length?storyDailyPrev.reduce((s,r)=>s+(r.story_shares||0),0):null;
  const prevStoryRep=storyDailyPrev.length?storyDailyPrev.reduce((s,r)=>s+(r.story_replies||0),0):null;
  // Stories postados: soma diária dentro da janela (corrige HOJE = 1D). Posts/Reels NÃO mudam (são por-período).
  const storiesCount=storyDailyCurr.reduce((s,r)=>s+(r.stories_count||0),0);
  const prevStoriesCount=storyDailyPrev.length?storyDailyPrev.reduce((s,r)=>s+(r.stories_count||0),0):null;
```

Garantir que NÃO sobraram referências a `periodStartStr2`/`prevPeriodStartStr2`/`storyQP` (que ficam órfãs). Remover essas linhas se existirem.

- [ ] **Step 5: Verificar que não sobraram referências órfãs**

Run:
```bash
cd /Users/erickmartins/iamundi && grep -n "periodStartStr2\|prevPeriodStartStr2\|storyQP" projetos/central-inteligencia/central-inteligencia-v1.3.html
```
Esperado: nenhuma linha (vazio). Se aparecer alguma, removê-la (eram do esquema antigo).

- [ ] **Step 6: Checar sintaxe**

Rodar o "Helper de verificação de sintaxe" (topo do plano). Esperado: `erros: 0 OK`.

- [ ] **Step 7: Conferir os dados esperados (Breno) via SQL**

Confirmar que HOJE (02/06) e 1D (01/06) de stories agora DIFEREM. Via Supabase MCP (`execute_sql`, projeto `kounqtdoioootxqegkij`):
```sql
SELECT captured_at, stories_count, story_shares, story_replies
FROM content_snapshots cs JOIN accounts a ON a.id=cs.account_id
WHERE a.instagram_id='17841401284454639' AND cs.period_days=1
  AND cs.captured_at IN ('2026-06-01','2026-06-02') ORDER BY captured_at;
```
Esperado: 01/06 = 0/0/0 e 02/06 = 10/8/13 (valores distintos → HOJE mostrará 10, 1D mostrará 0).

- [ ] **Step 8: Commit**

```bash
cd /Users/erickmartins/iamundi && cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html && git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html && git commit -m "Stories: soma por-dia dentro da janela (corrige HOJE=1D); janelas movidas p/ antes das queries"
```

---

### Task 2: HOJE — líquido de seguidores em tempo real (Seção 1)

No período HOJE, `newFollowers` passa a ser o delta da contagem total (hoje − ontem); o bruto ▲/▼ vira uma nota.

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.3.html` (função `fetchData` bloco de seguidores + `update`)

- [ ] **Step 1: Localizar o bloco de seguidores e o return**

Run:
```bash
cd /Users/erickmartins/iamundi && F=projetos/central-inteligencia/central-inteligencia-v1.3.html
grep -n "const inWindow=snaps.filter\|const grossGained=\|const newFollowers=grossGained\|grossGained,grossLost,\|lastSnap:snaps.length\|const grossEl=document.getElementById('gross-followers')" "$F"
```

- [ ] **Step 2: Calcular o líquido em tempo real no HOJE**

Localizar o trecho onde `grossGained`/`grossLost`/`newFollowers` são definidos (logo após `gainedArr`/`lostArr`). Substituir o cálculo de `newFollowers` por uma versão que trata HOJE:

```javascript
  const grossGained=gainedArr.reduce((a,b)=>a+b,0);
  const grossLost=lostArr.reduce((a,b)=>a+b,0);
  // HOJE: bruto (novos/saíram) só consolida amanhã → mostrar LÍQUIDO em tempo real
  // pela variação da contagem total (hoje − ontem), sem chamada nova à API.
  let newFollowers, realtimeHoje=false;
  if(isHoje){
    const _ydaySnap=[...snaps].reverse().find(s=>s.captured_at<=_ontemBRT);
    const _ytot=_ydaySnap?_ydaySnap.followers_count:null;
    newFollowers=(_ytot!=null)?(latest-_ytot):0; // latest = total de hoje (snapshot mais recente)
    realtimeHoje=true;
  }else{
    newFollowers=grossGained-grossLost; // LÍQUIDO real (bruto)
  }
```

(Remover a linha antiga `const newFollowers=grossGained-grossLost;` que existia.)

- [ ] **Step 3: Expor `realtimeHoje` no objeto de retorno**

No `return{...}` da `fetchData`, na linha que já tem `grossGained,grossLost,`, acrescentar `realtimeHoje`:

```javascript
    grossGained,grossLost,realtimeHoje,
```

- [ ] **Step 4: Na `update()`, trocar a sublinha ▲/▼ pela nota no HOJE**

Localizar o bloco do `gross-followers` em `update()` e substituí-lo por:

```javascript
  const grossEl=document.getElementById('gross-followers');
  if(grossEl){
    if(d.realtimeHoje){
      grossEl.style.display='flex';
      grossEl.innerHTML=`<span style="color:var(--muted);font-weight:500;">líquido em tempo real · novos/saíram consolidam amanhã</span>`;
    }else if((d.grossGained||0)+(d.grossLost||0)>0){
      grossEl.style.display='flex';
      grossEl.innerHTML=`<span style="color:#16a34a">▲ ${fmtN(d.grossGained)} novos</span><span style="color:#dc2626">▼ ${fmtN(d.grossLost)} saíram</span>`;
    }else{grossEl.style.display='none';}
  }
```

- [ ] **Step 5: Checar sintaxe**

Rodar o "Helper de verificação de sintaxe". Esperado: `erros: 0 OK`.

- [ ] **Step 6: Simular o cálculo do líquido em Node**

Confirmar a lógica hoje−ontem com dados reais do Breno (hoje=02/06, ontem=01/06). Buscar os totais via SQL (Supabase MCP):
```sql
SELECT captured_at, followers_count FROM daily_snapshots ds JOIN accounts a ON a.id=ds.account_id
WHERE a.instagram_id='17841401284454639' AND captured_at IN ('2026-06-01','2026-06-02') ORDER BY captured_at;
```
Verificar manualmente: `newFollowers(HOJE) = followers_count(02/06) − followers_count(01/06)`. Deve ser um número plausível (diferença pequena), e DIFERENTE do 1D (que usa o bruto de 01/06).

- [ ] **Step 7: Commit**

```bash
cd /Users/erickmartins/iamundi && cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html && git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html && git commit -m "HOJE: líquido de seguidores em tempo real (delta da contagem total) + nota no lugar de novos/saíram"
```

---

### Task 3: HOJE — gráfico mostra os últimos 7 dias de contexto (Seção 2)

No HOJE, o gráfico de barras usa os últimos 7 dias já consolidados (não o dia único).

**Files:**
- Modify: `projetos/central-inteligencia/central-inteligencia-v1.3.html` (função `fetchData`: arrays do gráfico)

- [ ] **Step 1: Localizar a montagem do gráfico**

Run:
```bash
cd /Users/erickmartins/iamundi && grep -n "const gainedArr=inWindow.map\|const chartLabels=inWindow.length\|const chartDates=inWindow.length\|chart:{gained:gainedArr" projetos/central-inteligencia/central-inteligencia-v1.3.html
```

- [ ] **Step 2: Derivar arrays do gráfico (contexto de 7 dias no HOJE)**

Logo APÓS as definições de `gainedArr`/`lostArr` e ANTES do `return`, adicionar a derivação dos arrays do gráfico que troca para os últimos 7 dias no HOJE. Localizar as linhas `const chartLabels=inWindow.length?...` e `const chartDates=inWindow.length?...` e substituí-las por:

```javascript
  // Gráfico: nos períodos normais usa a própria janela; no HOJE (dia único, bruto não-consolidado)
  // mostra os ÚLTIMOS 7 DIAS já consolidados como contexto recente.
  let chartGained=gainedArr, chartLost=lostArr, chartSrc=inWindow;
  if(isHoje){
    chartSrc=snaps.filter(s=>s.captured_at<_hojeBRT).slice(-7);
    chartGained=chartSrc.map(s=>Number(s.gained)||0);
    chartLost=chartSrc.map(s=>Number(s.lost)||0);
  }
  const chartLabels=chartSrc.length?chartSrc.map(s=>fmtLabel(s.captured_at)):['Hoje'];
  const chartDates=chartSrc.length?chartSrc.map(s=>fmtFull(s.captured_at)):['Hoje'];
```

- [ ] **Step 3: Apontar o `chart` do return para os arrays novos**

No `return{...}`, trocar a linha do chart:

```javascript
    chart:{gained:chartGained,lost:chartLost,labels:chartLabels,dates:chartDates},
```

- [ ] **Step 4: Checar sintaxe**

Rodar o "Helper de verificação de sintaxe". Esperado: `erros: 0 OK`.

- [ ] **Step 5: Conferência de lógica**

Confirmar mentalmente/via leitura: para `period===0` (HOJE), `chartSrc` = últimos 7 snapshots com `captured_at < hoje` → barras dos 7 dias consolidados; para os demais períodos, `chartGained/chartLost` = `gainedArr/lostArr` (inalterado). O indicador (Task 2) continua mostrando o líquido de hoje em tempo real.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iamundi && cp projetos/central-inteligencia/central-inteligencia-v1.3.html index.html && git add index.html projetos/central-inteligencia/central-inteligencia-v1.3.html && git commit -m "HOJE: gráfico mostra últimos 7 dias de contexto (bruto consolidado)" && git push origin main"
```

---

## Self-Review (preenchido)

**1. Cobertura da spec:**
- Seção 1 (HOJE líquido tempo real) → Task 2. ✓
- Seção 2 (gráfico HOJE = 7 dias) → Task 3. ✓
- Seção 3 (Stories por-dia) → Task 1. ✓
- Fora de escopo (bruto em tempo real, proxy F5, coletor) → respeitado (nenhuma task mexe nisso). ✓

**2. Placeholders:** nenhum "TBD/TODO"; todo passo tem código ou comando concreto. ✓

**3. Consistência de tipos/nomes:** `followStart`/`followEnd`/`prevStartStr`/`prevEndStr` definidos na Task 1 e reusados; `realtimeHoje` definido na Task 2 (fetchData) e consumido na mesma task (update); `chartGained`/`chartLost` definidos e usados no return na Task 3; `storyDailyCurr`/`storyDailyPrev` mantêm o nome das variáveis do Promise.all. ✓

**Nota:** não há runner de testes neste projeto (HTML único, sem framework). As verificações usam checagem de sintaxe via Node + conferência de dados via SQL (Supabase MCP) + leitura da lógica — o equivalente prático de teste aqui.
