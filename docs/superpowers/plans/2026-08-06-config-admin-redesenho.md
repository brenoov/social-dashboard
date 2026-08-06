# Config de Admin da Central — Plano de Implementação (Etapa 1)

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixinha (`- [ ]`) para acompanhamento.

**Objetivo:** reorganizar a tela de administração da Central — tirar a aba Saúde
dos Dados (preservando o aviso), trazer Times de venda para dentro de Usuários,
separar as pessoas por marca/local/setor e trocar a matriz de permissões por uma
escada de níveis — sem alterar nenhum acesso já concedido.

**Arquitetura:** a lógica que dá para errar sai da `.vue` para módulos puros com
teste ao lado (`lotacao.js`, `niveis-de-permissao.js`), no mesmo padrão de
`equipes.js`/`vendedoras.js`/`agrupar-permissoes.js` que já existe na pasta. A
tela continua imperativa (`innerHTML` + `onclick` literal): esta entrega **não**
converte a tela para Vue reativo — seria uma segunda obra, e misturar as duas
esconderia regressão.

**Tech Stack:** Vue 3 + Vite · Supabase (Postgres + RLS) · testes com
`node --test` (`npm test`) · sem dependência nova.

**Fora desta etapa:** perfis prontos (etapa 2, plano próprio), unificar
`acessos_organizacoes` × `patrimonio_locais`, limpar a lista de setores.

**Spec:** `docs/superpowers/specs/2026-08-06-config-admin-redesenho-design.md`

## Restrições Globais

Valem para **todas** as tarefas.

- **Nenhuma migration concede permissão a ninguém.** Campo e ferramenta novos
  nascem sem acesso; quem concede é o dono, pela tela.
- **Nenhum acesso já concedido pode mudar.** Se a escada não souber representar
  um conjunto gravado, a tela mostra "personalizado" e **preserva o conjunto
  original** — nunca aproxima para o degrau mais próximo.
- **Ajuste de celular não pode estragar o desktop.** Toda mudança responsiva vai
  em `@media` de tela estreita.
- **Título nunca corta.** Nada de `text-overflow: ellipsis` em nome de seção ou
  de pessoa; quebra em duas linhas.
- **Tela é full-bleed** — nada de `max-width` estreito centralizado.
- **Português literal, sem jargão**, em todo texto que aparece na tela.
- `npm test` tem de passar inteiro ao fim de **cada** tarefa (1.838 testes hoje).
- Todo módulo novo em `src/ferramentas/admin/` precisa estar **importado** na
  `.vue` que o usa — `imports.test.mjs` existe exatamente porque isso já subiu
  quebrado para produção uma vez.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/migrations/2026-08-06-pessoa-marca.sql` | **criar** — coluna `acessos_pessoas.marca_id` |
| `src/ferramentas/admin/niveis-de-permissao.js` | **criar** — catálogo → degraus; degrau ↔ conjunto de ações |
| `src/ferramentas/admin/niveis-de-permissao.test.mjs` | **criar** — inclui a prova de que nada muda |
| `src/ferramentas/admin/lotacao.js` | **criar** — agrupar pessoas por marca/local/setor |
| `src/ferramentas/admin/lotacao.test.mjs` | **criar** |
| `src/ferramentas/admin/tela-de-admin.vue` | **modificar** — navegação, seções, modal |
| `src/ferramentas/admin/imports.test.mjs` | **modificar** — cobre os módulos novos |

---

### Task 1: A coluna de marca

Hoje não existe nenhum campo ligando pessoa a marca (Vessel, Moto Easy, RBV
Company, Mantova, RB Builders). Sem isso a gaveta "Marca" não tem de onde sair.

**Files:**
- Create: `db/migrations/2026-08-06-pessoa-marca.sql`

**Interfaces:**
- Produces: coluna `acessos_pessoas.marca_id uuid` → `patrimonio_empresas(id)`,
  nula permitida. As tarefas 2 e 6 leem essa coluna.

- [ ] **Passo 1: escrever a migration**

```sql
-- A pessoa passa a ter MARCA.
--
-- POR QUE: o dono pediu para separar os usuários por marca, local e setor.
-- Local já existia com outro nome (`organizacao_id` → `acessos_organizacoes`,
-- cujo conteúdo é lugar: Sede Centro, Sede Village, Fábrica Conchal) e setor
-- também (`setor_id`). Marca não existia em lugar nenhum.
--
-- Aponta para `patrimonio_empresas` porque é a lista de marcas que já existe e
-- já é usada pelo Patrimônio (5 linhas). Criar uma segunda lista de marcas seria
-- repetir a doença dos cinco nomes da mesma loja.
--
-- NASCE VAZIA DE PROPÓSITO: esta migration não preenche ninguém e não concede
-- acesso a nada. Quem preenche é o dono, pela tela.
alter table public.acessos_pessoas
  add column if not exists marca_id uuid references public.patrimonio_empresas(id);

comment on column public.acessos_pessoas.marca_id is
  'Marca da pessoa (Vessel, Moto Easy, RBV Company...). Nulo = ainda não informado.';
