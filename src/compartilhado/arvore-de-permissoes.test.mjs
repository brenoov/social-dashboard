import { test } from 'node:test'
import assert from 'node:assert/strict'

// Este módulo puxa, na cadeia de imports, o conectar-no-banco-de-dados.js, que
// chama window.supabase.createClient() assim que carrega. No navegador o window
// existe; aqui no node, não. Então fingimos um window mínimo ANTES de importar —
// por isso o import é dinâmico e não estático, senão ele rodaria primeiro.
// (Mesmo truque de controle-de-login-e-usuario.test.mjs, ao lado.)
globalThis.window = { supabase: { createClient: () => ({}) } }
const { PERMISSION_TREE } = await import('./controle-de-login-e-usuario.js')

// Chaves que hasPermission() consulta ou que estão gravadas em produção.
// Medido no banco em 11/08/2026: sales.metas e gestor.relatorios tinham 12
// pessoas cada e NÃO apareciam na árvore — invisíveis na tela de admin.
const CONCEDIDAS_EM_PRODUCAO = [
  'social', 'social.relatorio', 'sales.gestao', 'sales.analise', 'sales.metas',
  'meta.campanha', 'meta.gestor', 'meta.fabrica', 'banco', 'noticias',
  'gestor', 'gestor.relatorios', 'acessos', 'patrimonio', 'frota',
  'frota.aprovar', 'autenticidade', 'claude.status',
]

function chavesDaArvore(nos = PERMISSION_TREE, acc = []) {
  for (const n of nos) {
    acc.push(n.key)
    if (n.children) chavesDaArvore(n.children, acc)
  }
  return acc
}

test('toda permissao concedida aparece na arvore', () => {
  const arvore = new Set(chavesDaArvore())
  const invisiveis = CONCEDIDAS_EM_PRODUCAO.filter((k) => !arvore.has(k))
  assert.deepEqual(invisiveis, [],
    'permissao concedida que nao esta na arvore e invisivel na tela de admin: nao da pra ver nem revogar')
})
