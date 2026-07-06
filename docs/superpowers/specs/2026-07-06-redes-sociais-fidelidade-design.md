# Redes Sociais — Fidelidade de dados + melhorias de UI — Design

**Data:** 2026-07-06
**Branch de origem:** `main` (app Vue no ar)
**Status:** Design aprovado pelo Breno (Fase 1 primeiro) — aguardando revisão da spec
**Arquivo-alvo:** `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` (+ possivelmente `supabase/functions/coletar-dados/index.ts` na Fase 2)

## 1. Objetivo e princípio

Corrigir a tela de **Redes Sociais** para que os números **batam fielmente** com os painéis da Meta (Painel Profissional, Business Suite Insights, Gerenciador de Anúncios), mais alguns ajustes de UI. **Vale para TODOS os perfis, sem exceção.** Princípio inegociável: **não exibir número que pareça certo mas não seja** — se a API não entregar um dado, avisamos e não inventamos.

**Princípio de INTERVALO + FILTRO (crítico):** todas as métricas são **dinâmicas pelo período selecionado** (hoje/7d/30d/mês/mês passado/personalizado) e pelo filtro correto — **nada de chumbar os números do "mês passado"**. Os valores de referência da seção 2 são só a **régua de validação** do intervalo "mês passado"; a lógica deve puxar o dado certo para QUALQUER intervalo. Validação obrigatória: conferir em "mês passado" (bate com a régua) **E** em ao menos mais um intervalo (ex.: 7d/30d) pra garantir que flui dinâmico. Investimento soma **todas as campanhas** dentro do **período selecionado** (filtro não corta o gasto total).

## 2. Valores de referência (intervalo "mês passado" — usar pra validar)

| Métrica | Fonte Meta | Valor esperado |
|---|---|---|
| Total de seguidores | Painel Profissional | 24.300 |
| Novos — Seguidores (bruto) | Painel Prof. > Seguidores > Crescimento | 1.281 |
| Novos — Deixaram de seguir | idem | 571 |
| Novos — Total (líquido) | idem | 710 |
| Investimento | Gerenciador de Anúncios > relatório | R$ 10.442,58 |
| Visualizações | Business Suite > Insights > Resultados | 1.651.342 |
| Alcance | idem | 1.014.049 |
| Interações (nossa dash "interações totais") | idem | 9.926 |
| Visitas (nossa dash "visitas ao perfil") | idem | 9.108 |

## 3. Âncoras no código (do mapeamento)

- Formatação: `fmtN()` L566 (resume: 1999→"2 mil"), `animCount()` L546-554, `animCountFull()` L556-564 (nº cheio pt-BR), `fmtR()` L567 (R$).
- Render principal: `update(d, period)` L1219-1331; busca: `fetchData()` L806-1033.
- IDs: total seguidores `#total-followers` (L1222); novos `#new-followers-val` (L1227) + breakdown bruto L1229-1236 + gráfico `buildChart()` L709-768; engajamento `#eng-views/#eng-reach/#eng-interactions/#eng-profile-views/#eng-engaged` (loop L1293); stories `#st-follows`, `#st-profile-visits`, `#cnt-story-shares`, `#cnt-story-replies`, `#st-reach`; conteúdo `#cnt-posts-reels` (L1320).

## 4. FASE 1 — o que dá pra fazer com segurança (dados já existem / é UI)

### 4.1 Total de seguidores (bater 24.300)
- Fonte atual: `daily_snapshots.followers_count` (API `followers_count`) — já é o número do painel.
- **Ação:** validar que exibe 24.300 no "mês passado"; se houver defasagem, usar o último snapshot dentro da janela. Baixo risco.

### 4.2 Novos seguidores em 3 linhas
- Dados já coletados: `gained`/`lost` (bruto, via `follows_and_unfollows` + `breakdown=follow_type`).
- **Ação (UI):** trocar o card `#new-followers-val` por **3 linhas com FONTE IGUAL**, na ordem: **Seguidores** (gained=1281) · **Deixaram de seguir** (lost=571) · **Total** (net=710). Usar o valor **confirmado pelo Instagram** (não a prévia); manter o selo de consolidação já existente. O **gráfico novos/dia** (`buildChart`) permanece, alimentado por gained/lost.

