# Redesign da Gestão de Tráfego — Direção A (recomendação da IA como estrela)

**Data:** 2026-07-03
**Status:** Design aprovado pelo Breno (mockup direção A) — aguardando revisão da spec
**Autor:** brenoov (+ Claude)
**Frente:** item #5 do backlog de dashboards (redesign visual). Só a **Gestão de Tráfego** neste passo; a seção "02 · Meta Ads" do dash social vem depois (spec própria, mais leve).

---

## 1. Problema (feedback do Breno)

A Gestão de Tráfego funciona (v2: Opus é a análise única, por campanha e por anúncio, anúncios desdobrados), mas o visual **confunde**:
- **Separação campanha × anúncio** pouco clara — bate o olho e não dá pra saber na hora o que é a campanha e o que é anúncio dela.
- **Falta ênfase** no que importa. O Breno definiu a prioridade: **a recomendação da IA é o que deve saltar aos olhos** (bater o olho → já saber a ação). As métricas são apoio.
- A edição **manual de orçamento** hoje fica solta/poluindo; precisa de um lugar melhor.

## 2. Estado atual (o que já existe e será reaproveitado)

- `_renderGtCampaigns` desenha cada campanha (`gt-camp-row`): badge de status, nome, métricas por objetivo (KPIs de `gt_config_metricas`), bloco do Opus (`_gtIABlocoHtml`) e o painel de anúncios auto-desdobrado.
- `_renderGtAds` desenha cada anúncio (`gt-ad-card`): badge, nome/adset, CTR/CPC/gasto, avaliação do Opus (`_gtAdIABlocoHtml`), toggle manual.
- Dados já carregados: `_gtBudgetIA[campaign_id]` (veredito/budget_sugerido_centavos/justificativa/impacto/gerado_em) e `_gtAdIA[ad_id]` (veredito manter/pausar/justificativa/gerado_em).
- Controles já existentes: `_gtWireBudgetControls` (Aplicar sugerido + campo manual → `_gtApplyAction update_budget`), `_gtManualToggleBtn` (pausar/reativar campanha e anúncio), `_gtEncerrada` (status Concluído).

**Este redesign é reestruturação de layout/CSS reaproveitando esses dados e controles.** Não muda robô, nem tabelas, nem a coleta.

## 3. Direção A — anatomia do cartão de campanha

Cada campanha é um cartão com **faixa de recomendação no topo** (a estrela) e o resto como apoio.

### 3.1 Faixa de recomendação (topo do cartão)
- **Cor da faixa pelo veredito** (borda esquerda grossa + fundo suave, tom semântico):
  - `escalar` e `manter` → **verde** (`--green`)
  - `reduzir` → **laranja** (`--orange`)
  - `pausar` → **vermelho** (`--red`)
- Conteúdo à esquerda: **veredito** (palavra grande, fonte Oswald, na cor semântica) + selo `✦ IA · <data gerado_em>` + **justificativa** em 1 linha.
- Conteúdo à direita = **área de ação da IA, que muda conforme o veredito** (é o caminho "aceitar a sugestão"):
  - **escalar / reduzir:** orçamento atual **riscado** → **sugerido em número grande** (Oswald) + botão **`Aplicar R$X/dia`** (primário, aplica o valor sugerido).
  - **manter:** rótulo `Manter R$X/dia` (é o atual; sem botão Aplicar destacado — não há mudança sugerida).
  - **pausar:** a ação-herói é **`⏸ Pausar campanha`** (botão vermelho) — sem bloco de budget. (O toggle manual da seção 3.2 cobre reativar.)
- **Impacto estimado** (se houver) entra como linha fininha de apoio abaixo da justificativa, não compete com o veredito.
- A **edição manual** do orçamento NÃO fica aqui (é independente da IA) — ver 3.2.

### 3.2 Corpo do cartão (apoio)
- Linha com **badge de status real** (Ativo/Pausado/Concluído/Arquivado — reusa `_gtEncerrada` + effective_status) + **nome da campanha**.
- **Métricas por objetivo** (as que já existem) em tamanho de apoio: rótulo pequeno em maiúsculas + número (Oswald). O número-chave do objetivo (ex.: CTR pra tráfego) pode ganhar a cor semântica (verde/vermelho) conforme já faz hoje.
- **Edição manual de orçamento — SEMPRE disponível, independente da IA.** No corpo/rodapé do cartão, um controle discreto `Orçamento: R$X/dia · ✎ editar` que revela um campo compacto `R$__/dia` + `Aplicar`. Fica visível **em todos os casos** — inclusive quando a IA diz "manter", quando manda "pausar", e quando ainda não há análise — desde que a campanha use orçamento diário. É o caminho manual, separado da sugestão da IA (o Breno quer poder mexer no orçamento mesmo sem a IA sugerir mudança). Reusa `_gtApplyAction update_budget`.
- **Pausar/reativar manual** (`_gtManualToggleBtn`) sempre disponível como botão discreto no rodapé do cartão (independente do veredito).

