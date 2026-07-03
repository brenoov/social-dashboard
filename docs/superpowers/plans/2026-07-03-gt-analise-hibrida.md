# Análise híbrida GT (Opus + regras ao vivo) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda campanha/anúncio ATIVO ter recomendação ao abrir a Gestão de Tráfego: usa a análise do Opus quando existe, senão calcula por regras no navegador (sem API), tudo aparecendo igual e sem data.

**Architecture:** Ressuscitar o motor de regras client-side (removido no v2), numa versão limpa e fixa (sem postura), como funções puras que produzem a MESMA forma que a linha do Opus (`{veredito, budget_sugerido_centavos, justificativa}` / `{veredito, justificativa}`). No render, a fonte vira `Opus || regra` — o resto (faixa, pílula, botões) fica igual. Remover a data do banner. Nada muda no robô/tabelas.

**Tech Stack:** `index.html` monólito (JS inline). Reaproveita `_getActions`, `_maFmt`/`_maFmtR`/`_maFmtPct`, `_gtEsc`, `_gtRecBanner`, `_gtWireBudgetControls`, `_renderGtCampaigns`/`_renderGtAds`.

## Global Constraints

- **Branch:** `feat/gt-analise-hibrida` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Só client-side.** Nada muda no robô (`coletor/budget-ia.mjs`), nas tabelas (`gt_budget_analises`/`gt_ad_analises`) ou na coleta. As regras são calculadas no render, efêmeras.
- **Regras espelham o Opus:** por objetivo (Tráfego CTR/CPC · Leads custo/lead · Engajamento · Vídeo · Reconhecimento); **performance ruim nunca escala**; escalar só com eficiência + volume (piso de gasto/impressões). Limiares = preset "equilibrada" do motor antigo.
- **4 vereditos (iguais ao Opus):** `escalar` (budget ×1,25) · `reduzir` (×0,75) · `manter` · `pausar`. Anúncio: `manter`/`pausar`.
- **Regra só roda pra ATIVOS sem Opus.** Pausada/concluída/arquivada → banner neutro (não roda regra, não inventa "reativar").
- **Iguais, sem data:** Opus e regra aparecem idênticos (selo "✦ IA", SEM data). Remover a data do banner.
- **Sem harness de teste de DOM** (padrão do monólito): gate = extrair inline scripts + `node --check` + greps; validação visual DEFERIDA ao Breno. NÃO `git push`.

---

### Task 1: Motor de regras (funções puras client-side)

**Files:** Modify `index.html`: adicionar as funções logo ANTES de `function _gtRecBanner(` (~L8142).

**Interfaces:**
- Consumes (já existem): `_getActions(ins,type)`, `_maFmtPct`, `_maFmtR`, `_maFmt`, `_gtEsc`.
- Produces: `_gtObjCategory(obj)`, `GT_CRIT` (const), `_gtVerdict(m)`, `_gtRegraCampanha(camp,ins,allInsights)→{veredito,budget_sugerido_centavos,justificativa}`, `_gtRegraAnuncio(ad)→{veredito,justificativa}`.

- [ ] **Step 1: Adicionar as 5 funções**

Imediatamente antes de `function _gtRecBanner(iaRow,daily,encerrada,status){`, acrescente:

