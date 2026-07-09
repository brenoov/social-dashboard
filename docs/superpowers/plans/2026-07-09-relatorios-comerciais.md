# Relatórios Comerciais (Gestor) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps em checkbox (`- [ ]`).

**Goal:** Módulo interativo de relatórios comerciais (ABC, BCG, mais/menos vendidos, faturamento por categoria/canal, ruptura) no Gestor Comercial, a partir de vendas do Bling pré-agregadas.

**Architecture:** Job coletor pré-agrega vendas por item/mês/canal em `gc_vendas_item` (+ estoque em `gc_estoque_item`). O front (nova aba na `tela-de-gestao-comercial.vue`) lê e calcula os relatórios em JS. Ver spec `docs/superpowers/specs/2026-07-09-relatorios-comerciais-design.md`.

**Tech Stack:** Node (coletor/, ESM `.mjs`) + Bling via `bling-proxy` + Supabase; Vue 3 + Vite; `window.XLSX`. Sem framework de teste unitário (verificar com `node --test` na lógica pura + SQL + build/Playwright no front).

## Global Constraints
- **Canais (loja.id vendas):** Tivoli=205834140 · Dom Pedro=205657609 · Atacado=205451611. **Depósitos (estoque):** Tivoli=14888726315 · Dom Pedro=14888617206 · Atacado/Pulmão=14888248253.
- **ABC:** por faturamento; A≤80% acum, B≤95%, C resto. **BCG:** X=participação no faturamento, Y=crescimento vs período anterior; quadrante pela mediana de cada eixo.
- **Período = mês** (agregação mensal). Situação Bling `9` = venda concluída.
- Reaproveitar `gestor-comercial.mjs` (não duplicar Bling): extrair helpers pra módulo compartilhado.
- Commits: `git config user.email breno@rbvcompany.com; git config user.name brenoov`; branch por fase; build antes de commitar o front.

---

## Fase 1 — Pipeline de dados

### Task 1: Migração das tabelas

**Files:** migração Supabase `relatorios_comerciais`.

- [ ] **Step 1: Aplicar**
```sql
create table if not exists gc_vendas_item (
  mes date not null, canal_loja_id bigint not null, sku text not null,
  produto text, categoria text, unidades int not null default 0,
  faturamento numeric not null default 0, atualizado_em timestamptz default now(),
  primary key (mes, canal_loja_id, sku)
);
create table if not exists gc_estoque_item (
  deposito_id bigint not null, sku text not null, produto text, categoria text,
  saldo int not null default 0, atualizado_em timestamptz default now(),
  primary key (deposito_id, sku)
);
alter table gc_vendas_item enable row level security;
alter table gc_estoque_item enable row level security;
create policy gc_vi_read on gc_vendas_item for select to authenticated using (true);
create policy gc_ei_read on gc_estoque_item for select to authenticated using (true);
```
- [ ] **Step 2: Verificar** `select * from gc_vendas_item limit 1;` (vazio, sem erro). Sem commit (migração no banco).

### Task 2: Extrair helpers do Bling p/ módulo compartilhado

**Files:**
- Create: `coletor/lib/bling-comercial.mjs`
- Modify: `coletor/gestor-comercial.mjs` (importar do novo módulo em vez de definir local)

**Interfaces:**
- Produces (export): `loginServico()`, `blingProxy(token,endpoint,params)`, `blingPedidos(token,dataIni,dataFim)` (pedidos situação 9, paginado), `blingProdutos(token,maxPag)`, `blingSaldoFoco(token,prodMap)`, `classificarItem(nome)`.

- [ ] **Step 1:** Mover as funções `loginServico/blingProxy/blingPedidos/blingProdutos/blingSaldoFoco/classificarItem` de `gestor-comercial.mjs` para `coletor/lib/bling-comercial.mjs` com `export`. Manter comportamento IDÊNTICO (retry 429/5xx, throttle ~380ms, `idsSituacoes[]=9`).
- [ ] **Step 2:** Em `gestor-comercial.mjs`, substituir as definições por `import { ... } from './lib/bling-comercial.mjs'`.
- [ ] **Step 3: Verificar** `cd coletor && node -e "import('./lib/bling-comercial.mjs').then(m=>console.log(Object.keys(m)))"` → lista os 6 exports. E `node --check gestor-comercial.mjs`.
- [ ] **Step 4: Commit** `git add coletor/lib/bling-comercial.mjs coletor/gestor-comercial.mjs; git commit -m "refactor(coletor): extrai helpers do Bling p/ lib/bling-comercial.mjs (reuso)"`

