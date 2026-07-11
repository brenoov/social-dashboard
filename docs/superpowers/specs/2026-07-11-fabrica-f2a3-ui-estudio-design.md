# Fábrica de Anúncios — F2a.3: UI "Estúdio" (gerar / curar / subir pelo painel)

**Data:** 2026-07-11
**Status:** aprovado no brainstorm, aguardando revisão do spec

## Objetivo

Dar uma UI na seção Meta Ads do iamundi para **gerar**, **curar** e **subir** criativos da Fábrica de Anúncios pelo painel, sem rodar script na mão. Hoje `gerar-criativos.mjs` e a subida ao Meta rodam manualmente no terminal do Breno.

## Restrição arquitetural (o que define o desenho)

O trabalho de **gerar** é pesado: puppeteer/Chromium (HTML→PNG) + Python BiRefNet/rembg (recorte) + Bling + Anthropic. **Não roda no browser nem em Edge Function (Deno isolate).** Só num runner Node com Chromium e Python — e o único ambiente desse tipo que já existe no repo é **GitHub Actions**. A **subida** é leve (só `meta-proxy`), mas por simetria e para reusar o mesmo runner, também é disparada via Actions.

Decisão (Caminho A, aprovada): **UI → Edge Function de gatilho (`fabrica-trigger`) → GitHub Actions `workflow_dispatch`**, com status refletido numa tabela `fabrica_jobs` que a UI faz polling.

## Fluxo (3 passos numa tela "Estúdio")

1. **Gerar** — formulário (desconto %, looks a marcar com favoritos 4/5/7/10 pré-selecionados, limite, fonte = rodada F1 atual) → dispara o job de geração. Status ao vivo `enfileirado → rodando → concluído`; ao concluir, carrega os criativos do lote.
2. **Curar** — grid de thumbnails dos criativos gerados (por loja/look), clique alterna `escolhido` (a coluna já existe), preview grande, contador.
3. **Subir** — destino = **campanha nova por loja** OU **adicionar a campanha/adset existente** (listados via `meta-proxy`) → sobe os criativos `escolhidos` **PAUSED**. Status + `ad_ids` + link pro Gerenciador.

## Data model

**Nova tabela `fabrica_jobs`** (fonte de status voltada pra UI):
- `id uuid pk default gen_random_uuid()`
- `tipo text` — `'gerar' | 'subir'`
- `params jsonb` — parâmetros do disparo (desconto_pct, nome, limite, looks, loja, destino…)
- `status text default 'enfileirado'` — `'enfileirado' | 'rodando' | 'concluido' | 'erro'`
- `github_run_id text` — id do run do Actions (preenchido pelo runner)
- `resultado jsonb` — ex.: `{ campanha_id }` (gerar) ou `{ ad_ids, meta_campaign_id }` (subir)
- `erro text`
- `criado_por uuid references auth.users`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

**Reusa:** `fabrica_criativos.escolhido` (curadoria), `fabrica_campanhas` (lote gerado), `fabrica_meta_jobs` (rastro detalhado da subida — o runner continua gravando lá).

**RLS `fabrica_jobs`:** SELECT para `authenticated`; **sem** INSERT/UPDATE por authenticated (a Edge insere e o runner atualiza, ambos com service key); `service_role` FOR ALL.

## Backend

### Edge Function `fabrica-trigger` (Deno, leve)
- Autentica (`getUser`) e checa `role='admin' OR permissions ? 'meta.fabrica'` (mesmo padrão do `meta-proxy`). Sem permissão → 403.
- Recebe `{ tipo, params }`, valida `tipo ∈ {gerar,subir}` e faz whitelist dos params → params inválidos = 400.
- Insere linha em `fabrica_jobs` (`status='enfileirado'`, `criado_por`, `params`) com service key → `job_id`.
- (Opcional) rejeita se já existe job ativo (`enfileirado|rodando`) do mesmo `tipo` do mesmo usuário.
- Chama a API do GitHub: `POST /repos/brenoov/social-dashboard/actions/workflows/fabrica.yml/dispatches` (`ref=main`, `inputs={ job_id, tipo, ...params achatados }`). Se falhar, marca o job `erro` e retorna erro.
- Devolve `{ job_id }`.
- Secrets: `GITHUB_PAT_FABRICA` (fine-grained, `actions:write` só nesse repo), `GITHUB_REPO`.

