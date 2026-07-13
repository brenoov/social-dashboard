# Fábrica — Recorte robusto + Margens de segurança + Curar por loja/proporção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recorte de fundo determinístico entre plataformas, margens de segurança nos templates e curadoria por loja com pares feed/story.

**Architecture:** P1 troca o miolo do `recortar.py` por flood-fill de borda (numpy/scipy, determinístico) com fallback BiRefNet. P2 adiciona um safe-area compartilhado por formato aos 13 looks de `templates.mjs`. P3 adiciona a coluna `sku` a `fabrica_criativos` (migration 029) e reescreve `painel-curar.vue` em seções por loja com pares feed/story, via uma função pura de agrupamento.

**Tech Stack:** Node ESM (coletor, `node --test`), Python 3.11 (recortar.py: numpy/scipy/PIL), Vue 3 (src/), Supabase (Postgres + Storage), GitHub Actions (runner Linux).

## Global Constraints

- Recorte deve ser **determinístico entre plataformas** — não depender de inferência de ML que varia Linux×macOS.
- Fotos são de estúdio em fundo branco; `ehFotoStudio` filtra foto amadora ANTES do recorte.
- Templates: safe-area por formato — **feed 4:5 uniforme ~7%**; **story 9:16 topo ~14% (≈270px) e base ~20% (≈390px)**, lados ~6%.
- Arte é **1 por SKU** (dedup entre lojas); a loja é derivada de `job.params.itens` (SKU→depósito) × `fabrica_lojas` (depósito→nome). NÃO virar coluna do criativo.
- Migration nova = **029** (025–028 são de outra feature não-commitada no working tree; não reusar).
- Suite verde: rodar de `coletor/` → `node --test 'lib/*.test.mjs' '*.test.mjs'`. Front: `node --test 'src/ferramentas/meta-ads/*.test.mjs'`.
- NÃO tocar nas mudanças não-commitadas de outra sessão (status-projetos / ia_execucoes / migrations 025–028).
- Money-path intocado: gerar sobe criativos PAUSED/curados; nada de apagar/pausar ativos.

---

## File Structure

- `coletor/recortar.py` — **modify**: adiciona `_cut_floodfill`, vira recorte primário com fallback.
- `coletor/lib/__fixtures__/bolsa-clara-estudio.jpg` — **create**: fixture (cópia de uma foto de bolsa clara).
- `coletor/recorte-floodfill.test.mjs` — **create**: teste do recorte via spawn python.
- `coletor/templates-criativos/templates.mjs` — **modify**: `SAFE` + `safeAreaCss` + aplica nos 13 looks.
- `coletor/templates-criativos/safe-area.test.mjs` — **create**: teste do helper + smoke de render.
- `db/migrations/029_fabrica_criativos_sku.sql` — **create**: `ADD COLUMN sku text`.
- `coletor/gerar-criativos.mjs` — **modify**: extrai `linhaCriativoProduto` + grava `sku`.
- `src/ferramentas/meta-ads/curar-agrupar.js` — **create**: função pura de agrupamento.
- `src/ferramentas/meta-ads/curar-agrupar.test.mjs` — **create**: testes da função pura.
- `src/ferramentas/meta-ads/painel-curar.vue` — **modify**: seções por loja + pares.

---

## Task 1: Recorte flood-fill (determinístico)

**Files:**
- Modify: `coletor/recortar.py`
- Create: `coletor/lib/__fixtures__/bolsa-clara-estudio.jpg`
- Create: `coletor/recorte-floodfill.test.mjs`

**Interfaces:**
- Produces: `recortar.py <entrada> <saida.png>` — mesmo contrato de CLI; agora recorta por flood-fill (fallback BiRefNet/isnet). Sem mudança pros chamadores (`lib/cutout.mjs`).

- [ ] **Step 1: Cria a fixture (bolsa clara de estúdio)**

```bash
cd coletor && mkdir -p lib/__fixtures__ && cp fotos-bling/LV1159-Panacota.jpg lib/__fixtures__/bolsa-clara-estudio.jpg
```

- [ ] **Step 2: Escreve o teste (falha — flood-fill ainda não existe)**

