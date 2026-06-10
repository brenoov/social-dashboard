# Controle de Acesso por Usuário — Central de Inteligência

**Data:** 2026-05-25
**Arquivo alvo:** `projetos/central-inteligencia/central-inteligencia-v1.1.html`

---

## Objetivo

Implementar controle granular de acesso por usuário: quais ferramentas (cards da home) e quais módulos dentro de cada ferramenta cada usuário pode ver e acessar. Novos recursos são bloqueados por padrão — admin precisa liberar explicitamente.

---

## Escopo

**Ferramentas controladas:**
- `tool:social` → Análise de Redes Sociais (`openDashboard`)
- `tool:sales` → Vendas (`openSalesDashboard`)

**Módulos controlados (dentro de Vendas):**
- `module:sales:gestao-vista` → Gestão à Vista (`openGestaoVista`)
- `module:sales:analise-vendas` → Análise de Vendas (`openSalesBrandPicker`)

**Fora do escopo:** O card Admin não entra no sistema de permissões — já é controlado pelo `role='admin'` existente.

---

## Modelo de Dados

### Tabela `user_permissions`

```sql
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  granted      boolean NOT NULL DEFAULT false,
  granted_by   uuid REFERENCES public.profiles(id),
  granted_at   timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, resource_key)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Cada usuário lê apenas as próprias permissões
CREATE POLICY "User le proprias permissoes" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin gerencia todas as permissões
CREATE POLICY "Admin gerencia permissoes" ON public.user_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
```

### Semântica de acesso
- **Sem linha** para um `resource_key` → acesso **bloqueado** (padrão para recursos novos)
- **Linha com `granted = true`** → acesso liberado
- **Usuário com `role = 'admin'`** → acesso total a tudo, sem consultar a tabela

---

## TOOL_REGISTRY (hard-coded no JS)

Fonte de verdade de todos os recursos. Ao adicionar nova ferramenta/módulo no código, registrar aqui — o padrão de bloqueio é automático (sem linha no banco = bloqueado).

```js
const TOOL_REGISTRY = [
  {
    key: 'social',
    label: 'Análise de Redes Sociais',
    icon: '📊',
    open: openDashboard,
    modules: []
  },
  {
    key: 'sales',
    label: 'Vendas',
    icon: '💰',
    open: openSalesDashboard,
    modules: [
      { key: 'gestao-vista',   label: 'Gestão à Vista',    open: openGestaoVista },
      { key: 'analise-vendas', label: 'Análise de Vendas', open: openSalesBrandPicker }
    ]
  }
];
```

---

## Lógica de Permissões no Cliente

### Carregamento pós-login

```js
let _userPerms = new Set();
let _isAdmin = false;

async function loadUserPermissions(userId, role) {
  _isAdmin = (role === 'admin');
  if (_isAdmin) return; // admin tem tudo
  const { data } = await sbClient
    .from('user_permissions')
    .select('resource_key, granted')
    .eq('user_id', userId)
    .eq('granted', true);
  _userPerms = new Set((data || []).map(r => r.resource_key));
}

function hasPermission(resourceKey) {
  if (_isAdmin) return true;
  return _userPerms.has(resourceKey);
}
```

`loadUserPermissions` é chamado logo após o login bem-sucedido, antes de chamar `showHome()`.

### Enforcement em dois níveis

**Nível 1 — UI (ocultar elementos):**

| Elemento | Condição para exibir |
|----------|----------------------|
| Home card "Análise de Redes Sociais" | `hasPermission('tool:social')` |
| Home card "Vendas" | `hasPermission('tool:sales')` |
| smenu card "Gestão à Vista" | `hasPermission('module:sales:gestao-vista')` |
| smenu card "Análise de Vendas" | `hasPermission('module:sales:analise-vendas')` |

A função `buildHomeCards()` (ou o trecho que renderiza os cards da home) aplica `display:none` nos cards sem permissão. `openSalesDashboard()` filtra os smenu-cards via `display:none` para módulos sem permissão.

**Nível 2 — Guards nas funções de navegação:**

```js
function openDashboard() {
  if (!hasPermission('tool:social')) return;
  // ... resto da função existente
}

function openSalesDashboard() {
  if (!hasPermission('tool:sales')) return;
  // ... resto da função existente (smenu filtra módulos por permissão)
}

function openGestaoVista() {
  if (!hasPermission('module:sales:gestao-vista')) return;
  // ... resto da função existente
}

function openSalesBrandPicker() {
  if (!hasPermission('module:sales:analise-vendas')) return;
  // ... resto da função existente
}
```

Guards bloqueiam acesso via console, links diretos, ou navegação de volta (`lastScreen`).

---

## UI no Admin

### Seção Usuários — Expansível por usuário

Cada card de usuário ganha um botão "Permissões ▾". Ao clicar, expande um painel inline com toggles:

```
▼ PERMISSÕES
┌──────────────────────────────────────────────────┐
│ Análise de Redes Sociais        [toggle]  ON/OFF │
│ Vendas                          [toggle]  ON/OFF │
│   ↳ Gestão à Vista              [toggle]  ON/OFF │  ← desabilitado se Vendas = OFF
│   ↳ Análise de Vendas           [toggle]  ON/OFF │  ← desabilitado se Vendas = OFF
└──────────────────────────────────────────────────┘
```

- Módulos ficam com `opacity:0.4` e `pointer-events:none` enquanto a ferramenta pai está desligada
- Cada toggle faz UPSERT imediato: `sbClient.from('user_permissions').upsert({user_id, resource_key, granted, granted_by}, {onConflict:'user_id,resource_key'})`
- Toast de confirmação após cada toggle

### Nova seção "Permissões" no sidebar admin

Visão matricial: linhas = usuários, colunas = recursos (ferramenta + módulos).

```
              │ Redes Sociais │ Vendas │ G.Vista │ A.Vendas │
──────────────┼───────────────┼────────┼─────────┼──────────┤
João Silva    │      ☑        │   ☐    │    ☐    │    ☐     │
Maria Souza   │      ☑        │   ☑    │    ☑    │    ☐     │
Pedro Lima    │      ☐        │   ☐    │    ☐    │    ☐     │
```

- Cada checkbox faz UPSERT imediato na tabela `user_permissions`
- Botão "Liberar tudo" e "Revogar tudo" por linha (usuário)
- Colunas de módulos ficam com header recuado visualmente para indicar hierarquia

### Sidebar admin atualizado (grupo GESTÃO)

```
GESTÃO
  👥 Usuários
  🔑 Permissões      ← nova seção
  📱 Contas
  📋 Solicitações
```

---

## Fluxo de Save (padrão unificado)

Igual ao admin redesign:
```
1. Admin clica toggle/checkbox
2. UPSERT em user_permissions com granted=true/false
3. Se ok: toast verde "✓ Permissão atualizada"
4. Se erro: toast vermelho com mensagem real do Supabase
5. Estado do toggle reflete o novo valor
```

---

## O que NÃO muda

- Lógica interna de cada ferramenta (dados, gráficos, filtros)
- Sistema de roles admin/viewer — continua existindo, admin ainda tem acesso total
- Estrutura HTML/CSS das ferramentas

---

## Fora de Escopo

- Grupos de permissão (templates de acesso aplicados a múltiplos usuários de uma vez)
- Audit log de quem alterou permissão de quem (apenas `granted_by` e `granted_at` são salvos)
- Permissões de escrita vs leitura dentro de uma ferramenta
