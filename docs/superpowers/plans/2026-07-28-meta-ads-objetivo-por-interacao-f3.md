# Objetivo por interação — Fase 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o dono **declarar, em cada campanha e em cada anúncio de engajamento, qual interação aquilo está comprando** — curtida, comentário, salvamento ou compartilhamento — e passar a julgar pelo custo daquela interação contra uma meta própria dela.

**Architecture:** Um módulo puro (`interacoes.js`) define as quatro interações e calcula o custo de cada uma a partir das quantidades que já vêm do insight. A declaração fica numa tabela nova (`gt_objetivo_interacao`), chaveada pelo id da campanha ou do anúncio. Quem declarou é julgado pelo custo da interação declarada; quem não declarou continua no ponto ponderado, como hoje.

**Tech Stack:** Vue 3 + Vite, Supabase (PostgREST + RLS), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-28-meta-ads-metrica-ponderada-design.md`

## Por que esta fase existe

Medido nas 13 campanhas de engajamento do dono (90 dias, R$ 25.985):

| Interação | Quantidade | Custo real cada |
|---|---|---|
| Curtida | 226.105 | R$ 0,12 |
| Compartilhamento | 2.001 | R$ 13 a 21 |
| Salvamento | 506 | R$ 48 a 51 |
| Comentário | 151 | R$ 128 a 172 |

**A planilha diz que um salvamento VALE 30 curtidas. O mercado cobra 400 curtidas por ele.** Um comentário vale 10 e custa 1.300. Peso e preço são coisas diferentes — e o número ponderado, sendo 83% curtida em volume, sempre premia quem compra curtida e pinta de vermelho quem compra salvamento.

Foi o que apareceu ao medir: as campanhas mais baratas por ponto são as de qualidade 1,2 (quase só curtida); as mais caras são as de qualidade 2,3–2,8 (salvamento e compartilhamento). **Ordenar por custo por ponto é ordenar por "quem comprou mais curtida".** Cada interação é um mercado com preço próprio e precisa de meta própria.

## Global Constraints

- **Idioma:** identificadores e textos em português literal, sem jargão.
- **Módulos puros não fazem I/O.**
- **Testes:** `npm run test:ci` está em **300 passando / 0 falhando** e não pode regredir.
- **Nunca inventar número:** interação com quantidade zero → custo indefinido → `sem-dados` → cai na leitura de saúde. Nunca "R$ 0,00".
- **Só campanha/anúncio de ENGAJAMENTO** declara interação. Lead, venda, mensagem e tráfego já têm o resultado deles — não faz sentido perguntar qual interação eles compram.
- **Sem declaração, nada muda:** continua no ponto ponderado, exatamente como hoje.
- **Escrita no banco** por `sbClient`; leitura por `sb()`, que **nunca lança** (devolve `[]` com `.erro`; RLS nega com `200 + []` sem erro).
- **CSS** com prefixo `.pnd-`.

---

### Task 1: Tabela da declaração + metas por interação

**Files:**
- Create: `supabase/migrations/20260728_objetivo_por_interacao.sql`

**Contexto:** aplicar em produção é do controlador, não do subagente. O subagente escreve o arquivo e commita.

- [ ] **Step 1: Escrever a migration**

```sql
-- QUAL INTERAÇÃO cada campanha/anúncio de engajamento está comprando.
-- Declaração MANUAL do dono: a Meta não diz isso, e o mesmo formato de anúncio
-- pode ser feito pra colecionar salvamento ou pra puxar comentário.
--
-- Por que precisa existir: medido em 90 dias, curtida custa R$0,12 e salvamento
-- custa R$48 — 400 vezes mais. O ponto ponderado (83% curtida em volume) sempre
-- premia quem compra curtida. Sem declarar o alvo, campanha de salvamento é
-- julgada num mercado que não é o dela.
create table if not exists public.gt_objetivo_interacao (
  alvo_id     text primary key,                 -- id da campanha OU do anúncio na Meta
  nivel       text not null check (nivel in ('campanha','anuncio')),
  interacao   text not null check (interacao in ('curtidas','comentarios','salvamentos','compartilhamentos')),
  conta_id    uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.gt_objetivo_interacao enable row level security;

drop policy if exists objetivo_interacao_leitura on public.gt_objetivo_interacao;
create policy objetivo_interacao_leitura on public.gt_objetivo_interacao
  for select to authenticated using (true);

-- Escrita: mesma regra da régua (quem edita a ferramenta), espelhando gt_config_metricas.
drop policy if exists objetivo_interacao_escrita on public.gt_objetivo_interacao;
create policy objetivo_interacao_escrita on public.gt_objetivo_interacao
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and (p.role = 'admin' or 'meta.gestor' = any(p.features))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and (p.role = 'admin' or 'meta.gestor' = any(p.features))));