### 4.3 Engajamento fiel + remover "Contas Engajadas"
- `views`, `reach`, `total_interactions`, `profile_views` já vêm dos campos certos.
- **Ação:** (a) **remover o card Contas Engajadas** (`#eng-engaged`, template L314) — do DOM e do loop de render; (b) validar que Visualizações/Alcance/Interações/Visitas batem com os valores de referência. Se algum não bater, é janela de período (investigar antes de subir).

### 4.4 Stories — remover cards
- **Ação (UI):** remover **"novos seguidores"** (`#st-follows`, template L347) e **"visitas ao perfil"** (`#st-profile-visits`, template L346) da seção de stories. Encaminhamentos (`story_shares`) e Respostas (`story_replies`) permanecem.

### 4.5 Tooltip do número inteiro (universal)
- Hoje `fmtN()` resume sem tooltip. **Ação:** de forma **universal**, todo número resumido mostra o **inteiro** (via `toLocaleString('pt-BR')`) ao passar o mouse / tocar. Implementar no ponto único: quando `animCount()` escreve o valor resumido, também setar `el.title` (tooltip nativo) OU um tooltip próprio no `.mc-val` com o número cheio. Vale pra toda a tela automaticamente. Números que já são cheios (`animCountFull`) não precisam.

## 5. FASE 2 — precisam de teste na API da Meta antes de prometer

Para cada item: **primeiro testar** o que a API entrega, depois decidir. Marcar claramente "bate 100%" ou "a API não expõe".

### 5.1 Investimento = R$ 10.442,58
- `campaign_insights.spend` passa por `campaign_filters.selected_ids` + janela de data. **DECIDIDO (Breno):** o indicador de investimento soma **TODAS as campanhas** no período (sem o filtro), pra bater com o relatório do Gerenciador. **Testar** que o total bate com R$ 10.442,58 no "mês passado" e ajustar a query (ignorar `selected_ids` para este total). Obs.: verificar se algum outro card (ex.: CPS/CPI/CPL) depende do filtro antes de removê-lo globalmente — o filtro pode continuar valendo para os cards de eficiência, mas o **gasto total** ignora o filtro.

### 5.2 Stories: seguidores × não-seguidores (%) + barrinha
- **Mais incerto.** Testar se o `reach`/insights de stories aceita `breakdown=follow_type` (FOLLOWER/NON_FOLLOWER) — geral e por conteúdo. Se sim: barra estilo Instagram (como Painel Prof. > Interações > por tipo de conteúdo). **Se a API não der, avisar e não implementar.**

### 5.3 Alcance de stories (Business Suite > Visão Geral)
- Hoje soma `story_reach` por story; o Business Suite pode mostrar alcance **deduplicado** de conta. Testar se dá pra obter o número agregado/deduplicado; se não bater, documentar a diferença.

### 5.4 Posts contando collabs
- `posts_count` vem de `/{ig_id}/media` (mídia do dono). Collab onde **outro perfil é o dono** pode não aparecer. **Testar** como puxar collabs (ex.: campo `owner`, `media_product_type`, ou endpoint de collab) e somar na contagem de posts.

### 5.5 Encaminhamentos/Respostas dos stories
- Confirmar que `story_shares`/`story_replies` batem com Painel Prof. > Interações > Stories (provável que sim; validar).

## 6. Não-objetivos / cuidados

- **Não inventar número.** Item da Fase 2 que a API não entregar fica de fora, com aviso claro.
- **Só esta tela.** Não mexer em outras ferramentas.
- **Validar por render** (celular 375 + desktop) antes de subir, como na GT.
- **Vale pra todos os perfis** — a lógica é por conta, sem exceção/hardcode de perfil.
- Produção no ar: branch → validar → merge, rollback pronto.

## 7. Critérios de sucesso

1. Total seguidores, novos (3 linhas 1281/571/710), engajamento (4 métricas) batem com os valores de referência do "mês passado".
2. Contas Engajadas + stories (novos seguidores, visitas) removidos.
3. Tooltip com número inteiro em toda a tela.
4. Fase 2: cada item ou bate 100% com a Meta, ou é marcado como limitação da API (sem número falso).
5. Sem regressão no desktop; funciona em todos os perfis.
