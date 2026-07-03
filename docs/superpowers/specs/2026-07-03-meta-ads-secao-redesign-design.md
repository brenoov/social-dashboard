# Redesign da seção "02 · Meta Ads" (Dashboard Redes Sociais)

**Data:** 2026-07-03
**Status:** Design aprovado pelo Breno (mockup fiel ao painel) — aguardando revisão da spec
**Autor:** brenoov (+ Claude)
**Frente:** 2º passo do item #5 (o 1º foi a Gestão de Tráfego). Aqui é só a seção de resumo "02 · Meta Ads" do dashboard social.

---

## 1. Problema (feedback do Breno)

A seção "02 · Meta Ads" mostra 4 cards + uma linha de chips de custo. Hoje:
- **Desigual:** os 2 primeiros cards (Investimento, Custo por seguidor) são "ricos" (meta editável, comparação, barra); os 2 de custo (Custo por interação, Custo por curtida) são "pelados" (só rótulo + número).
- **Sem sinal de saúde:** o custo não diz sozinho se está bom ou ruim.
- **Chips soltos:** a linha de custo (CPC/CPM/custo por alcance/comentário/salvamento/compartilhamento) é uma fileira sem rótulo.

O Breno quer os 4 melhorados: **consistência, semáforo de custo, ênfase no número, chips organizados** — **mantendo o card do painel** (nada de modelo novo).

## 2. Restrição-chave: manter o card do painel

O redesign **NÃO cria um modelo de card novo**. Usa as classes/estrutura que o painel já tem: `.sec2-grid` (2×2), `.card` (com `border-left:3px transparent`), `.mc-header`/`.mc-icon`/`.mc-goal-area` (meta editável ✏), `.mc-lbl`, `.mc-val` (Oswald 44px), `.mc-compare`, `.calc-badge`, `.sec-chip`. As mudanças entram **dentro** desse padrão, pra não destoar das seções 01/03/04 do mesmo painel.

## 3. As 4 melhorias

### 3.1 Consistência — os 2 cards de custo ficam iguais aos 2 primeiros
Os cards **Custo por interação** e **Custo por curtida** ganham:
- `mc-goal-area` com **meta editável** (`META MÁX` + `contenteditable` + ✏), persistida do **mesmo jeito** que as metas atuais (`goal-spend`, `goal-cps`).
- `mc-compare` (a caixinha) mostrando **vs meta** (quanto % abaixo/acima) e o delta vs período anterior, como os de cima.

### 3.2 Semáforo de custo (verde/amarelo/vermelho)
Vale pros **3 cards de custo "menor é melhor"**: Custo por seguidor, Custo por interação, Custo por curtida. Comparando o valor com a **meta editável** do card:
- **verde** (`--green`): valor **≤ meta** (dentro).
- **amarelo** (`--yellow`): **meta < valor ≤ meta × 1,20** (até ~20% acima — perto do limite).
- **vermelho** (`--red`): **valor > meta × 1,20** (estourou).
- **neutro** (accent, sem semáforo): quando **não há meta** definida (vazia/0) ou dado ausente (`R$ —`).

O semáforo pinta **três coisas** do card: o número (`.mc-val`), a **borda-esquerda de 3px** (`.card` já tem `border-left`), e o `.calc-badge` (fundo/again cor semântica). Texto do badge reflete o estado ("Dentro da meta" / "Perto do limite" / "Acima da meta").

O card **Investimento** (budget) **não** entra no semáforo de custo — é acompanhamento de orçamento (gastar mais não é "ruim"). Fica **neutro/accent com a barra de progresso**, como hoje.

### 3.3 Ênfase no número
O `.mc-val` já é Oswald 44px (grande). Mantém — a ênfase vem da cor do semáforo, não de aumentar mais.

### 3.4 Chips organizados
A linha `chips-ads-custo` ganha um **rótulo** discreto acima ("EFICIÊNCIA DO INVESTIMENTO", estilo dos rótulos do painel), e cada chip mostra **label + valor em negrito** (`<b>`), na mesma `.sec-chip`. Sem semáforo nos chips (são informativos/secundários) — só leitura mais clara. Métricas: CPC, CPM, Custo por alcance, Custo por comentário, Custo por salvamento, Custo por compartilhamento (as que já existem).

## 4. Metas novas (persistência)

Duas metas novas: **custo por interação** e **custo por curtida** (o custo por seguidor já tem `goal-cps`). Elas são `contenteditable` e persistem no **mesmo mecanismo das metas atuais** (`goal-spend`/`goal-cps`). O plano vai identificar exatamente onde/como as metas atuais salvam e replicar (mesma chave/tabela/localStorage, mesmo handler de edição). Valores padrão sugeridos (editáveis): custo por interação `0.15`, custo por curtida `0.20` — só defaults; o Breno ajusta.

## 5. Fora de escopo

- Qualquer mudança na coleta, no cálculo dos custos (a matemática spend÷interações/curtidas já existe) ou no robô.
- Semáforo nos chips (ficam informativos).
- Redesign das outras seções do painel (01/03/04).
- Novo modelo de card.

## 6. Critérios de sucesso

1. Os 4 cards têm a **mesma anatomia** (todos com meta ✏ + comparação); nenhum fica "pelado".
2. Bater o olho num custo e saber se está **saudável** (verde), **no limite** (amarelo) ou **estourado** (vermelho) — no número, na borda e no selo.
3. As metas de custo por interação e por curtida são **editáveis e persistem** (igual às atuais).
4. Os chips têm rótulo e leitura mais clara.
5. **Continua parecendo o painel** — mesmo card, fontes, grade 2×2; nada destoa das outras seções.
6. Nada quebra: os valores continuam sendo calculados/preenchidos como hoje; tema claro/escuro ok.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Persistência das metas novas divergir das atuais | O plano localiza o handler/armazenamento de `goal-spend`/`goal-cps` e replica exatamente. |
| Semáforo com meta vazia dar cor errada | Regra explícita: sem meta (vazia/0) ou `R$ —` → neutro, sem semáforo. |
| Cor da borda/badge destoar no claro/escuro | Usar as variáveis semânticas (`--green/--yellow/--red`) e tons via `rgba`/`color-mix` como no redesign da GT. |
| Investimento entrar no semáforo por engano | Explícito: card de budget fica neutro/accent com a barra. |
