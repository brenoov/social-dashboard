# Controle de fonte no Portal de Notícias (só-fonte, corrige o zoom) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o toggle de fonte do Portal de Notícias para escalar **só as fontes** (cards/layout fixos), como já foi feito na Gestão de Tráfego — trocando o `zoom` (que encolhia os cards) por uma variável de escala `--np-fs`.

**Architecture:** Variável CSS `--np-fs` escopada no `#noticias-screen` (padrão 1 = 100%). Todas as 70 fontes `.np-*` viram `calc(px*var(--np-fs,1))` (as `clamp(...)` viram `calc(clamp(...)*var(--np-fs,1))`). Um toggle próprio do Notícias `_npFontScale()` (espelho do `_gtFontScale` da GT) muda `--np-fs` (não `zoom`). **NÃO tocar em `_rbvZoom`** — ele é compartilhado com a Gestão Comercial (`_rbvZoom('gestor','gc-body')`); só trocamos a chamada do Notícias.

**Tech Stack:** `index.html` monólito (CSS + JS inline). `.zoomctl` (controle flutuante) já existe e é reutilizado.

## Global Constraints

- **Branch:** `feat/noticias-fonte` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Só a fonte escala.** Nada de `zoom`/`transform`. Layout (larguras/paddings/cards) fica em px fixos; só `font-size` usa a escala.
- **Transformação determinística:**
  - `font-size:Npx` → `font-size:calc(Npx*var(--np-fs,1))` (ex.: `10.5px` funciona igual). Fallback `,1` = 100% (Notícias NÃO tem bump de +30%; só corrige o toggle).
  - `font-size:clamp(a,b,c)` → `font-size:calc(clamp(a,b,c)*var(--np-fs,1))`.
- **NÃO alterar `_rbvZoom`** (usado pela Gestão Comercial). Só o Notícias ganha `_npFontScale` e troca a chamada.
- **`.zoomctl`** já existe (fontes próprias fixas 14px/11px — NÃO são `.np-*`, então não escalam; sem loop). Reutilizar.
- **Sem harness de teste de DOM** (padrão do monólito): gate = extrair inline scripts + `node --check` + greps de presença; **validação visual DEFERIDA ao Breno**. NÃO `git push`.
- **Escopo:** só o Portal de Notícias. A Gestão Comercial mantém o toggle `zoom` atual (fora de escopo).

---

### Task 1: Converter as 24 regras `#noticias-screen .np-*` + definir `--np-fs`

**Files:** Modify `index.html`: bloco CSS escopado do Notícias (~L1293-1370) + adicionar a variável.

**Interfaces:** Produces `--np-fs` em `#noticias-screen` (padrão 1); regras escopadas escaláveis.

- [ ] **Step 1: Definir a variável**

Adicione (perto do início das regras `#noticias-screen`, ex. junto ao `#noticias-screen{...}` root ~L925 ou antes de `.np-tab-pano`):
```css
  #noticias-screen{--np-fs:1;}
```

- [ ] **Step 2: Converter cada `font-size` escopada**

Para CADA linha, `font-size:VALOR` → `font-size:calc(VALOR*var(--np-fs,1))` (só o font-size). Ancore por SELETOR:

| Seletor | valor |
|---|---|
| `#noticias-screen .np-tabs .np-tab.np-tab-pano` | 13px |
| `#noticias-screen .np-tabsep` | 16px |
| `#noticias-screen .np-pcover-over` | 11px |
| `#noticias-screen .np-pcover-title` | clamp(30px,6vw,54px) |
| `#noticias-screen .np-pcover-sub` | 13px |
| `#noticias-screen .np-pcover-lead` | 14px |
| `#noticias-screen .np-edchip` | 10px |
| `#noticias-screen .np-sec-n` | 30px |
| `#noticias-screen .np-sec-h h2` | clamp(19px,3vw,26px) |
| `#noticias-screen .np-sec-b p` | 15px |
| `#noticias-screen .np-sec-b h3` | 15px |
| `#noticias-screen .np-sec-b h4` | 14px |
| `#noticias-screen .np-sec-b li` | 15px |
| `#noticias-screen .np-pano-meta` | 11.5px |
| `#noticias-screen .np-pano-pending h3` | 22px |
| `#noticias-screen .np-pano-pending p` | 14px |
| `#noticias-screen .np-prule` | 14px |
| `#noticias-screen .np-prule small` | 11px |
| `#noticias-screen .np-pcard-tag` | 9px |
| `#noticias-screen .np-pcard-marca` | 11px |
| `#noticias-screen .np-pcard-title` | 15px |
| `#noticias-screen .np-pmap-h b` | 15px |
| `#noticias-screen .np-pmap-h i` | 13px |
| `#noticias-screen .np-pmap-tag` | 9px |

