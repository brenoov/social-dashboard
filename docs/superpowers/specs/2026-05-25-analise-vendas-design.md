# Análise de Vendas — Design Spec

**Data:** 2026-05-25
**Arquivo alvo:** `projetos/central-inteligencia/central-inteligencia-v1.1.html`

---

## Objetivo

Substituir a tela `vessel-sales-screen` (análise por marca simplificada) por um módulo completo de análise de vendas com KPIs, gráficos interativos (Chart.js), desdobramento por loja, ranking de vendedoras e frequência de positivação. Adicionar metas de vendedoras no admin.

---

## Navegação

Fluxo inalterado até o brand picker:
```
Home → Menu Vendas → Seletor de Marca → [NOVA] openSalesAnalysis()
```

- `openVesselSales()` é renomeada/substituída por `openSalesAnalysis()`
- `closeVesselSales()` → `closeSalesAnalysis()` (volta ao brand picker)
- `vessel-sales-screen` HTML é reescrito com nova estrutura
- Referência em `sessionStorage` muda de `'vessel-sales'` para `'sales-analysis'`
- Referência no restore de sessão (linha ~3337) atualizada

---

## Chart.js

Incluir no `<head>` antes do fechamento `</head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
```

Todas as instâncias Chart.js armazenadas em `window._saCharts = {}` para destruição antes de re-render (evitar "Canvas already in use").

---

## Filtros da tela

### Períodos (botões no topbar)
| Label | `period` key | Intervalo |
|-------|-------------|-----------|
| Até Agora | `'sofar'` | 1º do mês corrente → hoje (**padrão**) |
| Hoje | `'today'` | hoje → hoje |
| 7 dias | `'7d'` | hoje−7 → hoje |
| 14 dias | `'14d'` | hoje−14 → hoje |
| Mês | `'month'` | 1º do mês → último dia do mês |

Período anterior: mesmo span imediatamente antes de `di` (igual ao vessel-sales atual).

### Filtro de canal
- Dropdown `<select>` no topbar com opção "Todas as lojas" (value `''`) + uma opção por loja de `bling_lojas`
- Filtro é **client-side**: os pedidos já carregados são filtrados por `p.loja?.id === lojaId` (quando canal selecionado)
- Ao mudar canal: re-renderiza todos os cards/gráficos sem nova chamada Bling

---

## Dados carregados (two-phase)

**Fase 1 — paralelo:**
```js
const [pedidos, pedidosPrev, lojaMap, metasArr, vendedoresArr] = await Promise.all([
  blingPages('pedidos/vendas', {dataInicial:di, dataFinal:df, 'idsSituacoes[]':9}),
  blingPages('pedidos/vendas', {dataInicial:diPrev, dataFinal:dfPrev, 'idsSituacoes[]':9}),
  sbClient.from('bling_lojas').select('loja_id,nome').then(r => {
    const mp = {}; (r.data||[]).forEach(l => mp[l.loja_id] = l.nome); return mp;
  }),
  sbClient.from('bling_metas').select('loja_id,meta_valor,daily_goals').eq('year',y).eq('month',m).then(r => r.data||[]),
  sbClient.from('bling_vendedores').select('vendor_id,nome').then(r => r.data||[])
]);
```

**Fase 2 — após ter os pedidos:**
```js
const allIds = [...new Set([...pedidos, ...pedidosPrev].map(p => parseInt(p.id)))];
const pvMapArr = allIds.length
  ? await sbClient.from('bling_pedido_vendedor').select('pedido_id,vendor_id')
      .in('pedido_id', allIds.slice(0,500)).then(r => r.data||[])
  : [];
```

`pvMap` = `{ [pedido_id]: vendor_id }` construído a partir de `pvMapArr`.

**Desconto:** `p.desconto > 0` no objeto do pedido (campo nativo da API Bling).

**Itens:** `p.itens[]` disponível no list endpoint — cada item tem `quantidade`.

---

## Estrutura HTML da nova tela

