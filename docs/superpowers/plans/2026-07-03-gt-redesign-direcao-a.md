# Redesign Gestão de Tráfego — Direção A — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o cartão da Gestão de Tráfego (direção A): a recomendação da IA vira a estrela (faixa colorida no topo), campanha e anúncio ficam visualmente distintos, a edição manual de orçamento fica sempre disponível, e cada anúncio ganha um botão "Ver criativo" (preview renderizado da Meta).

**Architecture:** Só reestruturação de markup/CSS em `index.html`, reaproveitando os dados já carregados (`_gtBudgetIA[campaign_id]`, `_gtAdIA[ad_id]`) e a ação `_gtApplyAction`. Novos helpers de HTML (`_gtRecBanner`, `_gtBudgetEditHtml`), `_gtWireBudgetControls` estendido, e `_renderGtCampaigns`/`_renderGtAds` remontados. Nada de robô, tabela, coleta ou permissão muda.

**Tech Stack:** `index.html` monólito (JS inline, vanilla), CSS com variáveis de tema + `color-mix` para tons semânticos que respeitam claro/escuro.

## Global Constraints

- **Branch:** `feat/gt-redesign-a` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Cores só as semânticas do app:** `--green` (escalar/manter/manter-anúncio), `--orange` (reduzir), `--red` (pausar), `--muted`/`--border` (neutro). NÃO inventar cores; NÃO reintroduzir accent por perfil. Fundos suaves via `color-mix(in srgb, var(--cor) N%, transparent)` (respeita claro/escuro).
- **Fontes:** números em `'Oswald'`, texto em `'IBM Plex Sans'` (como o resto do app).
- **Reaproveitar, não recriar:** ação de aplicar budget/pausar via `_gtApplyAction({type:'update_budget'|'pause_campaign'|...})`; status via `_gtEncerrada`+effective_status; KPIs via `_gtKpisHtml`; pausar/reativar manual via `_gtManualToggleBtn`. Escapar texto do banco com `_gtEsc` (front é público).
- **Veredito → cor:** `escalar`→verde, `manter`→verde, `reduzir`→laranja, `pausar`→vermelho. Sem análise/pausada/concluída → neutro (cinza), NUNCA sugere escalar.
- **Edição manual de orçamento é INDEPENDENTE da IA:** controle `Orçamento: R$X/dia · ✎ editar` sempre visível quando a campanha tem orçamento diário e não está concluída — mesmo com veredito "manter"/"pausar" ou sem análise.
- **Sem harness de teste de DOM no monólito** (padrão do projeto): o gate automático é extrair os inline `<script>` e `node --check` + greps de presença/ausência; a **validação visual é DEFERIDA ao Breno** (preview). O implementer NÃO dá `git push`.
- **Escopo:** só a Gestão de Tráfego. A seção "02 · Meta Ads" do dash social é outro passo.

---

### Task 1: CSS do novo cartão (faixa, edição de orçamento, pílula de anúncio)

**Files:** Modify `index.html` (bloco CSS da GT, ~L2369-2404).

**Interfaces:**
- Produces (classes CSS novas, consumidas nas Tasks 2 e 3): `.gt-rec-banner` (+ `.positivo`/`.reduzir`/`.pausar`/`.neutral`), `.gt-rec-main`, `.gt-rec-head`, `.gt-rec-verdict`, `.gt-rec-tag`, `.gt-rec-just`, `.gt-rec-impact`, `.gt-rec-action`, `.gt-rec-from`, `.gt-rec-arrow`, `.gt-rec-to`, `.gt-rec-keep`, `.gt-budget-edit`, `.gt-be-cur`, `.gt-be-link`, `.gt-be-box`, `.gt-ad-pill` (+ `.manter`/`.pausar`), `.gt-ad-name`, `.gt-ad-nm`, `.gt-ad-sub`, `.gt-ad-why`.
- Remove: CSS morto `.gt-insight*` e `.gt-criteria*` (o motor de regras que os usava saiu no v2).

- [ ] **Step 1: Confirmar que `.gt-insight`/`.gt-criteria` estão mortos**

