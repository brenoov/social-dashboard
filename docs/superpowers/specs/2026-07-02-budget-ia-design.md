# Budget Inteligente (IA) + Pausar campanhas/anúncios — Gestão de Tráfego

**Data:** 2026-07-02
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** brenoov (+ Claude)
**Frente:** melhoria #3 do pacote de dashboards (incorpora parte da #4)

---

## 1. Problema

Hoje a **Gestão de Tráfego** (`meta.gestor`) sugere ajuste de budget com um botão **fixo de +25% / −25%** (`_gtInlineSuggest` → `mkBudget(1.25)` / `mkBudget(0.75)`), igual pra toda campanha, sem olhar objetivo, performance ou histórico. Não há recomendação personalizada, nem estimativa de impacto, nem forma de digitar um budget na mão. Além disso, campanhas **concluídas aparecem como se estivessem ativas** (o app não filtra pelo status real do Meta), e não há como **pausar um anúncio individual** pela tela.

**Objetivo:** substituir o ±25% fixo por uma **recomendação de budget personalizada gerada por IA (Opus 4.8)**, com **veredito**, **justificativa** e **estimativa de impacto**; permitir **aplicar a sugestão** ou **digitar um budget manual**; e permitir **pausar/reativar campanhas e anúncios individuais** — tudo respeitando o **status real** das campanhas.

## 2. A jogada (visão geral)

Dois "robôs" rodam no servidor, sem depender do note do usuário:

- **Robô de segunda (caro, esperto):** 1x/semana, **Opus 4.8 via API**, analisa a fundo **só as campanhas ativas de verdade** e gera a **base da semana** (budget sugerido + veredito + justificativa + impacto por campanha).
- **Robô da semana (barato, automático):** roda diariamente **sem chamar a API** (custo zero); reajusta a base da segunda conforme a performance real muda ao longo da semana, usando o **motor de regras** que o app já tem.

A tela **lê** o que os robôs guardaram e mostra por campanha, mais os controles de pausar. A tela continua puxando os números **ao vivo** do Meta (via `metaFetchAll`/meta-proxy) — a novidade é ler também a tabela de sugestões e oferecer os botões de escrita.

```
┌─ Segunda (GitHub Actions, chave dedicada) ─────────────┐
│ meta-proxy → campanhas ATIVAS (status real) + insights │
│   → Opus 4.8 (1 chamada por campanha)                  │
│   → grava base da semana em gt_budget_analises          │
└────────────────────────────────────────────────────────┘
        │ base válida até a próxima segunda
        ▼
┌─ Durante a semana (Edge Function via pg_cron, sem API) ─┐
│ meta-proxy → números frescos                            │
│   → motor de regras reajusta a base                     │
│   → atualiza gt_budget_analises (refino)                │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Tela Gestão de Tráfego (ao vivo + lê a tabela) ────────┐
│ por campanha: budget atual · sugerido · veredito ·      │
│   justificativa · impacto · [Aplicar] · [Budget manual] │
│   · [Pausar/Reativar campanha]                          │
│ por anúncio: [Pausar/Reativar anúncio]                  │
└─────────────────────────────────────────────────────────┘
```

## 3. Estado atual (o que já existe)

- **Escrita no Meta já existe** em `_gtInlineSuggest` (~`index.html:8092`): ações `update_budget` (`mkBudget`, L8108-8109), `pause_campaign` e `activate_campaign` (L8110-8111), todas com diálogo de confirmação. Falta: `pause_ad` / `activate_ad` (nível do anúncio).
- **Botão "Analisar com Agente IA"** (`#gt-analyze-btn`) existe na tela, mas **hoje NÃO chama LLM nenhum** — vai ser reaproveitado/religado.
- **Dados ao vivo:** `loadGtData` (~L7802) busca campanhas e anúncios com insights via meta-proxy; a query de campanhas já traz `effective_status,objective,daily_budget,lifetime_budget`. A #2 (KPIs por objetivo) já adicionou `action_values,purchase_roas`.
- **meta-proxy** (Edge Function): token do Meta server-side; contas via `/me/adaccounts`. Reusado pelos robôs (não se cria credencial nova do Meta).
- **pg_cron** já orquestra a Edge Function `coletar-dados` (4x/dia) — mesmo mecanismo será usado pelo robô da semana.
- **Gestor Comercial**: já existe um agente semanal (GitHub Actions, Opus 4.8) — é o **padrão de referência** de infra, mas o robô de budget usa **conta e chave próprias** (decisão do Breno).
- **Gate:** `hasPermission('module:meta:gestor')` (mapeia p/ feature `meta.gestor`; admin sempre tem). Toasts/modais: padrões do iamundi (`adminToast`, modais próprios) — não usar `alert` nativo.

