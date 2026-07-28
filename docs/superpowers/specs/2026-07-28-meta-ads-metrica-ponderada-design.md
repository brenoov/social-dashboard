# Meta Ads — Métrica Ponderada e Ferramenta Unificada

**Data:** 2026-07-28
**Status:** Design aprovado (brainstorm) → próximo: plano de implementação
**Pedido por:** Breno
**Origem:** planilha `metrica_ponderada.xlsx` (abas Config + Análise)

## Objetivo

Levar a lógica da **métrica ponderada** para dentro do iamundi: em vez de contar
interações no bruto, converter cada uma em **pontos** conforme o valor que ela
representa (um salvamento vale mais que uma curtida), e usar o **custo por ponto**
contra uma **meta editável** para decidir verba.

Junto disso, resolver a sobreposição entre as duas telas de Meta Ads: a **Gestão de
Tráfego** absorve a **Análise de Campanhas** e passa a ser a ferramenta única.

## Contexto: o que existe hoje

- **Gestão de Tráfego** (`/gestao-trafego`, 1.649 linhas): hierarquia campanha →
  conjunto → anúncio, recomendação (Opus semanal + regras ao vivo), edição de
  orçamento CBO/ABO, pausar/reativar (inclusive em massa), ver criativo, KPIs por
  objetivo configuráveis (`gt_config_metricas`).
- **Análise de Campanhas** (`/meta-campanhas`, 1.394 linhas): KPIs, funil de conversão
  por objetivo, período personalizado, ordenação por coluna, gaveta de filtro de
  campanhas (`campaign_filters`), saldo da conta.
- Mesmo público (11 de 15 perfis têm as duas permissões), mesma fonte de dados.
  A Análise mostra mas não deixa agir; quem precisa agir vai pra Gestão de Tráfego
  e não volta.

## Investigação da API (feita ao vivo em 2026-07-28, contas reais)

Tudo abaixo foi **verificado contra a Graph API v21.0** com o token de produção, não
assumido. Os scripts do probe ficaram no scratchpad da sessão.

### O que vem por ANÚNCIO (atribuível ao dinheiro gasto)

| Métrica | `action_type` | Versão líquida |
|---|---|---|
| Curtidas | `post_reaction` | `onsite_conversion.post_net_like` |
| Comentários | `comment` | `onsite_conversion.post_net_comment` |
| Salvamentos | `onsite_conversion.post_save` | `onsite_conversion.post_net_save` |
| Compartilhamentos | `post` | — |

Também existe a **escada de mensagens**, confirmada em Breno, Raíssa, Motoeasy e
Vessel: `messaging_conversation_started_7d`, `messaging_first_reply`,
`messaging_user_depth_2/3/5_message_send`, `messaging_conversation_replied_7d`,
`total_messaging_connection`.

**Não existem por anúncio:** encaminhamentos, republicações e seguidores.

### A ligação anúncio → post orgânico

- `effective_instagram_media_id` é a mídia **do anúncio** e **não aceita insights**
  (a Meta responde "não suportado" / "só para reels orgânicos"). Em 143 anúncios
  testados nas 5 contas, **nenhuma** dessas mídias era post orgânico.
- `source_instagram_media_id` **é o post orgânico de origem** e aceita insights.
  Cobertura medida: Breno 36/41 anúncios (23/23 origens são post orgânico), Raíssa
  49/50 (21/21), Mantova 17/33 (10/10), Motoeasy 15/25 (5/10), Vessel 5/50 (3/3).
  A Vessel é baixa porque os criativos nascem na Fábrica — mídia nova, sem origem.
- O post de origem entrega `likes, comments, saved, shares, reposts, reach, views` e,
  **só em FEED** (não em Reels), `follows` e `profile_visits`.

### Por que o número do post NÃO entra na conta do anúncio

Anúncio e post de origem são objetos separados: o engajamento do anúncio **não** volta
pro post. Exemplo real (anúncio "[10/09/2025] Tabela Nemoto", R$ 6.787 gastos):

| | Anúncio | Post de origem |
|---|---|---|
| Alcance | 742.515 | 4.157 |
| Curtidas | 5.688 | 144 |
| Salvamentos | 810 | 348 |
| Compartilhamentos | 1.204 | 66 |
| Republicações | — | 3 |

As 3 republicações somariam 90 pontos num total de 54.248 (0,17%), vindas de outro
público. **Decisão: não misturar.** O anúncio é pontuado só com o que é dele.

### O orgânico prevê o pago? Em parte

Nos 23 posts do Breno que viraram anúncio:

