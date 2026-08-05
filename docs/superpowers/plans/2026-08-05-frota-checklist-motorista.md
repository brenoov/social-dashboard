# Frota — Checklist do motorista e posse contínua: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a aba Motorista da Frota entregar o checklist de primeiro escalão com hodômetro diário, para que a quilometragem — hoje inexistente em todos os 9 carros — passe a existir sozinha.

**Architecture:** Lógica pura em módulos `.js` com teste `.test.mjs` ao lado (padrão dos quatro que a Frota já tem), tabelas novas por migration numerada, e a interface em componentes `.vue` próprios para não engordar mais o `tela-de-frota.vue`, que já está com 1.243 linhas.

**Tech Stack:** Vue 3 (`<script setup>`), Vite, Supabase (Postgres + RLS + Edge Functions em Deno), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md`

## Global Constraints

- **Português literal, sem jargão**, em todo texto que o usuário lê. Mensagem de erro diz o que fazer, não o que falhou.
- **Nunca chutar dado.** Campo sem resposta volta `null` e a tela mostra travessão com a explicação do porquê. Vale para hodômetro, para quilometragem e para quem estava com o carro.
- **Dinheiro em centavos** (`bigint`), nunca float. Não há dinheiro nesta fase, mas a regra vale se aparecer.
- **Permissão e notificação nascem desmarcadas.** Chave nova sobe concedida a ninguém. Não escrever migration que conceda acesso.
- **Comentário explica o PORQUÊ**, não o quê — é o padrão de todo arquivo deste módulo. Comentar a decisão e o defeito que ela evita.
- **Datas como texto `YYYY-MM-DD`** e contas em UTC (`Date.UTC`). Usar o fuso local faz a data virar no horário errado e o checklist de sexta cair no sábado.
- **Rodar `npm test` antes de todo commit.** Ele inclui a guarda `src/compartilhado/estilo-alcanca-o-runtime.test.mjs`, que reprova regra de CSS escopado mirando classe criada por JavaScript.
- **Migrations** rodam com `node coletor/run-acessos-sql.mjs <arquivo>`; consultas de conferência com `node coletor/consultar.mjs "<select>"`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/migrations/acessos/028_frota_checklist.sql` | **Criar:** as 4 tabelas, o campo `tipo` em `frota_uso`, e a semente dos 21 itens |
| `supabase/functions/_shared/checklist.js` | **Criar:** que cadências o dia pede, que itens entram na ficha, se o hodômetro vale, e quem falta hoje. **Mora aqui, não em `src/`**, porque o robô da Task 12 precisa dele e a Edge não alcança `src/` — enquanto o front alcança o `_shared`. É o caminho que `tela-de-admin.vue:156` já usa pra `notificacoes.js`, "pra não haver duas verdades sobre". Um arquivo, dois consumidores. |
| `supabase/functions/_shared/checklist.test.mjs` | **Criar:** o teste do acima |
| `src/ferramentas/frota/posse.js` | **Criar:** passar o carro para outra pessoa, e quem estava com ele numa data |
| `src/ferramentas/frota/posse.test.mjs` | **Criar:** o teste do acima |
| `src/ferramentas/frota/estado-do-veiculo.js` | **Modificar:** o km também vem do hodômetro; "na rua" só vale para uso do tipo viagem |
| `src/ferramentas/frota/painel-de-checklist.vue` | **Criar:** o cartão que o motorista preenche |
| `src/ferramentas/frota/editor-de-checklist.vue` | **Criar:** a lista editável e os dias, na aba Gestão |
| `src/ferramentas/frota/tela-de-frota.vue` | **Modificar:** carregar as tabelas novas e encaixar os dois componentes |
| `supabase/functions/_shared/notificacoes.js` | **Modificar:** o tipo `frota` |
| `supabase/functions/_shared/aviso-de-checklist.js` | **Criar:** o texto do aviso (puro) |
| `supabase/functions/_shared/aviso-de-checklist.test.mjs` | **Criar:** o teste do acima |
| `supabase/functions/enviar-push-frota/index.ts` | **Criar:** o robô da manhã |

**Ordem das fases:** Tarefas 1–9 são a F6a (entrega valor sozinha). Tarefa 10 é a F6b (posse contínua, que destrava as multas). Tarefas 11–12 são a F6c (o aviso e a cobrança por push).

---

### Task 1: A migration 028

**Files:**
- Create: `db/migrations/acessos/028_frota_checklist.sql`

**Interfaces:**
- Consumes: `public.frota_veiculos`, `public.frota_uso`, `public.acessos_pessoas`, `public.is_frota_admin()` — todos já existem (migrations 022–027).
- Produces: tabelas `frota_checklist_itens`, `frota_checklist_config`, `frota_checklist`, `frota_checklist_respostas`, e a coluna `frota_uso.tipo`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Frota F6: o checklist de primeiro escalão, e a posse contínua.
-- Desenho em docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md
--
-- POR QUE ESTA FASE EXISTE: com a F1 no ar e 7 pessoas já com a permissão
-- liberada, frota_uso tinha ZERO linhas. A viagem é a unidade de medida errada
-- pra quem dirige o mesmo carro todo dia — ninguém "retira" e "devolve" o
-- próprio carro. O checklist diário traz o HODÔMETRO, que é o número do qual o
-- alerta de revisão e o custo por km dependem, e que hoje não existe em carro
-- nenhum.

-- ── frota_uso passa a guardar POSSE, além de viagem (D9) ───────────────────
-- Sem este campo a posse aberta do dono fixo faria o carro aparecer
-- eternamente "na rua": estadoDoVeiculo() chama de na-rua QUALQUER uso aberto.
alter table public.frota_uso add column if not exists tipo text not null default 'viagem';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'frota_uso_tipo_valido') then
    alter table public.frota_uso add constraint frota_uso_tipo_valido
      check (tipo in ('viagem','posse'));
  end if;
end $$;
create index if not exists idx_frota_uso_tipo on public.frota_uso(veiculo_id, tipo, volta_em);

-- ── A lista de itens, que é do GESTOR e não do código (D10) ────────────────
create table if not exists public.frota_checklist_itens(
  id uuid primary key default gen_random_uuid(),
  ordem int not null default 0,
  -- Único: dois itens com o mesmo nome dariam duas perguntas iguais na mesma
  -- ficha. É a mesma trava que problemasDoItem() faz no plano de revisão.
  item text not null unique,
  cadencia text not null check (cadencia in ('diario','semanal','mensal')),
  ativo boolean not null default true,
  observacao text
);

-- ── Em que dia caem o semanal e o mensal (D11) ─────────────────────────────
-- Decisão do dono: NENHUM DIA PESADO. O semanal não se empilha no diário de
-- segunda; ele tem dia próprio (sexta), e o mensal cai na 1ª quarta-feira.
-- Os dois nunca colidem, porque primeira quarta nunca é sexta.
--
-- Linha única: `id boolean primary key check (id)` garante que não existirá uma
-- segunda configuração pra alguém editar por engano e não entender por que a
-- mudança não pegou.
create table if not exists public.frota_checklist_config(
  id boolean primary key default true check (id),
  dia_semanal int not null default 5 check (dia_semanal between 1 and 5),
  semana_mensal int not null default 1 check (semana_mensal between 1 and 4),
  dia_mensal int not null default 3 check (dia_mensal between 1 and 5)
);
insert into public.frota_checklist_config(id) values (true) on conflict (id) do nothing;

-- ── A ficha preenchida ─────────────────────────────────────────────────────
create table if not exists public.frota_checklist(
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.frota_veiculos(id) on delete cascade,
  pessoa_id uuid references public.acessos_pessoas(id) on delete set null,
  pessoa_nome text,
  feita_em date not null,
  cadencias text[] not null default '{diario}',
  -- OBRIGATÓRIO (D15). É o único campo sem "não se aplica": sem ele a ficha
  -- vira papel digitalizado, que é justamente o que já não funcionava.
  hodometro int not null check (hodometro > 0),
  -- Preenchida só quando o número contraria o último conhecido. O caso real:
  -- a planilha trazia o Doblo com 136.172 atual contra troca de óleo em
  -- 272.257, e a importação recusou o dado (importar-frota-manutencao.mjs:16).
  hodometro_justificativa text,
  resultado text not null default 'liberado'
    check (resultado in ('liberado','com_ressalvas','nao_liberado')),
  anomalias text,
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users(id) on delete set null,
  -- UM CARRO, UM DIA, UMA FICHA (D12). Inspecionar o mesmo pneu duas vezes no
  -- mesmo dia não descobre nada, e pedir isso é o caminho mais curto pra
  -- pessoa parar de olhar.
  unique (veiculo_id, feita_em)
);
create index if not exists idx_frota_checklist_data
  on public.frota_checklist(feita_em desc, veiculo_id);

create table if not exists public.frota_checklist_respostas(
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.frota_checklist(id) on delete cascade,
  item_id uuid references public.frota_checklist_itens(id) on delete set null,
  -- CONGELADOS (D13): ficha preenchida é documento. Se o gestor renomear o item
  -- daqui a três meses, a ficha de hoje tem de continuar dizendo o que foi
  -- realmente perguntado hoje — senão o registro passa a mentir sobre o passado
  -- toda vez que a lista muda.
  item_texto text not null,
  cadencia text not null,
  estado text not null check (estado in ('ok','nao_ok','na')),
  observacao text
);
create index if not exists idx_frota_resp_ficha
  on public.frota_checklist_respostas(checklist_id);

-- ── Os 21 itens do PDF, na repartição proposta (D10) ───────────────────────
-- Fonte: checklist_manutencao_primeiro_escalao.pdf.
-- O critério da repartição é ESFORÇO: o diário é o que a pessoa percebe sem
-- esforço nenhum dando a volta no carro. Pedir 21 itens toda manhã produz, em
-- duas semanas, alguém marcando tudo OK sem olhar — e checklist que mente é
-- pior do que checklist nenhum.
insert into public.frota_checklist_itens(ordem, item, cadencia) values
  (1,  'Painel — luzes de advertência',          'diario'),
  (2,  'Vazamentos sob o veículo',               'diario'),
  (3,  'Estado geral dos pneus',                 'diario'),
  (4,  'Limpeza e condições gerais do veículo',  'diario'),
  (10, 'Faróis',                                 'semanal'),
  (11, 'Lanternas',                              'semanal'),
  (12, 'Luzes de freio',                         'semanal'),
  (13, 'Setas / indicadores de direção',         'semanal'),
  (14, 'Buzina',                                 'semanal'),
  (15, 'Limpadores e lavador do para-brisa',     'semanal'),
  (16, 'Retrovisores',                           'semanal'),
  (17, 'Freio de estacionamento',                'semanal'),
  (18, 'Cintos de segurança',                    'semanal'),
  (19, 'Calibragem dos pneus',                   'semanal'),
  (20, 'Nível da água do limpador',              'semanal'),
  (30, 'Nível do óleo do motor',                 'mensal'),
  (31, 'Nível do líquido de arrefecimento',      'mensal'),
  (32, 'Nível do fluido de freio',               'mensal'),
  (33, 'Condição do estepe',                     'mensal'),
  (34, 'Macaco, chave de roda e triângulo',      'mensal'),
  (35, 'Extintor, quando aplicável',             'mensal')
on conflict (item) do nothing;

