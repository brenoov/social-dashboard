# Budget Inteligente (IA) + pausar sempre + status vencido — Gestão de Tráfego

**Data:** 2026-07-02
**Status:** Design aprovado e RECONCILIADO com o código atual — aguardando plano
**Autor:** brenoov (+ Claude)
**Frente:** melhoria #3 do pacote de dashboards (incorpora parte da #4)

---

## 0. Reconciliação com o código atual (importante)

Ao ler o código de verdade, descobri que a Gestão de Tráfego (`index.html`) **já é bem mais avançada** do que a memória registrava. O que **já existe e NÃO será refeito**:

- **Motor de recomendação client-side** (`_gtInlineSuggest` L8092 / `_gtInlineSuggestAd` L8129 / `_gtVerdict` / `GT_CRIT` / `GT_POSTURAS`): roda **a cada vez que a tela abre**, com vereditos (escalar/reduzir/pausar/saudável), **postura** (Conservadora/Equilibrada/Agressiva, salva em localStorage) e critérios explicados (`gtCriterios()`). **Isto é o "refino da semana"** — não precisa de robô no servidor.
- **Escrita no Meta** já funciona: `_gtApplyAction` (L8384) → `metaPost` (L8320, via `meta-proxy`, com JWT do usuário), com modal de confirmação `_gtConfirm` (L8335). Já trata `update_budget`, `pause_campaign`, `activate_campaign`, **`pause_ad` e `activate_ad`**.
- **Status real** (`effective_status`) já é buscado, exibido (selos Ativo/Pausado/Arquivado) e filtrado (Todas/Ativas/Inativas) em `loadGtData` (L7950) e `_renderGtCampaigns` (L8164).
- **±25% de budget** existe (`mkBudget`, L8108).

**Consequência:** o botão de pausar campanha/anúncio **já aparece — porém só quando o motor recomenda**. Campanha/anúncio "saudável" não tem botão. E a "IA" de hoje é **motor de regras**, não LLM.

⚠️ **Drift de repo:** o `meta-proxy` é chamado pelo app (`metaFetch`/`metaPost`) mas **não tem arquivo em `supabase/functions/`** — produção está à frente do repo. Não mexemos nele aqui; ficará o registro. (Os robôs de servidor **não** usam o meta-proxy — vão direto ao Graph, ver §4.)

## 1. O que este projeto entrega (escopo real)

