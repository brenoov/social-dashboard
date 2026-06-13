# Gestor Comercial — Agente de IA (design)

Data: 2026-06-12 · Projeto: iamundi / social-dashboard (marca Vessel — bolsas, varejo + atacado)

## Visão geral

Um **agente de IA autônomo** com a persona de **gestor comercial veterano de varejo e atacado**.
Toda semana ele analisa os números comerciais reais + o movimento dos concorrentes e
escreve um **briefing estratégico** priorizando **ações promocionais**. O briefing é
gravado no banco e exibido num **módulo novo do dashboard** ("Gestão Comercial"),
no mesmo padrão editorial do Portal de Notícias.

Mesma arquitetura do coletor de notícias já existente (ver [[project_iamundi_noticias]]):
GitHub Actions (cron) → script Node → Claude (Opus 4.8) → grava no Supabase → módulo lê.

## Objetivo / não-objetivo

**Objetivo:** dar ao gestor (humano) um diagnóstico semanal acionável: onde os canais
foco estão vs meta, como reagir aos concorrentes, o que preparar no calendário comercial,
e quem (vendedor/canal) precisa de atenção.

**Não-objetivo (agora):** executar promoções automaticamente, mexer em preço no Bling,
enviar para WhatsApp/e-mail (fica só no dashboard nesta fase), previsão estatística avançada.

## Canais foco (destaque total)

| Apelido do usuário | Canal no Bling | loja_id |
|---|---|---|
| Shopping Tivoli | Loja Santa Bárbara d'Oeste | 205834140 |
| Shopping Dom Pedro | Loja Dom Pedro | 205657609 |
| Atacado Nuvem Shop | Atacado Nuvem Shop | 205451611 |

Os outros 11 canais entram como pano de fundo/comparação, não no foco principal.

## Enhancement pendente: 5ª frente — Estoque por armazém (PENDE escopo do Bling)

Requisito adicional (pedido em 2026-06-12): o gestor deve olhar o **estoque de cada
armazém** e sugerir **ações no item** (ex.: promoção em produto parado/encalhado, empurrar
item com sobra, evitar promover o que está acabando).

**BLOQUEIO:** o token OAuth do Bling usado pelo `bling-proxy` só tem escopo de
**pedidos/vendas**. Os endpoints `depositos`, `produtos` e `estoques/saldos` retornam
**403 `insufficient_scope`**. Para liberar, o app do Bling precisa ser re-autorizado
incluindo os escopos **Produtos** e **Estoques** (ação no painel do Bling do usuário;
possível ajuste no fluxo de auth do `bling-proxy`).

**Quando liberar, implementar:** buscar saldo por depósito (`estoques/saldos` / `produtos`),
identificar itens com sobra (giro baixo / estoque alto) vs. ruptura, e incluir no pacote de
dados do agente uma seção de estoque; adicionar ao prompt a seção `## Estoque & ações no
item` (promoção/queima por item e por armazém). Mapear depósito↔canal foco.

## As 4 frentes de análise (cada briefing cobre todas)

1. **Meta vs venda real (R$)** — por canal foco: faturamento do mês corrente vs a meta
   diária acumulada (`bling_metas.daily_goals`); está adiantado/atrasado; projeção de
   fechamento do mês no ritmo atual.
2. **Reação ao concorrente** — cruza com `noticias_concorrentes` (promoções, lançamentos,
   campanhas recentes dos concorrentes) → resposta promocional sugerida.
3. **Calendário comercial** — próximas datas comerciais relevantes (Dia das Mães, Black
   Friday, Copa, Natal, etc., que o LLM conhece) → ações a preparar com antecedência.
4. **Performance (vendedores e canais)** — quem puxa, quem trava; ritmo de pedidos/itens
   por vendedor e por canal; onde concentrar esforço promocional.

## Fontes de dados e acesso

| Dado | Fonte | Acesso pelo agente |
|---|---|---|
| Faturamento em R$ (pedidos com valor, por canal) | API do Bling via edge function `bling-proxy` | **Conta de serviço (abordagem A):** usuário dedicado do dashboard; login+senha em segredos; o agente faz `signInWithPassword`, pega o `access_token` e chama o `bling-proxy` existente (sem alterar o edge function) |
| Metas em R$ + meta diária | tabela `bling_metas` (`meta_valor`, `daily_goals`) | REST com service key |
| Vendedores / pedidos (volume, data) | `bling_pedido_vendedor`, `bling_vendedores` | REST com service key |
| Vendedor → loja/canal | derivado do canal do pedido (Bling) | via `bling-proxy` (o pedido traz a loja/canal) |
| Concorrentes | `noticias_concorrentes` | REST com service key |