```

- [ ] **Passo 2: aplicar em produção**

Rodar: `node coletor/run-migrations.mjs db/migrations/2026-08-06-pessoa-marca.sql`

- [ ] **Passo 3: conferir que a coluna existe e está vazia**

Rodar (MCP Supabase, projeto `kounqtdoioootxqegkij`):

```sql
select count(*) as pessoas, count(marca_id) as com_marca from acessos_pessoas;
```

Esperado: `pessoas` = 26 (ou mais), `com_marca` = 0.

- [ ] **Passo 4: commit**

```bash
git add db/migrations/2026-08-06-pessoa-marca.sql
git commit -m "pessoa ganha marca; local e setor ja existiam com outro nome"
```

---

### Task 2: A escada de níveis (módulo puro)

**Files:**
- Create: `src/ferramentas/admin/niveis-de-permissao.js`
- Test: `src/ferramentas/admin/niveis-de-permissao.test.mjs`

**Interfaces:**
- Consumes: `RECURSOS` de `src/compartilhado/controle-de-login-e-usuario.js`
  (array de `{ key, label, acoes: string[] }`).
- Produces:
  - `degrausDoRecurso(recurso) -> [{ chave, rotulo, acoes: string[] }]`
  - `degrauDoConjunto(recurso, acoes) -> string | null` (chave do degrau, ou
    `null` quando o conjunto não corresponde a nenhum degrau)
  - `acoesDoDegrau(recurso, chave) -> string[]`

- [ ] **Passo 1: escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { degrausDoRecurso, degrauDoConjunto, acoesDoDegrau } from './niveis-de-permissao.js'
import { RECURSOS } from '../../compartilhado/controle-de-login-e-usuario.js'

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
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/admin/niveis-de-permissao.test.mjs`
Esperado: FALHA — `Cannot find module './niveis-de-permissao.js'`

- [ ] **Passo 3: escrever o módulo**

```js
// A ESCADA DE NÍVEIS DO EDITOR DE PERMISSÕES.
//
// POR QUE EXISTE: a matriz antiga era 21 ferramentas × 5 colunas = 105 células,
// das quais só 45 existiam de verdade (a coluna "excluir" tinha 4 caixinhas em
// 21 linhas). Mais da metade da grade era buraco.
//
// POR QUE DÁ PARA SIMPLIFICAR SEM PERDER NADA: medido em 2026-08-06 nas 17
// pessoas, NENHUMA ferramenta tem mais de 2 conjuntos de ações em uso — e todos
// os pares são encaixados. O poder que a matriz oferecia nunca foi usado.
//
// PURO DE PROPÓSITO: recebe o recurso por parâmetro e não importa nada. O teste
// ao lado prova que a escada reproduz todos os conjuntos gravados em produção.
//
// NÃO INVENTA AÇÃO: todo degrau só usa ação que está no catálogo daquele
// recurso. Um degrau que concede ação inexistente é um degrau que mente.

const contem = (acoes, a) => acoes.includes(a)

// Os degraus de UM recurso, do menor para o maior. Recurso que só tem 'ver'
// ganha dois; recurso completo ganha quatro.
export function degrausDoRecurso(recurso) {
  const A = (recurso && recurso.acoes) || []
  const out = [{ chave: 'sem', rotulo: 'Sem acesso', acoes: [] }]
  if (!A.length) return out

  // Só dá para ver: o segundo degrau é o único, então o rótulo é afirmativo.
  if (A.length === 1 && contem(A, 'ver')) {
    out.push({ chave: 'ver', rotulo: 'Pode ver', acoes: ['ver'] })
    return out
  }

  out.push({ chave: 'ver', rotulo: 'Só ver', acoes: ['ver'] })

  const mexe = contem(A, 'editar')
  const cria = contem(A, 'criar') || contem(A, 'excluir')

  // Ferramenta de leitura: ver e baixar, e acabou.
  if (contem(A, 'exportar') && !mexe && !cria) {
    out.push({ chave: 'exportar', rotulo: 'Ver e baixar', acoes: ['ver', 'exportar'] })
    return out
  }

  // "Mexer" é editar o que já existe — NÃO inclui criar nem excluir. É o degrau
  // das 6 pessoas da Frota, que registram uso sem poder cadastrar veículo.
  if (mexe) {
    const acoes = ['ver', 'editar']
    if (contem(A, 'exportar')) acoes.push('exportar')
    out.push({ chave: 'mexer', rotulo: 'Ver e mexer', acoes })
  }

  // "Tudo" é o catálogo inteiro. Só aparece quando há criar ou excluir — senão
  // seria igual ao degrau anterior, e degrau repetido confunde.
  if (cria) out.push({ chave: 'tudo', rotulo: 'Tudo', acoes: A.slice() })

  return out
}

const mesmoConjunto = (a, b) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

// Qual degrau corresponde a este conjunto de ações?
//
// Devolve `null` quando nenhum corresponde — e quem chama DEVE preservar o
// conjunto original nesse caso. Aproximar para o degrau mais próximo mudaria o
// acesso de alguém sem ninguém ter pedido.
export function degrauDoConjunto(recurso, acoes) {
  const atual = acoes || []
  for (const d of degrausDoRecurso(recurso)) {
    if (mesmoConjunto(d.acoes, atual)) return d.chave
  }
  return null
}

export function acoesDoDegrau(recurso, chave) {
  const d = degrausDoRecurso(recurso).find((x) => x.chave === chave)
  return d ? d.acoes.slice() : []
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/admin/niveis-de-permissao.test.mjs`
Esperado: PASSA, 10 testes.

