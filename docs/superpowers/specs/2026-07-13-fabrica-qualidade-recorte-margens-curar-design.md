# Fábrica de Criativos — Recorte robusto, margens de segurança e curadoria por loja/proporção

Data: 2026-07-13
Escopo: 3 melhorias de qualidade da esteira de geração, num spec só, implementadas juntas
(subagent-driven-development) com revisão final. Ordem interna: P1 → P2 → P3.

## Contexto

Nesta sessão foram corrigidos e validados no ar 3 bugs da geração: retry no 400 do
Storage (`788dd69`), nome descritivo do Bling / "Bolsa Pisa" (`498f150`) e a chave da
IA no CI que fazia copy/nome/legenda caírem no genérico (`c1c9a61`). Restam 3 pontos —
todos de qualidade do criativo/curadoria:

- **P1 — Recorte** come a parte clara de bolsas claras (ex.: LV1159-Panacota).
- **P2 — Margens de segurança**: conteúdo encosta na borda e a Meta corta em cima/baixo/lados.
- **P3 — Curadoria** deve ser por loja (seções) e nas duas proporções (feed 4:5 + story 9:16).

---

## P1 — Recorte independente de plataforma (flood-fill de fundo)

### Problema (diagnosticado com evidência)
`recortar.py` usa BiRefNet (onnxruntime). No runner **Linux** o modelo dá confiança
quase-zero à lona clara de baixo contraste sobre fundo branco → o corpo da bolsa vira
buraco transparente (medido no cutout cru exportado do CI: corpo alpha ~0.07, base ~0.10;
só o couro tan de alto contraste sobrevive). No **macOS** local o mesmo modelo/peso recorta
limpo. É **variação de inferência de ML entre plataformas** — não reproduzível localmente,
não resolvida por pinar versão (testado: 1.19.2 no Linux também fura) nem por tapar buraco
(o corpo é aberto na base, conecta ao fundo → não é buraco cercado).

### Solução
Trocar o miolo do `recortar.py` por **remoção de fundo por flood-fill a partir das bordas**
(numpy + scipy.ndimage), que é **determinístico entre plataformas** (valido no Mac = igual
no Linux). As fotos são de estúdio em fundo branco/seamless — caso ideal pra essa técnica.

Algoritmo (`_cut_floodfill(img)`):
1. Emoldura 2px de branco em volta (garante borda = fundo mesmo se a bolsa encostar).
2. `whiteish = (min_canal >= WHITE_MIN) & (spread_canal <= SPREAD)` — branco e cinza-claro
   de fundo/sombra suave. Defaults `WHITE_MIN=200`, `SPREAD=28` (env `FLOODFILL_WHITE_MIN`,
   `FLOODFILL_SPREAD`).
3. `label(whiteish)`; **fundo** = componentes que tocam a borda; **fg** = resto. (A lona
   creme é whiteish mas NÃO toca a borda — o couro tan em volta a isola → preservada.)
4. `binary_fill_holes(fg)` (tapa reflexo branco interno) → mantém só o **maior componente**.
5. Feather leve (GaussianBlur ~0.8) → `putalpha`.

Fallback: se `fg` cobrir > **92%** da imagem (flood removeu quase nada = foto NÃO é fundo
branco), cai no BiRefNet e depois isnet (comportamento atual). `ehFotoStudio` continua
filtrando foto amadora ANTES do recorte, então o fallback é raro.

### Validação
Protótipo já rodado local em 4 SKUs (creme, metálica, palha com corrente fina, preta) — todos
recortaram limpos, corpo íntegro, vãos de alça corretamente transparentes, sem halo. Por ser
independente de plataforma, a validação local vale pro Linux.

### Testes
- Fixture: 1 foto de estúdio em `coletor/lib/__fixtures__/` (ou reusar uma de `fotos-bling/`).
- Teste node (`recorte-floodfill.test.mjs`): roda `recortar.py <fixture> <out>` e afirma —
  corpo (região central) alpha ≈ opaco, cantos alpha ≈ 0 (fundo removido), fg entre ~20–70%.
  (Se `python3`/scipy indisponível no ambiente de teste, `skip` explícito, não falha muda.)

