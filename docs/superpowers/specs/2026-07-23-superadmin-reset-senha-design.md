# Superadmin troca a senha de qualquer usuário

**Data:** 2026-07-23
**Área:** Painel Admin → Usuários (`src/ferramentas/admin/tela-de-admin.vue`) + Edge `invite-user`
**Tipo:** feature (segurança/admin)

## Objetivo

O **superadmin** poder **trocar a senha de qualquer usuário** que esqueceu a dele, direto no painel.

## Decisões (brainstorm)

- **Onde:** ação **"Trocar senha"** por linha de usuário na lista Admin → Usuários, **visível só pra
  superadmin** (`estado.is_superadmin`).
- **Nova senha (escolha do dono):** **digitar OU gerar** — campo de senha + botão "Gerar" (senha
  aleatória forte). Superadmin pode digitar a sua ou gerar uma; a senha fica visível pra ele copiar/
  entregar ao usuário.
- **Segurança:** a troca acontece numa **Edge Function** (`invite-user`, que já tem o admin client
  service_role). O front NUNCA recebe a service key. A Edge:
  1. já exige `profiles.role === 'admin'` (gate existente);
  2. pra o reset, exige adicionalmente **`profiles.is_superadmin` do chamador** (senão 400);
  3. valida senha mínima (≥ 6);
  4. chama `adminClient.auth.admin.updateUserById(resetPasswordUserId, { password })`.
- **Registro (audit):** não há tabela `audit_log` confirmada → **follow-up opcional** (não bloqueia).

## Implementação

### Edge `supabase/functions/invite-user/index.ts`
- Incluir `is_superadmin` no select do perfil do chamador (`.select('role, is_superadmin')`).
- Destructurar `resetPasswordUserId` do body.
- **Nova branch** (antes das de delete/create): se `resetPasswordUserId`:
  - `if (!profile?.is_superadmin) throw 'Apenas superadmin pode trocar a senha de usuários'`
  - `if (!password || password.length < 6) throw 'Senha deve ter no mínimo 6 caracteres'`
  - `await adminClient.auth.admin.updateUserById(resetPasswordUserId, { password })`
  - retorna `{ success: true }`.
- Deploy via MCP Supabase (get_edge_function antes; verify_jwt como está).

### Front `tela-de-admin.vue` (loadAdminUsers)
- Helper puro `gerarSenhaForte(len=14)` (a-zA-Z0-9 + símbolos seguros) — extraível/testável.
- Em cada linha de usuário, **se `estado.is_superadmin`**, um botão "Trocar senha" que abre um mini-form
  inline (ou modal) com: input de senha + botão "Gerar" (preenche `gerarSenhaForte`) + "Salvar"/"Cancelar".
- "Salvar" → `sbClient.functions.invoke('invite-user', { body: { resetPasswordUserId: u.id, password } })`
  → toast/alert de sucesso ("Senha de <email> alterada") ou erro (surfaça a mensagem da Edge).
- Não permitir no próprio superadmin? (pode trocar a própria também — sem problema). Evitar quebrar
  a UI existente (render imperativo — usar classes com prefixo, sem colidir com globais).

## Fora de escopo
- Fluxo de "esqueci minha senha" self-service (isto é o superadmin trocando pelo outro).
- audit_log (follow-up).

## Testes
- Pure: `gerarSenhaForte` (comprimento, variedade de classes de char) — `node:test`.
- Edge: revisão manual da guarda (só superadmin) + smoke via painel (superadmin troca senha de conta
  descartável e loga com a nova) — [[feedback_nao_mexer_dados_reais]]: usar conta de teste, não real.
