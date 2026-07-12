# Estúdio (Fábrica de Anúncios) — SP-2: Home da Fábrica + não-travar + persistência

**Data:** 2026-07-12
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** segundo dos 6 sub-projetos da evolução do Estúdio (SP-1 polimento já no ar). Evolui a feature em `/fabrica-estudio`.

## Objetivo

Resolver duas dores: (1) a geração é **lenta** (GitHub Actions + puppeteer + BiRefNet, ~30-60s+) e hoje **trava** a tela (o painel Gerar faz polling inline até terminar); (2) **perde-se o trabalho** ao sair da página. A solução: uma **Home/panorama** antes do wizard, com as **campanhas em criação**; o disparo cria a rodada na hora e roda em **background** (você navega livre); cada rodada tem sua **própria URL** (retoma onde parou); e os criativos **aparecem aos poucos** no Curar enquanto geram.

## Decisões travadas no brainstorm

- **Home é a tela inicial.** Cada rodada (`fabrica_campanhas`) é criada **no disparo** (não só ao fim da geração) e vira uma "coisa" com URL própria.
- **Panorama:** números gerais + campanhas em criação (principal) + publicadas recentes + atalho pros templates (placeholder do SP-5).
- **Não-travar:** disparar não bloqueia; a Home mostra o progresso; abrir a campanha durante a geração mostra os criativos **em streaming** (polling no Curar até `status='pronta'`).
- **Apagar cancela a geração** (com confirmação): cancela o run (best-effort), apaga campanha + criativos + Storage.

## Estrutura de telas e rotas

- **`/fabrica-estudio` → Home** — nova tela `src/ferramentas/meta-ads/tela-de-fabrica-home.vue`.
- **`/fabrica-estudio/nova` → Nova campanha** — o passo Gerar (form loja/fonte/desconto). Ao disparar → cria a campanha → redireciona pra `/fabrica-estudio/<id>`.
- **`/fabrica-estudio/<id>` → a campanha** — Curar → Subir → Conferir daquela rodada (a `tela-de-fabrica-estudio.vue` atual, agora parametrizada pelo `:id` da rota).

Rotas em `src/mapa-de-enderecos.js`: a rota atual `fabrica-estudio` passa a apontar pra Home; adicionar `fabrica-estudio-nova` (`/fabrica-estudio/nova`) e `fabrica-estudio-campanha` (`/fabrica-estudio/:id`). Gate `meta.fabrica` em todas.

## Modelo de estado — o que é uma "campanha em criação"

`fabrica_campanhas` ganha um **`status`**: 
- `gerando` — disparada, job de geração rodando, criativos sendo inseridos.
- `pronta` — geração concluída (job `concluido`), criativos existem, ainda não publicada.
- `erro` — o job de geração falhou.
- `cancelada` — o usuário apagou (some da lista).
- (publicada = `fechada_em` setado pelo subir — sai de "em criação", entra em "publicadas recentes").

"**Em criação**" = `status ∈ {gerando, pronta, erro}` AND `fechada_em IS NULL` AND `purgado_em IS NULL` AND `status <> 'cancelada'`.

## Home (`tela-de-fabrica-home.vue`)

Gate `hasPermission('module:meta:fabrica')`. Estética `.fest` (reusa `estudio.css`; respeita tema claro do SP-1). Botão "← Central" e "Nova campanha".

- **Números gerais** — 3 cartões: em criação (count), criativos gerados (`fabrica_criativos` count), publicadas (count de `fabrica_campanhas` com `fechada_em`).
- **Campanhas em criação** (seção principal) — lista as "em criação" (order by `created_at` desc). Cada cartão: nome, **status ao vivo** ("Gerando… N criativos" com spinner / "Pronta pra curar" / "Deu erro ao gerar"), botão **Abrir** (→ `/fabrica-estudio/<id>`) e **Apagar** (confirmação → Edge `fabrica-apagar`). **Polling** (a cada ~4s enquanto houver alguma `gerando`) atualiza status e contagem — reusar o padrão do `useJobStatus`/`sb()`.
- **Publicadas recentes** — `fabrica_campanhas` com `fechada_em NOT NULL` (order desc, limit ~8); nome + data + link pro Gerenciador de Anúncios (via `fabrica_meta_jobs.meta_campaign_id` da campanha, se houver). Read-only.
- **Atalho pros templates** — card placeholder "Looks & Templates (em breve)" (leva ao SP-5 no futuro; por ora inerte/desabilitado).

## Não-travar + streaming

- **Nova campanha** (`/fabrica-estudio/nova`): o painel Gerar atual, MAS o `gerar()` deixa de fazer polling inline. Ao disparar: `fabrica-trigger` (tipo `gerar`) cria a campanha + o job e retorna `{ campanhaId }`; o front faz `router.push('/fabrica-estudio/'+campanhaId)`. A tela da campanha abre no Curar (streaming). A Home passa a mostrar a campanha `gerando`.
- **Streaming no Curar:** enquanto a campanha está `status='gerando'`, o Curar faz polling de `fabrica_criativos` (a cada ~4s) e novos criativos aparecem; um aviso "ainda gerando…" fica visível; para o polling quando `status='pronta'` (ou `erro`). A curadoria (`escolhido`) já funciona por criativo — pode marcar os que já apareceram.
- Reusar/estender `useJobStatus` e/ou um novo composable `useCampanha(id)` que expõe `campanha` (com status) + criativos com polling.

## Apagar / cancelar — Edge `fabrica-apagar`