```
#sales-analysis-screen
  .sa-topbar
    .sa-back (botão ←)
    .sa-brand-av + .sa-brand-nm
    .sa-filters
      #sa-canal-select (dropdown lojas)
      .sa-period-btns (Até Agora | Hoje | 7d | 14d | Mês)
  #sa-body
    .sa-kpis           (7 cards)
    .sa-section        (Desdobramento por Canal)
    .sa-section        (Visão Diária)
    .sa-section        (Ticket Médio)
    .sa-section        (Com vs Sem Desconto)
    .sa-section        (Vendedoras)
    .sa-section.sa-loja-section  (por loja — dinâmico)
      .sa-loja-title
      .sa-loja-table
      .sa-positivacao
```

---

## Seção 1 — KPIs (7 cards)

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Venda        │ Meta Total   │ % Atingido   │ Projeção Mês │ Meta Hoje    │ Média Itens  │ Vendas +1    │
│ Realizada    │              │ (gauge color)│              │ + faltante   │ /venda       │ Item         │
│ R$ valor     │ R$ meta      │ NN%          │ R$ proj      │ R$ meta      │ N,N itens    │ NN%          │
│ ↑↓ vs ant.  │ —            │              │ ↑↓ vs meta   │ R$ falta     │ ↑↓ vs ant.  │ ↑↓ vs ant.  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Cálculos:**
- `vendaRealizada` = `pedidos.reduce((s,p) => s + p.total, 0)`
- `metaTotal` = `bling_metas` loja_id=0 ou soma de todas as lojas (igual ao vessel-sales)
- `pctAtingido` = `vendaRealizada / metaPeriodo * 100` — cor: ≥100% verde, ≥85% amarelo, <85% vermelho
- `projecao` = `(vendaRealizada / diasDecorridos) * diasTotais`
- `metaHoje` = `daily_goals[diaNum]` somado de todas as lojas
- `mediaItens` = `totalItens / nPedidos`
- `vendasMaisUm` = `pedidosComDoisOuMaisItens / nPedidos * 100`

---

## Seção 2 — Desdobramento por Canal

**Chart.js — barras agrupadas:**
- Eixo X: nome da loja
- Dataset 1 (cor accent): valor realizado por loja
- Dataset 2 (cor muted tracejada): meta da loja no período
- Dataset 3 (cor anterior): valor período anterior
- Tooltip: `{ realizado, meta, desvio: R$ e %, anterior, Δ% vs anterior }`
- Legenda abaixo do gráfico

---

## Seção 3 — Visão Diária

**Chart.js — linha com área:**
- Eixo X: datas do período (`dd/mm`)
- Dataset 1: valor vendido por dia
- Dataset 2 (linha tracejada): meta do dia (`daily_goals[d]` ou `metaTotal/diasMes`)
- Tooltip: `{ data, vendido, meta, desvio R$ e % }`
- Fill: área abaixo da linha de vendas em accent com 20% opacidade

---

## Seção 4 — Comparativo de Ticket Médio

**Chart.js — barras agrupadas:**
- Eixo X: lojas
- Dataset 1: ticket médio atual por loja
- Dataset 2: ticket médio período anterior por loja
- Tooltip: `{ loja, ticket atual, ticket anterior, Δ% }`

---

## Seção 5 — Vendas com vs Sem Desconto

**Chart.js — dois gráficos lado a lado:**
- Esquerda: donut — % pedidos com desconto vs sem desconto
- Direita: barras empilhadas por loja — valor com desconto (vermelho) + valor sem desconto (verde)
- Tooltip donut: `{ categoria, qtd pedidos, % total, R$ total }`
- Tooltip barras: `{ loja, com desconto R$, sem desconto R$, % com desconto }`

---

## Seção 6 — Vendedoras

**Chart.js — barras horizontais (uma barra por vendedora):**

5 métricas exibidas como grupos de colunas ou tabs selecionáveis:
- **Vendas (R$)**
- **Qtd cupons**
- **Ticket médio**
- **% 2+ itens**
- **% desconto**

Botões de tab acima do gráfico selecionam qual métrica visualizar (uma por vez, mais legível).