- [ ] **Passo 5: rodar a suíte inteira**

Rodar: `npm test`
Esperado: tudo passa (1.838 + 10).

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/admin/niveis-de-permissao.js src/ferramentas/admin/niveis-de-permissao.test.mjs
git commit -m "escada de niveis das permissoes, com a prova de que nada muda"
```

---

### Task 3: Agrupar as pessoas (módulo puro)

**Files:**
- Create: `src/ferramentas/admin/lotacao.js`
- Test: `src/ferramentas/admin/lotacao.test.mjs`

**Interfaces:**
- Produces:
  - `DIMENSOES` — `[{ chave:'marca', rotulo:'Marca' }, { chave:'local', ... }, { chave:'setor', ... }]`
  - `agruparPor(pessoas, dimensao) -> [{ chave, rotulo, quantos, pessoas, semLotacao }]`
    — o grupo sem lotação vem **sempre por último**, com `semLotacao: true`.
- Consumido pela Task 6.

Formato de `pessoas` (montado na tela a partir de `profiles` + `acessos_pessoas`):
`{ id, nome, email, papel, marca, local, setor, temCadastro }` — os três últimos
campos de lotação são string ou `null`.

- [ ] **Passo 1: escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPor, DIMENSOES } from './lotacao.js'

const P = (nome, extra = {}) => ({ id: nome, nome, email: nome + '@x.com', papel: 'viewer', marca: null, local: null, setor: null, temCadastro: true, ...extra })

test('as tres gavetas existem, nesta ordem', () => {
  assert.deepEqual(DIMENSOES.map((d) => d.chave), ['marca', 'local', 'setor'])
})

test('agrupa por marca e conta cada grupo', () => {
  const g = agruparPor([P('Ana', { marca: 'Vessel' }), P('Bia', { marca: 'Vessel' }), P('Caio', { marca: 'Moto Easy' })], 'marca')
  assert.deepEqual(g.map((x) => [x.rotulo, x.quantos]), [['Moto Easy', 1], ['Vessel', 2]])
})

test('os grupos saem em ordem alfabetica, para a lista nao dancar', () => {
  const g = agruparPor([P('A', { setor: 'RH' }), P('B', { setor: 'Comercial' })], 'setor')
  assert.deepEqual(g.map((x) => x.rotulo), ['Comercial', 'RH'])
})

test('quem nao tem lotacao vai para um grupo proprio, SEMPRE por ultimo', () => {
  // Mesmo sendo o maior grupo. Ele e um lembrete, nao o assunto principal —
  // se abrisse a lista, a tela pareceria vazia.
  const g = agruparPor([P('Ana'), P('Bia'), P('Caio', { marca: 'Vessel' })], 'marca')
  assert.equal(g.length, 2)
  assert.equal(g[0].rotulo, 'Vessel')
  assert.equal(g[1].semLotacao, true)
  assert.equal(g[1].quantos, 2)
  assert.match(g[1].rotulo, /[Ss]em marca/)
})

test('sem ninguem sem lotacao, o grupo "sem" nao aparece', () => {
  const g = agruparPor([P('Ana', { local: 'Sede Centro' })], 'local')
  assert.equal(g.length, 1)
  assert.equal(g[0].semLotacao, undefined)
})

test('lista vazia devolve lista vazia, sem estourar', () => {
  assert.deepEqual(agruparPor([], 'marca'), [])
  assert.deepEqual(agruparPor(null, 'marca'), [])
})

test('dimensao desconhecida joga todo mundo em "sem", em vez de sumir com as pessoas', () => {
  // Falhar mostrando todo mundo e melhor que falhar mostrando ninguem: uma tela
  // vazia parece "nao ha usuarios", que e a mentira mais cara aqui.
  const g = agruparPor([P('Ana', { marca: 'Vessel' })], 'inventada')
  assert.equal(g.length, 1)
  assert.equal(g[0].semLotacao, true)
  assert.equal(g[0].quantos, 1)
})

test('as pessoas de cada grupo vem em ordem alfabetica', () => {
  const g = agruparPor([P('Zeca', { setor: 'RH' }), P('Ana', { setor: 'RH' })], 'setor')
  assert.deepEqual(g[0].pessoas.map((p) => p.nome), ['Ana', 'Zeca'])
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/admin/lotacao.test.mjs`
Esperado: FALHA — `Cannot find module './lotacao.js'`

- [ ] **Passo 3: escrever o módulo**