(Ex. clamp: `#noticias-screen .np-pcover-title{...font-size:clamp(30px,6vw,54px);...}` → `...font-size:calc(clamp(30px,6vw,54px)*var(--np-fs,1));...`.)

- [ ] **Step 3: Verificar**

Run: `grep -c "var(--np-fs,1)" index.html` → ≥ 24.
Run: `grep -n "noticias-screen{--np-fs" index.html` → aparece.
Extract inline scripts + `node --check` → OK.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(noticias-fonte): 24 regras escopadas .np-* → calc(px*var(--np-fs,1)) + --np-fs padrão 1"
```

---

### Task 2: Converter as 46 regras globais `.np-*`

**Files:** Modify `index.html`: bloco CSS global do Notícias (~L1386-1516).

**Interfaces:** Consumes `--np-fs` (Task 1). Produces as regras globais escaláveis.

- [ ] **Step 1: Converter cada `font-size` global**

Mesma transformação (`font-size:VALOR` → `calc(VALOR*var(--np-fs,1))`, incl. `clamp`). Ancore por SELETOR:

| Seletor | valor |
|---|---|
| `.np-back` | 11px |
| `.np-masthead-mini` | 19px |
| `.np-meta` | 10px |
| `.np-tab` | 11px |
| `.np-tab-count` | 11px |
| `.np-brandsel` | 13px |
| `.np-brandmenu-h` | 10px |
| `.np-brandmenu-item` | 15px |
| `.np-brandmenu-item b` | 12px |
| `.np-issue-over` | 10px |
| `.np-issue-title` | clamp(46px,9vw,108px) |
| `.np-issue-r` | 10px |
| `.np-hero-kicker` | 11px |
| `.np-hero-headline` | clamp(28px,3.4vw,46px) |
| `.np-hero-resumo` | 17px |
| `.np-hero-fonte` | 10px |
| `.np-hero-fonte b` | 12px |
| `.np-link` | 11px |
| `.np-sec-rule span` | 10px |
| `.np-art-kicker` | 10px |
| `.np-art-headline` | 23px |
| `.np-art-resumo` | 13px |
| `.np-art-fonte` | 10px |
| `.np-art-date` | 13px |
| `.np-art .np-link` | 10px |
| `.np-gallery-kicker` | 11px |
| `.np-gallery-title` | clamp(22px,3vw,34px) |
| `.np-gallery-meta` | 10px |
| `.np-gallery-resumo` | 16px |
| `.np-prod-name` | 12px |
| `.np-prod-price` | 15px |
| `.np-prod-eng` | 11px |
| `.np-prod-badge` | 9px |
| `.np-prod-analise` | 11px |
| `.np-gallery .np-link` | 10px |
| `.np-view` | 12.5px |
| `.np-view .np-view-ic` | 17px |
| `.np-view small` | 9px |
| `.np-modsum-over` | 11px |
| `.np-modsum-title` | clamp(25px,3.6vw,40px) |
| `.np-modsum-body` | 15px |
| `.np-modsum-body h2, .np-modsum-body h3, .np-modsum-body h4` | 15px |
| `.np-modsum-tag` | 11px |

(São 43 seletores; alguns têm o mesmo valor. Converta TODOS. `.np-issue-title` clamp → `calc(clamp(46px,9vw,108px)*var(--np-fs,1))`.)

- [ ] **Step 2: Verificar**

Run: `grep -c "var(--np-fs,1)" index.html` → ≥ 67 (24 da Task 1 + ~43 desta).
Extract inline scripts + `node --check` → OK.
Conferir que nenhuma regra `.np-*` acima ainda tem `font-size:[0-9]`/`font-size:clamp` sem `calc`.

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat(noticias-fonte): 43 regras globais .np-* → calc(valor*var(--np-fs,1))"
```