---

## P2 — Margens de segurança (safe-area) nos templates

### Problema
Os 13 looks (`templates-criativos/templates.mjs`) posicionam logo/produto/preço/CTA com
`padding` ad-hoc por look (ex.: `s(96) s(80)`, `s(66) s(60)`), sem margem consistente. A
Meta reenquadra/corta entre posições e cobre faixas de UI no story — conteúdo perto da borda
some.

### Solução
Um **safe-area compartilhado** aplicado ao wrapper de conteúdo de TODOS os looks, por formato,
como piso mínimo de recuo (um look pode recuar mais, nunca menos):

- Helper `safeArea(formato)` → `{ top, right, bottom, left }` em px (na escala do formato).
- **Feed 4:5 (1080×1350):** recuo uniforme ~7% (~76px cada lado).
- **Story 9:16 (1080×1920):** topo ≥ ~14% (~250px, faixa do perfil), base ≥ ~20% (~390px,
  faixa do botão/CTA da Meta), lados ~6% (~65px). Conteúdo essencial fica no miolo seguro.
- Aplicado como `padding` no wrapper raiz de cada look (substitui os paddings ad-hoc pelo
  piso; onde o look já recua mais, mantém o maior). Escala `s()` e centralização atuais seguem.

### Testes
- Reusar `gerar-previews.mjs` (galeria de amostra) pra render de cada look nos 2 formatos.
- Checagem de bbox (opcional/manual): conteúdo não-fundo dentro do retângulo seguro. Mínimo =
  revisão visual da galeria de previews + spot-check.

---

## P3 — Curar por loja + pares feed/story

### Dados (peça-chave)
`fabrica_criativos` hoje NÃO tem SKU nem loja — impossível agrupar/parear com segurança.
- **Migration** (próximo número livre — atenção: há `025_/026_` NÃO-commitados de outra
  feature no working tree; resolver a numeração na implementação): `ALTER TABLE
  fabrica_criativos ADD COLUMN sku text;` (nullable; rows antigas ficam null).
- `gerar-criativos.mjs` grava `sku: cand.sku` no insert (produto). Promo fica sku null.
- Loja NÃO vira coluna do criativo (arte é 1 por SKU, dedup entre lojas): a loja é derivada no
  front por `job.params.itens` (SKU→depósito) × `fabrica_lojas` (depósito→nome, via
  `carregarMarcasELojas`).

### Front (`painel-curar.vue`)
- Carrega criativos com `sku, variante, formato, url, escolhido, purgado_em`.
- Carrega `job.params.itens` da campanha + lojas (depósito→nome) → mapa `sku → [lojas]`.
- **Seções colapsáveis por loja** (🏬 Tivoli / 🏬 Dom Pedro). SKU nas 2 lojas aparece nas 2.
- Dentro da seção: agrupa por **(sku, variante)** e mostra o **par feed 4:5 + story 9:16**
  lado a lado (o "look"). Formato faltante → mostra sozinho.
- Seleção continua **por criativo** (`escolhido`), granularidade atual preservada; o par só
  facilita marcar os dois. "Marcar todos" e seleção por seção mantidos.
- Criativos com `sku` null (campanhas antigas) ou sem match de loja → seção "Outros".

### Testes
- Teste do insert com `sku` (estende `gerar-criativos-itens.test.mjs`/afins).
- Lógica de agrupamento (sku→lojas, pares por variante) extraída como função pura testável.
- Smoke manual: gerar campanha real → ver seções por loja + pares.

---

## Fora de escopo
- Guia/overlay de zona segura da Meta no Curar (o usuário escolheu só o pareamento).
- Criar audiences Meta, Canva (SP-5B), upload no Gestor — tópicos próprios.

## Sequência de execução
Um spec, subagent-driven-development, ordem P1 → P2 → P3, com revisão final. P1 é backend puro
e já validado (baixo risco); P2 mexe em todos os templates; P3 tem migration + front.
