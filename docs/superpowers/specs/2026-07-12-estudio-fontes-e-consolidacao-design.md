# Estúdio de Criativos — Fontes de produto no "Gerar" + consolidação da Fábrica + fundação multi-marca/multi-loja

**Data:** 2026-07-12
**Status:** aprovado no brainstorm (amendado com dimensão marca), aguardando revisão do spec
**Relação:** evolui a feature já no ar (specs `2026-07-11-fabrica-f2a3-ui-estudio-design.md` + adendo Conferir/Ativar, e `2026-07-11-fabrica-storage-lifecycle-design.md`).

## Objetivo

Ter **uma única ferramenta** (Estúdio de Criativos) e enriquecer o passo **Gerar** com escolha de **fonte dos produtos** e de **desconto**, lendo direto os dados do Gestor Comercial (fonte de verdade, com desconto previsto). Ao mesmo tempo, **preparar para mais marcas e mais lojas/canais**: tudo que hoje é fixo no código (nome da marca nas legendas, conta de anúncios, página, IG, WhatsApp, geo) vira **dado**. Hoje só existe uma marca (a atual), mas o modelo já nasce multi-marca: adicionar marca = inserir uma linha + suas lojas; a UI segue com a marca atual implícita (seletor de marca é fase futura, quando houver a 2ª).

Motivação: hoje existem DUAS telas redundantes — a "Fábrica de Anúncios" (F1, `tela-de-fabrica-de-anuncios.vue`, curadoria de candidatos) e o "Estúdio de Criativos" (wizard 4 passos). A F1 é alimentada por um robô que **re-extrai** candidatos da prosa do briefing via IA, perdendo o quadrante BCG e o desconto por item. O Gestor já produz esses dados **estruturados** (`gestao_comercial_briefings.dados_json` tem `oportunidades`/`garimpo` por loja, cada item com `pct`/`precoComDesconto`), e o BCG/ABC são deriváveis de `gc_vendas_item`/`gc_estoque_item`. Logo: ler o Gestor direto, aposentar a F1.

## Decisões travadas no brainstorm

- **Uma ferramenta**: aposenta F1 (tela + rota + card), o robô `coletor/fabrica-anuncios.mjs`, e as tabelas `fabrica_rodadas`/`fabrica_candidatos`.
- **Lista viva** (não pré-preparada): ao escolher fonte/filtros, a lista de produtos é montada na hora, direto dos dados do Gestor + catálogo. Nada de tabela intermediária de candidatos.
- **Curadoria item a item**: toda fonte produz uma lista; filtros estreitam; o usuário marca/desmarca produtos; só os marcados geram. A fonte "Manual" é o caso onde se parte do catálogo inteiro.
- **Desconto**: previsto (por item, por loja) disponível em **Oportunidades + Garimpo**; **% manual** disponível em todas; BCG/ABC/Manual = só manual.
- **Loja = arte por loja**: gera por produto × loja-com-estoque, com o preço/desconto **daquela** loja (o Gestor calcula % por loja). Duas lojas com % diferente → duas artes.
- **Multi-loja/canal**: seletor lista **todas as lojas ativas** de `fabrica_lojas`; a config por loja (WhatsApp, geo, page/IG/ad-account, depósito, canal) vira **coluna** da tabela. Adicionar loja = inserir linha.

## Fluxo do passo "Gerar" (novo)

`Loja(s) → Fonte → Filtros → Lista viva → Curadoria → Desconto → Gerar`

1. **Loja(s)**: checkboxes com todas as `fabrica_lojas` ativas (dinâmico).
2. **Fonte** (5): `oportunidades` · `garimpo` · `bcg` · `abc` · `manual`.
3. **Filtros** (dependem da fonte):
   - `bcg` → quadrante(s) ∈ {Estrela, Vaca leiteira, Interrogação} (Abacaxi fora) + categoria de produto.
   - `abc` → faixa ∈ {A, B, C} (por faturamento acumulado; A/B/C ≈ 80/15/5).
   - `manual` → busca por nome / SKU / categoria.
   - `oportunidades`/`garimpo` → sem filtro obrigatório (categoria opcional).
4. **Lista viva**: tabela de produtos; por linha: nome, categoria, e **por loja selecionada**: preço, desconto previsto (se houver), preço final, estoque. Fontes automáticas vêm pré-marcadas; usuário marca/desmarca.
5. **Desconto**: em `oportunidades`/`garimpo`, alternar entre **"usar desconto previsto do Gestor"** (o `pct` por item/loja) e **% manual**; em `bcg`/`abc`/`manual`, só **% manual**.
6. **Gerar**: dispara a geração só dos itens marcados, por item × loja.

Os passos seguintes do wizard não mudam: **Curar** (escolher entre os criativos/looks gerados), **Publicar** (nova campanha ou existente, PAUSED), **Conferir** (manter pausado / ativar tudo).

## Backend