```js
// AGRUPAR AS PESSOAS POR MARCA, LOCAL OU SETOR.
//
// Uma gaveta por vez, escolhida na tela — e não três níveis encaixados: com 17
// pessoas e 14 setores, quase toda gaveta teria uma pessoa dentro.
//
// DE ONDE VEM CADA UMA (medido em 2026-08-06):
//   setor → acessos_pessoas.setor_id      → acessos_setores       (4 de 17)
//   local → acessos_pessoas.organizacao_id → acessos_organizacoes (4 de 17)
//   marca → acessos_pessoas.marca_id      → patrimonio_empresas   (0 de 17, campo novo)
//
// PURO: recebe as pessoas já montadas e não fala com banco nem com DOM.

export const DIMENSOES = [
  { chave: 'marca', rotulo: 'Marca' },
  { chave: 'local', rotulo: 'Local' },
  { chave: 'setor', rotulo: 'Setor' },
]

const rotuloDaDimensao = (chave) =>
  (DIMENSOES.find((d) => d.chave === chave) || {}).rotulo || chave

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')

export function agruparPor(pessoas, dimensao) {
  const lista = Array.isArray(pessoas) ? pessoas : []
  if (!lista.length) return []

  const conhecida = DIMENSOES.some((d) => d.chave === dimensao)

  const gavetas = new Map()
  const sem = []
  for (const p of lista) {
    // Dimensão desconhecida cai inteira em "sem": mostrar todo mundo num grupo
    // errado é melhor que sumir com a lista, porque tela vazia é lida como
    // "não há usuários".
    const valor = conhecida ? p[dimensao] : null
    if (!valor) { sem.push(p); continue }
    if (!gavetas.has(valor)) gavetas.set(valor, [])
    gavetas.get(valor).push(p)
  }

  const out = [...gavetas.entries()]
    .map(([rotulo, pes]) => ({ chave: rotulo, rotulo, quantos: pes.length, pessoas: pes.sort(porNome) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  // O grupo "sem ___" fecha a lista, mesmo sendo o maior. Ele é lembrete, não
  // assunto: hoje são 17 de 17 sem marca, e abrir a tela por ele daria a
  // impressão de que não há nada cadastrado.
  if (sem.length) {
    out.push({
      chave: '__sem__',
      rotulo: `Sem ${rotuloDaDimensao(dimensao).toLowerCase()}`,
      quantos: sem.length,
      pessoas: sem.sort(porNome),
      semLotacao: true,
    })
  }
  return out
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/admin/lotacao.test.mjs`
Esperado: PASSA, 8 testes.

- [ ] **Passo 5: rodar a suíte inteira**

Rodar: `npm test` — tudo passa.

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/admin/lotacao.js src/ferramentas/admin/lotacao.test.mjs
git commit -m "agrupar pessoas por marca, local ou setor; o grupo 'sem' fecha a lista"
```

---

### Task 4: O modal de permissões passa a usar a escada

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue` — `_renderPermBody` (≈L1059)
  e `_togglePerm` (≈L1151)
- Modify: `src/ferramentas/admin/imports.test.mjs`

**Interfaces:**
- Consumes: `degrausDoRecurso`, `degrauDoConjunto`, `acoesDoDegrau` (Task 2);
  `agruparRecursos` de `agrupar-permissoes.js` (já existe, continua agrupando por
  ferramenta).

- [ ] **Passo 1: importar o módulo novo na tela**

No topo de `tela-de-admin.vue`, junto dos outros imports da pasta:

```js
import { degrausDoRecurso, degrauDoConjunto, acoesDoDegrau } from './niveis-de-permissao.js'
```

- [ ] **Passo 2: trocar a linha da matriz por uma linha de degraus**

Em `_renderPermBody`, no lugar da linha com 5 caixinhas
(`perm-linha` + `repeat(5,57px)`), desenhar por recurso: o nome numa linha
inteira e os degraus como botões que quebram linha.

```js
// Uma ferramenta = uma escolha. Os degraus vêm do catálogo, então ferramenta
// que só deixa ver mostra dois botões, e ferramenta completa mostra quatro.
// Nada de célula vazia: era isso que fazia a matriz parecer ter 105 escolhas
// quando tinha 45.
function _linhaDeNivel(r, u) {
  const atual = (u.permissions || {})[r.key] || []
  const degrau = degrauDoConjunto(r, atual)   // null = conjunto fora da escada

  const linha = document.createElement('div')
  linha.className = 'perm-nivel'

  const nome = document.createElement('div')
  nome.className = 'perm-nivel-nome'
  nome.textContent = r.label            // linha inteira: o nome NUNCA corta
  linha.appendChild(nome)

  const botoes = document.createElement('div')
  botoes.className = 'perm-nivel-botoes'
  for (const d of degrausDoRecurso(r)) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'perm-degrau' + (d.chave === degrau ? ' escolhido' : '')
    b.textContent = d.rotulo
    b.onclick = () => { _aplicarDegrau(u, r, d.chave); _renderPermBody(u) }
    botoes.appendChild(b)
  }
  linha.appendChild(botoes)

  // CONJUNTO FORA DA ESCADA: não escolhe degrau nenhum e não aproxima. Mostra o
  // que está gravado e deixa a pessoa decidir. Aproximar mudaria acesso sem
  // ninguém ter pedido — e é justamente o que esta tela não pode fazer.
  if (atual.length && !degrau) {
    const aviso = document.createElement('div')
    aviso.className = 'perm-nivel-aviso'
    aviso.textContent = 'Personalizado: ' + atual.join(', ') + '. Escolher um nível substitui isto.'
    linha.appendChild(aviso)
  }
  return linha
}
```