### Task 3: Job `relatorios-comerciais.mjs`

**Files:**
- Create: `coletor/relatorios-comerciais.mjs`
- Create: `coletor/relatorios-comerciais.test.mjs` (lógica pura de agregação)

**Interfaces:**
- Consumes: `bling-comercial.mjs`. Escreve `gc_vendas_item`/`gc_estoque_item` via Supabase REST (service key, padrão dos outros jobs).

- [ ] **Step 1: Função pura de agregação + teste**
Escrever `agregarVendas(pedidos, canalLojaId)` → mapa `sku → {produto, unidades, faturamento}` somando os itens dos pedidos daquele canal. Item: `unidades += item.quantidade`, `faturamento += item.valor * item.quantidade` (valor puro do item, sem frete/desconto do pedido — decisão do spec).
`relatorios-comerciais.test.mjs`: dado 2 pedidos com itens conhecidos, `agregarVendas` soma certo. `node --test`.
- [ ] **Step 2:** Loop principal: `loginServico()` → para cada mês do range (arg `--backfill=N` = últimos N meses; sem flag = mês corrente) e cada canal (205834140/205657609/205451611): `blingPedidos(token, mesIni, mesFim)` filtrando `p.loja.id === canal`; detalhar itens (reusar a lógica de detalhe de pedido do gestor — throttle); `agregarVendas`; `categoria = classificarItem(produto)`; upsert `gc_vendas_item` (onConflict `mes,canal_loja_id,sku`). Log de progresso por (mês,canal).
- [ ] **Step 3:** Estoque: `blingProdutos` + `blingSaldoFoco` → upsert `gc_estoque_item` por depósito foco.
- [ ] **Step 4: Verificar** rodar `node relatorios-comerciais.mjs` (mês corrente) local; conferir `select mes,canal_loja_id,count(*),sum(faturamento) from gc_vendas_item group by 1,2` bate com a ordem de grandeza do briefing do Gestor.
- [ ] **Step 5: Commit** `git add coletor/relatorios-comerciais.mjs coletor/relatorios-comerciais.test.mjs; git commit -m "feat(coletor): job relatorios-comerciais (vendas por item/mês/canal + estoque)"`

### Task 4: Workflow + backfill

**Files:** Create `.github/workflows/relatorios-comerciais.yml`

- [ ] **Step 1:** Workflow espelhando `gestor-comercial.yml` (mesmos segredos GESTOR_USER_*, SUPABASE_*): `cron` diário (mês corrente) + `workflow_dispatch` com input `backfill` (Nº de meses) → `node relatorios-comerciais.mjs --backfill=${{inputs.backfill}}`.
- [ ] **Step 2:** Disparar backfill de 12 meses: `gh workflow run "Relatórios Comerciais" -R brenoov/social-dashboard -f backfill=12`. Se estourar o tempo (throttle), quebrar em trimestres (rodar --backfill com meses menores repetidamente).
- [ ] **Step 3: Verificar** `select mes,count(*) from gc_vendas_item group by 1 order by 1` → 12 meses povoados.
- [ ] **Step 4: Commit** `git add .github/workflows/relatorios-comerciais.yml; git commit -m "ci: workflow relatorios-comerciais (diário + backfill)"`

---

## Fase 2 — Front

### Task 5: Recurso de permissão `gestor.relatorios`

**Files:**
- Modify: `src/compartilhado/controle-de-login-e-usuario.js` (RECURSOS)
- Migração: conceder aos que têm `gestor`.

- [ ] **Step 1:** Em `RECURSOS`, adicionar `{ key: 'gestor.relatorios', label: 'Relatórios Comerciais', acoes: ['ver','exportar'] }`.
- [ ] **Step 2:** Migração aditiva: `update profiles set permissions = jsonb_set(permissions,'{gestor.relatorios}', '["ver","exportar"]') where permissions ? 'gestor';`
- [ ] **Step 3: Commit** `git add src/compartilhado/controle-de-login-e-usuario.js; git commit -m "feat(perms): recurso gestor.relatorios"`

### Task 6: Abas [Briefing] [Relatórios] no Gestor

**Files:** Modify `src/ferramentas/gestao-comercial/tela-de-gestao-comercial.vue`