-- METAS POR INTERAÇÃO, medidas nas campanhas reais (90 dias):
--   curtida R$0,12 · compartilhamento R$13-21 · salvamento R$48-51 · comentário R$128-172
-- Critério: um pouco abaixo do praticado, pra meta querer dizer "melhor que hoje".
-- O comentário fica com dado FRACO (151 no total) — o dono decidiu manter mesmo
-- assim, ciente disso.
update public.gt_ponderada_config
set metas = metas
  || '{"curtidas":0.10,"compartilhamentos":15.00,"salvamentos":45.00,"comentarios":150.00}'::jsonb,
    updated_at = now()
where id = 1;

select metas from public.gt_ponderada_config where id = 1;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260728_objetivo_por_interacao.sql
git commit -m "feat(interações): tabela da declaração + metas por interação"
```

---

### Task 2: Módulo puro das interações

**Files:**
- Create: `src/ferramentas/gestao-trafego/interacoes.js`
- Test: `src/ferramentas/gestao-trafego/interacoes.test.mjs`

**Interfaces:**
- Produces:
  - `INTERACOES` — `{curtidas, comentarios, salvamentos, compartilhamentos}`, cada uma `{rotulo, rotuloCusto, ajuda}`
  - `interacaoValida(chave) -> boolean`
  - `custoDaInteracao(quantidades, chave) -> number | null`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERACOES, interacaoValida, custoDaInteracao } from './interacoes.js';

const q = { curtidas: 100, comentarios: 2, salvamentos: 5, compartilhamentos: 10, gasto: 200 };

test('as quatro interacoes tem rotulo proprio para a tela', () => {
  assert.deepEqual(Object.keys(INTERACOES).sort(),
    ['comentarios', 'compartilhamentos', 'curtidas', 'salvamentos']);
  for (const [k, i] of Object.entries(INTERACOES)) {
    assert.ok(i.rotulo && i.rotuloCusto && i.ajuda, k + ' incompleta');
  }
});

test('custo da interacao = gasto dividido pela quantidade dela', () => {
  assert.equal(custoDaInteracao(q, 'curtidas'), 2);
  assert.equal(custoDaInteracao(q, 'salvamentos'), 40);
  assert.equal(custoDaInteracao(q, 'compartilhamentos'), 20);
  assert.equal(custoDaInteracao(q, 'comentarios'), 100);
});

test('quantidade zero nao vira R$ 0,00 — devolve null (sem dados)', () => {
  assert.equal(custoDaInteracao({ curtidas: 0, gasto: 100 }, 'curtidas'), null);
  assert.equal(custoDaInteracao({ gasto: 100 }, 'salvamentos'), null);
});

test('interacao desconhecida nao inventa numero', () => {
  assert.equal(custoDaInteracao(q, 'republicacoes'), null);
  assert.equal(custoDaInteracao(q, undefined), null);
  assert.equal(interacaoValida('curtidas'), true);
  assert.equal(interacaoValida('republicacoes'), false);
  assert.equal(interacaoValida(null), false);
});

test('sem gasto nao ha custo', () => {
  assert.equal(custoDaInteracao({ curtidas: 10 }, 'curtidas'), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci 2>&1 | grep -A3 interacoes` → FAIL, módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```js
// As quatro interações que uma campanha de engajamento pode estar COMPRANDO, e
// quanto custa cada uma.
//
// Por que existe: medido nas campanhas reais do dono (90 dias), curtida custa
// R$ 0,12 e salvamento custa R$ 48 — 400 vezes mais. O ponto ponderado é 83%
// curtida em volume, então ordenar por custo por ponto é ordenar por "quem
// comprou mais curtida". Declarada a interação, a campanha passa a ser medida no
// mercado dela. PURO: sem rede, sem tela.
export const INTERACOES = {
  curtidas: {
    rotulo: 'Curtida', rotuloCusto: 'Custo por curtida',
    ajuda: 'A mais barata e a mais abundante. Serve para alcance e prova social.',
  },
  comentarios: {
    rotulo: 'Comentário', rotuloCusto: 'Custo por comentário',
    ajuda: 'Cara e rara: quem comenta parou para escrever alguma coisa.',
  },
  salvamentos: {
    rotulo: 'Salvamento', rotuloCusto: 'Custo por salvamento',
    ajuda: 'Quem salva pretende voltar naquilo depois. É intenção guardada.',
  },
  compartilhamentos: {
    rotulo: 'Compartilhamento', rotuloCusto: 'Custo por compartilhamento',
    ajuda: 'Quem compartilha leva sua marca para a rede dele.',
  },
};

export function interacaoValida(chave) {
  return !!chave && Object.prototype.hasOwnProperty.call(INTERACOES, chave);
}

// Custo = tudo que se gastou ÷ quantidade daquela interação. Atribuir o gasto
// INTEIRO a uma interação só faz sentido porque o dono DECLAROU que é ela que
// aquela campanha está comprando — é a mesma lógica de custo por lead.
export function custoDaInteracao(quantidades, chave) {
  if (!interacaoValida(chave)) return null;
  const q = quantidades || {};
  const n = Number(q[chave]);
  if (!Number.isFinite(n) || n <= 0) return null;   // zero não é R$ 0,00, é sem-dados
  const gasto = Number(q.gasto);
  return Number.isFinite(gasto) ? gasto / n : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci 2>&1 | tail -6` → 305 passando, 0 falhando.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/gestao-trafego/interacoes.js src/ferramentas/gestao-trafego/interacoes.test.mjs