Run: `grep -n "gt-insight\|gt-criteria" index.html`
Expected: só aparições em **CSS** (~L2393-2404). Se aparecer em JS (fora de CSS), NÃO remover e reportar. (Esperado: só CSS — o motor saiu no v2.)

- [ ] **Step 2: Remover o CSS morto do motor de regras**

Apague as linhas de `.gt-insight{...}` até `.gt-insight.ok .gt-insight-text{...}` inclusive `.gt-criteria`/`.gt-criteria b` (o bloco ~L2393-2404). Deixe intactas as classes acima (`.gt-spend`) e abaixo (`.gt-action-row`).

- [ ] **Step 3: Adicionar as classes novas**

Logo após a regra `.gt-act-btn:disabled{...}` (fim do bloco de botões, ~L2415), acrescente:

```css
  /* ===== Redesign direção A ===== */
  /* Faixa de recomendação (estrela do cartão) */
  .gt-rec-banner{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:11px 14px;margin:2px 0 10px;border-radius:10px;border-left:5px solid var(--border);background:var(--surface2);}
  .gt-rec-banner.positivo{border-left-color:var(--green);background:color-mix(in srgb,var(--green) 9%,transparent);}
  .gt-rec-banner.reduzir{border-left-color:var(--orange);background:color-mix(in srgb,var(--orange) 9%,transparent);}
  .gt-rec-banner.pausar{border-left-color:var(--red);background:color-mix(in srgb,var(--red) 9%,transparent);}
  .gt-rec-banner.neutral{border-left-color:var(--border);background:var(--surface2);}
  .gt-rec-main{flex:1;min-width:200px;}
  .gt-rec-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .gt-rec-verdict{font-family:'Oswald',sans-serif;font-weight:600;font-size:17px;text-transform:uppercase;letter-spacing:.02em;line-height:1;}
  .gt-rec-banner.positivo .gt-rec-verdict{color:var(--green);}
  .gt-rec-banner.reduzir .gt-rec-verdict{color:var(--orange);}
  .gt-rec-banner.pausar .gt-rec-verdict{color:var(--red);}
  .gt-rec-banner.neutral .gt-rec-verdict{color:var(--muted);font-size:14px;}
  .gt-rec-tag{font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);}
  .gt-rec-just{font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--text);margin-top:3px;line-height:1.4;}
  .gt-rec-banner.neutral .gt-rec-just{color:var(--muted);}
  .gt-rec-impact{font-family:'IBM Plex Sans',sans-serif;font-size:10px;color:var(--muted);margin-top:2px;}
  .gt-rec-action{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;}
  .gt-rec-from{font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);text-decoration:line-through;}
  .gt-rec-arrow{color:var(--muted);}
  .gt-rec-to{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;color:var(--green);line-height:1;}
  .gt-rec-to small{font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:500;color:var(--muted);}
  .gt-rec-banner.reduzir .gt-rec-to{color:var(--orange);}
  .gt-rec-keep{font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;color:var(--green);}
  /* Edição manual de orçamento (sempre disponível) */
  .gt-budget-edit{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);}
  .gt-be-cur b{color:var(--text);font-weight:700;}
  .gt-be-link{background:none;border:none;color:var(--accent);font-size:11px;font-weight:600;cursor:pointer;padding:2px 4px;}
  .gt-be-link:hover{text-decoration:underline;}
  .gt-be-box{display:inline-flex;align-items:center;gap:6px;}
  .gt-be-box[hidden]{display:none;}
  .gt-be-box input{width:82px;padding:5px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:11px;}
  /* Pílula de veredito do anúncio + nome/porquê */
  .gt-ad-pill{font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:3px 9px;border-radius:999px;flex-shrink:0;}
  .gt-ad-pill.manter{background:color-mix(in srgb,var(--green) 14%,transparent);color:var(--green);}
  .gt-ad-pill.pausar{background:color-mix(in srgb,var(--red) 14%,transparent);color:var(--red);}
  .gt-ad-name{flex:1;min-width:0;}
  .gt-ad-nm{font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .gt-ad-sub{font-family:'IBM Plex Sans',sans-serif;font-size:10px;color:var(--muted);}
  .gt-ad-why{font-family:'IBM Plex Sans',sans-serif;font-size:10.5px;color:var(--muted);line-height:1.4;padding-left:2px;}
```