Create `coletor/recorte-floodfill.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temPy = spawnSync('python3', ['-c', 'import scipy,numpy,PIL']).status === 0;

test('recorte flood-fill: corpo claro opaco + fundo transparente', { skip: temPy ? false : 'python3+scipy indisponível' }, () => {
  const out = join(mkdtempSync(join(tmpdir(), 'rec-')), 'o.png');
  const r = spawnSync('python3', ['recortar.py', 'lib/__fixtures__/bolsa-clara-estudio.jpg', out], { cwd: process.cwd() });
  assert.equal(r.status, 0, r.stderr?.toString());
  assert.ok(existsSync(out), 'gerou o PNG');
  const chk = spawnSync('python3', ['-c', [
    'import sys,numpy as np',
    'from PIL import Image',
    `a=np.asarray(Image.open('${out}').convert('RGBA'))[:,:,3]/255.0`,
    'H,W=a.shape',
    'body=a[int(0.42*H):int(0.62*H),int(0.32*W):int(0.68*W)].mean()',
    'corner=a[:int(0.06*H),:int(0.06*W)].mean()',
    'sys.exit(0 if (body>0.9 and corner<0.1) else 1)',
  ].join('\n')]);
  assert.equal(chk.status, 0, 'corpo opaco (>0.9) e canto transparente (<0.1)');
});
```

- [ ] **Step 3: Roda o teste — deve falhar**

Run: `cd coletor && node --test recorte-floodfill.test.mjs`
Expected: FAIL (o recorte atual BiRefNet no macOS até passa; mas em ambiente sem o peso ele cai no isnet que come a bolsa clara → corpo < 0.9). Se passar por acaso no seu Mac (BiRefNet local limpo), siga assim mesmo — o objetivo é garantir o flood-fill; confirme a falha removendo temporariamente o peso ou confie no Step 5.

- [ ] **Step 4: Implementa `_cut_floodfill` + reordena o `main` em recortar.py**

Em `coletor/recortar.py`, adiciona a função (antes de `_cut_isnet`):

```python
def _cut_floodfill(img):
    # Remoção de fundo branco de estúdio por flood-fill de borda. Determinístico
    # (numpy/scipy) — mesmo resultado em Linux e macOS, ao contrário do BiRefNet.
    from scipy import ndimage
    from PIL import ImageFilter
    WHITE_MIN = int(os.environ.get('FLOODFILL_WHITE_MIN', '200'))
    SPREAD = int(os.environ.get('FLOODFILL_SPREAD', '28'))
    a0 = np.asarray(img.convert('RGB')).astype(np.int32)
    a = np.pad(a0, ((1, 1), (1, 1), (0, 0)), constant_values=255)  # moldura branca 1px
    mx = a.max(2); mn = a.min(2)
    whiteish = (mn >= WHITE_MIN) & ((mx - mn) <= SPREAD)   # branco + cinza-claro de fundo/sombra
    lbl, _ = ndimage.label(whiteish)
    borda = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    borda.discard(0)
    fg = ~np.isin(lbl, list(borda))            # fundo = whiteish conectado à borda
    fg = ndimage.binary_fill_holes(fg)         # tapa reflexo branco interno
    lf, nf = ndimage.label(fg)
    if nf > 1:                                  # mantém só o maior componente
        fg = lf == (np.argmax(np.bincount(lf.ravel())[1:]) + 1)
    fg = fg[1:-1, 1:-1]                          # remove a moldura
    cobertura = float(fg.mean())
    if cobertura > 0.92:                         # flood removeu quase nada -> foto não é fundo branco
        return None
    mask = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert('RGBA'); out.putalpha(mask)
    return out
```

Substitui o bloco final do arquivo (o `src = Image.open(IN)` … `out.save(OUT)`) por:

```python
src = Image.open(IN)
out = None
try:
    out = _cut_floodfill(src)                    # primário: determinístico
    if out is None:
        sys.stderr.write('floodfill: cobertura alta (nao e fundo branco) — fallback BiRefNet\n')
except Exception as e:
    sys.stderr.write('floodfill falhou (%s) — fallback BiRefNet\n' % str(e)[:120])
if out is None:
    try:
        if not os.path.exists(MODEL):
            raise FileNotFoundError('modelo BiRefNet ausente: ' + MODEL)
        out = _cut_birefnet(src)
    except Exception as e:
        sys.stderr.write('BiRefNet indisponivel (%s) — fallback isnet\n' % str(e)[:160])
        out = _cut_isnet(src)
out.save(OUT)
```