- [ ] **Passo 3: escrever o aplicador de degrau**

Ao lado de `_togglePerm` (que continua existindo para as chavinhas à parte):

```js
// Aplica um degrau: grava exatamente as ações daquele degrau, e apaga a chave
// quando o degrau é "Sem acesso" — mesmo contrato do _togglePerm, onde recurso
// sem 'ver' não existe no objeto.
function _aplicarDegrau(u, r, chaveDoDegrau) {
  const acoes = acoesDoDegrau(r, chaveDoDegrau)
  u.permissions = { ...(u.permissions || {}) }
  if (!acoes.length) delete u.permissions[r.key]
  else u.permissions[r.key] = acoes
}
```

- [ ] **Passo 4: as chaves de "aprovar" viram chavinha à parte**

`frota.aprovar` e `conteudo.aprovar` têm só `['ver']`, e "Pode ver" não descreve
o que elas fazem. Desenhar como caixinha única com o texto por extenso:

```js
const APROVACOES = {
  'frota.aprovar': 'Pode aprovar requisição de veículo',
  'conteudo.aprovar': 'Pode aprovar peças para publicar',
}
```

Na montagem do grupo, se `APROVACOES[r.key]` existir, desenhar uma caixinha com
esse rótulo em vez da escada, ligada no `_togglePerm(r, 'ver', marcado)` que já
existe.

- [ ] **Passo 5: CSS dos degraus (quebra linha, e é grande o bastante para o dedo)**

```css
.tela-admin :deep(.perm-nivel){padding:10px 12px;border-bottom:1px solid var(--border);}
.tela-admin :deep(.perm-nivel-nome){font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:7px;}
.tela-admin :deep(.perm-nivel-botoes){display:flex;flex-wrap:wrap;gap:6px;}
.tela-admin :deep(.perm-degrau){border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:99px;padding:7px 12px;font-size:11.5px;min-height:32px;cursor:pointer;font-family:var(--fonte-principal);}
.tela-admin :deep(.perm-degrau.escolhido){background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600;}
.tela-admin :deep(.perm-nivel-aviso){margin-top:7px;font-size:11px;color:var(--orange,#d97706);}
```

Apagar as regras `.perm-linha*` que sobraram sem uso.

- [ ] **Passo 6: rodar a suíte**

Rodar: `npm test`
Esperado: tudo passa, incluindo `imports.test.mjs` — que é o teste que pega
exatamente o erro de usar `degrausDoRecurso` sem importar.

- [ ] **Passo 7: conferir no navegador que nenhum acesso mudou**

Subir `npm run dev -- --port 5199 --strictPort`, abrir o editor de permissões de
**duas** pessoas e conferir contra o banco, SEM salvar:

```sql
select email, permissions from profiles
where email in ('humberto@rbvcompany.com','cristian.leonel@rbvcompany.com');
```

Esperado: o degrau aceso em cada ferramenta corresponde ao conjunto gravado. Em
especial a Frota do Humberto (`["ver","editar"]`) tem de aparecer como **Ver e
mexer**, nunca como Tudo.

- [ ] **Passo 8: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue src/ferramentas/admin/imports.test.mjs
git commit -m "permissoes: uma escolha por ferramenta, no lugar da matriz com 60 buracos"
```

---

### Task 5: A navegação — Saúde sai, Times entra em Usuários

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue` — barra (L25-33), seções do
  template (L37-111), `loadAdminSection` (L326), `updateSaudeBadge` (L335)

- [ ] **Passo 1: tirar os dois itens da barra**

Apagar as `div.admin-nav-item` de `data-section="saude"` (L33) e
`data-section="equipes"` (L26). A barra fica: Usuários · Contas · Solicitações ·
Metas · Dados.

- [ ] **Passo 2: subir o formulário de criar usuário para o topo**

Hoje a ordem dentro de `#admin-section-users` é: título → `#admin-stats-users` →
`#admin-user-list` → rótulo "Convidar novo usuário" → formulário. Ou seja, **o
formulário está no fim**, depois da lista inteira.

Mover o rótulo `<span class="sg-label">Convidar novo usuário</span>` e o
`<div class="sg">` do formulário para **logo depois de `#admin-stats-users`**,
antes de `#admin-user-list`. Nenhum `id` muda, então `adminInviteUser()` e os
`adm-name`/`adm-email`/`adm-pass`/`adm-role` continuam funcionando sem tocar em
JavaScript.

- [ ] **Passo 3: mover a seção de times para dentro de Usuários**

