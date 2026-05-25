# Admin Redesign — Central de Inteligência

**Data:** 2026-05-25
**Arquivo alvo:** `projetos/central-inteligencia/central-inteligencia-v1.1.html`
**Arquivo removido:** `projetos/central-inteligencia/central-inteligencia-v1.2-preview.html`

---

## Objetivo

Corrigir todos os bugs do módulo de administração e redesenhar o painel admin com mais seções, melhor organização e features de personalização completas (live preview de cores, gradientes, reordenação de contas, comportamento do autocycle).

---

## Bugs a Corrigir

### Bug 1 — Cor salva mas reverte ao reabrir
**Causa:** `adFetch` faz PATCH na tabela `accounts`. Supabase retorna HTTP 200 com array vazio quando RLS bloqueia a escrita — sem lançar erro. O toast dispara sempre (sem verificar `response.ok`). Quando o usuário volta à seção, `loadAdminAppearance` relê o banco e mostra o valor antigo.

**Fix:**
- Usar `sbClient.from('accounts').update(...)` em vez de `adFetch` raw para PATCH em tabelas críticas — o cliente Supabase propaga o token de sessão corretamente e lança erros em caso de falha de RLS.
- Se persistir o problema, verificar política RLS da tabela `accounts` e adicionar policy de UPDATE para role `admin`.
- Após save bem-sucedido, chamar `applyAccountTheme(accId, newColor)` para atualizar o CSS variable `--accent` na sessão atual sem precisar recarregar.

### Bug 2 — Nome da plataforma e frase de rodapé não salvam
**Causa:** `adminSaveSetting` faz PATCH em `platform_settings?key=eq.${key}`. Se a linha não existir, o PATCH não cria nada — retorna 200 com array vazio.

**Fix:** Trocar para UPSERT via `sbClient.from('platform_settings').upsert({key, value, updated_at}, {onConflict: 'key'})`.

### Bug 3 — Toast de sucesso mesmo em falha
**Causa:** `adFetch` não verifica `response.ok`. Toast sempre dispara independente do resultado.

**Fix:** Wrapper `adFetch` verificar `response.ok`. Se falso, chamar `adminToast(msg, false)` (toast vermelho já existe).

### Bug 4 — Cor salva no BD mas não aplica visualmente
**Causa:** Após salvar `accent_color`, o código atualiza `PROFILE_THEMES[acc.name].accent` em memória mas não atualiza a CSS variable `--accent` da conta atualmente selecionada.

**Fix:** Criar função `applyAccountTheme(name, color)` que atualiza `PROFILE_THEMES`, reconstrói o `light`/`mid` derivado e, se a conta estiver ativa, faz `document.documentElement.style.setProperty('--accent', color)` + re-renderiza o botão de perfil.

### Bug 5 — Duplicidade: cor editável em dois lugares
**Causa:** Seções "Contas" e "Aparência" ambas têm color picker para `accent_color`.

**Fix:** Remover color picker da seção "Contas". Centralizar na nova seção "Temas & Cores".

---

## Nova Estrutura do Sidebar

```
GESTÃO
  👥 Usuários
  📱 Contas
  📋 Solicitações

PERSONALIZAÇÃO
  🎨 Temas & Cores      ← nova seção
  ✨ Aparência Global
  ⚙️ Comportamento      ← nova seção

DADOS
  📊 Sincronização
  🎯 Metas

INFO
  ℹ️ Sistema
```

Labels de grupo no sidebar com fonte 9px uppercase, igual ao padrão existente (`.admin-nav-group-label`).

---

## Seção: Temas & Cores (nova)

Substitui o color picker duplicado atual. Um card por conta com:

### Card de conta
- Avatar circular com foto (ou inicial)
- Nome e username
- **Live preview:** ao mover o color picker, atualiza imediatamente o botão de perfil na barra de seleção (sem salvar)
- **Toggle Sólido / Gradiente:**
  - Sólido: um color picker → `accent_color`
  - Gradiente: dois color pickers (início + fim) → `accent_color` e `accent_color_end` (novo campo na tabela)
