import { reactive } from 'vue'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'
import { classificarErro, ERRO_DE_REDE } from './classificar-erro.js'

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
  // Conta criada em lote (vendedoras): a senha inicial foi entregue por outra
  // pessoa. Enquanto for `true`, a moldura do aplicativo cobra a troca — marca
  // sem cobrança seria promessa não cumprida.
  precisa_trocar_senha: false,
  // Falha ao carregar o perfil (objeto do classificar-erro) ou null quando deu certo.
  // Separa "é viewer mesmo" de "não consegui carregar" — antes os dois eram iguais.
  erroPerfil: null,
})

export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}

// Zera TUDO. Antes, sair só limpava a sessão e deixava role/permissions/is_superadmin
// do usuário anterior — a aba ficava com o token de um e as flags de outro.
export function limparEstado() {
  estado.currentSession = null
  estado.user = null
  estado.permissoes = null
  estado.role = 'viewer'
  estado.features = []
  estado.userId = null
  estado.avatarUrl = null
  estado.permissions = {}
  estado.allowed_accounts = null
  estado.is_superadmin = false
  estado.precisa_trocar_senha = false
  estado.erroPerfil = null
}

// Carrega o perfil (papel + permissões) da tabela `profiles`.
// Antes engolia qualquer falha e produzia role='viewer', permissions={} — idêntico
// ao caminho de sucesso com perfil vazio. Resultado: o super-admin dava F5 num blip
// de rede e via a Central sem nenhum card, sem mensagem, achando que perdeu acesso.
// Agora "é viewer" e "não consegui carregar" são estados distintos.
// Nunca lança: devolve { ok, erro } e quem chama decide o que mostrar.
export async function carregarPerfil(session) {
  estado.erroPerfil = null
  estado.userId = session?.user?.id || null
  try {
    const tok = session?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role,features,avatar_url,permissions,allowed_accounts,is_superadmin,precisa_trocar_senha`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
    })
    const corpo = await r.json().catch(() => null)
    // Em erro NÃO escrevemos role/permissions/is_superadmin: deixar o valor
    // anterior é melhor que rebaixar. Quem lê decide pelo erroPerfil.
    if (!r.ok || !Array.isArray(corpo)) {
      estado.erroPerfil = classificarErro(r.status, corpo)
      return { ok: false, erro: estado.erroPerfil }
    }
    const p = corpo[0] || {}
    estado.role = p.role || 'viewer'
    estado.features = p.features || ['banco']
    estado.permissions = p.permissions || {}
    estado.allowed_accounts = p.allowed_accounts ?? null
    estado.is_superadmin = !!p.is_superadmin
    estado.precisa_trocar_senha = !!p.precisa_trocar_senha
    estado.avatarUrl = p.avatar_url || null
    return { ok: true, erro: null }
  } catch (e) {
    estado.erroPerfil = ERRO_DE_REDE
    return { ok: false, erro: ERRO_DE_REDE }
  }
}

// Catálogo de recursos → ações válidas. Fonte de verdade do editor de permissões (Fase 1).
export const RECURSOS = [
  { key: 'social', label: 'Redes Sociais — Dashboard', acoes: ['ver', 'exportar'] },
  { key: 'social.relatorio', label: 'Redes Sociais — Relatório Interativo', acoes: ['ver', 'exportar'] },
  { key: 'sales.gestao', label: 'Gestão à Vista', acoes: ['ver', 'exportar'] },
  { key: 'sales.analise', label: 'Análise de Vendas', acoes: ['ver', 'exportar'] },
  { key: 'sales.metas', label: 'Metas de Vendas', acoes: ['ver', 'editar'] },
  { key: 'meta.campanha', label: 'Análise de Campanhas', acoes: ['ver', 'exportar'] },
  { key: 'meta.gestor', label: 'Gestão de Tráfego', acoes: ['ver', 'editar'] },
  { key: 'meta.fabrica', label: 'Fábrica de Anúncios', acoes: ['ver', 'editar'] },
  { key: 'banco', label: 'Banco de Arquivos', acoes: ['ver', 'criar', 'excluir'] },
  { key: 'acessos', label: 'Colaboradores e Acessos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'patrimonio', label: 'Patrimônio', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'frota', label: 'Frota', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'frota.aprovar', label: 'Aprovar requisição de veículo', acoes: ['ver'] },
  { key: 'noticias', label: 'Portal de Notícias', acoes: ['ver'] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', acoes: ['ver'] },
  { key: 'gestor.relatorios', label: 'Relatórios Comerciais', acoes: ['ver', 'exportar'] },
  { key: 'claude.status', label: 'Painel de Status do Claude', acoes: ['ver'] },
  { key: 'conteudo', label: 'Redes Sociais — Central de Conteúdo', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  // Chave separada em vez de uma 6ª coluna 'aprovar' na matriz: ACOES_MATRIZ é
  // fixa em 5 colunas, e uma coluna nova abriria célula vazia nas 15 linhas
  // existentes para servir só a esta. Mesmo padrão de social.relatorio.
  { key: 'conteudo.aprovar', label: 'Redes Sociais — Aprovar peças', acoes: ['ver'] },
]

// Ponte: chaves antigas (call sites legados) → recurso novo. Assim nada quebra durante a migração.
const _legado = {
  'tool:social': 'social', 'tool:sales': 'sales', 'tool:meta': 'meta', 'tool:acessos': 'acessos',
  'module:sales:gestao-vista': 'sales.gestao', 'module:sales:analise-vendas': 'sales.analise',
  'module:meta:campanha': 'meta.campanha', 'module:meta:gestor': 'meta.gestor', 'module:meta:fabrica': 'meta.fabrica',
}

// Libera/bloqueia por recurso E ação. Super-admin vê tudo. Retrocompatível com as chaves antigas.
export function hasPermission(recurso, acao = 'ver') {
  if (estado.is_superadmin) return true
  const key = _legado[recurso] || recurso
  // Pais 'sales'/'meta' (tool:*) = tem acesso se tiver QUALQUER filho do grupo.
  if (key === 'sales') return ['sales.gestao', 'sales.analise', 'sales.metas'].some(k => (estado.permissions[k] || []).includes('ver'))
  if (key === 'meta') return ['meta.campanha', 'meta.gestor', 'meta.fabrica'].some(k => (estado.permissions[k] || []).includes('ver'))
  return (estado.permissions[key] || []).includes(acao)
}

// Perfis de rede que o usuário pode ver (null = todos). Usado p/ filtrar o seletor de perfis.
export function contasPermitidas() {
  return estado.is_superadmin ? null : (estado.allowed_accounts ?? null)
}

// Árvore de módulos (para o painel de admin gerenciar depois). Porte verbatim (legacy/index.html L4525).
export const PERMISSION_TREE = [
  { key: 'social', label: 'Redes Sociais', children: [
    { key: 'social.relatorio', label: 'Relatório Interativo' },
  ] },
  { key: 'sales', label: 'Dashboard de Vendas', children: [
    { key: 'sales.gestao', label: 'Gestão à Vista' },
    { key: 'sales.analise', label: 'Análise de Vendas' },
  ] },
  { key: 'meta', label: 'Meta Ads', children: [
    { key: 'meta.campanha', label: 'Análise de Campanhas' },
    { key: 'meta.gestor', label: 'Gestão de Tráfego' },
    { key: 'meta.fabrica', label: 'Fábrica de Anúncios' },
  ] },
  { key: 'banco', label: 'Banco de Arquivos', children: [] },
  { key: 'noticias', label: 'Portal de Notícias', children: [] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', children: [] },
  // Gestão Interna é uma PORTA (menu), não uma ferramenta: não tem permissão
  // própria. Aqui ela existe só para o editor de permissões mostrar os dois
  // submódulos juntos, com um "marcar tudo" do grupo. As chaves dos filhos
  // seguem 'acessos' e 'patrimonio' — sem prefixo — porque is_acessos_admin() e
  // o acessos-proxy procuram essas strings dentro de features[]; renomear
  // tiraria o acesso de quem usa o módulo hoje.
  { key: 'gestao-interna', label: 'Gestão Interna', children: [
    { key: 'acessos', label: 'Colaboradores e Acessos' },
    { key: 'patrimonio', label: 'Patrimônio' },
    { key: 'frota', label: 'Frota' },
    { key: 'frota.aprovar', label: 'Aprovar requisição de veículo' },
  ] },
  { key: 'claude.status', label: 'Painel de Status do Claude', children: [] },
  // ESCRITÓRIO 3D. Entrou na árvore em 04/08/2026, a pedido do dono: até então
  // era a única ferramenta da home SEM porteiro — qualquer pessoa logada abria.
  // Como toda chave nova, ela sobe concedida a NINGUÉM: quem tinha acesso por
  // omissão passa a precisar da marcação explícita. É de propósito.
  { key: 'escritorio3d', label: 'Escritório 3D dos Agentes', children: [] },
  { key: 'conteudo', label: 'Central de Conteúdo', children: [
    { key: 'conteudo.aprovar', label: 'Aprovar peças' },
  ] },
]