### Nova Edge `fabrica-candidatos` (leve, ao vivo — chamada pelo painel Gerar)
- Autentica igual à `fabrica-trigger` (getUser + gate `role='admin' OR permissions ? 'meta.fabrica'`).
- Entrada: `{ lojas: [depositoId…], fonte, filtros }`.
- Resolve a lista de candidatos conforme a fonte:
  - `oportunidades`/`garimpo`: lê `gestao_comercial_briefings` mais recente → `dados_json.oportunidades|garimpo`, casa por loja selecionada; cada item já traz `sku, descricao, categoria, precoOriginal, pct, precoComDesconto, estoqueLoja`.
  - `bcg`: recomputa o quadrante de cada SKU a partir de `gc_vendas_item` + `gc_estoque_item` (mesma lógica `_bcgClass` do Gestor, **extraída para `coletor/lib/classificacao-comercial.mjs`** e reusada pela Edge via import ou reimplementação espelhada), filtra pelos quadrantes + categoria pedidos.
  - `abc`: ranqueia SKUs por faturamento (de `gc_vendas_item`), corta na faixa A/B/C pedida; cruza com estoque.
  - `manual`: busca no catálogo (Bling / `gc_*`) por termo.
- Enriquece preço/estoque por loja (Bling/`gc_estoque_item`).
- Saída: `[{ sku, nome, categoria, porLoja: { <depositoId>: { preco, pctPrevisto|null, precoComDesconto|null, estoque } } }]`.
- Não gera imagem; responde em segundos.

### `gerar-criativos.mjs` — modo lista explícita
- `run(opts)` passa a aceitar `opts.itens = [{ sku, deposito, pct }]` (loja = `deposito`; `pct` = o desconto resolvido pelo painel — previsto ou manual, por item). Quando `itens` vem, adiciona um 3º ramo (antes do ramo estrela) que monta `cands` no mesmo shape dos ramos existentes (`{ id:null, sku, nome, preco, deposito_id }`), resolvendo `nome`/`preco` via Bling (`blingProdutos`, como `candidatosEstrela` já faz) — ignora `fabrica_rodadas`/`fabrica_candidatos`.
- **pct por item** (refinamento da exploração): hoje o `pct` é único por campanha (`campanha.desconto_pct`, usado em `variacoesProduto(cand, campanha, opts)`). Como o "desconto previsto" varia por item, `variacoesProduto` passa a receber o `pct` **do item** (fallback pro pct global quando não vier por item). É a única mudança de lógica além de injetar a lista.
- Modos antigos (`--fonte`/`--estrela` lendo tabelas) permanecem só para o CLI/retrocompatibilidade; o Estúdio usa `itens`.
- `job.params` (jsonb em `fabrica_jobs`) carrega `itens` — **a Edge `fabrica-trigger` e o job-runner NÃO mudam** (repassam `params` cru; confirmado na exploração).

### `coletor/lib/classificacao-comercial.mjs` (novo, compartilhado)
- Extrai de `coletor/gestor-comercial.mjs`: `_bcgClass(item)` (Estrela/Vaca/Interrogação/Abacaxi) e o ranking ABC por faturamento. O Gestor passa a importar daqui (sem mudar comportamento), garantindo que Estúdio e Gestor classifiquem igual.

## Marca + Loja/canal como dado (fundação multi-marca/multi-loja)

A config hoje hardcoded se divide em dois níveis (confirmado na exploração: ACT/PAGE/IG/ACCOUNT_ID são **idênticos** nas duas lojas → são da marca; whatsapp/geo/canal variam → são da loja):

- **Nova tabela `fabrica_marcas`** (config de marca):
  - `id uuid pk`, `nome text` (ex.: a marca atual — usada nas legendas), `caption_template text` (ex.: `'{desconto} em bolsas {marca} · chame a gente 💬'`, ou legenda pronta), `ad_account text` (o `ACT`, ex.: `act_1197997517858139`), `page_id text` (`324679337390168`), `ig_id text` (`17841462952561833`), `account_id text` (accountId do meta-proxy, `b6883e82-07cb-4f21-9fd7-ea7626786174`), `ativo boolean default true`, `created_at`.
  - Seed: 1 linha com a marca atual + os IDs reais acima. **O nome de marca nas legendas vem daqui — zero "La Vessel" hardcoded no código** (a UI/título do app é neutra, sem marca).
- **`fabrica_lojas`** ganha (hoje só tem `deposito_id/nome/ativo/ordem`):
  - `marca_id uuid references fabrica_marcas(id)`, `whatsapp text`, `geo_cities jsonb` (array de city keys), `canal_loja_id text`. Seed: Tivoli (`deposito_id 14888726315`, whatsapp `+5519971690502`, geo `[267873,241913]`, canal `205834140`) e Dom Pedro (`14888617206`, `+5519999545112`, `[247071]`, `205657609`), ambas apontando pra marca atual.