- **Emoji customizado:** input text pequeno com picker de emoji, salvo em `accounts.display_emoji` (novo campo)
- **Handle de drag** (⠿) para reordenar a sequência de exibição das contas → salvo em `accounts.display_order` (novo campo, integer)
- Badge "● não salvo" quando picker foi alterado mas não salvo
- Botão individual "Salvar" por card

### Banco de dados (migrações necessárias)
```sql
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS accent_color_end text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_emoji text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
```

### Live preview
- `pick.addEventListener('input', ...)` (não `change`) → chama `applyAccountTheme(name, color)` imediatamente
- Se gradiente, aplica o gradiente como background no avatar e no botão de perfil

---

## Seção: Aparência Global (refatorada)

Mantém o que já existe mas corrige os bugs e adiciona:

- **Nome da plataforma** — input + live preview no header enquanto digita (debounce 400ms) + botão Salvar → UPSERT
- **Frase de rodapé** — input + live preview na home + botão Salvar → UPSERT
- **Upload de logo** — botão "Trocar logo", abre file picker (PNG/SVG max 500KB), faz upload para Supabase Storage bucket `platform-assets`, salva URL em `platform_settings.logo_url`, preview ao vivo antes de confirmar
- **Tema padrão** — toggle Dark / Light → salvo em `platform_settings.default_theme` (lido no login de novos usuários)

---

## Seção: Comportamento (nova)

- **Intervalo do autocycle:** slider de 10 a 120 segundos com step 5, label dinâmico "X segundos" → salvo em `platform_settings.autocycle_interval`, lido por `startAutoCycle()`
- **Contas na rotação:** lista de todas as contas com toggle individual → salvo em `accounts.in_rotation` (boolean, novo campo) → `buildAutoCycleQueue()` filtra por `in_rotation = true`
- **Período padrão:** select (Hoje / 7 dias / 30 dias / 90 dias) → salvo em `platform_settings.default_period`, aplicado ao abrir o dashboard
- **Header recolhido por padrão:** toggle → salvo em `platform_settings.header_collapsed_default`

### Banco de dados
```sql
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS in_rotation boolean DEFAULT true;
-- platform_settings já existe, novos registros inseridos via UPSERT
```

---

## Seção: Contas (simplificada)

Remove o color picker (movido para Temas & Cores). Mantém:
- Nome editável inline
- Username editável inline
- Instagram ID (read-only)
- Foto de perfil com botão "Rebuscar"
- Status de conexão

---

## Arquitetura de Dados

### Tabela `accounts` — novos campos
| Campo | Tipo | Padrão | Uso |
|-------|------|--------|-----|
| `accent_color_end` | text | null | Cor final do gradiente |
| `display_emoji` | text | null | Emoji customizado |
| `display_order` | integer | 0 | Ordem na barra de perfis |
| `in_rotation` | boolean | true | Entra no autocycle |

### Tabela `platform_settings` — novos registros
| key | Uso |
|-----|-----|
| `autocycle_interval` | Intervalo em segundos |
| `default_period` | Período padrão (today/7d/30d/90d) |
| `default_theme` | Tema padrão (dark/light) |
| `header_collapsed_default` | Header começa recolhido |
| `logo_url` | URL do logo customizado |

---

## Fluxo de Save (padrão unificado)

```
1. Usuário altera valor
2. Badge "● não salvo" aparece
3. Live preview aplica visualmente (sem salvar)
4. Usuário clica "Salvar"
5. sbClient.from(...).upsert/update(...)
6. Se ok: badge some, toast verde "✓ Salvo"
7. Se erro: toast vermelho com mensagem real do Supabase
```

Todas as escritas usam `sbClient` (com sessão autenticada), nunca `adFetch` raw para operações críticas.

---

## O que NÃO muda

- Estrutura HTML/CSS geral do dashboard principal (fora do admin)
- Seções "Usuários", "Sincronização", "Metas", "Sistema" — apenas recebem os bug fixes de toast
- Lógica de autocycle — apenas exposta para configuração, não reescrita
- Lógica de coleta de dados

---

## Fora de Escopo

- App mobile
- Notificações push / email de alerta de métricas
- Multi-tenant / múltiplas organizações
- Upload de foto de perfil do usuário (apenas rebusca via Meta API)
