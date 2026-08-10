# Aba de Relatórios — Etapa 1 (casca + Patrimônio) — Plano de Execução

> **Para quem executa:** use `superpowers:subagent-driven-development` (recomendado)
> ou `superpowers:executing-plans` para tocar tarefa por tarefa. Os passos usam
> caixinha (`- [ ]`) para marcar progresso.

**Objetivo:** entregar no ar a aba Relatórios do Patrimônio, com os 4 relatórios,
recorte por marca/local, exportação em Excel e PDF por impressão — e com a casca
já compartilhada, pronta para a Frota da Etapa 2 só declarar o catálogo dela.

**Arquitetura:** uma casca burra (`aba-de-relatorios.vue`) que não sabe nada
sobre Patrimônio ou Frota; toda a inteligência mora em dois lugares — lógica
pura em `compartilhado/relatorios/*.js` (com teste ao lado) e um **catálogo**
por ferramenta, que declara cada relatório: título, colunas, se pede período,
como buscar as linhas e de onde tirar marca/local.

**Tecnologia:** Vue 3 (`<script setup>`), Vite, Supabase JS, `XLSX` global já
carregado no `index.html` (linha 20). **Nenhuma dependência nova.**

**Desenho de origem:** `docs/superpowers/specs/2026-08-10-relatorios-frota-patrimonio-design.md`

## Restrições globais

Valem para TODAS as tarefas. Não repetidas em cada uma.

- **Leia `PADRAO-DA-CENTRAL.md` antes da primeira linha.** É obrigatório no `CLAUDE.md`.
- **Nenhum hex de cor novo.** Só token de `src/estilos/estilos-globais.css`. `npm test` reprova hex.
- **Botão tem três classes e só:** `.btn.btn-principal` (uma por bloco), `.btn`, `.btn.btn-perigo`. Nunca `style=` em botão. Altura mínima 40px. `npm test` reprova.
- **Nenhuma dependência nova** no `package.json`. O projeto tem 3, e vai continuar com 3.
- **Toda lógica pura em `.js` com `.test.mjs` ao lado.** A `.vue` fica fina: `tela-de-patrimonio.vue` já tem ~2.400 linhas.
- **Rodar na porta fixa:** `npm run dev -- --port 5199 --strictPort`. Há mais de uma janela neste repositório; nunca matar processo alheio.
- **Nunca `git add <pasta>`.** Outras sessões editam este repositório ao mesmo tempo. Sempre `git add <arquivo>` e conferir `git diff --cached` antes de commitar.
- **Permissão nasce desmarcada.** Nenhuma migration concede `patrimonio.relatorios` a ninguém.
- Ao terminar cada tarefa: `npm test` e `npm run build` verdes antes do commit.

---

## Mapa dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/compartilhado/relatorios/exportar.js` | **Criar.** Puro. Linhas + colunas → matriz do Excel; e o disparo do download. |
| `src/compartilhado/relatorios/exportar.test.mjs` | **Criar.** |
| `src/compartilhado/relatorios/recorte.js` | **Criar.** Puro. Filtrar por marca/local, rótulo do recorte, contagem do que ficou de fora. |
| `src/compartilhado/relatorios/recorte.test.mjs` | **Criar.** |
| `src/compartilhado/relatorios/folha.css` | **Criar.** Só `@media print`, escopado na folha. |
| `src/compartilhado/relatorios/aba-de-relatorios.vue` | **Criar.** A casca: 3 passos, prévia, 2 botões. |
| `src/compartilhado/relatorios/imports.test.mjs` | **Criar.** O guarda de import da pasta nova. |
| `src/ferramentas/patrimonio/relatorios-do-patrimonio.js` | **Criar.** O catálogo: os 4 relatórios. |
| `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs` | **Criar.** |
| `src/ferramentas/patrimonio/planilha-e-resumo.js` | **Modificar.** `montarLinhasParaExcel` passa a delegar para `matrizParaExcel`. |
| `src/ferramentas/patrimonio/tela-de-patrimonio.vue` | **Modificar.** 5ª aba + a casca. |
| `src/compartilhado/controle-de-login-e-usuario.js:85-110` | **Modificar.** A chave `patrimonio.relatorios` em `RECURSOS`. |

---

## Task 1: A matriz do Excel deixa de ser exclusiva do Patrimônio

Hoje `montarLinhasParaExcel` é amarrada em `COLUNAS_PLANILHA`. Os 8 relatórios
têm colunas diferentes, então a mesma regra (dinheiro vira número, vazio vira
string) precisa valer para qualquer lista de colunas — sem copiar a regra.

**Arquivos:**
- Criar: `src/compartilhado/relatorios/exportar.js`
- Criar: `src/compartilhado/relatorios/exportar.test.mjs`
- Modificar: `src/ferramentas/patrimonio/planilha-e-resumo.js` (a função `montarLinhasParaExcel`, no fim do arquivo)

**Interfaces:**
- Produz: `matrizParaExcel(colunas, linhas) -> Array<Array<string|number|null>>`, onde `colunas` é `[{ chave, titulo, tipo }]` e `tipo` é `'texto' | 'numero' | 'dinheiro'`.
- Produz: `baixarExcel({ colunas, linhas, nomeAba, nomeArquivo }) -> { ok: boolean, motivo?: string }`
- Consome: nada.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/compartilhado/relatorios/exportar.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matrizParaExcel } from './exportar.js'

const COLUNAS = [
  { chave: 'nome', titulo: 'Item', tipo: 'texto' },
  { chave: 'valor_centavos', titulo: 'Valor', tipo: 'dinheiro' },
]

test('a primeira linha é o cabeçalho, na ordem das colunas', () => {
  assert.deepEqual(matrizParaExcel(COLUNAS, []), [['Item', 'Valor']])
})

test('dinheiro sai NÚMERO em reais, para o Excel somar', () => {
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: 800000 }])
  assert.deepEqual(m[1], ['Mesa', 8000])
})

test('dinheiro sem valor vira null, e não zero', () => {
  // Zero mentiria: "não informado" não é "custou nada", e zero entra na soma.
  const m = matrizParaExcel(COLUNAS, [{ nome: 'Mesa', valor_centavos: null }])
  assert.deepEqual(m[1], ['Mesa', null])
})

test('texto vazio ou ausente vira string vazia, nunca "undefined"', () => {
  const m = matrizParaExcel(COLUNAS, [{ valor_centavos: 100 }])
  assert.equal(m[1][0], '')
})