**Decisão de dados:** os pedidos sincronizados localmente (`bling_pedido_vendedor`) só têm
quantidade de itens, não R$. O faturamento real em R$ vem **ao vivo do Bling** via o
`bling-proxy` (mesma fonte do painel Gestão à Vista). Por isso a abordagem A (conta de
serviço) é necessária — o agente precisa de um token de usuário pra chamar o proxy.

## Saída: o briefing

Cada rodada gera **um briefing** = texto estruturado (markdown), com seções:
- **Resumo executivo** (3-5 bullets do que importa essa semana)
- **Ritmo das metas** (por canal foco: % da meta, adiantado/atrasado, projeção)
- **Frente competitiva** (o que os concorrentes fizeram + resposta sugerida)
- **Calendário** (próximas datas + preparação)
- **Performance** (destaques e alertas de vendedores/canais)
- **Ações priorizadas** (lista numerada: o quê, onde, urgência)

Gravado na tabela nova `gestao_comercial_briefings`:

```
id            uuid pk default gen_random_uuid()
rodada        date not null default current_date
periodo       text            -- ex.: 'Semana de 09-15/jun/2026'
resumo        text            -- resumo executivo (curto, p/ card)
conteudo      text not null   -- briefing completo em markdown
dados_json    jsonb           -- números crus usados (auditoria/gráficos futuros)
created_at    timestamptz not null default now()
```

RLS: leitura para `authenticated`; escrita só service_role (igual `noticias_concorrentes`).
Observabilidade: tabela de log própria `gestor_log` (mesma estrutura de `coletor_log`).

## Módulo no dashboard ("Gestão Comercial")

Tela nova `#gestao-comercial-screen`, padrão editorial (como o Portal de Notícias):
- Topbar com título + data da última edição.
- Briefing mais recente em destaque (resumo + conteúdo renderizado de markdown).
- Histórico de briefings anteriores (lista por data).
- Gateada por permissão própria (novo submódulo = nova permissão, ver
  [[feedback_iamundi_submodulo_permissao]]).
- Editar `index.html` e `v1.3.html` em sincronia (ver [[project_iamundi_deploy]]).

## Fluxo do agente (script Node, GitHub Actions)

1. Log "inicio" no log de bordo.
2. Autentica como conta de serviço (signInWithPassword) → access_token.
3. Coleta dados:
   - Pedidos com R$ dos 3 canais foco (mês corrente) via `bling-proxy`.
   - Metas do mês (`bling_metas`) dos canais foco.
   - Pedidos/vendedores recentes (volume) via REST.
   - Notícias recentes de concorrentes (`noticias_concorrentes`, últimas ~2 semanas).
4. Monta um pacote de números crus + contexto.
5. Chama Claude (Opus 4.8) com a persona de gestor veterano → recebe o briefing (markdown)
   e um `dados_json` resumido.
6. Grava em `gestao_comercial_briefings` (REST, service key).
7. Log "fim" com métricas.

## Agendamento

Cron **semanal, segunda 11:00 UTC (08:00 BRT)** (`0 11 * * 1`) + `workflow_dispatch`.

## Segredos (GitHub Secrets)

- `ANTHROPIC_API_KEY_GESTOR` — **key separada** (novo agente, custo rastreado à parte).
- `SUPABASE_SERVICE_KEY` — já existe (reuso).
- `GESTOR_USER_EMAIL` / `GESTOR_USER_PASSWORD` — conta de serviço do dashboard (a criar).

## Custo

Uma chamada grande por semana (sem buscas web pesadas — só análise dos números + notícias
já no banco). Estimativa: ~US$0,10–0,50 por rodada com Opus 4.8 → poucos dólares/mês.
Medir real na 1ª rodada lendo `usage`.

## Fases

- **F1 — Backend do agente:** migration da tabela + script Node (coleta + Claude + grava) +
  conta de serviço + workflow semanal. Validar gerando 1 briefing real.
- **F2 — Módulo no dashboard:** tela "Gestão Comercial" (editorial) + permissão + sync
  index/v1.3 + deploy.

## Riscos / pontos a verificar na implementação

- **Auth headless do bling-proxy:** confirmar que `signInWithPassword` de um usuário comum
  gera token aceito pelo `bling-proxy` (deve, é o mesmo fluxo do app). Plano B: abordagem B
  (tabela de sync) se o proxy exigir algo além do JWT.
- **Mapa vendedor→canal:** confirmar que o pedido do Bling traz a loja/canal de forma
  consistente para os 3 focos.
- **daily_goals:** validar o formato (JSON dia→valor) e somar corretamente até "hoje" para
  o cálculo de adiantado/atrasado.
- **Fuso:** `rodada`/datas em horário correto (Bling usa America/Sao_Paulo; cuidado com UTC).
