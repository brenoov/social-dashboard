# Régua explicada + meta por objetivo — Fase 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o dono definir **quanto aceita pagar por cada resultado** — por lead, por conversa, por compra, por visita, por mil impressões e por ponto de engajamento — numa aba que primeiro **explica** o que é aquilo.

**Architecture:** Toda meta vira "custo por resultado, menor é melhor". Um módulo puro (`alvos.js`) diz, para cada tipo de campanha, qual é o resultado que conta e como se chama; a conta em si já existe no catálogo de métricas da tela (`custo_lead`, `custo_conversa`, `cac`, `custo_visita`, `cpm`) e a de engajamento vem da métrica ponderada. Com isso a ponderada deixa de ser um caso especial: é o alvo do balde de engajamento, e nada mais.

**Tech Stack:** Vue 3 + Vite, Supabase (PostgREST + RLS), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-28-meta-ads-metrica-ponderada-design.md`, seção "REVISÃO DE RUMO — 2026-07-28".

## Global Constraints

- **Idioma:** nomes e textos em **português literal**, sem jargão — quem lê é o dono do negócio, não um programador.
- **Módulos puros não fazem I/O:** sem `fetch`, sem `document`, sem Supabase.
- **Testes:** `npm run test:ci` está em **289 passando / 0 falhando** e não pode regredir.
- **Nunca inventar número:** sem resultado no período (zero leads, zero conversas), a conta é indefinida → `sem-dados` → o veredito cai na leitura de saúde. Nunca "R$ 0,00".
- **Toda meta é "menor é melhor".** Não entra ROAS (maior é melhor) — para vendas usa-se **CAC**, que é custo. Isso é o que permite um semáforo só.
- **Não reimplementar conta que já existe:** `GT_METRIC_CATALOG` já calcula os custos por resultado. Reusar.
- **Escrita no banco** por `sbClient`, leitura por `sb()` — que **nunca lança**: devolve `[]` com `.erro` (e uma negação de RLS devolve `200 + []` sem erro nenhum).
- **CSS** com prefixo `.pnd-`.

---

### Task 1: Limiares saem da tela e viram constante

**Files:**
- Modify: `src/ferramentas/gestao-trafego/painel-regua.js`
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (CSS não usado)

**Interfaces:**
- Produces: o painel deixa de renderizar o cartão "Quando cada cor acende" e `reguaDaTela()` devolve os limiares **como vieram**, sem lê-los de campo nenhum.

**Por quê:** foi a decisão do dono (opção B). Os multiplicadores 0,8 / 1,0 / 1,3 são o item mais abstrato da tela e o menos útil no dia a dia — ninguém calibra semáforo antes de entender a régua. Eles continuam existindo no banco e no cálculo; só somem da interface.

- [ ] **Step 1: Tirar o cartão dos limiares**

Em `painel-regua.js`, remover do `innerHTML` o bloco inteiro do cartão "Quando cada cor acende" e a constante `linhasLimiar` que o alimenta. Manter `ROTULO_LIMIAR` **apagado também** se não sobrar uso (conferir com grep antes).

- [ ] **Step 2: `reguaDaTela` para de ler limiares da tela**

Trocar a linha que monta `limiares` lendo campos por:

```js
    // Os limiares saíram da tela (decisão do dono, 2026-07-28): continuam valendo
    // no cálculo e no banco, mas não são mais editáveis aqui. Devolver os que já
    // estavam evita que salvar apague o que existe.
    const limiares = { ...regua.limiares };
```

- [ ] **Step 3: Conferir que não sobrou referência**

Run: `grep -n "pnd-limiar\|linhasLimiar\|ROTULO_LIMIAR" src/ferramentas/gestao-trafego/painel-regua.js`
Expected: nenhuma saída.

- [ ] **Step 4: Build e testes**

Run: `npm run build` → sucesso.
Run: `npm run test:ci` → 289 passando, 0 falhando.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/painel-regua.js src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "fix(régua): limiares saem da tela e ficam fixos"
```

---

### Task 2: Módulo puro dos alvos por objetivo

**Files:**
- Create: `src/ferramentas/gestao-trafego/alvos.js`
- Test: `src/ferramentas/gestao-trafego/alvos.test.mjs`