-- ── Quem pode ler e escrever ───────────────────────────────────────────────
-- Mesmo desenho das migrations 022–027: is_frota_admin() é a porta.
--
-- LIMITAÇÃO CONHECIDA, dita por extenso: is_frota_admin() é verdadeiro pra
-- QUALQUER pessoa com a chave 'frota', sem distinguir ação. A separação entre
-- "quem dirige" e "quem administra" vive no front (areasVisiveis), não aqui —
-- é assim no módulo inteiro desde a 022. Na prática: alguém com acesso à Frota
-- consegue, pela API, editar a lista de itens. Não é regressão, é o estado
-- atual do módulo, e está anotado pra não parecer garantia que não existe.
alter table public.frota_checklist_itens     enable row level security;
alter table public.frota_checklist_config    enable row level security;
alter table public.frota_checklist           enable row level security;
alter table public.frota_checklist_respostas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['frota_checklist_itens','frota_checklist_config',
                           'frota_checklist','frota_checklist_respostas'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_ler') then
      execute format('create policy %I on public.%I for select using (public.is_frota_admin())',
                     t || '_ler', t);
    end if;
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_escrever') then
      execute format('create policy %I on public.%I for all using (public.is_frota_admin()) '
                     || 'with check (public.is_frota_admin())', t || '_escrever', t);
    end if;
  end loop;
end $$;
```

- [ ] **Step 2: Aplicar a migration**

Run: `node coletor/run-acessos-sql.mjs db/migrations/acessos/028_frota_checklist.sql`
Expected: sem erro. O script aplica DDL e não imprime linha nenhuma.

- [ ] **Step 3: Conferir no banco que ficou como se esperava**

Run:
```bash
node coletor/consultar.mjs "
select cadencia, count(*) as itens from public.frota_checklist_itens group by cadencia order by cadencia"
node coletor/consultar.mjs "
select dia_semanal, semana_mensal, dia_mensal from public.frota_checklist_config"
node coletor/consultar.mjs "
select count(*) filter (where tipo='viagem') as viagem from public.frota_uso"
```
Expected: `diario 4`, `mensal 6`, `semanal 11` (21 no total); config `5 / 1 / 3`; `viagem 0` (a tabela está vazia, só confirma que a coluna existe e tem padrão).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/acessos/028_frota_checklist.sql
git commit -m "frota: as tabelas do checklist, e o uso passa a distinguir viagem de posse"
```

---

### Task 2: Que cadências o dia de hoje pede

**Files:**
- Create: `supabase/functions/_shared/checklist.js`
- Test: `supabase/functions/_shared/checklist.test.mjs`

**Interfaces:**
- Consumes: nada. Módulo puro, sem rede e sem Vue.
- Produces: `diaDaSemana(iso) -> 1..7`, `ehDiaDoMensal(iso, config) -> boolean`, `diasEntre(a, b) -> number`, `semanalAtrasado(hoje, ultimaSemanal) -> boolean`, `mensalAtrasado(hoje, ultimaMensal) -> boolean`, `cadenciasDoDia({hoje, config, ultimaSemanal, ultimaMensal}) -> string[]`. Datas sempre texto `'YYYY-MM-DD'`; `config` é `{dia_semanal, semana_mensal, dia_mensal}`.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  diaDaSemana, ehDiaDoMensal, diasEntre,
  semanalAtrasado, mensalAtrasado, cadenciasDoDia,
} from '../../../supabase/functions/_shared/checklist.js'

// Padrão do banco: semanal na sexta, mensal na 1ª quarta-feira.
const CONFIG = { dia_semanal: 5, semana_mensal: 1, dia_mensal: 3 }

test('o dia da semana sai da data em UTC, não do fuso da máquina', () => {
  // 2026-08-05 é uma quarta-feira. Contar no fuso local faria a data virar e a
  // conferência de sexta cair no sábado, quando ninguém trabalha.
  assert.equal(diaDaSemana('2026-08-05'), 3)
  assert.equal(diaDaSemana('2026-08-07'), 5)  // sexta
  assert.equal(diaDaSemana('2026-08-08'), 6)  // sábado
  assert.equal(diaDaSemana('2026-08-09'), 7)  // domingo
})

test('a 1ª quarta-feira do mês é reconhecida, e a 2ª não', () => {
  assert.equal(ehDiaDoMensal('2026-08-05', CONFIG), true)   // 1ª quarta de agosto
  assert.equal(ehDiaDoMensal('2026-08-12', CONFIG), false)  // 2ª quarta
  assert.equal(ehDiaDoMensal('2026-08-07', CONFIG), false)  // sexta, não é quarta
})

test('dias entre duas datas', () => {
  assert.equal(diasEntre('2026-08-01', '2026-08-08'), 7)
  assert.equal(diasEntre('2026-08-08', '2026-08-08'), 0)
})

/* ── O que o dia pede ────────────────────────────────────────────────────── */

test('dia de semana comum pede só o diário', () => {
  // Segunda-feira. O semanal NÃO se empilha aqui — decisão do dono: nenhum dia
  // pesado.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-08-07', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario'])
})

test('sexta pede o diário e o semanal', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-07', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('a 1ª quarta pede o diário e o mensal, e nunca o semanal junto', () => {
  // Primeira quarta nunca é sexta, então os dois pesados jamais colidem.
  const c = cadenciasDoDia({ hoje: '2026-08-05', config: CONFIG,
    ultimaSemanal: '2026-07-31', ultimaMensal: '2026-07-01' })
  assert.deepEqual(c, ['diario', 'mensal'])
})

test('sábado e domingo não pedem nada', () => {
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-08', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
  assert.deepEqual(cadenciasDoDia({ hoje: '2026-08-09', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null }), [])
})

/* ── O atrasado ──────────────────────────────────────────────────────────── */

test('semanal não feito há mais de 7 dias está atrasado e entra no próximo dia útil', () => {
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-29', ultimaMensal: '2026-08-05' })
  assert.deepEqual(c, ['diario', 'semanal'])
})

test('atrasado NÃO acumula: uma semana pulada vira uma conferência, não duas', () => {
  // Vinte dias sem semanal continua devolvendo UM 'semanal'.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: '2026-07-21', ultimaMensal: '2026-08-05' })
  assert.equal(c.filter((x) => x === 'semanal').length, 1)
})

test('nunca feito NÃO conta como atrasado — espera o dia próprio', () => {
  // Se contasse, o primeiro dia da funcionalidade jogaria os 21 itens na cara
  // de todo mundo, que é exatamente o dia pesado que o dono não quis.
  const c = cadenciasDoDia({ hoje: '2026-08-10', config: CONFIG,
    ultimaSemanal: null, ultimaMensal: null })
  assert.deepEqual(c, ['diario'])
})

test('semanalAtrasado e mensalAtrasado isolados', () => {
  assert.equal(semanalAtrasado('2026-08-10', null), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-07'), false)
  assert.equal(semanalAtrasado('2026-08-10', '2026-08-01'), true)
  assert.equal(mensalAtrasado('2026-08-10', null), false)
  assert.equal(mensalAtrasado('2026-08-10', '2026-07-20'), false)
  assert.equal(mensalAtrasado('2026-09-20', '2026-08-05'), true)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: FALHA com `Cannot find module './checklist.js'`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

```js
/* O CHECKLIST DE PRIMEIRO ESCALÃO — o que o dia de hoje pede.
 *
 * Fonte: checklist_manutencao_primeiro_escalao.pdf, 21 itens numa lista só,
 * "antes de cada utilização". Aqui eles se repartem em diário, semanal e
 * mensal, porque um checklist de 21 itens toda manhã produz, em duas semanas,
 * alguém marcando tudo OK sem olhar — e checklist que mente é pior do que
 * checklist nenhum.
 *
 * TUDO EM UTC. As datas são texto 'YYYY-MM-DD'. Usar o fuso da máquina faria a
 * data virar no horário errado e a conferência de sexta cair no sábado. */

export const CADENCIAS = ['diario', 'semanal', 'mensal'];

const num = (iso, de, ate) => Number(String(iso).slice(de, ate));
const utc = (iso) => Date.UTC(num(iso, 0, 4), num(iso, 5, 7) - 1, num(iso, 8, 10));

/** 1 = segunda … 7 = domingo. */
export function diaDaSemana(iso) {
  const n = new Date(utc(iso)).getUTCDay(); // 0 = domingo
  return n === 0 ? 7 : n;
}

/** Quantos dias de `a` até `b`. Negativo se `b` for antes. */
export function diasEntre(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** É o dia em que o mensal cai? Ex.: a 1ª quarta-feira do mês. */
export function ehDiaDoMensal(iso, config) {
  if (diaDaSemana(iso) !== config.dia_mensal) return false;
  // Qual ocorrência daquele dia da semana este é: dia 1 a 7 é a 1ª, 8 a 14 a 2ª.
  const ocorrencia = Math.floor((num(iso, 8, 10) - 1) / 7) + 1;
  return ocorrencia === config.semana_mensal;
}

/* NUNCA FEITO NÃO É ATRASADO. Se fosse, o primeiro dia da funcionalidade
 * jogaria os 21 itens na cara de todo mundo — exatamente o dia pesado que o
 * dono não quis. Sem histórico, espera o dia próprio chegar. */
export function semanalAtrasado(hoje, ultimaSemanal) {
  return !!ultimaSemanal && diasEntre(ultimaSemanal, hoje) > 7;
}
export function mensalAtrasado(hoje, ultimaMensal) {
  return !!ultimaMensal && diasEntre(ultimaMensal, hoje) > 31;
}

/**
 * Quais cadências a ficha de hoje pede.
 * Fim de semana devolve vazio. Dia útil sempre tem o diário; semanal e mensal
 * entram no dia próprio (D11) ou quando estão atrasados — e entram UMA vez,
 * nunca duas: semana pulada vira uma conferência, não duas.
 */
export function cadenciasDoDia({ hoje, config, ultimaSemanal, ultimaMensal }) {
  if (diaDaSemana(hoje) > 5) return [];
  const c = ['diario'];
  if (diaDaSemana(hoje) === config.dia_semanal || semanalAtrasado(hoje, ultimaSemanal)) {
    c.push('semanal');
  }
  if (ehDiaDoMensal(hoje, config) || mensalAtrasado(hoje, ultimaMensal)) {
    c.push('mensal');
  }
  return c;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: PASSA, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs
git commit -m "frota: que cadencias o dia de hoje pede, sem nunca empilhar dois pesados"
```

---

### Task 3: Os itens da ficha, e o hodômetro que não anda para trás

**Files:**
- Modify: `supabase/functions/_shared/checklist.js`
- Test: `supabase/functions/_shared/checklist.test.mjs`

**Interfaces:**
- Consumes: `cadenciasDoDia` da Task 2.
- Produces: `itensDaFicha(itens, cadencias) -> item[]`, `hodometroAceito(novo, ultimoConhecido) -> {ok, precisaJustificar, motivo}`, `problemasDaFicha({hodometro, ultimoKm, justificativa, respostas, itens}) -> string[]`. `respostas` é um objeto `{[itemId]: 'ok'|'nao_ok'|'na'}`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `checklist.test.mjs`, e incluir os três nomes novos no `import` do topo:

```js
/* ── Os itens que entram na ficha ────────────────────────────────────────── */

const ITENS = [
  { id: 'd1', item: 'Painel — luzes de advertência', cadencia: 'diario',  ordem: 1, ativo: true },
  { id: 'd2', item: 'Vazamentos sob o veículo',      cadencia: 'diario',  ordem: 2, ativo: true },
  { id: 'd9', item: 'Item desligado',                cadencia: 'diario',  ordem: 3, ativo: false },
  { id: 's1', item: 'Faróis',                        cadencia: 'semanal', ordem: 10, ativo: true },
  { id: 'm1', item: 'Nível do óleo do motor',        cadencia: 'mensal',  ordem: 30, ativo: true },
]

test('a ficha traz só os itens das cadências do dia, na ordem', () => {
  const f = itensDaFicha(ITENS, ['diario', 'semanal'])
  assert.deepEqual(f.map((i) => i.id), ['d1', 'd2', 's1'])
})

test('item desligado pelo gestor não entra na ficha', () => {
  assert.equal(itensDaFicha(ITENS, ['diario']).some((i) => i.id === 'd9'), false)
})

test('fim de semana: nenhuma cadência, nenhum item', () => {
  assert.deepEqual(itensDaFicha(ITENS, []), [])
})

/* ── O hodômetro ─────────────────────────────────────────────────────────── */

test('hodômetro em branco ou zero não passa', () => {
  assert.equal(hodometroAceito(null, 100000).ok, false)
  assert.equal(hodometroAceito(0, 100000).ok, false)
})

test('primeiro hodômetro do carro passa: não há com o que comparar', () => {
  const r = hodometroAceito(148320, null)
  assert.equal(r.ok, true)
  assert.equal(r.precisaJustificar, false)
})

test('hodômetro que anda para trás não passa, e diz qual era o último', () => {
  // O caso real: a planilha trazia o Doblo com 136.172 atual contra troca de
  // óleo em 272.257, e a importação recusou o dado de propósito.
  const r = hodometroAceito(136172, 272257)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /272\.257/)
})

test('salto grande demais pede confirmação, mas é justificável', () => {
  const r = hodometroAceito(160000, 148000)
  assert.equal(r.ok, false)
  assert.equal(r.precisaJustificar, true)
  assert.match(r.motivo, /12\.000/)
})

test('avanço normal passa liso', () => {
  assert.deepEqual(hodometroAceito(148500, 148320),
    { ok: true, precisaJustificar: false, motivo: '' })
})

/* ── A ficha inteira ─────────────────────────────────────────────────────── */

const DIARIOS = ITENS.filter((i) => i.cadencia === 'diario' && i.ativo)

test('ficha completa e com hodômetro bom não tem problema nenhum', () => {
  assert.deepEqual(problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok', d2: 'nao_ok' }, itens: DIARIOS,
  }), [])
})

test('item sem resposta é problema, e a mensagem diz qual', () => {
  const p = problemasDaFicha({
    hodometro: 148500, ultimoKm: 148320, justificativa: '',
    respostas: { d1: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
  assert.match(p[0], /Vazamentos sob o veículo/)
})

test('hodômetro para trás COM justificativa escrita passa', () => {
  // A trava não impede: ela obriga a pessoa a dizer o que aconteceu, pra o
  // número estranho ficar explicado no registro em vez de virar mistério.
  assert.deepEqual(problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257,
    justificativa: 'Painel trocado na oficina semana passada, zerou.',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  }), [])
})

test('hodômetro para trás com justificativa curta demais NÃO passa', () => {
  const p = problemasDaFicha({
    hodometro: 136172, ultimoKm: 272257, justificativa: 'sei la',
    respostas: { d1: 'ok', d2: 'ok' }, itens: DIARIOS,
  })
  assert.equal(p.length, 1)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: FALHA com `itensDaFicha is not a function`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Acrescentar a `checklist.js`:

```js
/* ── O que entra na ficha ─────────────────────────────────────────────────── */

/** Os itens ativos das cadências pedidas, na ordem que o gestor definiu. */
export function itensDaFicha(itens, cadencias) {
  const quer = new Set(cadencias || []);
  return (itens || [])
    .filter((i) => i && i.ativo !== false && quer.has(i.cadencia))
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/* ── O hodômetro ──────────────────────────────────────────────────────────── */

// Mesmo limiar de problemasDaDevolucao() em estado-do-veiculo.js: 5.000 km numa
// tacada é quase sempre dedo errado, mas viagem longa existe — por isso pede
// confirmação em vez de barrar.
const SALTO_SUSPEITO = 5000;
const km = (n) => Math.abs(n).toLocaleString('pt-BR');

/**
 * O número do painel vale? Devolve { ok, precisaJustificar, motivo }.
 *
 * `precisaJustificar` distingue as duas recusas: número em branco só se
 * corrige, mas número que contraria o histórico pode estar certo (painel
 * trocado, odômetro adulterado pelo dono anterior) e aí a pessoa explica.
 */
export function hodometroAceito(novo, ultimoConhecido) {
  if (!Number.isInteger(novo) || novo <= 0) {
    return { ok: false, precisaJustificar: false,
      motivo: 'Informe o número que está no painel agora.' };
  }
  if (!Number.isInteger(ultimoConhecido)) {
    return { ok: true, precisaJustificar: false, motivo: '' };
  }
  if (novo < ultimoConhecido) {
    return { ok: false, precisaJustificar: true,
      motivo: `O último registro deste carro era ${km(ultimoConhecido)} km, e odômetro não `
        + 'anda para trás. Confira o número — ou explique o que aconteceu.' };
  }
  if (novo - ultimoConhecido > SALTO_SUSPEITO) {
    return { ok: false, precisaJustificar: true,
      motivo: `São ${km(novo - ultimoConhecido)} km desde o último registro. `
        + 'Confirme se está certo, ou explique.' };
  }
  return { ok: true, precisaJustificar: false, motivo: '' };
}

// Justificativa tem de ser uma frase, não um resmungo: "ok" e "sei la" não
// explicam nada pra quem for ler isso daqui a seis meses.
const JUSTIFICATIVA_MINIMA = 10;

/**
 * Valida a ficha ANTES de gravar. Lista vazia significa que pode gravar.
 * `respostas` é { [itemId]: 'ok' | 'nao_ok' | 'na' }.
 */
export function problemasDaFicha({ hodometro, ultimoKm, justificativa, respostas, itens }) {
  const p = [];
  const h = hodometroAceito(hodometro, ultimoKm);
  const explicou = String(justificativa || '').trim().length >= JUSTIFICATIVA_MINIMA;
  if (!h.ok && !(h.precisaJustificar && explicou)) p.push(h.motivo);

  const r = respostas || {};
  const faltando = (itens || []).filter((i) => !r[i.id]);
  if (faltando.length === 1) p.push(`Falta responder "${faltando[0].item}".`);
  else if (faltando.length > 1) p.push(`Faltam ${faltando.length} itens sem resposta.`);
  return p;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: PASSA, 22 testes.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs
git commit -m "frota: o hodometro nao anda pra tras, e a ficha nao grava pela metade"
```

---

### Task 4: Quem falta fazer o checklist hoje

**Files:**
- Modify: `supabase/functions/_shared/checklist.js`
- Test: `supabase/functions/_shared/checklist.test.mjs`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces: `quemFaltaHoje({veiculos, fichasDeHoje, pessoas}) -> [{veiculo, dono, donoId, fez}]` e `resumoDaCobranca(linhas) -> string`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `checklist.test.mjs`, e incluir `quemFaltaHoje` e `resumoDaCobranca` no `import`:

```js
/* ── A cobrança ──────────────────────────────────────────────────────────── */

const VEICULOS = [
  { id: 'v1', nome: 'VOLVO XC60',  pessoa_id: 'p1', situacao: 'ativo' },
  { id: 'v2', nome: 'FIAT PUNTO',  pessoa_id: 'p2', situacao: 'ativo' },
  { id: 'v3', nome: 'HONDA FIT',   pessoa_id: null, situacao: 'ativo' },
  { id: 'v4', nome: 'FIAT BRAVO',  pessoa_id: 'p3', situacao: 'em_manutencao' },
]
const PESSOAS = [
  { id: 'p1', nome: 'Humberto Mendonça' },
  { id: 'p2', nome: 'Marcus Vinicius' },
  { id: 'p3', nome: 'Erick Martins' },
]

test('carro sem dono fixo não entra na cobrança', () => {
  // O Honda Fit fica no Barracão, não com alguém. Cobrar dele acusaria todo
  // dia um carro que ninguém usou, e o quadro viraria ruído.
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: PESSOAS })
  assert.equal(l.some((x) => x.veiculo.id === 'v3'), false)
})

test('carro na oficina não entra na cobrança', () => {
  const l = quemFaltaHoje({ veiculos: VEICULOS, fichasDeHoje: [], pessoas: PESSOAS })
  assert.equal(l.some((x) => x.veiculo.id === 'v4'), false)
})

test('quem não fez aparece primeiro, com o nome do dono', () => {
  const l = quemFaltaHoje({
    veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }],
  })
  assert.equal(l.length, 2)
  assert.equal(l[0].veiculo.id, 'v2')
  assert.equal(l[0].fez, false)
  assert.equal(l[0].dono, 'Marcus Vinicius')
  assert.equal(l[1].fez, true)
})

test('dono que saiu do cadastro não quebra a linha — o carro continua cobrado', () => {
  const l = quemFaltaHoje({
    veiculos: [{ id: 'v9', nome: 'X', pessoa_id: 'sumiu', situacao: 'ativo' }],
    fichasDeHoje: [], pessoas: PESSOAS,
  })
  assert.equal(l[0].dono, null)
  assert.equal(l[0].fez, false)
})

test('o resumo conta quem falta, e comemora quando não falta ninguém', () => {
  const todos = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }, { veiculo_id: 'v2' }] })
  assert.equal(resumoDaCobranca(todos), 'Todos os carros com dono já foram conferidos hoje.')
  const um = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS,
    fichasDeHoje: [{ veiculo_id: 'v1' }] })
  assert.equal(resumoDaCobranca(um), '1 carro ainda sem checklist hoje.')
  const nenhum = quemFaltaHoje({ veiculos: VEICULOS, pessoas: PESSOAS, fichasDeHoje: [] })
  assert.equal(resumoDaCobranca(nenhum), '2 carros ainda sem checklist hoje.')
})

