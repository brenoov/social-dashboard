# Estúdio (Fábrica de Anúncios) — SP-3: Objetivo da campanha no passo 1

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** terceiro dos 6 sub-projetos da evolução do Estúdio (SP-1 polimento + SP-2 home/não-travar já no ar). Evolui a feature em `/fabrica-estudio`.

## Objetivo

Hoje toda campanha que o Estúdio cria é **cravada** em WhatsApp/engajamento: `criarCampanhaNova` (`coletor/subir-estudio.mjs`) fixa `objective:'OUTCOME_ENGAGEMENT'`, `optimization_goal:'CONVERSATIONS'`, `destination_type:'WHATSAPP'`. O SP-3 introduz a dimensão **objetivo** — escolhida no passo **Gerar** — que muda tanto **quais criativos são gerados** quanto **a campanha criada no Meta** (objective/optimization/destination/CTA). Quatro objetivos: engajamento, conversão, branding (reconhecimento), tráfego.

## Decisões travadas no brainstorm

- **Objetivo escolhido no Gerar (passo 1)**, gravado na rodada (`fabrica_campanhas.objetivo`), e viaja até o Subir. É no Gerar porque o objetivo **muda os criativos gerados**.
- **Config-as-data** (Abordagem A): uma tabela `fabrica_objetivos` mapeia cada objetivo → parâmetros do Meta. Adicionar/ajustar objetivo = editar uma linha, sem deploy. Coerente com a fundação multi-marca/multi-loja do SP-2 (`fabrica_marcas`/`fabrica_lojas`).
- **O objetivo muda os criativos**: cada look em `templates.mjs` é etiquetado por objetivo; o Gerar cruza os looks da marca com os permitidos pelo objetivo. Para não deixar branding vazio (todos os looks atuais são de oferta/preço), o SP-3 **cria 1-2 looks de branding** sem preço.
- **Sub-destinos finos são SP-4**: cada objetivo tem um **destino padrão** no SP-3 (engajamento/conversão/tráfego → WhatsApp; branding → Instagram). O seletor fino (URL de site + pixel na conversão, público, perfil-clicável, avulso/remessa) fica pro SP-4. O caminho de site fica estruturalmente suportado na tabela mas gated até existir pixel.
- **Só engajamento/WhatsApp está provado** no Graph. Conversão, branding e tráfego têm combos que precisam de **validação ao vivo** (subir 1 campanha PAUSED de teste por objetivo, confirmar aceite, ajustar a linha da tabela se reclamar). Nada gasta — tudo PAUSED.

## Modelo de dados

### `fabrica_campanhas.objetivo` (migration)
`ALTER TABLE fabrica_campanhas ADD COLUMN objetivo text NOT NULL DEFAULT 'engajamento'`. Rodadas antigas ficam `engajamento` (o comportamento atual). Gravada no disparo do Gerar (via `fabrica-trigger` params → `gerar-criativos`).

### `fabrica_objetivos` (tabela nova, config)
Uma linha por objetivo. Colunas:
- `chave text primary key` — `engajamento` | `conversao` | `branding` | `trafego`
- `rotulo text` — rótulo pt-BR exibido no seletor (ex.: "Engajamento (WhatsApp)")
- `descricao text` — uma linha de ajuda no seletor
- `meta_objective text` — ex.: `OUTCOME_ENGAGEMENT`
- `optimization_goal text` — ex.: `CONVERSATIONS`
- `billing_event text` — default `IMPRESSIONS`
- `destination_type text null` — ex.: `WHATSAPP`; `null` quando não há messaging (branding)
- `promoted_object_tipo text` — `whatsapp` | `page` | `ig` | `none` (como montar `promoted_object` a partir da marca/loja)
- `cta_type text` — ex.: `WHATSAPP_MESSAGE`, `LEARN_MORE`, `INSTAGRAM_MESSAGE`
- `looks text[]` — etiquetas de look que servem a este objetivo (cruzado com os looks da marca)
- `pede_desconto boolean` — se o passo Gerar mostra o campo de desconto (branding = false)
- `ativo boolean default true`, `ordem int`

RLS: leitura por `authenticated` (o seletor do front lê); escrita só service-role/admin (mesma política das outras tabelas `fabrica_*`).

