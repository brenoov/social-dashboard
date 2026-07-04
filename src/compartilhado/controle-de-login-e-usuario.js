import { reactive } from 'vue'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'

export const estado = reactive({
  currentSession: null,
  user: null,
  permissoes: null,
  role: 'viewer',
  features: [],
  userId: null,
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
    })
    const profiles = await r.json()
    estado.role = profiles?.[0]?.role || 'viewer'
    estado.features = profiles?.[0]?.features || ['banco']
    estado.userId = session?.user?.id || null
  } catch (e) {
    estado.role = 'viewer'
    estado.features = ['banco']
    estado.userId = session?.user?.id || null
  }
}

// Libera/bloqueia módulos e submódulos. Porte verbatim de hasPermission (legacy/index.html L3291),
// lendo do `estado` reativo em vez das globais soltas do monólito.
export function hasPermission(resourceKey) {
  if (estado.role === 'admin') return true
  const keyMap = {
    'tool:social': 'social', 'tool:sales': 'sales', 'tool:meta': 'meta', 'tool:acessos': 'acessos',
    'module:sales:gestao-vista': 'sales.gestao', 'module:sales:analise-vendas': 'sales.analise',
    'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor',
  }
  const fKey = keyMap[resourceKey] || resourceKey
  return (estado.features || []).includes(fKey)
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
