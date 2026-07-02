# KPIs de custo na seção Meta Ads (Dashboard Redes Sociais)

**Data:** 2026-07-02
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** brenoov (+ Claude)
**Frente:** backlog dashboards — KPIs de custo (pedido do Breno)

---

## 1. Problema

A seção **02 · Meta Ads** do dashboard social hoje mostra só **Investimento no período** e **Custo por seguidor**, com chips de impressões/cliques/alcance. Falta enxergar **quanto custa cada tipo de resultado do anúncio** — em especial **custo por interação** e **custo por curtida**, além de CPC, CPM, custo por alcance e custo por comentário/salvamento/compartilhamento.

**Bloqueio de dado:** a tabela `campaign_insights` (fonte da seção) guarda **só** `spend, impressions, clicks, reach`. As **interações/curtidas do anúncio não são coletadas** (não há `actions`). Misturar gasto-do-anúncio ÷ engajamento-orgânico seria enganoso. Então o caminho escolhido (Path A) é **ensinar o coletor a capturar as interações dos anúncios** e calcular os custos a partir do dado do próprio anúncio.

## 2. Estado atual (o que já existe)

- Seção HTML **02 · Meta Ads** (`index.html` ~L3070-3122): 2 cards (`ads-spend-val` = investimento; `ads-cps-val` = custo por seguidor) + chips `chips-ads` (impressões/cliques/alcance ~L4028). Filtro de campanhas consideradas (`openCampaignModal`).
- Dados: `sb('campaign_insights?...&select=campaign_id,spend,impressions,clicks,reach,captured_at...')` (~L3754), agregados por `aggCi(rows)` (~L3740) que soma spend/impressions/clicks/reach do snapshot mais recente (`captured_at` máximo) do período selecionado (`_adsPd` = 7/14/30).
- Tabela `campaign_insights` colunas: `id, campaign_id, account_id, captured_at, period_days, spend, impressions, clicks, reach`.
- Coletor `coletar-dados` (Edge Function, pg_cron 4x/dia) popula `campaign_insights` por campanha × período. ⚠️ **DRIFT conhecido:** repo já esteve atrás da produção — **sempre `get_edge_function` antes de deployar**, sincronizar, e só então editar (ver [[project_iamundi_coletor]]).
- Referência útil: a **Gestão de Tráfego** já pega `actions,action_values` AO VIVO do Meta e tem helper de aliases (`_gtActionVal`/`_getActions`) — serve de modelo para os `action_type` corretos.

## 3. Métricas (o que a tela vai mostrar)

**Cards de destaque (2):**
| KPI | Fórmula |
|---|---|
| **Custo por interação** | `spend / post_engagement` |
| **Custo por curtida** | `spend / curtidas` |

**Chips (6):**
| KPI | Fórmula |
|---|---|
| CPC (custo/clique) | `spend / clicks` |
| CPM (custo/mil impressões) | `spend / impressions * 1000` |
| Custo por alcance | `spend / reach` |
| Custo por comentário | `spend / comentários` |
| Custo por salvamento | `spend / salvamentos` |
| Custo por compartilhamento | `spend / compartilhamentos` |

- Denominador zero/ausente → exibe **"—"** (não zera nem quebra), mesmo padrão do projeto.
- CPC/CPM/custo por alcance já são calculáveis com o dado atual — aparecem assim que a tela for atualizada (não dependem do coletor).
- Custo por interação/curtida/comentário/salvamento/compartilhamento dependem das colunas novas (§5) — aparecem **a partir do 1º ciclo do coletor** com a mudança (dado é forward-only; snapshots antigos não têm).

## 4. Mapeamento dos `action_type` do Meta (validar na implementação)

O coletor extrai as contagens do array `actions` do insight, por `action_type`, com **helper de aliases** (espelha `_gtActionVal`), pois o Meta varia os nomes:

| Métrica | action_type (com fallbacks) |
|---|---|
| interações (post_engagement) | `post_engagement` |
| curtidas | `post_reaction` (fallback `like`) |
| comentários | `comment` |
| salvamentos | `onsite_conversion.post_save` (fallback `post_save`) |
| compartilhamentos | `post` (fallback `share`) |

