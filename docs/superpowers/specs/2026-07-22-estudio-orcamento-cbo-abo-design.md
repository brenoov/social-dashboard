# Editor de orçamento CBO/ABO por loja no passo Subir (Estúdio da Fábrica)

**Data:** 2026-07-22
**Área:** Fábrica de Anúncios → Estúdio → passo **Subir** (destino "nova")
**Tipo:** feature (novo controle de orçamento)

## Problema

Hoje o orçamento da campanha é **fixo e ABO implícito**: `CFG_ADSET.DAILY_BUDGET = 5000`
(R$ 50,00/dia) gravado no conjunto (`adset.daily_budget`), com
`is_adset_budget_sharing_enabled: false` na campanha. O usuário não escolhe nem o valor,
nem se o orçamento fica na campanha (CBO) ou no conjunto (ABO), nem se é diário ou total.

## Objetivo

No passo **Subir** (destino "nova"), o usuário define o orçamento **por loja**, escolhendo:
- **Modo:** ABO (orçamento no conjunto) ou CBO (orçamento na campanha, a Meta divide entre os conjuntos)
- **Tipo:** Diário ou Total (lifetime)
- **Valor** em R$
- Se Total: **data de início e fim**

Cada loja escolhe o seu modo/tipo/valor independentemente.

## Decisões (travadas no brainstorm)

1. **Tipos suportados:** Diário **e** Total (lifetime).
2. **Por loja:** o valor é por loja (cada campanha = 1 loja, igual o público já é hoje).
3. **Modo por loja:** cada loja escolhe o SEU modo (ABO/CBO) e tipo (diário/total) — máximo controle.
4. **Período do total:** data de **início e fim** por loja (dois seletores). A campanha sobe
   PAUSED; se a data de início já tiver passado quando o usuário ativar no Gerenciador, a Meta
   ajusta pra ativação (comportamento nativo da Meta).
5. **Escopo:** só destino **"nova"**. Editar orçamento de campanha existente fica fora (YAGNI).

## UX (`src/ferramentas/meta-ads/painel-subir.vue`)

O passo Subir já tem **abas por loja** (público por loja, `publicoPorLoja[slug]`). Dentro da aba
de cada loja, entra um bloco **"Orçamento"**:

- **Modo:** toggle **ABO** ⟷ **CBO**. Padrão: **ABO**.
- **Tipo:** toggle **Diário** ⟷ **Total**. Padrão: **Diário**.
- **Valor:** campo em R$ (ex.: `50,00`). Padrão: **50,00** (= o de hoje).
- **Se Total:** aparecem **data de início** e **data de fim**.
- Textos literais explicando cada modo, sem jargão solto (público-alvo leigo — ver
  [[feedback_linguagem_literal_leigo]]): ex. "ABO = orçamento fixo neste conjunto" /
  "CBO = a Meta divide o orçamento entre os conjuntos e otimiza".
- **Validação (front):** valor acima de um mínimo sensato (a Meta é a palavra final); se Total,
  fim depois do início e ambas preenchidas.
- Responsivo e full-bleed como o resto do painel (ver [[feedback_responsivo_todos_dispositivos]]).

## Fluxo de dados

- Snapshot por aba: `orcamentoPorLoja[slug] = { modo:'ABO'|'CBO', tipo:'diario'|'total', valor:<centavos>, inicio?:ISO, fim?:ISO }`
  — mesmo padrão do `publicoPorLoja` (salva/carrega ao trocar de aba, reativo estável).
- No enviar: `destino.lojas = [{ slug, publico, orcamento }]`.
- `lojasDoDestino(destino)` passa a normalizar incluindo `orcamento`. **Retrocompat: sem
  `orcamento` → default `{ modo:'ABO', tipo:'diario', valor:5000 }` = exatamente o comportamento
  de hoje (byte-idêntico quando não se mexe no bloco).**
- Thread: `run()` → `criarCampanhaNova(loja, objetivoRow, publico, orcamento)` →
  `payloadCampanhaAdset(row, marca, loja, cfg, publico, orcamento)`.

## Tradução pro Meta (`payloadCampanhaAdset` em `coletor/subir-estudio.mjs`)

Valor em R$ → centavos (inteiro). O payload muda conforme modo×tipo:

| Modo | Tipo   | Onde o orçamento vai |
|------|--------|----------------------|
| ABO  | Diário | `adset.daily_budget` (campanha sem budget; `is_adset_budget_sharing_enabled:false`) |
| ABO  | Total  | `adset.lifetime_budget` + `adset.start_time`/`adset.end_time` (campanha sem budget) |
| CBO  | Diário | `campaign.daily_budget` (conjunto sem budget) |
| CBO  | Total  | `campaign.lifetime_budget` + `adset.start_time`/`adset.end_time` (conjunto sem budget) |

- Datas convertidas pro formato que a Meta espera (unix/ISO).
- **A VALIDAR AO VIVO (PAUSED), antes de dar como pronto:** os 4 combos (ABO/CBO × Diário/Total).
  A Meta tem regras chatas (mínimo de orçamento por moeda BRL; lifetime exige datas; CBO+lifetime
  pode exigir start/end no conjunto mesmo com budget na campanha). Reusar o padrão dos validadores
  já existentes (`coletor/validar-objetivos-combos.mjs`, `coletor/validar-publico-targeting.mjs`):
  cria 1 campanha PAUSED por combo via meta-proxy + apaga. Ajustar o mapeamento conforme o que a
  Meta ACEITAR (não por suposição — lição dos públicos do SP-4, ver [[project_iamundi_fabrica_anuncios]]).
- Money-path: sempre PAUSED; nunca apagar/pausar ativos; limpar campanhas de teste
  (ver [[feedback_nao_mexer_dados_reais]]).

## Retrocompat

Subir sem tocar no bloco de orçamento = ABO/Diário/R$50 = idêntico a hoje. `CFG_ADSET.DAILY_BUDGET`
vira o valor default/fallback (não some).

## Testes

- Unit puros do `payloadCampanhaAdset` nos **4 combos**: assert de ONDE o budget cai
  (campaign vs adset), presença/ausência de datas, e ausência de budget no lugar errado.
- `lojasDoDestino` **com e sem** `orcamento` (prova de retrocompat byte-idêntico).
- Validação de valor (mínimo) e de datas (fim > início).
- Validação ao vivo PAUSED dos 4 combos (money-path, manual/gated).

## Fora de escopo (YAGNI)

- Editar orçamento de campanha **existente** (destino "existente" — orçamento já está lá).
- Bid cap / bid strategy configurável (segue `LOWEST_COST_WITHOUT_CAP`).
- Agendamento avançado de orçamento (dayparting).
- Corrigir o `DATA_CAMPANHA: '11-07-2026'` hardcoded no nome da campanha (issue separada, não bloqueia).

## Ligações

- Área: [[project_iamundi_fabrica_anuncios]] · backlog de origem: [[project_iamundi_fabrica_estudio_backlog]]
- Padrões: [[feedback_nao_mexer_dados_reais]] · [[feedback_linguagem_literal_leigo]] · [[feedback_responsivo_todos_dispositivos]]