**Interfaces:**
- Consumes: `faixaDoIndice` de `./ponderada.js` (Task 3 exporta; escreva esta primeiro assumindo a assinatura abaixo — as duas tarefas se encontram no fim).
- Produces:
  - `ALVOS` — objeto por balde: `{metrica, rotulo, unidade, ajuda}`
  - `alvoDoBalde(balde) -> {metrica, rotulo, unidade, ajuda} | null`
  - `avaliarAlvo({custo, meta, limiares}) -> {indice, faixa}`

- [ ] **Step 1: Write the failing test**

Create `src/ferramentas/gestao-trafego/alvos.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALVOS, alvoDoBalde, avaliarAlvo } from './alvos.js';

test('cada tipo de campanha tem alvo na unidade dele', () => {
  assert.equal(ALVOS.leads.metrica, 'custo_lead');
  assert.equal(ALVOS.mensagens.metrica, 'custo_conversa');
  assert.equal(ALVOS.vendas.metrica, 'cac');
  assert.equal(ALVOS.trafego.metrica, 'custo_visita');
  assert.equal(ALVOS.reconhecimento.metrica, 'cpm');
  assert.equal(ALVOS.engajamento.metrica, 'ponderada', 'engajamento usa a métrica ponderada');
});

test('todo alvo tem rótulo e unidade em português para a tela', () => {
  for (const [balde, a] of Object.entries(ALVOS)) {
    assert.ok(a.rotulo && a.rotulo.length > 3, balde + ' sem rótulo');
    assert.ok(a.unidade, balde + ' sem unidade');
    assert.ok(a.ajuda && a.ajuda.length > 10, balde + ' sem explicação');
  }
});

test('alvoDoBalde devolve null para balde sem alvo (nao inventa)', () => {
  assert.equal(alvoDoBalde('padrao'), null);
  assert.equal(alvoDoBalde('balde-que-nao-existe'), null);
  assert.equal(alvoDoBalde(undefined), null);
});

test('avaliarAlvo compara custo com meta e devolve a faixa', () => {
  const lim = { escalarForte: 0.8, dentroMeta: 1.0, manter: 1.3 };
  assert.equal(avaliarAlvo({ custo: 8, meta: 10, limiares: lim }).faixa, 'escalar-forte');
  assert.equal(avaliarAlvo({ custo: 10, meta: 10, limiares: lim }).faixa, 'dentro-da-meta');
  assert.equal(avaliarAlvo({ custo: 13, meta: 10, limiares: lim }).faixa, 'manter');
  assert.equal(avaliarAlvo({ custo: 14, meta: 10, limiares: lim }).faixa, 'otimizar');
  assert.equal(avaliarAlvo({ custo: 8, meta: 10, limiares: lim }).indice, 0.8);
});

test('sem custo ou sem meta e SEM-DADOS, nunca um palpite', () => {
  const lim = { escalarForte: 0.8, dentroMeta: 1.0, manter: 1.3 };
  assert.equal(avaliarAlvo({ custo: null, meta: 10, limiares: lim }).faixa, 'sem-dados');
  assert.equal(avaliarAlvo({ custo: 5, meta: 0, limiares: lim }).faixa, 'sem-dados');
  assert.equal(avaliarAlvo({ custo: 5, meta: null, limiares: lim }).faixa, 'sem-dados');
  assert.equal(avaliarAlvo({}).faixa, 'sem-dados');
  assert.equal(avaliarAlvo({ custo: null, meta: 10, limiares: lim }).indice, null);
});

test('custo zero e resultado valido (de graca), nao ausencia', () => {
  const lim = { escalarForte: 0.8, dentroMeta: 1.0, manter: 1.3 };
  const r = avaliarAlvo({ custo: 0, meta: 10, limiares: lim });
  assert.equal(r.indice, 0);
  assert.equal(r.faixa, 'escalar-forte');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci 2>&1 | grep -A3 alvos`
Expected: FAIL — `Cannot find module './alvos.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/ferramentas/gestao-trafego/alvos.js`:

```js
// O ALVO de cada tipo de campanha: quanto o dono aceita pagar por um resultado,
// na unidade que faz sentido para aquele objetivo.
//
// A regra que amarra tudo: TODA meta aqui é "custo por resultado, MENOR É MELHOR".
// É isso que permite um semáforo só para a ferramenta inteira. Por isso vendas usa
// CAC (custo por compra) e não ROAS — ROAS é maior-é-melhor e precisaria de uma
// régua invertida, uma segunda régua para manter na cabeça.
//
// Engajamento é o único cujo "resultado" não é uma ação da Meta e sim o PONTO da
// métrica ponderada. Ou seja: a ponderada não é um bicho à parte, é o alvo deste
// balde. PURO: sem rede, sem tela.
import { faixaDoIndice } from './ponderada.js';

export const ALVOS = {
  engajamento: {
    metrica: 'ponderada', rotulo: 'Custo por ponto', unidade: 'R$',
    ajuda: 'Ponto é a nota que damos a cada interação conforme o quanto ela vale: curtir vale 1, salvar vale 30.',
  },
  reconhecimento: {
    metrica: 'cpm', rotulo: 'Custo por mil pessoas alcançadas', unidade: 'R$',
    ajuda: 'Campanha de reconhecimento existe para aparecer. O preço justo é por mil impressões.',
  },
  trafego: {
    metrica: 'custo_visita', rotulo: 'Custo por visita', unidade: 'R$',
    ajuda: 'Quanto você aceita pagar por cada pessoa que realmente chegou no destino.',
  },
  mensagens: {
    metrica: 'custo_conversa', rotulo: 'Custo por conversa iniciada', unidade: 'R$',
    ajuda: 'Cada conversa de WhatsApp aberta. É o resultado que essa campanha compra.',
  },
  leads: {
    metrica: 'custo_lead', rotulo: 'Custo por lead', unidade: 'R$',
    ajuda: 'Quanto você aceita pagar por cadastro recebido.',
  },
  vendas: {
    metrica: 'cac', rotulo: 'Custo por venda', unidade: 'R$',
    ajuda: 'Quanto custa trazer uma venda. Usamos custo por venda (e não ROAS) para toda a ferramenta ter uma régua só.',
  },
};

// Sem alvo definido devolve null — e null faz o veredito cair na leitura de saúde
// daquele objetivo, que é melhor do que inventar um alvo qualquer.
export function alvoDoBalde(balde) {
  return (balde && ALVOS[balde]) || null;
}

export function avaliarAlvo(entrada) {
  const e = entrada || {};
  const custo = Number(e.custo);
  const meta = Number(e.meta);
  const temCusto = e.custo != null && Number.isFinite(custo) && custo >= 0;
  const temMeta = Number.isFinite(meta) && meta > 0;
  const indice = (temCusto && temMeta) ? custo / meta : null;
  return { indice, faixa: faixaDoIndice(indice, e.limiares) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci 2>&1 | tail -6`
Expected: 295 passando, 0 falhando (289 + 6 novos). Se falhar por `faixaDoIndice` não existir, faça a Task 3 e volte.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/alvos.js src/ferramentas/gestao-trafego/alvos.test.mjs
git commit -m "feat(alvos): módulo puro do alvo de cada tipo de campanha"
```

---

### Task 3: `faixaDoIndice` vira exportação reusável

**Files:**
- Modify: `src/ferramentas/gestao-trafego/ponderada.js`
- Modify: `src/ferramentas/gestao-trafego/ponderada.test.mjs`

**Interfaces:**
- Produces: `faixaDoIndice(indice, limiares) -> 'escalar-forte'|'dentro-da-meta'|'manter'|'otimizar'|'sem-dados'`, com `limiares` opcional (cai no padrão).

**Por quê:** hoje essa função é privada de `ponderada.js`. A Task 2 precisa dela para que **todos os baldes usem exatamente o mesmo semáforo** — se a regra for copiada, uma futura mudança valeria só para metade da ferramenta.

- [ ] **Step 1: Write the failing test**

Acrescentar a `ponderada.test.mjs`:

```js
test('faixaDoIndice é exportada e usa os limiares padrão quando não vierem', () => {
  assert.equal(faixaDoIndice(0.5), 'escalar-forte');
  assert.equal(faixaDoIndice(1.0), 'dentro-da-meta');
  assert.equal(faixaDoIndice(1.2), 'manter');
  assert.equal(faixaDoIndice(2), 'otimizar');
  assert.equal(faixaDoIndice(null), 'sem-dados');
});