- Metade com **melhor** nota orgânica → custo por ponto mediano **R$ 0,35**
- Metade com **pior** nota orgânica → custo por ponto mediano **R$ 0,60**
- Melhor post orgânico (2.921 pts/mil) → R$ 0,13/ponto com R$ 10.190 investidos
- Pior post orgânico (283 pts/mil) → **R$ 62,65/ponto** com R$ 689 investidos

Correlação de Pearson −0,220 (fraca, distorcida pelo outlier). **Leitura honesta: a
nota orgânica é boa para reprovar, fraca para eleger.** Serve como filtro e alerta,
não como oráculo. R$ 9.399 foram investidos em posts da metade de baixo do ranking.

## Decisões aprovadas no brainstorm

1. **Métricas líquidas quando existirem**, com queda para as brutas quando não vierem.
   Coerente com a régua "líquido com sinal" já adotada em Redes Sociais.
2. **Veredito único por cartão**, em duas etapas com ordem fixa:
   - **Saúde** (regras atuais: frequência, CTR) responde "tem algo quebrado?"
   - **Eficiência** (ponderada: custo por ponto ÷ meta) responde "está caro ou barato?"
   - **Ordem de precedência, explícita e sem empate:**
     1. **Saúde manda pausar → pausa, sempre**, por mais barato que esteja.
     2. Saúde ok e **existe análise do Opus** para aquela campanha → vale o Opus
        (é a precedência que já existe hoje e não muda).
     3. Saúde ok e **sem análise do Opus** → a **ponderada** decide escalar/manter/
        otimizar. É ela que ocupa o lugar hoje ocupado pelas regras ao vivo.
   - A **coluna de custo por ponto aparece sempre**, independente de quem deu o
     veredito — ela é informação, não decisão.
   - O cartão mostra a conclusão **e a frase do porquê**, nunca dois selos disputando.
3. **A Gestão de Tráfego absorve a Análise de Campanhas.** `/meta-campanhas` passa a
   redirecionar. Nada de reescrita do zero: o código money-path já validado ao vivo
   (orçamento CBO/ABO, pausar, Opus, ver criativo) é preservado.
4. **Cinco abas**, com filtro de campanhas nas abas 1 e 2 (não na 3, que não é campanha).
5. **Fila de aprovação com tudo** (orçamento, pausar campanha, pausar anúncio),
   **separada por conta de anúncios**.

## As cinco abas

### Aba 1 · Campanhas
O que a Gestão de Tráfego é hoje, mais: coluna de **custo por ponto** e o veredito
único descrito acima. Filtro de campanhas disponível.

### Aba 2 · Funil
O funil de conversão por objetivo vindo da Análise de Campanhas, com período
personalizado por calendário e filtro de campanhas. Visão de conjunto: onde a jornada
trava.