Mover o `<div id="admin-equipes-body">` (L111) para dentro de
`#admin-section-users`, **entre o formulário de criar e a `#admin-user-list`** —
é a ordem que o dono aprovou: criar, times, pessoas. Apagar o
`<div class="admin-section" id="admin-section-equipes">` que ficou vazio.

Em `loadAdminSection`, tirar `equipes` e `saude` do mapa `carregadores` e chamar
`loadAdminEquipes()` dentro de `loadAdminUsers()`.

- [ ] **Passo 4: o aviso da saúde vira faixa no topo de Dados**

`updateSaudeBadge` deixa de pendurar bolinha no item da barra (que não existe
mais) e passa a desenhar uma faixa no topo de `#admin-section-data`, só quando há
falha:

```js
// O SINAL DA SAÚDE NÃO MORRE COM A ABA.
//
// A aba saiu da barra a pedido do dono, mas ela estava CERTA: as 13 falhas por
// dia que ela acusava eram o bug das curtidas zeradas (commit 9943dda), e ela
// era o único lugar que avisava. Apagar o aviso junto com a tela repetiria o
// silêncio que deixou o bug invisível por semanas.
//
// Some sozinha quando não há falha: aviso que fica sempre aceso vira paisagem.
async function updateSaudeBadge() {
  const alvo = document.getElementById('admin-section-data'); if (!alvo) return
  const anterior = alvo.querySelector('.saude-faixa'); if (anterior) anterior.remove()
  const last = await sb('data_integrity_checks?select=checked_date&order=checked_date.desc&limit=1')
  if (!last.length) return
  const fails = await sb('data_integrity_checks?select=id&status=eq.fail&checked_date=eq.' + last[0].checked_date)
  if (!fails.length) return
  const faixa = document.createElement('div')
  faixa.className = 'saude-faixa'
  faixa.textContent = `A conferência de ${last[0].checked_date} achou ${fails.length} divergência(s) entre o painel e a Meta.`
  alvo.insertBefore(faixa, alvo.firstChild)
}
```

```css
.tela-admin :deep(.saude-faixa){background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:10px 12px;font-size:12px;margin-bottom:14px;}
```

- [ ] **Passo 5: manter a tela de detalhe da saúde alcançável**

`loadAdminSaude` **não** é apagada. A faixa recebe `onclick` que mostra o
`#admin-section-saude` (que continua no template, só saiu da barra) e chama
`loadAdminSaude()`. Apagar a função jogaria fora o único detalhamento das
divergências.

- [ ] **Passo 6: rodar a suíte e conferir no navegador**

Rodar: `npm test`
No navegador: a barra tem 5 itens; Times de venda aparece dentro de Usuários; a
faixa de saúde aparece no topo de Dados (hoje há falhas, então ela deve aparecer)
e clicar nela abre o detalhamento.

- [ ] **Passo 7: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue
git commit -m "Saude sai da barra mas o aviso sobrevive; Times de venda entra em Usuarios"
```

---

### Task 6: A lista de pessoas com as três gavetas

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue` — `loadAdminUsers`
- Modify: `src/ferramentas/admin/imports.test.mjs`

**Interfaces:**
- Consumes: `agruparPor`, `DIMENSOES` (Task 3).

- [ ] **Passo 1: importar e montar as pessoas com a lotação**

```js
import { agruparPor, DIMENSOES } from './lotacao.js'
```

Em `loadAdminUsers`, ler as duas pontas e casar por `profile_id`:

> ⚠️ **USE `sbClient`, NÃO o `sb()` desta tela.** O `sb()` monta o cabeçalho com
> `estado.currentSession?.access_token || SUPABASE_ANON_KEY` — e, com a chave
> anônima, o PostgREST responde **200 com lista VAZIA** para tabela que só abre
> para `authenticated`. Falha que se disfarça de "não tem nada". Foi exatamente
> isso que matou o botão "Puxar das vendedoras" em 05/08/2026; está contado no
> comentário de `_vdPuxar` (≈L369). `acessos_pessoas` está nessa situação.

```js
// A lotação mora no cadastro de Colaboradores, não no login — uma verdade só.
// `organizacao` é o LOCAL (Sede Centro, Sede Village, Fábrica Conchal): o nome
// da coluna é histórico, o conteúdo é lugar.
const [rp, rc] = await Promise.all([
  sbClient.from('profiles').select('id,email,name,role,is_superadmin,permissions,disabled'),
  sbClient.from('acessos_pessoas').select(
    'profile_id,nome,setor_id,organizacao_id,marca_id,'
    + 'acessos_setores(nome),acessos_organizacoes(nome),patrimonio_empresas(nome)'),
])
if (rp.error || rc.error) {
  // Erro NÃO vira lista vazia: dizer "não há usuários" quando a leitura falhou
  // é a mentira mais cara desta tela.
  alvo.innerHTML = '<div class="usr-vazio">Não consegui ler os usuários: '
    + esc((rp.error || rc.error).message) + '</div>'
  return
}
const perfis = rp.data || []
const pessoas = rc.data || []
const porPerfil = {}
for (const p of pessoas) if (p.profile_id) porPerfil[p.profile_id] = p
const linhas = perfis.map((u) => {
  const c = porPerfil[u.id]
  return {
    id: u.id, nome: c?.nome || u.name || u.email, email: u.email,
    papel: u.is_superadmin ? 'super' : (u.role || 'viewer'),
    marca: c?.patrimonio_empresas?.nome || null,
    local: c?.acessos_organizacoes?.nome || null,
    setor: c?.acessos_setores?.nome || null,
    temCadastro: !!c, bruto: u,
  }
})
```