test('faixaDoIndice respeita limiares customizados', () => {
  assert.equal(faixaDoIndice(0.9, { escalarForte: 0.95, dentroMeta: 1, manter: 1.1 }), 'escalar-forte');
});
```

E incluir `faixaDoIndice` no `import` do topo do arquivo de teste.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci 2>&1 | grep -A3 faixaDoIndice`
Expected: FAIL — `faixaDoIndice is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `ponderada.js`, trocar a assinatura da função privada por uma exportada com limiares opcionais:

```js
// Exportada porque TODOS os baldes usam este mesmo semáforo (ver alvos.js).
// Copiar a regra em outro arquivo faria uma mudança futura valer só pra metade
// da ferramenta.
export function faixaDoIndice(indice, limiares) {
  const l = { ...LIMIARES_PADRAO, ...(limiares || {}) };
  if (indice == null) return 'sem-dados';
  if (indice <= l.escalarForte) return 'escalar-forte';
  if (indice <= l.dentroMeta) return 'dentro-da-meta';
  if (indice <= l.manter) return 'manter';
  return 'otimizar';
}
```

E ajustar a chamada dentro de `calcularPonderada` para passar os limiares já resolvidos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci 2>&1 | tail -6`
Expected: 297 passando, 0 falhando.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/ponderada.js src/ferramentas/gestao-trafego/ponderada.test.mjs
git commit -m "refactor(ponderada): faixaDoIndice exportada para todos os baldes usarem o mesmo semáforo"
```

---

### Task 4: Metas dos outros objetivos no banco

**Files:**
- Create: `supabase/migrations/20260728_alvos_por_objetivo.sql`

**Contexto:** a coluna `metas` já existe e hoje guarda só `engajamento` e `reconhecimento`. Passa a guardar um número por balde, **cada um na unidade do seu alvo** (ver `alvos.js`). Aplicar em produção é do controlador, não do subagente.

- [ ] **Step 1: Escrever a migration**

**MEDIDO ANTES DE ESCREVER (2026-07-28, 90 dias, contas reais).** Só três tipos de
campanha têm resultado de verdade na conta do dono; os outros três não têm dado
NENHUM e por isso **não recebem meta** — dar meta a eles seria repetir o erro que a
revisão da Fase 1 pegou (inventar número para o que não existe).

| Tipo | Campanhas | Investido 90d | Custo mediano | Custo do conjunto | Meta |
|---|---|---|---|---|---|
| Mensagens | 22 | R$ 56.816 | R$ 18,75/conversa | R$ 16,21 | **R$ 15,00** |
| Tráfego | 33 | R$ 10.398 | R$ 0,28/visita | R$ 0,28 | **R$ 0,25** |
| Engajamento | 13 | — | R$ 0,16/ponto | — | **R$ 0,15** (já está) |
| Leads | — | — | nenhum lead registrado em 90d | — | **sem meta** |
| Vendas | — | — | nenhuma compra registrada | — | **sem meta** |
| Reconhecimento | — | — | não roda esse tipo | — | **sem meta** |

Critério dos três números: um pouco ABAIXO do que ele paga hoje na média. Assim a
meta quer dizer "melhor que a minha média atual" — metade bate, metade não. Na média
exata seria só um espelho; muito abaixo, tudo vermelho no primeiro dia.

Create `supabase/migrations/20260728_alvos_por_objetivo.sql`:

```sql
-- Meta por OBJETIVO, cada uma na unidade do resultado daquele objetivo.
-- Antes só engajamento tinha meta, e os limiares dos demais objetivos viviam
-- chumbados no código (GT_CRIT) — o dono podia definir o preço da curtida e NÃO o
-- preço da conversa de WhatsApp, que é onde estão R$ 56 mil dos R$ 67 mil gastos.
--
-- ATENÇÃO À UNIDADE: cada chave está numa unidade diferente, definida em
-- src/ferramentas/gestao-trafego/alvos.js. NÃO são comparáveis entre si.
--   engajamento -> R$ por PONTO da métrica ponderada
--   trafego     -> R$ por VISITA
--   mensagens   -> R$ por CONVERSA iniciada
--
-- POR QUE leads, vendas e reconhecimento NÃO entram: foi medido em 90 dias e não
-- existe UM lead registrado, UMA compra registrada, nem UMA campanha de
-- reconhecimento. Meta para resultado que a conta não produz é número inventado:
-- o custo fica indefinido, a meta nunca vale, e sobra confusão na tela. Sem meta,
-- o veredito cai na leitura de saúde daquele objetivo — que é o certo. O dono
-- preenche na aba da régua quando começar a rodar esse tipo.
update public.gt_ponderada_config
set metas = jsonb_build_object('engajamento', 0.15, 'trafego', 0.25, 'mensagens', 15.00),
    updated_at = now()
where id = 1;