## 4. Robô de segunda (Opus 4.8, chave dedicada)

- **Onde roda:** GitHub Actions agendado (cron toda segunda de manhã, horário SP). Repositório/workflow próprio do budget (não o do Gestor Comercial).
- **Credenciais (secrets do GitHub, o Claude nunca vê o valor):**
  - `ANTHROPIC_KEY_BUDGET` — chave Anthropic **dedicada** a essa ferramenta (conta/crédito próprios, criada pelo Breno).
  - `SUPABASE_SERVICE_ROLE` (ou equivalente já usado) — pra gravar em `gt_budget_analises`.
  - Acesso ao Meta: **via meta-proxy** (o robô invoca a Edge Function), reusando o token que já existe. Sem token novo do Meta.
- **Passos:**
  1. Lista as campanhas cujo **`effective_status` é de veiculação real** (ver §8 — status real). Campanha concluída/arquivada/pausada não entra na análise cara.
  2. Pra cada campanha ativa, monta um payload com: objetivo, budget atual (daily/lifetime), gasto, impressões, cliques, CTR, CPC, ROAS/valor de conversão, resultados do objetivo, e o histórico disponível.
  3. Chama **Opus 4.8** (`claude-opus-4-8`) — 1 chamada por campanha — pedindo **saída estruturada** (JSON validado) com:
     - `budget_sugerido_centavos` (inteiro)
     - `veredito` ∈ `escalar | reduzir | manter | pausar`
     - `justificativa` (texto curto, PT)
     - `impacto_estimado` (texto curto, PT — ex.: "+30% budget → ~+25% em compras, ROAS estável")
  4. Grava/atualiza a linha da campanha em `gt_budget_analises` com `modelo='opus-4-8'`, `gerado_em=now`, `valida_ate=próxima segunda`.
- **Priorização da IA:** o prompt instrui a IA a **respeitar o objetivo da campanha** (Vendas → ROAS/CAC; Tráfego → CPC/CTR; etc.), evitar recomendações agressivas sem dado, e marcar `pausar` quando a performance não justifica o gasto.
- **Resiliência:** se uma campanha falhar (timeout, refusal, erro), pula e registra; não derruba o lote inteiro. Reaproveita o padrão de resiliência do coletor.
- **Custo:** ~1 chamada Opus por campanha ativa (~1.5k tokens entrada + ~0.5k saída ≈ US$0,02/campanha). ~20 ativas ≈ **US$0,40/semana** (~R$2-3). Prompt fixo pode usar **cache** pra baratear o lote.

## 5. Robô da semana (motor de regras, sem API)

- **Onde roda:** Edge Function nova `refinar-budget`, agendada por **pg_cron** (ex.: 1x/dia; pode acompanhar o ritmo do coletor). **Não chama a Anthropic** — custo zero.
- **Passos:**
  1. Busca os números frescos do Meta (via meta-proxy) das campanhas que têm base da semana em `gt_budget_analises`.
  2. Aplica o **motor de regras** (a mesma lógica de `_gtInlineSuggest`, portada pra TS na Edge Function) em cima da base do Opus: se a performance melhorou/piorou desde segunda, ajusta `budget_refinado_centavos` e/ou marca alerta; mantém o veredito do Opus como âncora.
  3. Atualiza a linha com `budget_refinado_centavos`, `refinado_em`, e um `origem_refino` (ex.: "regra: ROAS caiu 20%").
- **Risco conhecido:** duplicação da lógica do motor de regras (client em JS × Edge em TS). Mitigação: manter as regras num bloco claramente marcado e documentado nos dois lugares, com os mesmos limiares; um teste compara as duas saídas em casos-âncora.

## 6. A tela (Gestão de Tráfego)

No render de cada campanha (`_renderGtCampaigns`, ~L7841), no lugar dos botões fixos ±25%:

- **Budget atual** (ao vivo) + **Budget sugerido** (da tabela), com selo de origem/frescor (ex.: "base 2ª feira · atualizado 3ª") e o **veredito** (escalar/reduzir/manter/pausar) com cor.
- **Justificativa** e **estimativa de impacto** (com aviso "estimativa da IA").
- **[Aplicar sugestão]** → chama `update_budget` (fluxo existente, com confirmação `adminToast`/modal).
- **Campo de budget manual** → o usuário digita R$ e aplica direto (reusa `update_budget`).
- **[Pausar/Reativar campanha]** → `pause_campaign` / `activate_campaign` (já existem), com confirmação.

Por **anúncio** (a tela já lista anúncios por campanha):
- **[Pausar/Reativar anúncio]** → ações **novas** `pause_ad` / `activate_ad` no nível do anúncio (`POST /{ad_id}` com `status=PAUSED|ACTIVE` via meta-proxy), com confirmação.

