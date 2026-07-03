# Redesign seção "02 · Meta Ads" — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar os 4 cards da seção "02 · Meta Ads" consistentes (os 2 de custo ganham meta editável + comparação), com semáforo de custo (verde/amarelo/vermelho vs meta) reaproveitando o motor que o card "custo por seguidor" já usa, e os chips com rótulo "Eficiência".

**Architecture:** Só markup/CSS + wiring em `index.html`, reaproveitando a persistência de metas (`saveGoal`/`loadGoal`/`getGoal`/`watchGoals`, localStorage + Supabase `social_metas`) e o semáforo (`applyMetricInverse`/`perfColor`/`_mcValColor`) que já existem. Nada de coleta, cálculo de custo, robô ou modelo de card novo muda.

**Tech Stack:** `index.html` monólito (JS inline). Metas via `GOALS`/`RATE_GOALS` + localStorage `ig_goal_*` + `social_metas`.

## Global Constraints

- **Branch:** `feat/meta-ads-secao` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Manter o card do painel:** usar `.card`/`.mc-header`/`.mc-icon`/`.mc-goal-area`/`.mc-lbl`/`.mc-val`/`.mc-compare`/`.mc-divider`/`.mc-progress-track`/`.mc-bottom`/`.calc-badge`/`.sec-chip` existentes. NÃO criar modelo de card novo.
- **Reaproveitar o semáforo existente:** o card "custo por seguidor" (`cps`) já usa `applyMetricInverse(key,curr,goal)` → `perfColor` (green≥100% / yellow≥75% / orange≥50% / red<50%, onde pct=goal/curr×100) → `_mcValColor` (cor no número) + barra `bg-<clr>` + `pct-`/`diff-`. Os 2 cards de custo novos chamam a MESMA função. **É a régua da casa** — não inventar faixas próprias.
- **Semáforo vale só pros 3 custos "menor é melhor"** (cps, cpi, cpl). O card **Investimento** (`spend`, budget) continua como hoje (`applySpend`, neutro/accent + barra) — NÃO entra no semáforo de custo.
- **Sem meta / dado ausente:** `applyMetricInverse` só é chamado quando o valor > 0; sem valor, o card mostra `R$ —` sem cor (como hoje).
- **Persistência das metas novas = idêntica às atuais:** `cpi`/`cpl` entram em `GOALS` e `RATE_GOALS` (são taxas), os `<span class="mc-goal-val" id="goal-cpi/goal-cpl" contenteditable>` são pegos por `watchGoals()` automaticamente (querySelectorAll `.mc-goal-val`), e `updateGoalDisplays` já varre `GOALS`.
- **Sem harness de teste de DOM** (padrão do monólito): gate automático = extrair inline scripts + `node --check` + greps; **validação visual DEFERIDA ao Breno**. NÃO `git push`.
- **Escopo:** só a seção 02. Não mexer nas seções 01/03/04.

---

### Task 1: Markup dos 2 cards de custo (anatomia completa) + metas + rótulo dos chips

**Files:** Modify `index.html`: os 2 cards de custo no HTML (~L3136-3147), o objeto `GOALS` (~L3291), `RATE_GOALS` (~L3367), e um rótulo antes de `chips-ads-custo` (~L3149).

**Interfaces:**
- Consumes: classes/ids existentes; `watchGoals`/`updateGoalDisplays` (pegam `.mc-goal-val` e `GOALS` automaticamente).
- Produces (ids que a Task 2 vai preencher): `goal-cpi`/`goal-cpl` (metas editáveis), `cmp-cpi`/`cmp-cpl`, `prog-cpi`/`prog-cpl`, `pct-cpi`/`pct-cpl`, `diff-cpi`/`diff-cpl`; `GOALS.cpi`/`GOALS.cpl`; `RATE_GOALS` inclui `cpi`,`cpl`.

- [ ] **Step 1: Dar anatomia completa aos 2 cards de custo**

