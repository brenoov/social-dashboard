# Análise híbrida (Opus + regras ao vivo) na Gestão de Tráfego

**Data:** 2026-07-03
**Status:** Design aprovado pelo Breno — aguardando revisão da spec
**Autor:** brenoov (+ Claude)
**Frente:** dar apoio de IA em TODA campanha/anúncio ao abrir a dash, sem depender do robô semanal e sem chamar a API na hora.

---

## 1. Problema / motivação

Hoje a análise da Gestão de Tráfego vem **só do Opus** (robô semanal, grava em `gt_budget_analises`/`gt_ad_analises`). Consequências:
- **Buraco:** campanha nova ou recém-ativada (ex.: "[TRÁFEGO] CONSTRUÇÃO BOLSA | PERFIL", criada depois da última rodada) fica **sem análise** → aparece "análise em breve" até a próxima segunda.
- **Custo:** o Opus é pago; rodar o robô à toa custa (~R$15–20/rodada de ~20 campanhas).

O Breno quer: **apoio da IA sempre presente ao abrir a dash, sem chamar API todo momento** — e as duas análises (Opus e ao vivo) **aparecendo iguais, sem data**.

## 2. Solução — híbrido, uma análise por card

Fonte da recomendação, por campanha e por anúncio:
- **Se existe análise do Opus** (`_gtBudgetIA[id]` / `_gtAdIA[id]`) → usa ela.
- **Senão** → o navegador calcula **na hora, por regras** (client-side, sem API, sem custo).

Sempre **uma** recomendação por card (nunca as duas juntas). Some o estado "análise em breve" para campanhas/anúncios **ATIVOS** (sempre haverá a regra ao vivo).

## 3. Motor de regras client-side — ESPELHA o modelo do Opus

Decisão do Breno: as regras devem **seguir os mesmos critérios do prompt do Opus**, pra a análise ao vivo bater com o que o Opus diria. O prompt do robô (`coletor/budget-ia.mjs`, `montarMensagens`) diz:
- Respeitar o **OBJETIVO**: Vendas→ROAS/CAC · Tráfego→CTR/CPC · Reconhecimento→alcance/CPM · Leads→custo por lead · Engajamento→engajamento/CTR.
- **Performance ruim NUNCA vira "escalar"** (CTR muito abaixo do aceitável pro objetivo, CPC/CPL alto, ROAS baixo, ou **frequência alta/fadiga** → reduzir/pausar).
- **"escalar" só com evidência de eficiência** (bom resultado a custo baixo) **E volume/dado suficiente**.
- Por anúncio: **pausar** criativo com performance ruim/fadiga; **manter** os que vão bem.

### 3.1 Campanha — `_gtRegraCampanha(camp, ins) → {veredito, budget_sugerido_centavos, justificativa}`
Reaproveita a lógica do **motor de regras que já existia** (`_gtVerdict`/`_gtInlineSuggest`, removidos no v2 mas no histórico do git) — versão **limpa e fixa** (sem os botões de postura; usa um único conjunto de limiares, o equivalente ao preset "equilibrada"). Mapeia por objetivo (Tráfego/Leads/Engajamento/Reconhecimento/Vídeo), com um piso de volume (gasto/impressões) antes de opinar. Saída (4 vereditos, iguais aos do Opus):
- **escalar** — eficiência boa + volume (ex.: Tráfego com CTR alto e CPC baixo; Leads com CPL abaixo da média e CTR bom). Budget sugerido = **atual × 1,25**.
- **reduzir** — saturação (frequência ≥ limiar de fadiga). Budget sugerido = **atual × 0,75**.
- **pausar** — desperdício com volume (ex.: gasto alto + 0 conversão; CTR muito baixo + gasto alto; engajamento muito baixo + gasto alto). Sem mudança de budget (a ação é pausar).
- **manter** — saudável / monitorar / dado insuficiente ("coletando"). Budget = atual.