**Risco/validação:** os nomes exatos (especialmente curtida vs reação, e compartilhamento) precisam ser **conferidos contra dados reais de 1 conta** durante a implementação — a Gestão de Tráfego ao vivo é a referência para ver o que o Meta devolve. Ver §10.

## 5. Mudanças

### 5.1 Coletor (`coletar-dados`)
- Adicionar **`actions`** aos `fields` da consulta de insights de campanha.
- Para cada campanha × período, extrair via helper de aliases: `post_engagement, curtidas, comentários, salvamentos, compartilhamentos` (inteiros; ausente = 0/null).
- Gravar essas contagens nas colunas novas de `campaign_insights` (junto do que já grava).
- **Antes de tudo:** `get_edge_function coletar-dados` (pegar a versão em produção), sincronizar o repo, aí editar e deployar (`verify_jwt` preservado). Bump de versão.

### 5.2 Banco (migration)
`ALTER TABLE public.campaign_insights ADD COLUMN` (nullable, int):
`post_engagement, likes, comments, shares, saves`.
Sem mudança de RLS (a tabela já é lida pela tela como hoje).

### 5.3 Tela (seção 02 · Meta Ads)
- `sb('campaign_insights?...&select=...')` (~L3754): incluir `post_engagement,likes,comments,shares,saves` no select.
- `aggCi(rows)` (~L3740): somar também os 5 campos novos no agregado.
- Render: **2 cards novos** (custo por interação, custo por curtida) no grid de cards da seção, e os **6 chips** de custo (CPC, CPM, custo/alcance, custo/comentário, custo/salvamento, custo/compartilhamento) numa faixa de chips abaixo dos cards (mesmo estilo dos chips que já existem). Métrica sem dado = "—".
- Mantém o filtro de campanhas e o seletor de período atuais (os custos respeitam o filtro/período, pois vêm do mesmo agregado).

## 6. Dados históricos

As colunas novas são **forward-only**: só os snapshots coletados após a mudança terão interações. Os cards/chips de interação/curtida/comentário/salvamento/compartilhamento exibem "—" para períodos sem dado coletado ainda. CPC/CPM/custo por alcance funcionam retroativamente (usam colunas que já existem).

## 7. Fora de escopo

- Remover o botão fixo ±25% na Gestão de Tráfego (frente própria, rápida).
- #5 redesign visual (separação de cards campanha/anúncio + ênfase nos números) — frente própria.
- Custo por seguidor (já existe) e o card de investimento (já existem).
- Atribuição de engajamento orgânico a anúncios (não faz sentido; descartado).

## 8. Critérios de sucesso

1. Após 1 ciclo do coletor com a mudança, `campaign_insights` tem as contagens de interação por campanha × período.
2. A seção 02 · Meta Ads mostra os 2 cards de custo (interação, curtida) + os 6 chips, respeitando filtro de campanhas e período.
3. CPC/CPM/custo por alcance aparecem imediatamente (dado já existe); os demais aparecem quando houver coleta.
4. Métrica sem dado exibe "—" (não quebra, não zera enganosamente).
5. Nenhuma regressão nos cards atuais (investimento, custo por seguidor) nem no coletor (validar contagem batendo com o Gerenciador do Meta numa conta).

## 9. Riscos

| Risco | Mitigação |
|---|---|
| `action_type` de curtida/compartilhamento varia no Meta | Helper de aliases + validar contra 1 conta real (GT ao vivo como referência) antes de confiar. |
| Drift do coletor (repo atrás da prod) | `get_edge_function` antes de editar; re-sync; bump de versão. |
| Coleta quebrar ao adicionar `actions` | Mudança aditiva; testar 1 conta; coletor tem camada de resiliência. |
| Colunas novas vazias no início | Esperado (forward-only); UI mostra "—". |
| Somatório de interações por período divergir do Meta | Validar janela (period_days) e action_type contra o Gerenciador. |