---

### Task 3: Toggle `_npFontScale()` (só-fonte) + trocar a chamada no `openNoticias`

**Files:** Modify `index.html`: adicionar `_npFontScale()` (perto de `_rbvZoom` ~L9555 ou de `openNoticias`) e trocar a chamada em `openNoticias()` (~L9578).

**Interfaces:** Consumes `#noticias-screen`, `--np-fs`, `.zoomctl`. Produces `_npFontScale()`.

- [ ] **Step 1: Adicionar `_npFontScale()`**

Acrescente (ex. logo após `_rbvZoom(){...}` — NÃO altere `_rbvZoom`):
```javascript
function _npFontScale(){
  const screen=document.getElementById('noticias-screen');if(!screen)return;
  const K='rbv-npfs';
  let z=parseFloat(localStorage.getItem(K));if(!(z>=0.7&&z<=2))z=1;
  let ctl=screen.querySelector(':scope > .zoomctl');
  const apply=()=>{screen.style.setProperty('--np-fs',String(z));document.documentElement.style.setProperty('--np-fs',String(z));try{localStorage.setItem(K,String(z));}catch(e){}const v=ctl&&ctl.querySelector('.zoomctl-val');if(v)v.textContent=Math.round(z*100)+'%';};
  if(!ctl){
    ctl=document.createElement('div');ctl.className='zoomctl';
    const mk=(t,title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.title=title;b.onclick=fn;return b;};
    ctl.appendChild(mk('A−','Diminuir texto',()=>{z=Math.max(0.7,Math.round((z-0.1)*10)/10);apply();}));
    const val=document.createElement('span');val.className='zoomctl-val';val.title='Restaurar 100%';val.onclick=()=>{z=1;apply();};
    ctl.appendChild(val);
    ctl.appendChild(mk('A+','Aumentar texto',()=>{z=Math.min(2,Math.round((z+0.1)*10)/10);apply();}));
    screen.appendChild(ctl);
  }
  apply();
}
```

- [ ] **Step 2: Trocar a chamada no `openNoticias()`**

Em `openNoticias()`, troque:
```javascript
  _rbvZoom('observatorio','np-body');
```
por:
```javascript
  _npFontScale();
```
(NÃO remover a definição de `_rbvZoom` — a Gestão Comercial ainda usa `_rbvZoom('gestor','gc-body')`.)

- [ ] **Step 3: Verificar**

Extract inline scripts + `node --check` → OK.
Run: `grep -c "_npFontScale" index.html` → ≥ 2 (def + chamada).
Run: `grep -c "_rbvZoom('observatorio'" index.html` → 0 (a chamada do Notícias foi trocada).
Run: `grep -c "_rbvZoom('gestor'\|function _rbvZoom" index.html` → ≥ 2 (GC intacta).
Expected: inline scripts `OK`. **Teste do Breno no preview:** abrir Notícias → A−/A+ mexe **só na fonte** (cards/imagens ficam do mesmo tamanho, sem encolher pros lados); 100% reseta; recarregar mantém. Conferir que a Gestão Comercial (outro toggle) segue funcionando. NÃO `git push`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(noticias-fonte): toggle _npFontScale (só --np-fs, não zoom) + troca a chamada no openNoticias; _rbvZoom (GC) intacto"
```

---

## Notas de execução

- **Ordem:** T1 (escopadas) → T2 (globais) → T3 (toggle). O toggle só faz efeito depois que as fontes usam `--np-fs`.
- **Por que resolve o bug:** o toggle usava `zoom` (escala layout → cards encolhiam ao diminuir). Agora só `font-size` escala via `--np-fs`; larguras/cards ficam em px fixos.
- **Gestão Comercial:** continua com `_rbvZoom`/`zoom` (mesmo bug, fora de escopo — o Breno pediu só o Notícias). Se quiser, dá pra dar o mesmo tratamento nela depois.
- **Se sobrar texto sem escalar:** achar o `font-size` cru `.np-*` e converter. As listas (24 + 43) são exaustivas conforme o mapa; conferir no preview.