- **`gerar`/`subir`/`ativar`** passam a **ler marca + loja de `fabrica_marcas`/`fabrica_lojas`** (loja por `deposito_id`, marca via `loja.marca_id`), em vez das constantes `CFG`/`LOJAS`/`CAPTION_PADRAO` no código.
- Efeito: adicionar marca = inserir linha em `fabrica_marcas` (com sua conta/página/IG/legenda) + suas lojas em `fabrica_lojas`. Nenhum código muda. O seletor de loja do Gerar lista as lojas ativas; o seletor de marca é fase futura (hoje resolve a única marca ativa).

## Remoção limpa da F1

- Front: remover `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, a rota `/fabrica-anuncios` em `src/mapa-de-enderecos.js`, e o card no `tela-de-menu-meta-ads.vue`. O nome que sobrevive é **"Estúdio de Criativos"** (decisão do Breno: migrar tudo pro Estúdio) — fica só um card, apontando pra `/fabrica-estudio`.
- Coletor: remover `coletor/fabrica-anuncios.mjs`.
- Banco: migration que **dropa** `fabrica_candidatos` e `fabrica_rodadas`. **Atenção (exploração):** `fabrica_criativos.candidato_id` tem FK → `fabrica_candidatos`; a migration precisa **dropar essa coluna/constraint** de `fabrica_criativos` antes (o modo-lista grava `candidato_id: null` / deixa de gravar). Manter `fabrica_marcas`/`fabrica_lojas`/`fabrica_campanhas`/`fabrica_criativos`/`fabrica_jobs`.
- Permissão `meta.fabrica` permanece (agora só o Estúdio).

## Segurança / cuidados

- Edge `fabrica-candidatos` gated igual à trigger (nunca pública).
- Geração continua PAUSED; ativação continua com `confirm()` + dry sem Graph (inalterado).
- `dados_json` é conteúdo do Gestor (não input do usuário), mas a Edge valida os campos que usa (defensivo).
- Nada de segredo novo.

## Testes

- **Edge `fabrica-candidatos`**: cada fonte devolve o shape certo; `oportunidades`/`garimpo` trazem `pctPrevisto`; `bcg` filtra pelos quadrantes pedidos e bate com `_bcgClass`; `abc` corta na faixa certa; `manual` busca por termo; preço/estoque por loja corretos; gate 401/403.
- **`classificacao-comercial.mjs`**: `_bcgClass` cobre os 4 quadrantes; ranking ABC ordena por faturamento; Gestor importando dá o mesmo resultado de antes.
- **`gerar-criativos` modo lista**: `itens=[{sku,deposito,pct}]` gera item×loja com o `pct` certo; previsto vs manual.
- **Config de marca/loja por tabela**: `subir/ativar` leem ACT/PAGE/IG/legenda da `fabrica_marcas` e whatsapp/geo da `fabrica_lojas` (não do código); a legenda gerada usa o nome de marca da tabela (não "La Vessel" fixo); inserir loja fake ativa → aparece no seletor.
- **Remoção F1**: build limpo sem a tela/rota/card; nenhuma referência pendente a `fabrica_candidatos`/`fabrica_rodadas`.

## Sequência de implementação (para o plano)

1. **Fundação multi-marca/multi-loja**: tabela `fabrica_marcas` + colunas em `fabrica_lojas` (`marca_id`/whatsapp/geo/canal) + seed + `subir/ativar/gerar` lendo marca+loja da tabela (legenda/ACT/PAGE/IG da marca; whatsapp/geo da loja). (Não muda comportamento observável; destrava escala e tira "La Vessel" do código.)
2. **`classificacao-comercial.mjs`** compartilhado (extrai `_bcgClass` + ranking ABC do Gestor).
3. **Edge `fabrica-candidatos`** (lista viva).
4. **`gerar-criativos` modo lista explícita** (`opts.itens` + pct por item). (Trigger/runner inalterados.)
5. **Painel Gerar 2.0** (loja/fonte/filtros/lista/curadoria/desconto).
6. **Remoção da F1** (tela/rota/card/robô + migration drop tabelas + FK candidato_id).

## Fora de escopo (por ora)

- Novos canais que não sejam Meta/WhatsApp (a fundação prepara o dado, mas cada canal novo com mecânica própria de publicação é projeto à parte).
- Curva ABC com bandas configuráveis (fixa 80/15/5 por ora).
- Mudanças nos passos Curar/Publicar/Conferir (inalterados).

## Referências

- F1: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, `coletor/fabrica-anuncios.mjs`.
- Gestor: `coletor/gestor-comercial.mjs` (`_bcgClass` L173-183, `LADDER`/`BCG_ALVO`, `montarOportunidades`), `gestao_comercial_briefings.dados_json`, `gc_vendas_item`/`gc_estoque_item` (migrations 011/012). Ver [[project_iamundi_gestor]], [[project_iamundi_gt_kpis]].
- Estúdio atual: `src/ferramentas/meta-ads/painel-gerar.vue` + `tela-de-fabrica-estudio.vue`; `coletor/gerar-criativos.mjs`, `subir-estudio.mjs`, `ativar-estudio.mjs`, `fabrica-job-runner.mjs`; Edge `fabrica-trigger`. Tabelas migrations 014-017.