git commit -m "feat(interações): módulo puro do custo por interação"
```

---

### Task 3: A régua ganha as metas por interação

**Files:**
- Modify: `src/ferramentas/gestao-trafego/painel-regua.js`
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue` (CSS, se precisar)

**Interfaces:**
- Consumes: `INTERACOES` (Task 2).

- [ ] **Step 1: Novo cartão na régua**

Acrescentar um terceiro cartão, depois de "Quanto você aceita pagar por resultado":

- Título: **"Quanto você aceita pagar por cada interação"**
- Ajuda: *"Só vale para campanha de engajamento em que você declarar, no cartão dela, qual interação ela está comprando. Curtida e salvamento são mercados diferentes: hoje uma curtida sai por R$ 0,12 e um salvamento por R$ 48."*
- Uma linha por interação (`INTERACOES`), com o `rotulo`, a `ajuda` embaixo em texto menor, e o campo de dinheiro (`campo(..., 'dinheiro')`), lendo/gravando `regua.metas[chave]`.

- [ ] **Step 2: `reguaDaTela` inclui as interações**

O laço que lê as metas precisa percorrer **`ALVOS` e `INTERACOES`** — as duas listas gravam na mesma `metas`. Não duplicar chave (não há sobreposição: os baldes são `engajamento/trafego/...` e as interações são `curtidas/comentarios/...`).

- [ ] **Step 3: Build e testes**

