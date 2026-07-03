# Controle de fonte na Gestão de Tráfego (+30% + toggle) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aumentar as fontes da Gestão de Tráfego em 30% e dar um toggle A−/A+ que muda **só o tamanho da fonte** (cards, ícones e espaçamentos ficam fixos; cards sempre esticados na largura) — corrigindo o bug do toggle do Portal de Notícias (que usava `zoom` e encolhia tudo).

**Architecture:** Uma variável CSS `--gt-fs` (escala de fonte) escopada no `#gestao-trafego-screen`, com padrão **1.3** (o +30%). TODAS as fontes da GT (30 regras CSS + 18 embutidas nos templates JS) passam a ser `calc(px * var(--gt-fs,1.3))` — só a fonte escala, o layout fica em px fixos. O toggle (`_gtFontScale`, adaptado do `_rbvZoom` do Notícias) muda `--gt-fs` no elemento do screen (não `zoom`), persistindo em localStorage. Reusa o CSS `.zoomctl` que já existe.

**Tech Stack:** `index.html` monólito (CSS + JS inline). `.zoomctl` (controle flutuante) já existe.

## Global Constraints

- **Branch:** `feat/gt-controle-fonte` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Só a fonte escala.** Nada de `zoom`/`transform:scale` (era a causa do bug — escalava o layout). O layout (larguras, paddings, alturas, ícones, cards) fica em **px fixos**; só `font-size` usa a escala.
- **Transformação padrão (determinística):** todo `font-size:Npx` da GT vira **`font-size:calc(Npx*var(--gt-fs,1.3))`**. O `,1.3` é o fallback (garante o +30% mesmo em elemento que não herde a variável, e nunca deixa a regra inválida). `10.5px` → `calc(10.5px*var(--gt-fs,1.3))`.
- **Escala:** `--gt-fs` padrão/reset = **1.3**; toggle vai de **0.9 a 2.5**, passo **0.1**; persiste em `localStorage['rbv-gtfs']`. Mostra `Math.round(z*100)+'%'` (padrão = 130%).
- **Sem harness de teste de DOM** (padrão do monólito): gate = extrair inline scripts + `node --check` + greps de presença; **validação visual DEFERIDA ao Breno**. NÃO `git push`.
- **Escopo:** só a Gestão de Tráfego. Não mexer no toggle do Portal de Notícias (fica como está; este é um toggle próprio da GT).

---

### Task 1: Converter as 30 regras CSS de `font-size` da GT para `calc(...*var(--gt-fs,1.3))` + definir a variável

**Files:** Modify `index.html`: bloco CSS da GT (~L2368-2464) + adicionar a regra do screen root.

**Interfaces:**
- Produces: `--gt-fs` definida em `#gestao-trafego-screen` (padrão 1.3); todas as classes `.gt-*` com fonte escalável. Consumido pela Task 3 (toggle) e pela Task 2.

- [ ] **Step 1: Definir a variável no screen root**

No bloco CSS da GT, adicione (perto do início das regras `.gt-*`, ex. antes de `.gt-body`/`.gt-camp-card`):
```css
  #gestao-trafego-screen{--gt-fs:1.3;}
```

- [ ] **Step 2: Converter cada `font-size` das classes `.gt-*`**

Para CADA linha abaixo, troque `font-size:Npx` por `font-size:calc(Npx*var(--gt-fs,1.3))` (só o `font-size`; o resto da regra fica igual):

| Linha | Seletor | valor |
|---|---|---|
| 2368 | `.gt-ads-section-lbl` | 9px |
| 2373 | `.gt-status-badge` | 9px |
| 2382 | `.gt-expand-hint` | 9px |
| 2384 | `.gt-name` | 12px |
| 2386 | `.gt-metric` | 10px |
| 2388 | `.gt-kpi` | 10px |
| 2391 | `.gt-spend` | 16px |
| 2394 | `.gt-act-btn` | 10px |
| 2412 | `.gt-rec-verdict` | 17px |
| 2416 | `.gt-rec-banner.neutral .gt-rec-verdict` | 14px |
| 2417 | `.gt-rec-tag` | 9px |
| 2418 | `.gt-rec-just` | 12px |
| 2420 | `.gt-rec-impact` | 10px |
| 2422 | `.gt-rec-from` | 11px |
| 2424 | `.gt-rec-to` | 22px |
| 2425 | `.gt-rec-to small` | 11px |
| 2427 | `.gt-rec-keep` | 12px |
| 2429 | `.gt-budget-edit` | 11px |
| 2431 | `.gt-be-link` | 11px |
| 2435 | `.gt-be-box input` | 11px |
| 2437 | `.gt-ad-pill` | 9px |
| 2441 | `.gt-ad-nm` | 11px |
| 2442 | `.gt-ad-sub` | 10px |
| 2443 | `.gt-ad-why` | 10.5px |
| 2445 | `.gt-auto-btn` | 11px |
| 2451 | `.gt-empty` | 12px |
| 2457 | `.gt-cfg-title` | 13px |
| 2458 | `.gt-cfg-close` | 16px |
| 2462 | `.gt-cfg-obj` | 11px |
| 2464 | `.gt-cfg-chk` | 12px |