test('sem linhas, devolve só o cabeçalho — não estoura', () => {
  assert.equal(matrizParaExcel(COLUNAS, null).length, 1)
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/compartilhado/relatorios/exportar.test.mjs`
Esperado: FALHA — `Cannot find module './exportar.js'`

- [ ] **Passo 3: escrever o mínimo que faz passar**

Criar `src/compartilhado/relatorios/exportar.js`:

```js
// A saída em arquivo dos relatórios. Puro no que dá pra ser puro: `matrizParaExcel`
// não toca em DOM nem em banco, e é ela que os testes cobrem. O `baixarExcel`
// só embrulha a chamada do XLSX, que é global carregado no index.html.
//
// Por que isto não mora em patrimonio/planilha-e-resumo.js: aquela versão era
// amarrada em COLUNAS_PLANILHA, e os oito relatórios têm colunas diferentes.
// Copiar a regra de "dinheiro vira número" para cada um é o caminho curto para
// duas delas discordarem.

/**
 * Cabeçalho + linhas, na ordem das colunas.
 *
 * Dinheiro sai como NÚMERO em reais (não texto) pra somar dentro do Excel —
 * exportar "R$ 8.000,00" como texto faz a planilha virar um retrato inútil.
 * E dinheiro ausente sai `null`, não `0`: zero entraria na soma e mentiria.
 */
export function matrizParaExcel(colunas, linhas) {
  const cols = (colunas || []).filter(Boolean)
  const cab = cols.map((c) => c.titulo)
  const corpo = (linhas || []).filter(Boolean).map((l) => cols.map((c) => {
    const v = l?.[c.chave]
    if (c.tipo === 'dinheiro') return typeof v === 'number' ? v / 100 : null
    if (v === null || v === undefined) return ''
    return v
  }))
  return [cab, ...corpo]
}

/**
 * Dispara o download do .xlsx. Devolve `{ ok }` em vez de avisar sozinho:
 * quem chama é que sabe como esta ferramenta mostra recado ao usuário.
 */
export function baixarExcel({ colunas, linhas, nomeAba, nomeArquivo } = {}) {
  const XLSX = typeof globalThis !== 'undefined' ? globalThis.XLSX : undefined
  if (!XLSX) return { ok: false, motivo: 'Exportador não carregou. Recarregue a página.' }
  const ws = XLSX.utils.aoa_to_sheet(matrizParaExcel(colunas, linhas))
  const wb = XLSX.utils.book_new()
  // O Excel recusa nome de aba com mais de 31 caracteres — e recusa o arquivo
  // inteiro, não a aba. Cortar aqui é mais barato que descobrir na mão do dono.
  XLSX.utils.book_append_sheet(wb, ws, String(nomeAba || 'Relatório').slice(0, 31))
  XLSX.writeFile(wb, nomeArquivo)
  return { ok: true }
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/compartilhado/relatorios/exportar.test.mjs`
Esperado: 5 testes passando.

- [ ] **Passo 5: fazer o Patrimônio delegar, sem mudar o comportamento dele**

Em `src/ferramentas/patrimonio/planilha-e-resumo.js`, trocar o corpo de
`montarLinhasParaExcel` (a última função do arquivo) por:

```js
// Monta a matriz do arquivo .xlsx das COLUNAS_PLANILHA. A regra de como cada
// tipo de coluna vira célula mora em compartilhado/relatorios/exportar.js, e é
// a MESMA dos outros relatórios — duas cópias divergiriam na primeira mudança.
export function montarLinhasParaExcel(linhas) {
  return matrizParaExcel(COLUNAS_PLANILHA, linhas)
}
```

E acrescentar no topo do arquivo:

```js
import { matrizParaExcel } from '../../compartilhado/relatorios/exportar.js'
```

- [ ] **Passo 6: provar que o Patrimônio não mudou**

Rodar: `node --test src/ferramentas/patrimonio/planilha-e-resumo.test.mjs`
Esperado: todos passando **sem tocar no arquivo de teste**. Se algum falhar, o
comportamento mudou — é defeito, não teste velho.

- [ ] **Passo 7: commit**

```bash
git add src/compartilhado/relatorios/exportar.js src/compartilhado/relatorios/exportar.test.mjs src/ferramentas/patrimonio/planilha-e-resumo.js
git diff --cached --stat
git commit -m "Relatórios: a matriz do Excel serve a qualquer lista de colunas"
```

---

## Task 2: O recorte por marca e local

**Arquivos:**
- Criar: `src/compartilhado/relatorios/recorte.js`
- Criar: `src/compartilhado/relatorios/recorte.test.mjs`

**Interfaces:**
- Consome: `SEM_MARCA`, `SEM_LOCAL`, `montarArvore`, `listarLocais` de `src/compartilhado/arvore-de-locais.js`.
- Produz: `RECORTE_VAZIO = { modo: 'tudo', empresaId: '', localId: '' }`
- Produz: `filtrarPorRecorte(linhas, recorte, pegarIds) -> linhas[]` — `pegarIds(linha)` devolve `{ empresaId, localId }` (qualquer um pode ser `null`).
- Produz: `rotuloDoRecorte(recorte, { empresas, locais }) -> string` — "Tudo", "Vessel", "Vessel › Fábrica Conchal", "Sem marca".
- Produz: `contarForaDoRecorte(linhas, pegarIds) -> { semMarca: number, semLocal: number }`
- Produz: `opcoesDeLocal(arvore) -> [{ id, rotulo }]` — rótulo SEMPRE com a marca na frente.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/compartilhado/relatorios/recorte.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarArvore } from '../arvore-de-locais.js'
import {
  RECORTE_VAZIO, filtrarPorRecorte, rotuloDoRecorte, contarForaDoRecorte, opcoesDeLocal,
} from './recorte.js'

// Duas "Fábrica Conchal" de marcas diferentes — o caso real medido no banco
// em 10/08/2026: Vessel tem 148 bens ali e RB Builders tem 2.
const EMPRESAS = [{ id: 'e1', nome: 'Vessel' }, { id: 'e2', nome: 'RB Builders' }]
const LOCAIS = [
  { id: 'l1', nome: 'Fábrica Conchal', empresa_id: 'e1' },
  { id: 'l2', nome: 'Fábrica Conchal', empresa_id: 'e2' },
]
const ARVORE = montarArvore({ empresas: EMPRESAS, locais: LOCAIS, comodos: [] })

const LINHAS = [
  { id: 'a', empresa_id: 'e1', local_id: 'l1' },
  { id: 'b', empresa_id: 'e2', local_id: 'l2' },
  { id: 'c', empresa_id: 'e1', local_id: null },
  { id: 'd', empresa_id: null, local_id: null },
]
const pegarIds = (l) => ({ empresaId: l.empresa_id, localId: l.local_id })
const ids = (ls) => ls.map((l) => l.id)

test('"tudo" não tira ninguém, nem quem está sem marca', () => {
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, RECORTE_VAZIO, pegarIds)), ['a', 'b', 'c', 'd'])
})

test('recorte por marca pega a marca inteira, inclusive quem está sem local', () => {
  const r = { modo: 'marca', empresaId: 'e1', localId: '' }
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, r, pegarIds)), ['a', 'c'])
})

test('recorte por local pega SÓ aquele local, e não o homônimo da outra marca', () => {
  const r = { modo: 'local', empresaId: 'e1', localId: 'l1' }
  assert.deepEqual(ids(filtrarPorRecorte(LINHAS, r, pegarIds)), ['a'])
})

test('o rótulo do local traz a marca na frente — senão não identifica nada', () => {
  const opcoes = opcoesDeLocal(ARVORE)
  assert.deepEqual(opcoes.map((o) => o.rotulo), [
    'Vessel › Fábrica Conchal',
    'RB Builders › Fábrica Conchal',
  ])
})

test('o rótulo do recorte diz por extenso o que foi escolhido', () => {
  const ctx = { empresas: EMPRESAS, locais: LOCAIS }
  assert.equal(rotuloDoRecorte(RECORTE_VAZIO, ctx), 'Tudo')
  assert.equal(rotuloDoRecorte({ modo: 'marca', empresaId: 'e2' }, ctx), 'RB Builders')
  assert.equal(rotuloDoRecorte({ modo: 'local', empresaId: 'e1', localId: 'l1' }, ctx),
    'Vessel › Fábrica Conchal')
})

test('conta quantos ficaram sem marca e sem local — para a tela avisar', () => {
  // O caso que motivou isto: os 10 veículos da Frota estão TODOS sem marca.
  // Uma tabela que some com linhas caladas é como relatório vira mentira.
  assert.deepEqual(contarForaDoRecorte(LINHAS, pegarIds), { semMarca: 1, semLocal: 2 })
})

test('recorte apontando para id que não existe devolve vazio, não devolve tudo', () => {
  // Falhar para o lado de "não achei" é honesto; devolver a base inteira quando
  // o filtro não casa entrega o relatório errado sem ninguém desconfiar.
  const r = { modo: 'local', empresaId: 'e1', localId: 'nao-existe' }
  assert.deepEqual(filtrarPorRecorte(LINHAS, r, pegarIds), [])
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/compartilhado/relatorios/recorte.test.mjs`
Esperado: FALHA — `Cannot find module './recorte.js'`

- [ ] **Passo 3: escrever o mínimo que faz passar**

Criar `src/compartilhado/relatorios/recorte.js`:

```js
// O recorte dos relatórios: tudo, uma marca inteira, ou um local só.
//
// POR QUE O LOCAL NUNCA APARECE SOZINHO NA LISTA
// ----------------------------------------------
// Medido no banco em 10/08/2026: "Fábrica Conchal" existe em DUAS marcas
// (Vessel, 148 bens; RB Builders, 2) e "Sede Limeira" também (RBV Company, 40;
// Vessel, 10). A migration 034 já tinha escrito o motivo: "o defeito real é a
// tela mostrar 'Fábrica Conchal' duas vezes sem dizer de quem é — quem escolhe
// não tem como acertar". Um relatório com o recorte errado é pior que nenhum,
// porque ninguém desconfia dele.

import { listarLocais } from '../arvore-de-locais.js'

export const RECORTE_VAZIO = { modo: 'tudo', empresaId: '', localId: '' }

/** Só as linhas do recorte escolhido. `pegarIds` diz onde, NAQUELA linha, moram
 * a marca e o local — cada relatório guarda isso num campo diferente. */
export function filtrarPorRecorte(linhas, recorte, pegarIds) {
  const lista = (linhas || []).filter(Boolean)
  const r = recorte || RECORTE_VAZIO
  if (r.modo === 'marca' && r.empresaId) {
    return lista.filter((l) => pegarIds(l).empresaId === r.empresaId)
  }
  if (r.modo === 'local' && r.localId) {
    return lista.filter((l) => pegarIds(l).localId === r.localId)
  }
  // 'tudo', ou escolha pela metade: devolve tudo. Nunca esconde linha.
  return lista
}

/** Quantos ficaram fora de qualquer recorte. É o número que a tela precisa
 * mostrar para a pessoa não achar que sumiu dado. */
export function contarForaDoRecorte(linhas, pegarIds) {
  const lista = (linhas || []).filter(Boolean)
  let semMarca = 0
  let semLocal = 0
  for (const l of lista) {
    const { empresaId, localId } = pegarIds(l)
    if (!empresaId) semMarca++
    if (!localId) semLocal++
  }
  return { semMarca, semLocal }
}

/** Os locais para o seletor, com a marca SEMPRE na frente. */
export function opcoesDeLocal(arvore) {
  return listarLocais(arvore).map((l) => ({
    id: l.id,
    rotulo: [l.empresaNome, l.nome].filter(Boolean).join(' › '),
  }))
}

/** O recorte escrito por extenso, para o cabeçalho da folha e da tela. */
export function rotuloDoRecorte(recorte, { empresas, locais } = {}) {
  const r = recorte || RECORTE_VAZIO
  const nomeEmpresa = (id) => (empresas || []).find((e) => e.id === id)?.nome || 'Sem marca'
  const nomeLocal = (id) => (locais || []).find((l) => l.id === id)?.nome || 'Sem local'
  if (r.modo === 'marca' && r.empresaId) return nomeEmpresa(r.empresaId)
  if (r.modo === 'local' && r.localId) {
    const loc = (locais || []).find((l) => l.id === r.localId)
    return [nomeEmpresa(loc?.empresa_id), nomeLocal(r.localId)].filter(Boolean).join(' › ')
  }
  return 'Tudo'
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/compartilhado/relatorios/recorte.test.mjs`
Esperado: 7 testes passando. Se `opcoesDeLocal` falhar, conferir o nome do campo
que `montarArvore` devolve para a marca do local (`empresaNome`) lendo
`src/compartilhado/arvore-de-locais.js` — não adivinhar.

- [ ] **Passo 5: commit**

```bash
git add src/compartilhado/relatorios/recorte.js src/compartilhado/relatorios/recorte.test.mjs
git diff --cached --stat
git commit -m "Relatórios: recorte por marca ou local, com o homônimo desfeito pela marca"
```

---

## Task 3: O catálogo do Patrimônio — o relatório "Bens"

Um relatório só, para a casca da Task 4 ter o que mostrar. Os outros três vêm
depois, um por tarefa.

**Arquivos:**
- Criar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.js`
- Criar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

**Interfaces:**
- Consome: `COLUNAS_PLANILHA` de `./planilha-e-resumo.js`.
- Produz: `RELATORIOS_DO_PATRIMONIO -> Array<Relatorio>`, onde `Relatorio` é:
  ```
  {
    chave: string,            // 'bens'
    titulo: string,           // 'Bens'
    explicacao: string,       // uma frase, aparece embaixo do título
    periodo: boolean,         // pede data de/até?
    colunas: [{ chave, titulo, tipo }],
    pegarIds: (linha) => ({ empresaId, localId }),
    montar: (ctx) => Promise<linhas[]>,
  }
  ```
  e `ctx` é `{ sbClient, linhasAchatadas, de, ate }`.
- Produz: `acharRelatorio(chave) -> Relatorio | null`

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RELATORIOS_DO_PATRIMONIO, acharRelatorio } from './relatorios-do-patrimonio.js'
import { COLUNAS_PLANILHA } from './planilha-e-resumo.js'

test('todo relatório declara o que a casca precisa, sem faltar campo', () => {
  for (const r of RELATORIOS_DO_PATRIMONIO) {
    assert.ok(r.chave, 'relatório sem chave')
    assert.ok(r.titulo, `${r.chave} sem título`)
    assert.ok(r.explicacao, `${r.chave} sem explicação`)
    assert.equal(typeof r.periodo, 'boolean', `${r.chave} não diz se pede período`)
    assert.ok(Array.isArray(r.colunas) && r.colunas.length, `${r.chave} sem colunas`)
    assert.equal(typeof r.pegarIds, 'function', `${r.chave} não sabe achar marca/local`)
    assert.equal(typeof r.montar, 'function', `${r.chave} não sabe buscar linhas`)
  }
})

test('as chaves não se repetem — chave repetida some com um relatório da tela', () => {
  const chaves = RELATORIOS_DO_PATRIMONIO.map((r) => r.chave)
  assert.equal(new Set(chaves).size, chaves.length)
})

test('"Bens" usa as MESMAS colunas da Planilha, sem uma segunda lista', () => {
  const bens = acharRelatorio('bens')
  assert.equal(bens.colunas, COLUNAS_PLANILHA)
})

test('"Bens" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorio('bens').periodo, false)
})

test('"Bens" monta a partir do que a tela já carregou, sem ir ao banco de novo', async () => {
  const linhasAchatadas = [{ id: 'a', nome: 'Mesa', _bem: { empresa_id: 'e1', local_id: 'l1' } }]
  const linhas = await acharRelatorio('bens').montar({ linhasAchatadas })
  assert.deepEqual(linhas, linhasAchatadas)
})

test('"Bens" acha marca e local no bem cru, e não na linha achatada', () => {
  // A linha achatada guarda o NOME ("Vessel"), não o id. Recortar por nome
  // quebraria justamente nas duas "Fábrica Conchal".
  const linha = { empresa: 'Vessel', local: 'Fábrica Conchal', _bem: { empresa_id: 'e1', local_id: 'l1' } }
  assert.deepEqual(acharRelatorio('bens').pegarIds(linha), { empresaId: 'e1', localId: 'l1' })
})

test('acharRelatorio devolve null para chave que não existe', () => {
  assert.equal(acharRelatorio('nao-existe'), null)
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
Esperado: FALHA — módulo não encontrado.

- [ ] **Passo 3: escrever o mínimo que faz passar**

Criar `src/ferramentas/patrimonio/relatorios-do-patrimonio.js`:

```js
// O catálogo dos relatórios do Patrimônio. A casca (aba-de-relatorios.vue) não
// sabe nada sobre patrimônio: tudo o que ela precisa está declarado aqui.
//
// Cada relatório declara suas colunas UMA VEZ, e essa mesma lista desenha a
// tabela na tela, monta o Excel e monta a folha de impressão. É o que impede as
// três saídas de discordarem entre si — a mesma razão pela qual COLUNAS_PLANILHA
// já existe.

import { COLUNAS_PLANILHA } from './planilha-e-resumo.js'

// A linha achatada guarda o NOME da marca e do local ("Vessel", "Fábrica
// Conchal"), não o id. Recortar por nome quebraria justamente nos homônimos —
// existem duas "Fábrica Conchal". Por isso o id sai sempre do bem cru.
const idsDoBemAchatado = (linha) => ({
  empresaId: linha?._bem?.empresa_id || null,
  localId: linha?._bem?.local_id || null,
})

export const RELATORIOS_DO_PATRIMONIO = [
  {
    chave: 'bens',
    titulo: 'Bens',
    explicacao: 'Tudo que está cadastrado, item por item, com valor e onde está.',
    periodo: false,
    colunas: COLUNAS_PLANILHA,
    pegarIds: idsDoBemAchatado,
    // A tela já carregou e já achatou os bens. Buscar de novo seria pagar duas
    // vezes pela mesma consulta e abrir espaço para as duas divergirem.
    montar: async ({ linhasAchatadas }) => linhasAchatadas || [],
  },
]

export function acharRelatorio(chave) {
  return RELATORIOS_DO_PATRIMONIO.find((r) => r.chave === chave) || null
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
Esperado: 7 testes passando.

- [ ] **Passo 5: commit**

```bash
git add src/ferramentas/patrimonio/relatorios-do-patrimonio.js src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs
git diff --cached --stat
git commit -m "Relatórios do Patrimônio: o catálogo, começando por Bens"
```

---

## Task 4: A casca, a folha de impressão e a permissão — a aba abre pela primeira vez

Esta é a tarefa que faz a coisa existir na tela. Ela junta o que as três
anteriores construíram e mostra o relatório "Bens" funcionando de ponta a ponta.

**Arquivos:**
- Criar: `src/compartilhado/relatorios/folha.css`
- Criar: `src/compartilhado/relatorios/aba-de-relatorios.vue`
- Modificar: `src/compartilhado/controle-de-login-e-usuario.js` (a lista `RECURSOS`, linhas 85-110)
- Modificar: `src/ferramentas/patrimonio/tela-de-patrimonio.vue` (a barra de abas na linha ~44 e a cadeia `v-if` do `.pat-body`)

**Interfaces:**
- Consome: `matrizParaExcel`, `baixarExcel` (Task 1); `RECORTE_VAZIO`, `filtrarPorRecorte`, `rotuloDoRecorte`, `contarForaDoRecorte`, `opcoesDeLocal` (Task 2); `RELATORIOS_DO_PATRIMONIO` (Task 3); `montarArvore` de `compartilhado/arvore-de-locais.js`.
- Produz: componente `<aba-de-relatorios>` com props:
  - `relatorios: Array<Relatorio>` (o catálogo)
  - `contexto: Object` (vai inteiro para `montar()`, mais `de` e `ate`)
  - `empresas: Array`, `locais: Array`, `comodos: Array`
  - `nomeDoArquivo: String` (ex.: `'patrimonio'`)
  - `podeExportar: Boolean`

- [ ] **Passo 1: a chave de permissão**

Em `src/compartilhado/controle-de-login-e-usuario.js`, dentro de `RECURSOS`,
**logo abaixo** da linha de `patrimonio`:

```js
  { key: 'patrimonio.relatorios', label: 'Patrimônio — Relatórios', acoes: ['ver', 'exportar'] },
```

Chave própria, e não ação nova: `ACOES_MATRIZ` é fixa em 5 colunas — o próprio
código explica isso no comentário de `conteudo.aprovar`. O formato copia
`social.relatorio` e `gestor.relatorios`, que já existem.

**Nenhuma migration concede esta permissão a ninguém.** Ela nasce desmarcada
para todo mundo, inclusive para o dono; quem libera é o Config de Admin.

- [ ] **Passo 2: a folha de impressão**

Criar `src/compartilhado/relatorios/folha.css`:

```css
/* A folha impressa dos relatórios.
 *
 * Truque de visibilidade em vez de display:none no que está fora: num SPA tudo
 * mora dentro de #app, e esconder os pais esconderia a folha junto. Com
 * visibility, o pai fica invisível e o filho pode voltar a aparecer.
 *
 * A classe entra no <body> só durante a impressão, e sai no onafterprint. */

@media print {
  body.imprimindo-relatorio * { visibility: hidden; }
  body.imprimindo-relatorio .folha-de-impressao,
  body.imprimindo-relatorio .folha-de-impressao * { visibility: visible; }

  body.imprimindo-relatorio .folha-de-impressao {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
  }

  /* Sem isto, da página 2 em diante ninguém sabe qual coluna é qual. */
  .folha-de-impressao thead { display: table-header-group; }
  .folha-de-impressao tr { break-inside: avoid; }

  /* Impressão é papel: fundo colorido gasta tinta e some no preto e branco. */
  .folha-de-impressao table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .folha-de-impressao th,
  .folha-de-impressao td { border: 1px solid #999; padding: 3pt 4pt; text-align: left; }
}

/* Fora da impressão a folha não existe na tela — a prévia é a tabela normal. */
.folha-de-impressao { display: none; }
@media print { body.imprimindo-relatorio .folha-de-impressao { display: block; } }
```

> O `#999` da borda é o único hex, e é regra **de papel**, não de tela: token de
> cor do tema não vale para impressão em preto e branco. Se o teste do padrão
> reprovar, acrescente a exceção no teste **com este motivo escrito ao lado** —
> o `PADRAO-DA-CENTRAL.md` manda registrar a exceção, nunca contornar calado.

- [ ] **Passo 3: a casca**

Criar `src/compartilhado/relatorios/aba-de-relatorios.vue`. A casca não sabe
nada sobre Patrimônio ou Frota — ela só lê o catálogo que recebe.

Estrutura obrigatória do `<template>`, nesta ordem:

1. `<div class="rel-passo">` — **passo 1**, os botões dos relatórios
   (`v-for` no `props.relatorios`, classe `.btn` e `.btn.btn-principal` no escolhido).
2. `<div class="rel-passo">` — **passo 2**, o recorte: três `<label>` com
   `<input type="radio">` (Tudo / Uma marca / Um local), mais o `<select>` de
   marca (aparece só no modo `marca` e `local`) e o `<select>` de local
   (`opcoesDeLocal`, só no modo `local`).
3. `<div class="rel-passo" v-if="relatorioAtual?.periodo">` — **passo 3**, dois
   `<input type="date">`. Começam nos últimos 30 dias.
4. `<p class="rel-conta">` — "N linhas · {{ rotuloDoRecorte(...) }}" e, quando
   houver, o aviso do que ficou fora: *"3 bens ainda estão sem marca apontada —
   eles só aparecem em Tudo."*
5. A tabela da prévia, montada a partir de `relatorioAtual.colunas`.
6. `<div class="rel-acoes">` — `<button class="btn">Excel</button>` e
   `<button class="btn btn-principal">PDF</button>`, ambos `:disabled="!podeExportar || !linhas.length"`.
7. `<div class="folha-de-impressao">` — o cabeçalho (título, recorte por
   extenso, período, data de emissão) e a mesma tabela.

No `<script setup>`, os pontos que não podem ser inventados de outro jeito:

```js
import { computed, ref, watch } from 'vue'
import { montarArvore } from '../arvore-de-locais.js'
import { baixarExcel } from './exportar.js'
import {
  RECORTE_VAZIO, filtrarPorRecorte, rotuloDoRecorte, contarForaDoRecorte, opcoesDeLocal,
} from './recorte.js'
import { hojeLocal } from '../datas.js'
import './folha.css'

const props = defineProps({
  relatorios: { type: Array, required: true },
  contexto: { type: Object, default: () => ({}) },
  empresas: { type: Array, default: () => [] },
  locais: { type: Array, default: () => [] },
  comodos: { type: Array, default: () => [] },
  nomeDoArquivo: { type: String, default: 'relatorio' },
  podeExportar: { type: Boolean, default: false },
})

const escolhido = ref(props.relatorios[0]?.chave || '')
const recorte = ref({ ...RECORTE_VAZIO })
const linhasCruas = ref([])
const carregando = ref(false)
const erro = ref('')

// Período começa nos últimos 30 dias. `hojeLocal()` devolve 'AAAA-MM-DD' no
// fuso de quem está olhando — usar `new Date().toISOString()` traria o dia
// errado depois das 21h no Brasil, que é exatamente quando ninguém confere.
const ate = ref(hojeLocal())
const de = ref(trintaDiasAtras(hojeLocal()))

function trintaDiasAtras(iso) {
  const [a, m, d] = String(iso).split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 30)
  return dt.toISOString().slice(0, 10)
}

const relatorioAtual = computed(() =>
  props.relatorios.find((r) => r.chave === escolhido.value) || null)

const arvore = computed(() => montarArvore({
  empresas: props.empresas, locais: props.locais, comodos: props.comodos,
}))
const locaisParaEscolher = computed(() => opcoesDeLocal(arvore.value))

const linhas = computed(() => {
  const r = relatorioAtual.value
  if (!r) return []
  return filtrarPorRecorte(linhasCruas.value, recorte.value, r.pegarIds)
})

const fora = computed(() => {
  const r = relatorioAtual.value
  if (!r) return { semMarca: 0, semLocal: 0 }
  return contarForaDoRecorte(linhasCruas.value, r.pegarIds)
})

// O recorte por extenso, para o topo da tela E para o cabeçalho da folha —
// a mesma frase nos dois, senão o papel diz uma coisa e a tela diz outra.
const recorteEscrito = computed(() =>
  rotuloDoRecorte(recorte.value, { empresas: props.empresas, locais: props.locais }))
```

E a tabela da prévia, que é a mesma marcação usada dentro da folha — montada a
partir das colunas declaradas, nunca de uma segunda lista escrita à mão:

```html
<table class="rel-tabela">
  <thead>
    <tr>
      <th v-for="col in relatorioAtual.colunas" :key="col.chave"
          :class="{ num: col.tipo !== 'texto' }">{{ col.titulo }}</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="(l, i) in linhas" :key="l.id || i">
      <td v-for="col in relatorioAtual.colunas" :key="col.chave"
          :class="{ num: col.tipo !== 'texto' }">{{ celula(l, col) }}</td>
    </tr>
  </tbody>
</table>
```

```js
// Dinheiro na TELA é texto em reais; no Excel é número (matrizParaExcel cuida
// disso). São saídas diferentes do mesmo dado, de propósito.
function celula(linha, col) {
  const v = linha?.[col.chave]
  if (col.tipo === 'dinheiro') {
    return typeof v === 'number'
      ? (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'
  }
  return v === null || v === undefined || v === '' ? '—' : v
}
```

Carregar as linhas quando muda o relatório ou o período — e **`immediate: true`**,
porque `onMounted` lendo estado que ainda não chegou é armadilha conhecida deste
projeto:

O `recorte` entra na lista do `watch` e vai dentro do `ctx`: há relatório que
precisa saber o recorte para se montar — o Resumo agrupa por marca quando é
"Tudo" e por local quando uma marca foi escolhida.

```js
watch([relatorioAtual, de, ate, recorte], async () => {
  const r = relatorioAtual.value
  if (!r) return
  carregando.value = true
  erro.value = ''
  try {
    linhasCruas.value = await r.montar({
      ...props.contexto, de: de.value, ate: ate.value, recorte: recorte.value,
    })
  } catch (e) {
    // Falhar VISÍVEL. Lista vazia sem aviso é o defeito que se esconde melhor:
    // parece "não tem nada", quando é "não consegui buscar".
    erro.value = e?.message || 'Não consegui montar este relatório.'
    linhasCruas.value = []
  } finally {
    carregando.value = false
  }
}, { immediate: true })
```

A impressão, com a classe indo e voltando do `<body>`:

```js
function imprimir() {
  document.body.classList.add('imprimindo-relatorio')
  const limpar = () => {
    document.body.classList.remove('imprimindo-relatorio')
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  window.print()
  // Safari no iPhone nem sempre dispara afterprint. Sem esta rede, o sistema
  // fica invisível na tela até recarregar a página.
  setTimeout(limpar, 3000)
}

function exportarExcel() {
  const r = relatorioAtual.value
  const nome = `${props.nomeDoArquivo}-${r.chave}-${hojeLocal()}.xlsx`
  const res = baixarExcel({
    colunas: r.colunas, linhas: linhas.value, nomeAba: r.titulo, nomeArquivo: nome,
  })
  if (!res.ok) erro.value = res.motivo
}
```

- [ ] **Passo 4: ligar na tela do Patrimônio**

Em `src/ferramentas/patrimonio/tela-de-patrimonio.vue`:

1. Importar o componente, o catálogo e `hasPermission` (já importado).
2. Na barra de abas (linha ~44), acrescentar como **última** aba, gateada:

```html
<button role="tab" v-if="podeRelatorios" :class="{ on: visao === 'relatorios' }"
        @click="visao = 'relatorios'">Relatórios</button>
```

3. **ATENÇÃO — a cadeia `v-if` do `.pat-body`.** O bloco novo entra como mais um
   `v-else-if`, **antes** do `v-else` final (que é o Resumo). Um `v-if` solto no
   meio da cadeia a parte em duas, e a lista some quando não devia — está escrito
   no comentário da linha 104 do próprio arquivo, porque **já aconteceu**.

4. O vazio de filtro (linha ~136) precisa ignorar a aba nova, como já ignora
   Resumo e Etiquetas:

```html
v-else-if="!bensFiltrados.length && visao !== 'resumo' && visao !== 'etiquetas' && visao !== 'relatorios'"
```

5. No `<script setup>`:

```js
const podeRelatorios = computed(() => hasPermission('patrimonio.relatorios', 'ver'))
const podeExportarRelatorio = computed(() => hasPermission('patrimonio.relatorios', 'exportar'))
```

- [ ] **Passo 5: provar que compila e que nada quebrou**

```bash
npm test
npm run build
```

Esperado: tudo verde. O `todo-vue-compila.test.mjs` é o que pega `.vue` que não
compila — `node --test` sozinho não compilaria o arquivo novo.

- [ ] **Passo 6: abrir no navegador — sem isto a tarefa NÃO está pronta**

```bash
npm run dev -- --port 5199 --strictPort
```

Conferir, com a permissão liberada para você no Config de Admin:
- a aba Relatórios aparece, e **some** para quem não tem a permissão;
- escolher "Bens" traz as 350 linhas;
- escolher a marca Vessel traz menos, e o cabeçalho diz "Vessel";
- escolher "Fábrica Conchal (Vessel)" traz 148 e **não** traz os 2 da RB Builders;
- o aviso de "sem marca" aparece com os 2 bens que estão sem;
- o Excel abre e a coluna Valor **soma** dentro do Excel;
- o PDF sai com cabeçalho, e o resto do sistema **não** aparece na folha;
- **a 375px e a 1440px**, e no tema escuro.

- [ ] **Passo 7: commit**

```bash
git add src/compartilhado/relatorios/folha.css src/compartilhado/relatorios/aba-de-relatorios.vue src/compartilhado/controle-de-login-e-usuario.js src/ferramentas/patrimonio/tela-de-patrimonio.vue
git diff --cached --stat
git commit -m "Patrimônio: aba Relatórios, com recorte por marca ou local, Excel e PDF"
```

---

## Task 5: Relatório "Com quem está cada bem"

**Arquivos:**
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.js`
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

**Interfaces:**
- Consome: `ctx.sbClient` (o cliente do Supabase) e `ctx.linhasAchatadas`.
- Produz: mais um item em `RELATORIOS_DO_PATRIMONIO`, chave `'com-quem'`.

Tabela: `patrimonio_posse` — colunas reais `id, bem_id, pessoa_id, pessoa_nome,
de, ate, motivo, criado_em`. **`ate` nulo = ainda é o dono.**

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar em `relatorios-do-patrimonio.test.mjs`:

```js
test('"Com quem está" é retrato de agora: não pede período', () => {
  assert.equal(acharRelatorio('com-quem').periodo, false)
})

test('"Com quem está" traz só a posse ABERTA, e casa com o bem', async () => {
  const sbClient = bancoFalso([
    { bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-01-10', ate: null, motivo: 'uso' },
  ])
  const linhasAchatadas = [
    { id: 'b1', numero: 7, nome: 'Notebook', categoria: 'TI', empresa: 'Vessel',
      local: 'Sede', valor_centavos: 500000, _bem: { empresa_id: 'e1', local_id: 'l1' } },
  ]
  const linhas = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas })
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].pessoa, 'Ana')
  assert.equal(linhas[0].nome, 'Notebook')
  assert.equal(linhas[0].desde, '2026-01-10')
})

test('"Com quem está" ignora posse de bem que não existe mais, sem estourar', async () => {
  const sbClient = bancoFalso([{ bem_id: 'sumiu', pessoa_nome: 'Ana', de: '2026-01-10', ate: null }])
  const linhas = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas: [] })
  assert.deepEqual(linhas, [])
})

