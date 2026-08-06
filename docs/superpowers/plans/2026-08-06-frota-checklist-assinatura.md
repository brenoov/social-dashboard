# Frota — Assinatura do checklist (F7a): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o checklist do motorista virar documento assinado — senha conferida no instante, conteúdo com impressão digital, e cada ficha encadeada na anterior do mesmo carro, de modo que alteração retroativa não possa ser escondida.

**Architecture:** Lógica pura em `supabase/functions/_shared/assinatura.js` (com teste ao lado), porque a mesma função vai ser usada pelo front e, numa fase futura, pelo servidor. A conferência de senha é uma Edge Function própria, no molde de `invite-user`. A imutabilidade da ficha assinada é gatilho no banco, não checagem de tela.

**Tech Stack:** Vue 3 (`<script setup>`), Supabase (Postgres + RLS + Edge Functions em Deno), Web Crypto (`crypto.subtle`, existe no navegador e no Deno), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md` (D19, D19a, D19b, D20, D21, D22)

**Escopo:** só a **F7a**. O PDF e a fila do Zoho (D23) são a F7b, plano separado.

## Global Constraints

- **Português literal, sem jargão**, em todo texto que o usuário lê. Mensagem de erro diz o que FAZER.
- **Nunca chutar dado.** Campo sem resposta é nulo e a tela explica o porquê.
- **A ficha continua podendo ser preenchida sem assinatura** (D22). Falta de login ou senha errada impede a ASSINATURA, nunca o registro — o carro não pode ficar preso.
- **Comentário explica o PORQUÊ**, não o quê. É o padrão de todo arquivo deste módulo.
- **Cor e borda sempre por token** (`var(--border)`, `var(--green)`…), nunca chumbada. `--borda` NÃO EXISTE neste app. Foi o defeito que obrigou a refazer o painel inteiro.
- **Datas como texto `YYYY-MM-DD`**; instantes comparados com `Date.parse`, nunca como texto.
- **Ao terminar cada tarefa, `npm run build` E `npm test` têm que passar.** Um não substitui o outro: `node --test` não compila `.vue`.
- Migrations com `node coletor/run-acessos-sql.mjs <arquivo>`; leitura com `node coletor/consultar.mjs "<select>"`.
- Comando de teste é `node --test <arquivo>`. **NÃO usar `npx node`** — baixa um pacote sem necessidade.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/assinatura.js` | **Criar:** o texto canônico, a impressão digital, a conferência da corrente e o tempo de preenchimento |
| `supabase/functions/_shared/assinatura.test.mjs` | **Criar:** o teste do acima |
| `db/migrations/acessos/032_frota_checklist_assinatura.sql` | **Criar:** colunas da assinatura, gatilho de imutabilidade e `conferir_corrente()` |
| `supabase/functions/conferir-senha/index.ts` | **Criar:** confere a senha de quem está logado, sem trocar a sessão |
| `src/ferramentas/frota/painel-de-checklist.vue` | **Modificar:** o passo de assinar ao fim do cartão |
| `src/ferramentas/frota/tela-de-frota.vue` | **Modificar:** gravar a assinatura, e o selo + conferência na Gestão |

**Ordem:** Tarefas 1–3 são a base (lógica, banco, senha) e nada aparece na tela. Tarefa 4 é o que o motorista vê. Tarefa 5 é o que o gestor vê.

---

### Task 1: O texto canônico e a impressão digital

**Files:**
- Create: `supabase/functions/_shared/assinatura.js`
- Test: `supabase/functions/_shared/assinatura.test.mjs`

**Interfaces:**
- Consumes: nada. Módulo puro, sem rede, sem Vue, sem banco.
- Produces: `textoParaAssinar({ficha, respostas, hashAnterior}) -> string`, `impressaoDigital(texto) -> Promise<string>` (64 caracteres hexadecimais), `tempoDePreenchimento(abertaEm, assinadaEm) -> {segundos, rapidoDemais}`.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoParaAssinar, impressaoDigital, tempoDePreenchimento, SEGUNDOS_SUSPEITOS } from './assinatura.js'

const FICHA = {
  veiculo_id: 'v1', feita_em: '2026-08-06', pessoa_id: 'p1',
  hodometro: 148520, hodometro_justificativa: null,
  cadencias: ['diario'], resultado: 'liberado', anomalias: null,
  assinada_em: '2026-08-06T12:00:00.000Z',
}
const RESPOSTAS = [
  { item_texto: 'Painel — luzes de advertência', estado: 'ok', observacao: null },
  { item_texto: 'Vazamentos sob o veículo', estado: 'nao_ok', observacao: 'mancha no chão' },
]

test('o texto canônico traz o conteúdo inteiro, na ordem fixa', () => {
  const t = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: 'abc123' })
  // Cada dado num campo próprio, separado por | — o formato importa menos que
  // ser ESTÁVEL, porque é o que se recalcula pra conferir depois.
  assert.match(t, /v1/)
  assert.match(t, /2026-08-06/)
  assert.match(t, /148520/)
  assert.match(t, /Painel — luzes de advertência/)
  assert.match(t, /mancha no chão/)
  assert.match(t, /abc123/)
})

test('a ORDEM dos itens faz parte da prova', () => {
  // Trocar dois itens de lugar tem que dar texto diferente: senão daria pra
  // reordenar as respostas de uma ficha assinada sem quebrar o hash.
  const a = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  const b = textoParaAssinar({ ficha: FICHA, respostas: [RESPOSTAS[1], RESPOSTAS[0]], hashAnterior: '' })
  assert.notEqual(a, b)
})

test('mudar QUALQUER campo muda o texto', () => {
  const base = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  for (const [campo, valor] of [
    ['veiculo_id', 'v2'], ['feita_em', '2026-08-07'], ['pessoa_id', 'p2'],
    ['hodometro', 148521], ['resultado', 'com_ressalvas'], ['anomalias', 'x'],
    ['assinada_em', '2026-08-06T12:00:01.000Z'],
  ]) {
    const t = textoParaAssinar({ ficha: { ...FICHA, [campo]: valor }, respostas: RESPOSTAS, hashAnterior: '' })
    assert.notEqual(t, base, `mudar ${campo} tinha que mudar o texto`)
  }
})

test('mudar a resposta de um item muda o texto', () => {
  const base = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: '' })
  const outras = [{ ...RESPOSTAS[0], estado: 'nao_ok' }, RESPOSTAS[1]]
  assert.notEqual(textoParaAssinar({ ficha: FICHA, respostas: outras, hashAnterior: '' }), base)
})

test('nulo e vazio não se confundem', () => {
  // Se `null` e '' virassem o mesmo texto, dava pra trocar um pelo outro numa
  // ficha assinada sem quebrar nada.
  const comNulo = textoParaAssinar({ ficha: { ...FICHA, anomalias: null }, respostas: RESPOSTAS, hashAnterior: '' })
  const comVazio = textoParaAssinar({ ficha: { ...FICHA, anomalias: '' }, respostas: RESPOSTAS, hashAnterior: '' })
  assert.notEqual(comNulo, comVazio)
})