- [ ] **Step 4: Verificar**

Run: `grep -c "gt-rec-banner\|gt-ad-pill\|gt-budget-edit" index.html` → deve ser > 0.
Run: `grep -n "gt-insight\|gt-criteria" index.html` → **vazio** (CSS morto removido).
Visual DEFERIDO ao usuário.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat(gt-redesign): CSS da direção A (faixa de recomendação, edição de orçamento, pílula de anúncio) + remove CSS morto do motor"
```

---

### Task 2: Cartão de campanha — faixa de recomendação + edição de orçamento sempre disponível

**Files:** Modify `index.html`: reescrever `_gtIABlocoHtml`→`_gtRecBanner` (~L8051-8072), adicionar `_gtBudgetEditHtml`, atualizar `_gtWireBudgetControls` (~L8083-8103), remontar o loop de `_renderGtCampaigns` (~L8181-8207 — a parte que monta/anexa iaBloco/actBar).

**Interfaces:**
- Consumes: classes CSS da Task 1; `_gtBudgetIA[campaign_id]` (row: `veredito`,`budget_sugerido_centavos`,`justificativa`,`impacto_estimado`,`gerado_em`,`budget_atual_centavos`); `_maFmtR`, `_gtEsc`, `_gtEncerrada`, `_gtApplyAction`, `_gtManualToggleBtn`, `_gtKpisHtml`.
- Produces: `_gtRecBanner(iaRow,daily,encerrada,status)→string`, `_gtBudgetEditHtml(daily)→string`, `_gtWireBudgetControls(el,ins,camp,iaRow)` (estendido: aplicar-sugerido + pausar + editar-manual).

- [ ] **Step 1: Substituir `_gtIABlocoHtml` por `_gtRecBanner`**

Troque a função inteira `_gtIABlocoHtml(row){...}` (~L8051-8072) por:

```javascript
// Faixa de recomendação da IA (estrela do cartão). Trata todos os estados.
function _gtRecBanner(iaRow,daily,encerrada,status){
  const dfmt=daily!=null?_maFmtR(daily):null;
  if(!iaRow){
    return `<div class="gt-rec-banner neutral"><div class="gt-rec-main"><div class="gt-rec-head"><span class="gt-rec-verdict">Análise em breve</span></div><div class="gt-rec-just">O robô avalia as campanhas toda semana.</div></div></div>`;
  }
  const quando=iaRow.gerado_em?new Date(iaRow.gerado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'';
  const just=_gtEsc(iaRow.justificativa||'');
  const ver=iaRow.veredito||'';
  // Pausada/concluída/arquivada: faixa neutra com a última análise apagada, sem ação.
  if(encerrada||status!=='ACTIVE'){
    return `<div class="gt-rec-banner neutral"><div class="gt-rec-main"><div class="gt-rec-head"><span class="gt-rec-tag">✦ IA · ${_gtEsc(quando)}</span></div><div class="gt-rec-just">${just}</div></div></div>`;
  }
  const varClass=ver==='pausar'?'pausar':ver==='reduzir'?'reduzir':'positivo';
  const sug=iaRow.budget_sugerido_centavos!=null?_maFmtR(iaRow.budget_sugerido_centavos/100):null;
  let action='';
  if(ver==='escalar'||ver==='reduzir'){
    const fromTo=(dfmt&&sug)?`<span class="gt-rec-from">${dfmt}/dia</span><span class="gt-rec-arrow">→</span><span class="gt-rec-to">${sug}<small>/dia</small></span>`:'';
    action=`<div class="gt-rec-action">${fromTo}${sug?`<button data-gt-aplicar="1" class="gt-act-btn primary">Aplicar ${sug}/dia</button>`:''}</div>`;
  }else if(ver==='manter'){
    action=`<div class="gt-rec-action"><span class="gt-rec-keep">Manter ${dfmt?dfmt+'/dia':'orçamento atual'}</span></div>`;
  }else if(ver==='pausar'){
    action=`<div class="gt-rec-action"><button data-gt-pausar="1" class="gt-act-btn danger">⏸ Pausar campanha</button></div>`;
  }
  return `<div class="gt-rec-banner ${varClass}">
    <div class="gt-rec-main">
      <div class="gt-rec-head"><span class="gt-rec-verdict">${_gtEsc(ver)}</span><span class="gt-rec-tag">✦ IA · ${_gtEsc(quando)}</span></div>
      <div class="gt-rec-just">${just}</div>
      ${iaRow.impacto_estimado?`<div class="gt-rec-impact"><b>Impacto:</b> ${_gtEsc(iaRow.impacto_estimado)}</div>`:''}
    </div>
    ${action}
  </div>`;
}

// Controle de edição manual de orçamento — sempre disponível (independe da IA).
function _gtBudgetEditHtml(daily){
  if(daily==null)return '';
  return `<div class="gt-budget-edit">
    <span class="gt-be-cur">Orçamento: <b>${_maFmtR(daily)}/dia</b></span>
    <button data-gt-edit-toggle="1" class="gt-be-link">✎ editar</button>
    <span data-gt-edit-box="1" class="gt-be-box" hidden>
      <input data-gt-manual="1" type="number" min="1" step="1" placeholder="R$/dia">
      <button data-gt-manual-ok="1" class="gt-act-btn primary" style="font-size:10px;">Aplicar</button>
    </span>
  </div>`;
}
```

- [ ] **Step 2: Estender `_gtWireBudgetControls`**

Troque a função inteira `_gtWireBudgetControls(el,ins,camp,iaRow){...}` (~L8083-8103) por:

```javascript
function _gtWireBudgetControls(el,ins,camp,iaRow){
  if(!el)return;
  const nm=_gtEsc(ins.campaign_name||camp?.name||'a campanha');
  const daily=camp?.daily_budget?parseFloat(camp.daily_budget)/100:null;
  const bAplicar=el.querySelector('[data-gt-aplicar]');
  if(bAplicar&&iaRow&&iaRow.budget_sugerido_centavos!=null){
    bAplicar.addEventListener('click',ev=>{ev.stopPropagation();
      const novo=iaRow.budget_sugerido_centavos;
      _gtApplyAction({type:'update_budget',id:ins.campaign_id,budget:novo,_t:'Aplicar budget sugerido?',_d:`"${nm}": ${daily!=null?_maFmtR(daily)+'/dia':'orçamento atual'} → ${_maFmtR(novo/100)}/dia (sugestão da IA).`},bAplicar,el);
    });
  }
  const bPausar=el.querySelector('[data-gt-pausar]');
  if(bPausar){
    bPausar.addEventListener('click',ev=>{ev.stopPropagation();
      _gtApplyAction({type:'pause_campaign',id:ins.campaign_id,_t:'Pausar campanha?',_d:`"${nm}" será PAUSADA na Meta agora.`},bPausar,el);
    });
  }
  const tgl=el.querySelector('[data-gt-edit-toggle]'),box=el.querySelector('[data-gt-edit-box]');
  if(tgl&&box)tgl.addEventListener('click',ev=>{ev.stopPropagation();box.hidden=!box.hidden;if(!box.hidden){const i=box.querySelector('[data-gt-manual]');if(i)i.focus();}});
  const inp=el.querySelector('[data-gt-manual]'),bMan=el.querySelector('[data-gt-manual-ok]');
  if(bMan&&inp)bMan.addEventListener('click',ev=>{ev.stopPropagation();
    const v=parseFloat(inp.value);
    if(!Number.isFinite(v)||v<=0){inp.style.borderColor='var(--red)';return;}
    inp.style.borderColor='';
    const cent=Math.round(v*100);
    _gtApplyAction({type:'update_budget',id:ins.campaign_id,budget:cent,_t:'Aplicar budget manual?',_d:`"${nm}": ${daily!=null?_maFmtR(daily)+'/dia':'orçamento atual'} → ${_maFmtR(v)}/dia.`},bMan,el);
  });
}
```

- [ ] **Step 3: Remontar a montagem do cartão em `_renderGtCampaigns`**

No loop `filtered.forEach`, o trecho atual monta assim (a partir de `let actBar=null;` até antes de `// Ads pane`):

```javascript
      let actBar=null;
      if(!encerrada){
        const tgl=_gtManualToggleBtn('campaign',ins.campaign_id,status,ins.campaign_name||camp?.name);
        if(tgl){ if(!actBar){actBar=document.createElement('div');actBar.className='gt-action-row';} actBar.appendChild(tgl); }
      }
      const iaRow=_gtBudgetIA[ins.campaign_id];
      const iaBloco=document.createElement('div');
      iaBloco.innerHTML=_gtIABlocoHtml(iaRow);
      inner.appendChild(top);
      if(iaRow&&!encerrada){
        const iaEl=iaBloco.firstElementChild;
        inner.appendChild(iaEl);
        _gtWireBudgetControls(iaEl,ins,camp,iaRow);
      }
      if(!encerrada&&actBar)inner.appendChild(actBar);
```

Troque esse trecho inteiro por:

```javascript
      const iaRow=_gtBudgetIA[ins.campaign_id];
      // 1) Faixa de recomendação (estrela) — no TOPO, antes do cabeçalho.
      const bannerWrap=document.createElement('div');
      bannerWrap.innerHTML=_gtRecBanner(iaRow,daily,encerrada,status);
      if(bannerWrap.firstElementChild)inner.appendChild(bannerWrap.firstElementChild);
      // 2) Cabeçalho de apoio (clicável p/ expandir anúncios).
      inner.appendChild(top);
      // 3) Edição manual de orçamento — sempre disponível (independe da IA), se houver orçamento diário e não estiver concluída.
      if(daily!=null&&!encerrada){
        const beWrap=document.createElement('div');
        beWrap.innerHTML=_gtBudgetEditHtml(daily);
        if(beWrap.firstElementChild)inner.appendChild(beWrap.firstElementChild);
      }
      // 4) Rodapé: pausar/reativar manual. Pula o "Pausar" se a faixa já mostra Pausar (evita botão duplicado).
      const bannerHasPause=!!iaRow&&iaRow.veredito==='pausar'&&!encerrada&&status==='ACTIVE';
      if(!encerrada&&!bannerHasPause){
        const tgl=_gtManualToggleBtn('campaign',ins.campaign_id,status,ins.campaign_name||camp?.name);
        if(tgl){const actBar=document.createElement('div');actBar.className='gt-action-row';actBar.appendChild(tgl);inner.appendChild(actBar);}
      }
      // 5) Liga os controles (aplicar sugerido, pausar da faixa, editar manual).
      _gtWireBudgetControls(inner,ins,camp,iaRow);
```

(O resto do loop — `// Ads pane`, `adsPane`, o auto-desdobramento e `list.appendChild(row)` — fica intacto.)

- [ ] **Step 4: Verificar sintaxe + âncoras**

Run (extrai inline scripts e checa):
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_gtr'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_gtr*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "_gtRecBanner\|_gtBudgetEditHtml" index.html` → ≥ 3 (2 defs + usos).
Run: `grep -n "_gtIABlocoHtml" index.html` → **vazio** (renomeada; nenhuma chamada órfã).
Expected: todos os inline scripts `OK`; sem `_gtIABlocoHtml` restante. Visual DEFERIDO ao usuário. NÃO dar `git push`.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat(gt-redesign): cartão de campanha — faixa de recomendação no topo + edição de orçamento sempre disponível"
```

---

### Task 3: Cartões de anúncio — pílula de veredito, recuado e distinto

**Files:** Modify `index.html`: remontar `_renderGtAds` (~L8227-8257) e remover `_gtAdIABlocoHtml` (~L8074-8082, fica sem uso).

**Interfaces:**
- Consumes: classes CSS da Task 1 (`gt-ad-pill`/`gt-ad-name`/`gt-ad-nm`/`gt-ad-sub`/`gt-ad-why`); `_gtAdIA[ad_id]` (row: `veredito` manter/pausar, `justificativa`, `gerado_em`); `_maFmtPct`, `_maFmtR`, `_gtEsc`, `_gtManualToggleBtn`.
- Produces: `_renderGtAds` remontado (anúncio como "filho" recuado, pílula manter/pausar em destaque).

- [ ] **Step 1: Remontar `_renderGtAds`**

Troque a função inteira `_renderGtAds(pane,ads,allInsights,allAdInsights){...}` (~L8227-8257) por:

```javascript
function _renderGtAds(pane,ads,allInsights,allAdInsights){
  const lbl=document.createElement('div');lbl.className='gt-ads-section-lbl';lbl.textContent=`Anúncios (${ads.length})`;pane.appendChild(lbl);
  if(!ads.length){const empty=document.createElement('div');empty.style.cssText='font-family:\'IBM Plex Sans\',sans-serif;font-size:11px;color:var(--muted);padding:6px 0 6px 20px;';empty.textContent='Nenhum anúncio com gasto neste período';pane.appendChild(empty);return;}
  const sorted=[...ads].sort((a,b)=>parseFloat(b.spend||0)-parseFloat(a.spend||0));
  sorted.forEach(ad=>{
    const ctr=parseFloat(ad.ctr||0);
    const spend=parseFloat(ad.spend||0);
    const adStatus=ad.effective_status||'';
    const ctrColor=ctr>=2?'var(--green)':ctr<0.8?'var(--red)':'var(--orange)';
    const iaRow=_gtAdIA[ad.ad_id];
    const card=document.createElement('div');card.className='gt-ad-card';
    const top=document.createElement('div');top.className='gt-ad-top';
    // Selo: pílula do veredito da IA; se não houver análise, cai pro badge de status.
    const seal=document.createElement('div');
    if(iaRow){
      seal.className='gt-ad-pill '+(iaRow.veredito==='pausar'?'pausar':'manter');
      seal.textContent=iaRow.veredito==='pausar'?'Pausar':'Manter';
    }else{
      const cls=adStatus==='ACTIVE'?'active':adStatus==='PAUSED'?'paused':'inactive';
      const lb=adStatus==='ACTIVE'?'Ativo':adStatus==='PAUSED'?'Pausado':adStatus==='ARCHIVED'?'Arquivado':'Inativo';
      seal.className='gt-status-badge '+cls;seal.textContent=lb;
    }
    const nameWrap=document.createElement('div');nameWrap.className='gt-ad-name';
    nameWrap.innerHTML=`<div class="gt-ad-nm">${_gtEsc(ad.ad_name||ad.adset_name||'—')}</div>${ad.adset_name&&ad.ad_name?`<div class="gt-ad-sub">${_gtEsc(ad.adset_name)}</div>`:''}`;
    const metrics=document.createElement('div');metrics.className='gt-metrics';
    metrics.innerHTML=`<div class="gt-metric">CTR <span style="color:${ctrColor}">${_maFmtPct(ctr)}</span></div><div class="gt-metric" style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;"><span>${_maFmtR(spend)}</span></div>`;
    top.appendChild(seal);top.appendChild(nameWrap);top.appendChild(metrics);
    card.appendChild(top);
    // Porquê da IA (apoio).
    if(iaRow&&iaRow.justificativa){const why=document.createElement('div');why.className='gt-ad-why';why.textContent=iaRow.justificativa;card.appendChild(why);}
    // Pausar/reativar manual.
    const adTgl=_gtManualToggleBtn('ad',ad.ad_id,adStatus,ad.ad_name||ad.adset_name);
    if(adTgl){const actBar=document.createElement('div');actBar.className='gt-action-row';actBar.appendChild(adTgl);card.appendChild(actBar);}
    pane.appendChild(card);
  });
}
```

- [ ] **Step 2: Remover `_gtAdIABlocoHtml` (agora sem uso)**

Apague a função inteira `_gtAdIABlocoHtml(row){...}` (~L8074-8082). Confirme antes:
Run: `grep -n "_gtAdIABlocoHtml" index.html` → deve aparecer só na **definição** (nenhuma chamada, pois a Task 3 Step 1 removeu o uso). Se houver chamada em outro lugar, NÃO apague e reporte.

- [ ] **Step 3: Verificar**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_gta'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_gta*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "gt-ad-pill" index.html` → > 0.
Run: `grep -n "_gtAdIABlocoHtml" index.html` → **vazio**.
Expected: inline scripts `OK`; `gt-ad-pill` presente; sem `_gtAdIABlocoHtml`. Visual DEFERIDO ao usuário. NÃO dar `git push`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(gt-redesign): anúncios com pílula de veredito (manter/pausar), recuados e distintos da campanha"
```

---

### Task 4: Botão "Ver criativo" no anúncio → modal com o preview renderizado da Meta

**Files:** Modify `index.html`: CSS do modal (perto do `#gt-cfg-modal`, ~L2438), HTML do modal (após o markup do `#gt-cfg-modal`), JS `_gtVerCriativo`/`_gtCloseCriativo` (perto de `_renderGtAds`), e o botão na action-row do `_renderGtAds` (da Task 3).

**Interfaces:**
- Consumes: `metaFetch(path,params,accountId)` (retorna o JSON cru da Graph — `d.data[0].body` traz o `<iframe>` do preview); `_gtCurAcc` (conta atual da GT, carrier do token no meta-proxy); estilos `gt-cfg-*`/`gt-act-btn`.
- Produces: `_gtVerCriativo(adId,accId,nome)`, `_gtCloseCriativo()`, botão `👁 Ver criativo` em cada anúncio.

> **Validado ao vivo (2026-07-03):** `/{ad_id}/previews` retorna um `<iframe>` válido para estas contas em TODOS os formatos testados (`INSTAGRAM_STANDARD`, `INSTAGRAM_STORY`, `INSTAGRAM_REELS`, `MOBILE_FEED_STANDARD`, `FACEBOOK_STORY_MOBILE`). Padrão = `INSTAGRAM_STANDARD` (look de feed do IG). Como vai por `metaFetch`→meta-proxy (server-side), o token da conta NÃO chega ao cliente — só o iframe (que carrega um token curto e escopado da Meta). O leque de `formats` abaixo é resiliência p/ o caso raro de um formato dar erro (ex.: anúncio arquivado); a ordem já está certa. O fallback de thumbnail (fim da task) cobre anúncio deletado.

- [ ] **Step 1: CSS do modal**

Após a regra `.gt-cfg-footer{...}` (~L2438), acrescente:
```css
  /* Modal "Ver criativo" */
  #gt-cr-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1400;display:none;backdrop-filter:blur(2px);}
  #gt-cr-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1401;background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(420px,94vw);max-height:88vh;display:none;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;}
  .gt-cr-body{padding:14px;overflow:auto;flex:1;display:flex;justify-content:center;align-items:flex-start;}
  .gt-cr-frame{width:100%;display:flex;justify-content:center;}
  .gt-cr-frame iframe{max-width:100%;border:none;border-radius:8px;}
```

- [ ] **Step 2: HTML do modal**

Localize o markup do modal de config: `grep -n 'id="gt-cfg-modal"' index.html`. Logo **após** o fechamento desse bloco `#gt-cfg-modal` (a `</div>` que o encerra), acrescente:
```html
<div id="gt-cr-overlay" onclick="_gtCloseCriativo()"></div>
<div id="gt-cr-modal">
  <div class="gt-cfg-head"><span class="gt-cfg-title">Criativo do anúncio</span><button class="gt-cfg-close" onclick="_gtCloseCriativo()">✕</button></div>
  <div class="gt-cr-body" id="gt-cr-body"></div>
</div>
```

- [ ] **Step 3: JS — abrir/fechar o modal e puxar o preview**

Imediatamente antes da função `_renderGtAds(` (definida na Task 3), acrescente:
```javascript
function _gtCloseCriativo(){const ov=document.getElementById('gt-cr-overlay'),md=document.getElementById('gt-cr-modal'),bd=document.getElementById('gt-cr-body');if(ov)ov.style.display='none';if(md)md.style.display='none';if(bd)bd.innerHTML='';}
async function _gtVerCriativo(adId,accId,nome){
  const ov=document.getElementById('gt-cr-overlay'),md=document.getElementById('gt-cr-modal'),bd=document.getElementById('gt-cr-body');
  if(!ov||!md||!bd)return;
  ov.style.display='block';md.style.display='flex';
  bd.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted);font-family:\'IBM Plex Sans\',sans-serif;font-size:12px;">Carregando o criativo…</div>';
  // Ordem de formatos confirmada na validação ao vivo (mais provável primeiro).
  const formats=['INSTAGRAM_STANDARD','INSTAGRAM_REELS','INSTAGRAM_STORY','MOBILE_FEED_STANDARD','FACEBOOK_STORY_MOBILE'];
  for(const fmt of formats){
    try{
      const r=await metaFetch('/'+adId+'/previews',{ad_format:fmt},accId);
      const body=r&&r.data&&r.data[0]&&r.data[0].body;
      if(body&&/<iframe/i.test(body)){ bd.innerHTML='<div class="gt-cr-frame">'+body+'</div>'; return; }
    }catch(e){}
  }
  bd.innerHTML='<div style="padding:30px 20px;text-align:center;color:var(--muted);font-family:\'IBM Plex Sans\',sans-serif;font-size:12px;line-height:1.6;">Não consegui carregar o preview deste anúncio agora.<br>Pode ser um formato sem preview disponível.</div>';
}
```

- [ ] **Step 4: Botão "Ver criativo" na action-row do anúncio**

No `_renderGtAds` (Task 3), o rodapé do anúncio hoje cria a action-row só com o toggle. Troque aquele trecho:
```javascript
    // Pausar/reativar manual.
    const adTgl=_gtManualToggleBtn('ad',ad.ad_id,adStatus,ad.ad_name||ad.adset_name);
    if(adTgl){const actBar=document.createElement('div');actBar.className='gt-action-row';actBar.appendChild(adTgl);card.appendChild(actBar);}
```
por:
```javascript
    // Ações do anúncio: ver criativo + pausar/reativar manual.
    const actBar=document.createElement('div');actBar.className='gt-action-row';
    const crBtn=document.createElement('button');crBtn.className='gt-act-btn';crBtn.textContent='👁 Ver criativo';
    crBtn.addEventListener('click',e=>{e.stopPropagation();_gtVerCriativo(ad.ad_id,_gtCurAcc&&_gtCurAcc.id,ad.ad_name||ad.adset_name);});
    actBar.appendChild(crBtn);
    const adTgl=_gtManualToggleBtn('ad',ad.ad_id,adStatus,ad.ad_name||ad.adset_name);
    if(adTgl)actBar.appendChild(adTgl);
    card.appendChild(actBar);
```

- [ ] **Step 5: Verificar**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_gtc'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_gtc*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "_gtVerCriativo\|gt-cr-modal" index.html` → > 0.
Expected: inline scripts `OK`. **Teste funcional DEFERIDO ao Breno:** clicar "👁 Ver criativo" num anúncio ativo e ver o criativo renderizado no modal. Se aparecer a mensagem de erro, reportar (aí trocamos o `ad_format` ou caímos no thumbnail). NÃO dar `git push`.

- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "feat(gt-redesign): botão Ver criativo no anúncio (preview renderizado da Meta em modal)"
```

**Fallback (se a validação disser que `/previews` não funciona):** em vez do iframe, puxar `metaFetch('/'+adId,{fields:'creative{thumbnail_url,image_url,object_story_id}'},accId)` e mostrar a imagem (`image_url||thumbnail_url`) no modal; se só houver `object_story_id`, montar link `https://www.facebook.com/{object_story_id}` abrindo em nova aba. Mesma casca de modal.

---

## Notas de execução

- **Ordem:** T1 (CSS) → T2 (campanha) → T3 (anúncio) → T4 (ver criativo). T2/T3 dependem da T1; T4 depende do `_renderGtAds` da T3.
- **Sem push:** o controlador faz merge/push após a revisão final; a validação visual (faixa colorida no topo, edição manual sempre visível, anúncios com pílula, claro/escuro) é do Breno no preview.
- **Verificação de fumaça sugerida ao Breno:** conferir uma campanha de cada veredito (escalar/reduzir/manter/pausar), uma sem análise, uma pausada e uma concluída; testar o `✎ editar` orçamento numa linha de teste (não aplicar em conta real sem querer).
- **Próximo passo (fora deste plano):** seção "02 · Meta Ads" do dash social com a mesma linguagem.