(Mantém `_cut_birefnet`, `_cut_isnet`, `TOL`, imports e o `import sys/os/numpy/PIL` do topo.)

- [ ] **Step 5: Roda o teste — deve passar**

Run: `cd coletor && node --test recorte-floodfill.test.mjs`
Expected: PASS (corpo>0.9, canto<0.1).

- [ ] **Step 6: Não-regressão da suite**

Run: `cd coletor && node --test 'lib/*.test.mjs' '*.test.mjs'`
Expected: tudo PASS.

- [ ] **Step 7: Commit**

```bash
git add coletor/recortar.py coletor/recorte-floodfill.test.mjs coletor/lib/__fixtures__/bolsa-clara-estudio.jpg
git commit -m "feat(fabrica): recorte de fundo por flood-fill (deterministico Linux/macOS)"
```

---

## Task 2: Safe-area nos templates

**Files:**
- Modify: `coletor/templates-criativos/templates.mjs`
- Create: `coletor/templates-criativos/safe-area.test.mjs`

**Interfaces:**
- Produces: `export const SAFE`, `export function safeAreaCss(formato)` → string de padding CSS (top right bottom left) em px do canvas.

- [ ] **Step 1: Escreve o teste do helper (falha — ainda não existe)**

Create `coletor/templates-criativos/safe-area.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAreaCss, SAFE } from './templates.mjs';
import { TEMPLATES } from './templates.mjs';

test('safeAreaCss: story recua mais topo/base que o feed', () => {
  assert.equal(safeAreaCss('1080x1920'), '270px 70px 390px 70px');
  assert.equal(safeAreaCss('1080x1350'), '95px 76px 95px 76px');
  assert.equal(safeAreaCss('desconhecido'), '95px 76px 95px 76px'); // fallback feed
});

test('todo look aplica o safe-area no wrapper (story)', () => {
  const dados = { fotoDataUrl: 'data:,', precoDe: '1', precoPor: '1', parcelas: 10, parcelado: '1', oferta: '50%', nome: 'Bolsa X' };
  const alvo = SAFE['1080x1920'].top + 'px ' + SAFE['1080x1920'].right + 'px ' + SAFE['1080x1920'].bottom + 'px ' + SAFE['1080x1920'].left + 'px';
  for (const chave of Object.keys(TEMPLATES)) {
    const html = TEMPLATES[chave].render(dados, '1080x1920');
    assert.ok(html.includes('padding:' + alvo), `look ${chave} sem safe-area`);
  }
});
```

- [ ] **Step 2: Roda — deve falhar**

Run: `cd coletor && node --test templates-criativos/safe-area.test.mjs`
Expected: FAIL ("safeAreaCss is not a function").

- [ ] **Step 3: Adiciona `SAFE` + `safeAreaCss` no topo de templates.mjs**

Logo após `const DIM = {...}` em `coletor/templates-criativos/templates.mjs`:

```js
// Área segura (recuo mínimo do conteúdo às bordas do canvas), por formato. Story 9:16
// recua topo ~14% (faixa do perfil da Meta) e base ~20% (botão/CTA); feed 4:5 uniforme ~7%.
// Valores em px do canvas final (NÃO passam pela escala s() — são sobre a borda real).
export const SAFE = {
  '1080x1350': { top: 95, right: 76, bottom: 95, left: 76 },
  '1080x1920': { top: 270, right: 70, bottom: 390, left: 70 },
};
export function safeAreaCss(formato) {
  const s = SAFE[formato] || SAFE['1080x1350'];
  return `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`;
}
```

- [ ] **Step 4: Aplica `safeAreaCss(formato)` no wrapper raiz dos 13 looks**

Em cada `render(dados, formato)` de `TEMPLATES`, o wrapper de conteúdo raiz é o `<div>` com
`display:flex;flex-direction:column;...padding:...` DENTRO do container de fundo. Troca o token
`padding:${s(NN)}px ${s(MM)}px[...]` desse wrapper por `padding:${safeAreaCss(formato)}`.

Exemplos concretos (pelo grep atual — repita o padrão em TODOS os looks):
- `promo-number-hero`: `...justify-content:center;gap:${s(56)}px;padding:${s(96)}px ${s(80)}px;` → `...gap:${s(56)}px;padding:${safeAreaCss(formato)};`
- `produto-heroi`: `...justify-content:space-between;padding:${s(66)}px ${s(60)}px ${s(60)}px;` → `...justify-content:space-between;padding:${safeAreaCss(formato)};`
- `produto-preco-tipo` (ex. linha 115): `...justify-content:center;gap:${s(40)}px;padding:${s(110)}px ${s(90)}px;` → `...gap:${s(40)}px;padding:${safeAreaCss(formato)};`