test('a primeira ficha do carro encadeia em vazio, e isso é explícito', () => {
  const t = textoParaAssinar({ ficha: FICHA, respostas: RESPOSTAS, hashAnterior: null })
  assert.match(t, /PRIMEIRA/)
})

/* ── A impressão digital ─────────────────────────────────────────────────── */

test('a impressão digital tem 64 caracteres hexadecimais', async () => {
  const h = await impressaoDigital('qualquer coisa')
  assert.equal(h.length, 64)
  assert.match(h, /^[0-9a-f]{64}$/)
})

test('o mesmo texto dá sempre a mesma impressão; texto diferente, diferente', async () => {
  assert.equal(await impressaoDigital('abc'), await impressaoDigital('abc'))
  assert.notEqual(await impressaoDigital('abc'), await impressaoDigital('abd'))
})

test('acento não quebra a impressão digital', async () => {
  // Os itens do checklist têm acento ("advertência", "veículo"). Se a conversão
  // pra bytes fosse por caractere em vez de UTF-8, o hash mudaria de máquina
  // pra máquina e a corrente inteira ficaria impossível de conferir.
  const h = await impressaoDigital('Painel — luzes de advertência')
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.equal(h, await impressaoDigital('Painel — luzes de advertência'))
})

/* ── O tempo de preenchimento (D20) ──────────────────────────────────────── */

test('conta os segundos entre abrir e assinar', () => {
  const t = tempoDePreenchimento('2026-08-06T12:00:00.000Z', '2026-08-06T12:01:30.000Z')
  assert.equal(t.segundos, 90)
  assert.equal(t.rapidoDemais, false)
})

test('rápido demais é sinalizado', () => {
  // 4 itens em 3 segundos não foram olhados.
  const t = tempoDePreenchimento('2026-08-06T12:00:00.000Z', '2026-08-06T12:00:03.000Z')
  assert.equal(t.segundos, 3)
  assert.equal(t.rapidoDemais, true)
})

test('sem os dois instantes, não inventa número', () => {
  assert.deepEqual(tempoDePreenchimento(null, '2026-08-06T12:00:00.000Z'), { segundos: null, rapidoDemais: false })
  assert.deepEqual(tempoDePreenchimento('2026-08-06T12:00:00.000Z', null), { segundos: null, rapidoDemais: false })
  assert.deepEqual(tempoDePreenchimento('nao é data', 'nem isso'), { segundos: null, rapidoDemais: false })
})

test('instantes em formatos diferentes dão o mesmo resultado', () => {
  // O Postgres devolve '+00:00' sem milissegundos; o app grava '.000Z'.
  // Comparar como texto erraria — é o mesmo defeito já corrigido em posse.js.
  const a = tempoDePreenchimento('2026-08-06T12:00:00+00:00', '2026-08-06T12:01:00.000Z')
  assert.equal(a.segundos, 60)
})