```javascript
// ── Motor de regras client-side (fallback quando não há análise do Opus) ──
// Espelha os critérios do prompt do Opus. Limiares fixos = preset "equilibrada" (sem postura).
function _gtObjCategory(obj){
  const o=(obj||'').toUpperCase();
  if(o.includes('LEAD'))return'lead';
  if(o.includes('CONVERSION')||o.includes('SALE'))return'conversion';
  if(o.includes('ENGAGEMENT')||o==='POST_ENGAGEMENT'||o==='PAGE_LIKES')return'engagement';
  if(o.includes('VIDEO')||o==='VIDEO_VIEWS')return'video';
  if(o.includes('AWARENESS')||o==='BRAND_AWARENESS'||o==='REACH')return'awareness';
  if(o.includes('TRAFFIC')||o==='LINK_CLICKS')return'traffic';
  return'other';
}
const GT_CRIT={
  minSpend:20,minImpr:1000, freqSat:4,freqAtt:3.5,
  lead:{pausSpend:80,pausImpr:4000,escCTR:2.0,escCPLf:0.85,monCTR:1.5,monSpend:50},
  traffic:{pausCTR:0.5,pausSpend:40,pausImpr:2000,escCTR:2.0,escCPC:2.0,monCTR:1.0,monSpend:40},
  engagement:{pausSpend:60,pausEng:10,pausImpr:2000,escEng:100,escCTR:1.0,monCTR:0.5,monSpend:30},
  video:{monSpend:50,monViews:100,escViews:500,escCTR:0.8},
};
function _gtVerdict(m){
  const C=GT_CRIT,P=_maFmtPct,R=_maFmtR,N=_maFmt;
  if(m.spend<C.minSpend||m.impr<C.minImpr)
    return{kind:'coletando',text:`Volume baixo (${R(m.spend)} · ${N(m.impr)} impressões) — sem recomendação confiável ainda.`};
  if(m.freq>=C.freqSat)
    return{kind:'reduzir',text:`Frequência ${N(m.freq,1)}× — o mesmo público já viu demais. Vale reduzir o orçamento.`};
  if(m.freq>=C.freqAtt)
    return{kind:'monitorar',text:`Frequência ${N(m.freq,1)}× — começando a saturar o público, monitorar.`};
  if(m.cat==='lead'||m.cat==='conversion'){
    const c=C.lead;
    if(m.leads===0&&m.spend>=c.pausSpend&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`${R(m.spend)} gastos e 0 conversões. Pausar e revisar oferta/segmentação.`};
    if(m.leads>0&&m.ctr>=c.escCTR&&(!m.avgCPL||m.cpl<=m.avgCPL*c.escCPLf))
      return{kind:'escalar',text:`${N(m.leads)} leads · CPL ${R(m.cpl)} (abaixo da média) · CTR ${P(m.ctr)}. Forte — vale escalar.`};
    if(m.leads===0&&m.ctr>=c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} bom, mas 0 conversões — provável gargalo na landing/oferta.`};
    if(m.leads>0)
      return{kind:'saudavel',text:`${N(m.leads)} leads · CPL ${R(m.cpl)} · CTR ${P(m.ctr)}.`};
    return{kind:'monitorar',text:`CTR ${P(m.ctr)} · ${R(m.spend)} — ainda sem conversão, mas dentro da margem.`};
  }
  if(m.cat==='traffic'){
    const c=C.traffic;
    if(m.ctr<c.pausCTR&&m.spend>=c.pausSpend&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`CTR ${P(m.ctr)} muito baixo com ${R(m.spend)} gastos — clique caro, desperdício.`};
    if(m.ctr>=c.escCTR&&m.cpc>0&&m.cpc<=c.escCPC)
      return{kind:'escalar',text:`CTR ${P(m.ctr)} · CPC ${R(m.cpc)} — clique barato e eficiente. Vale escalar.`};
    if(m.ctr<c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} fraco para tráfego — testar criativo ou segmentação.`};
    return{kind:'saudavel',text:`${N(m.clicks)} cliques · CTR ${P(m.ctr)} · CPC ${R(m.cpc)}.`};
  }
  if(m.cat==='engagement'){
    const c=C.engagement;
    if(m.spend>=c.pausSpend&&m.eng<c.pausEng&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`${R(m.spend)} gastos e só ${N(m.eng)} engajamentos — o criativo não está conectando.`};
    if(m.eng>=c.escEng&&m.ctr>=c.escCTR)
      return{kind:'escalar',text:`${N(m.eng)} engajamentos · CTR ${P(m.ctr)} — boa tração. Considere escalar.`};
    if(m.ctr<c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} baixo para engajamento — o criativo pode não estar conectando.`};
    return{kind:'saudavel',text:`${N(m.eng)} engajamentos · CTR ${P(m.ctr)} · ${R(m.spend)}.`};
  }
  if(m.cat==='video'){
    const c=C.video;
    if(m.spend>=c.monSpend&&m.views<c.monViews)
      return{kind:'monitorar',text:`Poucos plays (${N(m.views)}) com ${R(m.spend)} gastos — o hook do vídeo pode estar fraco.`};
    if(m.views>=c.escViews&&m.ctr>=c.escCTR)
      return{kind:'escalar',text:`${N(m.views)} plays · CTR ${P(m.ctr)} — boa tração para o vídeo.`};
    return{kind:'saudavel',text:`${N(m.views)} plays · CTR ${P(m.ctr)} · ${R(m.spend)}.`};
  }
  if(m.cat==='awareness')
    return{kind:'saudavel',text:`${N(m.reach)} alcance · Frequência ${N(m.freq,1)}× · ${R(m.spend)}.`};
  return{kind:'saudavel',text:`CTR ${P(m.ctr)} · ${R(m.spend)} gastos.`};
}
// Recomendação de CAMPANHA por regra — mesma forma da linha do Opus.
function _gtRegraCampanha(camp,ins,allInsights){
  const daily=camp&&camp.daily_budget?parseFloat(camp.daily_budget)/100:null;
  const m={
    cat:_gtObjCategory(ins.objective||(camp&&camp.objective)||''),
    ctr:parseFloat(ins.ctr||0),spend:parseFloat(ins.spend||0),impr:parseInt(ins.impressions||0),
    freq:parseFloat(ins.frequency||0),clicks:parseInt(ins.clicks||0),cpc:parseFloat(ins.cpc||0),
    leads:_getActions(ins,'lead'),eng:(_getActions(ins,'post_engagement')||_getActions(ins,'page_engagement')),
    views:parseInt((ins.video_play_actions&&ins.video_play_actions[0]&&ins.video_play_actions[0].value)||0),
    reach:parseInt(ins.reach||0),daily,
  };
  m.cpl=m.leads>0?m.spend/m.leads:null;
  const arr=allInsights||[];
  const totS=arr.reduce((s,i)=>s+parseFloat(i.spend||0),0),totL=arr.reduce((s,i)=>s+_getActions(i,'lead'),0);
  m.avgCPL=totL>0?totS/totL:null;
  const v=_gtVerdict(m);
  const veredito=v.kind==='escalar'?'escalar':v.kind==='reduzir'?'reduzir':v.kind==='pausar'?'pausar':'manter';
  let bud=null;
  if(daily!=null){const f=veredito==='escalar'?1.25:veredito==='reduzir'?0.75:1;bud=Math.round(daily*f*100);}
  return { veredito, budget_sugerido_centavos: bud, justificativa: v.text };
}
// Recomendação de ANÚNCIO por regra — manter/pausar (mesma forma da linha do Opus por anúncio).
function _gtRegraAnuncio(ad){
  const ctr=parseFloat(ad.ctr||0),spend=parseFloat(ad.spend||0),impr=parseInt(ad.impressions||0),freq=parseFloat(ad.frequency||0);
  if(freq>=4)return{veredito:'pausar',justificativa:`Frequência ${_maFmt(freq,1)}× — criativo com fadiga.`};
  if(ctr<0.3&&spend>15&&impr>1000)return{veredito:'pausar',justificativa:`CTR crítico ${_maFmtPct(ctr)} com ${_maFmtR(spend)} gastos — desperdiçando budget.`};
  if(ctr<0.5&&spend>30)return{veredito:'pausar',justificativa:`CTR ${_maFmtPct(ctr)} baixo — substituir ou pausar o criativo.`};
  return{veredito:'manter',justificativa:`CTR ${_maFmtPct(ctr)} · ${_maFmtR(spend)}.`};
}
```

- [ ] **Step 2: Verificar**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=[...h.matchAll(/<script>/g)],e=[...h.matchAll(/<\/script>/g)];let ok=0;for(let i=0;i<m.length;i++){const s=h.slice(m[i].index+8,(e[i]||{}).index);try{new Function(s);ok++;}catch(err){console.log('ERR',i,err.message.slice(0,70));}}console.log('scripts ok:',ok+'/'+m.length);"
```
Run: `grep -c "_gtRegraCampanha\|_gtRegraAnuncio\|function _gtVerdict\|function _gtObjCategory" index.html` → ≥ 4.
Expected: inline scripts todos OK. (Ainda não muda comportamento — só define as funções; a Task 2 liga.)

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat(gt-hibrido): motor de regras client-side (espelha o Opus) — _gtObjCategory/GT_CRIT/_gtVerdict/_gtRegraCampanha/_gtRegraAnuncio"
```

---

### Task 2: Integrar (fonte = Opus || regra) + remover a data

**Files:** Modify `index.html`: `_renderGtCampaigns` (linha `const iaRow=_gtBudgetIA[...]`), `_renderGtAds` (linha `const iaRow=_gtAdIA[...]`), e `_gtRecBanner` (remover a data em 2 lugares).

**Interfaces:** Consumes `_gtRegraCampanha`/`_gtRegraAnuncio` (Task 1). Produces: recomendação sempre presente pra ativos; banner sem data.

- [ ] **Step 1: Campanha — fonte Opus || regra**

Troque (em `_renderGtCampaigns`):
```javascript
      const iaRow=_gtBudgetIA[ins.campaign_id];