Seed das 4 linhas: ver **Mapa dos objetivos** abaixo.

### Etiqueta de look em `templates.mjs`
Cada look ganha metadado `objetivos: string[]`. Ex.: looks de preço (`produto-heroi`, `preco-tipo`, `split`, `editorial-sale`) → `['engajamento','conversao','trafego']`; looks editoriais/marca → `['branding']` (+ os novos). Um look sem `objetivos` é tratado como servindo todos (retrocompat). O gerador filtra: `looksDoObjetivo(objetivoChave, looksDaMarca)` = interseção entre os looks etiquetados pra aquele objetivo e os looks que a marca usa.

## Mapa dos objetivos → Meta (seed de `fabrica_objetivos`)

| chave | meta_objective | optimization_goal | destination_type | promoted_object_tipo | cta_type | looks | pede_desconto | status |
|---|---|---|---|---|---|---|---|---|
| `engajamento` | `OUTCOME_ENGAGEMENT` | `CONVERSATIONS` | `WHATSAPP` | `whatsapp` | `WHATSAPP_MESSAGE` | preço | sim | ✅ provado |
| `conversao` | `OUTCOME_SALES` | `CONVERSATIONS` | `WHATSAPP` | `whatsapp` | `WHATSAPP_MESSAGE` | preço | sim | ⚠️ validar |
| `branding` | `OUTCOME_AWARENESS` | `REACH` | `null` | `none` | `LEARN_MORE` (link p/ perfil IG) | branding | não | ⚠️ validar |
| `trafego` | `OUTCOME_TRAFFIC` | `LINK_CLICKS` | `WHATSAPP` | `whatsapp` | `WHATSAPP_MESSAGE` | preço | sim | ⚠️ validar |

Notas de validação:
- **conversao (OUTCOME_SALES + WhatsApp):** pode exigir uma "conversion location = messaging" e/ou `promoted_object` com pixel. Se o Graph reclamar, alternativas: manter `OUTCOME_ENGAGEMENT` com sinalização de venda, ou aguardar pixel (SP-4). Ajuste = editar a linha.
- **branding (OUTCOME_AWARENESS):** awareness otimiza alcance, não clique-no-perfil. O "ir ao Instagram" é levado pela CTA/criativa (link para o perfil IG da marca), não pela otimização. Se o desejo for clique-no-perfil de fato, o objetivo correto é tráfego/engagement profile-visits — configurável trocando a linha.
- **trafego:** `LINK_CLICKS` com destino WhatsApp é aceito; validar o combo com `promoted_object` whatsapp.

`promoted_object` é montado a partir de `promoted_object_tipo` + marca/loja: `whatsapp` → `{ page_id: MARCA.pageId, whatsapp_phone_number: loja.whatsapp }`; `page` → `{ page_id }`; `ig` → `{ instagram_user_id: MARCA.igId }` (o `instagram_actor_id` foi descontinuado na v22 — usar `instagram_user_id`); `none` → omitido.

## Fluxo Gerar (passo 1)

- `painel-gerar.vue`: novo seletor **Objetivo** no topo (antes de fonte/desconto), lendo `fabrica_objetivos` ativos (via `sb('fabrica_objetivos?...&ativo=eq.true&order=ordem')`). Default = primeira linha (`engajamento`).
- O campo de **desconto** só aparece quando o objetivo tem `pede_desconto=true` (branding esconde).
- O objetivo entra no `params` do `fabrica-trigger` (tipo `gerar`) → gravado em `fabrica_campanhas.objetivo` (o trigger já cria a campanha up-front no SP-2; passa a setar também `objetivo`).
- `gerar-criativos.run()` recebe `objetivo` (via job params), busca a linha de `fabrica_objetivos`, e gera **só os looks** de `looksDoObjetivo(objetivo, looksDaMarca)`. Ajusta CTA/legenda conforme o objetivo (a legenda de IA já é por-produto do SP-anterior; passa o objetivo como contexto pro tom).

## Fluxo Subir