### Aba 3 · Conteúdo
Posts orgânicos pontuados pela **mesma régua**, ordenados por pontos a cada mil
alcançados, marcando quais já viraram anúncio. Entrega duas coisas:
- **fila de impulsionamento** — os melhores que ainda não foram impulsionados;
- **freio** — marca, na própria lista, os posts que **já estão sendo impulsionados
  estando na parte de baixo do ranking** (no caso do Breno: posições #49, #51, #52 e
  #53 de 68, uma delas custando R$ 62,65 por ponto).

**Escopo do freio:** ele vive dentro da aba 3. Colocar esse mesmo aviso no fluxo de
subir anúncio do Estúdio da Fábrica é outra tela e **fica fora deste projeto** —
anotado como possível continuação.

### Aba 4 · A régua
A aba `Config` da planilha virando tela, e **fonte única** para as abas 1, 2 e 3:
- **pesos por interação** (curtida 1, comentário 10, salvamento 30, compartilhamento 20);
- **metas de custo por tipo de campanha** — engajamento tem meta por ponto; vendas por
  compra; lead por lead; mensagem tem a escada (conversa iniciada, 1ª resposta, 3ª, 5ª),
  cada degrau com peso e meta próprios;
- **limiares do semáforo** (0,8 / 1,0 / 1,3), editáveis;
- **exemplo vivo ao lado da tabela**: mexeu num peso, vê na hora o efeito numa campanha
  real — sem isso a edição é às cegas;
- **histórico de quem mudou o quê e quando** — sem ele, mudança de comportamento da
  recomendação vira mistério.

### Aba 5 · Aprovação
Hoje as sugestões das regras ao vivo **nascem e morrem na tela** (são calculadas no
render). Não dá para aprovar o que não fica registrado — então **toda sugestão passa a
ser gravada**.

Cada item da fila mostra: campanha/anúncio, o que muda (ex.: orçamento R$ 50 → R$ 62,50
/dia), o porquê em uma frase, os números que sustentam, e três ações: **aprovar**,
**recusar (com motivo)** e **adiar**.

Cuidados obrigatórios, por mexer em dinheiro:
1. **Validade** — sugestão vencida sai da fila em vez de virar botão perigoso.
2. **Motivo da recusa** — é o sinal de que a régua está mal calibrada.
3. **Registro do resultado** — o que aconteceu depois de aplicada. Sem isso não existe
   "depois automatizar": não haveria como saber se deu certo.
4. **Aprovar aplica de verdade**, com a mesma confirmação já usada para pausar e editar
   orçamento.

A automação futura reusa a mesma fila: ela deixa de ser "aprove isto" e passa a ser o
registro de "isto foi feito".

## Arquitetura

### Módulos puros (testáveis com `node --test`, sem browser e sem Meta)
- **`ponderada.mjs`** — recebe `{curtidas, comentarios, salvamentos, compartilhamentos,
  gasto}` + pesos + meta; devolve `pontos`, `custoPorPonto`, `qualidade`
  (pontos ÷ interações), `indice` (custoPorPonto ÷ meta) e `faixa` do semáforo.
- **`veredito.mjs`** — combina saúde e eficiência com o veto da saúde.

Mesmo padrão de `orcamento.mjs` e `publico.mjs`, que já provaram valor aqui (foi assim
que o erro do `bid_strategy` apareceu antes de subir campanha errada).

### Quebra da tela
A tela de 1.649 linhas vira **uma aba por arquivo**, mais um pedaço compartilhado com o
estado comum das abas 1 e 2 (conta selecionada, período, filtro de campanhas) — trocar
a conta numa aba reflete na outra. A quebra não é refactor por estética: é o que
impede o arquivo de dobrar de tamanho e virar risco a cada correção.

### Persistência
- **Régua**: pesos, metas por objetivo e limiares + tabela de histórico de alterações.
- **Fila de sugestões**: conta, nível (campanha/anúncio), alvo, origem (Opus | regra |
  ponderada), tipo (orçamento | pausar), proposta, **números do momento em que foi
  feita**, validade, status, quem decidiu, motivo da recusa, resultado posterior.

Guardar os números do momento é o que permite, um mês depois, entender por que a IA
sugeriu aquilo — e é a base para decidir se dá para automatizar.

### Permissões
Regra da casa: todo submódulo nasce com permissão própria.
- Abas 1, 2 e 3: acesso atual da Gestão de Tráfego.
- **Aba 4** exige permissão de **editar** — mexer num peso muda a recomendação de todos.
- **Aba 5** exige permissão própria de **aprovar** — é ela que aplica dinheiro.

## Fases

| Fase | Entrega | Usável sozinha |
|---|---|---|
| **1** | Módulos puros + Aba 4 (régua) + ponderada na Aba 1 (coluna e veredito) | Sim |
| **2** | Aba 5 (fila de aprovação) com tudo gravado | Sim |
| **3** | Aba 2 (funil, período personalizado, filtro de campanhas) + aposentar `/meta-campanhas` | Sim |
| **4** | Aba 3 (conteúdo: nota orgânica, fila de impulsionamento, marcação de freio) | Sim |

**Automação fica fora deste projeto** — só depois dos testes da fase 2, com limites
próprios (teto de variação por vez, nunca reativar o que está pausado).

## Erros e casos torcidos

- **Campanha sem interação** → divisão por zero: mostra "sem dados", nunca zero.
- **Anúncio sem post de origem** (45 dos 50 da Vessel) → a aba 3 diz que não há origem
  em vez de inventar número.
- **Reels não aceitam `follows`/`profile_visits`** → campo aparece indisponível, não
  zerado.
- **Limite de chamadas da Meta** → busca sequencial e cache. Lição já paga neste
  projeto: disparar tudo em paralelo derrubou a tela para o dado coletado.
- **Sugestão vencida** → sai da fila.
- **Conta sem dados no período** → estado vazio explícito.

## Testes

- Módulos puros cobertos por `node --test` (a suíte hoje tem 256 testes e roda no CI).
- Casos obrigatórios: divisão por zero, métrica líquida ausente caindo para a bruta,
  veto da saúde sobre a eficiência, sugestão vencida, e cada faixa do semáforo nas
  bordas exatas dos limiares.
- Money-path (aprovar sugestão que aplica orçamento/pausa) validado subindo campanha
  PAUSED e limpando depois, como já é praxe aqui.

## O que ficou explicitamente de fora

- **Encaminhamentos e republicações na conta do anúncio** — possíveis via post de
  origem, mas representam 0,17% dos pontos e vêm de outro público. Ficam só na aba 3.
- **Gaveta de filtro de campanhas na aba 3** — não faz sentido: lá são posts.
- **Automação sem aprovação humana** — projeto seguinte.
- **Aviso de nota baixa dentro do fluxo de subir anúncio do Estúdio** — outra tela;
  possível continuação depois da fase 4.

---

# REVISÃO DE RUMO — 2026-07-28 (depois da Fase 1 no ar)

O Breno abriu a Fase 1 e disse, com todas as letras, que **não entendeu**. Ao investigar
com os dados reais dele, três coisas ficaram claras — e duas contrariam o que esta spec
assumia.

## 1. A ponderada refina, mas quase nunca inverte — nos ANÚNCIOS dele

Medido nas campanhas de engajamento reais (90 dias):

| Campanha | Custo por **interação** | Custo por **ponto** |
|---|---|---|
| +Seguidores_PublicoDefinido | R$ 0,047 | R$ 0,040 |
| Topo Funil — Interação (cópia) | R$ 0,072 | R$ 0,069 |
| Topo de Funil — Engajamento | R$ 0,996 | R$ 0,372 |

As duas colunas **classificam na mesma ordem**. O motivo: em anúncio pago, curtida
domina — 19.834 curtidas contra 51 salvamentos numa delas (390 para 1). Com essa
proporção, peso 30 no salvamento quase não move o resultado. O que muda é a
**magnitude** (a terceira parece um desastre por interação e apenas cara por ponto).

Consequência: a ponderada **não** justifica sozinha uma aba inteira de configuração.
Em POST ORGÂNICO a história é outra — salvamento e compartilhamento pesam muito mais
na proporção — que é exatamente o caso da planilha de origem.

**Lição de processo: isto deveria ter sido medido ANTES de planejar quatro fases.**

## 2. Nove campos de configuração para um número que aparece em 13 de ~100 campanhas

É desproporcional, e foi a origem da confusão. Decisão do dono (opção B): a aba
**continua**, mas ganha um texto de abertura ensinando o conceito, e os **limiares
(0,8 / 1,0 / 1,3) saem da tela** — ficam fixos no código. São o item mais abstrato e
o menos útil.

## 3. O buraco que a pergunta do dono revelou

Ele perguntou se conversão, WhatsApp e lead não precisariam de tratamento próprio.
Precisam — e já têm: cada balde é julgado pela sua régua (ROAS/CAC, custo por lead,
custo por conversa, CTR/CPC). **Mas os números dessas réguas estão chumbados no
código** (`GT_CRIT`), enquanto o engajamento acabou de ganhar meta editável.

Ou seja: ele pode definir o preço da curtida e **não** pode definir o preço do lead —
que é o que move dinheiro de verdade. É uma inversão de prioridade.

## A generalização que resolve os três

Toda meta passa a ser **"custo por resultado, menor é melhor"**, cada balde na SUA
unidade. Com isso a métrica ponderada deixa de ser um bicho à parte e vira **um caso**
da mesma régua — o caso em que o "resultado" é o ponto ponderado.

| Balde | Meta, na unidade dele | Conta (já existe no catálogo) |
|---|---|---|
| Engajamento | custo por **ponto** | métrica ponderada |
| Reconhecimento | **CPM** | `cpm` |
| Tráfego | custo por **visita** | `custo_visita` |
| Mensagens | custo por **conversa** | `custo_conversa` |
| Leads | custo por **lead** | `custo_lead` |
| Vendas | custo por **compra** (CAC) | `cac` |

Como todas são "menor é melhor", o mesmo semáforo e os mesmos limiares servem para
todas — sem régua paralela. Sem resultado no período (zero leads, zero conversas), a
conta é indefinida → `sem-dados` → o veredito cai na leitura de saúde do objetivo,
que é o comportamento correto e já implementado.

## Fases, renumeradas

| Fase | O que é | Situação |
|---|---|---|
| 1 | Motor, régua de engajamento, veredito único | **no ar** |
| **2** | **Régua explicada + meta por objetivo na unidade dele** | **esta** |
| 3 | Fila de aprovação humana | depois — não faz sentido aprovar sugestão de robô antes de o dono poder dizer qual é o alvo |
| 4 | Aba do funil | depois |
| 5 | Aba de conteúdo (fila de impulsionamento) | depois |

## Sobre a aba de conteúdo, que o dono questionou

A dúvida foi: qual o link com orçamento? O link é **em que colocar verba, antes de
colocar** — não como dividi-la. Nos dados dele: o post 1º do ranking orgânico virou
anúncio a R$ 0,13/ponto (R$ 10.190 investidos); o 53º de 68 virou anúncio a
**R$ 62,65/ponto**. E **R$ 9.399 foram para posts da metade de baixo**.

Ressalva mantida: a correlação é fraca (a metade boa sai 41% mais barata na mediana).
Serve para **reprovar**, não para eleger. Fica na Fase 5 e depende de o dono querer.