`justificativa` = a frase explicativa (curta, PT-BR) que o motor gera pro caso (mesmo estilo do Opus: cita o número-chave e o critério). Sem data.

### 3.2 Anúncio — `_gtRegraAnuncio(ad) → {veredito, justificativa}`
Reaproveita `_gtInlineSuggestAd` (histórico). Saída: **manter** ou **pausar** (mesmo do Opus por anúncio):
- **pausar** — CTR crítico com gasto (desperdício) ou **frequência alta** (fadiga do criativo).
- **manter** — CTR ok / dentro do esperado.
`justificativa` curta.

### 3.3 Quando roda
Só para **campanhas/anúncios ATIVOS sem análise do Opus**. Campanha **pausada/concluída/arquivada** → banner **neutro** (não inventa "reativar" nem roda regra). O motor roda no render (client-side), instantâneo, sem custo.

## 4. Apresentação — iguais, sem data

- A recomendação (Opus **ou** regra) aparece **idêntica**: mesma faixa colorida por veredito, selo **"✦ IA"**, justificativa, e os mesmos controles (Aplicar sugerido / campo manual de budget / Pausar — campanha; pílula manter/pausar — anúncio). O Breno **não** distingue qual é a fonte.
- **Remover a data** de tudo (o selo do banner e o da análise por anúncio deixam de mostrar a data; vira só "✦ IA").
- Some o "análise em breve" para ativos.

## 5. Arquitetura (como encaixa)

- Novas funções puras (client-side) `_gtRegraCampanha`/`_gtRegraAnuncio` + os helpers de limiar (o "GT_CRIT" fixo, sem postura).
- No render da campanha: `const iaRow = _gtBudgetIA[id] || (status ativo && !encerrada ? _gtRegraCampanha(camp,ins) : null)`. O `_gtRecBanner` continua igual (recebe a fonte; produz a mesma faixa). Remover a data do banner.
- No render do anúncio: `const adRow = _gtAdIA[ad_id] || (ad ativo ? _gtRegraAnuncio(ad) : null)`; a pílula/porquê saem daí. Remover a data.
- `_gtWireBudgetControls` já usa `iaRow.budget_sugerido_centavos` → funciona com a sugestão da regra (Aplicar aplica o ×1,25 etc.).
- **Nada muda no robô, nas tabelas, na coleta.** É só client-side + remoção da data.

## 6. Fora de escopo

- Mudar o robô/tabelas/coleta (o Opus semanal continua igual).
- Marcar "ao vivo" separado do Opus (o Breno quis **iguais**).
- Cor por perfil / temas (não relacionado).
- Empurrar/persistir a análise-regra no banco (é efêmera, calculada no render).

## 7. Critérios de sucesso

1. Toda campanha/anúncio **ATIVO** tem recomendação **ao abrir** a dash — some o "análise em breve".
2. As regras **seguem os critérios do Opus** (por objetivo; performance ruim nunca escala; escalar só com eficiência+volume).
3. Opus e regra aparecem **iguais, sem data**; uma análise por card.
4. Os botões (Aplicar/manual/pausar; manter/pausar) funcionam pros dois.
5. Pausada/concluída continua **neutra** (sem recomendação inventada).
6. Sem custo novo de API (as regras são client-side); o Opus semanal segue como está.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Regra divergir muito do Opus | Basear os limiares no preset "equilibrada" do motor antigo + nos conceitos do prompt do Opus; validar em campanhas reais no preview. |
| Ressuscitar o motor reintroduzir código morto/postura | Trazer só a lógica limpa (sem GT_POSTURAS/postura/`_gtRenderActions`); funções puras novas, testáveis. |
| Confundir Opus (semanal) com regra (ao vivo) sem a data | Decisão do Breno: iguais de propósito (o objetivo é ter apoio sempre; a fonte é indiferente pra ele). |
| Regra sugerir escalar em campanha ruim (o bug do v2) | O motor antigo NÃO dava escalar com CTR baixo (o bug era do Opus); manter os limiares que exigem CTR/eficiência altos p/ escalar. |
