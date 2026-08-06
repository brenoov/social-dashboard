import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { degrausDoRecurso, degrauDoConjunto, acoesDoDegrau } from './niveis-de-permissao.js'

// Importar o catálogo real NÃO dá: controle-de-login-e-usuario.js puxa Vue +
// Supabase e explode em Node com "window is not defined". Então a cópia abaixo
// existe só para os casos de teste — e o teste "a cópia deste teste ainda bate
// com o catálogo real" (no fim do arquivo) lê o array direto do fonte e falha
// se os dois divergirem. Sem esse guarda, a cópia seria um segundo catálogo
// silenciosamente desatualizado.

const RECURSOS = [
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
  { key: 'autenticidade', label: 'Autenticidade e Garantia', acoes: ['ver', 'criar', 'editar'] },
  { key: 'noticias', label: 'Portal de Notícias', acoes: ['ver'] },
  { key: 'gestor', label: 'Gestão Comercial (IA)', acoes: ['ver'] },
  { key: 'gestor.relatorios', label: 'Relatórios Comerciais', acoes: ['ver', 'exportar'] },
  { key: 'claude.status', label: 'Painel de Status do Claude', acoes: ['ver'] },
  { key: 'conteudo', label: 'Redes Sociais — Central de Conteúdo', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'conteudo.aprovar', label: 'Redes Sociais — Aprovar peças', acoes: ['ver'] },
]

const acha = (k) => RECURSOS.find((r) => r.key === k)
const chaves = (r) => degrausDoRecurso(r).map((d) => d.chave)

test('ferramenta que so deixa VER tem dois degraus', () => {
  assert.deepEqual(chaves(acha('noticias')), ['sem', 'ver'])
  assert.equal(degrausDoRecurso(acha('noticias'))[1].rotulo, 'Pode ver')
})

test('ferramenta de ver+exportar termina em "Ver e baixar"', () => {
  assert.deepEqual(chaves(acha('social')), ['sem', 'ver', 'exportar'])
  assert.deepEqual(acoesDoDegrau(acha('social'), 'exportar'), ['ver', 'exportar'])
})

test('ferramenta de ver+editar termina em "Ver e mexer"', () => {
  assert.deepEqual(chaves(acha('sales.metas')), ['sem', 'ver', 'mexer'])
  assert.deepEqual(acoesDoDegrau(acha('sales.metas'), 'mexer'), ['ver', 'editar'])
})

test('Banco nao tem "editar" no catalogo, entao nao ganha degrau de mexer', () => {
  // ['ver','criar','excluir'] — inventar um degrau "mexer" aqui criaria um
  // checkbox que nao corresponde a nenhuma acao do catalogo.
  assert.deepEqual(chaves(acha('banco')), ['sem', 'ver', 'tudo'])
  assert.deepEqual(acoesDoDegrau(acha('banco'), 'tudo'), ['ver', 'criar', 'excluir'])
})

test('ferramenta completa tem quatro degraus, e "mexer" NAO inclui criar', () => {
  // Este e o caso da Frota: 6 pessoas tem ver+editar (registram uso sem
  // cadastrar veiculo) e 1 tem tudo. Se "mexer" incluisse 'criar', as 6
  // ganhariam permissao que ninguem deu.
  assert.deepEqual(chaves(acha('frota')), ['sem', 'ver', 'mexer', 'tudo'])
  assert.deepEqual(acoesDoDegrau(acha('frota'), 'mexer'), ['ver', 'editar'])
  assert.deepEqual(acoesDoDegrau(acha('frota'), 'tudo'), ['ver', 'criar', 'editar', 'excluir'])
})

test('conjunto que nao casa com degrau nenhum devolve null (nao aproxima)', () => {
  // 'criar' sem 'ver' nao e degrau. A tela mostra "personalizado" e preserva o
  // conjunto original. Aproximar para o degrau mais proximo mudaria acesso.
  assert.equal(degrauDoConjunto(acha('frota'), ['criar']), null)
  assert.equal(degrauDoConjunto(acha('frota'), ['ver', 'excluir']), null)
})

test('a ordem das acoes nao importa para reconhecer o degrau', () => {
  assert.equal(degrauDoConjunto(acha('frota'), ['editar', 'ver']), 'mexer')
})