(As linhas podem ter deslocado alguns números; ancore pelo SELETOR + valor, não só pela linha. Ex.: `.gt-ad-why{...font-size:10.5px;...}` → `...font-size:calc(10.5px*var(--gt-fs,1.3));...`.)

- [ ] **Step 3: Verificar**

Run: `grep -c "var(--gt-fs,1.3)" index.html` → ≥ 30.
Run: `grep -n "gestao-trafego-screen{--gt-fs" index.html` → aparece.
Run (checar que não sobrou fonte crua nas classes GT): inspecionar que nenhuma das linhas acima ainda tem `font-size:[0-9]` sem `calc`. Visual DEFERIDO ao usuário.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(gt-fonte): fontes das classes GT viram calc(px*var(--gt-fs,1.3)) + --gt-fs padrão 1.3 (+30%)"
```

---

### Task 2: Converter as 18 `font-size` embutidas nos templates JS/HTML da GT

**Files:** Modify `index.html`: funções de render da GT (~L8126-8372) + HTML do topo/modais da GT (~L11912-11964).

**Interfaces:**
- Consumes: `--gt-fs` (Task 1). Produces: fontes embutidas escaláveis.

- [ ] **Step 1: Converter cada `font-size:Npx` embutido**

Para CADA ocorrência abaixo, troque `font-size:Npx` por `font-size:calc(Npx*var(--gt-fs,1.3))` (dentro da string/style; o resto igual). Ancore pelo trecho de contexto:

| Linha | Contexto (função / trecho) | valor |
|---|---|---|
| 8126 | `_gtBudgetEditHtml` — botão `data-gt-manual-ok` `style="font-size:10px;"` | 10px |
| 8165 | `_renderGtCampaigns` — `ttl.style.cssText='...font-size:12px;...'` | 12px |
| 8168 | `_renderGtCampaigns` — `aiTag.style.cssText='...font-size:9px;...'` | 9px |
| 8173 | `_renderGtCampaigns` — `searchInp.style.cssText='...font-size:11px;...'` | 11px |
| 8184 | `_renderGtCampaigns` — `fb.style.cssText=\`...font-size:10px;...\`` | 10px |
| 8233 | `_renderGtCampaigns` — `chips.innerHTML` — `ma-obj-chip` `style="font-size:9px;"` E o span de `/dia` `font-size:10px` | 9px e 10px |
| 8292 | `_gtVerCriativo` — "Carregando o criativo…" `font-size:12px` | 12px |
| 8302 | `_gtVerCriativo` — mensagem de erro `font-size:12px` | 12px |
| 8306 | `_renderGtAds` — empty `empty.style.cssText='...font-size:11px;...'` | 11px |
| 8329 | `_renderGtAds` — `metrics.innerHTML` — `.gt-metric` do spend `style="...font-size:13px;..."` | 13px |
| 8368 | `_gtConfirm` — título `font-size:16px` e detalhe `font-size:13px` | 16px e 13px |
| 8371 | `_gtConfirm` — botão Cancelar `font-size:13px` | 13px |
| 8372 | `_gtConfirm` — botão Confirmar `font-size:13px` | 13px |
| 11912 | topo — `gv-perf-tag` `style="font-size:11px;..."` | 11px |
| 11913 | topo — `gv-brand-tag` `style="font-size:9px;..."` | 9px |
| 11932 | topo — `gt-acc-trigger` `style="...font-size:12px;..."` | 12px |
| 11963 | modal cfg — botão Cancelar `font-size:11px` | 11px |
| 11964 | modal cfg — botão Salvar `font-size:11px` | 11px |

(Atenção às linhas com DOIS valores — 8233 e 8368 — converta os dois.)