Sem sugestão guardada (ex.: campanha nova entre segundas), a tela mostra "—" / "aguardando análise" e mantém o budget manual e o pausar funcionando.

## 7. Dados — tabela `gt_budget_analises`

Uma linha por campanha ativa (chave por `campaign_id`; histórico opcional por `gerado_em`).

| Coluna | Tipo | Nota |
|---|---|---|
| `campaign_id` | text | PK |
| `account_id` | text | conta de anúncio |
| `objetivo` | text | objective do Meta |
| `effective_status` | text | status real na hora da análise |
| `budget_atual_centavos` | int | no momento da análise |
| `budget_sugerido_centavos` | int | do Opus |
| `veredito` | text | escalar/reduzir/manter/pausar |
| `justificativa` | text | PT |
| `impacto_estimado` | text | PT |
| `modelo` | text | `opus-4-8` |
| `gerado_em` | timestamptz | quando o Opus rodou |
| `valida_ate` | timestamptz | próxima segunda |
| `budget_refinado_centavos` | int | do robô da semana (nullable) |
| `refinado_em` | timestamptz | nullable |
| `origem_refino` | text | motivo do refino (nullable) |

**RLS:** leitura liberada pra quem tem acesso à ferramenta (`role='admin' OR 'meta.gestor' = any(profiles.features)` — mesmo padrão da #2 `gt_config_metricas`); **escrita só pelos robôs** (service role). Nenhuma escrita pela tela.

## 8. Status real (pedaço da #4)

- A query de campanhas já traz `effective_status`. Considera-se "ativa de verdade" o conjunto de status que o Meta trata como **em veiculação** (ex.: `ACTIVE`; e os pausados como `PAUSED`, concluídos/arquivados fora). A lista exata de status a incluir/excluir é fixada no código com base na documentação do Meta.
- O **robô de segunda** analisa **só** as ativas de verdade (não gasta Opus com campanha concluída).
- A **tela** passa a exibir o status real (badge) e usa isso pra habilitar Pausar (ativa) vs Reativar (pausada). O resto da #4 (ex.: pausar em massa, visão completa de todos os status) fica fora deste escopo.

## 9. Segurança

- Chave Anthropic **dedicada**, só como *secret* no GitHub; o Claude **não** manipula o valor em texto.
- A chave que o Breno colou no chat está **exposta → revogar e recriar** antes de configurar.
- Escrita no Meta (budget, pausar) sempre com **confirmação** na tela; toasts/modais do iamundi (não `alert`).
- Front é público (padrão do projeto) — nenhuma chave de IA ou do Meta vai pro client; toda escrita passa pelo meta-proxy.
- Ações de pausar/aplicar budget são **reversíveis**; ainda assim exigem confirmação explícita.

## 10. Fora de escopo

- Redesign visual do Meta Ads (#5).
- Resto da #4: pausar em massa, painel completo de todos os status.
- KPIs de custo na seção Meta Ads do **Dashboard Redes Sociais** (backlog separado).
- Personalização da sugestão por usuário (a base é global).

## 11. Critérios de sucesso

1. Toda segunda, as campanhas **ativas de verdade** recebem budget sugerido + veredito + justificativa + impacto, guardados na tabela — sem note aberto.
2. Durante a semana, a sugestão se **atualiza sozinha** conforme a performance muda, **sem gastar API**.
3. A tela mostra, por campanha, a sugestão (com frescor/veredito), o impacto, o botão **Aplicar** e o **campo manual**, e aplica no Meta com confirmação.
4. É possível **pausar/reativar** campanha e **anúncio individual** pela tela, com confirmação, refletindo o resultado.
5. Campanhas concluídas **não** entram na análise cara nem aparecem como "ativas".
6. Nenhuma chave sensível no client; escrita só via meta-proxy; leitura da tabela só pra quem tem a ferramenta.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| meta-proxy não deixar o robô (server-side) invocar sem JWT de usuário | Definir no plano como o robô autentica (service role / chave de serviço); testar cedo. |
| Duplicação do motor de regras (client × Edge) diverge | Bloco marcado nos dois lados, mesmos limiares, teste comparando saídas em casos-âncora. |
| Opus recusar (`refusal`) ou dar timeout numa campanha | Pular e registrar; lote continua; não bloquear a base da semana. |
| Saída do Opus fora do formato | Saída estruturada (JSON schema) + validação; se inválido, marca "sem sugestão". |
| `pause_ad` exigir permissão/campo que o token atual não tem | Testar cedo no meta-proxy; se faltar escopo, ajustar. |
| Estimativa de impacto ser lida como garantia | Rótulo explícito "estimativa da IA" na tela. |
| Custo escalar se muitas campanhas ativas | 1x/semana + cache de prompt; monitorar nº de ativas. |