Tooltip sempre mostra as 5 métricas da vendedora selecionada.

**Card de resumo abaixo do gráfico:**
```
Total vendido: R$ XX.XXX | Cupons: NNN | Ticket médio geral: R$ XXX
% pedidos 2+ itens: NN% | % pedidos com desconto: NN%
```

---

## Seção 7 — Desdobramento por Loja (dinâmico)

Uma seção por loja em `bling_lojas`, na ordem de `loja_id`.

### Tabela de vendedoras

Colunas:
| Vendedora | Hoje (vendido / meta / faltante) | Ontem (vendido / meta / faltante) | Semana (vendido / meta / faltante) | Mês (vendido / meta / faltante) |
|-----------|----------------------------------|-----------------------------------|------------------------------------|----------------------------------|

- **Vendido** = soma de `p.total` onde `p.loja.id === lojaId` e `vendor_id === vendedoraId`
- **Meta** = de `bling_vendedor_metas.daily_goals` (dia) ou soma da semana ou `meta_valor` (mês)
- **Faltante** = `meta - vendido` — negativo (atingiu) em verde, positivo (falta) em vermelho
- Ordenação: maior vendido no mês primeiro

### Frequência de positivação (abaixo da tabela)

Grade: linhas = vendedoras, colunas = últimos 15 dias corridos.

- Cabeçalho da coluna: dia abreviado (`"seg 19"`, `"ter 20"` etc.)
- Célula verde: `vendedora vendeu naquele dia naquela loja` → valor `R$ X.XXX`
- Célula vermelha: não vendeu → `—`
- Fonte: fetch separado — sempre `di15 = hoje−14`, `df15 = hoje`, independente do período selecionado. Feito em paralelo com a fase 1 do carregamento principal. O `bling_pedido_vendedor` para esses IDs é buscado na fase 2 junto com os demais.

---

## Admin — Metas de Vendedoras

Nova sub-seção em `loadAdminMetas()`, abaixo da seção de lojas.

### UI

```
METAS DE VENDEDORAS
[tabela preview: vendor_id | nome | meta mês | meta/dia]
[Download template .csv]  [Importar planilha ↑]
[mensagem de status]
```

### Template CSV

Colunas: `vendor_id`, `nome`, `1`, `2`, ..., `31`
- Linhas pré-preenchidas com vendedoras de `bling_vendedores`
- Dias sem venda deixados em branco (zerado na importação)

### Importação

Aceita `.csv` — mesmo parser já existente para metas de lojas.

```js
const rec = {
  vendor_id: id,
  year: y,
  month: m,
  meta_valor: val,          // soma de todos os dias
  daily_goals: goalsJson    // { "1": 800, "2": 900, ... }
};
await sbClient.from('bling_vendedor_metas')
  .upsert(rec, { onConflict: 'vendor_id,year,month' });
```

---

## Nova tabela Supabase

```sql
-- docs/migrations/004_vendedor_metas.sql
CREATE TABLE IF NOT EXISTS public.bling_vendedor_metas (
  vendor_id   bigint  NOT NULL,
  year        int     NOT NULL,
  month       int     NOT NULL,
  meta_valor  numeric,
  daily_goals jsonb,
  PRIMARY KEY (vendor_id, year, month)
);
```

Sem RLS (acesso via `sbClient` autenticado com anon key, igual a `bling_metas`).

---

## O que NÃO muda

- `openSalesBrandPicker()` — inalterado
- `closeSalesBrandPicker()` — inalterado
- `sales-brand-screen` HTML — inalterado
- `sales-menu-screen` e `openSalesDashboard()` — inalterados
- `openGestaoVista()` e toda a tela de Gestão à Vista — inalterados
- Lógica de `bling_pedido_vendedor` (background fetch do GV) — inalterada

---

## Fora de Escopo

- Exportação de dados (PDF/Excel) da tela de análise
- Drill-down por SKU/produto
- Comparativo entre marcas diferentes
- Notificações de meta atingida em tempo real
