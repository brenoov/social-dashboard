# Fundação compartilhada da migração Vue (permissões + avisos) — Design

**Data:** 2026-07-03
**Branch:** `vue-migracao`
**Status:** Design aprovado pelo Breno — aguardando revisão da spec
**Contexto:** [[project_iamundi_vue_migracao]]. As telas já migradas (login, início, Notícias) não precisavam de permissões/avisos. O 1º tool real (Acessos) revelou que quase toda ferramenta depende de peças compartilhadas ainda não portadas. Esta spec porta essas peças para `src/compartilhado/`, destravando os ports das telas seguintes.

---

## 1. Escopo (o que é a "fundação")

Mapeamento do monólito (`legacy/index.html`) revelou 3 peças candidatas — mas só 2 têm o que fazer:

- **Modais (confirmar/alertar/prompt):** o app **NÃO tem modais customizados** — usa os **nativos do navegador** (`confirm()`/`alert()`/`prompt()`), que funcionam idênticos no Vue. **Nada a portar.** As telas seguem usando os nativos, como o monólito.
- **Avisos (toast):** um único helper — `adminToast(msg, ok)` (a notificaçãozinha verde/vermelha no canto). Portar como peça compartilhada.
- **Permissões:** `role` (admin/viewer) + `features` (lista de módulos liberados) carregadas da tabela `profiles` no login; `hasPermission(chave)` que as telas usam pra gatear. Portar para o módulo de login/estado que já existe.

**Fora de escopo:** portar telas; gatear os cards da Início ou gatear cada ferramenta (isso acontece no port de CADA tela, que passará a importar `hasPermission`); o painel de admin que EDITA permissões (é a ferramenta `admin`, portada depois).

## 2. Avisos — `src/compartilhado/avisos.js` (novo)

`export function adminToast(msg, ok = true)` — porte fiel do monólito (L4377): cria (uma vez) um `<div id="admin-toast">` fixo no canto inferior direito, mostra `msg`, fundo verde (`#166534`) se `ok`, vermelho (`#991b1b`) se não, some após 2800ms. **Trocar a dependência `mkEl` por `document.createElement`** (comportamento idêntico, sem arrastar o helper `mkEl`). É DOM imperativo — correto e suficiente para um toast transitório; nenhuma tela Vue precisa ser criada.

Uso: `import { adminToast } from '../../compartilhado/avisos.js'` → `adminToast('Salvo', true)`.

## 3. Permissões — em `src/compartilhado/controle-de-login-e-usuario.js` (estender)

Hoje o módulo tem só `estado` (`currentSession`, `user`, `permissoes`) + `setSession`. Estender:

- **Estado:** adicionar ao `reactive estado` os campos `role` (padrão `'viewer'`), `features` (padrão `[]`), `userId` (padrão `null`). (Reativos → componentes reagem a mudanças.)
- **`export async function carregarPerfil(session)`** — busca o perfil da tabela **`profiles`** (`select=role,features,avatar_url` por `id=eq.<user.id>`, com o token da sessão), e preenche `estado.role` (padrão `'viewer'`), `estado.features` (padrão `['banco']`), `estado.userId`. Porte fiel do trecho de `loadDashboard` (L5586-5595 do monólito). Em erro/sem perfil, usa os padrões (não trava o app).
- **`export function hasPermission(resourceKey)`** — porte **verbatim** de `hasPermission` (L3291-3298): admin → `true`; senão resolve o `keyMap` (`tool:social`→`social`, `module:meta:gestor`→`meta.gestor`, etc.) e retorna `estado.features.includes(fKey)`. (Lê do `estado` reativo em vez das globais soltas.)
- **`export const PERMISSION_TREE`** — porte verbatim da árvore (L4525-4539): 7 módulos (social, sales, meta, banco, noticias, gestor, acessos), com submódulos em sales e meta.

## 4. Ligação com o fluxo de login (data flow)

`carregarPerfil` roda logo após a sessão ficar disponível, em **dois pontos** (espelhando o monólito, que carrega em `loadDashboard` tanto no login manual quanto no `onAuthStateChange`):

- **Login manual:** em `src/ferramentas/login/tela-de-login.vue`, depois do `setSession(session)` bem-sucedido, `await carregarPerfil(session)` antes de navegar para a Início.
- **Reabrir já logado:** em `src/ponto-de-partida.js`, onde a sessão é restaurada (`getSession`), depois do `setSession`, `await carregarPerfil(session)` antes de montar o app.

Assim, quando qualquer tela abre, `estado.role`/`estado.features` já estão preenchidos e `hasPermission()` funciona.

## 5. Como as telas vão usar (contrato pras próximas migrações)

Cada tela gateada, ao ser portada, faz no `onMounted` (ou na guarda) o que o monólito fazia no `open*`:
```js
import { hasPermission, estado } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
// ...
if (!hasPermission('tool:acessos')) { adminToast('Sem acesso', false); router.push({ name: 'inicio' }); return }
```
E a Início mostra/esconde cards com `v-if="hasPermission('tool:xxx')"`. (Feito no port de cada tela, não aqui.)

## 6. Critérios de sucesso

1. `adminToast` disponível em `src/compartilhado/avisos.js`, aparece igual ao do monólito (verde/vermelho, canto, some sozinho).
2. Após login (e ao reabrir logado), `estado.role`/`estado.features`/`estado.userId` vêm preenchidos da `profiles`.
3. `hasPermission('tool:acessos')` etc. retorna o mesmo que o monólito (admin sempre true; viewer conforme `features`).
4. `PERMISSION_TREE` exportado.
5. `npm run build` passa; nada visual muda nas telas já migradas; produção (main) intocada.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| `carregarPerfil` falhar e travar o login | Try/catch com padrões (`viewer`/`['banco']`); nunca lançar. |
| Divergir do monólito (chaves do keyMap) | `hasPermission` e `PERMISSION_TREE` portados VERBATIM. |
| Testar com conta real | Usar conta de teste descartável; só leitura da `profiles`. |
| Token/RLS na `profiles` | Usar o `access_token` da sessão (mesmo header do monólito). |
