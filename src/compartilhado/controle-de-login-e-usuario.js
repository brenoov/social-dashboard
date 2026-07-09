import { reactive } from 'vue'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'

export const estado = reactive({
  currentSession: null,
  user: null,
  permissoes: null,
  role: 'viewer',
  features: [],
  userId: null,
  avatarUrl: null,
  // Permissões micro-gerenciadas (Fase 1): recurso→ações, perfis de rede permitidos, super-admin.
  permissions: {},
  allowed_accounts: null, // null = todos os perfis
  is_superadmin: false,
})

export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}

// Carrega o perfil (papel + módulos liberados) da tabela `profiles`.
// Porte de loadDashboard (legacy/index.html L5586). Nunca lança: em erro usa os padrões.
export async function carregarPerfil(session) {
  try {
    const tok = session?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url,permissions,allowed_accounts,is_superadmin`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
    })
    const profiles = await r.json()
    const p = profiles?.[0] || {}
    estado.role = p.role || 'viewer'
    estado.features = p.features || ['banco']
    estado.permissions = p.permissions || {}
    estado.allowed_accounts = p.allowed_accounts ?? null
    estado.is_superadmin = !!p.is_superadmin
    estado.userId = session?.user?.id || null
    estado.avatarUrl = p.avatar_url || null
  } catch (e) {
    estado.role = 'viewer'
    estado.features = ['banco']
    estado.permissions = {}
    estado.allowed_accounts = null
    estado.is_superadmin = false
    estado.userId = session?.user?.id || null
    estado.avatarUrl = null
  }
}

// Catálogo de recursos → ações válidas. Fonte de verdade do editor de permissões (Fase 1).
export const RECURSOS = [
  { key: 'social', label: 'Redes Sociais (Dashboard)', acoes: ['ver', 'exportar'] },
  { key: 'social.relatorio', label: 'Redes — Relatório', acoes: ['ver', 'exportar'] },
  { key: 'sales.gestao', label: 'Gestão à Vista', acoes: ['ver', 'exportar'] },
  { key: 'sales.analise', label: 'Análise de Vendas', acoes: ['ver', 'exportar'] },
  { key: 'sales.metas', label: 'Metas de Vendas', acoes: ['ver', 'editar'] },
  { key: 'meta.campanha', label: 'Análise de Campanhas', acoes: ['ver', 'exportar'] },
  { key: 'meta.gestor', label: 'Gestão de Tráfego', acoes: ['ver', 'editar'] },
  { key: 'banco', label: 'Banco de Arquivos', acoes: ['ver', 'criar', 'excluir'] },
  { key: 'acessos', label: 'Colaboradores e Acessos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'noticias', label: 'Portal de Notícias', acoes: ['ver'] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', acoes: ['ver'] },
]

// Ponte: chaves antigas (call sites legados) → recurso novo. Assim nada quebra durante a migração.
const _legado = {
  'tool:social': 'social', 'tool:sales': 'sales', 'tool:meta': 'meta', 'tool:acessos': 'acessos',
  'module:sales:gestao-vista': 'sales.gestao', 'module:sales:analise-vendas': 'sales.analise',
  'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor',
}

// Libera/bloqueia por recurso E ação. Super-admin vê tudo. Retrocompatível com as chaves antigas.
export function hasPermission(recurso, acao = 'ver') {
  if (estado.is_superadmin) return true
  const key = _legado[recurso] || recurso
  // Pais 'sales'/'meta' (tool:*) = tem acesso se tiver QUALQUER filho do grupo.
  if (key === 'sales') return ['sales.gestao', 'sales.analise', 'sales.metas'].some(k => (estado.permissions[k] || []).includes('ver'))
  if (key === 'meta') return ['meta.campanha', 'meta.gestor'].some(k => (estado.permissions[k] || []).includes('ver'))
  return (estado.permissions[key] || []).includes(acao)
}

// Perfis de rede que o usuário pode ver (null = todos). Usado p/ filtrar o seletor de perfis.
export function contasPermitidas() {
  return estado.is_superadmin ? null : (estado.allowed_accounts ?? null)
}

// Árvore de módulos (para o painel de admin gerenciar depois). Porte verbatim (legacy/index.html L4525).
export const PERMISSION_TREE = [
  { key: 'social', label: 'Dashboard Redes Sociais', children: [] },
  { key: 'sales', label: 'Dashboard de Vendas', children: [
    { key: 'sales.gestao', label: 'Gestão à Vista' },
    { key: 'sales.analise', label: 'Análise de Vendas' },
  ] },
  { key: 'meta', label: 'Meta Ads', children: [
    { key: 'meta.campanha', label: 'Análise de Campanhas' },
    { key: 'meta.gestor', label: 'Gestão de Tráfego' },
  ] },
  { key: 'banco', label: 'Banco de Arquivos', children: [] },
  { key: 'noticias', label: 'Portal de Notícias', children: [] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', children: [] },
  { key: 'acessos', label: 'Colaboradores e Acessos', children: [] },
]