### Workflow `.github/workflows/fabrica.yml`
- `on: workflow_dispatch` com `inputs` (job_id, tipo, desconto_pct, nome, limite, looks, loja, destino…).
- Passos: `checkout` → `setup-node@v4` (Node 20) + `setup-python` → **`actions/cache`** (peso BiRefNet em `~/.u2net`, `coletor/node_modules`, cache pip) → instala (`cd coletor && npm ci` baixa Chromium; `pip install rembg onnxruntime pillow numpy`; baixa o peso BiRefNet se não cacheado) → roda `node --import ./lib/curl-fetch.mjs coletor/fabrica-job-runner.mjs`.
- `concurrency.group` para serializar (como os outros workflows). `timeout-minutes` para não travar indefinidamente.
- Secrets já existentes no repo: `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY*`.

### Novo `coletor/fabrica-job-runner.mjs` (wrapper de status)
- Lê `job_id` (input/env), busca a linha em `fabrica_jobs`, marca `status='rodando'` + `github_run_id`.
- Mapeia os inputs pros flags e chama a lógica de `gerar` ou `subir` — **refatorar** `gerar-criativos.mjs` e o motor de subida (`subir-campanha-meta.mjs`/`adicionar-looks-favoritos.mjs`) para exportarem uma função `run(opts)` reutilizável pelo CLI **e** pelo runner (o CLI vira um thin wrapper que chama `run`).
- No `finally`, sempre grava o estado terminal: `concluido`+`resultado` ou `erro`+mensagem.

## Frontend (`src/ferramentas/meta-ads/`)

Gate `hasPermission('module:meta:fabrica')`. Leitura via `sb()`/PostgREST, escrita de curadoria via `sbClient`, disparo via `sbClient.functions.invoke('fabrica-trigger', { body })`.

- `tela-de-fabrica-estudio.vue` — orquestrador + navegação dos 3 passos + composable `useJobStatus(jobId)` (polling de `fabrica_jobs` a cada ~3s enquanto ativo; para no estado terminal).
- `painel-gerar.vue` — formulário (desconto %, checkboxes de looks c/ favoritos pré-marcados, limite, fonte) + botão Gerar + status.
- `painel-curar.vue` — grid de thumbnails (`fabrica_criativos.url`) filtrável por loja/look, clique alterna `escolhido` (update otimista), preview, contador.
- `painel-subir.vue` — seletor de destino (nova campanha OU existente, listando campanhas/adsets via `meta-proxy`) + botão Subir (PAUSED) + status + `ad_ids`/link.

## Status, erros e feedback

- Ciclo de `fabrica_jobs` com timestamps; UI reage via `useJobStatus`. `erro` → mensagem + "tentar de novo". `rodando` além de ~20 min → aviso de possível travamento (workflow tem `timeout-minutes`).
- Edge: valida (400) / permissão (403) / dispatch falho → job `erro`.
- Runner: try/catch com `finally` que sempre grava o terminal. Rate-limit Meta (code 17) já tratado com retry no motor.

## Segurança

- Front gated + Edge re-checa permissão server-side.
- PAT fine-grained (`actions:write`, um repo), secret da Edge — nunca no front.
- RLS: `fabrica_jobs` só SELECT pra authenticated; escrita só service key.

## Testes

- **Edge `fabrica-trigger`:** auth gate, validação de params, shape do payload de dispatch (mock do fetch do GitHub).
- **`fabrica-job-runner`:** transições de status (`enfileirado→rodando→concluido/erro`) com job `--dry`.
- **Workflow:** um run manual `workflow_dispatch` de ponta a ponta.
- **Front:** smoke manual (o repo não tem harness de teste de front).

## Fora de escopo (por ora)

- Agendamento automático (cron) da geração/subida.
- Escada de desconto por quadrante BCG (job usa % fixo).
- Sync dos PNGs pro Zoho.

## Referências

- Motor atual: `coletor/gerar-criativos.mjs`, `coletor/subir-campanha-meta.mjs`, `coletor/adicionar-looks-favoritos.mjs`, `coletor/templates-criativos/templates.mjs`.
- Tela F1 existente: `src/ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue`.
- Tabelas: `db/migrations/014/015/016`.
- Precedente de workflow parametrizado: `.github/workflows/relatorios-comerciais.yml`.