- [ ] **Step 1:** Adicionar um seletor de abas no topo; estado `abaGc` ('briefing'|'relatorios'). Aba "Relatórios" só aparece com `hasPermission('gestor.relatorios','ver')`. O conteúdo atual (briefing) fica sob 'briefing'; a nova seção `#gc-relatorios` sob 'relatorios' (carrega ao abrir).
- [ ] **Step 2: Build** `npm run build`.
- [ ] **Step 3: Commit** `git add src/ferramentas/gestao-comercial/tela-de-gestao-comercial.vue; git commit -m "feat(gestor): abas Briefing/Relatórios"`

### Task 7: Dados + filtros + ABC/BCG

**Files:** Modify `tela-de-gestao-comercial.vue` (a seção Relatórios; declarativo se possível, ou componente novo `relatorios-comerciais.vue`)

**Interfaces:** lê `gc_vendas_item`/`gc_estoque_item` via `sbClient`.

- [ ] **Step 1: Carregar + filtros:** estado `canal` (0=consolidado ou loja_id), `periodo` (mes-atual/mes-passado/ano/custom), `granularidade` ('sku'|'categoria'). `carregar()` busca `gc_vendas_item` dos meses do período (e do período anterior, p/ BCG) filtrando canal; agrega por sku ou categoria em JS → `linhas` `[{chave,produto,categoria,unidades,faturamento,fatAnterior}]`.
- [ ] **Step 2: ABC (função pura):**
```js
function curvaABC(linhas) {
  const ord = [...linhas].sort((a,b)=>b.faturamento-a.faturamento)
  const total = ord.reduce((s,l)=>s+l.faturamento,0) || 1
  let acum = 0
  return ord.map(l => { acum += l.faturamento; const p = acum/total
    return { ...l, pct: l.faturamento/total, pctAcum: p, classe: p<=0.8?'A':p<=0.95?'B':'C' } })
}
```
- [ ] **Step 3: BCG (função pura):**
```js
function matrizBCG(linhas) {
  const total = linhas.reduce((s,l)=>s+l.faturamento,0) || 1
  const itens = linhas.map(l => ({ ...l,
    participacao: l.faturamento/total,
    crescimento: l.fatAnterior>0 ? (l.faturamento-l.fatAnterior)/l.fatAnterior : (l.faturamento>0?1:0) }))
  const med = arr => { const s=[...arr].sort((a,b)=>a-b); const n=s.length; return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0 }
  const mp = med(itens.map(i=>i.participacao)), mc = med(itens.map(i=>i.crescimento))
  return itens.map(i => ({ ...i, quadrante:
    i.participacao>=mp && i.crescimento>=mc ? 'Estrela' :
    i.participacao>=mp && i.crescimento<mc ? 'Vaca leiteira' :
    i.participacao<mp && i.crescimento>=mc ? 'Interrogação' : 'Abacaxi' }))
}
```
- [ ] **Step 4: Render ABC + BCG:** um seletor de relatório; tabela ABC (badge A/B/C) + tabela/dispersão BCG (SVG scatter participação×crescimento, cor por quadrante). `tabular-nums`, zebra, scroll-x.
- [ ] **Step 5: Build + verificar** Playwright: abrir Gestor→Relatórios, conferir ABC soma 100% e classes A/B/C; BCG classifica. Conferir um total vs SQL.
- [ ] **Step 6: Commit** `git commit -m "feat(gestor): relatórios ABC + BCG (dados, filtros, cálculo)"`

### Task 8: Demais relatórios + export + validação

**Files:** Modify a seção Relatórios.

- [ ] **Step 1:** Mais vendidos (sort desc fat/unid), Menos vendidos/encalhados (asc + venda 0 & estoque>0 via `gc_estoque_item`), Faturamento por categoria×canal (pivot), Ruptura (saldo/velocidade → diasCobertura, alerta ≤20d).
- [ ] **Step 2:** Export Excel/CSV do relatório ativo (`window.XLSX`), gateado por `hasPermission('gestor.relatorios','exportar')`.
- [ ] **Step 3: Build + validar** Playwright nos 6 relatórios + conferência SQL de um número.
- [ ] **Step 4: Commit + merge/deploy** dos commits da Fase 2 → main → push.

---

## Self-review (coberto)
Spec: ABC/BCG/mais/menos/categoria/ruptura → Tasks 7-8; pipeline → Tasks 1-4; permissão → Task 5; aba → Task 6. Tipos: `linhas[{chave,produto,categoria,unidades,faturamento,fatAnterior}]` consistente entre ABC/BCG. Sem placeholders (funções puras com código real; Bling reusa funções nomeadas existentes).
