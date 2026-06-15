# Gestor Comercial 2.0 — mais expert, criativo, competitivo

Data: 2026-06-15
Status: aprovado (brainstorming)

## Contexto
`coletor/gestor-comercial.mjs` (Node, GitHub Actions semanal, Claude Opus 4.8).
Hoje: puxa Bling (faturamento/canal, giro, estoque, ruptura, última venda), metas,
notícias de concorrentes; calcula determinístico **"Oportunidades da Semana"** (12 itens
por loja de varejo, escada fixa de % até 40, preços exatos do sistema — a IA é proibida
de escrever essa seção); o Claude escreve o resto do briefing. Sem custo/margem
disponível (só `preco` de venda) → o teto de % é a única trava possível.

Decisões do usuário:
- **5 itens livres POR LOJA** (Tivoli e Dom Pedro), além dos 12.
- IA escolhe **livremente** (criativo), teto **40%**, justificando cada pick.
- Pode propor **mecânicas criativas** (combos/brinde/leve+pague) como ideias no texto.
- Priorizar **as 4** frentes: inteligência competitiva, calendário/sazonalidade,
  tendência (giro/sell-through), narrativa estratégica.
- Liberdade pra agregar mais valor onde fizer sentido.

## Parte A — "Garimpo do Gestor" (5 itens livres/loja, curados pela IA)
Princípio: **IA escolhe, sistema precifica** (LLM não calcula preço).
1. `montarCardapio(saldoPorDep, prodMap, giro, ultimaVenda, hoje)` — por loja de varejo,
   lista de candidatos vendáveis com estoque≥1 e preço>0 (qualquer categoria), com
   sku/nome/categoria/preço/estoqueLoja/estoquePulmão/giro/diasSemVender. Cap ~60/loja
   (ordena por capital parado desc + inclui movers), pra dar repertório sem estourar tokens.
   Também devolve lookup `loja→sku→{pid,preco,...}` p/ validar/precificar.
2. Prompt manda o cardápio por loja e pede, **no fim**, um bloco ```garimpo``` com JSON:
   `{ "<loja>": [ {sku, pct(5–40), motivo} ... até 5 ] }`. SKU só do cardápio; não repetir
   os 12; ser criativo/competitivo.
3. Node faz parse + valida (sku existe na loja, pct 1–40 arredondado, máx 5, dedupe, exclui
   SKUs dos 12), calcula `precoComDesconto`/`parcela6x` exatos, monta `garimpo` (com `motivo`).
   Picks inválidos são descartados (log). Remove o bloco bruto do corpo.
4. `buildGarimpoMd` — tabela por loja (… + coluna **Motivo**), anexada após Oportunidades.
5. `garimpo` salvo em `dados_json`.

## Parte B — Agente mais expert (4 frentes)
Tudo numa única chamada ao Claude (controle de custo). Dados novos calculados no Node:
- **Calendário datado** `proximasDatasComerciais(hoje, ~75d)` — datas comerciais BR
  computadas (Dia das Mães/Pais = enésimo domingo; Black Friday = última 6ª de nov; mais
  Namorados 12/06, Cliente 15/09, Crianças 12/10, Natal, troca de estação). Injetado no
  prompt p/ a IA **não inventar data** e montar campanha por evento.
- **Tendência por categoria** — enriquece `estoque[].categorias` com `sellThrough`
  (vendidoMes/(unidEstoque+vendidoMes)) e `deltaGiro` vs `dados_json` do briefing anterior
  (reusa o fetch do comparativo). IA aponta categoria acelerando/desacelerando.
- **Inteligência competitiva** — instrução reforçada: cruzar notícia de concorrente ×
  nossos parados/categorias e sugerir contra-ataque direto, amarrando aos picks do Garimpo.
- **Narrativa afiada** — persona mais sênior (cabeça de dono); abre com "Leitura da Semana"
  e fecha com "Plano de Ataque" (top 3 com impacto esperado). `max_tokens` 4000 → 7000.

## Parsing (ordem importa)
Saída do LLM: corpo → linha `RESUMO: …` → bloco ```garimpo``` por último.
Node: (1) extrai e remove o bloco garimpo; (2) extrai RESUMO do texto restante (fica no fim);
(3) corpo + Oportunidades + Garimpo + RESUMO.

## Onde mexe
- Só `coletor/gestor-comercial.mjs` (novas funções + prompt/persona + parser).
- Front-end: nada (tudo é markdown no briefing, igual às Oportunidades).
- Banco: nada novo (garimpo/tendências dentro de `dados_json`).

## Guardrails / cuidados
- Teto 40% rígido; máx 5/loja; só itens com estoque na loja; mecânicas criativas só como texto.
- Mais tokens/rodada (1×/semana, ok). Agente depende de crédito de API p/ rodar.
- Não roda destrutivo: só grava um briefing novo.
