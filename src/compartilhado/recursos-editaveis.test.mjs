import { test } from 'node:test'
import assert from 'node:assert/strict'

// TODA PERMISSÃO CONCEDIDA PRECISA SER EDITÁVEL NA TELA.
//
// Quem desenha as linhas do editor é `RECURSOS` — não `PERMISSION_TREE`. A
// árvore só agrupa, e `agruparRecursos` cai no prefixo da chave quando ela não
// declara o grupo. Uma chave concedida no banco e ausente de `RECURSOS` seria
// uma permissão que VALE (hasPermission a consulta) e que ninguém consegue ver
// nem tirar pela interface.
//
// Medido em 11/08/2026: 18 chaves concedidas em produção, todas presentes.
// Este teste existe pra continuar assim.
const CONCEDIDAS_EM_PRODUCAO = [
  'social', 'social.relatorio', 'sales.gestao', 'sales.analise', 'sales.metas',
  'meta.campanha', 'meta.gestor', 'meta.fabrica', 'banco', 'noticias',
  'gestor', 'gestor.relatorios', 'acessos', 'patrimonio', 'frota',
  'frota.aprovar', 'autenticidade', 'claude.status',
]

// Este módulo importa controle-de-login-e-usuario.js que, na cadeia de imports,
// toca window.supabase.createClient() ao carregar. No navegador o window existe;
// aqui no node, não. Então fingimos um window mínimo ANTES de fazer o import —
// por isso o import é dinâmico e não estático, senão ele rodaria primeiro.
test('toda permissao concedida esta em RECURSOS, logo tem linha no editor', async () => {
  globalThis.window = { supabase: { createClient: () => ({}) } }
  const { RECURSOS } = await import('./controle-de-login-e-usuario.js')
  const editaveis = new Set(RECURSOS.map((r) => r.key))
  const invisiveis = CONCEDIDAS_EM_PRODUCAO.filter((k) => !editaveis.has(k))
  assert.deepEqual(invisiveis, [],
    'chave concedida fora de RECURSOS vale no sistema e nao aparece no editor: ninguem consegue revogar')
})