Looks a cobrir (todos): `produto-heroi`, `produto-sage-circulo`, `produto-preco-tipo`, `produto-split`,
`editorial-sale` (editorial-v2), `editorial-v2`, `promo-number-hero`, `promo-sage`, `promo-minimal-pearl`,
`promo-burnt-wood`, `produto-modelo`, `marca-lifestyle`, `marca-editorial`. Use
`grep -n "padding:\${s(" templates-criativos/templates.mjs` pra achar cada wrapper raiz e trocar só o
do wrapper de conteúdo (não os paddings internos de botão/pill/preço).

- [ ] **Step 5: Roda o teste — deve passar**

Run: `cd coletor && node --test templates-criativos/safe-area.test.mjs`
Expected: PASS (todos os looks incluem `padding:270px 70px 390px 70px` no story).

- [ ] **Step 6: Regressão visual rápida (previews)**

Run: `cd coletor && node --import ./lib/curl-fetch.mjs gerar-previews.mjs` (precisa das envs; se local sem envs, pule e valide na execução em CI).
Expected: previews renderizam sem conteúdo estourado; nada colado na borda.

- [ ] **Step 7: Suite + commit**

```bash
cd coletor && node --test 'lib/*.test.mjs' '*.test.mjs' templates-criativos/safe-area.test.mjs
git add coletor/templates-criativos/templates.mjs coletor/templates-criativos/safe-area.test.mjs
git commit -m "feat(fabrica): safe-area compartilhado nos 13 looks (nao cortar no feed/story)"
```

---

## Task 3: Migration 029 + gerar grava `sku`

**Files:**
- Create: `db/migrations/029_fabrica_criativos_sku.sql`
- Modify: `coletor/gerar-criativos.mjs`
- Test: `coletor/gerar-criativos-itens.test.mjs` (estende)

**Interfaces:**
- Produces: `export function linhaCriativoProduto({ campanhaId, cand, v, url, legenda })` → objeto-linha do insert em `fabrica_criativos`, agora com `sku: cand.sku`. Consumido pelo loop de produto do `run()`.

- [ ] **Step 1: Cria a migration**

Create `db/migrations/029_fabrica_criativos_sku.sql`:

```sql
-- Curadoria por loja: o criativo precisa carregar o SKU (a loja é derivada no front
-- por job.params.itens x fabrica_lojas). Arte é 1 por SKU (dedup entre lojas), então
-- só o SKU vira coluna; a loja NÃO. Nullable: rows antigas ficam null (seção "Outros").
alter table fabrica_criativos add column if not exists sku text;
```

- [ ] **Step 2: Escreve o teste do builder de linha (falha — função não existe)**

Em `coletor/gerar-criativos-itens.test.mjs`, adiciona no topo `import { linhaCriativoProduto } from './gerar-criativos.mjs';` e no fim:

```js
test('linhaCriativoProduto inclui o sku do candidato', () => {
  const row = linhaCriativoProduto({
    campanhaId: 'c1',
    cand: { sku: 'LV1159-Panacota' },
    v: { template: 'produto-heroi', formato: '1080x1350', variante: 'produto-heroi-avista', preco_de: 449.9, preco_por: 359.92 },
    url: 'https://x/y.png',
    legenda: 'compre',
  });
  assert.equal(row.sku, 'LV1159-Panacota');
  assert.equal(row.campanha_id, 'c1');
  assert.equal(row.template, 'produto-heroi');
  assert.equal(row.storage_path, undefined); // storage_path é montado no run(), não aqui
});
```

- [ ] **Step 3: Roda — deve falhar**

Run: `cd coletor && node --test gerar-criativos-itens.test.mjs`
Expected: FAIL ("linhaCriativoProduto is not a function").

- [ ] **Step 4: Extrai `linhaCriativoProduto` e usa no loop de produto**

Em `coletor/gerar-criativos.mjs`, adiciona a função pura (perto de `candsDeItens`):