`npm run build` sucesso · `npm run test:ci` 305 passando, 0 falhando.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(interações): metas por interação na régua"
```

---

### Task 4: O selo no cartão da campanha e do anúncio

**Files:**
- Modify: `src/ferramentas/gestao-trafego/tela-de-gestao-trafego.vue`

**Interfaces:**
- Consumes: `INTERACOES`, `custoDaInteracao` (Task 2); `avaliarAlvo` (`alvos.js`); `metaDoBalde` (`regua.js`).

**Regras:**
1. O selo só aparece em campanha/anúncio cujo balde é **engajamento** (e que não seja de mensagem).
2. Estados: sem declaração → selo neutro **"Objetivo: ponderado"**; declarado → **"Objetivo: Salvamento"** etc.
3. Clicar abre um menu com as quatro interações + "Voltar ao ponderado".
4. Ao escolher, grava em `gt_objetivo_interacao` (`alvo_id`, `nivel`, `interacao`, `conta_id`, `updated_by`) e **redesenha** aquele cartão.
5. Declarado, o veredito passa a usar `custoDaInteracao(quantidades, interacao)` contra `metaDoBalde(_gtRegua, interacao)`, com o rótulo `INTERACOES[interacao].rotuloCusto`. Sem declaração, tudo segue como está.
6. A declaração é carregada uma vez por `loadGtData()` num mapa `_gtObjetivoInteracao[alvo_id] = interacao`.

- [ ] **Step 1: Carregar as declarações**

Dentro de `loadGtData()`, junto de `_gtCarregarRegua()`:

```js
async function _gtCarregarObjetivos() {
  const linhas = await sb('gt_objetivo_interacao?select=alvo_id,interacao');
  _gtObjetivoInteracao = {};
  if (linhas && !linhas.erro) for (const l of linhas) _gtObjetivoInteracao[String(l.alvo_id)] = l.interacao;
}
```

- [ ] **Step 2: Selo + menu no cartão**

Desenhar o selo junto dos chips que já existem (perto do chip CBO/ABO), com a mesma linguagem visual. O menu pode reusar o padrão de dropdown já presente na tela.

- [ ] **Step 3: Gravar a escolha**

```js
async function _gtSalvarObjetivo(alvoId, nivel, interacao) {
  const { error } = interacao
    ? await sbClient.from('gt_objetivo_interacao').upsert({
        alvo_id: String(alvoId), nivel, interacao,
        conta_id: _gtCurAcc?.id || null, updated_by: estado.userId || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'alvo_id' })
    : await sbClient.from('gt_objetivo_interacao').delete().eq('alvo_id', String(alvoId));
  if (error) { adminToast('Não consegui salvar o objetivo: ' + error.message, false); return; }
  if (interacao) _gtObjetivoInteracao[String(alvoId)] = interacao;
  else delete _gtObjetivoInteracao[String(alvoId)];
  await loadGtData();
}
```

- [ ] **Step 4: Veredito usa a interação declarada**

Onde hoje se calcula `alvo`/`metaAlvo`/`custoAlvo`, entrar antes: se o balde é engajamento e existe declaração para aquele id, então `custoAlvo = custoDaInteracao(qtdsPnd, decl)`, `metaAlvo = metaDoBalde(_gtRegua, decl)` e o rótulo é `INTERACOES[decl].rotuloCusto`.

- [ ] **Step 5: Build, testes e conferência**

`npm run build` sucesso · `npm run test:ci` 305/0. Conferir na tela: declarar salvamento numa campanha muda o número, o rótulo e a faixa; "voltar ao ponderado" desfaz.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(interações): selo de objetivo no cartão da campanha e do anúncio"
```

---

### Task 5: LEIA-ME

**Files:**
- Modify: `src/ferramentas/gestao-trafego/LEIA-ME.txt`

- [ ] **Step 1: Nova seção**

Explicar, em português para iniciante: que peso e preço são coisas diferentes (salvamento vale 30 curtidas e custa 400); que por isso cada interação tem meta própria; que o dono declara no cartão o que aquela campanha compra; e que sem declarar nada muda. Incluir a tabela de custo real medido.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(gestão de tráfego): objetivo por interação"
```

---

## Autorrevisão do plano

**Cobertura:** declaração por campanha e por anúncio → Tasks 1 e 4. Metas por interação → Tasks 1 e 3. Cálculo → Task 2. Documentação → Task 5.

**Consistência:** `INTERACOES`/`custoDaInteracao`/`interacaoValida` (Task 2) são consumidos pelas Tasks 3 e 4; as chaves da tabela (`curtidas`, `comentarios`, `salvamentos`, `compartilhamentos`) são as MESMAS de `quantidadesDoInsight` e as mesmas usadas em `metas` — é isso que permite `metaDoBalde` servir para os dois casos sem função nova.

**Risco:** `metas` passa a ter chaves de DOIS tipos — baldes de objetivo e interações. Não colidem, mas a unidade continua sendo diferente por chave. Reforçar isso no comentário da migration e no LEIA-ME.

**Fora desta fase:** sugerir automaticamente qual interação a campanha compra (dá pra inferir pelo mix, mas o dono pediu declaração manual); e a fila de aprovação, que desce para a Fase 4.
