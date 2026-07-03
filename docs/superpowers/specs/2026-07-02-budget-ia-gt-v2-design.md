# Budget IA / Gestão de Tráfego v2 — Opus como análise única, por anúncio

**Data:** 2026-07-02
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** brenoov (+ Claude)
**Frente:** correções pós-#3 (feedback do Breno). Cobre itens 1,2,3,4,6 do pacote. Item 5 (bug da cor) é tratado à parte (debugging).

---

## 1. Problema / motivação (feedback do Breno)

Depois que a IA do Opus (#3) entrou, a Gestão de Tráfego ficou com **duas análises concorrentes** e conceitos frágeis:
- **(6)** Cada campanha/anúncio mostra 2 blocos de análise: o **antigo do motor de regras** (`_gtInlineSuggest`/`_gtInlineSuggestAd` → `insightEl`) E o **novo do Opus** (`_gtIABlocoHtml`).
- **(1)** Os botões de **postura** (Conservador/Equilibrado/Agressivo, `GT_POSTURAS`) eram do motor de regras — não fazem mais sentido.
- **(3)** Conceito errado: sugestão "escalar" saiu pra campanha com **CTR 0,15%** (péssimo). Como o motor de regras não daria escalar com CTR baixo, o veredito errado veio do **Opus** — o prompt precisa de conceitos mais firmes.
- **(4)** A análise do Opus é só **por campanha**; o Breno quer **por anúncio** (avaliar criativos) e a campanha já **desdobrada**.
- **(2)** O status precisa refletir e **considerar** exatamente o Meta: ativo/pausado/concluído.

## 2. Estado atual (o que existe)

- `_gtInlineSuggest(ins,camp,all)` (motor de regras, campanha) e `_gtInlineSuggestAd(ad,all)` (motor, anúncio) → vereditos + `insightEl` (bloco `gt-insight`) + botões de ação do motor.
- `GT_POSTURAS`/`_gtPostura`/`GT_CRIT`/`_gtVerdict` — a régua de regras e a barra de postura.
- `_gtIABlocoHtml(row)` + `_gtBudgetIA` (mapa por campaign_id) — o bloco do Opus (#3), com [Aplicar]/manual/pausar sempre.
- `_gtManualToggleBtn` (pausar/reativar sempre), `_gtEncerrada` (stop_time vencido → "Encerrada").
- Robô `coletor/budget-ia.mjs`: por campanha ativa (via `/me/adaccounts` → campanhas), 1 Opus/campanha → grava `gt_budget_analises`.
- `loadGtData` já busca **anúncios com insights** (`adInsights`+`adObjs` com `effective_status`) e campanhas com `effective_status`.

## 3. Direção geral

**Aposentar o motor de regras. O Opus vira a análise ÚNICA** — por campanha (budget) e por anúncio (avaliação de criativo). Some: postura, `insightEl` (os 2 blocos antigos), botões de ação do motor, `_gtVerdict`/`GT_CRIT`/`GT_POSTURAS` (código morto removido). A cor semântica **verde/amarelo/vermelho** (bom/atenção/ruim) é mantida no bloco do Opus.

## 4. Robô (`budget-ia.mjs`) — 1 chamada por campanha, com os anúncios juntos

- Para cada **campanha ativa em veiculação**, buscar também seus **anúncios ativos** com insights (mesma fonte que o `loadGtData` usa: `/act_X/ads` + insights nível `ad`).
- **1 chamada Opus por campanha**, com input = métricas da campanha + lista dos anúncios ativos (com métricas). Saída JSON:
  ```
  { budget_sugerido_centavos:int, veredito:'escalar'|'reduzir'|'manter'|'pausar',
    justificativa:string, impacto_estimado:string,
    anuncios:[ { ad_id:string, veredito:'manter'|'pausar', justificativa:string } ] }
  ```
- **Custo:** continua ~1 chamada por campanha (não multiplica) — só a saída cresce. `max_tokens` maior (~8192) p/ caber os anúncios. ~R$3/semana mantido.
- **Prompt melhorado (corrige item 3):** conceitos firmes —
  - Respeitar o **objetivo** (Vendas→ROAS/CAC; Tráfego→CTR/CPC; Reconhecimento→alcance/CPM; Leads→custo/lead).
  - **Performance ruim NUNCA vira "escalar"** (ex.: CTR muito abaixo do aceitável pro objetivo, CPC/CPL alto, ROAS baixo → reduzir/pausar, nunca escalar).
  - Escalar só quando há **evidência de eficiência** (bom resultado a custo baixo) e volume/dado suficiente.
  - Por anúncio: `pausar` criativo com performance ruim / fadiga (frequência alta); `manter` o que vai bem.
- Grava: parte da campanha → `gt_budget_analises` (como hoje); parte dos anúncios → `gt_ad_analises` (nova).
- Só analisa **ativos** (campanha ativa; anúncios ativos). Resiliência por campanha mantida.

## 5. Dados — nova tabela `gt_ad_analises`

| Coluna | Tipo | Nota |
|---|---|---|
| `ad_id` | text | PK |
| `campaign_id` | text | a campanha do anúncio |
| `account_id` | text | |
| `veredito` | text | manter / pausar |
| `justificativa` | text | PT |
| `modelo` | text | `opus-4-8` |
| `gerado_em` | timestamptz | |
| `valida_ate` | timestamptz | próxima segunda |

RLS: leitura pra quem tem a ferramenta (`role='admin' OR 'meta.gestor' = any(features)`); escrita só service role. Igual `gt_budget_analises`.

## 6. Tela (Gestão de Tráfego)

**Remove:**
- Barra de postura (Conservador/Equilibrado/Agressivo) e `_gtPostura`.
- O bloco de análise antigo do motor (`insightEl`) na campanha E no anúncio.
- Os botões de ação gerados pelo motor (`sug.actions` do `_gtInlineSuggest`/`_gtInlineSuggestAd`).
- Funções mortas: `_gtInlineSuggest`, `_gtInlineSuggestAd`, `_gtVerdict`, `GT_CRIT`, `GT_POSTURAS`, `gtCriterios` (e o botão "?" que abre os critérios do motor).

**Campanha** (mantém o essencial + Opus):
- Status real (badge) + KPIs por objetivo (já existe) + bloco do Opus (`_gtIABlocoHtml`: budget sugerido + [Aplicar] + campo manual) + pausar/reativar manual (`_gtManualToggleBtn`).

**Anúncios (auto-desdobrado):**
- Toda campanha que tem anúncios **abre desdobrada** por padrão (sem precisar clicar).
- Cada anúncio mostra: status real + KPIs + **avaliação do Opus** (novo `_gtAdIABlocoHtml(adRow)`: veredito manter/pausar + justificativa, cor semântica) + pausar/reativar manual.
- Lê de `gt_ad_analises` (novo `_gtAdIA` mapa por ad_id, carregado em `loadGtData`).

**Status real EXATO (item 2)** — mapear e exibir, campanha e anúncio:
- `ACTIVE` + stop_time futuro/vazio → **Ativo** (verde)
- `PAUSED`/`CAMPAIGN_PAUSED` → **Pausado** (amarelo/neutro)
- `ACTIVE` + stop_time no passado → **Concluído** (neutro) — não conta como ativa (filtro), sem sugestão de escalar/pausar
- `ARCHIVED` → **Arquivado**
- outros (`WITH_ISSUES`, `PENDING_REVIEW`, `DISAPPROVED`, `DELETED`) → exibir o status real (label claro), sem análise
- **Considerar** o status: filtro "Ativas" conta só Ativo de verdade; concluída/arquivada não entram.

## 7. Bug da cor (item 5) — FORA deste spec

A dash trocar de cor sozinha é bug de tema (não faz parte do redesenho da análise). Será investigado e corrigido **à parte** (systematic-debugging): achar a origem (tema claro/escuro? accent por perfil?) e garantir que não muda sozinha e respeita verde/amarelo/vermelho. Fica como tarefa separada.

## 8. Fora de escopo

- Bug da cor (item 5) — tarefa separada.
- Redesign visual amplo (fontes/efeitos/#5) além de remover a duplicidade e desdobrar — fica pra #5.
- Budget por anúncio (Meta não tem; budget é campanha/conjunto).
- Mudar a coleta do dashboard social (outra frente).

## 9. Critérios de sucesso

1. A Gestão de Tráfego mostra **uma única análise** por campanha e por anúncio — a do Opus. Motor de regras e postura sumiram (sem código morto).
2. O Opus analisa **cada anúncio ativo** (manter/pausar + porquê); a campanha abre **desdobrada** mostrando isso.
3. Conceitos corretos: **campanha/anúncio com performance ruim não recebe "escalar"** (validar no caso da Raíssa, CTR 0,15% → reduzir/pausar).
4. Status real EXATO exibido e considerado (Ativo/Pausado/Concluído/Arquivado); filtro Ativas coerente.
5. Budget da campanha continua (sugestão + Aplicar + manual). Custo do robô ~mantido (1 chamada/campanha).
6. Nada quebra: pausar/reativar sempre segue funcionando; sem chave sensível no client.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Saída JSON do Opus com anúncios ficar grande/truncar | `max_tokens` ~8192; validar; se truncar, cair pra "sem análise" no anúncio. |
| Remover o motor quebrar referências (código acoplado) | Mapear todos os usos antes; remover em bloco; `node --check`. |
| Conceito "ruim não escala" vago no prompt | Dar limiares por objetivo no prompt + validar no caso real (Raíssa). |
| Muitos anúncios por campanha inflar a chamada | Limitar aos ativos; se necessário, top-N por gasto. |
| Status "concluído" x effective_status do Meta | Usar effective_status + stop_time; fallback exibe status cru. |
