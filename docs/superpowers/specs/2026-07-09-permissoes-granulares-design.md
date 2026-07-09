# Sistema de Permissões Micro-gerenciadas (estilo Bling) — Design

**Data:** 2026-07-09
**Contexto:** iamundi. Hoje o gate é `profiles.role` (admin/viewer) + `features[]` (text[]) + `hasPermission(key)`; admin vê tudo. 13 usuários (7 admin, 6 viewer). Ver [[project_iamundi_permissoes]].

## Objetivo
Controle fino de acesso, **por usuário** (sem papéis), com **ações** (Ver/Criar/Editar/Excluir/Exportar) por recurso, **escopo por perfil de rede social**, e fim do "admin total".

## Decisões (aprovadas)
- **Por usuário** (sem papéis/grupos); botão "duplicar permissões de outro usuário" pra reduzir repetição.
- **Ações finas** por recurso (só as que fazem sentido em cada um).
- **Escopo por perfil de rede social** (quais dos 7 perfis IG o usuário vê).
- **Super-admin** (só o Breno) substitui o "admin total"; demais viram permissões explícitas.
- **Fase 1 = front** (tela + navegação respeitam). **Fase 2 = backend** (Edge Functions + RLS) depois.
- **Migração:** os 6 admins atuais começam com TUDO; o Breno vai cortando.

---

## Fase 1 — Front (este spec)

### Modelo de dados (profiles)
- **`permissions`** JSONB — `{ "<recurso>": ["ver","editar",...] }`. Default `{}`.
- **`allowed_accounts`** uuid[] — ids de `accounts` que o usuário vê no dashboard/relatório de redes. `null` = todos.
- **`is_superadmin`** boolean — default false. `true` = vê tudo + único que acessa a Administração/editor de permissões.
- Mantém `role` só p/ exibição (não gateia mais). `features[]` fica como legado até a migração concluir; depois pode ser removido.

### Catálogo de recursos × ações (`RECURSOS` no front — fonte de verdade)
Cada recurso declara suas ações válidas e os pontos de gate.
| chave (recurso) | rótulo | ações |
|---|---|---|
| `social` | Redes Sociais (Dashboard) | ver, exportar |
| `social.relatorio` | Redes — Relatório | ver, exportar |
| `sales.gestao` | Gestão à Vista | ver, exportar |
| `sales.analise` | Análise de Vendas | ver, exportar |
| `sales.metas` | Metas de Vendas | ver, editar |
| `meta.campanha` | Análise de Campanhas | ver, exportar |
| `meta.gestor` | Gestão de Tráfego | ver, editar |
| `banco` | Banco de Arquivos | ver, criar, excluir |
| `acessos` | Colaboradores e Acessos | ver, criar, editar, excluir |
| `noticias` | Portal de Notícias | ver |
| `gestor` | Gestão Comercial (IA) | ver |

Administração (usuários/permissões) NÃO é um recurso da matriz: é gateada por `is_superadmin`.

### API de permissão (controle-de-login-e-usuario.js)
- `hasPermission(recurso, acao = 'ver')` → `estado.is_superadmin ? true : (estado.permissions[recurso] || []).includes(acao)`.
- `contasPermitidas()` → `estado.allowed_accounts` (`null` = todas) — usado pra filtrar o seletor de perfis.
- `estado` ganha `permissions`, `allowed_accounts`, `is_superadmin` (carregados em `carregarPerfil`).
- Retrocompat: enquanto `permissions` estiver vazio e existir `features`, derivar ações "ver" das features (ponte na migração).

### Gates atualizados (as 3 camadas continuam)
1. **Home cards** (`tela-de-inicio.vue`): card visível se `hasPermission(recurso,'ver')`.
2. **Submenus** (`_applySubFeatures`, `tela-de-menu-*`): card do submódulo por `hasPermission(sub,'ver')`.
3. **Guarda na entrada** de cada tela (`onMounted`): `if(!hasPermission(recurso,'ver')) router.push('inicio')`. Ações (editar/exportar/excluir) gatearam os BOTÕES correspondentes dentro da tela (ex.: botão "Editar métricas" só com `hasPermission('meta.gestor','editar')`).

### Escopo por perfil de rede social
- Redes (dashboard + relatório): o seletor de perfis filtra `accounts` por `allowed_accounts` (`null` = todos). Se sobrar 1 só, já entra nele.

### Tela de Admin (editor por usuário)
- Lista de usuários → ao abrir um, um painel com:
  - Toggle **Super-admin** (vê tudo; some a matriz).
  - **Matriz recurso × ação** (checkboxes; só as ações válidas de cada recurso). Marcar "ver" é pré-req das outras (UI ajuda).
  - **Perfis de rede permitidos** (multiseleção dos 7 + opção "Todos").
  - Botão **Duplicar permissões de…** (copia `permissions` + `allowed_accounts` de outro usuário).
  - Salvar → grava `permissions`/`allowed_accounts`/`is_superadmin` no `profiles`.
- A própria tela de Admin só abre com `is_superadmin`.

### Migração (SQL aditivo, ninguém perde acesso)
1. Adiciona colunas `permissions jsonb default '{}'`, `allowed_accounts uuid[]`, `is_superadmin bool default false`.
2. **Breno** → `is_superadmin=true`.
3. **Demais admins (6)** → `permissions` = TODOS os recursos com TODAS as ações válidas; `allowed_accounts=null`.
4. **Viewers** → cada `feature` vira `{recurso:["ver"]}` (+ "exportar" onde o recurso tiver, se quisermos manter o comportamento atual de export livre); `allowed_accounts=null`.
5. `features[]` fica intocado como fallback até validar; remoção só depois.

### Fora de escopo (Fase 1)
Papéis/grupos; enforcement no backend; auditoria de mudanças de permissão; escopo por marca de vendas.

---

## Fase 2 — Backend (follow-up, não neste ciclo)
- Edge Functions (`insights-ao-vivo` etc.) passam a checar `permissions`/`allowed_accounts` do usuário (hoje checam `role==='admin' || features.includes('social')`).
- RLS nas tabelas sensíveis por `allowed_accounts`.
- Enforce de que um usuário não consulta um `account_id` fora do seu escopo.
- Auditoria (audit_log) de alterações de permissão.
