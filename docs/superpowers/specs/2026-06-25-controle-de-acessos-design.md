# Controle de Acessos (Zoho · OneDrive · iCloud) — Design

## Contexto e objetivo
A RBV usa três serviços externos cujos acessos hoje são gerenciados na mão, cada um no seu painel:
**e-mail Zoho Mail**, **pastas no OneDrive (conta pessoal)** e **uma pasta no iCloud**. Falta um lugar
único para (1) **dar e tirar acesso** de uma pessoa (onboarding/offboarding), (2) **auditar** quem tem
acesso a quê e (3) **controlar o compartilhamento das pastas**. Este documento desenha uma nova
ferramenta — o módulo **Acessos** — dentro do dashboard iamundi (single-file HTML + Supabase + Edge
Functions), seguindo os padrões já existentes (proxy de API em Edge Function com segredos no Supabase,
módulo gated por permissão, confirmação antes de ações que escrevem).

Decisão do dono: **abordagem A (tudo automatizado de cara)** — o primeiro release já lê e escreve nos
provedores, com confirmação antes de cada escrita.

## Viabilidade por provedor (a base do design)
Cada provedor tem uma realidade de API diferente — isso molda tudo:

| Provedor | O que dá pra fazer | Como |
|---|---|---|
| **Zoho Mail** (org com domínio, dono é admin) | Gestão real de caixas: listar, **criar**, **suspender/reativar**, **resetar senha** | Zoho Mail **Admin API** (OAuth de organização, `zoid`) |
| **OneDrive** (conta **pessoal**/consumidor) | Sem "usuários" (é uma conta só). Controla o **compartilhamento de pasta**: listar com quem está compartilhada, **adicionar** pessoa (convite por e-mail, leitura/edição), **remover** | **Microsoft Graph** (endpoint consumidor `/me/drive`), token **delegado** (OAuth da conta dona) |
| **iCloud** (uma pasta) | **Nada por API** — a Apple não expõe gestão de pasta/usuário do iCloud Drive | **Manual assistido**: a ferramenta registra o acesso pretendido e mostra um "a fazer"; o add/remove é feito por você na interface da Apple |

As pastas do OneDrive **não são cadastradas à mão**: a ferramenta **lista as pastas reais que já existem**
na conta (navegando a árvore via Graph) e você marca quais quer controlar.

## Escopo
**No escopo (release A):**
- Cadastro próprio de pessoas (colaboradores) como fonte da verdade.
- Conectar Zoho e OneDrive via OAuth (uma vez cada).
- Zoho: listar/criar/suspender/reativar/resetar senha de caixas.
- OneDrive: listar pastas reais, escolher quais controlar, ver/editar o compartilhamento de cada uma.
- iCloud: checklist manual de "a fazer" por pessoa/pasta.
- Fluxos de onboarding/offboarding e painel de auditoria, com confirmação antes de escrever e log de tudo.

**Fora do escopo:**
- Automação de iCloud (impossível por API).
- OneDrive Business/SharePoint, gestão de usuários do Microsoft 365 (a conta é pessoal — não existem usuários).
- SSO/diretório corporativo, MFA dos provedores, billing.

## Arquitetura
- **Front:** novo módulo `#acessos-screen` no `index.html` (= `projetos/central-inteligencia/central-inteligencia-v1.3.html`), gated por uma permissão nova **`acessos`** (só superadmin; segue o padrão `PERMISSION_TREE` + `features[]`).
- **Backend de proxy:** nova Edge Function **`acessos-proxy`** (padrão do `meta-proxy`): o front chama o proxy; o proxy valida que o usuário é admin/tem `acessos`, lê o token do provedor da tabela `acessos_conexoes` (service-role), renova o access token quando preciso e fala com a Zoho/Graph. **Nenhum token vai para o front.**
- **Backend de OAuth:** nova Edge Function **`acessos-oauth`** com 2 rotas (`/start/<provedor>` e `/callback/<provedor>`) que conduzem o fluxo OAuth e gravam o **refresh token** em `acessos_conexoes`.
- **Dados:** tabelas novas no Supabase (abaixo), com RLS restrita (front lê via PostgREST só o que não é segredo; tokens só service-role).
- **iCloud:** sem backend de API — é estado em tabela + UI de checklist.