```js
// Monta a linha de fabrica_criativos de um criativo de produto. Pura (sem I/O) p/ teste.
// storage_path/url são acrescentados no run() (dependem do upload).
export function linhaCriativoProduto({ campanhaId, cand, v, url, storagePath, legenda }) {
  return {
    campanha_id: campanhaId, sku: cand.sku, arquetipo: 'produto',
    template: v.template, formato: v.formato, variante: v.variante,
    preco_de: v.preco_de, preco_por: v.preco_por,
    storage_path: storagePath, url, legenda: legenda || null,
  };
}
```

No loop de produto do `run()`, troca o `await sbPost('/fabrica_criativos', [{ ...campos... }], 'return=minimal')` por:

```js
await sbPost('/fabrica_criativos', [linhaCriativoProduto({
  campanhaId, cand, v, url, storagePath: path, legenda: copyInfo.legenda,
})], 'return=minimal');
```

(O bloco de promo continua como está — promo não tem SKU; `sku` fica null por omissão.)

- [ ] **Step 5: Roda o teste — deve passar**

Run: `cd coletor && node --test gerar-criativos-itens.test.mjs`
Expected: PASS.

- [ ] **Step 6: Aplica a migration (no ambiente com acesso ao banco)**

Via MCP Supabase `apply_migration` (name `fabrica_criativos_sku`, o SQL do Step 1) OU
`cd coletor && node run-migrations.mjs`. Confirma: `select column_name from information_schema.columns where table_name='fabrica_criativos' and column_name='sku';` retorna 1 linha.

- [ ] **Step 7: Suite + commit**

```bash
cd coletor && node --test 'lib/*.test.mjs' '*.test.mjs'
git add db/migrations/029_fabrica_criativos_sku.sql coletor/gerar-criativos.mjs coletor/gerar-criativos-itens.test.mjs
git commit -m "feat(fabrica): grava sku no criativo (migration 029) p/ curadoria por loja"
```

---

## Task 4: Função pura de agrupamento do Curar

**Files:**
- Create: `src/ferramentas/meta-ads/curar-agrupar.js`
- Create: `src/ferramentas/meta-ads/curar-agrupar.test.mjs`

**Interfaces:**
- Produces: `export function agruparPorLojaEPares(criativos, itens, lojas)` →
  `[{ loja: string, pares: [{ sku, variante, feed: criativo|null, story: criativo|null }] }]`.
  `criativos`: `{id,url,sku,variante,formato,escolhido,purgado_em}`. `itens`: `{sku,deposito,pct}`
  (de `job.params.itens`). `lojas`: `{deposito_id,nome}` (de `fabrica_lojas`). SKU em 2 lojas
  aparece nas 2 seções; `sku` null ou sem match → seção `'Outros'`. Pareia por `variante`:
  feed=`1080x1350`, story=`1080x1920`.

- [ ] **Step 1: Escreve os testes (falha — módulo não existe)**

Create `src/ferramentas/meta-ads/curar-agrupar.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorLojaEPares } from './curar-agrupar.js';

const lojas = [{ deposito_id: 'dT', nome: 'Tivoli' }, { deposito_id: 'dP', nome: 'Dom Pedro' }];
const cri = (id, sku, variante, formato) => ({ id, url: id + '.png', sku, variante, formato, escolhido: false, purgado_em: null });

test('agrupa por loja e pareia feed/story por variante', () => {
  const criativos = [
    cri('1', 'LV1', 'produto-heroi-avista', '1080x1350'),
    cri('2', 'LV1', 'produto-heroi-avista', '1080x1920'),
  ];
  const itens = [{ sku: 'LV1', deposito: 'dT', pct: 20 }];
  const r = agruparPorLojaEPares(criativos, itens, lojas);
  assert.equal(r.length, 1);
  assert.equal(r[0].loja, 'Tivoli');
  assert.equal(r[0].pares.length, 1);
  assert.equal(r[0].pares[0].feed.id, '1');
  assert.equal(r[0].pares[0].story.id, '2');
});

test('SKU em 2 lojas aparece nas 2 seções', () => {
  const criativos = [cri('1', 'LV1', 'v', '1080x1350')];
  const itens = [{ sku: 'LV1', deposito: 'dT' }, { sku: 'LV1', deposito: 'dP' }];
  const r = agruparPorLojaEPares(criativos, itens, lojas);
  assert.deepEqual(r.map((s) => s.loja).sort(), ['Dom Pedro', 'Tivoli']);
});

test('sku null ou sem match vai pra Outros', () => {
  const criativos = [cri('1', null, 'v', '1080x1350'), cri('2', 'ZZZ', 'v', '1080x1350')];
  const r = agruparPorLojaEPares(criativos, [{ sku: 'LV1', deposito: 'dT' }], lojas);
  const outros = r.find((s) => s.loja === 'Outros');
  assert.ok(outros);
  assert.equal(outros.pares.length, 2);
});
```

