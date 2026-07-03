# Controle de fonte na Gestão Comercial (só-fonte, corrige o zoom) — Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o toggle de fonte da Gestão Comercial para escalar **só as fontes** (cards/layout fixos), como já foi feito na Gestão de Tráfego e no Portal de Notícias — trocando o `zoom` (que encolhia os cards) por uma variável de escala `--gc-fs`.

**Architecture:** Variável CSS `--gc-fs` escopada em `#gestao-comercial-screen` (padrão 1 = 100%). Todas as ~45 fontes `.gc-*`/`.gck-*` viram `calc(px*var(--gc-fs,1))` (as `clamp(...)` viram `calc(clamp(...)*var(--gc-fs,1))`). Um toggle próprio `_gcFontScale()` (espelho do `_npFontScale` do Notícias) muda `--gc-fs` (não `zoom`). **NÃO tocar em `_rbvZoom`** (compartilhado); só trocar a chamada da Gestão Comercial.

**Tech Stack:** `index.html` monólito (CSS + JS inline). `.zoomctl` (controle flutuante) já existe e é reutilizado.

## Global Constraints

- **Branch:** `feat/gc-controle-fonte` (nunca `main`). `git config user.email` = `breno@rbvcompany.com` (email vazio TRAVA o build Vercel).
- **Só a fonte escala.** Nada de `zoom`/`transform`. Layout fica em px fixos; só `font-size` usa a escala.
- **Transformação determinística:** `font-size:Npx` → `font-size:calc(Npx*var(--gc-fs,1))` (funciona com decimais: `13.5px` etc.). `font-size:clamp(a,b,c)` → `font-size:calc(clamp(a,b,c)*var(--gc-fs,1))`. Fallback `,1` = 100% (SEM bump).
- **NÃO alterar `_rbvZoom`** (usado por outras telas). Só a Gestão Comercial ganha `_gcFontScale` e troca a chamada.
- **`.zoomctl`** já existe (fontes próprias 14px/11px, NÃO são `.gc-*`, não escalam — sem loop). Reutilizar.
- **Sem harness de teste de DOM** (padrão do monólito): gate = extrair inline scripts + `node --check` + greps; **validação visual DEFERIDA ao Breno**. NÃO `git push`.
- **Escopo:** só a Gestão Comercial. Outras telas ficam como estão.

---

### Task 1: Converter as ~45 regras de `font-size` da Gestão Comercial + definir `--gc-fs`

**Files:** Modify `index.html`: bloco CSS da Gestão Comercial (~L1556-1697).

**Interfaces:** Produces `--gc-fs` em `#gestao-comercial-screen` (padrão 1); todas as fontes `.gc-*`/`.gck-*` escaláveis.

- [ ] **Step 1: Definir a variável**

Adicione (perto do início das regras da GC, ex. junto ao `#gestao-comercial-screen{...}` root, ou antes de `.gc-back`):
```css
  #gestao-comercial-screen{--gc-fs:1;}
```

- [ ] **Step 2: Converter cada `font-size`**

Para CADA seletor abaixo, `font-size:VALOR` → `font-size:calc(VALOR*var(--gc-fs,1))` (só o font-size; resto igual). Ancore pelo SELETOR:

| Seletor | valor |
|---|---|
| `.gc-back` | 11px |
| `.gc-title` | 15px |
| `.gc-edicao-lbl` | 10px |
| `.gc-edicao select` | 11px |
| `.gc-hero-over` | 10px |
| `.gc-hero-title` | clamp(26px,3.6vw,42px) |
| `.gc-hero-sub` | 13px |
| `.gc-hero-ring-c b` | 23px |
| `.gc-hero-ring-c span` | 8px |
| `.gc-resumo` | 16px |
| `.gc-resumo b` | 10px |
| `.gck-canal` | 13.5px |
| `.gck-pill` | 9px |
| `.gck-ring-c b` | 21px |
| `.gck-ring-c span` | 7.5px |
| `.gck-proj-l` | 9px |
| `.gck-proj-v` | 20px |
| `.gck-row` | 12px |
| `.gc-sec-n` | 14px |
| `.gc-report .gc-sec-h h2` | clamp(16px,1.7vw,20px) |
| `.gc-report h2` | 19px |
| `.gc-report h3` | 15.5px |
| `.gc-report p` | 15px |
| `.gc-report li` | 15px |
| `.gc-report table` | 13.5px |
| `.gc-report thead th` | 10.5px |
| `.gc-bcg` | 10px |
| `.gc-im-x` | 13px |
| `.gc-im-img span` | 11px |
| `.gc-im-sku` | 10px |
| `.gc-im-nome` | 21px |
| `.gc-im-preco` | 23px |
| `.gc-im-ph` | 14px |
| `.gc-mix-h` | 10px |
| `.gc-mix-l` | 11px |
| `.gc-mix-n b` | 19px |
| `.gc-mix-n i` | 13px |
| `.gc-info` | 11px |
| `.gc-infomodal-h` | 23px |
| `.gc-infomodal-body h4` | 12px |
| `.gc-infomodal-body p` | 14px |
| `.gc-infomodal-body li` | 14px |
| `.gc-infomodal-body code` | 12.5px |
| `.gc-infomodal-body table` | 13px |
| `.gc-infomodal-body th` | 11px |
| `.gc-infomodal-body .ex` | 13px |
| `.gc-infomodal-body small` | 12px |