Troque os DOIS cards "pelados" (custo por interação e custo por curtida) no HTML:

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

por (mesma estrutura rica dos 2 primeiros — meta ✏ + comparação + barra + rodapé):

```html
    <div class="card">
      <div class="mc-header">
        <div class="mc-icon">🤝</div>
        <div class="mc-goal-area">
          <span class="mc-goal-lbl">META MÁX</span>
          <span class="mc-goal-val" id="goal-cpi" contenteditable="true" spellcheck="false">0.15</span>
          <span class="mc-edit-hint">✏</span>
        </div>
      </div>
      <div class="mc-lbl">CUSTO POR INTERAÇÃO</div>
      <div class="mc-val a-purple" id="ads-cpi-val">R$ —</div>
      <div class="mc-compare" id="cmp-cpi"></div>
      <div class="mc-divider"></div>
      <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-cpi" style="width:0%"></div></div>
      <div class="mc-bottom">
        <span class="mc-pct" id="pct-cpi">0%</span>
        <span class="mc-diff" id="diff-cpi"></span>
      </div>
      <div class="calc-badge">⚡ Menor é melhor · investimento ÷ interações do anúncio</div>
    </div>
    <div class="card">
      <div class="mc-header">
        <div class="mc-icon">❤️</div>
        <div class="mc-goal-area">
          <span class="mc-goal-lbl">META MÁX</span>
          <span class="mc-goal-val" id="goal-cpl" contenteditable="true" spellcheck="false">0.20</span>
          <span class="mc-edit-hint">✏</span>
        </div>
      </div>
      <div class="mc-lbl">CUSTO POR CURTIDA</div>
      <div class="mc-val a-blue" id="ads-cpl-val">R$ —</div>
      <div class="mc-compare" id="cmp-cpl"></div>
      <div class="mc-divider"></div>
      <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-cpl" style="width:0%"></div></div>
      <div class="mc-bottom">
        <span class="mc-pct" id="pct-cpl">0%</span>
        <span class="mc-diff" id="diff-cpl"></span>
      </div>
      <div class="calc-badge">⚡ Menor é melhor · investimento ÷ curtidas do anúncio</div>
    </div>
```

- [ ] **Step 2: Defaults das metas novas em `GOALS`**

No objeto `const GOALS={...}` (~L3291), acrescente duas linhas (taxas — mesmo valor em todo período, como `cps`):
```javascript
  cpi:{1:0.15,7:0.15,14:0.15,30:0.15},
  cpl:{1:0.20,7:0.20,14:0.20,30:0.20},
```

- [ ] **Step 3: `cpi`/`cpl` são taxas em `RATE_GOALS`**

Troque `const RATE_GOALS=['cps'];` por:
```javascript
const RATE_GOALS=['cps','cpi','cpl'];
```

- [ ] **Step 4: Rótulo "Eficiência" antes dos chips**

Troque a linha `<div class="sec-chips" id="chips-ads-custo" style="margin-bottom:40px;"></div>` por:
```html
  <div class="mc-lbl" style="margin:0 0 8px;">EFICIÊNCIA DO INVESTIMENTO</div>
  <div class="sec-chips" id="chips-ads-custo" style="margin-bottom:40px;"></div>
```

- [ ] **Step 5: Verificar**

Run: `grep -c "goal-cpi\|goal-cpl\|prog-cpi\|prog-cpl\|EFICIÊNCIA DO INVESTIMENTO" index.html` → > 0.
Run: `grep -n "cpi:{1:0.15\|RATE_GOALS=\['cps','cpi','cpl'\]" index.html` → aparece.
Visual DEFERIDO ao usuário.

- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "feat(meta-ads): cards de custo com meta editável + comparação (anatomia igual aos demais) + rótulo Eficiência"
```

---

### Task 2: Wiring do render — valores + semáforo (reusa applyMetricInverse) + borda-esquerda

**Files:** Modify `index.html`: o bloco de render da seção 02 (~L4061-4063, dentro de `update(d,period)`), e adicionar o helper `_mcBorderColor` perto de `_mcValColor` (~L3365).

**Interfaces:**
- Consumes: `applyMetricInverse(key,curr,goal)`, `getGoal(key)`, `perfColor(pct)`, `_PERF_VAR`, `fmtR`, `d.spend`/`d.adEngagement`/`d.adLikes`; ids da Task 1.
- Produces: `_mcBorderColor(key,clr)` (pinta a borda-esquerda do card).

- [ ] **Step 1: Helper da borda-esquerda semáforo**

Logo após a função `_mcValColor(...)` (~L3365), acrescente:
```javascript
function _mcBorderColor(key,clr){const pe=document.getElementById('pct-'+key);const card=pe&&pe.closest('.card');if(!card)return;card.style.borderLeftColor=clr?(_PERF_VAR[clr]||''):'';}
```

- [ ] **Step 2: Render dos 2 custos com valor + semáforo + borda**

No bloco de render, troque estas 3 linhas:
```javascript
  const _cpu=(n)=>n>0&&d.spend>0?fmtR(d.spend/n):'R$ —';
  document.getElementById('ads-cpi-val').textContent=_cpu(d.adEngagement);
  document.getElementById('ads-cpl-val').textContent=_cpu(d.adLikes);
```
por:
```javascript
  const cpi=(d.adEngagement>0&&d.spend>0)?d.spend/d.adEngagement:0;
  const cpl=(d.adLikes>0&&d.spend>0)?d.spend/d.adLikes:0;
  document.getElementById('ads-cpi-val').textContent=cpi>0?fmtR(cpi):'R$ —';
  document.getElementById('ads-cpl-val').textContent=cpl>0?fmtR(cpl):'R$ —';
  if(cpi>0){const g=getGoal('cpi');applyMetricInverse('cpi',cpi,g);_mcBorderColor('cpi',perfColor((g/cpi)*100));}else{_mcBorderColor('cpi','');}
  if(cpl>0){const g=getGoal('cpl');applyMetricInverse('cpl',cpl,g);_mcBorderColor('cpl',perfColor((g/cpl)*100));}else{_mcBorderColor('cpl','');}
```

- [ ] **Step 3: Borda-esquerda também no card "custo por seguidor" (consistência da seção)**

Logo após a linha existente `if(d.cps>0)applyMetricInverse('cps',d.cps,getGoal('cps'));`, acrescente na MESMA linha/bloco:
```javascript
  if(d.cps>0){const gcps=getGoal('cps');_mcBorderColor('cps',perfColor((gcps/d.cps)*100));}else{_mcBorderColor('cps','');}
```

- [ ] **Step 4: Verificar**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_ma'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_ma*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "_mcBorderColor\|applyMetricInverse('cpi'\|applyMetricInverse('cpl'" index.html` → ≥ 3.
Expected: inline scripts `OK`. Visual DEFERIDO ao Breno (número/borda/selo verde/amarelo/vermelho conforme a meta; editar a meta re-pinta via `refresh()`). NÃO `git push`.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat(meta-ads): semáforo nos custos (reusa applyMetricInverse) + borda-esquerda por meta nos 3 cards de custo"
```

---

## Notas de execução

- **Ordem:** T1 (markup+metas) → T2 (render+semáforo). T2 usa os ids da T1.
- **Régua do semáforo:** é a MESMA de hoje do card "custo por seguidor" (`perfColor`: verde ≤ meta, depois amarelo/laranja/vermelho conforme sobe) — para os 3 cards ficarem idênticos. Não é exatamente o "verde/amarelo/vermelho a cada 20%" do rascunho; é a régua da casa. Se o Breno quiser faixas próprias, é ajuste de 1 função depois.
- **Validação do Breno no preview:** editar a meta de "custo por interação"/"custo por curtida" e ver o card re-pintar; conferir claro/escuro; conferir que os 4 cards ficaram no mesmo formato.