## Modelo de dados (Supabase)
- **`acessos_pessoas`** — o cadastro de colaboradores
  `id uuid pk · nome text · cargo text · status text ('ativo'|'inativo') · email_pessoal text · apple_id text · criado_em timestamptz · atualizado_em timestamptz`
- **`acessos_recursos`** — pastas sob controle (OneDrive descobertas via Graph; iCloud manuais)
  `id uuid pk · tipo text ('onedrive'|'icloud') · nome text · external_id text (id do item no OneDrive; null/rótulo no iCloud) · papel_padrao text ('leitura'|'edicao') · criado_em timestamptz`
- **`acessos_vinculos`** — quem tem acesso a qual pasta
  `id uuid pk · pessoa_id fk · recurso_id fk · papel text ('leitura'|'edicao') · estado text ('pretendido'|'aplicado'|'erro') · external_perm_id text (id da permissão no OneDrive, p/ remover) · detalhe_erro text · aplicado_em timestamptz`
  (No iCloud o estado fica 'pretendido' até você marcar como feito manualmente → vira 'aplicado'.)
- **`acessos_zoho`** — a caixa Zoho de cada pessoa
  `id uuid pk · pessoa_id fk · zoho_account_id text · email text · status text ('ativa'|'suspensa') · sincronizado_em timestamptz`
- **`acessos_conexoes`** — conexões OAuth (SÓ service-role lê)
  `provedor text pk ('zoho'|'microsoft') · refresh_token text · org_id text (zoid do Zoho) · escopos text · data_center text (Zoho .com/.eu/.com.br) · conectado_por uuid · conectado_em timestamptz`
- **`acessos_log`** — auditoria de toda ação
  `id uuid pk · quando timestamptz · quem uuid · acao text · provedor text · alvo text · resultado text ('ok'|'erro') · detalhe text`

## Conexões OAuth & segurança
- Botões **"Conectar Zoho"** / **"Conectar OneDrive"** no módulo → `acessos-oauth/start/<provedor>` redireciona para o consentimento → o provedor volta em `acessos-oauth/callback/<provedor>` → a função troca o code por tokens e grava o **refresh token** em `acessos_conexoes`. O proxy renova o access token sob demanda.
- **Microsoft Graph** (OneDrive pessoal): authorize `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize`; escopos `Files.ReadWrite offline_access User.Read`; conta dona da(s) pasta(s).
- **Zoho Mail Admin**: authorize `https://accounts.zoho.com/oauth/v2/auth` (atenção ao data center); escopos de organização para contas/usuários (ex.: `ZohoMail.organization.accounts.ALL`); precisa do `zoid`.
- **Segurança:** tokens nunca no front; módulo só superadmin (gate `acessos` + guarda no `acessos-proxy` checando `role=admin`/feature); toda escrita passa por **confirmação** e vai pro `acessos_log`. Os `client_secret` dos apps ficam como **env secret** da Edge Function (não em tabela).

## Capacidades por provedor
**Zoho (Edge `acessos-proxy` → Admin API):**
- Listar caixas da organização (espelha em `acessos_zoho`).
- Criar caixa (nome, e-mail, senha inicial).
- Suspender / reativar caixa.
- Resetar senha.

**OneDrive (Edge `acessos-proxy` → Microsoft Graph `/me/drive`):**
- Navegar a árvore de pastas reais (`/me/drive/root/children`, `/items/{id}/children`) e marcar quais controlar (cria `acessos_recursos`).
- Listar com quem a pasta está compartilhada (`GET /items/{id}/permissions`).
- Adicionar pessoa (`POST /items/{id}/invite` com e-mail + papel leitura/edição).
- Remover acesso (`DELETE /items/{id}/permissions/{permId}`).

**iCloud (manual assistido — sem API):**
- Registrar o acesso pretendido (pessoa × pasta iCloud, papel).
- A UI mostra um **"a fazer"** ("compartilhar pasta X com fulano@apple no iCloud") + checkbox "feito" que marca o vínculo como 'aplicado'. Nada é automático; deixar explícito na UI.

> Nota: as formas exatas dos endpoints (corpo do `invite`, endpoints de suspender no Zoho, data center) serão confirmadas contra a doc/API ao vivo na implementação — APIs mudam.