- [ ] **Step 2: Verificar sintaxe**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_gf'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_gf*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "var(--gt-fs,1.3)" index.html` → agora ≥ 48 (30 da Task 1 + ~18 desta).
Expected: inline scripts `OK`. Visual DEFERIDO ao usuário. NÃO `git push`.

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat(gt-fonte): fontes embutidas nos templates da GT viram calc(px*var(--gt-fs,1.3))"
```

---

### Task 3: Toggle A−/A+ (muda só `--gt-fs`) + init ao abrir a GT

**Files:** Modify `index.html`: adicionar `_gtFontScale()` (perto das funções `_gt*`, ex. após `openGestaoTrafego`) e chamá-la em `openGestaoTrafego()` (~L7739).

**Interfaces:**
- Consumes: `#gestao-trafego-screen`, `--gt-fs` (Tasks 1/2), CSS `.zoomctl` (já existe ~L1702). Produces: `_gtFontScale()`.

- [ ] **Step 1: Adicionar `_gtFontScale()`**

Logo após a função `openGestaoTrafego(){...}` (~L7739-7748), acrescente:
```javascript
function _gtFontScale(){
  const screen=document.getElementById('gestao-trafego-screen');if(!screen)return;
  const K='rbv-gtfs';
  let z=parseFloat(localStorage.getItem(K));if(!(z>=0.9&&z<=2.5))z=1.3;
  let ctl=screen.querySelector(':scope > .zoomctl');
  const apply=()=>{screen.style.setProperty('--gt-fs',String(z));try{localStorage.setItem(K,String(z));}catch(e){}const v=ctl&&ctl.querySelector('.zoomctl-val');if(v)v.textContent=Math.round(z*100)+'%';};
  if(!ctl){
    ctl=document.createElement('div');ctl.className='zoomctl';
    const mk=(t,title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.title=title;b.onclick=fn;return b;};
    ctl.appendChild(mk('A−','Diminuir fonte',()=>{z=Math.max(0.9,Math.round((z-0.1)*10)/10);apply();}));
    const val=document.createElement('span');val.className='zoomctl-val';val.title='Restaurar padrão (130%)';val.onclick=()=>{z=1.3;apply();};
    ctl.appendChild(val);
    ctl.appendChild(mk('A+','Aumentar fonte',()=>{z=Math.min(2.5,Math.round((z+0.1)*10)/10);apply();}));
    screen.appendChild(ctl);
  }
  apply();
}
```

- [ ] **Step 2: Chamar no `openGestaoTrafego()`**

Dentro de `openGestaoTrafego()`, logo após `_initGestaoTrafego();` (última linha antes do fecho), acrescente:
```javascript
  _gtFontScale();
```

- [ ] **Step 3: Verificar**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');let i=0;for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)){fs.writeFileSync('/tmp/_gt3'+i+'.js',m[1]);i++;}console.log(i)"
for f in /tmp/_gt3*.js; do node --check "$f" && echo OK; done
```
Run: `grep -c "_gtFontScale" index.html` → ≥ 2 (def + chamada).
Expected: inline scripts `OK`. **Teste do Breno no preview:** abrir a Gestão de Tráfego → ver o controle A−/A+ (canto inferior direito), texto já ~30% maior (130%); clicar A− diminui **só a fonte** (cards continuam esticados na largura); A+ aumenta; o 130% reseta; recarregar mantém a escolha. NÃO `git push`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(gt-fonte): toggle A−/A+ de fonte na GT (muda só --gt-fs, não o layout) + init ao abrir"
```

---

## Notas de execução

- **Ordem:** T1 (CSS) → T2 (embutidas) → T3 (toggle). O +30% já vale após T1+T2 (fallback 1.3); o toggle (T3) torna ajustável.
- **Por que resolve o bug:** o toggle do Notícias usava `zoom` (escala o layout inteiro → cards encolhiam ao diminuir). Aqui só `font-size` escala via `--gt-fs`; larguras/paddings/cards ficam em px fixos → cards sempre esticados na lateral.
- **Se sobrar algum texto sem escalar:** é uma fonte que ficou de fora da conversão (T1/T2) — achar o `font-size:Npx` cru e convertê-lo. A lista das 48 é exaustiva conforme o mapa; conferir no preview.
- **Notícias:** o toggle de lá continua com `zoom` (fora de escopo). Se o Breno quiser, dá pra aplicar a mesma correção lá depois.