### 3.3 Estados especiais da faixa
- **Sem análise ainda** (`_gtBudgetIA[id]` ausente): faixa **cinza neutra** com texto `Análise em breve — o robô avalia toda semana`. Sem cor de veredito, sem budget, sem Aplicar. As métricas de apoio aparecem normalmente.
- **Campanha PAUSADA ou CONCLUÍDA:** faixa **neutra** (cinza), **nunca** sugere escalar. Se houver última análise, mostra a justificativa **apagadinha** (muted) como histórico; sem botão Aplicar. Reativar continua no toggle manual (quando `PAUSED`).
- **Campanha sem budget diário** (usa lifetime/CBO): a área de ação omite o número/dia; mostra só o veredito + justificativa (e Aplicar fica indisponível, como já trata `_gtWireBudgetControls`).

## 4. Anúncios desdobrados (dentro do cartão da campanha)

Deixar **inequívoco** que são filhos da campanha: recuados (indentação + fio/borda de conexão à esquerda), visualmente **menores** que o cartão da campanha.

Cada anúncio:
- **Pílula de veredito** colorida à esquerda: `Manter` (verde) / `Pausar` (vermelho) — vinda de `_gtAdIA[ad_id]`.
- **Nome** do anúncio (+ adset em cinza) e, ao lado, **o porquê curto** (justificativa do Opus, 1 frase, muted).
- **1 métrica-chave** (ex.: CTR) com cor semântica.
- **Pausar/reativar manual** do anúncio (`_gtManualToggleBtn('ad',…)`).
- **Sem avaliação do Opus** pra aquele anúncio: sem pílula; mostra só status + métrica + toggle.

Cabeçalho da lista: `Anúncios (N)` com um fio separando do corpo da campanha.

## 5. Cores e tipografia (do próprio app)

- Semânticas já existentes: `--green #1a6e45` / `--yellow #8a6200` / `--orange #b85800` / `--red #b01e3a` (e as variantes dark). **Não** inventar cores novas — veredito usa essas.
- Números em **Oswald** (`font-family:'Oswald'`), textos em **IBM Plex Sans** — como o resto do app.
- Respeitar **tema claro/escuro** (as faixas usam fundo suave via `rgba` do tom semântico, que funciona nos dois temas).
- **Não** reintroduzir cor de destaque por perfil (o accent segue fixo — ver fix da cor).

## 6. Fora de escopo (deste passo)

- Seção "02 · Meta Ads" do dashboard social — **próximo passo** (spec própria, aplicando a mesma linguagem de forma mais leve).
- Qualquer mudança no robô, tabelas (`gt_budget_analises`/`gt_ad_analises`), coleta ou permissões.
- Budget por anúncio (a Meta não tem; segue no nível campanha/conjunto).
- Paginação/filtros novos (o filtro Ativas/status atual permanece).

## 7. Critérios de sucesso

1. Bater o olho num cartão e **já saber a ação recomendada** (veredito + cor) sem procurar.
2. **Distinção clara** campanha × anúncio (o anúncio "parece filho": recuado, menor, conectado).
3. A **edição manual de orçamento** está **sempre disponível e independente da IA** (o Breno pode ajustar o orçamento mesmo quando a IA sugere "manter", "pausar" ou não tem análise) — num controle `✎ editar` revelável, sem poluir a faixa.
4. Estados tratados sem quebrar: sem-análise, pausada, concluída, sem budget diário, anúncio sem avaliação.
5. Nada de comportamento perdido: Aplicar (sugerido e manual), pausar/reativar campanha e anúncio, status real, métricas por objetivo — tudo segue funcionando.
6. Fiel ao tema (claro/escuro), sem cores novas fora das semânticas, Oswald/IBM Plex.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Reestruturar `_renderGtCampaigns`/`_renderGtAds` quebrar controles do Opus | Reaproveitar `_gtWireBudgetControls`/`_gtManualToggleBtn` intactos; só muda a marcação/CSS ao redor; `node --check` + validação visual do Breno. |
| Faixa colorida poluir no claro/escuro | Fundo semântico via `rgba` de baixa opacidade (testado nos 2 temas); texto sempre no tom cheio da cor. |
| Veredito `pausar` sem budget confundir a área de ação | Área de ação é condicional ao veredito (3.1): pausar mostra botão Pausar, não budget. |
| Muitos anúncios inflarem o cartão | Já é auto-desdobrado (v2); manter recuo/altura contida; se necessário, ordenar por gasto (já ordena). |
| Métrica-chave colorida divergir do que o robô considera | A cor da métrica é heurística visual de apoio; a decisão é sempre a do Opus na faixa. |
