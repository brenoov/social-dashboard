# Redes Sociais — Fidelidade TOTAL via Híbrido (KPIs ao vivo + gráficos coletados) — Design

**Data:** 2026-07-06
**Branch de origem:** `main` (app Vue no ar)
**Status:** Design em elaboração — aguardando revisão do Breno
**Arquivo-alvo:** `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue` + `supabase/functions/meta-proxy/` (chamada ao vivo)
**Substitui:** a Fase 2 da spec `2026-07-06-redes-sociais-fidelidade-design.md` (a de itens ⚠️). A Fase 1 (UI) já está no ar.

## 1. Objetivo

Garantir que os **números-chave** da tela de Redes Sociais **batam 100%** com os painéis da Meta, para **qualquer perfil e qualquer período**. A garantia vem de buscar o KPI **ao vivo na Meta** (com a janela exata), não de depender do robô coletor ter pré-calculado. Gráficos/histórico continuam do dado coletado (rápido).

## 2. A RECEITA DAS JANELAS EXATAS (descoberta validada no probe — o coração da spec)

Validado contra o painel do perfil "Breno Vale" em junho/2026 (via função-probe server-side; token nunca exposto):

| KPI | Chamada Meta | Janela (fuso BRT) | Bateu? |
|---|---|---|---|
| **Total de seguidores** | `GET /{ig}?fields=followers_count` | agora (atual) | ✅ 24.300 |
| **Novos — Seguiu/Deixou** | `GET /{ig}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type` | **janela deslocada −1 dia** (ex.: mês passado = `31/05 00:00 → 30/06 00:00`) → `FOLLOWER`=seguiu, `NON_FOLLOWER`=deixou, Total=seguiu−deixou | ✅ 1.281 / 571 / 710 |
| **Engajamento** (views, reach, total_interactions, profile_views) | `GET /{ig}/insights?metric=views,reach,total_interactions,profile_views&period=day&metric_type=total_value` | **mês-calendário exato** (ex.: mês passado = `01/06 00:00 → 01/07 00:00`) | ✅ 1.651.342 / 1.014.049 / 9.926 / 9.108 |

**As duas descobertas-chave:**
1. **Chamada AGREGADA** (uma só, `metric_type=total_value` sobre `since/until`), NUNCA somar 30 chamadas diárias (a soma diária subconta ~25%).
2. **Follows têm offset de −1 dia** vs engajamento (a Meta bucketiza os follows 1 dia atrás). Engajamento usa a janela do mês; follows usam a mesma janela **deslocada 1 dia pra trás**.

### 2.1 Janela por período selecionado
Para cada período do seletor, definir (fuso America/Sao_Paulo):
- **Mês passado:** eng = `[1º dia mês ant. 00:00, 1º dia mês atual 00:00)`; follows = essa janela **−1 dia** em ambas as pontas.
- **Mês atual:** eng = `[1º dia mês atual 00:00, agora)`; follows = **−1 dia**.
- **7d / 14d / 30d:** eng = `[hoje−N 00:00, hoje 00:00)`; follows = **−1 dia**.
- **Hoje / 1d:** idem, janela do dia.
- **Personalizado (se houver):** eng = a faixa escolhida; follows = **−1 dia**.
- **Total de seguidores:** sempre o `followers_count` **atual** (independe do período).

## 3. Arquitetura híbrida

```
Ao escolher/trocar período:
  KPIs (ao vivo)            Gráficos/histórico (coletado)
  ┌─────────────────┐      ┌──────────────────────────┐
  │ meta-proxy →    │      │ daily_snapshots,         │
  │ Meta Insights   │      │ engagement_snapshots,    │
  │ (janela exata)  │      │ content_snapshots        │
  └────────┬────────┘      └───────────┬──────────────┘
           │ exato, ~2-5s               │ rápido, tendência
           ▼                            ▼
   Total seguidores · Novos (3 linhas) · Engajamento(4)     Gráfico novos/dia · comparativos
```

- **KPIs ao vivo:** Total seguidores, Novos seguidores (as 3 linhas), Engajamento (4 métricas) → via `meta-proxy` (que já resolve o token server-side; o front nunca vê token), com a janela exata da seção 2.1.
- **Gráficos/histórico/comparativos:** continuam lendo as tabelas coletadas (rápido; a forma da tendência não precisa ser exata ao número).
- **meta-proxy:** estender/usar pra buscar `insights` da conta IG (hoje ele já faz chamadas Meta pra Ads na GT). Uma rota/endpoint que recebe `{accountId, metric, breakdown, since, until}` e devolve os números.

## 4. Estados e erros (nunca número falso)

- **Carregando:** spinner nos KPIs enquanto a chamada ao vivo roda (troca de período mostra "atualizando…").
- **Falha da Meta (timeout/queda):** cair no **último valor coletado** com selo honesto "não foi possível atualizar ao vivo — mostrando a última coleta (DD/MM HH:MM)". Nunca inventar.
- **Cota/limite:** cachear o resultado por período por alguns minutos (evita rechamar a cada re-render).

## 5. Consistência gráfico × KPI

O gráfico "novos/dia" usa o dado coletado diário (que subconta). O KPI usa o ao-vivo exato. Para não haver contradição visível (soma das barras ≠ headline):
- **Decisão:** o gráfico permanece como **tendência** (forma dia-a-dia), e o headline é o número exato. Opcional (fase 2): buscar também o diário ao vivo na janela deslocada para o gráfico bater com o headline. Documentar a escolha.

## 6. Extensões (mesmo padrão ao vivo — depois do núcleo)

Uma vez que o KPI ao vivo funciona, estes entram no mesmo encanamento:
- **Investimento = todas as campanhas** (já é ao vivo na GT via meta-proxy; somar todas no período; validar R$ 10.442,58).
- **Stories: seguidores × não-seguidores (%) + barrinha** — o `reach` com `breakdown=follow_type` **funciona** (probe: seguidores 4.816 / não-seguidores 1.007.983 no nível conta). Para stories especificamente, probar o breakdown a nível de story.
- **Alcance de stories (Visão Geral)** e **collabs na contagem de posts** — probar a chamada certa (mesmo método server-side).

## 7. Não-objetivos / cuidados

- **Não reformar o coletor** para os KPIs (eles vão ao vivo). O coletor segue como está para gráficos/histórico. (Opcional futuro: corrigir o coletor pra também guardar o agregado certo, como backup offline.)
- **Vale pra todos os perfis** — a janela é calculada por período, sem hardcode de perfil.
- **Remover a função-probe temporária** (`probe-fidelidade`) ao final.
- Produção no ar: branch → validar (bater com o painel no "mês passado" + conferir outro período) → merge; rollback via `git revert`.

## 8. Critérios de sucesso

1. Total seguidores, Novos (1.281/571/710) e Engajamento (1.651.342/1.014.049/9.926/9.108) batem **exatos** no "mês passado".
2. Trocar pra 7d/30d/mês atual → números coerentes e fiéis (ao vivo, janela certa).
3. Meta fora do ar → selo honesto + último coletado (sem número falso).
4. Funciona em **todos os perfis**.
5. Sem regressão no desktop; tela continua utilizável (loading suave).