select metas from public.gt_ponderada_config where id = 1;
```

- [ ] **Step 2: Commit (o controlador aplica em produção)**

```bash
git add supabase/migrations/20260728_alvos_por_objetivo.sql
git commit -m "feat(alvos): metas dos demais objetivos, cada uma na unidade dele"
```

---

### Task 5: A régua vira "quanto pagar por cada resultado" e ganha abertura

**Files:**
- Modify: `src/ferramentas/gestao-trafego/painel-regua.js`
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (CSS da abertura)

**Interfaces:**
- Consumes: `ALVOS` (Task 2).
- Produces: a aba passa a ter **dois** cartões — "Quanto vale cada interação" (pesos) e "Quanto você aceita pagar por resultado" (uma linha por objetivo) — mais um texto de abertura.

**Por quê:** o dono disse que não entendeu. A aba jogava nove campos antes de explicar o conceito, e o único objetivo com meta era o que menos move dinheiro.

- [ ] **Step 1: Texto de abertura**

No topo do `innerHTML` do painel, antes de `.pnd-regua`, inserir:

```html
      <div class="pnd-intro">
        <h2 class="pnd-intro-tit">O que é esta aba</h2>
        <p>Aqui você diz <b>quanto aceita pagar por cada resultado</b>. É esse número que faz o cartão da campanha acender verde, amarelo ou vermelho lá na aba Campanhas.</p>
        <p>Cada tipo de campanha é medido pelo resultado que ele realmente compra: campanha de lead pelo <b>custo por lead</b>, de WhatsApp pelo <b>custo por conversa</b>, de venda pelo <b>custo por venda</b>.</p>
        <p>A exceção é <b>engajamento</b>, que não compra uma ação só. Aí somamos as interações dando peso a cada uma — curtir vale 1, salvar vale 30, porque quem salva quer voltar naquilo. A soma chama-se <b>ponto</b>, e a meta é o preço do ponto.</p>
      </div>
```

- [ ] **Step 2: Uma linha por objetivo, na unidade dele**

Trocar a construção de `linhasMeta` por uma que percorre `ALVOS`:

```js
  // Uma linha por objetivo, cada uma na unidade do resultado dele (ver alvos.js).
  const linhasMeta = Object.keys(ALVOS).map((b) => {
    const a = ALVOS[b];
    const valor = regua.metas[b] != null ? regua.metas[b] : '';
    return `<tr>
      <td><div class="pnd-alvo-nome">${esc(ROTULO_BALDE[b] || b)}</div><div class="pnd-alvo-ajuda">${esc(a.rotulo)} — ${esc(a.ajuda)}</div></td>
      <td>${campo('pnd-meta-' + b, valor, '0.01', editavel, 'dinheiro')}</td>
    </tr>`;
  }).join('');
```

Objetivo SEM meta salva (leads, vendas, reconhecimento hoje) mostra o campo vazio com a explicação `ainda sem histórico — defina quando começar a rodar esse tipo`. NÃO preencher com número de exemplo: campo vazio é honesto, número inventado não.

- [ ] **Step 3: `reguaDaTela` percorre os alvos**

Trocar o laço que lê as metas para percorrer `Object.keys(ALVOS)` em vez de `ROTULO_BALDE` — assim a leitura e a escrita falam da mesma lista.

- [ ] **Step 4: CSS**

Acrescentar ao `<style scoped>` da tela:

```css
.tela-gestao-trafego :deep(.pnd-intro){background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:14px;padding:16px 20px;margin-bottom:18px;max-width:760px;}
.tela-gestao-trafego :deep(.pnd-intro-tit){font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;color:var(--text);margin:0 0 8px;}
.tela-gestao-trafego :deep(.pnd-intro p){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);line-height:1.6;margin:0 0 7px;}
.tela-gestao-trafego :deep(.pnd-intro p:last-child){margin-bottom:0;}
.tela-gestao-trafego :deep(.pnd-alvo-nome){font-weight:600;}
.tela-gestao-trafego :deep(.pnd-alvo-ajuda){font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--muted);line-height:1.45;margin-top:3px;max-width:44ch;}
```

- [ ] **Step 5: Build, testes e commit**

Run: `npm run build` → sucesso. Run: `npm run test:ci` → 297 passando, 0 falhando.

```bash
git add src/ferramentas/gestao-trafego/painel-regua.js src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(régua): explica o conceito e passa a ter meta por objetivo"
```

---

### Task 6: O cartão usa o alvo do objetivo

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: `alvoDoBalde`, `avaliarAlvo` (Task 2); `_gtMetricValue` e `GT_METRIC_CATALOG`, que já existem na tela.

**Por quê:** hoje só campanha de engajamento tem veredito por meta. Depois desta tarefa, uma campanha de lead com custo por lead acima do que o dono aceita paga acende amarelo/vermelho — o que era o pedido original.

- [ ] **Step 1: Calcular o custo do objetivo**

Onde hoje se calcula `metaPnd`/`pnd` no cartão, generalizar: continuar calculando a ponderada (ela alimenta o KPI "Custo/ponto", que aparece sempre), e **além disso** calcular o alvo do balde:

```js
      // ALVO DO OBJETIVO: cada tipo de campanha é medido pelo resultado que ele
      // compra (lead, conversa, venda, visita, mil impressões) — e engajamento
      // pelo ponto da ponderada. A conta de cada um já existe no catálogo.
      const baldeCamp = _gtBalde(kpiObjective);
      const alvo = temMensagem ? alvoDoBalde('mensagens') : alvoDoBalde(baldeCamp);
      const metaAlvo = metaDoBalde(_gtRegua, temMensagem ? 'mensagens' : baldeCamp);
      const custoAlvo = !alvo ? null
        : alvo.metrica === 'ponderada' ? pnd.custoPorPonto
        : _gtMetricValue(alvo.metrica, ins);
      const aval = avaliarAlvo({ custo: custoAlvo, meta: metaAlvo, limiares: _gtRegua.limiares });
