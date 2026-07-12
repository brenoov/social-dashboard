# Estúdio de Criativos — Fontes de produto no "Gerar" + consolidação da Fábrica + multi-loja

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** evolui a feature já no ar (specs `2026-07-11-fabrica-f2a3-ui-estudio-design.md` + adendo Conferir/Ativar, e `2026-07-11-fabrica-storage-lifecycle-design.md`).

## Objetivo

Ter **uma única ferramenta** (Estúdio de Criativos) e enriquecer o passo **Gerar** com escolha de **fonte dos produtos** e de **desconto**, lendo direto os dados do Gestor Comercial (fonte de verdade, com desconto previsto). Ao mesmo tempo, **preparar para mais lojas/canais**: tudo que hoje é fixo no código vira dado.

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
- `run(opts)` passa a aceitar `opts.itens = [{ sku, deposito, pct }]` (loja = `deposito`; `pct` = o desconto resolvido pelo painel — previsto ou manual). Quando `itens` vem, ignora a leitura de `fabrica_candidatos` e gera exatamente esses (produto × loja).
- Modos antigos (`--fonte`/`--estrela` lendo tabelas) permanecem só para o CLI/retrocompatibilidade; o Estúdio usa `itens`.
- `job.params` (jsonb em `fabrica_jobs`) carrega `itens` (a Edge `fabrica-trigger` já repassa `params` cru; o job-runner idem).

### `coletor/lib/classificacao-comercial.mjs` (novo, compartilhado)
- Extrai de `coletor/gestor-comercial.mjs`: `_bcgClass(item)` (Estrela/Vaca/Interrogação/Abacaxi) e o ranking ABC por faturamento. O Gestor passa a importar daqui (sem mudar comportamento), garantindo que Estúdio e Gestor classifiquem igual.

## Loja/canal como dado (fundação multi-loja)

- Migration: adicionar a `fabrica_lojas` as colunas de config hoje hardcoded: `whatsapp text`, `geo_cities jsonb`, `page_id text`, `ig_id text`, `ad_account text`, `canal_loja_id text` (`deposito_id` e `ativo` já existem). Seed com os valores atuais de Tivoli/Dom Pedro (extraídos de `subir-campanha-*.mjs`/`subir-estudio.mjs`/`ativar-estudio.mjs`).
- `gerar-estudio`/`subir-estudio`/`ativar-estudio` passam a **ler a config da loja de `fabrica_lojas`** (por `deposito_id`), em vez das constantes `CFG`/`LOJAS` no código. `ACCOUNT_ID` do meta-proxy também vira coluna (ou fica global se único).
- Efeito: adicionar loja/canal = inserir uma linha ativa em `fabrica_lojas` (o seletor do Gerar já a mostra; subir/ativar já a respeitam).

## Remoção limpa da F1

- Front: remover `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, a rota `/fabrica-anuncios` em `src/mapa-de-enderecos.js`, e o card no `tela-de-menu-meta-ads.vue`. O nome que sobrevive é **"Estúdio de Criativos"** (decisão do Breno: migrar tudo pro Estúdio) — fica só um card, apontando pra `/fabrica-estudio`.
- Coletor: remover `coletor/fabrica-anuncios.mjs`.
- Banco: migration que **dropa** `fabrica_candidatos` e `fabrica_rodadas` (após grep confirmar que nada mais lê — `gerar-criativos` modo-lista não lê). Manter `fabrica_lojas`/`fabrica_campanhas`/`fabrica_criativos`/`fabrica_jobs`.
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
- **Config de loja por tabela**: inserir loja fake ativa → aparece no seletor; `subir/ativar` leem whatsapp/geo/ids da tabela (não do código).
- **Remoção F1**: build limpo sem a tela/rota/card; nenhuma referência pendente a `fabrica_candidatos`/`fabrica_rodadas`.

## Sequência de implementação (para o plano)

1. **Fundação multi-loja**: colunas em `fabrica_lojas` + seed + `subir/ativar/gerar` lendo da tabela. (Não muda comportamento; destrava escala.)
2. **`classificacao-comercial.mjs`** compartilhado (extrai do Gestor).
3. **Edge `fabrica-candidatos`** (lista viva).
4. **`gerar-criativos` modo lista explícita** + `fabrica-trigger` aceitando `itens`.
5. **Painel Gerar 2.0** (loja/fonte/filtros/lista/curadoria/desconto).
6. **Remoção da F1** (tela/rota/card/robô/tabelas) + nome definitivo.

## Fora de escopo (por ora)

- Novos canais que não sejam Meta/WhatsApp (a fundação prepara o dado, mas cada canal novo com mecânica própria de publicação é projeto à parte).
- Curva ABC com bandas configuráveis (fixa 80/15/5 por ora).
- Mudanças nos passos Curar/Publicar/Conferir (inalterados).

## Referências

- F1: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`, `coletor/fabrica-anuncios.mjs`.
- Gestor: `coletor/gestor-comercial.mjs` (`_bcgClass` L173-183, `LADDER`/`BCG_ALVO`, `montarOportunidades`), `gestao_comercial_briefings.dados_json`, `gc_vendas_item`/`gc_estoque_item` (migrations 011/012). Ver [[project_iamundi_gestor]], [[project_iamundi_gt_kpis]].
- Estúdio atual: `src/ferramentas/meta-ads/painel-gerar.vue` + `tela-de-fabrica-estudio.vue`; `coletor/gerar-criativos.mjs`, `subir-estudio.mjs`, `ativar-estudio.mjs`, `fabrica-job-runner.mjs`; Edge `fabrica-trigger`. Tabelas migrations 014-017.