// ── A PROVA DE QUE NADA MUDA ──────────────────────────────────────────────
//
// Estes sao os conjuntos REAIS gravados em producao, medidos em 2026-08-06 com
// `select chave, distinct acoes from profiles, jsonb_each(permissions)`. Nenhuma
// ferramenta tem mais de 2 conjuntos em uso, e todos sao encaixados — por isso a
// escada consegue representar todos sem perda.
//
// Se este teste falhar, a escada esta prestes a mudar o acesso de alguem.
const CONJUNTOS_EM_USO = {
  'social':            [['ver'], ['ver', 'exportar']],
  'social.relatorio':  [['ver'], ['ver', 'exportar']],
  'sales.gestao':      [['ver'], ['ver', 'exportar']],
  'sales.analise':     [['ver'], ['ver', 'exportar']],
  'sales.metas':       [['ver'], ['ver', 'editar']],
  'meta.campanha':     [['ver', 'exportar']],
  'meta.gestor':       [['ver', 'editar']],
  'meta.fabrica':      [['ver', 'editar']],
  'banco':             [['ver', 'criar', 'excluir']],
  'acessos':           [['ver', 'criar', 'editar', 'excluir']],
  'patrimonio':        [['ver', 'criar', 'editar', 'excluir']],
  'frota':             [['ver', 'editar'], ['ver', 'criar', 'editar', 'excluir']],
  'frota.aprovar':     [['ver']],
  'noticias':          [['ver']],
  'gestor':            [['ver']],
  'gestor.relatorios': [['ver', 'exportar']],
  'claude.status':     [['ver']],
}

test('a escada reproduz TODOS os conjuntos gravados hoje, sem perda', () => {
  for (const [chave, conjuntos] of Object.entries(CONJUNTOS_EM_USO)) {
    const r = acha(chave)
    assert.ok(r, `recurso ${chave} sumiu do catalogo`)
    for (const acoes of conjuntos) {
      const degrau = degrauDoConjunto(r, acoes)
      assert.ok(degrau, `${chave}: o conjunto ${JSON.stringify(acoes)} nao virou degrau`)
      assert.deepEqual(
        [...acoesDoDegrau(r, degrau)].sort(),
        [...acoes].sort(),
        `${chave}: ida e volta pelo degrau "${degrau}" mudou o conjunto`,
      )
    }
  }
})

test('todo degrau de todo recurso so usa acao que existe no catalogo', () => {
  for (const r of RECURSOS) {
    for (const d of degrausDoRecurso(r)) {
      for (const a of d.acoes) {
        assert.ok(r.acoes.includes(a), `${r.key}: degrau "${d.chave}" usa acao "${a}" que nao esta no catalogo`)
      }
    }
  }
})

// ── Validador de cópia ────────────────────────────────────────────────────
// Lê o catálogo real direto do arquivo, valida que a cópia não divergiu.
// Se divergir, o teste falha e avisa que precisa atualizar a cópia deste teste.

function catalogoReal() {
  const fonte = readFileSync(new URL('../../compartilhado/controle-de-login-e-usuario.js', import.meta.url), 'utf8')
  const ini = fonte.indexOf('export const RECURSOS = [')
  assert.notEqual(ini, -1, 'não achei "export const RECURSOS = [" no fonte — renomearam?')
  const fim = fonte.indexOf('\n]', ini)
  assert.notEqual(fim, -1, 'não achei o fim do array RECURSOS')
  const bloco = fonte.slice(ini, fim)
  const itens = [...bloco.matchAll(/key:\s*'([^']+)'[\s\S]*?acoes:\s*\[([^\]]*)\]/g)]
  assert.ok(itens.length > 0, 'não consegui extrair nenhum recurso do catálogo')
  return itens.map((m) => ({
    key: m[1],
    acoes: [...m[2].matchAll(/'([^']+)'/g)].map((a) => a[1]),
  }))
}

test('a cópia deste teste ainda bate com o catálogo real', () => {
  const real = catalogoReal()
  assert.deepEqual(
    real.map((r) => ({ key: r.key, acoes: r.acoes })),
    RECURSOS.map((r) => ({ key: r.key, acoes: r.acoes })),
    'RECURSOS mudou em controle-de-login-e-usuario.js — atualize a cópia deste teste',
  )
})
