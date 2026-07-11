# Fábrica de Anúncios — Storage / Lifecycle dos criativos (+ arquivo Zoho)

**Data:** 2026-07-11
**Status:** aprovado no brainstorm, aguardando revisão do spec
**Relação:** companheiro do spec `2026-07-11-fabrica-f2a3-ui-estudio-design.md` (F2a.3 UI Estúdio). Este spec cobre o **ciclo de vida dos PNGs** gerados pela Fábrica; o F2a.3 cobre a UI de gerar/curar/subir. Implementados juntos.

## Objetivo

Garantir que o bucket Supabase `fabrica-criativos` **nunca estoure** o Storage (evitar upgrade forçado de plano), com uma deleção **centralizada e auditável**. Cada criativo gerado é um PNG ~1–1,5 MB; sem controle, lotes semanais acumulam e enchem o Free (1 GB ≈ ~770 imagens).

**Sacada que dispensa arquivo permanente no Supabase:** depois que um criativo vira anúncio no Meta, o Meta guarda a **cópia própria** da imagem (`image_hash`) e serve dela — o PNG no Supabase é só **trânsito** (palco entre gerar → curar → subir). Logo o Supabase só precisa guardar o que a UI usa **ao vivo**; o resto é descartável.

## Fases

- **Fase 1 (agora, junto do F2a.3):** purga por status da rodada + backstop de 30 dias. **Não depende do Zoho.**
- **Fase 2 (depois):** arquivar o full-res no Zoho WorkDrive **antes** de purgar ("arquiva-depois-apaga"), dando controle das pastas. Depende de OAuth WorkDrive novo — desenhada aqui, mas **não bloqueia** a Fase 1.

## Modelo de dados

Alterações mínimas às tabelas existentes (migrations 014/015):

**`fabrica_campanhas`** (a "rodada"/lote gerado):
- `+ fechada_em timestamptz null` — setado quando o job de **subir** conclui 100% (sem pendência de rate limit).
- `+ purgado_em timestamptz null` — setado pela `fabrica-purga` quando os PNGs da rodada foram apagados.

**`fabrica_criativos`:**
- `+ purgado_em timestamptz null` — a UI usa pra mostrar placeholder no lugar da imagem apagada. `storage_path` e `url` **permanecem** no registro (histórico/rastro), mesmo após o objeto sumir do Storage.
- **(Fase 2)** `+ zoho_file_id text null`, `+ arquivado_em timestamptz null`.

## Purga — Edge Function `fabrica-purga` (Fase 1)

Um **único caminho de deleção** do Storage (service key), disparado por **pg_cron diário** (a infra de pg_cron já existe no coletor). Idempotente.

Regras por rodada (`fabrica_campanhas`):
1. **Fechada** (`fechada_em NOT NULL`, `purgado_em NULL`): apaga do Storage os objetos `storage_path` de **todos** os criativos da rodada — rejeitados **e** escolhidos (o Meta já tem o `image_hash` dos escolhidos que viraram ad). Marca `purgado_em` nos criativos e na rodada.
2. **Abandonada** (`fechada_em NULL`, `created_at < now() - interval '30 days'`, `purgado_em NULL`): mesma deleção; marca `purgado_em`.
3. **Idempotência**: pula rodada/criativo com `purgado_em` já setado. Deleção em lote via Storage API (`DELETE /storage/v1/object/{bucket}` com `{ prefixes: [...] }`).

Segurança: a Edge roda com service key (nunca exposta ao front); só é invocada pelo pg_cron. RLS não se aplica à deleção de Storage (é via service role).

## Quem fecha a rodada

O job **subir** (dentro do `fabrica-job-runner.mjs` do F2a.3) seta `fabrica_campanhas.fechada_em = now()` **somente quando sobe 100% sem pendência**. Se estourar o rate limit da Meta (code 17) e ficar parcial, **não** fecha a rodada → o operador re-roda (a subida é idempotente: pula ads já criados), completa, e só então `fechada_em` é setado. Assim a purga nunca apaga PNG de escolhido que ainda não subiu ao Meta.

## Impacto na UI (painel-curar / painel-subir do F2a.3)

- **Curar só rodadas abertas** (`fechada_em IS NULL` e `purgado_em IS NULL`) — essas sempre têm as imagens no Storage.
- **Rodada fechada/purgada**: exibição read-only; cada criativo mostra um **placeholder** ("subido — ver no Gerenciador") com link pro anúncio no Meta (via `ad_id` de `fabrica_meta_jobs`), em vez de imagem quebrada. A UI decide pelo `purgado_em`.

## Fase 2 — arquivo no Zoho WorkDrive (desenhada, adiada)

Antes de a `fabrica-purga` apagar uma rodada **fechada**, um passo de arquivamento envia o full-res pro WorkDrive na estrutura `Vessel Brasil › Mídia › Criativos › Varejo / <data> / <loja> /`. A purga só apaga do Supabase **após confirmar** o `zoho_file_id` gravado (arquiva-depois-apaga). Rodada abandonada (nunca subida) **não** é arquivada — só apagada.

Reuso e dependências:
- **Reusa** a infra de token de `acessos_conexoes` (client_id/secret, refresh_token, data center, zoid) e o padrão do `acessos-oauth`/`acessos-proxy`.
- **Exige novo**: adicionar escopo `WorkDrive.files.CREATE` (+ leitura de team folder) ao app Zoho, **re-consentir**, e escrever o código de upload (não existe hoje — o escopo atual é só `ZohoMail.organization.accounts.READ`).
- Sem isso pronto, a Fase 1 roda normalmente (purga direto, sem arquivar).

## Testes

- **`fabrica-purga`:** rodada fechada → purga + marca; rodada abandonada > 30d → purga; rodada aberta < 30d → intacta; idempotência (já `purgado_em` → pula); mock do batch-delete da Storage API; boundary exato dos 30 dias.
- **Job subir (fechar rodada):** seta `fechada_em` só em sucesso total; parcial (rate limit) → **não** seta.
- **UI:** smoke manual — rodada aberta mostra imagens; rodada purgada mostra placeholder + link Meta.
- **(Fase 2)** arquiva-antes-de-apagar: purga de rodada fechada só ocorre com `zoho_file_id` presente; falha no upload Zoho → não apaga.

## Fora de escopo (por ora)

- Miniaturas (thumbnails) leves separadas do full-res — não necessárias, já que só curamos rodadas abertas (que têm o full-res).
- Escada de desconto por quadrante BCG (item de backlog à parte).
- Compressão/otimização dos PNGs na geração (possível ganho futuro, não neste spec).

## Referências

- Bucket: `fabrica-criativos` (público). Tabelas: `db/migrations/014_fabrica_anuncios.sql`, `015_fabrica_criativos.sql`, `016_fabrica_meta_jobs.sql`.
- Motor de subida idempotente + multi-destino: `coletor/subir-campanha-genspark.mjs` (precedente do "fechar só em sucesso total").
- OAuth/token Zoho reusável: `supabase/functions/acessos-oauth/index.ts`, `supabase/functions/acessos-proxy/index.ts`, tabela `acessos_conexoes`.
- pg_cron: precedente no coletor (`coletar-dados`).
- Spec irmão: `docs/superpowers/specs/2026-07-11-fabrica-f2a3-ui-estudio-design.md`.
