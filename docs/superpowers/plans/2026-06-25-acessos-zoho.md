# Controle de Acesso e Colaboradores — Fase Zoho (conectar + importar usuários + avatares)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Conectar o Zoho (OAuth, refresh token no edge), listar os usuários da organização e **importá-los como colaboradores** (nome + e-mail corporativo + zoho_account_id + **avatar puxado do Zoho**). Renomear a ferramenta para **"Controle de Acesso e Colaboradores"**.

**Arquitetura:** Edge Functions novas — `acessos-oauth` (callback do OAuth, `verify_jwt:false`) e `acessos-proxy` (chamadas autenticadas de admin ao Zoho, `verify_jwt:true`). Segredos (client_id/secret/refresh_token) numa tabela **service-role-only** `acessos_conexoes` — nunca no front, nunca no git. Avatares em bucket público `acessos-avatars`. Front: botão Conectar/Importar + avatar nos colaboradores.

**Stack:** Deno (edge), Supabase, Zoho Mail **Admin API** (OAuth org). DC default `.com` (configurável em `acessos_conexoes.data_center`).

## Decisões
- Segredos da app + refresh token ficam em `acessos_conexoes` (RLS sem policy → só service_role lê; edge usa service role). Inserção do secret é feita via MCP execute_sql (fora do git).
- "start" do OAuth: o front pede ao proxy a **authorize URL** (`zoho.authUrl`) e redireciona. Só o **callback** é edge público que troca o code por tokens.
- Importados entram **sem setor/sem organização** (aparecem no card "Sem setor") — o dono organiza depois.
- Avatar: bucket público `acessos-avatars`; durante o import o edge baixa a foto do Zoho (com token) e sobe; guarda a URL pública em `acessos_pessoas.avatar_url`.
- Permissão key continua `acessos` (só muda o RÓTULO para "Controle de Acesso e Colaboradores").

## Modelo de dados (migration 006)
- **`acessos_conexoes`** (service-role-only): `provedor text pk · client_id text · client_secret text · refresh_token text · org_id text (zoid) · data_center text default '.com' · escopos text · conectado_por uuid · conectado_em timestamptz · atualizado_em timestamptz`. RLS habilitado, **sem policies**.
- **`acessos_pessoas`** add: `avatar_url text · zoho_account_id text`.
- Bucket **`acessos-avatars`** público (read público; write via service role no import).

## Tasks
### ZT1 — Migration 006 + guardar credenciais Zoho
- Migration `006_zoho.sql`: cria `acessos_conexoes` (RLS on, no policy), add `avatar_url`/`zoho_account_id` em `acessos_pessoas`, cria bucket público `acessos-avatars`. (SEM segredo no arquivo.)
- Depois de aplicar: o CONTROLLER insere as credenciais Zoho via execute_sql (fora do git): `insert acessos_conexoes(provedor,client_id,client_secret,data_center,escopos) values('zoho',…,'.com','ZohoMail.organization.accounts.ALL,ZohoMail.organization.accounts.READ')`.
- Verificar: tabela existe, RLS on sem policy; colunas novas; bucket público.

### ZT2 — Renomear ferramenta + exibir avatar
- Front: trocar rótulo "Controle de Acessos" → **"Controle de Acesso e Colaboradores"** (home card `home-card-acessos`, `.ac-title`). Permissão key intacta.
- Avatar: nos cards de colaborador (`_acRenderColaboradores`) e na ficha (`_acRenderFicha`), mostrar `c.avatar_url` (img redonda) com fallback (inicial do nome num círculo). CSS `.ac-avatar`.

### ZT3 — Edge Function `acessos-oauth` (callback) + deploy
- Rota `GET …/acessos-oauth/callback/zoho?code=…`: troca code → tokens no endpoint Zoho do DC (`https://accounts.zoho<dc>/oauth/v2/token`), grava `refresh_token` + `conectado_em` + descobre o **zoid** (`https://mail.zoho<dc>/api/organization`) → grava `org_id`. Redireciona de volta ao dashboard com `?zoho=ok`. `verify_jwt:false`. Lê client_id/secret de `acessos_conexoes` (service role). Confirmar endpoints/escopos contra a doc Zoho ao vivo (context7/web) no build.

### ZT4 — Edge Function `acessos-proxy` + deploy
- `verify_jwt:true`; valida que o caller é admin/`acessos` (checa profiles via service role com o JWT). Ações:
  - `zoho.authUrl` → monta a URL de consentimento (client_id+redirect+scope+access_type=offline+prompt=consent) e retorna.
  - `zoho.users` → access token via refresh; `GET …/api/organization/{zoid}/accounts`; retorna lista (nome, e-mail, accountId, foto?).
  - `zoho.import` → para cada usuário: upsert em `acessos_pessoas` por `zoho_account_id` (nome, email_corporativo, status ativo); baixa a foto do Zoho e sobe em `acessos-avatars/{pessoa_id}.jpg`; grava `avatar_url`. Loga em `acessos_log`. Idempotente (re-import atualiza, não duplica).
- Token refresh helper (cacheia access token até expirar).

### ZT5 — Front: Conectar Zoho + Importar
- No topo do módulo (ou aba/area de integrações): status da conexão Zoho + botão **"Conectar Zoho"** (→ proxy `zoho.authUrl` → redirect) e, quando conectado, **"Importar usuários do Zoho"** (→ proxy `zoho.import` → reload). Tratar retorno `?zoho=ok` (toast + limpar query).

### ZT6 — Verificação + deploy + conectar + importar
- Deploy front (com OK). Usuário clica Conectar Zoho (consentimento) → callback grava token. Depois "Importar" → colaboradores criados com e-mail + avatar. Conferir lista + fotos + `acessos_log`. Ajustar DC se o OAuth falhar (.com→.com.br).

## Verificação/segurança
- Segredos só em `acessos_conexoes` (service-role); nunca no front nem no git. Proxy gateado por admin. Avatares públicos (headshots; baixa sensibilidade) — documentado. Sync byte-a-byte index.html↔v1.3 nas tasks de front. Deploy edge via MCP `deploy_edge_function`.