- [ ] **Passo 2: o seletor de gaveta e a busca**

```js
// A gaveta escolhida sobrevive ao recarregar — mesmo espírito do "lembrar onde
// parei" que o projeto já usa nas outras telas. try/catch porque navegador com
// armazenamento bloqueado não pode derrubar a tela inteira por causa disto.
const CHAVE_GAVETA = 'admin-agrupar-por'
function _gavetaEscolhida() {
  try { const v = localStorage.getItem(CHAVE_GAVETA); if (DIMENSOES.some((d) => d.chave === v)) return v } catch (e) {}
  return 'marca'
}
function _guardarGaveta(chave) { try { localStorage.setItem(CHAVE_GAVETA, chave) } catch (e) {} }

// Sem acento, sem caixa: quem digita "raissa" tem de achar "Raíssa".
const _crua = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// A busca filtra ANTES de agrupar, senão os cabeçalhos mostrariam contagem que
// não corresponde ao que está na tela.
function _filtrar(linhas, termo) {
  const t = _crua(termo)
  if (!t) return linhas
  return linhas.filter((p) => _crua(p.nome).includes(t) || _crua(p.email).includes(t))
}
```

O seletor é um botão por dimensão (mesma classe `.perm-degrau` da Task 4, que já
tem 32px de altura e quebra linha):

```js
function _desenharSeletor(alvo, atual, aoTrocar) {
  const barra = document.createElement('div')
  barra.className = 'usr-gavetas'
  const rot = document.createElement('span')
  rot.className = 'usr-gavetas-rot'; rot.textContent = 'Agrupar:'
  barra.appendChild(rot)
  for (const d of DIMENSOES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'perm-degrau' + (d.chave === atual ? ' escolhido' : '')
    b.textContent = d.rotulo
    b.onclick = () => { _guardarGaveta(d.chave); aoTrocar(d.chave) }
    barra.appendChild(b)
  }
  alvo.appendChild(barra)
}
```

- [ ] **Passo 3: desenhar os grupos**

```js
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// As OUTRAS duas informações — a que agrupa já está no cabeçalho, repeti-la em
// cada linha é ruído.
function _subtitulo(p, gaveta) {
  if (!p.temCadastro) return '<span class="usr-alerta">sem cadastro de colaborador</span>'
  const outras = DIMENSOES.filter((d) => d.chave !== gaveta)
    .map((d) => p[d.chave] || `sem ${d.rotulo.toLowerCase()}`)
  return esc(outras.join(' · '))
}

function _desenharGrupos(alvo, linhas, gaveta) {
  const grupos = agruparPor(linhas, gaveta)
  if (!grupos.length) {
    alvo.insertAdjacentHTML('beforeend', '<div class="usr-vazio">Ninguém encontrado com esse nome.</div>')
    return
  }
  for (const g of grupos) {
    const cx = document.createElement('div')
    cx.className = 'usr-grupo' + (g.semLotacao ? ' grupo-sem' : '')
    const pessoas = g.pessoas.map((p) => `
      <div class="usr-linha" data-uid="${esc(p.id)}">
        <div>
          <div class="usr-nome">${esc(p.nome)}</div>
          <div class="usr-sub">${_subtitulo(p, gaveta)}</div>
        </div>
        <span class="usr-papel papel-${esc(p.papel)}">${esc(p.papel)}</span>
      </div>`).join('')
    cx.innerHTML = `
      <div class="usr-grupo-cab">
        <span>${esc(g.rotulo)} · ${g.quantos}</span>
        ${g.semLotacao ? '<span class="usr-preencher">preencher ›</span>' : ''}
      </div>
      ${pessoas}`
    alvo.appendChild(cx)
  }
}
```

O atalho "preencher ›" abre a ficha do primeiro sem lotação — a mesma ficha que
o clique na linha já abre hoje. Não é tela nova.

- [ ] **Passo 4: CSS (uma coluna no celular, sem tabela)**

