# Gestão de Tráfego — KPIs por objetivo de campanha (+ edição global)

**Data:** 2026-07-02
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** brenoov (+ Claude)
**Frente:** melhoria #2 do pacote de dashboards

---

## 1. Problema

A tela **Gestão de Tráfego** hoje mostra **as mesmas métricas para toda campanha**, independentemente do objetivo. Uma campanha de Vendas e uma de Tráfego aparecem com os mesmos indicadores, o que desalinha a análise do objetivo real de cada uma.

**Objetivo:** exibir, para cada campanha, os **KPIs adequados ao seu objetivo** (ex.: Tráfego → CTR/CPC/Visitas; Vendas → ROAS/CAC/Valor de conversão), com **padrões espertos de fábrica** e um **editor global** (admin) para escolher quais métricas aparecem por objetivo.

## 2. Estado atual (o que já temos)

- A Gestão de Tráfego puxa os dados **AO VIVO do Meta** via `metaFetchAll` (meta-proxy), não do Supabase. `loadGtData` (`index.html` ~L7802) já busca insights por campanha e por anúncio.
- A consulta de insights já pede (`index.html:7824`): `impressions,clicks,spend,ctr,cpc,reach,frequency,actions,objective,video_play_actions`. Ou seja, **`objective` e `actions` (array de conversões) já vêm**.
- A consulta de campanhas já traz `effective_status,objective,daily_budget,lifetime_budget,...` (`index.html:7826`).
- O render é `_renderGtCampaigns` (`index.html` ~L7841).
- **NÃO temos hoje:** `action_values` (valor monetário das conversões) e `purchase_roas` (ROAS pronto do Meta). São necessários para ROI/Valor de conversão — e é só **adicionar aos campos** da consulta ao vivo (sem mexer em coleta/banco).

## 3. Catálogo de métricas

Todas calculáveis a partir dos insights ao vivo (campo Meta → fórmula):

| Chave | Rótulo | Fórmula / origem |
|---|---|---|
| `alcance` | Alcance | `reach` |
| `impressoes` | Impressões | `impressions` |
| `frequencia` | Frequência | `frequency` |
| `ctr` | CTR | `ctr` (Meta) |
| `cpc` | CPC | `cpc` (Meta) |
| `cpm` | CPM | `spend / impressions * 1000` |
| `cliques` | Cliques | `clicks` |
| `visitas` | Visitas | `actions[landing_page_view]` (fallback `link_click`) |
| `compras` | Compras | `actions[purchase]` (ou `omni_purchase` / `offsite_conversion.fb_pixel_purchase`) |
| `valor_conversao` | Valor de conversão | `action_values[purchase]` |
| `roas` | ROAS / ROI | `purchase_roas[0].value` (fallback `valor_conversao / spend`) |
| `cac` | CAC | `spend / compras` |
| `custo_resultado` | Custo por resultado | `spend / (resultado do objetivo)` |
| `gasto` | Gasto | `spend` |
| `leads` | Leads | `actions[lead]` (ou `onsite_conversion.lead_grouped`) |
| `custo_lead` | Custo/Lead | `spend / leads` |

Helper único `_gtActionVal(row, tipos[])` que varre `actions`/`action_values` procurando o primeiro `action_type` da lista (para lidar com os vários aliases do Meta). Métrica sem dado (ex.: `compras` numa campanha de tráfego) exibe "—".

## 4. Objetivo → KPIs padrão

Mapeia o `objective` da campanha (nomes NOVOS `OUTCOME_*` e LEGADOS) para um "balde", e cada balde tem KPIs padrão:

| Balde | `objective` do Meta (novo / legado) | KPIs padrão |
|---|---|---|
| Tráfego | `OUTCOME_TRAFFIC` / `LINK_CLICKS` | CTR · CPC · Visitas · CPM |
| Vendas | `OUTCOME_SALES` / `CONVERSIONS` · `PRODUCT_CATALOG_SALES` | ROAS · CAC · Valor de conversão · Compras |
| Reconhecimento | `OUTCOME_AWARENESS` / `BRAND_AWARENESS` · `REACH` · `VIDEO_VIEWS` | Alcance · CPM · Frequência · Impressões |
| Engajamento | `OUTCOME_ENGAGEMENT` / `POST_ENGAGEMENT` · `PAGE_LIKES` · `MESSAGES` | CTR · CPC · Cliques · Gasto |
| Leads | `OUTCOME_LEADS` / `LEAD_GENERATION` | Leads · Custo/Lead · CTR · Gasto |
| (padrão) | qualquer outro | CTR · CPC · Gasto · Alcance |

Mapa `OBJETIVO_BALDE` (objective→balde) e `BALDE_PADRAO` (balde→lista de chaves) definidos em código.

## 5. Edição global (admin)

- **Armazenamento:** tabela Supabase `gt_config_metricas` — `balde text primary key`, `metricas jsonb` (lista ordenada de chaves), `updated_at`. Uma linha por balde. Ausente/vazio → usa `BALDE_PADRAO`.
- **Leitura:** `loadGtData` (ou init da tela) carrega a config uma vez; render usa `config[balde] ?? BALDE_PADRAO[balde]`.
- **Editor:** botão de engrenagem na topbar da Gestão de Tráfego, **visível só para admin** (mesmo gating de superadmin já usado no projeto). Abre um modal com uma seção por balde; cada seção é uma checklist ordenável do catálogo (marca/desmarca as métricas). Salva na tabela (upsert) e re-renderiza. Usa os modais/uiConfirm próprios do projeto (não `alert` nativo).
- **RLS:** leitura liberada (dados não sensíveis); escrita só admin (via RPC security-definer com guarda de username, ou policy por role — seguir o padrão de config já existente no projeto).

## 6. Render (`_renderGtCampaigns`)

Para cada campanha: determina o balde pelo `objective`, pega a lista de métricas (config ou padrão), calcula cada uma via catálogo e renderiza os "cards"/linhas de KPI daquela campanha. Mantém o layout atual; só troca QUAIS métricas aparecem. O total/consolidado do topo **mantém o comportamento atual** (fora do escopo desta mudança — pode virar frente própria depois).

## 7. Dados — mudança mínima

Adicionar aos campos da consulta ao vivo em `loadGtData` (`index.html:7824`, e no `adFields` se necessário): `action_values`, `purchase_roas`. Validar que o `meta-proxy` repassa esses campos (teste rápido).

## 8. Fora de escopo

- Personalização por usuário (ficou como opção não escolhida; a edição é **global**).
- Alterar a coleta/tabelas do Supabase (a tela é ao vivo).
- Sugestão de budget (#3), status/pausar (#4) e redesign visual (#5) — frentes próprias.

## 9. Critérios de sucesso

1. Cada campanha mostra os KPIs do seu objetivo (Tráfego ≠ Vendas).
2. ROAS/CAC/Valor de conversão aparecem corretos nas campanhas de vendas (validado ao vivo contra o Gerenciador de Anúncios do Meta).
3. Admin consegue editar, por objetivo, quais métricas aparecem, e a mudança vale para todos.
4. Métrica sem dado exibe "—" (não quebra nem zera enganosamente).
5. Objetivos com nome novo e legado caem no balde certo.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| `meta-proxy` não repassar `action_values`/`purchase_roas` | Testar cedo; se filtrar, ajustar a allowlist do proxy. |
| Aliases de `action_type` variam (purchase/omni_purchase/pixel) | Helper `_gtActionVal` tenta uma lista de aliases por métrica. |
| Objetivo desconhecido | Cai no balde (padrão). |
| Escrita da config sem guarda de admin | Seguir o padrão de gating/RLS já usado no projeto (superadmin). |