Nova Edge (Deno, auth gated igual ao `fabrica-trigger`: `getUser` + `role='admin' OR is_superadmin OR permissions ? 'meta.fabrica'`). Recebe `{ campanhaId }`:
1. Carrega a campanha; se `status='gerando'` e tem `job_id`/`github_run_id`, **cancela o Actions run** (best-effort: `POST /repos/<repo>/actions/runs/<run_id>/cancel` com `GITHUB_PAT_FABRICA`; ignora falha).
2. Apaga do Storage os `storage_path` dos `fabrica_criativos` da campanha (bucket `fabrica-criativos`).
3. **Apaga a campanha** (`delete fabrica_campanhas where id=...`) — o `ON DELETE CASCADE` de `fabrica_criativos.campanha_id` remove os criativos.
4. Retorna `{ ok: true }`. Idempotente (campanha inexistente → ok).

> Nota: se o run ainda estiver escrevendo criativos quando a campanha é apagada, os inserts seguintes falham no FK (campanha sumiu) e o job termina em erro — aceitável ("robô termina no vazio, sem sujeira"). O `github_run_id` precisa estar acessível: o runner já grava `github_run_id` no `fabrica_jobs`; o Edge lê o job pela `campanha.job_id`.

## Backend — mudanças

- **Migration `021_fabrica_campanhas_status.sql`:** `ALTER TABLE fabrica_campanhas ADD COLUMN status text NOT NULL DEFAULT 'gerando'`, `ADD COLUMN job_id uuid`, `ADD COLUMN criado_por uuid REFERENCES auth.users`. (Rodadas antigas já publicadas têm `fechada_em` setado, então não aparecem em "em criação" mesmo com status default; ok.)
- **`fabrica-trigger` (só `tipo='gerar'`):** antes de criar o job, criar a `fabrica_campanhas` (`nome` automático — ex.: `Rodada · <fonte ou 'manual'> · <dd/mm HH:MM>` a partir de `params`; `desconto_pct` null, pois o pct é por item; `status='gerando'`, `criado_por`). Criar o job com `params.campanhaId = <id>` e `fabrica_campanhas.job_id = job.id`. Retornar `{ campanhaId, job_id }`. Se o dispatch do Actions falhar, marcar a campanha `status='erro'` (além do job). **`tipo='subir'/'ativar'` não mudam** (operam numa campanha existente).
- **`gerar-criativos.mjs`:** `run()` passa a aceitar `campanhaId` em `opts`; quando vem, **usa** essa campanha (não cria `fabrica_campanhas`). Sem `campanhaId` (CLI legado), mantém o comportamento atual (cria). O nome auto vem do trigger, não do gerar.
- **`fabrica-job-runner.mjs`:** no `tipo='gerar'`, ao concluir, setar `fabrica_campanhas.status='pronta'` (sucesso) ou `'erro'` (falha) para a campanha do job (`job.params.campanhaId`). (Espelha o padrão do `fechada_em` no subir.)
- **`painel-gerar.vue`:** o `gerar()` não faz mais polling inline; após `{campanhaId}` da trigger, `router.push` pra `/fabrica-estudio/<campanhaId>`. Remover o `useJobStatus` inline do Gerar (o status agora vive na Home/na campanha).

## Segurança / cuidados

- Edge `fabrica-apagar` gated (nunca pública). Deleta Storage + linhas — só admin/`meta.fabrica`. Confirmação no front antes de chamar.
- Cancelar o Actions run reusa `GITHUB_PAT_FABRICA` (secret já setado). Best-effort (falha não bloqueia a exclusão).
- Nada de dado durável perdido: publicadas (`fechada_em`) não são afetadas; só rodadas em criação/canceladas somem.
- A purga diária (`fabrica-purga`) continua limpando rodadas fechadas/abandonadas; o apagar manual é imediato e complementar.

## Testes

- **Edge `fabrica-apagar`:** gate 401/403; apaga campanha + criativos (cascade) + Storage; campanha inexistente → ok; best-effort cancel não quebra.
- **`fabrica-trigger`:** `gerar` cria a campanha up-front (status gerando) + job com campanhaId; dispatch falho → campanha erro.
- **`gerar-criativos`:** com `campanhaId` usa a campanha existente (não cria); sem, cria (CLI legado) — testes das funções puras seguem; smoke `--dry`.
- **`fabrica-job-runner`:** gerar concluído → campanha `pronta`; falha → `erro` (teste da função de estado).
- **Front:** `vite build` + smoke — disparar não trava (vai pra Home/campanha); Home lista em criação + publicadas + números; status atualiza ao vivo; streaming no Curar; apagar remove e some.

## Fora de escopo (próximos SPs)

SP-3 objetivo no passo 1; SP-4 construtor de campanhas; SP-5 gestão de templates (o atalho da Home aponta pra cá); SP-6 tutorial. Também fora: acelerar a geração em si (worker persistente) — o SP-2 ataca a lentidão pelo lado do "não-travar", não pela velocidade bruta.

## Referências

- `src/ferramentas/meta-ads/tela-de-fabrica-estudio.vue` (wizard, vira per-`:id`), `painel-gerar.vue` (dispara), `painel-curar.vue` (streaming), `use-job-status.js`, `estudio.css`.
- `supabase/functions/fabrica-trigger/index.ts` (cria campanha up-front), nova `fabrica-apagar`.
- `coletor/gerar-criativos.mjs` (aceita campanhaId), `fabrica-job-runner.mjs` (marca status).
- Tabelas: `fabrica_campanhas` (migrations 015/017/021), `fabrica_criativos`, `fabrica_jobs`, `fabrica_meta_jobs` (link Gerenciador). Rotas: `src/mapa-de-enderecos.js`.