## Fluxos (confirmação antes de toda escrita)
- **Onboarding** (pessoa nova): cria a pessoa no cadastro → escolhe o que provisionar (criar caixa Zoho? adicionar em quais pastas OneDrive e com qual papel? marcar pendência iCloud?) → **modal de confirmação** listando exatamente o que vai acontecer → aplica item a item, grava estado/erros e loga.
- **Offboarding** (saiu): botão **"Revogar tudo"** na ficha da pessoa → confirma → suspende a caixa Zoho + remove de todas as pastas OneDrive + marca pendências iCloud + `status='inativo'`. Aplica o que dá, mostra o resultado de cada item, loga.
- **Auditoria:** painel **"quem tem o quê"** (pessoa × recursos + status da caixa Zoho) e o inverso **"pasta × quem acessa"**; destaca **divergências** (ex.: pessoa inativa ainda com acesso a pasta; caixa Zoho ativa sem pessoa no cadastro; vínculo OneDrive 'pretendido' nunca aplicado). Botão de **sincronizar** que relê Zoho + OneDrive e atualiza o espelho.

## Erros, bordas e pré-requisitos
- **Confirmação + erro real:** toda ação de escrita confirma antes e, no erro, mostra a **mensagem real do provedor** (padrão do Meta Ads), tratando casos comuns (token sem escopo, e-mail já existe no Zoho, pessoa já compartilhada no OneDrive).
- **Token expirado/desconectado:** o proxy detecta refresh inválido e a UI mostra "reconectar <provedor>".
- **Aplicação parcial:** onboarding/offboarding aplica item a item; cada vínculo guarda 'aplicado'|'erro' + detalhe, e o offboarding não trava se um item falhar.
- **iCloud:** nunca automático; o vínculo só vira 'aplicado' quando você marca manualmente.
- **Pré-requisito do dono (uma vez, antes de tudo):** registrar 2 "apps" para liberar a API e me passar `client_id`/`client_secret` de cada (eu guardo como secret da Edge Function):
  1. **Microsoft Entra (Azure)** — app que suporta **contas pessoais Microsoft**, com a redirect URI da `acessos-oauth/callback/microsoft` e os escopos acima.
  2. **Zoho API Console** — client "Server-based", redirect URI da `acessos-oauth/callback/zoho`, escopos de organização; anotar o **data center** e o **zoid**.
  Sem isso, o OAuth não roda. Passo a passo será fornecido.

## Ordem de construção (mesmo no release "tudo de cara")
1. Tabelas + permissão `acessos` + casca do módulo (cadastro de pessoas CRUD, sem provedores).
2. `acessos-oauth` + `acessos-conexoes` + botões Conectar (Zoho, OneDrive) e o `acessos-proxy` base.
3. **Leitura** primeiro (de-risca): listar caixas Zoho + navegar/listar compartilhamento OneDrive → espelho + auditoria.
4. **Escrita** Zoho (criar/suspender/reativar/resetar) com confirmação + log.
5. **Escrita** OneDrive (invite/remover) com confirmação + log.
6. iCloud manual (checklist) + fluxos onboarding/offboarding amarrando tudo.

## Critérios de sucesso / verificação
- Conectar Zoho e OneDrive sem o front ver token; reconectar quando expira.
- Listar caixas Zoho e o compartilhamento de uma pasta OneDrive real (leitura) batendo com os painéis nativos.
- Criar e suspender uma caixa Zoho de teste; compartilhar e remover uma pessoa numa pasta OneDrive de teste — ambos com confirmação e refletindo no provedor.
- Onboarding/offboarding de uma pessoa-teste aplicando across providers (Zoho + OneDrive) + pendência iCloud manual; `acessos_log` registrando tudo.
- Auditoria apontando uma divergência proposital (pessoa inativa com acesso).
- Deploy do front idêntico em `index.html` e `central-inteligencia-v1.3.html`; checagem de sintaxe dos `<script>`; teste manual no deploy. **Nunca** testar criando/suspendendo caixa ou removendo acesso de pessoa real — usar conta/pasta descartável (regra: nunca semear/limpar/alterar dados de contas reais para testar).