test('sem carro com dono nenhum, o resumo não mente dizendo que está tudo certo', () => {
  assert.equal(resumoDaCobranca([]), 'Nenhum carro com dono fixo cadastrado.')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: FALHA com `quemFaltaHoje is not a function`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Acrescentar a `checklist.js`:

```js
/* ── A cobrança (D16) ─────────────────────────────────────────────────────── */

/**
 * Quem fez e quem não fez o checklist hoje.
 *
 * Só entra carro COM DONO FIXO e ativo: carro de rodízio não tem de quem
 * cobrar (a ficha dele acontece quando alguém pega), e cobrar dele acusaria
 * todo dia um carro que ninguém usou — o quadro viraria ruído e ninguém
 * olharia mais.
 */
export function quemFaltaHoje({ veiculos, fichasDeHoje, pessoas }) {
  const comFicha = new Set((fichasDeHoje || []).map((f) => f && f.veiculo_id));
  return (veiculos || [])
    .filter((v) => v && v.pessoa_id && v.situacao === 'ativo')
    .map((v) => {
      const dono = (pessoas || []).find((p) => p && p.id === v.pessoa_id);
      return { veiculo: v, donoId: v.pessoa_id, dono: dono ? dono.nome : null,
        fez: comFicha.has(v.id) };
    })
    .sort((a, b) => (a.fez === b.fez
      ? String(a.veiculo.nome || '').localeCompare(String(b.veiculo.nome || ''))
      : (a.fez ? 1 : -1)));
}

/** A frase do topo do quadro. Nunca diz "tudo certo" sobre o que não sabe. */
export function resumoDaCobranca(linhas) {
  const l = linhas || [];
  if (!l.length) return 'Nenhum carro com dono fixo cadastrado.';
  const faltam = l.filter((x) => !x.fez).length;
  if (!faltam) return 'Todos os carros com dono já foram conferidos hoje.';
  return faltam === 1
    ? '1 carro ainda sem checklist hoje.'
    : `${faltam} carros ainda sem checklist hoje.`;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: PASSA, 28 testes.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs
git commit -m "frota: o quadro de quem ainda nao fez o checklist de hoje"
```

---

### Task 5: O km do carro passa a vir também do hodômetro

**Files:**
- Modify: `src/ferramentas/frota/estado-do-veiculo.js:22-74`
- Test: `src/ferramentas/frota/estado-do-veiculo.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `ultimoHodometro(fichas, veiculoId) -> number|null`; `usoAberto(usos, veiculoId)` passa a ignorar uso de `tipo: 'posse'`; `estadoDoVeiculo(veiculo, usos, fichas)` ganha um terceiro parâmetro opcional (padrão `[]`), mantendo compatível quem chama com dois.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `estado-do-veiculo.test.mjs`, e incluir `ultimoHodometro` no `import` do topo:

```js
/* ── O km também vem do checklist (F6) ───────────────────────────────────── */

test('o hodômetro do checklist vira a quilometragem do carro', () => {
  // É o ponto da fase inteira: sem checklist, este carro não tem km nenhum,
  // porque ninguém registra viagem.
  const e = estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, [],
    [{ veiculo_id: 'v1', feita_em: '2026-08-05', hodometro: 148320 }])
  assert.equal(e.km, 148320)
})

test('entre devolução e checklist, vale o MAIOR — odômetro só anda pra frente', () => {
  const usos = [{ veiculo_id: 'v1', saida_em: '2026-08-01', volta_em: '2026-08-02', km_volta: 140000 }]
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-05', hodometro: 148320 }]
  assert.equal(estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, usos, fichas).km, 148320)
  const antigas = [{ veiculo_id: 'v1', feita_em: '2026-07-01', hodometro: 130000 }]
  assert.equal(estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, usos, antigas).km, 140000)
})

test('ficha de outro carro não conta', () => {
  assert.equal(ultimoHodometro([{ veiculo_id: 'v2', hodometro: 999999 }], 'v1'), null)
  assert.equal(ultimoHodometro([], 'v1'), null)
  assert.equal(ultimoHodometro(null, 'v1'), null)
})

test('chamar com dois argumentos continua funcionando', () => {
  const e = estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, [])
  assert.equal(e.km, null)
})

/* ── Posse não é "na rua" (D9) ───────────────────────────────────────────── */

test('posse aberta do dono fixo NÃO deixa o carro eternamente na rua', () => {
  // Sem esta distinção, o Volvo do Humberto apareceria "na rua com Humberto"
  // para sempre, e o botão de devolver ficaria aceso sem fim.
  const usos = [{ veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p1',
    pessoa_nome: 'Humberto', saida_em: '2026-08-05', volta_em: null }]
  const e = estadoDoVeiculo({ id: 'v1', situacao: 'ativo', pessoa_id: 'p1' }, usos)
  assert.equal(e.naRua, false)
})

test('viagem aberta continua sendo na rua', () => {
  const usos = [{ veiculo_id: 'v1', tipo: 'viagem', pessoa_id: 'p2',
    pessoa_nome: 'Marcus', saida_em: '2026-08-05', volta_em: null, km_saida: 1000 }]
  assert.equal(estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, usos).naRua, true)
})