- [ ] **Step 2: Roda — deve falhar**

Run: `node --test src/ferramentas/meta-ads/curar-agrupar.test.mjs`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementa a função pura**

Create `src/ferramentas/meta-ads/curar-agrupar.js`:

```js
// Agrupa os criativos do Curar em seções por loja, com pares feed/story por look.
// Arte é 1 por SKU (dedup entre lojas): a loja vem de itens (SKU->depósito) x lojas
// (depósito->nome). SKU em 2 lojas aparece nas 2 seções. Pura (sem I/O), testável.
const FEED = '1080x1350';
const STORY = '1080x1920';

export function agruparPorLojaEPares(criativos, itens, lojas) {
  const nomePorDeposito = Object.fromEntries((lojas || []).map((l) => [l.deposito_id, l.nome]));
  // SKU -> conjunto de nomes de loja (via depósitos dos itens)
  const lojasPorSku = {};
  for (const it of itens || []) {
    const nome = nomePorDeposito[it.deposito];
    if (!nome) continue;
    (lojasPorSku[it.sku] = lojasPorSku[it.sku] || new Set()).add(nome);
  }
  // ordem estável das seções = ordem das lojas + "Outros" no fim
  const ordem = (lojas || []).map((l) => l.nome);
  const secoes = new Map(); // nomeLoja -> Map(chavePar -> par)
  const garante = (nome) => { if (!secoes.has(nome)) secoes.set(nome, new Map()); return secoes.get(nome); };
  const chave = (sku, variante) => `${sku}|${variante}`;

  for (const c of criativos || []) {
    const destinos = (c.sku && lojasPorSku[c.sku] && lojasPorSku[c.sku].size)
      ? [...lojasPorSku[c.sku]] : ['Outros'];
    for (const nome of destinos) {
      const mapa = garante(nome);
      const k = chave(c.sku, c.variante);
      const par = mapa.get(k) || { sku: c.sku, variante: c.variante, feed: null, story: null };
      if (c.formato === FEED) par.feed = c;
      else if (c.formato === STORY) par.story = c;
      else par.feed = par.feed || c; // formato inesperado cai no slot feed
      mapa.set(k, par);
    }
  }

  const nomesOrdenados = [...ordem.filter((n) => secoes.has(n)),
    ...[...secoes.keys()].filter((n) => n !== 'Outros' && !ordem.includes(n)),
    ...(secoes.has('Outros') ? ['Outros'] : [])];
  return nomesOrdenados.map((loja) => ({ loja, pares: [...secoes.get(loja).values()] }));
}
```

- [ ] **Step 4: Roda os testes — devem passar**

Run: `node --test src/ferramentas/meta-ads/curar-agrupar.test.mjs`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/meta-ads/curar-agrupar.js src/ferramentas/meta-ads/curar-agrupar.test.mjs
git commit -m "feat(fabrica): funcao pura de agrupamento do Curar (por loja + pares feed/story)"
```

---

## Task 5: painel-curar.vue — seções por loja + pares

**Files:**
- Modify: `src/ferramentas/meta-ads/painel-curar.vue`

**Interfaces:**
- Consumes: `agruparPorLojaEPares` (Task 4); `sku` em `fabrica_criativos` (Task 3).

- [ ] **Step 1: Carrega sku/variante + itens da campanha + lojas**

Em `<script setup>` de `painel-curar.vue`, importa a função e amplia o `carregar()`:

```js
import { agruparPorLojaEPares } from './curar-agrupar.js'
const itensCampanha = ref([])
const lojas = ref([])

