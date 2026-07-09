# Módulo "Relatórios Comerciais" (Gestor Comercial) — Design

**Data:** 2026-07-09
**Contexto:** iamundi, ferramenta Gestor Comercial (`tela-de-gestao-comercial.vue`, rota `/gestao-comercial`). Hoje ela mostra o **briefing semanal** (agente de IA). Adicionar um **2º módulo** de relatórios comerciais interativos. Fonte = Bling (via `bling-proxy`), reaproveitando a lógica do `coletor/gestor-comercial.mjs`. Ver [[project_iamundi_gestor]].

## Objetivo
Relatórios primordiais do comercial, interativos, por canal e período: Curva ABC, Matriz BCG, mais/menos vendidos, faturamento por categoria/canal, ruptura/cobertura.

## Decisões (aprovadas)
- **BCG:** eixo X = participação no faturamento (%); eixo Y = crescimento das vendas vs período anterior. Quadrantes: Estrela (pesa+cresce), Vaca leiteira (pesa+estável), Interrogação (leve+cresce), Abacaxi (leve+cai).
- **ABC:** por **faturamento (R$)**. A ≤ 80% acumulado, B ≤ 95%, C o resto.
- **Recorte:** filtro por **canal** (Tivoli/Dom Pedro/Atacado/Consolidado) + **período** + granularidade **SKU e categoria** (toggle).
- **Relatórios:** ABC, BCG, Mais vendidos, Menos vendidos/encalhados, Faturamento por categoria/canal, Ruptura/cobertura.
- **Granularidade de período = MÊS** (agregação mensal; custom por mês).
- Arquitetura: **pré-agregar** as vendas num job (não puxar do Bling ao vivo).

## Canais (loja_id do Bling, vendas) e depósitos (estoque)
- Vendas por `loja.id`: Tivoli=205834140 · Dom Pedro=205657609 · Atacado Nuvem Shop=205451611.
- Estoque por depósito: Tivoli=14888726315 · Dom Pedro=14888617206 · Atacado/Pulmão=14888248253.

---

## Fase 1 — Pipeline de dados (backend/coletor)

### Tabelas novas (migração Supabase)
```sql
create table gc_vendas_item (
  mes date not null,               -- 1º dia do mês (ex.: 2026-06-01)
  canal_loja_id bigint not null,   -- loja.id do Bling
  sku text not null,
  produto text,
  categoria text,                  -- via classificarItem(nome)
  unidades int not null default 0,
  faturamento numeric not null default 0,
  atualizado_em timestamptz default now(),
  primary key (mes, canal_loja_id, sku)
);
create table gc_estoque_item (
  deposito_id bigint not null,
  sku text not null,
  produto text,
  categoria text,
  saldo int not null default 0,
  atualizado_em timestamptz default now(),
  primary key (deposito_id, sku)
);
```
RLS: leitura autenticada; escrita service_role (padrão das outras tabelas do coletor).

### Job coletor: `coletor/relatorios-comerciais.mjs`
Reaproveita de `gestor-comercial.mjs`: `blingProxy`, login conta de serviço (`claudecode@rbvcompany.com`), `classificarItem(nome)`.
- **Vendas:** para cada (mês, canal), `pedidos/vendas` com `dataInicial`/`dataFinal` do mês + `idsLojas`/filtro por `loja.id`, situação `9` (concluída), paginado; detalhar itens de cada pedido (throttle ~380ms, retry 429/5xx como já existe); agregar por SKU → `unidades` (Σ qtd) e `faturamento` (Σ valor do item). `categoria = classificarItem(produto)`. Upsert em `gc_vendas_item` (onConflict mes,canal_loja_id,sku).
- **Estoque:** `estoques/saldos` em lote (idsProdutos) por depósito foco → upsert `gc_estoque_item`.
- **Modos:** `--backfill=N` (últimos N meses, uma vez) e sem flag (só o mês corrente, roda diário). Idempotente (upsert).
- **GitHub Actions:** cron diário (mês corrente) + `workflow_dispatch` (backfill). Segredos já existem (GESTOR_USER_*, SUPABASE_SERVICE_KEY).