```
por:
```javascript
      const iaRow=_gtBudgetIA[ins.campaign_id] || ((!encerrada&&status==='ACTIVE')?_gtRegraCampanha(camp,ins,insights):null);
```
(`camp`, `ins`, `status`, `encerrada` e `insights` — o array completo — já estão no escopo do `forEach`.)

- [ ] **Step 2: Anúncio — fonte Opus || regra**

Troque (em `_renderGtAds`):
```javascript
    const iaRow=_gtAdIA[ad.ad_id];
```
por:
```javascript
    const iaRow=_gtAdIA[ad.ad_id] || ((ad.effective_status==='ACTIVE')?_gtRegraAnuncio(ad):null);
```

- [ ] **Step 3: Remover a data do banner (2 lugares)**

Em `_gtRecBanner`, troque as DUAS ocorrências de `✦ IA · ${_gtEsc(quando)}` por `✦ IA`:
- linha do estado neutro: `<span class="gt-rec-tag">✦ IA · ${_gtEsc(quando)}</span>` → `<span class="gt-rec-tag">✦ IA</span>`
- linha do estado ativo: `<span class="gt-rec-tag">✦ IA · ${_gtEsc(quando)}</span>` → `<span class="gt-rec-tag">✦ IA</span>`

(Use `replace_all` com o texto exato `<span class="gt-rec-tag">✦ IA · ${_gtEsc(quando)}</span>` → `<span class="gt-rec-tag">✦ IA</span>` — são exatamente 2 ocorrências, ambas no `_gtRecBanner`.)

- [ ] **Step 4: Verificar**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=[...h.matchAll(/<script>/g)],e=[...h.matchAll(/<\/script>/g)];let ok=0;for(let i=0;i<m.length;i++){const s=h.slice(m[i].index+8,(e[i]||{}).index);try{new Function(s);ok++;}catch(err){console.log('ERR',i);}}console.log('scripts ok:',ok+'/'+m.length);"
```
Run: `grep -c "✦ IA · " index.html` → **0** (data removida do banner).
Run: `grep -c "_gtBudgetIA\[ins.campaign_id\] || \|_gtAdIA\[ad.ad_id\] || " index.html` → 2.
Expected: inline scripts OK; sem "✦ IA · ". **Teste do Breno no preview:** uma campanha ATIVA nova/sem Opus deve mostrar recomendação (não "análise em breve"); anúncio ativo sem Opus mostra pílula manter/pausar; nenhum banner mostra data; Aplicar/manual/pausar funcionam; campanha pausada/concluída segue neutra. NÃO `git push`.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat(gt-hibrido): render usa Opus||regra ao vivo (some 'análise em breve' p/ ativos) + remove a data do banner"
```

---

## Notas de execução

- **Ordem:** T1 (funções) → T2 (liga + data). T1 sozinha não muda nada visível.
- **Validação do Breno:** melhor testar numa campanha ATIVA **sem** análise do Opus (recém-criada). Obs.: eu disparei o robô do Opus hoje — se ele já pegou a campanha 15, ela mostrará a do Opus; pra ver a regra ao vivo, use qualquer campanha ativa que ainda não entrou numa rodada.
- **Conceito:** o motor NÃO dá "escalar" com CTR ruim (exige CTR/eficiência altos + volume) — o bug do v2 era do Opus, não das regras.
- **Fora de escopo:** robô/tabelas/coleta; marcar "ao vivo" separado (Breno quis iguais); persistir a regra no banco (é efêmera).