test('"Com quem está" recorta pelo bem, não pela pessoa', async () => {
  const sbClient = bancoFalso([{ bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-01-10', ate: null }])
  const linhasAchatadas = [{ id: 'b1', nome: 'Notebook', _bem: { empresa_id: 'e9', local_id: 'l9' } }]
  const [linha] = await acharRelatorio('com-quem').montar({ sbClient, linhasAchatadas })
  assert.deepEqual(acharRelatorio('com-quem').pegarIds(linha), { empresaId: 'e9', localId: 'l9' })
})
```

E, no topo do arquivo de teste, o dublê do banco:

```js
// Dublê do supabase-js: só o encadeamento que este catálogo usa.
// Testar contra o banco de verdade tornaria o teste dependente de dado real, e
// este projeto já tem regra escrita de não mexer em dado real para testar.
function bancoFalso(linhas, erro = null) {
  const resposta = Promise.resolve({ data: linhas, error: erro })
  const encadeia = {
    select: () => encadeia,
    is: () => encadeia,
    gte: () => encadeia,
    lte: () => encadeia,
    order: () => resposta,
    then: (...a) => resposta.then(...a),
  }
  return { from: () => encadeia }
}
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
Esperado: FALHA — `acharRelatorio('com-quem')` devolve `null`.

- [ ] **Passo 3: implementar**

Acrescentar ao array `RELATORIOS_DO_PATRIMONIO`:

```js
  {
    chave: 'com-quem',
    titulo: 'Com quem está cada bem',
    explicacao: 'O que está na mão de cada pessoa hoje. É o relatório de "fulano saiu, o que precisa voltar".',
    periodo: false,
    colunas: [
      { chave: 'pessoa', titulo: 'Pessoa', tipo: 'texto' },
      { chave: 'numero', titulo: 'Nº', tipo: 'numero' },
      { chave: 'nome', titulo: 'Item', tipo: 'texto' },
      { chave: 'categoria', titulo: 'Categoria', tipo: 'texto' },
      { chave: 'empresa', titulo: 'Marca', tipo: 'texto' },
      { chave: 'local', titulo: 'Local', tipo: 'texto' },
      { chave: 'desde', titulo: 'Desde', tipo: 'texto' },
      { chave: 'motivo', titulo: 'Motivo', tipo: 'texto' },
      { chave: 'valor_centavos', titulo: 'Valor', tipo: 'dinheiro' },
    ],
    pegarIds: idsDoBemAchatado,
    montar: async ({ sbClient, linhasAchatadas }) => {
      // `ate is null` é o que define "ainda está com a pessoa" — a coluna nasceu
      // assim na migration, e conferir por data daria resposta diferente.
      const { data, error } = await sbClient
        .from('patrimonio_posse').select('*').is('ate', null).order('de', { ascending: false })
      if (error) throw new Error(error.message)
      const porId = new Map((linhasAchatadas || []).map((l) => [l.id, l]))
      return (data || []).flatMap((p) => {
        const bem = porId.get(p.bem_id)
        // Posse de bem apagado não vira linha meia-boca: sem o bem não há
        // número, item nem valor, e a linha só confundiria quem lê.
        if (!bem) return []
        return [{ ...bem, pessoa: p.pessoa_nome || 'Não informada', desde: p.de, motivo: p.motivo || '' }]
      })
    },
  },
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
Esperado: todos passando.

- [ ] **Passo 5: conferir no navegador**

A aba precisa mostrar o relatório novo, e o recorte por marca precisa continuar
funcionando nele. Comparar a contagem com a aba Navegar.

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/patrimonio/relatorios-do-patrimonio.js src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs
git diff --cached --stat
git commit -m "Relatórios: com quem está cada bem hoje"
```

---

## Task 6: Relatório "Histórico de movimentação" — o primeiro com período

**Arquivos:**
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.js`
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

- [ ] **Passo 1: escrever o teste que falha**

```js
test('"Histórico" pede período', () => {
  assert.equal(acharRelatorio('historico').periodo, true)
})

test('"Histórico" pergunta ao banco pelo período recebido, e não traz a base toda', async () => {
  const pedidos = []
  const sbClient = bancoEspiao(pedidos, [
    { bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-07-02', ate: '2026-07-20', motivo: 'troca' },
  ])
  const linhasAchatadas = [{ id: 'b1', numero: 7, nome: 'Notebook', _bem: {} }]
  await acharRelatorio('historico').montar({ sbClient, linhasAchatadas, de: '2026-07-01', ate: '2026-07-31' })
  assert.deepEqual(pedidos, [['gte', 'de', '2026-07-01'], ['lte', 'de', '2026-07-31']])
})

test('"Histórico" mostra "ainda está" quando a posse não fechou', async () => {
  const sbClient = bancoFalso([{ bem_id: 'b1', pessoa_nome: 'Ana', de: '2026-07-02', ate: null }])
  const linhasAchatadas = [{ id: 'b1', nome: 'Notebook', _bem: {} }]
  const [linha] = await acharRelatorio('historico').montar({ sbClient, linhasAchatadas, de: '2026-07-01', ate: '2026-07-31' })
  assert.equal(linha.ate, 'ainda está')
})
```

E o espião, ao lado do `bancoFalso`:

```js
// Igual ao bancoFalso, mas anota os filtros pedidos. Sem isto, um relatório que
// IGNORA o período passaria no teste — traria linhas, e ninguém veria que ele
// trouxe a base inteira.
function bancoEspiao(pedidos, linhas) {
  const resposta = Promise.resolve({ data: linhas, error: null })
  const encadeia = {
    select: () => encadeia,
    is: () => encadeia,
    gte: (c, v) => { pedidos.push(['gte', c, v]); return encadeia },
    lte: (c, v) => { pedidos.push(['lte', c, v]); return encadeia },
    order: () => resposta,
    then: (...a) => resposta.then(...a),
  }
  return { from: () => encadeia }
}
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
Esperado: FALHA — chave `historico` não existe.

- [ ] **Passo 3: implementar**

```js
  {
    chave: 'historico',
    titulo: 'Histórico de movimentação',
    explicacao: 'Quem pegou e quem devolveu cada bem, no período escolhido.',
    periodo: true,
    colunas: [
      { chave: 'de', titulo: 'De', tipo: 'texto' },
      { chave: 'ate', titulo: 'Até', tipo: 'texto' },
      { chave: 'numero', titulo: 'Nº', tipo: 'numero' },
      { chave: 'nome', titulo: 'Item', tipo: 'texto' },
      { chave: 'pessoa', titulo: 'Pessoa', tipo: 'texto' },
      { chave: 'motivo', titulo: 'Motivo', tipo: 'texto' },
      { chave: 'empresa', titulo: 'Marca', tipo: 'texto' },
      { chave: 'local', titulo: 'Local', tipo: 'texto' },
    ],
    pegarIds: idsDoBemAchatado,
    montar: async ({ sbClient, linhasAchatadas, de, ate }) => {
      const { data, error } = await sbClient
        .from('patrimonio_posse').select('*')
        .gte('de', de).lte('de', ate)
        .order('de', { ascending: false })
      if (error) throw new Error(error.message)
      const porId = new Map((linhasAchatadas || []).map((l) => [l.id, l]))
      return (data || []).flatMap((p) => {
        const bem = porId.get(p.bem_id)
        if (!bem) return []
        // Vazio aqui seria lido como "devolveu e não anotaram". Dizer "ainda
        // está" é a informação que a pessoa foi buscar.
        return [{ ...bem, de: p.de, ate: p.ate || 'ainda está',
          pessoa: p.pessoa_nome || 'Não informada', motivo: p.motivo || '' }]
      })
    },
  },
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

- [ ] **Passo 5: conferir no navegador que o passo 3 (período) APARECE**

Nos outros dois relatórios o campo de data não pode aparecer. Este é o único
até aqui que pede.

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/patrimonio/relatorios-do-patrimonio.js src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs
git diff --cached --stat
git commit -m "Relatórios: histórico de movimentação, por período"
```

---

## Task 7: Relatório "Resumo por marca/local" — e o guarda de import da pasta nova

**Arquivos:**
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.js`
- Modificar: `src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`
- Criar: `src/compartilhado/relatorios/imports.test.mjs`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar `RECORTE_VAZIO` aos imports do arquivo de teste:

```js
import { RECORTE_VAZIO } from '../../compartilhado/relatorios/recorte.js'
```

```js
test('"Resumo" em "Tudo" agrupa por MARCA, com total e fatia', async () => {
  const linhasAchatadas = [
    { id: 'a', empresa: 'Vessel', local: 'Conchal', valor_centavos: 30000, _bem: {} },
    { id: 'b', empresa: 'Vessel', local: 'Sede', valor_centavos: 10000, _bem: {} },
    { id: 'c', empresa: 'RB Builders', local: 'Casa RB', valor_centavos: 10000, _bem: {} },
  ]
  const linhas = await acharRelatorio('resumo').montar({ linhasAchatadas, recorte: RECORTE_VAZIO })
  assert.equal(linhas.length, 2)
  assert.equal(linhas[0].grupo, 'Vessel')
  assert.equal(linhas[0].quantidade, 2)
  assert.equal(linhas[0].total_centavos, 40000)
  assert.equal(linhas[0].fatia, '80,0%')
})

test('"Resumo" com uma marca escolhida desce um nível e agrupa por LOCAL', async () => {
  // Agrupar por marca dentro de uma marca só devolveria uma linha — inútil.
  // Escolher a marca é justamente pedir "e dentro dela, onde está?".
  const linhasAchatadas = [
    { id: 'a', empresa: 'Vessel', local: 'Fábrica Conchal', valor_centavos: 30000, _bem: { empresa_id: 'e1' } },
    { id: 'b', empresa: 'Vessel', local: 'Sede Limeira', valor_centavos: 10000, _bem: { empresa_id: 'e1' } },
  ]
  const linhas = await acharRelatorio('resumo').montar({
    linhasAchatadas, recorte: { modo: 'marca', empresaId: 'e1', localId: '' },
  })
  assert.deepEqual(linhas.map((l) => l.grupo), ['Fábrica Conchal', 'Sede Limeira'])
})

test('"Resumo" sem recorte informado não estoura, e agrupa por marca', async () => {
  const linhas = await acharRelatorio('resumo').montar({
    linhasAchatadas: [{ id: 'a', empresa: 'Vessel', valor_centavos: 100, _bem: {} }],
  })
  assert.equal(linhas[0].grupo, 'Vessel')
})

test('"Resumo" não é recortável por local — o recorte já é o próprio agrupamento', () => {
  // pegarIds devolvendo nulo faz o resumo cair sempre em "tudo", que é o certo:
  // recortar por Vessel um relatório que JÁ separa por Vessel deixaria uma linha só.
  assert.deepEqual(acharRelatorio('resumo').pegarIds({}), { empresaId: null, localId: null })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

- [ ] **Passo 3: implementar**

No topo do arquivo, acrescentar ao import existente:

```js
import { COLUNAS_PLANILHA, resumirPor } from './planilha-e-resumo.js'
```

E o relatório:

```js
  {
    chave: 'resumo',
    titulo: 'Resumo por marca/local',
    explicacao: 'Só os totais: quanto tem cada marca, cada local, cada categoria. Sem listar item por item.',
    periodo: false,
    colunas: [
      { chave: 'grupo', titulo: 'Grupo', tipo: 'texto' },
      { chave: 'quantidade', titulo: 'Itens', tipo: 'numero' },
      { chave: 'total_centavos', titulo: 'Valor total', tipo: 'dinheiro' },
      { chave: 'fatia', titulo: '% do total', tipo: 'texto' },
    ],
    // Este relatório JÁ é a separação por marca/local, e ele mesmo desce um
    // nível conforme o recorte (ver `montar`). Deixar o filtro genérico cortar
    // por cima disso tiraria linhas duas vezes.
    pegarIds: () => ({ empresaId: null, localId: null }),
    montar: async ({ linhasAchatadas, recorte }) => {
      // Em "Tudo", a pergunta é "quanto tem cada marca?". Escolhida uma marca,
      // a pergunta vira "e dentro dela, onde está?" — agrupar por marca aí
      // devolveria uma linha só.
      const soUmaMarca = recorte?.modo === 'marca' && recorte?.empresaId
      const chave = soUmaMarca ? 'local' : 'empresa'
      const daMarca = soUmaMarca
        ? (linhasAchatadas || []).filter((l) => l?._bem?.empresa_id === recorte.empresaId)
        : (linhasAchatadas || [])
      return resumirPor(daMarca, (l) => l[chave]).map((g) => ({
        grupo: g.chave,
        quantidade: g.quantidade,
        total_centavos: g.totalCentavos,
        fatia: (g.fatia * 100).toFixed(1).replace('.', ',') + '%',
      }))
    },
  },
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs`

- [ ] **Passo 5: o guarda de import da pasta nova**

Criar `src/compartilhado/relatorios/imports.test.mjs`, copiando o de
`src/ferramentas/patrimonio/imports.test.mjs` e trocando:
- `tela-de-patrimonio.vue` por `aba-de-relatorios.vue`;
- o comentário do cabeçalho, explicando que a pasta nasce com o guarda porque
  o mesmo defeito já derrubou três telas (Gestão de Tráfego 29/07, Admin 05/08,
  Patrimônio 10/08).

- [ ] **Passo 6: a suíte inteira e o build**

```bash
npm test
npm run build
```

- [ ] **Passo 7: commit**

```bash
git add src/ferramentas/patrimonio/relatorios-do-patrimonio.js src/ferramentas/patrimonio/relatorios-do-patrimonio.test.mjs src/compartilhado/relatorios/imports.test.mjs
git diff --cached --stat
git commit -m "Relatórios: resumo por marca/local, e o guarda de import da pasta nova"
```

---

## Task 8: Conferência final e entrega

Nada de código novo. Esta tarefa existe porque, neste projeto, "teste verde" já
foi confundido com "tela que abre" mais de uma vez.

- [ ] **Passo 1: a lista do PADRAO-DA-CENTRAL, item 10**

- [ ] `npm test` inteiro passando
- [ ] `npm run build` sem erro
- [ ] Aberto no navegador **a 375px E a 1440px**
- [ ] Nenhum hex de cor novo (fora o `#999` da folha, com o motivo escrito)
- [ ] Nenhum `style=` solto em botão
- [ ] Tema escuro conferido
- [ ] Nada do que existia antes se perdeu — as abas Navegar, Planilha, Resumo e
      Etiquetas continuam abrindo

- [ ] **Passo 2: imprimir de verdade, duas vezes**

Um relatório curto (Resumo, 4 linhas) e um que vire várias páginas (Bens, 350).
Conferir no segundo que o **cabeçalho da tabela repete** na página 2, e que o
resto do sistema não aparece na folha.

- [ ] **Passo 3: conferir a permissão nos dois modelos**

Este projeto tem `permissions{}` e `features[]` vivos ao mesmo tempo, e só
`is_superadmin` fura (admin **não** fura). Conferir que a aba:
- aparece para quem recebeu `patrimonio.relatorios` no Config de Admin;
- **não** aparece para quem não recebeu.

- [ ] **Passo 4: subir**

```bash
git push origin main
```

Push na main builda sozinho. Conferir o deploy pelos checks do commit
(`gh api repos/brenoov/social-dashboard/commits/<sha>/check-runs`) — o MCP da
Vercel devolve 403 neste projeto, e o check "Supabase Preview" vermelho é ruído
conhecido.

- [ ] **Passo 5: atualizar o desenho**

Marcar no `2026-08-10-relatorios-frota-patrimonio-design.md` que a Etapa 1 está
no ar, e deixar a Etapa 2 (Frota) apontada como bloqueada pelos 10 veículos sem
marca e local (§9 do desenho).