test('o limiar é uma constante nomeada, não número solto', () => {
  assert.equal(typeof SEGUNDOS_SUSPEITOS, 'number')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node --test supabase/functions/_shared/assinatura.test.mjs`
Expected: FALHA com `Cannot find module './assinatura.js'`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

```js
/* A ASSINATURA DO CHECKLIST — o texto que se assina, e a impressão digital dele.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
 *
 * POR QUE UM TEXTO CANÔNICO: assinar "a ficha" não quer dizer nada — é preciso
 * assinar uma SEQUÊNCIA DE BYTES exata, que dê pra recalcular igualzinha daqui a
 * dois anos pra provar que nada mudou. Este arquivo é a definição dessa
 * sequência, e por isso o formato dele não pode mudar sem invalidar tudo que já
 * foi assinado.
 *
 * MORA NO _shared porque a mesma função precisa rodar no navegador (assinar) e
 * no Deno (conferir, e um dia calcular do lado do servidor). Duas cópias dessa
 * função seriam duas verdades sobre o que foi assinado. */

// 4 itens em menos disto não foram olhados (D20). Não bloqueia nada — só fica
// visível pra quem administra.
export const SEGUNDOS_SUSPEITOS = 10;

// `null` e string vazia PRECISAM dar textos diferentes: se virassem o mesmo,
// daria pra trocar um pelo outro numa ficha assinada sem quebrar o hash.
const campo = (v) => (v === null || v === undefined ? '\\u0000' : String(v));

/**
 * O texto exato que a assinatura cobre. A ORDEM faz parte da prova — trocar
 * dois itens de lugar tem que dar texto diferente.
 *
 * `hashAnterior` é a impressão digital da ficha anterior DESTE CARRO. Vazio
 * significa que é a primeira, e o texto diz isso com todas as letras em vez de
 * deixar um campo em branco ambíguo.
 */
export function textoParaAssinar({ ficha, respostas, hashAnterior }) {
  const linhas = [
    'FROTA-CHECKLIST-V1',
    campo(ficha.veiculo_id),
    campo(ficha.feita_em),
    campo(ficha.pessoa_id),
    campo(ficha.hodometro),
    campo(ficha.hodometro_justificativa),
    (ficha.cadencias || []).join(','),
    campo(ficha.resultado),
    campo(ficha.anomalias),
    campo(ficha.assinada_em),
    `ANTERIOR:${hashAnterior || 'PRIMEIRA'}`,
    `ITENS:${(respostas || []).length}`,
  ];
  for (const r of respostas || []) {
    linhas.push([campo(r.item_texto), campo(r.estado), campo(r.observacao)].join('\\u001f'));
  }
  return linhas.join('\\n');
}

/**
 * SHA-256 em hexadecimal. Usa Web Crypto, que existe igual no navegador e no
 * Deno — a mesma entrada tem de dar a mesma saída nos dois, senão a corrente
 * fica impossível de conferir do outro lado.
 */
export async function impressaoDigital(texto) {
  // TextEncoder produz UTF-8. Os itens têm acento ("advertência"), e converter
  // por caractere em vez de UTF-8 mudaria o hash conforme a máquina.
  const bytes = new TextEncoder().encode(String(texto));
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── O tempo de preenchimento (D20) ───────────────────────────────────────── */

const instante = (v) => {
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * Quanto tempo a pessoa levou. NUNCA inventa: sem os dois instantes, devolve
 * nulo em vez de zero — zero significaria "instantâneo", que é uma acusação.
 *
 * O SINAL É ASSIMÉTRICO, e quem consome precisa saber: tempo curto PROVA
 * desatenção; tempo longo NÃO PROVA zelo, porque a pessoa pode ter aberto o
 * cartão e ido tomar café.
 */
export function tempoDePreenchimento(abertaEm, assinadaEm) {
  const a = instante(abertaEm), b = instante(assinadaEm);
  if (a === null || b === null) return { segundos: null, rapidoDemais: false };
  const segundos = Math.round((b - a) / 1000);
  return { segundos, rapidoDemais: segundos >= 0 && segundos < SEGUNDOS_SUSPEITOS };
}
```

**Atenção ao escrever:** os `\\u0000`, `\\u001f` e `\\n` acima estão escapados
porque este documento é markdown. No arquivo `.js` de verdade eles são
`' '`, `''` e `'\n'` — uma barra só.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node --test supabase/functions/_shared/assinatura.test.mjs`
Expected: PASSA, 13 testes.

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `npm test` — Expected: PASSA (1942 + 13).
Run: `npm run build` — Expected: sem erro.

```bash
git add supabase/functions/_shared/assinatura.js supabase/functions/_shared/assinatura.test.mjs
git commit -m "frota: o texto exato que a assinatura cobre, e a impressao digital dele"
```

---

### Task 2: A conferência da corrente

**Files:**
- Modify: `supabase/functions/_shared/assinatura.js`
- Test: `supabase/functions/_shared/assinatura.test.mjs`

**Interfaces:**
- Consumes: `textoParaAssinar` e `impressaoDigital` da Task 1.
- Produces: `conferirCorrente(fichas, respostasPorFicha) -> Promise<{ok, total, conferidas, primeiraQuebra}>`. `fichas` vem ordenada da mais antiga para a mais nova; `respostasPorFicha` é `{ [checklist_id]: resposta[] }`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `assinatura.test.mjs`, e incluir `conferirCorrente` no `import` do topo:

```js
/* ── A conferência da corrente ───────────────────────────────────────────── */

// Monta uma corrente de verdade: cada ficha assinada em cima da anterior.
async function montarCorrente(quantas) {
  const fichas = [], porFicha = {}
  let anterior = null
  for (let i = 0; i < quantas; i++) {
    const ficha = {
      id: 'f' + i, veiculo_id: 'v1', feita_em: `2026-08-0${i + 1}`, pessoa_id: 'p1',
      hodometro: 148000 + i * 100, hodometro_justificativa: null,
      cadencias: ['diario'], resultado: 'liberado', anomalias: null,
      assinada_em: `2026-08-0${i + 1}T12:00:00.000Z`,
      assinatura_hash_anterior: anterior,
    }
    const respostas = [{ item_texto: 'Pneus', estado: 'ok', observacao: null }]
    ficha.assinatura_hash = await impressaoDigital(
      textoParaAssinar({ ficha, respostas, hashAnterior: anterior }))
    anterior = ficha.assinatura_hash
    fichas.push(ficha)
    porFicha[ficha.id] = respostas
  }
  return { fichas, porFicha }
}

test('corrente intacta confere', async () => {
  const { fichas, porFicha } = await montarCorrente(3)
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, true)
  assert.equal(r.total, 3)
  assert.equal(r.conferidas, 3)
  assert.equal(r.primeiraQuebra, null)
})

test('alterar o hodômetro de uma ficha assinada QUEBRA a corrente', async () => {
  // É o ponto da funcionalidade inteira.
  const { fichas, porFicha } = await montarCorrente(3)
  fichas[1].hodometro = 999999
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f1')
  assert.match(r.primeiraQuebra.motivo, /conteúdo/i)
})

test('alterar a RESPOSTA de um item também quebra', async () => {
  const { fichas, porFicha } = await montarCorrente(2)
  porFicha['f0'][0].estado = 'nao_ok'
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f0')
})

test('apagar uma ficha do meio quebra o elo seguinte', async () => {
  const { fichas, porFicha } = await montarCorrente(3)
  const semMeio = [fichas[0], fichas[2]]
  const r = await conferirCorrente(semMeio, porFicha)
  assert.equal(r.ok, false)
  assert.equal(r.primeiraQuebra.id, 'f2')
  assert.match(r.primeiraQuebra.motivo, /anterior/i)
})

test('aponta a PRIMEIRA quebra, não a última', async () => {
  const { fichas, porFicha } = await montarCorrente(4)
  fichas[1].hodometro = 111
  fichas[3].hodometro = 222
  const r = await conferirCorrente(fichas, porFicha)
  assert.equal(r.primeiraQuebra.id, 'f1')
})

test('ficha SEM assinatura é pulada, não conta como quebra', async () => {
  // D22: quem não tem login preenche mas não assina. Isso não pode fazer a
  // corrente do carro parecer adulterada.
  const { fichas, porFicha } = await montarCorrente(2)
  const semAssinatura = { id: 'fx', veiculo_id: 'v1', feita_em: '2026-08-09',
    assinada_em: null, assinatura_hash: null }
  const r = await conferirCorrente([fichas[0], semAssinatura, fichas[1]], porFicha)
  assert.equal(r.ok, true)
  assert.equal(r.total, 3)
  assert.equal(r.conferidas, 2)
})

test('lista vazia confere, e diz que não conferiu nada', async () => {
  const r = await conferirCorrente([], {})
  assert.equal(r.ok, true)
  assert.equal(r.conferidas, 0)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node --test supabase/functions/_shared/assinatura.test.mjs`
Expected: FALHA — `conferirCorrente is not a function`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Acrescentar a `assinatura.js`:

```js
/**
 * Percorre a corrente de um carro e recalcula tudo.
 *
 * SEM ISTO O ENCADEAMENTO É ENFEITE: garantia que ninguém verifica não é
 * garantia. Devolve a PRIMEIRA quebra, não todas — depois da primeira, tudo o
 * que vem é consequência, e listar dez linhas vermelhas esconderia onde o
 * problema começou.
 *
 * `fichas` vem da mais antiga pra mais nova. Ficha sem assinatura é pulada
 * (D22): quem não tem login preenche e não assina, e isso não pode fazer a
 * corrente parecer adulterada.
 */
export async function conferirCorrente(fichas, respostasPorFicha) {
  const lista = fichas || [];
  let anterior = null, conferidas = 0;
  for (const ficha of lista) {
    if (!ficha || !ficha.assinada_em || !ficha.assinatura_hash) continue;

    if ((ficha.assinatura_hash_anterior || null) !== anterior) {
      return { ok: false, total: lista.length, conferidas,
        primeiraQuebra: { id: ficha.id, feita_em: ficha.feita_em,
          motivo: 'Esta ficha aponta para uma ficha anterior diferente da que está no histórico. '
            + 'Ou alguma ficha foi apagada, ou a ordem mudou.' } };
    }

    const texto = textoParaAssinar({
      ficha, respostas: respostasPorFicha ? respostasPorFicha[ficha.id] : [],
      hashAnterior: ficha.assinatura_hash_anterior,
    });
    if (await impressaoDigital(texto) !== ficha.assinatura_hash) {
      return { ok: false, total: lista.length, conferidas,
        primeiraQuebra: { id: ficha.id, feita_em: ficha.feita_em,
          motivo: 'O conteúdo desta ficha não corresponde ao que foi assinado. '
            + 'Alguma coisa foi alterada depois da assinatura.' } };
    }

    anterior = ficha.assinatura_hash;
    conferidas++;
  }
  return { ok: true, total: lista.length, conferidas, primeiraQuebra: null };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node --test supabase/functions/_shared/assinatura.test.mjs`
Expected: PASSA, 20 testes.

- [ ] **Step 5: Rodar a suíte e commitar**

Run: `npm test` e `npm run build` — Expected: os dois passam.

```bash
git add supabase/functions/_shared/assinatura.js supabase/functions/_shared/assinatura.test.mjs
git commit -m "frota: conferir a corrente — sem isso o encadeamento e enfeite"
```

---

### Task 3: O banco — colunas, imutabilidade e a conferência do lado do servidor

**Files:**
- Create: `db/migrations/acessos/032_frota_checklist_assinatura.sql`

**Interfaces:**
- Consumes: `public.frota_checklist` e `public.frota_checklist_respostas` (migration 028).
- Produces: as colunas de assinatura em `frota_checklist`, o gatilho `trg_frota_checklist_imutavel`, e a função `public.frota_corrente_do_veiculo(uuid)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Frota F7a: a assinatura do checklist.
-- Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
--
-- O QUE ISTO GARANTE: que uma ficha assinada não muda mais, e que alteração
-- retroativa não pode ser escondida. Cada ficha assinada guarda a impressão
-- digital do próprio conteúdo E a da ficha anterior DAQUELE CARRO — reescrever
-- uma ficha de agosto obrigaria a reescrever todas as de setembro em diante.

alter table public.frota_checklist
  -- Quando o cartão foi ABERTO. É o que permite medir quanto tempo a pessoa
  -- levou (D20) — o único sinal que existe contra "marcou tudo sem olhar".
  add column if not exists aberta_em timestamptz,
  add column if not exists assinada_em timestamptz,
  add column if not exists assinada_por uuid references auth.users(id) on delete set null,
  add column if not exists assinatura_hash text,
  add column if not exists assinatura_hash_anterior text,
  -- Por que ficou sem assinatura. Hoje só 'sem_login' (D22): 4 dos 7 motoristas
  -- não têm conta no app, e o registro não pode parar por causa disso.
  add column if not exists sem_assinatura_motivo text;

create index if not exists idx_frota_checklist_corrente
  on public.frota_checklist(veiculo_id, feita_em)
  where assinada_em is not null;

-- ── Ficha assinada NÃO MUDA MAIS (D21) ─────────────────────────────────────
-- Gatilho, não checagem de tela: a tela não é o único caminho de escrita, e
-- esta central já aprendeu isso na migration 029 (posse órfã). Uma assinatura
-- que a própria aplicação pode reescrever não prova nada.
create or replace function public.frota_checklist_imutavel()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Esta ficha foi assinada em % e não pode ser apagada.', old.assinada_em;
  end if;
  raise exception 'Esta ficha foi assinada em % e não pode ser alterada. '
    'Se há algo errado nela, registre uma ficha nova explicando.', old.assinada_em;
end $$;

drop trigger if exists trg_frota_checklist_imutavel on public.frota_checklist;
create trigger trg_frota_checklist_imutavel
  before update or delete on public.frota_checklist
  for each row
  when (old.assinada_em is not null)
  execute function public.frota_checklist_imutavel();

-- As RESPOSTAS também: adiantaria pouco travar a ficha e deixar mudar o que foi
-- respondido nela.
create or replace function public.frota_resposta_imutavel()
returns trigger language plpgsql as $$
declare v_assinada timestamptz;
begin
  select c.assinada_em into v_assinada from public.frota_checklist c
   where c.id = coalesce(old.checklist_id, new.checklist_id);
  if v_assinada is not null then
    raise exception 'A ficha desta resposta foi assinada em % e não pode ser alterada.', v_assinada;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_frota_resposta_imutavel on public.frota_checklist_respostas;
create trigger trg_frota_resposta_imutavel
  before update or delete on public.frota_checklist_respostas
  for each row execute function public.frota_resposta_imutavel();

-- ── A leitura pra conferir a corrente ──────────────────────────────────────
-- Devolve as fichas assinadas de um carro, da mais antiga pra mais nova, com as
-- respostas juntas — que é exatamente o que conferirCorrente() precisa. Está
-- aqui pra não obrigar a tela a fazer N+1 consultas.
create or replace function public.frota_corrente_do_veiculo(p_veiculo uuid)
returns table (
  id uuid, veiculo_id uuid, feita_em date, pessoa_id uuid,
  hodometro int, hodometro_justificativa text, cadencias text[],
  resultado text, anomalias text, assinada_em timestamptz,
  assinatura_hash text, assinatura_hash_anterior text, respostas jsonb
)
language sql stable security invoker as $$
  select c.id, c.veiculo_id, c.feita_em, c.pessoa_id,
         c.hodometro, c.hodometro_justificativa, c.cadencias,
         c.resultado, c.anomalias, c.assinada_em,
         c.assinatura_hash, c.assinatura_hash_anterior,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'item_texto', r.item_texto, 'estado', r.estado, 'observacao', r.observacao)
                  order by r.id)
             from public.frota_checklist_respostas r where r.checklist_id = c.id
         ), '[]'::jsonb)
    from public.frota_checklist c
   where c.veiculo_id = p_veiculo
   order by c.feita_em, c.criada_em;
$$;
```

**⚠️ CONFIRA ANTES DE APLICAR:** a ordem das respostas no `jsonb_agg` (`order by
r.id`) **tem que ser a mesma** em que elas foram gravadas, porque a ordem faz
parte da impressão digital (Task 1). Confira com
`node coletor/consultar.mjs "select column_name from information_schema.columns where table_name='frota_checklist_respostas' order by ordinal_position"`
se existe alguma coluna de ordem melhor que o `id`. Se `id` for `uuid` aleatório,
**a ordem não é estável** — nesse caso, acrescente `ordem int` à tabela de
respostas nesta mesma migration, grave-a na Task 4, e ordene por ela. Diga no
relatório o que encontrou e o que fez.

- [ ] **Step 2: Aplicar e conferir**

Run: `node coletor/run-acessos-sql.mjs db/migrations/acessos/032_frota_checklist_assinatura.sql`

```bash
node coletor/consultar.mjs "select column_name from information_schema.columns where table_schema='public' and table_name='frota_checklist' and column_name like 'assin%' or column_name in ('aberta_em','sem_assinatura_motivo')"
node coletor/consultar.mjs "select tgname from pg_trigger where tgname like 'trg_frota_%imutavel'"
node coletor/consultar.mjs "select count(*) as linhas from public.frota_corrente_do_veiculo((select id from public.frota_veiculos limit 1))"
```
Expected: 6 colunas; 2 gatilhos; a função responde sem erro (0 linhas está certo — não há ficha nenhuma ainda).

- [ ] **Step 3: PROVAR que o gatilho segura**

Não basta existir. Rode:

```bash
node coletor/consultar.mjs "
insert into public.frota_checklist (veiculo_id, feita_em, hodometro, assinada_em, assinatura_hash)
select id, '2026-01-01', 1, now(), 'teste' from public.frota_veiculos limit 1 returning id"
```
Guarde o id devolvido e tente alterar:
```bash
node coletor/consultar.mjs "update public.frota_checklist set hodometro = 2 where assinatura_hash = 'teste'"
```
Expected: **ERRO** dizendo que a ficha foi assinada e não pode ser alterada.

Apague a linha de teste — e note que **o gatilho impede o próprio delete**, então
é preciso desarmar primeiro:
```bash
node coletor/consultar.mjs "alter table public.frota_checklist disable trigger trg_frota_checklist_imutavel"
node coletor/consultar.mjs "delete from public.frota_checklist where assinatura_hash = 'teste'"
node coletor/consultar.mjs "alter table public.frota_checklist enable trigger trg_frota_checklist_imutavel"
node coletor/consultar.mjs "select count(*) as devem_ser_zero from public.frota_checklist where assinatura_hash = 'teste'"
```
Expected: zero. **Confirme que o gatilho voltou a ser ativo** com
`node coletor/consultar.mjs "select tgenabled from pg_trigger where tgname = 'trg_frota_checklist_imutavel'"` — tem que devolver `O`.

Cole as saídas dos dois no relatório.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/acessos/032_frota_checklist_assinatura.sql
git commit -m "frota: ficha assinada nao muda mais, e a corrente se confere no banco"
```

---

### Task 4: Conferir a senha sem trocar a sessão

**Files:**
- Create: `supabase/functions/conferir-senha/index.ts`

**Interfaces:**
- Consumes: nada do plano. Usa o padrão de `supabase/functions/invite-user/index.ts` — leia esse arquivo inteiro antes de escrever.
- Produces: `POST /functions/v1/conferir-senha` com `{ senha }` no corpo e o JWT do usuário no cabeçalho; responde `{ ok: true }`, `{ ok: false }`, ou `{ ok: false, bloqueado_ate }`.

- [ ] **Step 1: Escrever a função**

```ts
// supabase/functions/conferir-senha/index.ts
// Confere a senha de QUEM ESTÁ LOGADO e devolve só sim ou não.
//
// POR QUE ISTO EXISTE, e é a razão de ser uma Edge Function: o único jeito de
// conferir senha pelo cliente com Supabase é signInWithPassword — que é o que
// tela-de-login.vue:111 usa —, e ele TROCA A SESSÃO. Chamá-lo pra confirmar a
// senha no meio do checklist faria o app entrar de novo, com token novo e a
// ficha pela metade na tela.
//
// O USUÁRIO SAI DO TOKEN, NUNCA DO CORPO DO PEDIDO. Aceitar um e-mail vindo do
// cliente transformaria isto num oráculo pra testar senha de terceiros.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Cinco erros seguidos bloqueiam por dez minutos. Sem isto a função é um jeito
// confortável de testar senhas — e ela responde rápido, o que é pior.
const LIMITE = 5;
const BLOQUEIO_MS = 10 * 60 * 1000;
const tentativas = new Map<string, { erros: number; ate: number }>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ ok: false, erro: 'sem_sessao' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Quem é quem: cliente com o token de quem chamou, só pra descobrir o usuário.
  const comToken = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: erroUser } = await comToken.auth.getUser();
  if (erroUser || !user?.email) return json({ ok: false, erro: 'sem_sessao' }, 401);

  const marca = tentativas.get(user.id);
  if (marca && marca.ate > Date.now()) {
    return json({ ok: false, erro: 'bloqueado', bloqueado_ate: new Date(marca.ate).toISOString() }, 429);
  }

  let senha = '';
  try { senha = String((await req.json())?.senha || ''); } catch { /* corpo inválido -> senha vazia */ }
  if (!senha) return json({ ok: false, erro: 'sem_senha' }, 400);

  // Cliente NOVO e isolado só pra esta conferência: o signIn aqui dentro cria
  // uma sessão que morre com a função e nunca chega ao navegador de ninguém.
  const isolado = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await isolado.auth.signInWithPassword({ email: user.email, password: senha });

  if (error) {
    const erros = (marca?.erros || 0) + 1;
    tentativas.set(user.id, { erros, ate: erros >= LIMITE ? Date.now() + BLOQUEIO_MS : 0 });
    return json({ ok: false, erro: 'senha_incorreta', restam: Math.max(0, LIMITE - erros) });
  }

  tentativas.delete(user.id);
  // Encerra a sessão isolada explicitamente, pra não deixar token vivo à toa.
  await isolado.auth.signOut();
  return json({ ok: true });
});
```

- [ ] **Step 2: Conferir o irmão antes de publicar**

Leia `supabase/functions/invite-user/index.ts` e confirme: o nome exato da
variável de ambiente da chave anônima (`SUPABASE_ANON_KEY`), e como ele lê o
usuário a partir do token. Corrija acima se divergir. Diga no relatório o que
conferiu.

- [ ] **Step 3: NÃO publique — deixe pronto**

Publicar é ação de produção; quem publica é o controlador da execução, depois da
revisão. Escreva no relatório que a função está pronta e esperando publicação,
e que ela precisa de `verify_jwt: true` (ao contrário dos robôs de cron, esta é
chamada por uma pessoa logada).

- [ ] **Step 4: Rodar a suíte e commitar**

Run: `npm test` e `npm run build` — Expected: os dois passam (a função não tem teste automático: é orquestração de rede, e o irmão `invite-user` também não tem).

```bash
git add supabase/functions/conferir-senha/index.ts
git commit -m "frota: conferir a senha sem trocar a sessao de quem esta preenchendo"
```

---

### Task 5: O motorista assina

**Files:**
- Modify: `src/ferramentas/frota/painel-de-checklist.vue`
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: `textoParaAssinar`, `impressaoDigital` (Task 1); as colunas da Task 3; a Edge da Task 4.
- Produces: o evento `gravar` do painel passa a emitir também `{ assinatura }`, que é `null` (sem assinatura) ou `{ senha, aberta_em }`.

- [ ] **Step 1: No painel, marcar quando o cartão abriu**

Em `painel-de-checklist.vue`, no `<script setup>`:

```js
// D20: o tempo de preenchimento é o único sinal contra "marcou tudo sem olhar".
// Marcado na montagem do componente, não no primeiro toque — quem abre e demora
// a começar também é informação.
const abertaEm = new Date().toISOString()
```

E acrescente as propriedades novas:

```js
  // Quem não tem login não pode assinar (D22). O cartão continua funcionando:
  // a ficha grava sem assinatura, e a tela DIZ isso — ficha sem assinatura
  // parecendo assinada seria a mentira mais cara desta fase.
  podeAssinar: { type: Boolean, default: true },
  erroDaAssinatura: { type: String, default: '' },
```

- [ ] **Step 2: O passo de assinar, no fim do cartão**

No `<template>`, entre o bloco `.ck-resultado` e a lista de erros:

```html
<div class="ck-assinar" v-if="podeAssinar">
  <label class="ck-lab" for="ck-senha">Sua senha, para assinar</label>
  <input id="ck-senha" v-model="senha" type="password" autocomplete="current-password"
         class="ck-senha" placeholder="a mesma senha com que você entra">
  <p class="ck-nota">
    A senha confirma que foi você quem conferiu o carro. Ela não é guardada em lugar nenhum.
  </p>
  <p class="ck-erro-assinatura" v-if="erroDaAssinatura">{{ erroDaAssinatura }}</p>
</div>
<div class="ck-assinar" v-else>
  <p class="ck-nota destaque">
    Esta ficha vai ficar <strong>sem assinatura</strong>: você ainda não tem login próprio
    no aplicativo. O checklist é registrado do mesmo jeito — avise quem administra a Frota
    para criarem seu acesso.
  </p>
</div>
```

Com `const senha = ref('')` no script, e no `gravar()`:

```js
  emit('gravar', {
    ficha: { /* … como está hoje … */ },
    respostas: /* … como está hoje … */,
    // A senha vai pro pai, que confere no servidor e calcula a assinatura. O
    // painel não fala com o banco nem com a Edge — ele só desenha.
    assinatura: props.podeAssinar ? { senha: senha.value, aberta_em: abertaEm } : null,
  })
```

E o estilo, junto dos outros, **por token**:

```css
.ck-assinar { margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
.ck-senha {
  width: 100%; box-sizing: border-box; padding: 10px var(--sp-3);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg); color: var(--text);
  font-family: var(--fonte-principal); font-size: 15px;
}
.ck-senha:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.ck-nota.destaque { color: var(--text); border-left: 3px solid var(--orange); padding-left: var(--sp-3); }
.ck-erro-assinatura { margin: var(--sp-2) 0 0; font-size: 13px; color: var(--red); line-height: 1.45; }
```

- [ ] **Step 3: Na tela, conferir a senha e assinar**

Em `tela-de-frota.vue`, importe e acrescente:

```js
import { textoParaAssinar, impressaoDigital } from '../../../supabase/functions/_shared/assinatura.js'

const erroDaAssinatura = ref('')
// Quem não tem login não assina (D22). `euId` é o id da PESSOA (acessos_pessoas);
// quem assina é o USUÁRIO (auth), e nem toda pessoa tem um.
const podeAssinar = computed(() => !!estado.userId)

async function gravarChecklist({ ficha, respostas, assinatura }) {
  if (gravando.value) return
  erroDaAssinatura.value = ''
  gravando.value = true

  let campos = { ...ficha, pessoa_id: euId.value, pessoa_nome: nomeDaPessoa(euId.value) }

  if (assinatura) {
    // 1) A senha, no servidor — signInWithPassword aqui trocaria a sessão.
    const { data: conf, error: erroConf } = await sbClient.functions.invoke('conferir-senha', {
      body: { senha: assinatura.senha },
    })
    if (erroConf || !conf?.ok) {
      gravando.value = false
      erroDaAssinatura.value = conf?.erro === 'bloqueado'
        ? 'Muitas tentativas com senha errada. Espere dez minutos e tente de novo.'
        : 'Senha incorreta. Confira e tente de novo — é a mesma senha com que você entra no aplicativo.'
      return
    }

    // 2) A ficha anterior DESTE carro, pra encadear.
    const { data: anteriores } = await sbClient.from('frota_checklist')
      .select('assinatura_hash').eq('veiculo_id', ficha.veiculo_id)
      .not('assinada_em', 'is', null).order('feita_em', { ascending: false }).limit(1)
    const hashAnterior = anteriores?.[0]?.assinatura_hash || null

    const assinadaEm = new Date().toISOString()
    campos = {
      ...campos,
      aberta_em: assinatura.aberta_em,
      assinada_em: assinadaEm,
      assinada_por: estado.userId,
      assinatura_hash_anterior: hashAnterior,
      assinatura_hash: await impressaoDigital(textoParaAssinar({
        ficha: { ...campos, assinada_em: assinadaEm }, respostas, hashAnterior,
      })),
    }
  } else {
    campos = { ...campos, aberta_em: null, sem_assinatura_motivo: 'sem_login' }
  }

  const { data, error } = await sbClient.from('frota_checklist')
    .insert(campos).select('id').single()
  /* … daqui pra baixo, o tratamento dos dois inserts continua EXATAMENTE como
     está hoje: o erro do insert das respostas é capturado, e a tela não pode
     parecer que deu certo. NÃO reescreva essa parte. … */
}
```

E passe as propriedades novas nos DOIS lugares onde `<PainelDeChecklist>` aparece
(o cartão da aba Motorista e o de dentro do modal de retirada):

```html
  :pode-assinar="podeAssinar"
  :erro-da-assinatura="erroDaAssinatura"
```

- [ ] **Step 4: Provar na tela**

Suba o servidor numa porta livre (`npm run dev -- --port 5340 --strictPort`), e
confira **logado**:
1. o campo de senha aparece no fim do cartão;
2. senha errada recusa com a mensagem em português, e **a ficha NÃO é gravada**;
3. senha certa grava, e o cartão dá lugar à frase de "já feito";
4. no banco: `node coletor/consultar.mjs "select feita_em, assinada_em, assinatura_hash, assinatura_hash_anterior from public.frota_checklist order by criada_em desc limit 2"` — a primeira ficha do carro tem `assinatura_hash_anterior` nulo, e a segunda tem o hash da primeira.

Cole as saídas no relatório. Se não conseguir logar, **diga isso com todas as
letras** em vez de deixar passar como conferido.

- [ ] **Step 5: Rodar tudo e commitar**

Run: `npm test` e `npm run build` — Expected: os dois passam.

```bash
git add src/ferramentas/frota/painel-de-checklist.vue src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: o motorista assina com a senha, e a ficha encadeia na anterior"
```

---

### Task 6: O gestor vê, e confere

**Files:**
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: `conferirCorrente` (Task 2), `tempoDePreenchimento` (Task 1), `frota_corrente_do_veiculo` (Task 3).
- Produces: nada que outra tarefa consuma.

- [ ] **Step 1: O selo no quadro de cobrança**

O quadro hoje mostra "feito" ou "falta". Passa a distinguir três estados, porque
**feito sem assinatura não é a mesma coisa que feito** (D22):

```html
<span class="fr-cobranca-selo" :class="{ 'sem-assinatura': c.fez && !c.assinada }">
  {{ !c.fez ? 'falta' : (c.assinada ? 'assinado' : 'feito, sem assinatura') }}
</span>
```

Com `assinada` vindo das fichas de hoje já carregadas:

```js
const fichaDoVeiculoHoje = (veiculoId) =>
  fichasDeHoje.value.find((f) => f.veiculo_id === veiculoId) || null
```

E o estilo, **por token**:

```css
.tela-frota .fr-cobranca-selo.sem-assinatura{color:var(--orange);}
```

- [ ] **Step 2: O botão de conferir a corrente**

Na aba Gestão, dentro da ficha do veículo:

```html
<button class="fr-btn" :disabled="conferindo" @click="conferirAssinaturas(veiculoAberto)">
  {{ conferindo ? 'Conferindo…' : 'Conferir as assinaturas deste carro' }}
</button>
<p class="fr-conferencia" v-if="conferencia" :class="{ ruim: !conferencia.ok }">{{ conferencia.texto }}</p>
```

```js
import { conferirCorrente } from '../../../supabase/functions/_shared/assinatura.js'

const conferindo = ref(false)
const conferencia = ref(null)

async function conferirAssinaturas(veiculo) {
  if (conferindo.value || !veiculo) return
  conferindo.value = true
  conferencia.value = null
  const { data, error } = await sbClient.rpc('frota_corrente_do_veiculo', { p_veiculo: veiculo.id })
  if (error) {
    conferindo.value = false
    conferencia.value = { ok: false, texto: 'Não consegui ler o histórico deste carro. Tente de novo.' }
    return
  }
  const porFicha = Object.fromEntries((data || []).map((f) => [f.id, f.respostas || []]))
  const r = await conferirCorrente(data || [], porFicha)
  conferindo.value = false
  conferencia.value = {
    ok: r.ok,
    // Nunca diz "tudo certo" sobre o que não conferiu: zero fichas assinadas
    // não é o mesmo que histórico íntegro.
    texto: !r.conferidas
      ? 'Este carro ainda não tem nenhuma ficha assinada — não há o que conferir.'
      : r.ok
        ? `As ${r.conferidas} fichas assinadas deste carro conferem: nada foi alterado depois de assinado.`
        : `A ficha de ${r.primeiraQuebra.feita_em} não confere. ${r.primeiraQuebra.motivo}`,
  }
}
```

```css
.tela-frota .fr-conferencia{margin:8px 14px;font-size:13px;color:var(--green);line-height:1.45;}
.tela-frota .fr-conferencia.ruim{color:var(--red);}
```

- [ ] **Step 3: Provar que a conferência ACUSA de verdade**

Não basta ver a mensagem verde. Depois de assinar duas fichas de um carro
(Task 5), altere uma no banco à força e confirme que o botão acusa:

```bash
node coletor/consultar.mjs "alter table public.frota_checklist disable trigger trg_frota_checklist_imutavel"
node coletor/consultar.mjs "update public.frota_checklist set hodometro = hodometro + 1 where assinada_em is not null and veiculo_id = (select veiculo_id from public.frota_checklist where assinada_em is not null limit 1)"
```
Clique no botão: tem que ficar **vermelho**, apontando a data da primeira ficha
alterada. Depois desfaça:
```bash
node coletor/consultar.mjs "update public.frota_checklist set hodometro = hodometro - 1 where assinada_em is not null"
node coletor/consultar.mjs "alter table public.frota_checklist enable trigger trg_frota_checklist_imutavel"
node coletor/consultar.mjs "select tgenabled from pg_trigger where tgname = 'trg_frota_checklist_imutavel'"
```
O último tem que devolver `O`. Clique de novo: tem que voltar ao **verde**.

Cole as duas telas (ou as duas mensagens) no relatório. **Sem essa prova a
funcionalidade não está entregue** — é o mesmo raciocínio de "garantia que
ninguém verifica não é garantia".

- [ ] **Step 4: Rodar tudo e commitar**

Run: `npm test` e `npm run build` — Expected: os dois passam.

```bash
git add src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: o gestor ve quem assinou, e pode conferir a corrente"
```

---

### Task 7: Quem administra preenche o checklist de qualquer carro

**Files:**
- Modify: `src/ferramentas/frota/tela-de-frota.vue`
- Modify: `src/ferramentas/frota/painel-de-checklist.vue`

**Interfaces:**
- Consumes: `PainelDeChecklist` e `gravarChecklist` (Task 5); `precisaDeChecklist` de `_shared/checklist.js`.
- Produces: nada que outra tarefa consuma.

**Por que esta tarefa existe (D21b):** hoje o cartão só aparece para o carro fixo
da pessoa ou para o de rodízio que ela está pegando. **Quatro dos sete motoristas
não têm login** — sem isto, o carro deles fica sem ficha nenhuma até o RH criar
as contas. Quem administra passa a poder preencher e assinar por qualquer carro.

- [ ] **Step 1: Escrever o teste que falha**

Em `supabase/functions/_shared/checklist.test.mjs`, acrescentando
`veiculosParaConferir` ao `import` do topo:

```js
/* ── Por quais carros esta pessoa pode preencher (D21b) ──────────────────── */

const FROTA = [
  { id: 'v1', nome: 'FIAT PUNTO', pessoa_id: 'p1', situacao: 'ativo' },
  { id: 'v2', nome: 'VOLVO XC60', pessoa_id: 'p2', situacao: 'ativo' },
  { id: 'v3', nome: 'HONDA FIT',  pessoa_id: null, situacao: 'ativo' },
  { id: 'v4', nome: 'FIAT DOBLO', pessoa_id: 'p9', situacao: 'em_manutencao' },
]

test('quem só dirige vê apenas o próprio carro', () => {
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p1', ehGestor: false, fichas: [], hoje: '2026-08-06' })
  assert.deepEqual(l.map((x) => x.veiculo.id), ['v1'])
  assert.equal(l[0].meu, true)
})

test('quem administra vê todos os ativos, com o próprio na frente', () => {
  // O carro da pessoa vem primeiro: é o que ela provavelmente veio fazer.
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p2', ehGestor: true, fichas: [], hoje: '2026-08-06' })
  assert.deepEqual(l.map((x) => x.veiculo.id), ['v2', 'v1', 'v3'])
  assert.equal(l[0].meu, true)
  assert.equal(l[1].meu, false)
})

test('carro fora de operação não entra nem pro gestor', () => {
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p1', ehGestor: true, fichas: [], hoje: '2026-08-06' })
  assert.equal(l.some((x) => x.veiculo.id === 'v4'), false)
})

test('carro que já tem ficha hoje sai da lista', () => {
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-06' }]
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p1', ehGestor: true, fichas, hoje: '2026-08-06' })
  assert.equal(l.some((x) => x.veiculo.id === 'v1'), false)
})

test('ficha de ontem não conta como feita hoje', () => {
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-05' }]
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p1', ehGestor: false, fichas, hoje: '2026-08-06' })
  assert.equal(l.length, 1)
})

test('gestor sem carro próprio vê todos, sem quebrar', () => {
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p9', ehGestor: true, fichas: [], hoje: '2026-08-06' })
  assert.deepEqual(l.map((x) => x.veiculo.id), ['v1', 'v3', 'v2'])
  assert.equal(l.every((x) => !x.meu), true)
})

test('o dono do carro vem junto, pro gestor saber por quem está preenchendo', () => {
  const l = veiculosParaConferir({ veiculos: FROTA, euId: 'p2', ehGestor: true, fichas: [], hoje: '2026-08-06' })
  const punto = l.find((x) => x.veiculo.id === 'v1')
  assert.equal(punto.donoId, 'p1')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test supabase/functions/_shared/checklist.test.mjs`
Expected: FALHA — `veiculosParaConferir is not a function`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Acrescentar a `supabase/functions/_shared/checklist.js`:

```js
/**
 * Por quais carros esta pessoa pode preencher o checklist hoje (D21b).
 *
 * Quem só dirige: o próprio carro. Quem administra: todos os ativos — e é o
 * que destrava o problema dos 4 motoristas sem login, cujo carro ficaria
 * eternamente sem ficha.
 *
 * O carro da própria pessoa vem PRIMEIRO: é o que ela provavelmente veio fazer,
 * e obrigá-la a procurar o dela no meio de nove seria trocar um problema por
 * outro. Devolve `donoId` junto pra tela poder dizer por quem se está
 * preenchendo — o gestor precisa saber que aquele Punto é do Marcus.
 */
export function veiculosParaConferir({ veiculos, euId, ehGestor, fichas, hoje }) {
  const jaTemHoje = new Set(
    (fichas || []).filter((f) => f && f.feita_em === hoje).map((f) => f.veiculo_id));
  return (veiculos || [])
    .filter((v) => v && v.situacao === 'ativo' && !jaTemHoje.has(v.id))
    .filter((v) => ehGestor || (euId && v.pessoa_id === euId))
    .map((v) => ({ veiculo: v, donoId: v.pessoa_id || null, meu: !!(euId && v.pessoa_id === euId) }))
    .sort((a, b) => (a.meu === b.meu
      ? String(a.veiculo.nome || '').localeCompare(String(b.veiculo.nome || ''))
      : (a.meu ? -1 : 1)));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test supabase/functions/_shared/checklist.test.mjs`
Expected: PASSA (os de antes + 7).

- [ ] **Step 5: Na tela**

Em `tela-de-frota.vue`, importe `veiculosParaConferir` e troque o `meuCarroFixo`
do cartão por uma lista:

```js
const ehGestorDaFrota = computed(() => pode('criar') || pode('excluir'))
const paraConferir = computed(() => veiculosParaConferir({
  veiculos: veiculos.value, euId: euId.value,
  ehGestor: ehGestorDaFrota.value, fichas: fichas.value, hoje: hoje.value,
}))
// Qual está aberto pra preencher. O primeiro abre sozinho quando é o carro da
// própria pessoa — quem tem carro fixo não deve ter que escolher nada.
const conferindoVeiculo = ref(null)
const aberto = computed(() =>
  conferindoVeiculo.value
  || (paraConferir.value[0]?.meu ? paraConferir.value[0] : null))
```

No `<template>`, na aba Motorista, no lugar do cartão único:

```html
<template v-if="aberto">
  <!-- Quando o gestor preenche por outro, a tela DIZ de quem é o carro: a ficha
       vai registrar o gestor como quem conferiu, e ele precisa saber disso. -->
  <p class="fr-aviso" v-if="!aberto.meu">
    Você está preenchendo pelo {{ aberto.veiculo.nome }}<template v-if="aberto.donoId">,
    que é o carro de {{ nomeDaPessoa(aberto.donoId) }}</template>. A ficha vai registrar
    que <strong>você</strong> conferiu.
  </p>
  <PainelDeChecklist
    :veiculo="aberto.veiculo" :itens="itensDeChecklist" :config="configDeChecklist"
    :ultima-semanal="ultimaDoTipo(aberto.veiculo.id, 'semanal')"
    :ultima-mensal="ultimaDoTipo(aberto.veiculo.id, 'mensal')"
    :ultimo-km="ultimoHodometro(fichas, aberto.veiculo.id)"
    :hoje="hoje" :gravando="gravando"
    :pode-assinar="podeAssinar" :erro-da-assinatura="erroDaAssinatura"
    @gravar="gravarChecklist" />
</template>

<!-- Os outros carros que este gestor pode conferir. Só aparece pra quem
     administra: quem dirige tem um carro e mais nada. -->
<template v-if="ehGestorDaFrota && paraConferir.filter((x) => x !== aberto).length">
  <h2 class="fr-secao">Outros carros sem checklist hoje</h2>
  <ul class="fr-outros">
    <li v-for="x in paraConferir.filter((y) => y !== aberto)" :key="x.veiculo.id">
      <strong>{{ x.veiculo.nome }}</strong>
      <span v-if="x.donoId"> · {{ nomeDaPessoa(x.donoId) }}</span>
      <button class="fr-btn pequeno" @click="conferindoVeiculo = x">Conferir este</button>
    </li>
  </ul>
</template>
```

E em `gravarChecklist`, depois de gravar com sucesso, limpe a escolha:
`conferindoVeiculo.value = null`.

**Confira também** que `fichaDeHoje` (a frase "já feito") continua funcionando —
ela hoje olha só `meuCarroFixo`. Com a lista, o carro conferido simplesmente sai
de `paraConferir`, então a frase precisa passar a olhar o carro da PESSOA:

```js
const meuCarro = computed(() =>
  veiculos.value.find((v) => v.pessoa_id && v.pessoa_id === euId.value) || null)
const fichaDeHoje = computed(() => !meuCarro.value ? null
  : fichas.value.find((f) => f.veiculo_id === meuCarro.value.id && f.feita_em === hoje.value) || null)
```

- [ ] **Step 6: Provar na tela**

Com um usuário que administra a Frota:
1. o cartão do próprio carro abre sozinho;
2. abaixo aparece "Outros carros sem checklist hoje", com o nome do dono de cada um;
3. clicar em "Conferir este" abre o cartão daquele carro, **com o aviso de que a ficha vai registrar você**;
4. gravar funciona, e o carro sai da lista;
5. no banco: `node coletor/consultar.mjs "select c.feita_em, v.nome as carro, p.nome as quem_conferiu from public.frota_checklist c join public.frota_veiculos v on v.id=c.veiculo_id left join public.acessos_pessoas p on p.id=c.pessoa_id order by c.criada_em desc limit 3"` — a coluna `quem_conferiu` tem que trazer **quem preencheu**, não o dono do carro.

Com um usuário que só dirige: a seção "Outros carros" **não pode aparecer**.

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm test` e `npm run build` — Expected: os dois passam.

```bash
git add supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: quem administra confere qualquer carro, e a ficha diz quem conferiu"
```

---

## Depois de tudo: o que fica com o dono

1. **Publicar a Edge `conferir-senha`** com `verify_jwt: true`. Sem ela, ninguém assina.
2. **Criar os logins de Barbara, Marcus, Thiago e Raissa.** Enquanto não existirem, elas não assinam nada. A Task 7 dá a saída de emergência — quem administra preenche e assina pelo carro delas —, mas isso registra que **o gestor** conferiu o carro, não a motorista. É paliativo, não solução: quem dirige é quem devia olhar o veículo.
3. **A F7b** (o PDF e a fila do Zoho) é plano separado, e precisa de escopo de escrita na conta Zoho.
4. **A impressão digital é calculada no cliente.** Está dito no desenho, na seção "O que fica sem prova": quem souber pode forjar a própria. A corrente ainda garante que alteração retroativa não passa despercebida.