1. **IA de verdade (Opus 4.8, semanal):** um robô roda toda segunda no servidor (sem note aberto), analisa **só as campanhas em veiculação real**, e grava por campanha: **budget sugerido personalizado**, **veredito**, **justificativa** e **estimativa de impacto**. Substitui o ±25% fixo por um número pensado.
2. **Tela lê essa base** e mostra a sugestão do Opus (com selo de frescor), a justificativa e o impacto; o **motor client-side existente** refina isso ao abrir. Botão **Aplicar** (reusa a escrita que já existe) + **campo de budget manual** (novo).
3. **Botão de pausar/reativar SEMPRE disponível** por campanha e por anúncio (não só quando o motor sugere) — a execução já existe; falta só sempre oferecer o controle.
4. **Status vencido (resto da #4):** campanha cujo `stop_time` já passou não conta como "ativa" (não vai pro Opus, e a tela marca "Encerrada").

## 2. Fluxo

```
┌─ Segunda de manhã (GitHub Actions, chave Anthropic dedicada) ─┐
│ lê accounts.access_token (service role) → Graph DIRETO         │
│   → campanhas em veiculação real (ACTIVE, stop_time no futuro) │
│   → Opus 4.8 (1 chamada por campanha)                          │
│   → grava base da semana em gt_budget_analises                 │
└────────────────────────────────────────────────────────────────┘
        │ base guardada, válida até a próxima segunda
        ▼
┌─ Tela Gestão de Tráfego (abre → ao vivo + lê a tabela) ───────┐
│ motor client-side (JÁ EXISTE) refina com números frescos       │
│ por campanha: budget atual · SUGERIDO (Opus) · veredito ·      │
│   justificativa · impacto · [Aplicar] · [campo manual R$] ·    │
│   [Pausar/Reativar] (sempre)                                    │
│ por anúncio: [Pausar/Reativar anúncio] (sempre)                │
│ campanha vencida (stop_time passado): selo "Encerrada"         │
└────────────────────────────────────────────────────────────────┘
```

Sem robô no servidor durante a semana: o motor client-side que já existe faz o refino no instante em que a tela abre.

## 3. Robô de segunda (Opus 4.8, chave dedicada) — o núcleo novo

- **Onde roda:** GitHub Actions agendado (cron toda segunda de manhã), espelhando `.github/workflows/gestor-comercial.yml` + `coletor/gestor-comercial.mjs`. Arquivos novos: `.github/workflows/budget-ia.yml` + `coletor/budget-ia.mjs`.
- **Secrets (o Claude nunca vê o valor):**
  - `ANTHROPIC_API_KEY_BUDGET` — chave Anthropic **dedicada** (conta/crédito próprios do Breno).
  - `SUPABASE_SERVICE_KEY` — pra ler `accounts.access_token` e gravar em `gt_budget_analises` (mesmo secret já usado pelo gestor).
- **Acesso ao Meta:** igual `coletar-dados` — lê `accounts.access_token` via service role e chama o **Graph direto** (`https://graph.facebook.com/v21.0`). **Não usa meta-proxy** (que exige JWT de usuário).
- **Passos:**
  1. Pra cada conta ativa, lista campanhas `effective_status=ACTIVE` **cujo `stop_time` é futuro ou vazio** (em veiculação real). Puxa insights por campanha (spend, impressões, cliques, CTR, CPC, ROAS/valor de conversão, resultados do objetivo, frequência, budget atual daily/lifetime).
  2. 1 chamada **Opus 4.8** (`claude-opus-4-8`) por campanha, com **saída estruturada** (JSON): `{ budget_sugerido_centavos:int, veredito:'escalar'|'reduzir'|'manter'|'pausar', justificativa:string, impacto_estimado:string }`. Prompt fixo respeita o objetivo (Vendas→ROAS/CAC; Tráfego→CPC/CTR; etc.), evita agressividade sem dado, marca `pausar` quando o gasto não se justifica.
  3. `upsert` em `gt_budget_analises` (por `campaign_id`): `modelo='opus-4-8'`, `gerado_em=now`, `valida_ate=próxima segunda`.
- **Resiliência:** campanha que falhar (timeout/refusal/erro) é pulada e registrada; o lote continua (mesmo padrão de retry do `anthropic()` do gestor: 429/5xx com backoff).
- **Custo:** ~1 chamada Opus/campanha ativa (~1,5k in + ~0,5k out ≈ US$0,02). ~20 ativas ≈ **US$0,40/semana** (~R$2-3). Cache do prompt fixo barateia o lote.

## 4. Refino da semana = motor client-side existente (sem construir nada novo)

Nada de Edge Function nem pg_cron. O motor `_gtInlineSuggest`/`_gtInlineSuggestAd` **já roda a cada abertura** da tela com os números ao vivo. Ele passa a **combinar** com a base do Opus: a base do Opus é a âncora (budget sugerido + justificativa + impacto), e o motor de regras ajusta o veredito/urgência conforme a performance da semana. Se não houver base do Opus pra uma campanha (ex.: campanha nova entre segundas), a tela cai no comportamento atual do motor.

## 5. A tela (Gestão de Tráfego)

No render de campanha (`_renderGtCampaigns` L8164, área de ação em L8269 via `_gtRenderActions`):

- **Budget atual** (ao vivo) + **Budget sugerido** vindo de `gt_budget_analises`, com selo de origem/frescor (ex.: "IA · 2ª feira") e o veredito.
- **Justificativa** e **estimativa de impacto** (com rótulo "estimativa da IA").
- **[Aplicar sugestão]** → `_gtApplyAction({type:'update_budget', id, budget:budget_sugerido_centavos, ...})` (fluxo existente, com confirmação).
- **Campo de budget manual** (novo): input R$/dia → aplica via o mesmo `update_budget`.
- **[Pausar]/[Reativar] SEMPRE** (novo comportamento): além dos botões contextuais do motor, sempre oferecer o toggle manual conforme o `effective_status` (ACTIVE→Pausar, PAUSED→Reativar). Reusa as ações `pause_campaign`/`activate_campaign` já existentes.

No render de anúncio (`_renderGtAds` L8291):
- **[Pausar]/[Reativar] anúncio SEMPRE** conforme o status do anúncio (reusa `pause_ad`/`activate_ad`, já suportados por `_gtApplyAction`).

Sem sugestão do Opus guardada, a campanha mostra "—/aguardando análise de 2ª" e mantém o motor de regras, o budget manual e o pausar funcionando.

## 6. Dados — tabela `gt_budget_analises`

Uma linha por campanha (chave `campaign_id`).

| Coluna | Tipo | Nota |
|---|---|---|
| `campaign_id` | text | PK |
| `account_id` | text | conta de anúncio (`accounts.id`) |
| `objetivo` | text | objective do Meta |
| `effective_status` | text | status na hora da análise |
| `budget_atual_centavos` | int | no momento da análise |
| `budget_sugerido_centavos` | int | do Opus |
| `veredito` | text | escalar/reduzir/manter/pausar |
| `justificativa` | text | PT |
| `impacto_estimado` | text | PT |
| `modelo` | text | `opus-4-8` |
| `gerado_em` | timestamptz | quando o Opus rodou |
| `valida_ate` | timestamptz | próxima segunda |

**RLS:** leitura pra quem tem a ferramenta (`p.role='admin' OR 'meta.gestor' = any(p.features)` — mesmo padrão de `gt_config_metricas`); **escrita só service role** (sem policy de write → deny; o robô usa service key que ignora RLS). A tela nunca escreve nessa tabela.

## 7. Status vencido (resto da #4)

- O robô só analisa campanhas `ACTIVE` com `stop_time` futuro/vazio.
- A tela: quando `effective_status==='ACTIVE'` mas `stop_time` já passou, mostra selo **"Encerrada"** (cor neutra) e **não** oferece pausar (já acabou) nem sugestão de escalar; só leitura. `daily_budget`/`stop_time` já vêm em `campFields`.

## 8. Segurança

- Chave Anthropic **dedicada**, só como *secret* no GitHub; o Claude **não** manipula o valor.
- A chave que o Breno colou no chat está **exposta → revogar e recriar** antes de configurar.
- Toda escrita no Meta passa pela confirmação `_gtConfirm` já existente; o budget manual também confirma antes de aplicar.
- Front é público; nenhuma chave (IA/Meta) vai pro client. Robô lê token via service role no servidor.
- Pausar/aplicar são reversíveis, mas exigem confirmação explícita.

## 9. Fora de escopo

- Redesign visual do Meta Ads (#5).
- Robô no servidor durante a semana / alertas automáticos (o motor client-side já refina ao abrir).
- Pausar em massa; painel completo de todos os `effective_status` do Meta.
- KPIs de custo na seção Meta Ads do Dashboard Redes Sociais (backlog separado).
- Personalização da sugestão por usuário (base é global).
- Consertar o drift do meta-proxy (registrar, não resolver aqui).

## 10. Critérios de sucesso

1. Toda segunda, campanhas em **veiculação real** ganham budget sugerido + veredito + justificativa + impacto em `gt_budget_analises`, sem note aberto.
2. A tela mostra a sugestão do Opus (com selo de frescor), impacto, **[Aplicar]** e **campo manual**, aplicando no Meta com confirmação; o motor client-side refina ao abrir.
3. Dá pra **pausar/reativar** qualquer campanha e qualquer anúncio pela tela (mesmo saudáveis), com confirmação.
4. Campanha com `stop_time` no passado aparece como **"Encerrada"** e **não** entra na análise do Opus.
5. Nenhuma chave sensível no client; leitura da tabela só pra quem tem a ferramenta; escrita só pelo robô.

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Saída do Opus fora do formato | Saída estruturada (JSON schema) + validação; inválido → não grava (fica "aguardando"). |
| Opus recusar (`refusal`)/timeout numa campanha | Pular e registrar; lote continua; base da semana não trava. |
| Combinar base do Opus + motor de regras confundir a UI | Selo claro de origem/frescor; motor só ajusta urgência, budget sugerido vem do Opus. |
| Sempre mostrar pausar poluir a UI | Botão manual discreto, separado dos botões de recomendação do motor. |
| `stop_time` ausente em algumas campanhas | Tratar vazio como "sem prazo" (não encerrada). |
| Muitas campanhas ativas → custo | 1x/semana + cache de prompt; monitorar nº de ativas. |