```css
.tela-admin :deep(.usr-grupo){border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:10px;}
.tela-admin :deep(.usr-grupo.grupo-sem){background:#fffbeb;border-color:#fde68a;}
.tela-admin :deep(.usr-grupo-cab){display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:12px;letter-spacing:.5px;}
.tela-admin :deep(.usr-linha){display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid var(--border);}
.tela-admin :deep(.usr-nome){font-weight:600;font-size:13px;overflow-wrap:anywhere;}
.tela-admin :deep(.usr-sub){font-size:11px;color:var(--muted);overflow-wrap:anywhere;}
.tela-admin :deep(.usr-alerta){color:var(--orange,#d97706);}
.tela-admin :deep(.usr-papel){font-size:10px;border:1px solid var(--border);color:var(--muted);border-radius:99px;padding:2px 8px;white-space:nowrap;flex-shrink:0;}
.tela-admin :deep(.usr-papel.papel-super),.tela-admin :deep(.usr-papel.papel-admin){background:var(--accent);border-color:var(--accent);color:#fff;}
.tela-admin :deep(.usr-gavetas){display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:14px 0 8px;}
.tela-admin :deep(.usr-gavetas-rot){font-size:11px;color:var(--muted);}
.tela-admin :deep(.usr-preencher){font-size:11px;color:var(--orange,#d97706);cursor:pointer;}
.tela-admin :deep(.usr-vazio){color:var(--muted);font-size:12px;padding:14px 2px;}
```

`overflow-wrap:anywhere` em vez de `ellipsis`: e-mail comprido quebra, não corta.
`flex-shrink:0` no papel para a etiqueta não ser esmagada pelo nome comprido.

- [ ] **Passo 5: rodar a suíte e conferir contra o banco**

Rodar: `npm test`

No navegador, agrupando por Setor, conferir contra:

```sql
select s.nome as setor, count(*) from acessos_pessoas p
join acessos_setores s on s.id = p.setor_id
where p.profile_id is not null group by s.nome order by s.nome;
```

Esperado hoje: Desenvolvimento 1, Financeiro e Contabilidade 1, Marketing 1,
RH 1, e "Sem setor" com 13. Agrupando por Marca: "Sem marca" com 17.

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue src/ferramentas/admin/imports.test.mjs
git commit -m "usuarios separados por marca, local ou setor; criar usuario no topo"
```

---

### Task 7: Medir e consertar o celular

Esta tarefa **começa medindo**. Não há defeito conhecido além do estrutural; o
que a medição achar é o que se conserta.

**Files:**
- Create: `/tmp/.../medir-admin.mjs` (descartável, fora do repositório)
- Modify: `src/ferramentas/admin/tela-de-admin.vue` — bloco `@media`

- [ ] **Passo 1: montar o banco de provas**

Extrair o `<style scoped>` da `.vue`, tirar `:deep(` e `.tela-admin `, montar um
HTML com a marcação real das seções (barra, cartão de criar usuário, grupos de
pessoas, modal de permissões) e servir por **http local** — `file://` é bloqueado
e a medição não roda.

- [ ] **Passo 2: medir a 375px e a 1440px**

Com o Playwright, em cada largura:

```js
await page.setViewportSize({ width: 375, height: 800 })
const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const alvosPequenos = await page.evaluate(() =>
  [...document.querySelectorAll('button,select,input,.perm-degrau')]
    .filter((e) => e.getBoundingClientRect().height < 40)
    .map((e) => e.className + ' :: ' + e.textContent.trim().slice(0, 30)))
const fonteMiuda = await page.evaluate(() =>
  [...document.querySelectorAll('input,select,textarea')]
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
    .map((e) => e.id || e.className))
```

Anotar os três resultados. **Critérios:** `estouro` = 0 · `alvosPequenos` vazio ·
`fonteMiuda` vazia (senão o iOS dá zoom ao focar).

- [ ] **Passo 3: conferir que nenhum título corta**

```js
const cortando = await page.evaluate(() =>
  [...document.querySelectorAll('.admin-section-title,.usr-grupo-cab,.usr-nome,.perm-nivel-nome')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1)
    .map((e) => e.textContent.trim().slice(0, 40)))
```

Esperado: lista vazia.

**Cuidado ao ler o resultado:** o harness já inventou defeito falso três vezes
neste projeto (rolador do sistema, texto falso longo demais, `:deep` mal
removido) — ver `feedback_medir_layout_criterio_certo`. Use o texto REAL das
telas, não `lorem ipsum`.

- [ ] **Passo 4: consertar só o que a medição acusou**

Cada correção vai dentro de `@media(max-width:768px)` ou `(max-width:640px)`,
que já existem no arquivo. **Não** mexer nas regras de desktop.

- [ ] **Passo 5: medir de novo e provar**

Repetir o passo 2. Os três critérios têm de fechar. Rodar `npm test`.

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue
git commit -m "config de admin no celular: o que a medicao a 375px acusou"
```

---

## Ao terminar

- [ ] `npm test` inteiro passando
- [ ] Conferir com o dono, no celular dele, as três telas: Usuários (com as três
      gavetas), o editor de permissões e a faixa de saúde em Dados
- [ ] Confirmar com ele que a Frota do Humberto continua em "Ver e mexer"
- [ ] Só então `git push` (a `main` builda sozinha na Vercel)

## Pendência que NÃO entra neste plano

O dono relatou "robô-coletor parado" no Status do Claude. Conferido em
2026-08-06: os dois robôs com esse nome estão saudáveis. Os únicos cards
parecidos são *Fábrica · Ligar Anúncios* e *Atualizador do Painel*, sem nenhum
registro em `ia_execucoes`. **Falta o dono apontar onde viu** — não se conserta
o que não se reproduziu.