async function carregar() {
  if (!props.campanhaId) return
  itens.value = await sb(`fabrica_criativos?select=id,url,sku,variante,arquetipo,formato,escolhido,purgado_em&campanha_id=eq.${props.campanhaId}&order=created_at`)
  if (!lojas.value.length) lojas.value = await sb(`fabrica_lojas?select=deposito_id,nome&order=ordem`)
  if (!itensCampanha.value.length) {
    const camp = await sb(`fabrica_campanhas?select=job_id&id=eq.${props.campanhaId}`)
    const jobId = camp[0]?.job_id
    if (jobId) {
      const jobs = await sb(`fabrica_jobs?select=params&id=eq.${jobId}`)
      itensCampanha.value = jobs[0]?.params?.itens || []
    }
  }
}
```

- [ ] **Step 2: Computed das seções (só visíveis, não purgados)**

```js
const secoes = computed(() =>
  agruparPorLojaEPares(itens.value.filter((i) => !i.purgado_em), itensCampanha.value, lojas.value))
```

- [ ] **Step 3: Estado de colapso por seção**

```js
const colapsadas = ref({})
function alternarSecao(loja) { colapsadas.value[loja] = !colapsadas.value[loja] }
```

- [ ] **Step 4: Template — renderiza seções colapsáveis com pares**

Substitui o `<div v-if="itens.length" class="cg">…</div>` por:

```html
<div v-if="itens.length" class="curagrid">
  <section v-for="sec in secoes" :key="sec.loja" class="loja-sec">
    <button class="loja-head" @click="alternarSecao(sec.loja)">
      <span class="chev">{{ colapsadas[sec.loja] ? '▸' : '▾' }}</span>
      🏬 {{ sec.loja }} <span class="loja-n">{{ sec.pares.length }} looks</span>
    </button>
    <div v-show="!colapsadas[sec.loja]" class="cg">
      <template v-for="par in sec.pares" :key="par.sku + par.variante">
        <div v-for="prop in [['feed', par.feed], ['story', par.story]].filter(p => p[1])" :key="prop[0]"
             class="tile" :class="{ ok: prop[1].escolhido, subido: prop[1].purgado_em }">
          <img v-if="!prop[1].purgado_em" class="art" :src="prop[1].url" loading="lazy" @click="abrirVisor(prop[1])">
          <div v-else class="art placeholder">subido — ver no Gerenciador</div>
          <label v-if="!prop[1].purgado_em" class="pick" @click.stop>
            <input type="checkbox" :checked="prop[1].escolhido" @change="alternar(prop[1])">
          </label>
          <span class="cap">{{ prop[0] === 'feed' ? 'Feed 4:5' : 'Story 9:16' }} · {{ par.variante }}</span>
        </div>
      </template>
    </div>
  </section>
</div>
```

(Mantém `alternar`, `alternarTodos`, `visor`, o lightbox e o `readout` como estão.)

- [ ] **Step 5: CSS das seções (prefixo único p/ não colidir com globais)**

No `<style scoped>` (ou onde os estilos do painel vivem), adiciona:

```css
.loja-sec { margin-bottom: 18px; }
.loja-head { display:flex; align-items:center; gap:10px; width:100%; background:transparent; border:0; color:inherit; font-weight:700; font-size:15px; padding:8px 4px; cursor:pointer; text-align:left; }
.loja-head .chev { opacity:.7; }
.loja-head .loja-n { opacity:.55; font-weight:500; font-size:13px; margin-left:auto; }
```

(Reusa `.cg`/`.tile`/`.art`/`.pick`/`.cap` já existentes p/ os cards.)

- [ ] **Step 6: Smoke manual (build + tela real)**

Run: `npm run build` (raiz) — build limpo.
Depois, com uma campanha real gerada (SKUs em 2 depósitos), abre `/fabrica-estudio/:id` no passo Curar e confirma: seções 🏬 por loja, colapso, SKU em 2 lojas nas 2 seções, feed+story lado a lado por look, marcar/desmarcar salva.

- [ ] **Step 7: Commit**

```bash
git add src/ferramentas/meta-ads/painel-curar.vue
git commit -m "feat(fabrica): Curar em secoes por loja com pares feed/story"
```

---

## Notas de execução / deploy

- Ordem de merge: como o runner roda da `main`, mergear P1/P2/P3 na main ANTES de qualquer nova geração. Migration 029 aplicada via MCP.
- Validação end-to-end (depois do merge): disparar UMA geração pequena (2 SKUs claros em depósitos diferentes) e conferir no Curar (seções + pares) e nos PNGs (recorte do corpo claro íntegro, conteúdo dentro do safe-area).
- Limpar a campanha de validação ao final (fabrica-apagar / storage).
