# IG Dashboard — HOJE em tempo real + correção do indicador de Stories

Data: 2026-06-02
Arquivo afetado: `projetos/central-inteligencia/central-inteligencia-v1.3.html` (função `fetchData` + `buildChart`/`update` da tela de redes sociais). Sempre `cp` para `index.html` e `git push` após editar.

## Contexto / Problema

A tela de redes sociais usa a métrica `follows_and_unfollows` (gained/lost por dia) para "novos vs saíram". Essa métrica **consolida com ~1 dia de atraso** — o dia corrente volta 0. Resultado: o período **HOJE** fica 0/vazio.

Limitação factual (não contornável): **não existe** follows/unfollows **brutos em tempo real** na Graph API. O único sinal de tempo real é a **contagem total** de seguidores (`followers_count`), que dá o **líquido** do dia ao vivo, sem o detalhamento novos/saíram.

Bug correlato descoberto: o **indicador de Stories mostra o mesmo número em HOJE e 1D**. Causa: o coletor grava o stories de hoje nas duas linhas `content_snapshots.period_days=0` e `=1` (idênticas), e o dashboard lê o "último snapshot" para HOJE/1D — então ambos pegam o stories de hoje.

## Decisões travadas

- HOJE: mostrar **líquido em tempo real** via variação da contagem total (sem chamada nova à Graph API, sem token no navegador) — **Opção A**.
- Fonte do "total agora": último `daily_snapshots.followers_count` de hoje (atualizado a cada coleta, 4×/dia). Sem chamada ao vivo.
- Bruto (▲/▼) em tempo real: **fora de escopo** (impossível pela API).

## Seção 1 — Indicador "Novos no período" no HOJE

- **Número principal = líquido em tempo real** = `followers_count(hoje)` − `followers_count(ontem)`, ambos de `daily_snapshots` (BRT). Pode ser positivo ou negativo; cor por sinal como já é.
- A **sublinha ▲ novos · ▼ saíram é substituída**, só no HOJE, por uma nota discreta: *"líquido em tempo real · novos/saíram consolidam amanhã"*.
- Demais períodos (1D, 7D, 14D, 30D, MÊS, MÊS PASS, ATÉ AGORA) **não mudam**: continuam com o bruto real (▲/▼ + barras divergentes).
- Borda: se não houver snapshot de hoje ainda, usar o snapshot mais recente como "hoje"; se não houver o de ontem, o líquido fica indisponível (mostra 0 + a nota).

## Seção 2 — Gráfico de evolução no HOJE

- No HOJE, as barras novos/saíram do dia não existem (consolidam amanhã) e um único dia não forma série.
- Comportamento: no **HOJE**, o gráfico mostra os **últimos 7 dias** de barras divergentes (dias já consolidados) como **contexto recente**; o indicador grande acima mostra o líquido de hoje em tempo real.
- Implementação: quando `period===0`, montar os dados do gráfico (gained/lost por dia) a partir dos últimos 7 dias consolidados (mesma origem `daily_snapshots.gained/lost`), independente da janela do indicador.

## Seção 3 — Indicador de Stories (correção por-dia)

Stories (postados, shares, replies) é métrica **diária**. Computar como **soma dos valores diários dentro da janela do período**, pelas datas `captured_at`, usando as mesmas janelas de novos/saíram (`followStart`/`followEnd`):

| Período | Stories |
|---|---|
| HOJE | dia de hoje |
| 1D | dia de ontem (corrige o bug) |
| 7D / 14D / 30D | soma dos dias da janela |
| MÊS / ATÉ AGORA | soma do mês corrente |
| MÊS PASS | soma do mês anterior |

- Vale para **stories_count, story_shares, story_replies**.
- Fonte: `content_snapshots` com `period_days=1` (linha diária, uma por `captured_at`), somando por data dentro de `[followStart, followEnd]`. (period_days 0 e 1 são idênticos; usar 1 cobre todos os dias.)
- Comparação "vs período anterior": somar a janela anterior equivalente (`[prevStartStr, prevEndStr]`).
- **Posts e Reels NÃO mudam** — são agregados por período (cumulativos), continuam lendo o snapshot do `storedPeriod`.
- **Sem mudança no coletor / sem re-coleta**: os dados diários já existem.

## Fora de escopo

- Bruto novos/saíram em tempo real (limitação da API).
- Proxy via Edge Function para tirar o token do navegador (é o F5; tratado separadamente).
- Coletor: nenhuma mudança.

## Notas de implementação (orientação)

- Em `fetchData`, já existem `followStart`/`followEnd` (janela dia-precisa por período) e `prevStartStr`/`prevEndStr` (janela anterior). Reusar para stories.
- Seção 1: detectar `isHoje` e, nesse caso, derivar `newFollowers` do delta de `followers_count` (hoje − ontem) em vez do bruto; sinalizar para `update()` trocar a sublinha pela nota.
- Seção 2: quando `isHoje`, popular `chart={gained,lost,labels,dates}` com os últimos 7 dias consolidados.
- Seção 3: substituir o cálculo de `storiesCount`/`storyShares`/`storyRep` (e os `prev*`) por somas das linhas diárias `period_days=1` dentro das janelas.
- Verificar sintaxe (node nos `<script>` inline) e `cp` para `index.html` + `git push` ao final.
