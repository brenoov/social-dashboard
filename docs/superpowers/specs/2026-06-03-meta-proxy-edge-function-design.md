# meta-proxy — tirar o token Meta do navegador (Edge Function)

Data: 2026-06-03

## Contexto / Problema

As telas **Meta Ads** e **Google** chamam a Graph API (`graph.facebook.com/v22.0`) **direto do navegador** via `metaFetch`/`metaFetchAll`, passando `_maCurAcc.access_token` / `_gtCurAcc.access_token`. O token Meta é carregado no front por `accounts.access_token` (RLS deixa qualquer autenticado ler). Isso é a exposição do F5: qualquer usuário logado (ou cópia local do app) consegue o token. O **Bling já é proxiado** por uma Edge Function (`bling-proxy`) — é o **molde** a seguir. O coletor (Python, launchd) é server-side e usa `service_role` — fora de escopo.

## Objetivo

Mover **toda** chamada à Graph API para uma Edge Function `meta-proxy` (token só no servidor) e **revogar a leitura de `accounts.access_token` pelo navegador**. Resultado: o token Meta nunca chega ao cliente.

## Fora de escopo
- Bling (já proxiado), coletor, e os outros itens de segurança (repo privado, rotação de segredos, MFA, WAF) — tratados à parte.

## Seção 1 — Edge Function `meta-proxy`

Espelha o `bling-proxy` (mesmo padrão de auth e resposta). Arquivo: `supabase/functions/meta-proxy/index.ts` (ou o layout que o projeto já usa para `bling-proxy`).

- **Entrada:** `POST` com header `Authorization: Bearer <JWT da sessão do usuário>` + `apikey: <anon>`; body JSON `{ accountId, path, params, tool }`.
  - `accountId` = `accounts.id` (uuid) da conta.
  - `path` = caminho da Graph (ex.: `/act_123/insights`, `/17841.../insights`).
  - `params` = objeto de querystring (campos, time_range, level, etc.).
  - `tool` = `"tool:meta"` ou `"tool:google"` (qual ferramenta originou a chamada).
- **Autorização (2 camadas):**
  1. Valida o JWT (usuário autenticado). Se inválido → 401.
  2. Verifica permissão: o usuário é **admin** OU tem `user_permissions` com `resource_key = tool` e `granted = true`. Senão → 403. (Mesma semântica do `hasPermission` do front; o implementador deve conferir essa função.)
- **Token no servidor:** com `service_role`, `select access_token from accounts where id = accountId`. Se vazio → 400 ("conta sem token").
- **Chamada:** monta `META_GRAPH + path` com `params` + `access_token` (server-side) e faz o `fetch`. Devolve o JSON da Graph como está (inclusive `{error}` da Meta, pro cliente exibir como hoje). Timeout ~10s, igual ao `metaFetch` atual.
- **Sem paginação no servidor:** uma chamada Graph por request; a paginação continua no cliente (`metaFetchAll` faz o loop chamando o proxy por página).

## Seção 2 — Refatoração do cliente

- `metaFetch(path, params, token)` → `metaFetch(path, params, accountId, tool)`: em vez de montar URL da Graph com token, faz `POST` para `SUPABASE_URL + '/functions/v1/meta-proxy'` com `Authorization: Bearer <session.access_token>`, `apikey`, body `{ accountId, path, params, tool }`; retorna `r.json()`. Mantém o tratamento de `d.error` e o timeout. (Padrão idêntico ao `blingCall`.)
- `metaFetchAll(path, params, accountId, tool)`: inalterado na lógica de paginação; só repassa `accountId`/`tool` ao `metaFetch`.
- **Chamadores passam `accountId` (ex.: `_maCurAcc.id`) e o `tool` correspondente**, não o token:
  - Tela Meta Ads: `_fetchInsights`, `_fetchCampaigns`, `_fetchDaily`, `_fetchAdInsights`, `_fetchAccountReach` → `tool:meta`.
  - Tela Google: chamadas equivalentes → `tool:google`.
  - Preview de saldo/gasto na **lista de contas** (antes de selecionar): passa o `id` de cada conta + o `tool` da tela.
- **Selects de contas deixam de pedir `access_token`** (linhas ~6467 e ~7086): remover `access_token` do `select`; manter `id`, `ad_account_id`, etc. O objeto `_maCurAcc`/`_gtCurAcc` não terá mais `.access_token`.

## Seção 3 — Travar o token no banco (RLS) + verificação automática

- Após o cliente parar de ler o token, **revogar leitura da coluna**: `REVOKE SELECT (access_token) ON public.accounts FROM anon, authenticated;` (nível coluna). `service_role` (coletor + `meta-proxy`) continua lendo — inalterado.
- **Verificação é por código (minha), não no navegador:**
  1. `grep` no HTML confirmando **zero** leituras de `access_token` no cliente (nenhum `select=...access_token`, nenhum uso de `.access_token`). Se limpo, a revogação não pode quebrar o cliente.
  2. **Teste server-side** invocando a função `meta-proxy` e confirmando retorno de dado da Meta.
- **A revogação da coluna só ocorre depois das duas checagens passarem.**

## Ordem de implantação (toda executada por mim)
1. Deploy da função `meta-proxy`.
2. Trocar o cliente (Seção 2) + `cp index.html` + push.
3. `grep` (zero leituras de token no cliente) + teste da função.
4. Revogar `SELECT (access_token)` de `anon`/`authenticated` (migration).

## Notas de implementação
- Reusar exatamente o padrão de auth/resposta do `bling-proxy` (ler o código dele primeiro).
- Verificar a semântica de `hasPermission` no front pra replicar fielmente (admin implícito?).
- A revogação por coluna no Postgres faz o PostgREST recusar qualquer `select` que inclua `access_token` por `anon`/`authenticated` — por isso a Seção 2 (remover do select) precisa vir antes.