E as DUAS regras dentro do `@media(max-width:560px)` (~L1696-1697) — converta também:
| `.gc-report table` (no media) | 11px |
| `.gc-report thead th` (no media) | 9px |

(Ex. clamp: `.gc-hero-title{...font-size:clamp(26px,3.6vw,42px);...}` → `...font-size:calc(clamp(26px,3.6vw,42px)*var(--gc-fs,1));...`.)

- [ ] **Step 3: Verificar**

Run: `grep -c "var(--gc-fs,1)" index.html` → ≥ 47 (45 base + 2 do media = ~49; qualquer ≥47 ok).
Run: `grep -n "gestao-comercial-screen{--gc-fs" index.html` → aparece.
Extract inline scripts + `node --check` → OK.
Conferir que nenhuma regra `.gc-*`/`.gck-*` acima ainda tem `font-size:[0-9]`/`font-size:clamp` sem `calc`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(gc-fonte): ~45 regras .gc-*/.gck-* → calc(valor*var(--gc-fs,1)) + --gc-fs padrão 1"
```

---

### Task 2: Toggle `_gcFontScale()` (só-fonte) + trocar a chamada no `openGestao`

**Files:** Modify `index.html`: adicionar `_gcFontScale()` (perto de `_rbvZoom`/`_npFontScale`) e trocar a chamada em `openGestao()` (~L11463).

**Interfaces:** Consumes `#gestao-comercial-screen`, `--gc-fs`, `.zoomctl`. Produces `_gcFontScale()`.

- [ ] **Step 1: Adicionar `_gcFontScale()`**

Acrescente (ex. logo após `_npFontScale(){...}` — NÃO altere `_rbvZoom` nem `_npFontScale`):
```javascript
function _gcFontScale(){
  const screen=document.getElementById('gestao-comercial-screen');if(!screen)return;
  const K='rbv-gcfs';
  let z=parseFloat(localStorage.getItem(K));if(!(z>=0.7&&z<=2))z=1;
  let ctl=screen.querySelector(':scope > .zoomctl');
  const apply=()=>{screen.style.setProperty('--gc-fs',String(z));document.documentElement.style.setProperty('--gc-fs',String(z));try{localStorage.setItem(K,String(z));}catch(e){}const v=ctl&&ctl.querySelector('.zoomctl-val');if(v)v.textContent=Math.round(z*100)+'%';};
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

- [ ] **Step 2: Trocar a chamada no `openGestao()`**

Em `openGestao()` (~L11463), troque:
```javascript
  _rbvZoom('gestor','gc-body');
```
por:
```javascript
  _gcFontScale();
```
(NÃO remover a definição de `_rbvZoom`.)

- [ ] **Step 3: Verificar**

Extract inline scripts + `node --check` → OK.
Run: `grep -c "_gcFontScale" index.html` → ≥ 2 (def + chamada).
Run: `grep -c "_rbvZoom('gestor'" index.html` → 0 (a chamada da GC foi trocada).
Run: `grep -c "function _rbvZoom" index.html` → 1 (definição intacta).
Expected: inline scripts `OK`. **Teste do Breno no preview:** abrir a Gestão Comercial → A−/A+ mexe **só na fonte** (cards/anéis ficam do mesmo tamanho, sem encolher pros lados); 100% reseta; recarregar mantém. NÃO `git push`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat(gc-fonte): toggle _gcFontScale (só --gc-fs, não zoom) + troca a chamada no openGestao; _rbvZoom intacto"
```

---

## Notas de execução

- **Ordem:** T1 (CSS) → T2 (toggle). O toggle só faz efeito depois que as fontes usam `--gc-fs`.
- **Por que resolve o bug:** o toggle usava `zoom` (escala layout → cards encolhiam ao diminuir). Agora só `font-size` escala via `--gc-fs`.
- **`_rbvZoom`:** fica intacto (nenhuma tela usa mais depois desta? o Notícias já foi trocado; a GC é a última). Não remover a função por segurança.
- **Se sobrar texto sem escalar:** achar o `font-size` cru `.gc-*`/`.gck-*` e converter. A lista é exaustiva conforme o mapa; conferir no preview.