```

Note que campanha com resultado de mensagem passa a ser avaliada como **mensagens** mesmo chegando com objetivo de engajamento — é a correção que já existia, agora usando o alvo certo em vez de simplesmente sair da conta.

- [ ] **Step 2: O veredito passa a usar a avaliação do alvo**

Trocar o que é passado a `decidirVeredito` de `{...pnd, meta: metaPnd}` para a avaliação do alvo, mantendo os números que a frase usa:

```js
        ponderada: { faixa: aval.faixa, custoPorPonto: custoAlvo, meta: metaAlvo },
```

- [ ] **Step 3: Build, testes e conferência na tela**

Run: `npm run build` → sucesso. Run: `npm run test:ci` → 297 passando, 0 falhando.

Conferir com dados reais que campanha de lead e de WhatsApp passaram a receber veredito por meta (e não mais "sem dados"), e que campanha sem resultado nenhum continua caindo na leitura de saúde.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue
git commit -m "feat(alvos): o veredito do cartão usa o alvo do objetivo da campanha"
```

---

### Task 7: LEIA-ME

**Files:**
- Modify: `src/ferramentas/gestao-trafego/LEIA-ME.txt`

- [ ] **Step 1: Reescrever a seção da régua**

Substituir a seção "A RÉGUA" por uma que descreva o estado atual: toda meta é custo por resultado (menor é melhor), a tabela de balde → unidade, o porquê de vendas usar custo por venda e não ROAS, o fato de a métrica ponderada ser **o alvo do balde de engajamento** e não um sistema à parte, e que os limiares saíram da tela mas continuam valendo.

- [ ] **Step 2: Commit**

```bash
git add src/ferramentas/gestao-trafego/LEIA-ME.txt
git commit -m "docs(gestão de tráfego): a régua agora é meta por objetivo"
```

---

## Autorrevisão do plano

**Cobertura:** limiares fora da tela → Task 1. Alvo por objetivo na unidade dele → Tasks 2, 4, 5, 6. Semáforo único para todos os baldes → Task 3. Texto de abertura explicando o conceito → Task 5. Documentação → Task 7.

**Consistência de nomes:** `faixaDoIndice` (Task 3) é consumida por `avaliarAlvo` (Task 2); `ALVOS`/`alvoDoBalde`/`avaliarAlvo` (Task 2) são consumidos pelas Tasks 5 e 6; `metaDoBalde` e `_gtMetricValue` já existem e não mudam de assinatura.

**Ordem:** a Task 2 depende da Task 3; quem executar deve fazer a 3 antes se o teste da 2 falhar por isso. Fica registrado no Step 4 da Task 2.

**Risco conhecido:** a Task 6 muda o veredito de **muitas** campanhas de uma vez (leads, mensagens, vendas e tráfego passam a ter veredito por meta, onde antes caíam na saúde). Os valores iniciais das metas são chute — por isso a Task 5 (o dono poder ajustar) vem antes da Task 6 no plano, e a conferência com dados reais é obrigatória antes do merge.