### Validação F1 (sem UI)
SQL: somar `faturamento` por canal/mês e conferir contra o briefing/painel. Ex.: `select mes, canal_loja_id, sum(faturamento) from gc_vendas_item group by 1,2 order by 1 desc`. Bater com os números do Gestor.

---

## Fase 2 — Front (o módulo)

### Integração
Na `tela-de-gestao-comercial.vue`, um seletor no topo: **[Briefing Semanal] [Relatórios]** (abas). "Briefing" = o atual; "Relatórios" = o novo. Componente próprio (ou seção) que só carrega quando a aba abre.

### Dados
Lê `gc_vendas_item` (filtrado por meses do período + canal) e `gc_estoque_item` via `sbClient`. Calcula tudo em JS (para um período/mês são ≤ alguns milhares de linhas). Se "Consolidado", soma os canais; se um canal, filtra. Granularidade SKU (linhas por sku) ou Categoria (agrupa por `categoria`).

### Filtros (topo)
- **Canal:** Consolidado · Tivoli · Dom Pedro · Atacado.
- **Período:** Mês atual · Mês passado · Ano (soma dos meses) · Personalizado (mês inicial→final).
- **Granularidade:** SKU ⇄ Categoria.
- **Exportar:** Excel/CSV (via `window.XLSX`, padrão do projeto).

### Os 6 relatórios (computados no front)
1. **Curva ABC** — ordena desc por faturamento do período; acumula %; classe A (≤80%), B (≤95%), C (resto). Colunas: item/categoria, unidades, faturamento, %, %acum, classe (badge colorido).
2. **Matriz BCG** — para cada item: `participacao = faturamento/total`; `crescimento = (fat_periodo − fat_periodo_anterior)/fat_periodo_anterior`. Quadrante pela mediana de cada eixo → Estrela/Vaca/Interrogação/Abacaxi. Saída: lista com o quadrante + um **gráfico de dispersão** (participação × crescimento, cor por quadrante).
3. **Mais vendidos** — ranking desc (por faturamento; toggle por unidades).
4. **Menos vendidos / encalhados** — ranking asc + itens com venda 0 no período e estoque > 0.
5. **Faturamento por categoria/canal** — tabela categoria × canal com totais (linha/coluna).
6. **Ruptura / cobertura** — junta `gc_estoque_item` (saldo) com a velocidade recente (unidades do mês corrente/dia): `diasCobertura = saldo / (unidades_mes/diaDoMes)`; alerta se ≤ 20 dias e vendendo.

### Visual
Abas internas ou um select pra escolher o relatório; tabelas com `tabular-nums`, zebra, cabeçalho fixo, badges de classe/quadrante; scroll-x no mobile; coerente com o resto (tokens `--surface/--border/--accent`). Padrão do Relatório de Redes já feito ([[project_iamundi_relatorio]]).

### Permissão
Recurso próprio **`gestor.relatorios`** no catálogo `RECURSOS` (ações: ver, exportar), gateado pelo novo sistema ([[project_iamundi_permissoes]]). Admin/super-admin veem; conceder aos demais pelo editor.

## Fora de escopo (YAGNI)
Margem/lucro (falta preço de custo no Bling); ticket médio (não pedido); granularidade diária; BCG por margem; previsão/forecast.

## Riscos / notas
- **Backfill do Bling é pesado** (muitos pedidos × meses × throttle) — rodar uma vez, com log de progresso; se estourar tempo do GitHub Actions, quebrar por trimestre.
- Faturamento "por item" = valor do item no pedido (sem rateio de frete/desconto do pedido) — definir se usa `valor` do item puro (padrão) e registrar.
- Categoria depende de `classificarItem` — itens fora do dicionário caem em "Outros".