- `criarCampanhaNova(loja)` deixa de cravar os parâmetros: lê `fabrica_campanhas.objetivo` da rodada → busca a linha de `fabrica_objetivos` → monta:
  - campaign: `{ name, objective: row.meta_objective, status:'PAUSED', special_ad_categories:[] }`
  - adset: `{ optimization_goal: row.optimization_goal, billing_event: row.billing_event, destination_type: row.destination_type (se não-null), promoted_object: montaPromotedObject(row.promoted_object_tipo, MARCA, loja), targeting, status:'PAUSED', daily_budget }`
- `meta-subir.mjs` já ramifica CTA/criativa por `destination_type` (multi-destino vs WhatsApp-puro). Para `destination_type=null` (branding), a criativa usa `object_story_spec` simples com a CTA do objetivo (link para o perfil IG) — caminho novo em `payloadCriativa` que precisa lidar com "sem messaging".
- **Destino `existente`** (injetar em campanha já criada): inalterado — lê o `destination_type` real de cada conjunto, como hoje. O objetivo só governa o caminho `nova`.

## Looks de branding (1-2 novos em `templates.mjs`)

- **`marca-lifestyle`**: produto recortado em respiro sobre fundo de marca, logo, frase curta de marca; **sem preço/"50%"**. Etiqueta `objetivos:['branding']`.
- **`marca-editorial`**: variação de `editorial-v2` com o bloco de oferta desligado (só imagem + nome/assinatura de marca). Etiqueta `objetivos:['branding']`.
- Ambos renderizados pelo mesmo `render-criativo.mjs` (puppeteer) nos 2 formatos (1080×1350 e 1080×1920). Reusam o recorte BiRefNet e os assets/fontes base64 já existentes.

## Segurança / cuidados

- Tudo continua **PAUSED**; o SP-3 não ativa nada. A ativação segue no job `ativar` (money-path com confirmação), inalterado.
- `fabrica_objetivos` leitura autenticada, escrita service-role/admin.
- Validação ao vivo dos 3 combos ⚠️ cria campanhas **PAUSED** de teste (nada gasta); apagáveis pelo `fabrica-apagar` (SP-2) ou direto no Gerenciador.
- Nenhum ID/objetivo hardcoded novo: tudo sai da tabela (adeus `OUTCOME_ENGAGEMENT` cravado).

## Testes

- **node:test (puros, coletor):** `mapaObjetivo(chave)`/`montaPromotedObject(tipo, marca, loja)` devolvem o combo certo; `looksDoObjetivo(objetivo, looksMarca)` filtra a interseção certa (inclui o caso "look sem etiqueta = todos"); `criarCampanhaNova` monta o payload esperado por objetivo com `--dry` (sem tocar no Graph). Os testes existentes de gerar/subir/ativar seguem verdes.
- **Validação ao vivo (checkpoint):** 1 campanha PAUSED de teste por objetivo ⚠️; ajustar a linha da tabela se o Graph reclamar.
- **Front:** `vite build` + smoke do seletor (troca de objetivo esconde desconto no branding; params carregam o objetivo).
- **Migração:** coluna `objetivo` + tabela `fabrica_objetivos` + seed 4 linhas + etiquetas nos looks.

## Fora de escopo (próximos SPs)

- **SP-4** construtor de campanhas: sub-destinos finos (site+pixel na conversão, perfil-clicável, público/remarketing, avulso vs remessa, vídeo, WhatsApp específico por conjunto).
- **SP-5** gestão de templates/looks (+ Canva) — CRUD dos looks e conexão de novos; o SP-3 só etiqueta os existentes e adiciona 2.
- **SP-6** tutorial interativo.

## Referências

- `coletor/subir-estudio.mjs` (`criarCampanhaNova` L152-179, `run()`), `coletor/lib/meta-subir.mjs` (`payloadCriativa`/`subirCriativos`, ramifica por `destination_type`), `coletor/lib/config-lojas.mjs` (carrega marca/loja), `coletor/templates-criativos/templates.mjs` (looks + etiquetas), `coletor/gerar-criativos.mjs` (`run()` recebe objetivo).
- `supabase/functions/fabrica-trigger/index.ts` (grava `objetivo` no gerar).
- `src/ferramentas/meta-ads/painel-gerar.vue` (seletor de objetivo), `painel-subir.vue`.
- Tabelas: `fabrica_campanhas` (+`objetivo`), `fabrica_objetivos` (nova), `fabrica_marcas`/`fabrica_lojas` (SP-2).