test('linha antiga sem o campo tipo é tratada como viagem', () => {
  // As linhas gravadas antes da migration 028 não têm `tipo`. Tratá-las como
  // posse faria carro na rua sumir da lista de quem está fora.
  const usos = [{ veiculo_id: 'v1', pessoa_id: 'p2', saida_em: '2026-08-05', volta_em: null }]
  assert.equal(estadoDoVeiculo({ id: 'v1', situacao: 'ativo' }, usos).naRua, true)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx node --test src/ferramentas/frota/estado-do-veiculo.test.mjs`
Expected: FALHA — `ultimoHodometro is not a function`, e o teste da posse falha porque `naRua` volta `true`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Em `estado-do-veiculo.js`, trocar `usoAberto` e `estadoDoVeiculo` e acrescentar `ultimoHodometro`:

```js
/** O uso ainda aberto de um veículo — o que está na rua agora.
 *
 * SÓ VIAGEM. A posse do dono fixo (F6/D9) também é uma linha aberta, e contá-la
 * aqui faria o Volvo do Humberto aparecer "na rua com Humberto" para sempre,
 * com o botão de devolver aceso sem fim. Linha sem `tipo` é anterior à
 * migration 028 e vale como viagem. */
export function usoAberto(usos, veiculoId) {
  return (usos || []).find((u) =>
    u && u.veiculo_id === veiculoId && !u.volta_em
    && (u.tipo || 'viagem') === 'viagem') || null;
}

/** O maior hodômetro já registrado em checklist deste carro. Nulo se não há.
 *
 * Pelo MAIOR e não pela data mais nova, pela mesma razão de ultimaRevisao():
 * data digitada errada acontece o tempo todo, e o odômetro só anda pra frente. */
export function ultimoHodometro(fichas, veiculoId) {
  const meus = (fichas || [])
    .filter((f) => f && f.veiculo_id === veiculoId && Number.isInteger(f.hodometro))
    .map((f) => f.hodometro);
  return meus.length ? Math.max(...meus) : null;
}
```

E dentro de `estadoDoVeiculo`, mudar a assinatura e a linha do km:

```js
export function estadoDoVeiculo(veiculo, usos, fichas) {
  const aberto = usoAberto(usos, veiculo.id);
  const fechado = ultimoUsoFechado(usos, veiculo.id);
  // O KM mais alto que se conhece. Agora com três fontes: a última devolução, a
  // saída de quem está na rua, e o hodômetro do checklist — que é a única que
  // funciona pra quem tem carro fixo e nunca registra viagem.
  const kms = [
    fechado && fechado.km_volta,
    aberto && aberto.km_saida,
    ultimoHodometro(fichas, veiculo.id),
  ].filter(Number.isInteger);
  const km = kms.length ? Math.max(...kms) : null;
```

O resto do corpo da função fica igual.

- [ ] **Step 4: Rodar a suíte inteira e ver passar**

Run: `npm test`
Expected: PASSA. Rodar tudo aqui, e não só o arquivo, porque `estadoDoVeiculo` é usado por `areas-da-frota` e pela tela.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/frota/estado-do-veiculo.js src/ferramentas/frota/estado-do-veiculo.test.mjs
git commit -m "frota: a quilometragem passa a vir do hodometro do checklist"
```

---

### Task 6: O cartão que o motorista preenche

**Files:**
- Create: `src/ferramentas/frota/painel-de-checklist.vue`
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: `cadenciasDoDia`, `itensDaFicha`, `problemasDaFicha`, `hodometroAceito` da `checklist.js`.
- Produces: componente `<PainelDeChecklist :veiculo :itens :config :ultimaSemanal :ultimaMensal :ultimoKm :hoje @gravar />`. O evento `gravar` emite `{ ficha, respostas }` prontos para o `insert`, onde `ficha` traz `veiculo_id, feita_em, cadencias, hodometro, hodometro_justificativa, resultado, anomalias` e `respostas` é um array de `{ item_id, item_texto, cadencia, estado, observacao }`.

- [ ] **Step 1: Criar o componente**

```vue
<script setup>
/* O checklist do dia, como o motorista preenche.
 *
 * Componente separado de propósito: tela-de-frota.vue já tem 1.243 linhas e
 * quatro áreas. Enfiar o checklist lá dentro deixaria o arquivo grande demais
 * pra qualquer um (pessoa ou máquina) segurar na cabeça de uma vez.
 *
 * Toda a decisão de O QUE perguntar mora em checklist.js, testado. Aqui só tem
 * tela. */
import { ref, reactive, computed } from 'vue'
import { cadenciasDoDia, itensDaFicha, problemasDaFicha, hodometroAceito } from '../../../supabase/functions/_shared/checklist.js'

const props = defineProps({
  veiculo: { type: Object, required: true },
  itens: { type: Array, default: () => [] },
  config: { type: Object, required: true },
  ultimaSemanal: { type: String, default: null },
  ultimaMensal: { type: String, default: null },
  ultimoKm: { type: Number, default: null },
  hoje: { type: String, required: true },
  gravando: { type: Boolean, default: false },
})
const emit = defineEmits(['gravar'])

const cadencias = computed(() => cadenciasDoDia({
  hoje: props.hoje, config: props.config,
  ultimaSemanal: props.ultimaSemanal, ultimaMensal: props.ultimaMensal,
}))
const daFicha = computed(() => itensDaFicha(props.itens, cadencias.value))

const respostas = reactive({})
const hodometro = ref('')
const justificativa = ref('')
const anomalias = ref('')
const resultado = ref('liberado')
const erros = ref([])

const hodometroNumero = computed(() => {
  const n = parseInt(String(hodometro.value).replace(/\D/g, ''), 10)
  return Number.isInteger(n) ? n : null
})
// O aviso aparece enquanto a pessoa digita, não só ao gravar: descobrir o
// problema depois de responder 15 itens é o jeito de fazer ela desistir.
const avisoDoHodometro = computed(() => {
  if (hodometro.value === '') return null
  const r = hodometroAceito(hodometroNumero.value, props.ultimoKm)
  return r.ok ? null : r
})

const titulo = computed(() => {
  if (cadencias.value.includes('mensal')) return 'Checklist de hoje · com a conferência do mês'
  if (cadencias.value.includes('semanal')) return 'Checklist de hoje · com a conferência da semana'
  return 'Checklist de hoje'
})

function gravar() {
  erros.value = problemasDaFicha({
    hodometro: hodometroNumero.value, ultimoKm: props.ultimoKm,
    justificativa: justificativa.value, respostas, itens: daFicha.value,
  })
  if (erros.value.length) return
  emit('gravar', {
    ficha: {
      veiculo_id: props.veiculo.id,
      feita_em: props.hoje,
      cadencias: cadencias.value,
      hodometro: hodometroNumero.value,
      hodometro_justificativa: justificativa.value.trim() || null,
      resultado: resultado.value,
      anomalias: anomalias.value.trim() || null,
    },
    respostas: daFicha.value.map((i) => ({
      item_id: i.id,
      item_texto: i.item,
      cadencia: i.cadencia,
      estado: respostas[i.id],
      observacao: null,
    })),
  })
}
</script>

<template>
  <section class="ck" v-if="daFicha.length">
    <header class="ck-topo">
      <h2 class="ck-titulo">{{ titulo }}</h2>
      <span class="ck-carro">{{ veiculo.nome }} · {{ veiculo.placa }}</span>
    </header>

    <label class="ck-campo">
      <span class="ck-lab">Quilometragem do painel</span>
      <input v-model="hodometro" type="text" inputmode="numeric" placeholder="148320">
    </label>
    <p class="ck-aviso" v-if="avisoDoHodometro">{{ avisoDoHodometro.motivo }}</p>
    <label class="ck-campo" v-if="avisoDoHodometro && avisoDoHodometro.precisaJustificar">
      <span class="ck-lab">O que aconteceu</span>
      <input v-model="justificativa" type="text"
             placeholder="Ex.: painel trocado na oficina, o odômetro zerou">
    </label>

    <ul class="ck-itens">
      <li v-for="i in daFicha" :key="i.id" class="ck-item">
        <span class="ck-item-nome">{{ i.item }}</span>
        <div class="ck-opcoes">
          <button type="button" class="ck-op" :class="{ marcado: respostas[i.id] === 'ok' }"
                  @click="respostas[i.id] = 'ok'">OK</button>
          <button type="button" class="ck-op ruim" :class="{ marcado: respostas[i.id] === 'nao_ok' }"
                  @click="respostas[i.id] = 'nao_ok'">Não OK</button>
          <button type="button" class="ck-op" :class="{ marcado: respostas[i.id] === 'na' }"
                  @click="respostas[i.id] = 'na'">Não se aplica</button>
        </div>
      </li>
    </ul>

    <label class="ck-campo">
      <span class="ck-lab">Anomalias e providências</span>
      <textarea v-model="anomalias" rows="2"
                placeholder="Só se tiver algo a dizer"></textarea>
    </label>

    <div class="ck-resultado">
      <button type="button" class="ck-op" :class="{ marcado: resultado === 'liberado' }"
              @click="resultado = 'liberado'">Liberado</button>
      <button type="button" class="ck-op" :class="{ marcado: resultado === 'com_ressalvas' }"
              @click="resultado = 'com_ressalvas'">Com ressalvas</button>
      <button type="button" class="ck-op ruim" :class="{ marcado: resultado === 'nao_liberado' }"
              @click="resultado = 'nao_liberado'">Não liberado</button>
    </div>
    <!-- O carro NUNCA trava (D14). Dizer isso na tela evita a pessoa não marcar
         "não liberado" com medo de deixar a empresa a pé. -->
    <p class="ck-nota">
      Marcar "não liberado" não tira o carro de ninguém — só avisa quem administra.
    </p>

    <ul class="ck-erros" v-if="erros.length">
      <li v-for="e in erros" :key="e">{{ e }}</li>
    </ul>
    <button class="ck-gravar" :disabled="gravando" @click="gravar">
      {{ gravando ? 'Gravando…' : 'Gravar checklist' }}
    </button>
  </section>
</template>

<style scoped>
.ck { border: 1px solid var(--borda, #e3e3e3); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.ck-topo { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 12px; }
.ck-titulo { font-size: 1rem; font-weight: 700; margin: 0; }
.ck-carro { font-size: .85rem; opacity: .7; }
.ck-campo { display: block; margin-bottom: 10px; }
.ck-lab { display: block; font-size: .8rem; opacity: .75; margin-bottom: 4px; }
.ck-campo input, .ck-campo textarea { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--borda, #e3e3e3); font: inherit; }
.ck-aviso { font-size: .85rem; color: #a15c00; margin: 0 0 10px; }
.ck-itens { list-style: none; padding: 0; margin: 0 0 12px; }
.ck-item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--borda, #eee); }
.ck-item-nome { flex: 1 1 180px; }
.ck-opcoes, .ck-resultado { display: flex; flex-wrap: wrap; gap: 6px; }
.ck-op { padding: 6px 10px; border-radius: 999px; border: 1px solid var(--borda, #ddd); background: transparent; font: inherit; cursor: pointer; }
.ck-op.marcado { background: #1c7c3f; border-color: #1c7c3f; color: #fff; }
.ck-op.ruim.marcado { background: #a12727; border-color: #a12727; }
.ck-nota { font-size: .8rem; opacity: .7; margin: 8px 0 0; }
.ck-erros { color: #a12727; font-size: .9rem; padding-left: 18px; }
.ck-gravar { margin-top: 12px; width: 100%; padding: 12px; border-radius: 10px; border: 0; background: #111; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.ck-gravar:disabled { opacity: .6; cursor: default; }
@media (max-width: 520px) {
  .ck-item { flex-direction: column; align-items: stretch; }
}
</style>
```

- [ ] **Step 2: Ligar na aba Motorista**

Em `tela-de-frota.vue`, no `<script setup>`:

```js
import PainelDeChecklist from './painel-de-checklist.vue'
import { cadenciasDoDia, quemFaltaHoje, resumoDaCobranca } from '../../../supabase/functions/_shared/checklist.js'
import { ultimoHodometro } from './estado-do-veiculo.js'

const itensDeChecklist = ref([])
const configDeChecklist = ref({ dia_semanal: 5, semana_mensal: 1, dia_mensal: 3 })
const fichas = ref([])

// A data de HOJE em BRT, como texto. `toISOString()` puro daria a data em UTC,
// e depois das 21h no Brasil isso já é o dia seguinte — o checklist de hoje
// apareceria como o de amanhã.
const hoje = computed(() =>
  new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10))

// O carro fixo desta pessoa: é o que ela vai conferir hoje.
const meuCarroFixo = computed(() =>
  veiculos.value.find((v) => v.pessoa_id && v.pessoa_id === euId.value) || null)

const fichaDeHoje = computed(() => !meuCarroFixo.value ? null
  : fichas.value.find((f) => f.veiculo_id === meuCarroFixo.value.id && f.feita_em === hoje.value) || null)

const ultimaDoTipo = (veiculoId, cadencia) => {
  const l = fichas.value
    .filter((f) => f.veiculo_id === veiculoId && (f.cadencias || []).includes(cadencia))
    .map((f) => f.feita_em)
    .sort()
  return l.length ? l[l.length - 1] : null
}
```

Em `carregar()` (linha 46), o destructuring vira `[v, u, p, q, pl, rv, bn, ci, cc, cf]`
e o `Promise.all` ganha três leituras ao fim do array, depois da de
`patrimonio_bens`. A de fichas traz 120 dias — o bastante pra saber quando foi a
última mensal, sem crescer pra sempre:

```js
    sbClient.from('frota_checklist_itens').select('*').order('ordem'),
    sbClient.from('frota_checklist_config').select('*').limit(1),
    sbClient.from('frota_checklist').select('*')
      .gte('feita_em', new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10))
      .order('feita_em', { ascending: false }),
```

E, junto das atribuições que já existem (logo abaixo de `bensVeiculo.value = …`),
seguindo o mesmo padrão tolerante a falha das outras — a tela ainda serve pra
pegar e devolver carro se o checklist não carregar:

```js
  itensDeChecklist.value = ci && !ci.error ? (ci.data || []) : []
  configDeChecklist.value = cc && !cc.error && cc.data?.[0] ? cc.data[0] : configDeChecklist.value
  fichas.value = cf && !cf.error ? (cf.data || []) : []
```

E o `computed` `linhas` (logo depois de `nomeDaPessoa`) passa as fichas como
terceiro argumento:

```js
const linhas = computed(() => ordenarEstados(
  veiculos.value.map((v) => estadoDoVeiculo(
    { ...v, pessoa_nome: nomeDaPessoa(v.pessoa_id) },
    usos.value,
    fichas.value,
  )),
))
```

A gravação:

```js
async function gravarChecklist({ ficha, respostas }) {
  if (gravando.value) return
  gravando.value = true
  const { data, error } = await sbClient.from('frota_checklist')
    .insert({ ...ficha, pessoa_id: euId.value, pessoa_nome: estado.perfil?.nome || null })
    .select('id').single()
  if (!error && data) {
    await sbClient.from('frota_checklist_respostas')
      .insert(respostas.map((r) => ({ ...r, checklist_id: data.id })))
  }
  gravando.value = false
  if (error) {
    falha.value = /duplicate|unique/i.test(error.message || '')
      ? 'O checklist deste carro já foi preenchido hoje.'
      : 'Não consegui gravar o checklist. Confira a conexão e tente de novo.'
    return
  }
  await carregar()
}
```

No `<template>`, dentro do bloco `v-if="area === 'motorista'"`, antes da seção
"Com você agora":

```html
<PainelDeChecklist
  v-if="meuCarroFixo && !fichaDeHoje"
  :veiculo="meuCarroFixo"
  :itens="itensDeChecklist"
  :config="configDeChecklist"
  :ultima-semanal="ultimaDoTipo(meuCarroFixo.id, 'semanal')"
  :ultima-mensal="ultimaDoTipo(meuCarroFixo.id, 'mensal')"
  :ultimo-km="ultimoHodometro(fichas, meuCarroFixo.id)"
  :hoje="hoje"
  :gravando="gravando"
  @gravar="gravarChecklist" />
<p class="fr-aviso" v-else-if="meuCarroFixo && fichaDeHoje">
  Checklist de hoje já feito, com {{ fichaDeHoje.hodometro.toLocaleString('pt-BR') }} km.
</p>
```

- [ ] **Step 3: Rodar a suíte e ver passar**

Run: `npm test`
Expected: PASSA. Confere em especial a guarda `estilo-alcanca-o-runtime`, que
varre todo `.vue` novo.

- [ ] **Step 4: Provar na tela que funciona**

Run: `npm run dev -- --port 5199 --strictPort`

Abrir `http://localhost:5199`, ir na Frota, aba Motorista. Conferir, nesta ordem:
1. O cartão do checklist aparece com **4 itens** (hoje é dia comum) e o campo de quilometragem.
2. Digitar um número **menor** que o último conhecido faz aparecer o aviso e o campo "O que aconteceu".
3. Tentar gravar sem responder um item recusa, dizendo qual item falta pelo nome.
4. Gravar completo grava, e o cartão dá lugar à frase "Checklist de hoje já feito".

Conferir também no banco:
```bash
node coletor/consultar.mjs "
select c.feita_em, c.hodometro, c.resultado, count(r.id) as respostas
from public.frota_checklist c
left join public.frota_checklist_respostas r on r.checklist_id = c.id
group by c.id order by c.feita_em desc limit 5"
```
Expected: uma linha, com `respostas` igual ao número de itens do dia.

- [ ] **Step 5: Commit**

```bash
git add src/ferramentas/frota/painel-de-checklist.vue src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: o motorista preenche o checklist do dia, e o hodometro entra junto"
```

---

### Task 7: O checklist do rodízio, dentro do "Vou usar"

**Files:**
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: `PainelDeChecklist` e `gravarChecklist` da Task 6.
- Produces: nada novo. Reaproveita o componente.

- [ ] **Step 1: Escrever o teste que falha**

Em `supabase/functions/_shared/checklist.test.mjs`, acrescentar (e incluir
`precisaDeChecklist` no `import`):

```js
/* ── Quem precisa preencher, e quando ────────────────────────────────────── */

test('carro sem ficha hoje precisa de checklist ao ser pego', () => {
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas: [], hoje: '2026-08-05' }), true)
})

test('carro que já foi conferido hoje não pede de novo', () => {
  // D12: um carro, um dia, uma ficha. Quem pega depois herda a conferência de
  // quem pegou primeiro.
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-05' }]
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas, hoje: '2026-08-05' }), false)
})

test('ficha de ontem não vale para hoje', () => {
  const fichas = [{ veiculo_id: 'v1', feita_em: '2026-08-04' }]
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas, hoje: '2026-08-05' }), true)
})

test('no fim de semana o rodízio ainda confere o carro antes de sair', () => {
  // O diário é seg-sex, mas quem pega um carro no sábado está prestes a
  // dirigir. O papel manda conferir ANTES DA UTILIZAÇÃO, e isso não tem dia.
  assert.equal(precisaDeChecklist({ veiculoId: 'v1', fichas: [], hoje: '2026-08-08' }), true)
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: FALHA com `precisaDeChecklist is not a function`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Acrescentar a `checklist.js`:

```js
/**
 * Este carro precisa de checklist agora?
 *
 * Vale para quem pega um carro de rodízio. Independe do dia da semana: o papel
 * manda conferir ANTES DA UTILIZAÇÃO, e quem pega um carro no sábado está
 * prestes a dirigir do mesmo jeito. O que o calendário decide é o que a ficha
 * PERGUNTA (cadenciasDoDia); no fim de semana, só o diário.
 */
export function precisaDeChecklist({ veiculoId, fichas, hoje }) {
  return !(fichas || []).some((f) => f && f.veiculo_id === veiculoId && f.feita_em === hoje);
}
```

E, em `cadenciasDoDia`, trocar o retorno de fim de semana para devolver o
diário quando alguém está pegando o carro. Para não mudar o contrato da função,
o parâmetro novo é opcional:

```js
export function cadenciasDoDia({ hoje, config, ultimaSemanal, ultimaMensal, pegandoAgora }) {
  if (diaDaSemana(hoje) > 5) return pegandoAgora ? ['diario'] : [];
  ...
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs`
Expected: PASSA, 32 testes. O teste "sábado e domingo não pedem nada" da Task 2
continua passando, porque ele chama sem `pegandoAgora`.

- [ ] **Step 5: Encaixar no "Vou usar"**

Em `tela-de-frota.vue`, dentro do modal de retirada que `abrirRetirada()` abre,
antes dos campos de KM de saída e tanque:

```html
<PainelDeChecklist
  v-if="retirada.veiculo && precisaDeChecklist({ veiculoId: retirada.veiculo.id, fichas, hoje })"
  :veiculo="retirada.veiculo"
  :itens="itensDeChecklist"
  :config="configDeChecklist"
  :ultima-semanal="ultimaDoTipo(retirada.veiculo.id, 'semanal')"
  :ultima-mensal="ultimaDoTipo(retirada.veiculo.id, 'mensal')"
  :ultimo-km="ultimoHodometro(fichas, retirada.veiculo.id)"
  :hoje="hoje"
  :gravando="gravando"
  @gravar="gravarChecklist" />
```

Importar `precisaDeChecklist` de `./checklist.js` e expor `fichas` e `hoje` ao
template (já estão, da Task 6).

- [ ] **Step 6: Rodar tudo e commitar**

Run: `npm test`
Expected: PASSA.

```bash
git add supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: quem pega carro de rodizio confere antes de sair, como manda o papel"
```

---

### Task 8: A lista e os dias, editáveis na aba Gestão

**Files:**
- Create: `src/ferramentas/frota/editor-de-checklist.vue`
- Modify: `src/ferramentas/frota/tela-de-frota.vue`, `src/ferramentas/frota/areas-da-frota.js`
- Test: `src/ferramentas/frota/areas-da-frota.test.mjs`, `supabase/functions/_shared/checklist.test.mjs`

**Interfaces:**
- Consumes: `CADENCIAS` da `checklist.js`.
- Produces: `problemasDoItemDeChecklist({item, cadencia, existentes, idAtual}) -> string[]`; área nova `'checklist'` em `AREAS`; componente `<EditorDeChecklist :itens :config @salvar-item @alternar-item @salvar-config />`.

- [ ] **Step 1: Escrever o teste que falha**

Em `checklist.test.mjs` (e incluir `problemasDoItemDeChecklist` no `import`):

```js
/* ── O editor da lista ───────────────────────────────────────────────────── */

const EXISTENTES = [
  { id: 'a', item: 'Faróis', cadencia: 'semanal' },
  { id: 'b', item: 'Buzina', cadencia: 'semanal' },
]

test('item bom não tem problema', () => {
  assert.deepEqual(problemasDoItemDeChecklist({
    item: 'Filtro de ar', cadencia: 'mensal', existentes: EXISTENTES, idAtual: null }), [])
})

test('nome vazio ou curto demais não passa', () => {
  assert.equal(problemasDoItemDeChecklist({
    item: '  ', cadencia: 'diario', existentes: [], idAtual: null }).length, 1)
  assert.equal(problemasDoItemDeChecklist({
    item: 'ab', cadencia: 'diario', existentes: [], idAtual: null }).length, 1)
})

test('cadência inventada não passa', () => {
  const p = problemasDoItemDeChecklist({
    item: 'Filtro de ar', cadencia: 'anual', existentes: [], idAtual: null })
  assert.equal(p.length, 1)
})

test('nome repetido não passa, e a mensagem diz por quê', () => {
  // Dois itens com o mesmo nome dariam duas perguntas iguais na mesma ficha.
  const p = problemasDoItemDeChecklist({
    item: 'faróis', cadencia: 'semanal', existentes: EXISTENTES, idAtual: null })
  assert.equal(p.length, 1)
  assert.match(p[0], /já existe/i)
})

test('editar o próprio item sem trocar o nome passa', () => {
  assert.deepEqual(problemasDoItemDeChecklist({
    item: 'Faróis', cadencia: 'diario', existentes: EXISTENTES, idAtual: 'a' }), [])
})
```

Em `areas-da-frota.test.mjs`:

```js
test('a área Checklist só aparece pra quem administra', () => {
  assert.equal(areasVisiveis(() => false).includes('checklist'), false)
  assert.equal(areasVisiveis((a) => a === 'criar').includes('checklist'), true)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx node --test supabase/functions/_shared/checklist.test.mjs src/ferramentas/frota/areas-da-frota.test.mjs`
Expected: FALHA nos dois arquivos.

- [ ] **Step 3: Escrever o mínimo que faz passar**

Em `checklist.js`:

```js
/**
 * Valida um item da lista antes de gravar. Espelha problemasDoItem() do plano
 * de revisão — o gestor mexe nas duas listas e merece a mesma reação.
 */
export function problemasDoItemDeChecklist({ item, cadencia, existentes, idAtual }) {
  const p = [];
  const nome = String(item || '').trim();
  if (!nome) p.push('Dê um nome ao item. Ex.: "Filtro de ar".');
  else if (nome.length < 3) p.push('O nome está curto demais para alguém entender depois.');

  if (!CADENCIAS.includes(cadencia)) {
    p.push('Escolha se o item é conferido todo dia, toda semana ou todo mês.');
  }
  const repetido = (existentes || []).some((e) =>
    e && e.id !== idAtual && String(e.item || '').trim().toLowerCase() === nome.toLowerCase());
  if (nome && repetido) {
    p.push(`Já existe um item chamado "${nome}". Edite o que existe em vez de criar outro igual — `
      + 'dois iguais dariam duas perguntas repetidas na mesma ficha.');
  }
  return p;
}
```

Em `areas-da-frota.js`, acrescentar ao `AREAS` e ao `areasVisiveis`:

```js
export const AREAS = [
  { chave: 'motorista', rotulo: 'Motorista' },
  { chave: 'gestao', rotulo: 'Gestão' },
  { chave: 'revisoes', rotulo: 'Revisões' },
  { chave: 'plano', rotulo: 'Plano' },
  { chave: 'checklist', rotulo: 'Checklist' },
];
```

E na função, trocar a linha do push:

```js
  // Checklist anda junto com Plano: as duas são listas que o gestor edita.
  if (p('criar') || p('excluir')) areas.push('gestao', 'revisoes', 'plano', 'checklist');
```

- [ ] **Step 4: Criar o componente do editor**

```vue
<script setup>
/* A lista de itens do checklist e os dias em que o semanal e o mensal caem.
 *
 * Igual ao plano de revisão: a repartição é do GESTOR, não do código. O
 * mecânico muda de opinião, a frota muda, e a lista tem que acompanhar sem
 * depender de programador. */
import { ref, reactive, computed } from 'vue'
import { CADENCIAS, problemasDoItemDeChecklist } from '../../../supabase/functions/_shared/checklist.js'

const props = defineProps({
  itens: { type: Array, default: () => [] },
  config: { type: Object, required: true },
  gravando: { type: Boolean, default: false },
})
const emit = defineEmits(['salvar-item', 'alternar-item', 'salvar-config'])

const ROTULO = { diario: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' }
const DIAS = [
  { valor: 1, nome: 'segunda-feira' }, { valor: 2, nome: 'terça-feira' },
  { valor: 3, nome: 'quarta-feira' }, { valor: 4, nome: 'quinta-feira' },
  { valor: 5, nome: 'sexta-feira' },
]
const SEMANAS = [
  { valor: 1, nome: '1ª' }, { valor: 2, nome: '2ª' },
  { valor: 3, nome: '3ª' }, { valor: 4, nome: '4ª' },
]

const novo = reactive({ item: '', cadencia: 'diario' })
const erros = ref([])
const cfg = reactive({ ...props.config })

const porCadencia = computed(() => CADENCIAS.map((c) => ({
  cadencia: c, rotulo: ROTULO[c],
  itens: props.itens.filter((i) => i.cadencia === c).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
})))

function adicionar() {
  erros.value = problemasDoItemDeChecklist({
    item: novo.item, cadencia: novo.cadencia, existentes: props.itens, idAtual: null })
  if (erros.value.length) return
  emit('salvar-item', { item: novo.item.trim(), cadencia: novo.cadencia,
    ordem: (props.itens.length + 1) * 10 })
  novo.item = ''
}
</script>

<template>
  <section class="ec">
    <h2 class="ec-titulo">Em que dia cai cada conferência</h2>
    <p class="ec-nota">
      O diário é de segunda a sexta. O semanal e o mensal têm dia próprio para
      nenhum dia ficar pesado demais.
    </p>
    <div class="ec-dias">
      <label class="ec-campo">
        <span class="ec-lab">O semanal cai na</span>
        <select v-model.number="cfg.dia_semanal">
          <option v-for="d in DIAS" :key="d.valor" :value="d.valor">{{ d.nome }}</option>
        </select>
      </label>
      <label class="ec-campo">
        <span class="ec-lab">O mensal cai na</span>
        <select v-model.number="cfg.semana_mensal">
          <option v-for="s in SEMANAS" :key="s.valor" :value="s.valor">{{ s.nome }}</option>
        </select>
      </label>
      <label class="ec-campo">
        <span class="ec-lab">do mês, na</span>
        <select v-model.number="cfg.dia_mensal">
          <option v-for="d in DIAS" :key="d.valor" :value="d.valor">{{ d.nome }}</option>
        </select>
      </label>
      <button class="ec-btn" :disabled="gravando" @click="emit('salvar-config', { ...cfg })">
        Salvar os dias
      </button>
    </div>

    <h2 class="ec-titulo">Os itens</h2>
    <div v-for="g in porCadencia" :key="g.cadencia" class="ec-grupo">
      <h3 class="ec-grupo-titulo">{{ g.rotulo }} <span class="ec-conta">{{ g.itens.length }}</span></h3>
      <ul class="ec-lista">
        <li v-for="i in g.itens" :key="i.id" class="ec-item" :class="{ desligado: !i.ativo }">
          <span>{{ i.item }}</span>
          <button class="ec-btn pequeno" :disabled="gravando" @click="emit('alternar-item', i)">
            {{ i.ativo ? 'Desligar' : 'Religar' }}
          </button>
        </li>
      </ul>
    </div>

    <h3 class="ec-grupo-titulo">Acrescentar item</h3>
    <div class="ec-novo">
      <input v-model="novo.item" type="text" placeholder="Ex.: Filtro de ar">
      <select v-model="novo.cadencia">
        <option v-for="c in CADENCIAS" :key="c" :value="c">{{ ROTULO[c] }}</option>
      </select>
      <button class="ec-btn" :disabled="gravando" @click="adicionar">Acrescentar</button>
    </div>
    <ul class="ec-erros" v-if="erros.length"><li v-for="e in erros" :key="e">{{ e }}</li></ul>
  </section>
</template>

<style scoped>
.ec-titulo { font-size: 1rem; font-weight: 700; margin: 20px 0 4px; }
.ec-nota { font-size: .85rem; opacity: .7; margin: 0 0 12px; }
.ec-dias { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 8px; }
.ec-campo { display: block; }
.ec-lab { display: block; font-size: .8rem; opacity: .75; margin-bottom: 4px; }
.ec-campo select, .ec-novo input, .ec-novo select { padding: 8px; border-radius: 8px; border: 1px solid var(--borda, #e3e3e3); font: inherit; }
.ec-grupo-titulo { font-size: .9rem; font-weight: 600; margin: 16px 0 6px; }
.ec-conta { opacity: .6; font-weight: 400; }
.ec-lista { list-style: none; padding: 0; margin: 0; }
.ec-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--borda, #eee); }
.ec-item.desligado span { opacity: .45; text-decoration: line-through; }
.ec-novo { display: flex; flex-wrap: wrap; gap: 8px; }
.ec-novo input { flex: 1 1 200px; }
.ec-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--borda, #ddd); background: transparent; font: inherit; cursor: pointer; }
.ec-btn.pequeno { padding: 4px 10px; font-size: .85rem; }
.ec-btn:disabled { opacity: .6; cursor: default; }
.ec-erros { color: #a12727; font-size: .9rem; padding-left: 18px; }
</style>
```

- [ ] **Step 5: Ligar na tela**

Em `tela-de-frota.vue`, importar `EditorDeChecklist`, acrescentar as três funções
e o bloco de template:

```js
import EditorDeChecklist from './editor-de-checklist.vue'

async function salvarItemDeChecklist(dados) {
  const { error } = await sbClient.from('frota_checklist_itens').insert(dados)
  if (!error) carregar()
}
async function alternarItemDeChecklist(i) {
  const { error } = await sbClient.from('frota_checklist_itens')
    .update({ ativo: !i.ativo }).eq('id', i.id)
  if (!error) carregar()
}
async function salvarConfigDeChecklist(cfg) {
  const { error } = await sbClient.from('frota_checklist_config')
    .update({ dia_semanal: cfg.dia_semanal, semana_mensal: cfg.semana_mensal,
      dia_mensal: cfg.dia_mensal }).eq('id', true)
  if (!error) carregar()
}
```

```html
<EditorDeChecklist
  v-if="area === 'checklist' && !carregando && !falha"
  :itens="itensDeChecklist" :config="configDeChecklist" :gravando="gravando"
  @salvar-item="salvarItemDeChecklist"
  @alternar-item="alternarItemDeChecklist"
  @salvar-config="salvarConfigDeChecklist" />
```

- [ ] **Step 6: Rodar tudo, conferir na tela e commitar**

Run: `npm test`
Expected: PASSA.

Run: `npm run dev -- --port 5199 --strictPort` — abrir a aba Checklist, mudar o
dia do semanal para quinta, salvar, recarregar a página e conferir que ficou
quinta. Desligar um item e conferir que ele some da ficha do dia na aba
Motorista.

```bash
git add src/ferramentas/frota/editor-de-checklist.vue supabase/functions/_shared/checklist.js supabase/functions/_shared/checklist.test.mjs src/ferramentas/frota/areas-da-frota.js src/ferramentas/frota/areas-da-frota.test.mjs src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: a lista do checklist e os dias sao do gestor, nao do codigo"
```

---

### Task 9: O quadro de cobrança na aba Gestão

**Files:**
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: `quemFaltaHoje` e `resumoDaCobranca` da Task 4.
- Produces: nada novo.

- [ ] **Step 1: Acrescentar o cálculo**

Em `tela-de-frota.vue`:

```js
const fichasDeHoje = computed(() => fichas.value.filter((f) => f.feita_em === hoje.value))
const cobranca = computed(() => quemFaltaHoje({
  veiculos: veiculos.value, fichasDeHoje: fichasDeHoje.value, pessoas: pessoas.value }))
```

- [ ] **Step 2: Acrescentar o quadro no template da aba Gestão**

Logo antes da lista de cartões (`<div class="fr-lista" v-else-if="area === 'gestao'">`):

```html
<template v-if="area === 'gestao' && !carregando && !falha">
  <h2 class="fr-secao">Checklist de hoje</h2>
  <p class="fr-aviso">{{ resumoDaCobranca(cobranca) }}</p>
  <ul class="fr-cobranca">
    <li v-for="c in cobranca" :key="c.veiculo.id" :class="{ pendente: !c.fez }">
      <strong>{{ c.veiculo.nome }}</strong>
      <span v-if="c.dono"> · {{ c.dono }}</span>
      <span v-else> · dono saiu do cadastro</span>
      <span class="fr-cobranca-selo">{{ c.fez ? 'feito' : 'falta' }}</span>
    </li>
  </ul>
</template>
```

E o estilo, junto dos outros do arquivo:

```css
.fr-cobranca { list-style: none; padding: 0; margin: 0 0 20px; }
.fr-cobranca li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--borda, #eee); }
.fr-cobranca-selo { margin-left: auto; font-size: .8rem; padding: 2px 10px; border-radius: 999px; background: #e7f2ea; color: #1c7c3f; }
.fr-cobranca li.pendente .fr-cobranca-selo { background: #f7e7e7; color: #a12727; }
```

- [ ] **Step 3: Rodar e conferir**

Run: `npm test`
Expected: PASSA.

Run: `npm run dev -- --port 5199 --strictPort` — na aba Gestão, o quadro lista os
**7 carros com dono** (não o Doblo nem o Honda Fit), com quem já fez em cima.

- [ ] **Step 4: Commit**

```bash
git add src/ferramentas/frota/tela-de-frota.vue
git commit -m "frota: o quadro que mostra quem ainda nao conferiu o carro hoje"
```

---

### Task 10 (F6b): A posse contínua e o passar o carro

**Files:**
- Create: `src/ferramentas/frota/posse.js`, `src/ferramentas/frota/posse.test.mjs`
- Modify: `src/ferramentas/frota/tela-de-frota.vue`

**Interfaces:**
- Consumes: a coluna `frota_uso.tipo` da Task 1.
- Produces: `posseAberta(usos, veiculoId) -> uso|null`, `passarPara({usos, veiculoId, para, quando}) -> {fechar, abrir}`, `quemEstavaCom(usos, veiculoId, quando) -> {pessoa_id, pessoa_nome, uso}|null`, `abrirPossesQueFaltam(veiculos, usos, agora) -> linha[]`.

- [ ] **Step 1: Escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posseAberta, passarPara, quemEstavaCom, abrirPossesQueFaltam } from './posse.js'

const AGORA = '2026-08-05T12:00:00.000Z'

test('a posse aberta de um carro é a linha de posse sem volta', () => {
  const usos = [
    { id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p1', saida_em: '2026-08-01T00:00:00Z', volta_em: null },
    { id: 'u2', veiculo_id: 'v1', tipo: 'viagem', pessoa_id: 'p2', saida_em: '2026-08-04T00:00:00Z', volta_em: null },
  ]
  assert.equal(posseAberta(usos, 'v1').id, 'u1')
  assert.equal(posseAberta(usos, 'v9'), null)
})

test('passar o carro fecha a posse de quem estava e abre a de quem pegou', () => {
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p1', saida_em: '2026-08-01T00:00:00Z', volta_em: null }]
  const r = passarPara({ usos, veiculoId: 'v1', para: { id: 'p2', nome: 'Marcus' }, quando: AGORA })
  assert.deepEqual(r.fechar, { id: 'u1', volta_em: AGORA })
  assert.equal(r.abrir.pessoa_id, 'p2')
  assert.equal(r.abrir.pessoa_nome, 'Marcus')
  assert.equal(r.abrir.tipo, 'posse')
  assert.equal(r.abrir.volta_em, undefined)
})

test('devolver ao dono sem apontar ninguém só fecha a posse', () => {
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', pessoa_id: 'p2', saida_em: '2026-08-01T00:00:00Z', volta_em: null }]
  const r = passarPara({ usos, veiculoId: 'v1', para: null, quando: AGORA })
  assert.deepEqual(r.fechar, { id: 'u1', volta_em: AGORA })
  assert.equal(r.abrir, null)
})

test('carro que nunca teve posse só abre, sem fechar nada', () => {
  const r = passarPara({ usos: [], veiculoId: 'v1', para: { id: 'p1', nome: 'Humberto' }, quando: AGORA })
  assert.equal(r.fechar, null)
  assert.equal(r.abrir.pessoa_id, 'p1')
})

/* ── A pergunta que a multa faz ──────────────────────────────────────────── */

const LINHA_DO_TEMPO = [
  { id: 'a', veiculo_id: 'v1', tipo: 'posse',  pessoa_id: 'p1', pessoa_nome: 'Humberto',
    saida_em: '2026-08-01T00:00:00Z', volta_em: '2026-08-10T00:00:00Z' },
  { id: 'b', veiculo_id: 'v1', tipo: 'posse',  pessoa_id: 'p2', pessoa_nome: 'Marcus',
    saida_em: '2026-08-10T00:00:00Z', volta_em: null },
  { id: 'c', veiculo_id: 'v1', tipo: 'viagem', pessoa_id: 'p3', pessoa_nome: 'Barbara',
    saida_em: '2026-08-14T08:00:00Z', volta_em: '2026-08-14T18:00:00Z' },
]

test('quem estava com o carro numa data', () => {
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-05T10:00:00Z').pessoa_nome, 'Humberto')
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-12T10:00:00Z').pessoa_nome, 'Marcus')
})

test('viagem vence posse: quem pegou emprestado é quem estava dirigindo', () => {
  // É a resposta que a multa precisa. A multa de 14/08 às 15h40 é da Barbara,
  // que pegou o carro emprestado, não do Marcus, que é o dono.
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-08-14T15:40:00Z').pessoa_nome, 'Barbara')
})

test('antes de existir registro, a resposta é NÃO SEI — nunca um chute', () => {
  // Acusar alguém com dado inventado é pior do que não responder.
  assert.equal(quemEstavaCom(LINHA_DO_TEMPO, 'v1', '2026-07-20T10:00:00Z'), null)
  assert.equal(quemEstavaCom([], 'v1', '2026-08-05T10:00:00Z'), null)
})

/* ── A virada de chave ───────────────────────────────────────────────────── */

test('abre uma posse por carro com dono, e nenhuma pros de rodízio', () => {
  const veiculos = [
    { id: 'v1', pessoa_id: 'p1', situacao: 'ativo' },
    { id: 'v2', pessoa_id: null, situacao: 'ativo' },
    { id: 'v3', pessoa_id: 'p3', situacao: 'ativo' },
  ]
  const usos = [{ id: 'u1', veiculo_id: 'v1', tipo: 'posse', volta_em: null, saida_em: '2026-08-01T00:00:00Z' }]
  const novas = abrirPossesQueFaltam(veiculos, usos, AGORA)
  assert.equal(novas.length, 1)
  assert.equal(novas[0].veiculo_id, 'v3')
  assert.equal(novas[0].saida_em, AGORA)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx node --test src/ferramentas/frota/posse.test.mjs`
Expected: FALHA com `Cannot find module './posse.js'`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

```js
/* A POSSE DO CARRO — quem estava com ele, e quando.
 *
 * frota_uso guardava só VIAGEM: sai com tanto km, volta com tanto. Para quem
 * tem carro fixo isso não acontece nunca — ninguém "retira" e "devolve" o
 * próprio carro —, e por isso a tabela ficou vazia com 7 pessoas já tendo
 * acesso.
 *
 * Agora ela guarda também POSSE: uma linha aberta dizendo "este carro está com
 * esta pessoa desde esta data". O resultado é uma linha do tempo sem buraco, e
 * é ela que responde a pergunta que a multa faz — quem dirigia dia 14 às
 * 15h40. Foram R$ 1.301,60 perdidos por não ter essa resposta. */

const ehPosse = (u) => u && u.tipo === 'posse';

/** A posse aberta de um carro: com quem ele está agora. Nula se não há. */
export function posseAberta(usos, veiculoId) {
  return (usos || []).find((u) => ehPosse(u) && u.veiculo_id === veiculoId && !u.volta_em) || null;
}

/**
 * Passar o carro para outra pessoa. Devolve o que gravar:
 * `fechar` é o update na posse de quem estava, `abrir` é o insert da nova.
 * Qualquer um dos dois pode ser nulo — carro novo não tem o que fechar, e
 * devolver sem apontar ninguém não tem o que abrir.
 */
export function passarPara({ usos, veiculoId, para, quando }) {
  const atual = posseAberta(usos, veiculoId);
  return {
    fechar: atual ? { id: atual.id, volta_em: quando } : null,
    abrir: para ? {
      veiculo_id: veiculoId, tipo: 'posse',
      pessoa_id: para.id, pessoa_nome: para.nome, saida_em: quando,
    } : null,
  };
}

/**
 * Quem estava com o carro num instante. Nulo quando não se sabe — e "não sei"
 * é a resposta certa para antes de existir registro. Acusar alguém com dado
 * inventado é pior do que não responder.
 */
export function quemEstavaCom(usos, veiculoId, quando) {
  const t = String(quando);
  const valem = (usos || []).filter((u) =>
    u && u.veiculo_id === veiculoId
    && String(u.saida_em) <= t
    && (!u.volta_em || String(u.volta_em) >= t));
  if (!valem.length) return null;
  // VIAGEM VENCE POSSE: se alguém pegou o carro emprestado naquela hora, quem
  // estava dirigindo é essa pessoa, não o dono.
  const escolhida = valem.find((u) => (u.tipo || 'viagem') === 'viagem') || valem[0];
  return {
    pessoa_id: escolhida.pessoa_id || null,
    pessoa_nome: escolhida.pessoa_nome || null,
    uso: escolhida,
  };
}

/**
 * As posses que faltam abrir, na virada de chave: uma por carro ativo com dono
 * que ainda não tem posse aberta.
 *
 * A POSSE COMEÇA HOJE, NÃO NO PASSADO. Ninguém sabe desde quando cada carro
 * está com cada pessoa, e inventar essa data encheria a linha do tempo de
 * resposta falsa — a multa passaria a acusar alguém com um dado inventado.
 */
export function abrirPossesQueFaltam(veiculos, usos, agora) {
  return (veiculos || [])
    .filter((v) => v && v.pessoa_id && v.situacao === 'ativo' && !posseAberta(usos, v.id))
    .map((v) => ({ veiculo_id: v.id, tipo: 'posse', pessoa_id: v.pessoa_id, saida_em: agora }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx node --test src/ferramentas/frota/posse.test.mjs`
Expected: PASSA, 9 testes.

- [ ] **Step 5: Encaixar na tela — o botão "Passar o carro"**

Em `tela-de-frota.vue`, importar de `./posse.js` e acrescentar:

```js
import { passarPara, posseAberta, abrirPossesQueFaltam } from './posse.js'

const passando = ref(null)      // o veículo cujo passe está aberto
const paraQuem = ref('')        // id da pessoa escolhida

async function confirmarPasse() {
  if (gravando.value || !passando.value) return
  gravando.value = true
  const alvo = pessoas.value.find((p) => p.id === paraQuem.value) || null
  const { fechar, abrir } = passarPara({
    usos: usos.value, veiculoId: passando.value.id,
    para: alvo, quando: new Date().toISOString(),
  })
  if (fechar) await sbClient.from('frota_uso').update({ volta_em: fechar.volta_em }).eq('id', fechar.id)
  if (abrir) await sbClient.from('frota_uso').insert(abrir)
  gravando.value = false
  passando.value = null
  paraQuem.value = ''
  await carregar()
}
```

No `<template>`, na aba Motorista, logo depois do painel de checklist:

```html
<template v-if="meuCarroFixo">
  <h2 class="fr-secao">Seu carro</h2>
  <div class="fr-card">
    <div class="fr-card-topo">
      <div class="fr-card-ident">
        <span class="fr-card-nome">{{ meuCarroFixo.nome }}</span>
        <span class="fr-placa">{{ meuCarroFixo.placa }}</span>
      </div>
    </div>
    <div class="fr-acoes" v-if="passando !== meuCarroFixo">
      <button class="fr-btn" v-if="podeEditar" @click="passando = meuCarroFixo">
        Passar o carro para outra pessoa
      </button>
    </div>
    <!-- Quem empresta o carro registra pra quem. É isto que faz a multa ter
         resposta: sem o passe, a multa cai no nome do dono fixo, que pode não
         ter sido quem dirigiu. -->
    <div class="fr-acoes" v-else>
      <select v-model="paraQuem">
        <option value="">Devolver para mim (fecho o empréstimo)</option>
        <option v-for="p in pessoas" :key="p.id" :value="p.id">{{ p.nome }}</option>
      </select>
      <button class="fr-btn primario" :disabled="gravando" @click="confirmarPasse">Confirmar</button>
      <button class="fr-btn" @click="passando = null; paraQuem = ''">Cancelar</button>
    </div>
  </div>
</template>
```

**Cuidado com o caso de devolver:** escolher a opção vazia fecha a posse de quem
está com o carro e **não abre nenhuma** — o carro fica sem posse aberta. Rodar
`abrirPossesQueFaltam` no `carregar()` seria o conserto automático, mas ele
gravaria escondido; em vez disso, o quadro de cobrança da Task 9 já mostra o
carro como pendente, e o dono reabre a posse pelo mesmo botão.

- [ ] **Step 6: Abrir as posses que faltam, uma vez**

Escrever `coletor/abrir-posses-frota.mjs`, no mesmo molde de `consultar.mjs`
(mesma leitura de `.env` e mesmo `pg.Client` com o CA), rodando:

```js
// Uma posse aberta por carro ativo com dono. Só grava com --gravar; sem a
// bandeira, apenas mostra o que faria.
const { rows: veiculos } = await client.query(
  "select id, pessoa_id, situacao from public.frota_veiculos");
const { rows: usos } = await client.query(
  "select id, veiculo_id, tipo, volta_em, saida_em from public.frota_uso");
const novas = abrirPossesQueFaltam(veiculos, usos, new Date().toISOString());
console.log(`${novas.length} posses a abrir`);
if (process.argv.includes('--gravar')) {
  for (const n of novas) {
    await client.query(
      'insert into public.frota_uso(veiculo_id, tipo, pessoa_id, saida_em) values ($1,$2,$3,$4)',
      [n.veiculo_id, n.tipo, n.pessoa_id, n.saida_em]);
  }
}
```

Run: `node coletor/abrir-posses-frota.mjs`
Expected: imprime `7 posses a abrir` — os 7 carros com dono, sem o Doblo e sem o Honda Fit.

Run: `node coletor/abrir-posses-frota.mjs --gravar`
Expected: grava. Conferir:
```bash
node coletor/consultar.mjs "
select v.nome, p.nome as com_quem, u.saida_em
from public.frota_uso u
join public.frota_veiculos v on v.id = u.veiculo_id
left join public.acessos_pessoas p on p.id = u.pessoa_id
where u.tipo = 'posse' and u.volta_em is null order by v.nome"
```
Expected: 7 linhas. E na tela, **nenhum carro aparece "na rua"** — a Task 5 já
garante isso.

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm test`
Expected: PASSA.

```bash
git add src/ferramentas/frota/posse.js src/ferramentas/frota/posse.test.mjs src/ferramentas/frota/tela-de-frota.vue coletor/abrir-posses-frota.mjs
git commit -m "frota: a posse vira linha do tempo sem buraco, que e o que a multa pergunta"
```

---

### Task 11 (F6c): O tipo de aviso e o texto dele

**Files:**
- Modify: `supabase/functions/_shared/notificacoes.js`
- Create: `supabase/functions/_shared/aviso-de-checklist.js`, `supabase/functions/_shared/aviso-de-checklist.test.mjs`
- Test: `supabase/functions/_shared/notificacoes.test.mjs`

**Interfaces:**
- Consumes: `TIPOS_DE_NOTIFICACAO`, `inscricoesDoTipo` que já existem.
- Produces: o tipo `'frota'`; `montarAviso({veiculo, itens, cadencias}) -> {titulo, corpo}`.

- [ ] **Step 1: Escrever o teste que falha**

`supabase/functions/_shared/aviso-de-checklist.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarAviso } from './aviso-de-checklist.js'
import { ehTipoValido, padraoDoTipo } from './notificacoes.js'

const CARRO = { nome: 'HONDA FIT', placa: 'DUB7D72' }

test('o aviso do dia comum diz quantos itens e cita o hodômetro', () => {
  const a = montarAviso({ veiculo: CARRO, itens: [1, 2, 3, 4], cadencias: ['diario'] })
  assert.equal(a.titulo, 'Checklist do HONDA FIT')
  assert.match(a.corpo, /4 itens e o hodômetro/)
})

test('um item só não vira "1 itens"', () => {
  const a = montarAviso({ veiculo: CARRO, itens: [1], cadencias: ['diario'] })
  assert.match(a.corpo, /^1 item e o hodômetro/)
})

test('o dia da conferência da semana avisa que hoje é mais longo', () => {
  // Quem recebe "15 itens" sem explicação acha que o app quebrou.
  const a = montarAviso({ veiculo: CARRO, itens: new Array(15), cadencias: ['diario', 'semanal'] })
  assert.match(a.corpo, /conferência da semana/)
})

test('o mensal vence o semanal no texto', () => {
  const a = montarAviso({ veiculo: CARRO, itens: new Array(10), cadencias: ['diario', 'mensal'] })
  assert.match(a.corpo, /conferência do mês/)
  assert.doesNotMatch(a.corpo, /da semana/)
})

test('o tipo frota existe e nasce DESLIGADO', () => {
  // Regra da casa: chave nova sobe concedida a ninguém.
  assert.equal(ehTipoValido('frota'), true)
  assert.equal(padraoDoTipo('frota'), false)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx node --test supabase/functions/_shared/aviso-de-checklist.test.mjs`
Expected: FALHA com `Cannot find module './aviso-de-checklist.js'`.

- [ ] **Step 3: Escrever o mínimo que faz passar**

`supabase/functions/_shared/aviso-de-checklist.js`:

```js
/* O TEXTO DO AVISO DO CHECKLIST.
 *
 * Puro, sem rede: a Edge busca os dados e passa pra cá.
 *
 * O texto diz o TAMANHO da tarefa porque é o que decide se a pessoa abre agora
 * ou deixa pra depois — e "depois" é como a tabela de uso ficou vazia. Nos dias
 * da conferência da semana ou do mês ele avisa por que hoje é mais longo: quem
 * recebe "15 itens" sem explicação acha que o app quebrou. */

export function montarAviso({ veiculo, itens, cadencias }) {
  const n = (itens || []).length;
  const quantos = n === 1 ? '1 item' : `${n} itens`;
  const c = cadencias || [];
  const extra = c.includes('mensal') ? ' Hoje tem a conferência do mês junto.'
    : c.includes('semanal') ? ' Hoje tem a conferência da semana junto.'
    : '';
  return {
    titulo: `Checklist do ${veiculo.nome}`,
    corpo: `${quantos} e o hodômetro.${extra}`,
  };
}
```

Em `supabase/functions/_shared/notificacoes.js`, acrescentar ao fim do array
`TIPOS_DE_NOTIFICACAO`:

```js
  {
    chave: 'frota',
    rotulo: 'Checklist do carro',
    descricao: 'De manhã, de segunda a sexta, para quem tem carro fixo e ainda não conferiu hoje.',
    // DESLIGADO por padrão, como toda chave nova nesta central.
    //
    // CONSEQUÊNCIA QUE PRECISA ESTAR DITA: enquanto o dono não ligar isto para
    // os motoristas em Administração › Usuários, NINGUÉM recebe nada. É por
    // isso que o quadro de cobrança na aba Gestão não é enfeite — ele é o que
    // torna a falha visível quando o aviso está desligado.
    padrao: false,
  },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASSA. A tela de Usuários lê `TIPOS_DE_NOTIFICACAO` direto, então o
tipo novo aparece lá sozinho, sem mexer em mais nada.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/notificacoes.js supabase/functions/_shared/aviso-de-checklist.js supabase/functions/_shared/aviso-de-checklist.test.mjs
git commit -m "frota: o tipo de aviso do checklist, nascendo desligado"
```

---

### Task 12 (F6c): O robô da manhã

**Files:**
- Create: `supabase/functions/enviar-push-frota/index.ts`

**Interfaces:**
- Consumes: `montarAviso` (Task 11), `inscricoesDoTipo` (`_shared/notificacoes.js`), `exigirSegredoDeCron` (`_shared/segredo-de-cron.ts`), `cadenciasDoDia` e `itensDaFicha` (`_shared/checklist.js`, criado na Task 2 — **nada a copiar**).
- Produces: nada que outra tarefa consuma.

**Por que `checklist.js` mora em `_shared/` e não em `src/`:** a Edge roda em
Deno e não alcança `src/`, mas o front alcança `supabase/functions/_shared/`.
É o mesmo caminho que `tela-de-admin.vue:156` já usa para `notificacoes.js`,
com o comentário que diz por quê: *"pra não haver duas verdades sobre"*. Um
arquivo, dois consumidores, zero cópia.

- [ ] **Step 1: Escrever a função**

```ts
// supabase/functions/enviar-push-frota/index.ts
// Cron de manhã, segunda a sexta: avisa quem tem carro fixo e ainda não fez o
// checklist de hoje.
//
// SÓ QUEM PRECISA. Um aviso por pessoa, do carro dela — não um aviso geral pra
// todo mundo. Foi assim que o "Vessel está sem saldo" chegou em três pessoas
// que não tinham nada com aquilo, e é o problema que push_preferencias existe
// pra resolver.
//
// NÃO ENVIA quando não tem certeza: se a lista de itens ou a configuração não
// vierem, a função não manda nada. Aviso com contagem errada de itens é pior
// do que silêncio — a pessoa abre, vê outra coisa, e para de confiar.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { inscricoesDoTipo } from '../_shared/notificacoes.js';
import { cadenciasDoDia, itensDaFicha } from '../_shared/checklist.js';
import { montarAviso } from '../_shared/aviso-de-checklist.js';
import { exigirSegredoDeCron } from '../_shared/segredo-de-cron.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Data de hoje em BRT (UTC-3; o Brasil não tem mais horário de verão).
const hojeBrt = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const barrado = exigirSegredoDeCron(req);
  if (barrado) return barrado;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const hoje = hojeBrt();

  const [veiculos, itens, config, fichas, pessoas, subs, prefs] = await Promise.all([
    sb.from('frota_veiculos').select('id,nome,placa,pessoa_id,situacao'),
    sb.from('frota_checklist_itens').select('*').order('ordem'),
    sb.from('frota_checklist_config').select('*').limit(1),
    sb.from('frota_checklist').select('veiculo_id,feita_em,cadencias')
      .gte('feita_em', new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)),
    sb.from('acessos_pessoas').select('id,user_id'),
    sb.from('push_subs').select('*'),
    sb.from('push_preferencias').select('*'),
  ]);

  const cfg = config.data?.[0];
  if (!cfg || !itens.data?.length) {
    return json({ enviados: 0, motivo: 'sem lista ou sem configuração — não envio com dado incompleto' });
  }

  const inscritos = inscricoesDoTipo(subs.data, prefs.data, 'frota');
  if (!inscritos.length) {
    // O caso normal enquanto o dono não ligar o aviso pra ninguém.
    return json({ enviados: 0, motivo: 'ninguém ligou este aviso ainda' });
  }

  // O VAPID vem da tabela segredos_de_cron, NÃO de variável de ambiente — é
  // assim no enviar-push-vendas (linhas 107-110), e a tabela tem RLS ligada com
  // zero policies: só o service role lê.
  const { data: segr } = await sb.from('segredos_de_cron').select('nome,segredo')
    .in('nome', ['vapid_public_key', 'vapid_private_key', 'vapid_subject']);
  const seg = Object.fromEntries((segr || []).map((r: { nome: string; segredo: string }) =>
    [r.nome, r.segredo]));
  if (!seg.vapid_public_key || !seg.vapid_private_key) {
    return json({ error: 'vapid_nao_configurado' }, 500);
  }
  webpush.setVapidDetails(
    seg.vapid_subject || 'mailto:breno@rbvcompany.com',
    seg.vapid_public_key, seg.vapid_private_key);

  const fez = new Set((fichas.data || []).filter((f) => f.feita_em === hoje).map((f) => f.veiculo_id));
  const ultima = (veiculoId: string, cadencia: string) => {
    const l = (fichas.data || [])
      .filter((f) => f.veiculo_id === veiculoId && (f.cadencias || []).includes(cadencia))
      .map((f) => f.feita_em).sort();
    return l.length ? l[l.length - 1] : null;
  };

  let enviados = 0;
  for (const v of veiculos.data || []) {
    if (!v.pessoa_id || v.situacao !== 'ativo' || fez.has(v.id)) continue;

    const cadencias = cadenciasDoDia({
      hoje, config: cfg,
      ultimaSemanal: ultima(v.id, 'semanal'), ultimaMensal: ultima(v.id, 'mensal'),
    });
    if (!cadencias.length) continue;   // fim de semana

    const pessoa = (pessoas.data || []).find((p) => p.id === v.pessoa_id);
    if (!pessoa?.user_id) continue;    // dono sem login: não há pra quem mandar
    const dela = inscritos.filter((s) => String(s.user_id) === String(pessoa.user_id));
    if (!dela.length) continue;

    const aviso = montarAviso({ veiculo: v, itens: itensDaFicha(itens.data, cadencias), cadencias });
    const carga = JSON.stringify({ ...aviso, url: '/frota' });
    for (const s of dela) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga);
        enviados++;
      } catch (e) {
        // Inscrição morta (aparelho trocado, app desinstalado) some da tabela,
        // como faz o enviar-push-vendas.
        if ((e as { statusCode?: number }).statusCode === 410) {
          await sb.from('push_subs').delete().eq('endpoint', s.endpoint);
        }
      }
    }
  }
  return json({ enviados, hoje });
});
```

- [ ] **Step 2: Rodar os testes e deployar**

Run: `npm test`
Expected: PASSA.

Run: `npx supabase functions deploy enviar-push-frota`

- [ ] **Step 3: Agendar o robô**

Criar `db/migrations/acessos/029_frota_cron_checklist.sql`:

```sql
-- O robô da manhã do checklist da Frota.
--
-- Usa disparar_robo() e NÃO net.http_post direto: é a função que registra a
-- execução em robos_execucoes, e é dela que a tela de Saúde dos Robôs vive.
-- cron.job_run_details MENTE — ele marca "succeeded" quando o POST saiu, mesmo
-- que a Edge tenha estourado do outro lado.
--
-- 07h30 BRT = 10h30 UTC. Segunda a sexta: o checklist diário é de dia útil, e
-- avisar no sábado é o jeito de a pessoa desligar a notificação.

-- O segredo próprio desta função. O valor é gerado aqui e nunca aparece no
-- texto de cron.job.command, porque disparar_robo() lê da tabela na hora.
insert into public.segredos_de_cron(nome, segredo)
values ('enviar-push-frota', encode(gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;

select cron.unschedule('enviar-push-frota')
  where exists (select 1 from cron.job where jobname = 'enviar-push-frota');

select cron.schedule(
  'enviar-push-frota',
  '30 10 * * 1-5',
  $$ select public.disparar_robo(
       'enviar-push-frota', 'enviar-push-frota', 'enviar-push-frota',
       '{"origem":"cron-manha"}'::jsonb, 120000) $$
);
```

Antes de rodar, conferir que a coluna de segredo se chama mesmo `segredo` e que
`nome` é único:

Run: `node coletor/consultar.mjs "select column_name from information_schema.columns where table_name='segredos_de_cron'"`

Run: `node coletor/run-acessos-sql.mjs db/migrations/acessos/029_frota_cron_checklist.sql`

Conferir:
```bash
node coletor/consultar.mjs "select jobname, schedule, active from cron.job where jobname like '%frota%'"
```
Expected: uma linha, `30 10 * * 1-5`, ativa.

- [ ] **Step 4: Provar que o robô responde**

Disparar à mão e ler o resultado pelo registro, que é o único lugar que conta a
verdade:

```bash
node coletor/consultar.mjs "select public.disparar_robo('enviar-push-frota','enviar-push-frota','enviar-push-frota','{\"origem\":\"teste\"}'::jsonb, 120000)"
node coletor/consultar.mjs "
select r.robo, r.criado_em, x.status_code, x.content
from public.robos_execucoes r
left join net._http_response x on x.id = r.request_id
where r.robo = 'enviar-push-frota' order by r.criado_em desc limit 1"
```

Expected: `status_code` 200 e, enquanto ninguém tiver ligado o aviso,
`{"enviados":0,"motivo":"ninguém ligou este aviso ainda"}`.

**Isso é sucesso, não falha.** O aviso nasce desligado por regra da casa (D16).
Zero enviados com esse motivo prova que a função rodou, leu as inscrições e
decidiu certo. Se vier outro motivo — "sem lista ou sem configuração" — aí sim é
defeito: significa que a migration 028 não chegou no banco.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/enviar-push-frota db/migrations/acessos/029_frota_cron_checklist.sql
git commit -m "frota: o robo da manha avisa quem ainda nao conferiu o carro"
```

---

## Depois de tudo: o que fica com o dono

1. **Ligar o aviso "Checklist do carro"** em Administração › Usuários para os 7 motoristas. Sem isso ninguém recebe nada — está dito em D16 e no comentário do código.
2. **Conferir a repartição dos 21 itens** na aba Checklist e mudar o que discordar. A proposta é minha, a decisão é dele.
3. **O `git user.email` deste repositório está vazio**, e pela anotação do projeto isso trava o build. Resolver antes do primeiro push.
4. **O Doblo** continua sem revisão registrada. Assim que alguém preencher o primeiro checklist dele, o hodômetro real aparece e dá pra decidir o que fazer com a troca de óleo de 272.257 que a planilha trazia.
